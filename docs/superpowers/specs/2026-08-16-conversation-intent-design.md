# Conversation Intent Design

## Goal

Support common job-seeking conversation outcomes that are different from tone:

- continue learning about the role;
- politely decline the opportunity;
- acknowledge a recruiter rejection;
- close the current conversation naturally.

The extension should automatically recognize obvious recruiter rejection/closing messages while still allowing the user to choose the intended response manually.

## Product Decision

Add a `回复目的` selector with four choices:

- `自动判断` (default)
- `继续了解`
- `婉拒岗位`
- `礼貌结束`

Tone remains a separate selector. A user can therefore choose, for example, `婉拒岗位 + 简洁直接` or `继续了解 + 稳妥留余地`.

## Automatic Recognition

The backend inspects the latest recruiter message after transcript cleaning:

- Explicit rejection signals such as mismatch, position filled, paused recruitment, or no further process resolve to `acknowledge_rejection`.
- Explicit closing/notification signals such as future notification, keep in touch, or contact later resolve to `close`.
- Questions, role introductions, interview invitations, and uncertain messages resolve to `continue`.

Automatic recognition is conservative. It does not infer rejection from a short neutral message such as `好的` alone.

## Manual Intent Semantics

- `continue`: respond to the latest recruiter intent and ask at most one useful question.
- `decline`: state only that the candidate is not considering the role; do not invent a reason.
- `close`: acknowledge the message and end naturally; do not introduce a new question.
- `auto`: use the conservative backend result.

If the recruiter has already rejected the candidate, the response acknowledges the decision rather than rejecting the recruiter in return.

## Prompt And Fallback Contract

The prompt includes requested intent, resolved intent, and a short intent instruction. Intent overrides tone when they conflict: a positive tone cannot turn a decline into continued interest, and a custom tone cannot force an invented rejection reason.

Deterministic fallbacks cover:

- recruiter rejection acknowledgement;
- candidate-selected decline;
- candidate-selected close;
- existing continue-conversation categories.

## Privacy And Safety

- Intent is a short enum sent only to the localhost backend after manual generation.
- No new browser permission or persistent storage is added.
- No automatic fill or send behavior is added.
- Decline/close choices never fabricate salary, commute, schedule, personal reasons, competing offers, or technical mismatch.

## Verification

- Pure backend tests cover rejection, close, continue, and manual override.
- Prompt tests prove intent and no-invented-reason instructions are present.
- Fallback tests prove each terminal intent returns a natural, question-free response.
- Extension tests prove the selected intent reaches the localhost payload.
- Anonymized model QA covers recruiter rejection, candidate decline, continued communication, and closing.

## Stop Condition

Complete when automatic recognition is conservative, manual intent selection works, terminal replies do not ask new questions or invent reasons, and all existing safety and no-send tests remain green.
