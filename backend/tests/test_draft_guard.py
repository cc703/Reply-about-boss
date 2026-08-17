import unittest

from backend.app import draft_guard


class DraftGuardTest(unittest.TestCase):
    def test_rejects_unsupported_delayed_reply_excuses_and_certainty_claims(self):
        drafts = [
            {"tone": "稳妥", "text": "不好意思刚看到消息，我没有顾虑。"},
            {"tone": "平衡", "text": "感谢您的联系，我想先了解具体岗位职责。"},
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "看您没回复，是对岗位有顾虑吗？"}],
        )

        self.assertEqual(
            safe,
            [{"tone": "平衡", "text": "感谢您的联系，我想先了解具体岗位职责。"}],
        )

    def test_allows_phrase_when_candidate_already_stated_it(self):
        drafts = [{"tone": "稳妥", "text": "刚看到消息，方便继续聊聊岗位吗？"}]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "self", "text": "刚看到消息"}],
        )

        self.assertEqual(safe, drafts)

    def test_rejects_semantic_variants_that_deny_candidate_concerns(self):
        drafts = [
            {"tone": "稳妥", "text": "我目前没有特别的顾虑，想先了解岗位。"},
            {"tone": "平衡", "text": "我并不是有顾虑，只是想继续沟通。"},
            {"tone": "自然", "text": "不算顾虑，就是想多了解下岗位具体做什么。"},
            {"tone": "简洁", "text": "感谢您的联系，我想先进一步了解岗位。"},
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "是对岗位有什么顾虑吗？"}],
        )

        self.assertEqual(
            safe,
            [{"tone": "简洁", "text": "感谢您的联系，我想先进一步了解岗位。"}],
        )

    def test_rejects_invented_personal_schedule_details(self):
        drafts = [
            {"tone": "自然", "text": "我得先看下明天下午有没有课，确认后跟您说。"},
            {"tone": "学生气", "text": "明天下午三点我先看看自己有没有别的安排，待会儿回复您。"},
            {"tone": "稳妥", "text": "我先确认一下明天下午的安排，稍后回复您。"},
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "明天下午三点方便参加面试吗？"}],
        )

        self.assertEqual(
            safe,
            [{"tone": "稳妥", "text": "我先确认一下明天下午的安排，稍后回复您。"}],
        )

    def test_rejects_unconfirmed_role_acceptance_and_attendance_commitments(self):
        drafts = [
            {
                "tone": "稳妥",
                "text": "后端接口开发这个方向我可以接受，每周到岗三天也还行。想问下技术栈？",
            },
            {
                "tone": "友好",
                "text": "这个安排我觉得挺合适的，到岗三天没问题。想问下主要业务？",
            },
            {
                "tone": "自然",
                "text": "工作内容了解了，到岗时间我得确认一下。想问下团队主要做哪类项目？",
            },
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "岗位做后端接口开发，每周到岗三天，你觉得怎么样？"}],
        )

        self.assertEqual(
            safe,
            [{
                "tone": "自然",
                "text": "工作内容了解了，到岗时间我得确认一下。想问下团队主要做哪类项目？",
            }],
        )

    def test_rejects_unsupported_technical_experience_claims(self):
        drafts = [
            {"tone": "稳妥", "text": "我了解 Python 原理，也对 FastAPI 有一定使用经验。"},
            {"tone": "谨慎", "text": "我基础还算扎实，用过 Flask 做接口开发。"},
            {"tone": "谨慎", "text": "Python 日常有接触，FastAPI 用得不算多。方便说下具体要求吗？"},
            {"tone": "谨慎", "text": "Python 我平时写一些，但 FastAPI 不算特别熟，想问下具体要求？"},
            {"tone": "中性", "text": "感谢您的询问，方便先介绍一下岗位的技术要求吗？"},
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "你对 Python 和 FastAPI 掌握怎么样？"}],
        )

        self.assertEqual(
            safe,
            [{"tone": "中性", "text": "感谢您的询问，方便先介绍一下岗位的技术要求吗？"}],
        )

    def test_rejects_unconfirmed_general_chat_availability(self):
        drafts = [
            {"tone": "自然", "text": "方便呀，想先了解下这个岗位主要做什么？"},
            {"tone": "自然", "text": "可以的，正好想问问这个岗位的具体情况。"},
            {"tone": "自然", "text": "方便，您能简单介绍下工作内容吗？"},
            {"tone": "自然", "text": "你好，可以的。想先了解下这个岗位具体负责什么？"},
            {"tone": "自然", "text": "你好，方便聊。能不能先简单说下岗位日常工作内容？"},
            {"tone": "自然", "text": "你好，我看到消息了。想先问下这个岗位主要做什么？"},
            {"tone": "稳妥", "text": "您好，想先了解下这个岗位主要做什么。"},
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "你好，看了你的简历，方便聊聊吗？"}],
        )

        self.assertEqual(
            safe,
            [{"tone": "稳妥", "text": "您好，想先了解下这个岗位主要做什么。"}],
        )

    def test_rejects_unconfirmed_chat_and_interview_availability(self):
        drafts = [
            {"tone": "平衡", "text": "您好，我方便沟通，您可以介绍一下岗位。"},
            {"tone": "积极", "text": "明天下午三点我有时间，很期待这次面试。"},
            {"tone": "谨慎", "text": "可以的，明天下午三点可以参加面试。"},
            {"tone": "中性", "text": "感谢邀请，这个时间我需要确认安排，确认后尽快回复您。"},
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "明天下午三点方便参加线上面试吗？"}],
        )

        self.assertEqual(
            safe,
            [{"tone": "中性", "text": "感谢邀请，这个时间我需要确认安排，确认后尽快回复您。"}],
        )

    def test_builds_grounded_fallbacks_for_common_recruiter_intents(self):
        scenarios = {
            "technical": (
                "你对 Python 和 FastAPI 掌握怎么样？",
                "岗位平时主要用哪些技术",
            ),
            "interview": (
                "明天下午三点方便参加线上面试吗？",
                "先确认一下这个时间的安排",
            ),
            "concern": (
                "看您没回复，是对岗位有顾虑吗？",
                "主要想先了解清楚具体岗位内容和要求",
            ),
            "job_details": (
                "岗位主要做后端开发，每周到岗四天，你觉得怎么样？",
                "到岗时间我得确认一下",
            ),
            "greeting": (
                "你好，看了你的简历，方便聊聊吗？",
                "这个岗位主要做什么",
            ),
        }

        for name, (hr_text, expected_text) in scenarios.items():
            with self.subTest(name=name):
                drafts = draft_guard.build_safe_fallback([{"role": "hr", "text": hr_text}])
                self.assertEqual(drafts[0]["tone"], "安全兜底")
                self.assertIn(expected_text, drafts[0]["text"])
                self.assertNotIn("感谢您的联系", drafts[0]["text"])
                self.assertNotIn("感谢您的询问", drafts[0]["text"])
                self.assertNotIn("结合实际情况如实说明", drafts[0]["text"])
                self.assertNotIn("进一步判断", drafts[0]["text"])
                self.assertNotIn("可以的", drafts[0]["text"])

    def test_natural_fallbacks_are_short_and_practical(self):
        drafts = draft_guard.build_safe_fallback([
            {"role": "hr", "text": "你好，看了你的简历，方便聊聊吗？"},
        ])

        self.assertLessEqual(len(drafts[0]["text"]), 100)
        self.assertIn("实习生", drafts[0]["text"])

    def test_job_details_fallback_does_not_invent_attendance_days(self):
        drafts = draft_guard.build_safe_fallback([{
            "role": "hr",
            "text": "岗位主要做接口开发，每周到岗三天，你觉得怎么样？",
        }])

        self.assertNotIn("四天", drafts[0]["text"])
        self.assertIn("到岗时间我得确认一下", drafts[0]["text"])

    def test_builds_terminal_fallbacks_without_invented_reasons_or_questions(self):
        scenarios = {
            "auto_rejection": (
                "auto",
                "这个岗位目前和你的经历不太匹配，这次先不推进了。",
                "感谢告知",
            ),
            "manual_decline": (
                "decline",
                "你好，看了你的简历，方便聊聊吗？",
                "暂时不考虑了",
            ),
            "manual_close": (
                "close",
                "好的，后续有消息再联系。",
                "了解了",
            ),
        }

        for name, (reply_intent, hr_text, expected_text) in scenarios.items():
            with self.subTest(name=name):
                drafts = draft_guard.build_safe_fallback(
                    [{"role": "hr", "text": hr_text}],
                    reply_intent=reply_intent,
                )
                text = drafts[0]["text"]
                self.assertIn(expected_text, text)
                self.assertNotIn("？", text)
                self.assertNotIn("薪资", text)
                self.assertNotIn("通勤", text)
                self.assertNotIn("时间安排", text)

    def test_rejects_continuation_drafts_after_recruiter_rejection(self):
        drafts = [
            {"tone": "积极", "text": "我对这个岗位很感兴趣，可以继续聊聊吗？"},
            {"tone": "自然", "text": "好的，谢谢告知，祝您招聘顺利。"},
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "目前和岗位不太匹配，这次先不推进了。"}],
            reply_intent="auto",
        )

        self.assertEqual(
            safe,
            [{"tone": "自然", "text": "好的，谢谢告知，祝您招聘顺利。"}],
        )

    def test_manual_decline_requires_an_explicit_decline_without_follow_up_question(self):
        drafts = [
            {"tone": "自然", "text": "谢谢您的联系。"},
            {"tone": "自然", "text": "这个岗位我暂时不考虑了，方便介绍下其他岗位吗？"},
            {"tone": "自然", "text": "谢谢您的联系，这个岗位我暂时不考虑了。"},
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "你好，看了你的简历，方便聊聊吗？"}],
            reply_intent="decline",
        )

        self.assertEqual(
            safe,
            [{"tone": "自然", "text": "谢谢您的联系，这个岗位我暂时不考虑了。"}],
        )

    def test_manual_close_rejects_new_questions_and_continuation(self):
        drafts = [
            {"tone": "自然", "text": "好的，那方便再介绍一下岗位吗？"},
            {"tone": "自然", "text": "好的，了解了，谢谢您的说明。"},
        ]

        safe = draft_guard.filter_grounded_drafts(
            drafts,
            [{"role": "hr", "text": "好的，后续有消息再联系。"}],
            reply_intent="close",
        )

        self.assertEqual(
            safe,
            [{"tone": "自然", "text": "好的，了解了，谢谢您的说明。"}],
        )


if __name__ == "__main__":
    unittest.main()
