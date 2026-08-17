# Natural Job-Seeker Tone Design

## Goal

Reply drafts should sound like a real candidate chatting with a recruiter on BOSS, not like a formal email, customer-service script, or corporate statement.

The extension also provides selectable tone preferences:

- `自然` (default)
- `简洁直接`
- `稳妥留余地`
- `积极一些`
- `自定义`

Tone changes wording only. It never permits invented experience, interest, availability, salary, projects, or reasons for a delayed reply.

## Chosen Approach

Use a combined backend and extension change:

1. Strengthen the backend prompt with a natural-chat style contract and practical job-seeking question categories.
2. Rewrite deterministic safe fallbacks in conversational Chinese.
3. Add a compact tone selector to the in-page panel.
4. Reveal a short custom-tone input only when `自定义` is selected.
5. Read the current selection only when the user manually clicks `生成回复草稿`.

The custom value is not persisted. The extension continues to transmit only cleaned `hr/self` records plus the selected tone preference to the local backend.

## Alternatives Considered

### Prompt-only tone change

Smallest implementation, but local fallbacks would remain overly formal and there would be no user control.

### Frontend-only tone labels

Would create a visible control without a reliable semantic contract in the backend. Rejected because labels must change generation behavior, not just presentation.

### Combined prompt, fallback, and selector

Chosen because both model output and deterministic fallback need the same product voice, while the user retains manual control.

## Style Contract

Every draft should:

- use conversational Chinese suitable for BOSS chat;
- contain 1-3 short sentences;
- answer the latest recruiter intent first;
- ask at most one useful question;
- prefer practical candidate concerns such as actual work, intern expectations, technology used, mentoring, attendance, interview format, or duration;
- avoid repeating information already stated in the transcript;
- avoid formal phrases such as `感谢您的联系`, `感谢您的询问`, `结合实际情况如实说明`, `进一步判断`, `贵公司`, and `贵岗位`;
- leave room for the candidate to verify unknown facts before committing.

## Tone Semantics

- `自然`: relaxed, polite, and closest to ordinary candidate chat.
- `简洁直接`: shorter sentences and a direct practical question.
- `稳妥留余地`: explicitly keeps uncertain capability or schedule uncommitted.
- `积极一些`: warmer and more responsive, but cannot invent interest or availability.
- `自定义`: uses the user's short style description only as a wording preference.

Custom tone text cannot override system safety rules. Newlines are normalized, length is capped, and the prompt states that custom instructions affect style only.

## Interaction

The tone control sits above the generate button in the existing reply-draft section. The custom input is hidden for preset tones and shown for `自定义`. Empty custom input falls back to `自然` instead of blocking generation.

There is no auto-fill or auto-send. Generated drafts remain reviewable and manually copyable.

## Verification

- Unit tests prove preset and custom tone values are included in the local request payload.
- Content-script tests prove the current panel preference is read on every manual generation click.
- Prompt tests prove the style-only safety boundary and natural-language constraints are present.
- Fallback tests cover five recruiter intents and reject formal stock phrases.
- Full extension and backend suites remain green.
- Five anonymized model scenarios are sampled for naturalness and factual grounding.

## Stop Condition

The iteration is complete when the tone selector works, custom tone reaches the backend without persistence, natural fallbacks pass tests, model samples no longer default to formal customer-service wording, and no automatic communication behavior is introduced.
