import os
import unittest
from unittest.mock import patch

from backend.app.main import app
from backend.app import main


class MemoryCredentialStore:
    def __init__(self):
        self.value = ""

    def get(self):
        return self.value

    def set(self, value):
        self.value = value

    def clear(self):
        self.value = ""


class SequencedDeepSeekClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def create_reply_drafts(self, messages):
        self.calls.append(messages)
        return self.responses.pop(0)


class MainRoutesTest(unittest.TestCase):
    def setUp(self):
        self.original_store = getattr(main, "credential_store", None)
        main.credential_store = MemoryCredentialStore()

    def tearDown(self):
        if self.original_store is None:
            delattr(main, "credential_store")
        else:
            main.credential_store = self.original_store

    def test_root_returns_service_status(self):
        root_routes = [route for route in app.routes if getattr(route, "path", None) == "/"]

        self.assertEqual(len(root_routes), 1)
        response = root_routes[0].endpoint()
        self.assertEqual(response["ok"], True)
        self.assertEqual(response["service"], "boss-chat-listener-backend")

    def test_key_status_endpoint_returns_only_configured_state(self):
        self.assertTrue(callable(getattr(main, "get_deepseek_key_status", None)))

        response = main.get_deepseek_key_status()

        self.assertEqual(response.configured, False)
        self.assertNotIn("test-key", response.model_dump_json())

    def test_save_endpoint_persists_key_without_returning_it(self):
        self.assertTrue(callable(getattr(main, "save_deepseek_key", None)))

        response = main.save_deepseek_key(api_key="test-key")

        self.assertEqual(response.configured, True)
        self.assertEqual(main.credential_store.get(), "test-key")
        self.assertNotIn("test-key", response.model_dump_json())

    def test_save_endpoint_rejects_blank_key(self):
        self.assertTrue(callable(getattr(main, "save_deepseek_key", None)))

        with self.assertRaises(main.HTTPException) as context:
            main.save_deepseek_key(api_key="   ")

        self.assertEqual(context.exception.status_code, 400)

    def test_clear_endpoint_is_idempotent_and_returns_false_status(self):
        self.assertTrue(callable(getattr(main, "clear_deepseek_key", None)))

        main.credential_store.set("test-key")
        response = main.clear_deepseek_key()

        self.assertEqual(response.configured, False)
        self.assertEqual(main.credential_store.get(), "")

    def test_reply_route_does_not_use_environment_key_when_store_is_empty(self):
        captured_keys = []

        class CapturingClient:
            def __init__(self, *, api_key):
                captured_keys.append(api_key)
                self.api_key = api_key

            def create_reply_drafts(self, messages):
                if not self.api_key:
                    raise main.MissingApiKeyError("missing key")
                return {
                    "drafts": [{"tone": "自然", "text": "您好，想先了解下岗位内容。"}],
                    "model": "test",
                }

        request = main.ReplyDraftRequest(
            records=[main.TranscriptRecord(role="hr", text="你好，方便聊聊吗？")]
        )

        with patch.dict(os.environ, {"DEEPSEEK_API_KEY": "environment-only-key"}):
            with patch.object(main, "DeepSeekClient", CapturingClient):
                response = main.create_reply_drafts(request)

        self.assertEqual(captured_keys, [""])
        self.assertEqual(response.error, "missing_api_key")

    def test_reply_route_retries_once_after_unsafe_output(self):
        main.credential_store.set("test-key")
        client = SequencedDeepSeekClient(
            [
                {
                    "drafts": [{"tone": "稳妥", "text": "不好意思刚看到消息，我没有顾虑。"}],
                    "model": "deepseek-v4-flash",
                },
                {
                    "drafts": [{"tone": "稳妥", "text": "感谢您的联系，我想先了解具体岗位职责。"}],
                    "model": "deepseek-v4-flash",
                },
            ]
        )
        request = main.ReplyDraftRequest(
            records=[main.TranscriptRecord(role="hr", text="看您没回复，是对岗位有顾虑吗？")]
        )

        with patch.object(main, "DeepSeekClient", return_value=client):
            response = main.create_reply_drafts(request)

        self.assertEqual(len(client.calls), 2)
        self.assertIn("上一轮", client.calls[1][-1]["content"])
        self.assertEqual(len(response.drafts), 1)
        self.assertEqual(response.drafts[0].text, "感谢您的联系，我想先了解具体岗位职责。")

    def test_reply_route_uses_safe_fallback_after_two_unsafe_outputs(self):
        main.credential_store.set("test-key")
        unsafe_response = {
            "drafts": [{"tone": "稳妥", "text": "我刚忙完看到消息，没有顾虑。"}],
            "model": "deepseek-v4-flash",
        }
        client = SequencedDeepSeekClient([unsafe_response, unsafe_response])
        request = main.ReplyDraftRequest(
            records=[main.TranscriptRecord(role="hr", text="看您没回复，是对岗位有顾虑吗？")]
        )

        with patch.object(main, "DeepSeekClient", return_value=client):
            response = main.create_reply_drafts(request)

        self.assertEqual(len(client.calls), 2)
        self.assertEqual(response.model, "local-safe-fallback")
        self.assertEqual(response.drafts[0].tone, "安全兜底")
        self.assertNotIn("没有顾虑", response.drafts[0].text)

    def test_reply_route_honors_manual_decline_in_safe_fallback(self):
        main.credential_store.set("test-key")
        unsafe_response = {
            "drafts": [{"tone": "积极", "text": "我很感兴趣，可以继续聊。"}],
            "model": "deepseek-v4-flash",
        }
        client = SequencedDeepSeekClient([unsafe_response, unsafe_response])
        request = main.ReplyDraftRequest(
            records=[main.TranscriptRecord(role="hr", text="你好，方便聊聊吗？")],
            reply_intent="decline",
        )

        with patch.object(main, "DeepSeekClient", return_value=client):
            response = main.create_reply_drafts(request)

        self.assertEqual(response.model, "local-safe-fallback")
        self.assertIn("暂时不考虑了", response.drafts[0].text)
        self.assertNotIn("？", response.drafts[0].text)

    def test_reply_route_blocks_continuation_after_recruiter_rejection(self):
        main.credential_store.set("test-key")
        unsafe_response = {
            "drafts": [{"tone": "积极", "text": "我很感兴趣，可以继续聊聊吗？"}],
            "model": "deepseek-v4-flash",
        }
        client = SequencedDeepSeekClient([unsafe_response, unsafe_response])
        request = main.ReplyDraftRequest(
            records=[
                main.TranscriptRecord(
                    role="hr",
                    text="感谢关注，不过目前和岗位不太匹配，这次先不推进了。",
                )
            ],
            reply_intent="auto",
        )

        with patch.object(main, "DeepSeekClient", return_value=client):
            response = main.create_reply_drafts(request)

        self.assertEqual(len(client.calls), 2)
        self.assertEqual(response.model, "local-safe-fallback")
        self.assertIn("感谢告知", response.drafts[0].text)
        self.assertNotIn("？", response.drafts[0].text)


if __name__ == "__main__":
    unittest.main()
