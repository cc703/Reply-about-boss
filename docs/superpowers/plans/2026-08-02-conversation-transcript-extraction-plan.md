# Conversation Transcript Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build v0.3 transcript extraction so the extension lists all visible current-chat records and no longer treats controls such as `发简历` as HR messages.

**Architecture:** Add a pure `conversationExtractor.js` module that turns a DOM snapshot into ordered records with `role`, `sourceType`, `confidence`, and debug metadata. Keep `messageExtractor.js` compatible by deriving the latest HR message from the transcript. Update `content.js` and `panel.js` to render transcript state while preserving local-only behavior.

**Tech Stack:** Chrome Manifest V3 content scripts, plain JavaScript IIFE modules, Node built-in `node:test`, static HTML fixtures.

---

## File Structure

- `extension/src/conversationExtractor.js`: owns DOM-to-transcript extraction and role/source classification.
- `extension/src/messageExtractor.js`: keeps the old latest-HR API and delegates to transcript records when available.
- `extension/src/content.js`: calls transcript extraction and passes the result into panel rendering.
- `extension/src/panel.js`: renders status, conversation record list, and debug counts.
- `extension/styles/panel.css`: styles compact transcript rows and role chips.
- `extension/manifest.json`: loads `conversationExtractor.js` before `messageExtractor.js`.
- `extension/test-fixtures/boss-chat-transcript-sample.html`: anonymized page fixture with HR, self, system, cards, and controls.
- `extension/tests/conversationExtractor.test.js`: TDD coverage for transcript behavior.
- `extension/tests/messageExtractor.test.js`: compatibility coverage for old latest-HR behavior.
- `docs/validation/2026-08-02-v0.3-conversation-transcript-validation.md`: verification evidence.
- `docs/task-lists/2026-08-02-v0.4-deepseek-draft-suggestions.md`: next-step handoff.

## Task 1: Transcript Extractor Tests

**Files:**
- Create: `extension/tests/conversationExtractor.test.js`
- Create: `extension/test-fixtures/boss-chat-transcript-sample.html`

- [ ] **Step 1: Write failing tests for the new extractor API**

Expected API:

```js
const extractor = require("../src/conversationExtractor.js");
const result = extractor.extractConversationTranscript(document);
assert.equal(result.status, extractor.STATUS.FOUND);
assert.deepEqual(result.records.map((record) => record.role), ["system", "hr", "self", "hr"]);
```

Required test behaviors:

- `extracts ordered hr and self message records from a fixture`
- `classifies resume actions as controls outside conversation context`
- `classifies time separators and read receipts as system records`
- `ignores extension panel text`
- `collapses duplicate ancestor and descendant text`
- `keeps weak conversational text unknown instead of HR when signals conflict`

- [ ] **Step 2: Run tests and verify RED**

Run:

```powershell
npm.cmd test
```

Expected: fail because `extension/src/conversationExtractor.js` does not exist.

## Task 2: Pure Transcript Extractor

**Files:**
- Create: `extension/src/conversationExtractor.js`

- [ ] **Step 1: Implement minimal extractor to satisfy tests**

Required exports:

```js
{
  STATUS,
  normalizeText,
  collectCandidatesFromDom,
  classifyCandidate,
  extractConversationTranscript
}
```

Record shape:

```js
{
  id: "record-1",
  role: "hr",
  sourceType: "message",
  text: "你好，看了你的简历，方便聊聊吗",
  confidence: "high",
  order: 1,
  debug: {
    score: 8,
    reasons: ["left-side", "message-class-signal"]
  }
}
```

Classification policy:

- Exact action labels such as `发简历`, `查看职位`, `查看详细分析`, `发送简历`, `立即沟通`, and `交换微信` classify as `control`.
- Button/action/menu/resume/card ancestors classify as `control` unless the element is a clear chat bubble.
- Time separators classify as `system` with `sourceType: "time"`.
- Read receipts classify as `system` with `sourceType: "receipt"`.
- Right-side or self-class message bubbles classify as `self`.
- Left-side or recruiter-class message bubbles classify as `hr`.
- Weak low-signal text classifies as `unknown`.

- [ ] **Step 2: Run tests and verify GREEN**

Run:

```powershell
npm.cmd test
```

Expected: all extractor tests pass or remaining failures point to compatibility work in Task 3.

## Task 3: Latest-HR Compatibility

**Files:**
- Modify: `extension/src/messageExtractor.js`
- Modify: `extension/tests/messageExtractor.test.js`

- [ ] **Step 1: Add compatibility tests**

Add a test proving `extractLatestHrMessage(document)` returns the latest transcript `hr` record from the transcript fixture and ignores `control` records such as `发简历`.

- [ ] **Step 2: Implement wrapper behavior**

Keep existing candidate-based exports. Add a DOM path that uses `BossChatListener.conversationExtractor.extractConversationTranscript(root)` when available, then selects the newest high-confidence `hr` message.

- [ ] **Step 3: Run compatibility tests**

Run:

```powershell
npm.cmd test
```

Expected: existing latest-HR tests and new transcript compatibility test pass.

## Task 4: Panel Transcript UI

**Files:**
- Modify: `extension/src/content.js`
- Modify: `extension/src/panel.js`
- Modify: `extension/styles/panel.css`
- Modify: `extension/manifest.json`
- Modify: `package.json`

- [ ] **Step 1: Update script load order**

Manifest load order:

```json
[
  "src/conversationExtractor.js",
  "src/messageExtractor.js",
  "src/panel.js",
  "src/content.js"
]
```

- [ ] **Step 2: Update panel rendering**

Panel should show subtitle `识别当前会话记录`, label `当前会话记录`, transcript rows, and debug counts for candidates, records, controls, and unknowns.

- [ ] **Step 3: Update content script**

Content script should call `conversationExtractor.extractConversationTranscript(document)` when available, falling back to old latest-HR extraction only if needed.

- [ ] **Step 4: Update check script**

`package.json` check should include `node --check extension/src/conversationExtractor.js`.

## Task 5: Verification And Handoff

**Files:**
- Create: `docs/validation/2026-08-02-v0.3-conversation-transcript-validation.md`
- Create: `docs/task-lists/2026-08-02-v0.4-deepseek-draft-suggestions.md`
- Modify: `docs/task-lists/README.md`

- [ ] **Step 1: Run automated verification**

Run:

```powershell
npm.cmd test
npm.cmd run check
Select-String -Path extension\src\*.js -Pattern 'fetch|XMLHttpRequest|chrome.storage|localStorage|sendMessage|runtime.connect|querySelector\(\"textarea|querySelector\(''textarea'
```

Expected:

- Tests pass.
- Syntax checks pass.
- Forbidden behavior search finds no source behavior for network calls, storage, messaging, or input fill.

- [ ] **Step 2: Run fixture/browser smoke where practical**

Use Playwright or a local browser fixture check to verify the panel renders transcript rows from `boss-chat-transcript-sample.html`.

- [ ] **Step 3: Write validation report and v0.4 task list**

Validation report must state what was verified, what remains untested on live BOSS, and that DeepSeek is still deferred.

## Self Review

- Every v0.3 design requirement maps to a task.
- No backend, DeepSeek call, storage, fill-input, copy-to-input, or send behavior is included.
- The old latest-HR API remains available for compatibility.
- This workspace is not a git repository, so commit steps are intentionally replaced by local verification evidence.
