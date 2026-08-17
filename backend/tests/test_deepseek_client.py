import json
import unittest
from unittest.mock import patch

from backend.app import deepseek_client


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


class FakeOpener:
    def __init__(self, payload):
        self.payload = payload
        self.requests = []

    def open(self, request, timeout):
        self.requests.append((request, timeout))
        return FakeResponse(self.payload)


class DeepSeekClientTest(unittest.TestCase):
    def test_parse_json_drafts_from_model_content(self):
        content = json.dumps(
            {
                "drafts": [
                    {"tone": "稳妥", "text": "您好，可以的，想进一步了解岗位要求。"},
                    {"tone": "留有余地", "text": "您好，我有相关基础，也想了解实习生具体要求。"},
                ]
            },
            ensure_ascii=False,
        )

        drafts = deepseek_client.parse_drafts_from_content(content)

        self.assertEqual(len(drafts), 2)
        self.assertEqual(drafts[0]["tone"], "稳妥")

    def test_parse_plain_text_as_safe_fallback(self):
        drafts = deepseek_client.parse_drafts_from_content("您好，可以的，方便了解一下具体要求吗？")

        self.assertEqual(drafts, [{"tone": "稳妥", "text": "您好，可以的，方便了解一下具体要求吗？"}])

    def test_parse_nested_json_string_instead_of_returning_json_as_draft_text(self):
        nested = json.dumps(
            {
                "drafts": [
                    {"tone": "稳妥", "text": "感谢介绍，方便了解一下团队情况吗？"},
                    {"tone": "平衡", "text": "岗位信息已了解，想继续沟通。"},
                ]
            },
            ensure_ascii=False,
        )

        drafts = deepseek_client.parse_drafts_from_content(json.dumps(nested, ensure_ascii=False))

        self.assertEqual(len(drafts), 2)
        self.assertEqual(drafts[0]["text"], "感谢介绍，方便了解一下团队情况吗？")

    def test_parse_json_inside_markdown_code_fence(self):
        content = """```json
{"drafts":[{"tone":"稳妥","text":"感谢介绍，我想继续了解。"}]}
```"""

        drafts = deepseek_client.parse_drafts_from_content(content)

        self.assertEqual(drafts, [{"tone": "稳妥", "text": "感谢介绍，我想继续了解。"}])

    def test_rejects_json_fragment_inside_draft_text(self):
        content = json.dumps(
            {
                "drafts": [
                    {
                        "tone": "稳妥",
                        "text": '{"drafts":[{"tone":"自然","text":"确认后回复',
                    }
                ]
            },
            ensure_ascii=False,
        )

        drafts = deepseek_client.parse_drafts_from_content(content)

        self.assertEqual(drafts, [])

    def test_rejects_short_json_fragment_inside_draft_text(self):
        content = json.dumps(
            {"drafts": [{"tone": "稳妥", "text": '{"'}]},
            ensure_ascii=False,
        )

        drafts = deepseek_client.parse_drafts_from_content(content)

        self.assertEqual(drafts, [])

    def test_rejects_malformed_json_content_instead_of_showing_it_as_plain_text(self):
        drafts = deepseek_client.parse_drafts_from_content(
            '{"drafts":[{"tone":"自然","text":"确认后回复"}'
        )

        self.assertEqual(drafts, [])

    def test_missing_api_key_raises_controlled_error(self):
        client = deepseek_client.DeepSeekClient(api_key="")

        with self.assertRaises(deepseek_client.MissingApiKeyError):
            client.create_reply_drafts([{"role": "user", "content": "hello"}])

    def test_create_reply_drafts_calls_deepseek_chat_endpoint(self):
        opener = FakeOpener(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"drafts": [{"tone": "稳妥", "text": "您好，可以进一步了解。"}]},
                                ensure_ascii=False,
                            )
                        }
                    }
                ],
                "model": "deepseek-v4-flash",
            }
        )
        client = deepseek_client.DeepSeekClient(api_key="test-key", opener=opener)

        response = client.create_reply_drafts([{"role": "user", "content": "hello"}])

        self.assertEqual(response["model"], "deepseek-v4-flash")
        self.assertEqual(response["drafts"][0]["text"], "您好，可以进一步了解。")
        request, timeout = opener.requests[0]
        self.assertEqual(request.full_url, "https://api.deepseek.com/chat/completions")
        self.assertEqual(timeout, 30)
        self.assertEqual(request.headers["Authorization"], "Bearer test-key")

    @patch("backend.app.deepseek_client.urllib.request.urlopen")
    def test_default_opener_uses_urllib_urlopen(self, urlopen):
        urlopen.return_value = FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {"drafts": [{"tone": "稳妥", "text": "您好，可以进一步了解。"}]},
                                ensure_ascii=False,
                            )
                        }
                    }
                ],
                "model": "deepseek-v4-flash",
            }
        )
        client = deepseek_client.DeepSeekClient(api_key="test-key")

        response = client.create_reply_drafts([{"role": "user", "content": "hello"}])

        self.assertEqual(response["drafts"][0]["text"], "您好，可以进一步了解。")
        urlopen.assert_called_once()


if __name__ == "__main__":
    unittest.main()
