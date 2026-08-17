# v0.3 Conversation Transcript And Reply Suggestion Design

## Context

The current extension detects only one latest recruiter-side message. Real BOSS chat pages also contain action controls, resume buttons, job cards, analysis cards, time separators, and system blocks. A single-message extractor can mistake controls such as `发简历` for a recruiter message.

The product should move from "latest HR sentence" to "visible conversation transcript" before adding AI reply suggestions.

## Approved Direction

Use a two-stage path:

1. v0.3: extract the current visible conversation transcript locally.
2. v0.4: use that transcript to generate a user-reviewed reply draft with DeepSeek through a local backend.

This keeps the browser extension reliable and keeps AI behind a later explicit gate.

## Alternatives Considered

### Approach A: Transcript-first foundation

Build a role-aware transcript extractor first. It classifies page text into `hr`, `self`, `system`, or `control`, then exposes only true conversation messages to the panel.

Trade-off: more work now, but it fixes the root problem and gives later DeepSeek prompts clean context.

Recommendation: use this approach.

### Approach B: Patch latest-message scoring only

Continue tuning the old extractor so it ignores more controls and buttons.

Trade-off: faster short term, but every new BOSS UI block can create another false positive. It does not provide enough context for high-quality reply suggestions.

### Approach C: Add DeepSeek immediately

Send the current detected text to DeepSeek and show a reply draft.

Trade-off: gives an AI-looking result quickly, but the input can be wrong. If `发简历` or a job card is treated as the latest HR message, the reply draft will be unreliable.

## v0.3 Scope

In scope:

- Detect the active visible chat stream on the current BOSS web page.
- Extract all visible conversation-like records from that stream.
- Classify each record as:
  - `hr`: recruiter-side message.
  - `self`: user-side message.
  - `system`: time separators, read receipts, and neutral notices.
  - `control`: buttons, action labels, menus, resume actions, job cards, PK cards, and other non-chat UI.
- Render a compact panel showing the cleaned conversation records.
- Mark uncertain records without pretending they are correct.
- Keep everything local in the page. No network calls and no persistent chat storage.

Out of scope:

- DeepSeek API calls.
- AI reply generation.
- Auto-fill, copy-to-input, or auto-send.
- Login automation, cookie handling, protocol interception, or background scraping.
- Storing raw chat history beyond short-lived in-page state.

## v0.4 Scope Preview

v0.4 can add a local backend and DeepSeek integration only after v0.3 transcript extraction is stable.

Expected v0.4 behavior:

- The extension sends the cleaned transcript to a local FastAPI service only after the user explicitly enables it.
- DeepSeek returns one or more reply drafts.
- The panel shows drafts for review.
- The user decides whether to copy or send anything.
- The extension never auto-sends.

## Architecture

Add a new pure extractor focused on transcript records:

```text
DOM snapshot
  -> active chat container detection
  -> visible text block collection
  -> element normalization and de-duplication
  -> role classification
  -> control/system filtering
  -> ordered transcript records
  -> panel render state
```

Recommended files for v0.3:

```text
extension/src/conversationExtractor.js
extension/tests/conversationExtractor.test.js
extension/test-fixtures/boss-chat-transcript-sample.html
```

The existing `messageExtractor.js` can either remain as a compatibility wrapper or call the new transcript extractor to select the latest high-confidence `hr` record.

## Transcript Record Shape

Use a stable plain object for each visible record:

```js
{
  id: "visible-order-12",
  role: "hr",
  text: "你好，看了你的简历，方便聊聊吗",
  confidence: "high",
  sourceType: "message",
  order: 12,
  debug: {
    score: 8,
    matchedSignals: ["left-side", "bubble", "avatar-nearby"]
  }
}
```

Allowed `role` values:

- `hr`
- `self`
- `system`
- `control`
- `unknown`

Allowed `sourceType` values:

- `message`
- `time`
- `receipt`
- `card`
- `action`
- `panel`
- `unknown`

Only `message` records with role `hr` or `self` should be treated as conversation context for future AI prompts.

## Classification Rules

Role and source classification should use multiple weak signals:

- Text is visible in the viewport.
- Element belongs to the active chat stream, not the extension panel.
- Element is inside a message-like bubble or row.
- Element is left-aligned or right-aligned.
- Ancestors include likely self-side or recruiter-side class names.
- Text length looks conversational.
- Text is not an exact action label such as `发简历`.
- Element is not a button, menu item, toolbar, footer action, card action, or resume control.
- Element is not a job card, PK analysis card, delivery card, or other structured platform card.

If signals conflict, classify as `unknown` or `control` instead of promoting to `hr`.

## Panel Design

Update the panel title/subtitle for v0.3:

- Title: `BOSS Chat Listener`
- Subtitle: `识别当前会话记录`

Panel sections:

- Status: `识别成功` / `识别不确定` / `未识别到聊天消息`
- Conversation list: recent cleaned records with role chips `HR` and `我`
- Debug line: total candidates, cleaned records, ignored controls
- Manual refresh button

Do not show AI draft buttons in v0.3.

## Testing Strategy

Unit tests should cover:

- Multiple HR and self messages in order.
- Latest self message does not erase earlier HR messages.
- Resume actions such as `发简历` become `control`.
- Time separators become `system`.
- Read receipts become `system`.
- Job cards and PK cards become `control`.
- Extension panel text is ignored.
- Duplicate ancestor/descendant text is collapsed.
- Low-confidence records stay `unknown` or uncertain.

Manual QA should cover:

- Load unpacked extension from `extension/`.
- Refresh a real BOSS chat page.
- Confirm the panel lists the visible conversation records.
- Confirm `发简历` is not listed as HR/self conversation.
- Confirm self-side messages are not marked as HR.

## Open Source Lessons Applied

- Keep the assistant embedded in the active page, as browser-extension job helpers do.
- Keep all risky actions manual and visible.
- Borrow the idea of review-before-send from AI job tools, but do not implement sending.
- Avoid protocol interception, batch outreach, automatic resume delivery, and anti-risk bypass behavior.

## Acceptance Criteria

v0.3 is complete only when:

- `npm.cmd test` passes.
- `npm.cmd run check` passes.
- A fixture proves transcript extraction for HR, self, system, and control records.
- The real or fixture page panel displays cleaned conversation records.
- `发简历` and similar action controls are not displayed as HR messages.
- No code sends chat content over the network.
- No code fills or sends messages.

## Self Review

- No placeholder requirements remain.
- DeepSeek is explicitly deferred to v0.4.
- The design preserves human-in-the-loop and never-auto-send rules.
- The implementation target is small enough for one next task.
- The current non-git workspace status is acknowledged; no commit is required in this environment.
