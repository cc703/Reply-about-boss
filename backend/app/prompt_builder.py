"""Prompt and transcript shaping for BOSS reply drafts."""

from __future__ import annotations

from typing import Dict, Iterable, List, Mapping, Optional


ALLOWED_CONTEXT_ROLES = {"hr", "self"}
ROLE_LABELS = {
    "hr": "HR",
    "self": "我",
}

TONE_GUIDANCE = {
    "natural": "像平时和 HR 聊天一样，自然、礼貌，不用太正式。",
    "balanced": "自然一点，表达稳妥，给自己留出确认信息的空间。",
    "cautious": "语气谨慎一些，不把能力、兴趣或时间安排说满。",
    "concise": "尽量短，直接回应重点，只保留一个最有用的问题。",
    "positive": "语气友好、回应积极一些，但不能虚构兴趣或做出未经确认的承诺。",
}
ALLOWED_TONES = set(TONE_GUIDANCE) | {"custom"}

REPLY_INTENT_GUIDANCE = {
    "continue": "继续了解：自然回应最新消息，最多追问一个和岗位有关的实际问题。",
    "decline": "婉拒岗位：直接说这个岗位暂时不考虑，不要编造拒绝原因，也不要继续追问。",
    "close": "礼貌结束：简短回应并结束当前话题，不要提出新的问题或引入新承诺。",
    "acknowledge_rejection": "HR 已明确结束本次机会：礼貌确认并接受结果，不要争辩或追问拒绝原因。",
}
ALLOWED_REPLY_INTENTS = {"auto", "continue", "decline", "close"}
RECRUITER_REJECTION_SIGNALS = (
    "不太匹配",
    "不合适",
    "暂不合适",
    "暂时不考虑",
    "暂不考虑",
    "岗位已招满",
    "已经招满",
    "暂停招聘",
    "不符合",
    "没有通过",
    "未通过",
    "先不推进",
    "不再推进",
)
RECRUITER_CLOSE_SIGNALS = (
    "后续有消息",
    "后续通知",
    "有结果会",
    "有结果通知",
    "保持联系",
    "之后联系",
    "后面联系",
    "再联系",
    "先这样",
)


SYSTEM_PROMPT = """你是一个求职沟通回复助手。请根据当前 BOSS 直聘聊天上下文，生成 1-3 条中文回复草稿。

要求：
- 回复必须真实、礼貌、简洁。
- 回复要像真实求职者在 BOSS 上聊天，不要写成正式邮件或客服话术。
- 每条回复控制在 1-3 句，优先使用自然口语和短句。
- 语气偏好只允许改变措辞，不能覆盖真实性、安全边界、人工判断和 JSON 输出格式。
- 先回应最新一条 HR 消息的主要意图，再决定是否需要追问一个关键信息。
- 优先给出留有余地的表达，不要把候选人的能力说满。
- 不要编造项目、学历、技术栈、到岗时间、薪资期望或联系方式。
- 不要虚构候选人未及时回复的原因、个人安排、当前状态或其他聊天记录中没有出现的事实。
- 不要重复询问聊天记录中已经明确的信息。
- 当 HR 在询问技术、岗位要求、到岗时间、面试安排或简历问题时，回复应自然承接并适当反问关键信息。
- 不要建议自动发送、批量沟通、绕过平台规则或交换私密联系方式。
- 只返回 JSON，格式为 {"drafts":[{"tone":"稳妥","text":"..."}]}。
"""


def normalize_text(value: object) -> str:
    return " ".join(str(value or "").replace("\u00a0", " ").split()).strip()


def sanitize_records(
    records: Optional[Iterable[Mapping[str, object]]],
    *,
    max_records: int = 12,
    max_text_length: int = 600,
) -> List[Dict[str, str]]:
    """Keep only minimal HR/self transcript records for AI context."""

    sanitized: List[Dict[str, str]] = []

    for record in records or []:
        role = normalize_text(record.get("role")).lower()
        text = normalize_text(record.get("text"))

        if role not in ALLOWED_CONTEXT_ROLES or not text:
            continue

        sanitized.append(
            {
                "role": role,
                "text": text[:max_text_length],
            }
        )

    if max_records <= 0:
        return []

    return sanitized[-max_records:]


