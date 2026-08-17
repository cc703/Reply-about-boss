# Reply Quality Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make generated replies focus on the latest recruiter message, preserve recent conversation context, and avoid unsupported excuses or repeated questions.

**Architecture:** The extension and backend both retain the newest valid HR/self records. The backend derives a pure reply-focus summary, inserts it into a stricter prompt, and filters unsupported claims from model output. Empty or fully rejected output receives one bounded retry, then a labeled local fallback for five known intents; human review, manual copying, local credential storage, and the no-auto-send boundary remain unchanged.

**Tech Stack:** Chrome Manifest V3, plain JavaScript, FastAPI, Python 3.8-compatible helpers, Node `node:test`, Python `unittest`.

---

### Task 1: Retain recent extension payload records

**Files:**
- Modify: `extension/tests/replyDraftClient.test.js`
- Modify: `extension/src/replyDraftClient.js`

- [ ] **Step 1: Write a failing test for newest-record retention**

Create more than 12 valid alternating HR/self records and assert that the payload contains exactly records 4 through 15 in original order.

- [ ] **Step 2: Run the focused test and verify the old behavior fails**

Run:

```powershell
node --test extension\tests\replyDraftClient.test.js
```

Expected: the payload starts with record 0 instead of the newest retained record.

- [ ] **Step 3: Implement minimal recent-record retention**

Clean all valid records first, then return `cleaned.slice(-MAX_RECORDS)` without changing role or text limits.

- [ ] **Step 4: Re-run the focused test**

Expected: all reply-draft client tests pass.

### Task 2: Derive explicit reply focus

**Files:**
- Modify: `backend/tests/test_prompt_builder.py`
- Modify: `backend/app/prompt_builder.py`

- [ ] **Step 1: Write failing tests for recent context and latest-HR state**

Test that sanitization retains the newest records, `analyze_reply_focus` selects the final HR text, and the state is `waiting_for_candidate` only when no later self record exists.

- [ ] **Step 2: Run the focused backend test and verify failure**

Run:

```powershell
backend\.venv\Scripts\python.exe -m unittest backend.tests.test_prompt_builder -v
```

Expected: failures for oldest-record retention and the missing `analyze_reply_focus` helper.

- [ ] **Step 3: Implement the pure context helper**

Add `analyze_reply_focus(records)` returning:

```python
{
    "latest_hr_message": "...",
    "candidate_replied_after_latest_hr": False,
    "status": "waiting_for_candidate",
}
```

Use `candidate_already_replied` when a self record follows the latest HR record.

- [ ] **Step 4: Re-run focused tests**

Expected: all prompt-builder tests pass.

### Task 3: Strengthen the single-request prompt

**Files:**
- Modify: `backend/tests/test_prompt_builder.py`
- Modify: `backend/app/prompt_builder.py`

- [ ] **Step 1: Write failing assertions for required prompt guidance**

Assert that the user prompt includes the exact latest HR message, the reply state, and rules equivalent to “do not invent delayed-response reasons” and “do not repeat questions already answered in the transcript.”

- [ ] **Step 2: Run the focused tests and verify the guidance is absent**

Run the same focused backend command and expect the new assertions to fail.

- [ ] **Step 3: Add explicit focus and factuality instructions**

Build the prompt with separate sections for latest reply target, current round state, recent transcript, and output rules. Require neutral wording for unknown facts and optional-follow-up wording when the candidate already replied.

- [ ] **Step 4: Re-run focused tests**

Expected: all prompt-builder tests pass.

### Task 4: Guard model output, retry once, and provide a safe fallback

**Files:**
- Create: `backend/app/draft_guard.py`
- Create: `backend/tests/test_draft_guard.py`
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_main.py`

- [ ] **Step 1: Write failing guard tests**

Assert that ungrounded delayed-response, concern, technical-experience, interest, and availability claims are removed, while the same fact is allowed when it appears in a candidate-authored record.

- [ ] **Step 2: Write a failing route test for bounded retry**

Inject a fake DeepSeek client whose first response is unsafe and second response is grounded. Assert that the route calls it twice and returns only the safe draft. Add a second test proving two unsafe responses use a labeled local fallback without a third model call.

- [ ] **Step 3: Implement the pure guard and bounded retry**

Keep the guard independent from HTTP and credentials. In `create_reply_drafts`, run at most two model calls, append a correction instruction only for the retry, and use a deterministic `安全兜底` draft for five recognized recruiter intents if no model draft survives.

- [ ] **Step 4: Run focused guard and route tests**

```powershell
backend\.venv\Scripts\python.exe -m unittest backend.tests.test_draft_guard backend.tests.test_main -v
```

Expected: all guard and route tests pass with no real network or credential access.

### Task 5: Verify and document the iteration

**Files:**
- Create: `docs/validation/2026-08-16-reply-quality-context-validation.md`
- Create: `docs/task-lists/2026-08-16-v0.9-live-reply-quality-qa.md`
- Modify: `docs/task-lists/README.md`

- [ ] **Step 1: Run all automated checks**

```powershell
npm.cmd test
npm.cmd run check
backend\.venv\Scripts\python.exe -m unittest discover -s backend\tests -v
backend\.venv\Scripts\python.exe -m compileall -q backend\app backend\tests
```

Expected: all commands exit successfully with no test failures.

- [ ] **Step 2: Restart and smoke-test the local backend**

Verify `/health`, configured status, and a controlled draft request on `127.0.0.1:8765`. Do not print or relocate the saved API key.

- [ ] **Step 3: Record evidence and create the next handoff**

Document automated evidence, the remaining live-model uncertainty, required skills/tools, exact browser checks, and the next stop condition.

## Stop Condition

Stop when recent-record retention, reply-focus guidance, output filtering, nested JSON parsing, one bounded retry, and labeled safe fallbacks are covered by tests; all automated checks pass; and the latest backend process serves the updated code. Keep auto-fill, auto-send, unconditional extra model calls, resume ingestion, and persistent chat storage out of scope.
