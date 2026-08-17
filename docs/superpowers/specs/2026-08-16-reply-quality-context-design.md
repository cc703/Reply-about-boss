# Reply Quality Context Design

## Context

The live draft flow now works end to end, but the first successful output exposed two quality risks:

- the model invented a reason for a delayed response, such as being busy or not seeing the message;
- the model asked about information without first checking whether the conversation had already supplied it.

The current extension and backend also keep the first 12 valid records rather than the most recent 12, so long conversations can omit the latest recruiter question.

## Decision

Use deterministic context shaping before the existing single DeepSeek request:

```text
visible transcript
    -> keep HR/self records only
    -> retain the most recent 12 records
    -> identify the latest HR message
    -> mark whether the candidate already replied after it
    -> build an explicit reply-focus prompt
    -> request 1-3 drafts
    -> reject ungrounded excuse/claim phrases
    -> retry once only when every draft is empty or rejected
    -> use a labeled local safe fallback for a known recruiter intent when the retry also fails
```

The normal path still uses one request. A second request is allowed only when the first result is empty or contains unsupported claims, which prioritizes safe output without making every click slower or more expensive.

## Reply Focus Contract

The backend prompt must contain:

- the ordered recent HR/self transcript;
- the exact latest HR message as the primary reply target;
- whether that HR message is still awaiting a candidate reply;
- an instruction to answer the latest HR intent before asking a follow-up question;
- an instruction not to repeat questions whose answer already appears in the transcript;
- an instruction not to invent reasons for delayed replies, availability, experience, salary, projects, or personal circumstances;
- an instruction to use neutral wording when a fact is unknown.

If the candidate has already replied after the latest HR message, generated text must be framed as an optional follow-up rather than repeating the prior answer.

## Components

### Extension payload shaping

`replyDraftClient.js` continues to transmit only cleaned `hr/self` records, but it retains the newest records when the conversation exceeds the limit. It does not add page metadata, keys, cookies, or persistent history.

### Backend context analysis

`prompt_builder.py` owns pure helpers for recent-record sanitization and reply-focus analysis. It returns a small dictionary containing `latest_hr_message` and `candidate_replied_after_latest_hr`, then builds the model messages from that result.

### DeepSeek request

The first request remains unchanged. A deterministic local guard removes drafts containing unsupported delayed-response excuses, technical experience, interest, availability, or certainty claims unless those facts already appear in candidate-authored context. If no draft survives, the backend retries once with a correction instruction. A second unsafe or empty result uses a visibly labeled `安全兜底` template for general greeting, technical question, recruiter follow-up, job details, or interview scheduling. Unknown intents still become a controlled error instead of displaying untrusted text.

## Alternatives Rejected

- Prompt text changes only: smallest diff, but it would not fix the oldest-record truncation and would leave latest-message selection implicit.
- An unconditional second DeepSeek validation call: doubles latency and cost on every click. The chosen bounded retry runs only after empty or rejected output.
- Rule-based rewriting of generated drafts: risks changing valid user-specific wording and creates brittle language filters.

## Testing

- Extension tests prove payloads retain the newest 12 valid records.
- Backend tests prove recent-record retention, latest-HR selection, replied/unreplied state, and required anti-invention instructions.
- Guard tests prove unsupported excuses are rejected, candidate-provided facts remain allowed, and retry is capped at one extra request.
- Parser tests prove nested JSON strings and Markdown JSON fences are decoded as structured drafts rather than displayed as raw JSON.
- Fallback tests prove the five common intent templates avoid capability, interest, concern, and availability commitments.
- Existing tests continue to prove only HR/self text reaches the backend and no automatic communication behavior exists.
- Live verification checks that generated drafts address the latest HR message without inventing a delayed-response excuse.

## Stop Condition

This iteration is complete when automated tests pass and the prompt deterministically exposes the latest reply target and anti-invention rules. It does not claim that a language model can never produce an unsuitable draft; human review remains mandatory.