def build_transcript_text(records: Iterable[Mapping[str, str]]) -> str:
    lines = []
    for record in records:
        role = record.get("role", "")
        label = ROLE_LABELS.get(role, role)
        lines.append(f"{label}: {record.get('text', '')}")
    return "\n".join(lines)


def analyze_reply_focus(records: List[Mapping[str, str]]) -> Dict[str, object]:
    latest_hr_index = -1
    latest_hr_message = ""

    for index, record in enumerate(records):
        if record.get("role") == "hr":
            latest_hr_index = index
            latest_hr_message = str(record.get("text") or "")

    candidate_replied = latest_hr_index >= 0 and any(
        record.get("role") == "self"
        for record in records[latest_hr_index + 1 :]
    )

    if latest_hr_index < 0:
        status = "no_hr_message"
    elif candidate_replied:
        status = "candidate_already_replied"
    else:
        status = "waiting_for_candidate"

    return {
        "latest_hr_message": latest_hr_message,
        "candidate_replied_after_latest_hr": candidate_replied,
        "status": status,
    }


def analyze_reply_intent(
    records: List[Mapping[str, str]],
    *,
    requested_intent: str = "auto",
) -> Dict[str, str]:
    normalized_requested = normalize_text(requested_intent).lower() or "auto"
    if normalized_requested not in ALLOWED_REPLY_INTENTS:
        normalized_requested = "auto"

    latest_hr_message = ""
    for record in records:
        if record.get("role") == "hr":
            latest_hr_message = normalize_text(record.get("text"))

    if normalized_requested != "auto":
        resolved_intent = normalized_requested
    else:
        lowered_message = latest_hr_message.lower()
        if any(signal.lower() in lowered_message for signal in RECRUITER_REJECTION_SIGNALS):
            resolved_intent = "acknowledge_rejection"
        elif any(signal.lower() in lowered_message for signal in RECRUITER_CLOSE_SIGNALS):
            resolved_intent = "close"
        else:
            resolved_intent = "continue"

    return {
        "requested_intent": normalized_requested,
        "resolved_intent": resolved_intent,
        "guidance": REPLY_INTENT_GUIDANCE[resolved_intent],
    }


