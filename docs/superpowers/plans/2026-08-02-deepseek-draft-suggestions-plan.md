# DeepSeek Draft Suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add v0.4 manual DeepSeek reply draft suggestions through a local backend without auto-fill, auto-send, or chat persistence.

**Architecture:** Keep transcript extraction in the content script, add a local-only draft client in the extension, and add a FastAPI backend that owns DeepSeek requests. The backend prompt builder and DeepSeek response parser are pure functions with tests.

**Tech Stack:** Chrome Manifest V3, plain JavaScript content scripts, Node built-in `node:test`, Python 3.13, FastAPI, Uvicorn, Python `unittest`.

---

## Task 1: Backend Pure Tests

**Files:**
- Create: `backend/tests/test_prompt_builder.py`
- Create: `backend/tests/test_deepseek_client.py`

- [ ] Write failing tests for transcript sanitization, prompt creation, empty context rejection, JSON draft parsing, fallback parsing, and missing API key handling.
- [ ] Run backend tests and verify they fail because backend modules do not exist.

Run:

```powershell
python -m unittest discover -s backend/tests
```

Expected: import failures for backend modules.

## Task 2: Backend Pure Modules

**Files:**
- Create: `backend/app/prompt_builder.py`
- Create: `backend/app/deepseek_client.py`
- Create: `backend/app/__init__.py`
- Create: `backend/tests/__init__.py`

- [ ] Implement prompt and transcript sanitization.
- [ ] Implement DeepSeek client with environment API key lookup.
- [ ] Implement response parsing without persisting requests or responses.
- [ ] Rerun backend tests and verify they pass.

## Task 3: FastAPI App

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/README.md`

- [ ] Add `GET /health`.
- [ ] Add `POST /api/reply-drafts`.
- [ ] Add explicit CORS for BOSS domains, `chrome-extension://*` via regex if needed, and localhost development origins.
- [ ] Add clear local run instructions.
- [ ] Run Python syntax checks.

Run:

```powershell
python -m py_compile backend/app/*.py
```

Expected: exit 0.

## Task 4: Extension Draft Client Tests

**Files:**
- Create: `extension/src/replyDraftClient.js`
- Create: `extension/tests/replyDraftClient.test.js`

- [ ] Write failing tests for payload shaping, localhost URL enforcement, success parsing, and error handling.
- [ ] Run `npm.cmd test` and verify RED.
- [ ] Implement `replyDraftClient.js`.
- [ ] Run `npm.cmd test` and verify GREEN.

## Task 5: Panel And Content Integration

**Files:**
- Modify: `extension/src/panel.js`
- Modify: `extension/src/content.js`
- Modify: `extension/styles/panel.css`
- Modify: `extension/manifest.json`
- Modify: `package.json`

- [ ] Add `src/replyDraftClient.js` to manifest before `content.js`.
- [ ] Add localhost host permissions for `http://127.0.0.1:8765/*` and `http://localhost:8765/*`.
- [ ] Add a manual `生成回复草稿` button and suggestion state rendering.
- [ ] Wire click handler in content script.
- [ ] Ensure no input fill, send, click, or textarea selector is added.
- [ ] Update `npm.cmd run check` to include the new file.

## Task 6: Validation And Handoff

**Files:**
- Create: `docs/validation/2026-08-02-v0.4-deepseek-draft-suggestions-validation.md`
- Create: `docs/task-lists/2026-08-02-v0.5-manual-copy-draft.md`
- Modify: `docs/task-lists/README.md`

- [ ] Run frontend tests and syntax checks.
- [ ] Run backend tests and syntax checks.
- [ ] Run manifest check.
- [ ] Run forbidden behavior scan for input fill/send/cookie/platform automation.
- [ ] Run secret scan for `sk-`, non-empty DeepSeek API key assignments, and `.env` files.
- [ ] Run Chrome fixture smoke for button rendering and no-backend error if practical.
- [ ] Write validation report.
- [ ] Create v0.5 task list.

## Self Review

- This plan maps to the v0.4 spec.
- It requires a manual click before sending cleaned transcript to localhost.
- It does not introduce auto-fill, auto-send, storage, scraping, cookies, or platform bypass.
- It does not require a real DeepSeek API key for automated tests.
