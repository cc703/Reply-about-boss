# Manual Copy Draft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual copy button for each generated reply draft without filling or sending BOSS messages.

**Architecture:** Keep clipboard behavior in `replyDraftClient.js` as a testable helper. Render copy buttons in `panel.js`. Wire one delegated click handler in `content.js` that reads the visible draft text and calls the helper.

**Tech Stack:** Chrome Manifest V3, plain JavaScript content scripts, Node built-in `node:test`, Chrome headless fixture smoke.

---

## Task 1: Copy Helper Tests

**Files:**
- Modify: `extension/tests/replyDraftClient.test.js`

- [ ] Add failing tests for `copyDraftText`.
- [ ] Verify it writes normalized draft text with an injected clipboard implementation.
- [ ] Verify empty text is rejected.
- [ ] Verify missing Clipboard API is rejected.
- [ ] Run `npm.cmd test` and confirm RED.

## Task 2: Copy Helper Implementation

**Files:**
- Modify: `extension/src/replyDraftClient.js`

- [ ] Implement `copyDraftText(text, options)`.
- [ ] Use `navigator.clipboard.writeText` or injected test clipboard only.
- [ ] Do not add hidden textarea or `execCommand`.
- [ ] Run `npm.cmd test` and confirm GREEN.

## Task 3: Panel Copy UI

**Files:**
- Modify: `extension/src/panel.js`
- Modify: `extension/styles/panel.css`

- [ ] Add one `复制` button per draft item.
- [ ] Add `renderCopyState(panel, index, state)` for success/error feedback.
- [ ] Keep draft text visible.

## Task 4: Content Script Wiring

**Files:**
- Modify: `extension/src/content.js`

- [ ] Add delegated listener for `.bcl-copy-draft`.
- [ ] Read only the visible `.bcl-draft-text` content from the clicked draft item.
- [ ] Call `replyDraftClient.copyDraftText`.
- [ ] Update panel copy state.
- [ ] Do not query BOSS inputs or call page send actions.

## Task 5: Verification And Handoff

**Files:**
- Create: `docs/validation/2026-08-02-v0.5-manual-copy-draft-validation.md`
- Create: `docs/task-lists/2026-08-02-v0.6-live-deepseek-qa.md`
- Modify: `docs/task-lists/README.md`

- [ ] Run `npm.cmd test`.
- [ ] Run `npm.cmd run check`.
- [ ] Run backend tests if backend files changed.
- [ ] Run forbidden behavior scan.
- [ ] Run Chrome fixture smoke.
- [ ] Write validation report.
- [ ] Create the next task list.

## Self Review

- No BOSS input fill or auto-send behavior is planned.
- The copy behavior is manual.
- No new extension permission is planned unless live validation proves it necessary.