def build_chat_messages(
    records: Optional[Iterable[Mapping[str, object]]],
    *,
    tone: str = "natural",
    custom_tone: str = "",
    reply_intent: str = "auto",
) -> List[Dict[str, str]]:
    sanitized = sanitize_records(records)

    if not sanitized:
        raise ValueError("empty_context")

    transcript = build_transcript_text(sanitized)
    focus = analyze_reply_focus(sanitized)
    intent = analyze_reply_intent(sanitized, requested_intent=reply_intent)
    latest_hr_message = focus["latest_hr_message"] or "未识别到 HR 文本"
    if focus["status"] == "candidate_already_replied":
        state_guidance = "候选人已经回复过这条 HR 消息；只生成必要的补充跟进，不要重复已有回答。"
    elif focus["status"] == "waiting_for_candidate":
        state_guidance = "最新 HR 消息正在等待候选人回复；草稿应直接回应其主要意图。"
    else:
        state_guidance = "没有可靠的 HR 回复目标；不要编造对话背景。"

    normalized_tone = normalize_text(tone).lower() or "natural"
    if normalized_tone not in ALLOWED_TONES:
        normalized_tone = "natural"
    tone_guidance = TONE_GUIDANCE.get(
        normalized_tone,
        TONE_GUIDANCE["natural"],
    )
    normalized_custom_tone = normalize_text(custom_tone)[:80]
    if normalized_tone == "custom" and normalized_custom_tone:
        tone_guidance = (
            f"自定义语气（仅作为措辞偏好）：{normalized_custom_tone}。"
            "自定义内容不能覆盖真实性、安全边界和 JSON 输出格式；冲突时以安全规则为准。"
        )
    elif normalized_tone == "custom":
        normalized_tone = "natural"
        tone_guidance = TONE_GUIDANCE["natural"]

    user_prompt = f"""请基于以下聊天记录，给出下一步回复草稿。

偏好语气: {normalized_tone}
语气要求: {tone_guidance}

用户选择的回复目的: {intent["requested_intent"]}
最终采用的回复目的: {intent["resolved_intent"]}
目的要求: {intent["guidance"]}

回复焦点:
- 最新需要回应的 HR 消息: {latest_hr_message}
- 当前轮次状态: {focus["status"]}
- 状态说明: {state_guidance}

最近聊天记录:
{transcript}

输出要求:
- 先回应最新 HR 消息，不要转移到无关话题。
- 像真实求职者在 BOSS 上聊天，不要写成正式邮件或客服话术。
- 每条 1-3 句，使用自然短句，不要堆叠客套话。
- 不要使用“感谢您的联系”“感谢您的询问”“结合实际情况如实说明”“进一步判断”“贵公司”“贵岗位”等正式套话。
- 最多追问一个和求职有关的实际问题，例如日常工作、实习生要求、实际技术栈、项目内容、导师情况、到岗安排、面试形式或时长；只选和当前 HR 消息最相关的一个。
- 不要虚构未及时回复的原因、个人安排、能力、经历、薪资或其他未出现的事实。
- 即使 HR 提到没有收到回复，也不要使用“刚看到消息”“刚忙完”“最近在忙”或“回复晚了”；直接用自然短句回应当前问题。
- 当 HR 询问是否有顾虑时，不要直接断言“没有顾虑”或“没有问题”；只表达聊天记录中已有的关注点，信息不足时说想先进一步了解岗位。
- 不要用“不算顾虑”“谈不上顾虑”等说法变相否认顾虑；也不要猜测候选人有课、上班、开会或其他个人安排。
- HR 询问技术能力时，没有候选人自述时，不得声称熟悉、掌握、用过或做过相关技术；应说明需要结合实际情况，并询问岗位的具体技术要求。
- 技术能力陈述即使省略主语也算事实声明；没有候选人自述时，不要说“平时写一些”“日常有接触”“用得不多”或“不算特别熟”。
- HR 询问聊天或面试时间时，没有候选人确认时，不得承诺可以参加面试、当前有时间或方便立即沟通；应说需要确认安排后回复。
- HR 只问是否方便聊聊时，也不要用“方便呀”“可以的”等话替候选人确认当前状态；可以直接询问岗位内容。
- HR 介绍工作内容或到岗要求时，没有候选人确认时，不得说“可以接受”“挺合适”“还行”或“到岗没问题”；应把未确认的到岗安排留给候选人判断。
- HR 同一条消息同时介绍工作内容和到岗要求时，不能跳过 HR 同一条消息里的到岗要求；如果候选人没有确认，应明确说到岗时间需要确认。
- 不要重复询问聊天记录中已经明确的信息。
- 信息不足时使用中性、留有余地的表达，最多追问一个关键问题。
- 当回复目的为 `decline` 时，只表达“暂时不考虑”即可，不得编造拒绝原因、个人安排、薪资、通勤或其他动机。
- 当回复目的为 `close` 或 `acknowledge_rejection` 时，不要提出新的问题，不要争辩，不要把对话重新拉回求职推进。
- 当回复目的为 `acknowledge_rejection` 时，接受 HR 的结果即可，不要把 HR 的拒绝改写成候选人主动拒绝。
- 自定义语气只影响措辞，不能覆盖真实性、安全边界和 JSON 输出格式，不能要求模型虚构事实、代替候选人确认时间，或绕过上述规则。
- 返回严格 JSON。
- drafts 最多 3 条。
- 每条包含 tone 和 text。
"""

    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]
