"""Deterministic safety checks for generated reply drafts."""

from __future__ import annotations

import re
from typing import Dict, Iterable, List, Mapping

from .prompt_builder import analyze_reply_intent


UNSUPPORTED_CLAIM_PHRASES = (
    "刚看到消息",
    "刚看到您的消息",
    "刚忙完",
    "最近在忙",
    "忙其他事情",
    "回复晚了",
    "没及时回复",
    "未及时回复",
    "没有顾虑",
    "没什么顾虑",
    "没有问题",
    "没问题",
    "还在看机会",
    "我方便沟通",
    "我方便聊聊",
    "方便聊聊的",
    "我有时间",
    "可以参加面试",
    "可以参加线上面试",
    "很期待这次面试",
    "可以的",
    "看到消息了",
    "日常有接触",
    "平时有接触",
    "接触得不多",
    "用得不算多",
    "用得不多",
    "不算特别熟",
    "有没有课",
    "有课",
    "要上课",
    "在上课",
    "课程安排",
    "要开会",
    "在开会",
    "要上班",
    "在上班",
)

UNSUPPORTED_CLAIM_PATTERNS = (
    re.compile(r"(?:没有|没什么|并无|不存在|不是有|并不是有).{0,8}顾虑"),
    re.compile(r"(?:不算|算不上|谈不上).{0,8}顾虑"),
    re.compile(r"(?:没有|没什么|并无).{0,8}问题"),
    re.compile(
        r"我(?![^，。！？]{0,8}(?:想|希望|需要)).{0,16}(?:了解|熟悉|掌握|用过|使用过|做过|有.{0,6}经验|"
        r"基础.{0,6}(?:扎实|不错)|能(?:够)?(?:完成|开发|使用))"
    ),
    re.compile(r"我.{0,16}(?:感兴趣|有兴趣)"),
    re.compile(r"我.{0,16}(?:方便(?:聊|沟通)|有时间|可以参加|能够参加|能参加)"),
    re.compile(r"可以的.{0,24}(?:参加|面试)"),
    re.compile(r"(?:今天|明天|后天|上午|下午|晚上|[一二三四五六七八九十\d]+点).{0,16}(?:有时间|可以参加|能够参加|能参加)"),
    re.compile(r"可以聊聊(?:的|[，。！？])"),
    re.compile(r"我.{0,16}(?:可以接受|能接受|能够接受|觉得.{0,8}(?:合适|还行|可以))"),
    re.compile(r"(?:每周)?到岗.{0,10}(?:没问题|没有问题|可以|还行|能接受|可以接受)"),
    re.compile(r"我.{0,20}(?:看看|确认).{0,12}(?:有没有|是否有).{0,8}(?:别的|其他).{0,6}(?:安排|事情)"),
    re.compile(r"^(?:方便[呀的，。！]|可以(?:的)?[呀，。！])"),
    re.compile(r"(?:^|[，。！？])[^，。！？]{0,20}(?:有一定|有些)(?:了解|基础|经验)"),
    re.compile(r"我.{0,8}(?:平时|日常).{0,8}(?:写|用|接触|做)"),
    re.compile(r"(?:^|[，。！？])(?:你好|您好)?[，,]?\s*方便(?:聊|沟通)(?:[呀的，。！？]|$)"),
)

TERMINAL_CONTINUATION_PHRASES = (
    "想了解",
    "进一步了解",
    "继续聊",
    "继续沟通",
    "进一步沟通",
    "感兴趣",
    "有兴趣",
    "方便介绍",
    "方便说",
    "方便问",
    "想问",
    "请问",
)

DECLINE_PHRASES = (
    "不考虑",
    "暂不考虑",
    "暂时不考虑",
    "先不考虑",
    "不太合适",
    "不太匹配",
    "暂时不看",
    "先不看",
)


def _normalize_text(value: object) -> str:
    return " ".join(str(value or "").replace("\u00a0", " ").split()).strip()


def _contains_unsupported_claim(text: str, candidate_context: str) -> bool:
    if any(
        phrase in text and phrase not in candidate_context
        for phrase in UNSUPPORTED_CLAIM_PHRASES
    ):
        return True

    return any(
        match.group(0) not in candidate_context
        for pattern in UNSUPPORTED_CLAIM_PATTERNS
        for match in pattern.finditer(text)
    )


def _violates_reply_intent(text: str, resolved_intent: str) -> bool:
    if resolved_intent not in {"decline", "close", "acknowledge_rejection"}:
        return False

    if "？" in text or "?" in text:
        return True

    if any(phrase in text for phrase in TERMINAL_CONTINUATION_PHRASES):
        return True

    if resolved_intent == "decline":
        return not any(phrase in text for phrase in DECLINE_PHRASES)

    return False


def filter_grounded_drafts(
    drafts: Iterable[Mapping[str, object]],
    records: Iterable[Mapping[str, object]],
    *,
    reply_intent: str = "auto",
) -> List[Dict[str, str]]:
    record_list = list(records)
    candidate_context = " ".join(
        _normalize_text(record.get("text"))
        for record in record_list
        if _normalize_text(record.get("role")).lower() == "self"
    )
    resolved_intent = analyze_reply_intent(
        record_list,
        requested_intent=reply_intent,
    )["resolved_intent"]
    safe: List[Dict[str, str]] = []

    for draft in drafts:
        text = _normalize_text(draft.get("text"))
        tone = _normalize_text(draft.get("tone")) or "稳妥"
        unsupported = _contains_unsupported_claim(text, candidate_context)
        intent_violation = _violates_reply_intent(text, resolved_intent)

        if text and not unsupported and not intent_violation:
            safe.append({"tone": tone[:24], "text": text[:800]})

        if len(safe) >= 3:
            break

    return safe


def build_safe_fallback(
    records: Iterable[Mapping[str, object]],
    *,
    reply_intent: str = "auto",
) -> List[Dict[str, str]]:
    record_list = list(records)
    latest_hr_message = ""
    for record in record_list:
        if _normalize_text(record.get("role")).lower() == "hr":
            latest_hr_message = _normalize_text(record.get("text"))

    if not latest_hr_message:
        return []

    resolved_intent = analyze_reply_intent(
        record_list,
        requested_intent=reply_intent,
    )["resolved_intent"]

    if resolved_intent == "acknowledge_rejection":
        text = "好的，感谢告知，祝您招聘顺利。"
    elif resolved_intent == "decline":
        text = "您好，谢谢您的邀请，这个岗位我这边暂时不考虑了。"
    elif resolved_intent == "close":
        text = "好的，了解了，谢谢您的说明。"
    elif any(keyword in latest_hr_message for keyword in ("面试", "方便参加", "几点")):
        text = "收到，我先确认一下这个时间的安排，稍后回复您。方便问下面试大概多久吗？"
    elif any(keyword in latest_hr_message for keyword in ("顾虑", "没回复", "没有回复")):
        text = "我这边主要想先了解清楚具体岗位内容和要求，再看看是否匹配。方便介绍下日常工作吗？"
    elif any(keyword in latest_hr_message for keyword in ("岗位主要", "每周到岗", "工作内容", "职责")):
        text = "了解了，到岗时间我得确认一下。想问下团队主要做哪类项目？"
    elif any(keyword.lower() in latest_hr_message.lower() for keyword in ("python", "fastapi", "flask", "技术", "掌握", "熟悉")):
        text = (
            "这部分我得结合自己的实际情况来说。想问下岗位平时主要用哪些技术，对实习生一般要求到什么程度？"
        )
    else:
        text = "您好，想先了解一下这个岗位主要做什么，以及对实习生有哪些要求？"

    return [{"tone": "安全兜底", "text": text}]
