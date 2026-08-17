# Extension API Key Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users configure and persist their DeepSeek API Key from a browser-extension popup while keeping the key out of extension storage, BOSS page content, source files, logs, and backend responses.

**Architecture:** The popup sends the key only to the local FastAPI backend over an explicit save action. The backend stores it in Windows Credential Manager through a small native API wrapper and reads it only when creating a DeepSeek request. The content script continues to send cleaned transcript records without any key.

**Tech Stack:** Chrome Manifest V3, plain JavaScript/CSS, FastAPI, Python 3.8-compatible `ctypes` Windows Credential API, Node `node:test`, Python `unittest`.

---

### Task 1: Lock down the credential-store contract

**Files:**
- Create: `backend/app/credential_store.py`
- Create: `backend/tests/test_credential_store.py`

- [x] **Step 1: Write failing tests for an injected credential store contract**

Test `set`, `get`, and `clear` against an in-memory fake implementation used by the backend tests. Also test that blank values are rejected by the boundary helper without storing them.

- [x] **Step 2: Run the focused test and verify it fails for the missing module/contract**

Run:

```powershell
& 'backend\.venv\Scripts\python.exe' -m unittest backend.tests.test_credential_store
```

Expected: failure because the credential-store module and contract do not yet exist.

- [x] **Step 3: Implement the Windows Credential Manager adapter**

Use `ctypes.WinDLL("advapi32")` with `CredWriteW`, `CredReadW`, `CredDeleteW`, and `CredFree`. Store UTF-8 bytes as a generic credential with machine persistence. Do not write a file or print the value. Keep a small interface with `get() -> str`, `set(value: str) -> None`, and `clear() -> None`; tests must be able to replace the store without invoking the OS API.

- [x] **Step 4: Run the focused test and verify it passes**

Run the same command and expect all credential contract tests to pass without creating a real credential.

### Task 2: Add backend key settings endpoints

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/tests/test_main.py`

- [x] **Step 1: Write failing tests for status, save, clear, and key-free responses**

Replace `main.credential_store` with a fake in each test. Assert that status returns only `configured`, save accepts the custom header value, clear removes it, blank headers are rejected, and neither success nor error responses contain the test key.

- [x] **Step 2: Run the focused backend tests and verify the new tests fail**

Run:

```powershell
& 'backend\.venv\Scripts\python.exe' -m unittest backend.tests.test_main
```

Expected: failure because the settings routes and store integration are missing.

- [x] **Step 3: Implement the three local settings endpoints**

Add `GET /api/settings/deepseek-key/status`, `PUT /api/settings/deepseek-key`, and `DELETE /api/settings/deepseek-key`. Accept only `X-DeepSeek-API-Key`, trim it, reject empty input, return configured status only, and make delete idempotent. Resolve the stored key before the existing environment fallback when constructing `DeepSeekClient`.

- [x] **Step 4: Update CORS for the explicit save header and run backend tests**

Add `X-DeepSeek-API-Key` to `allow_headers`, then run:

```powershell
& 'backend\.venv\Scripts\python.exe' -m unittest discover -s 'backend\tests'
```

Expected: all backend tests pass.

### Task 3: Add the extension settings client and popup

**Files:**
- Modify: `extension/manifest.json`
- Create: `extension/src/settingsClient.js`
- Create: `extension/popup.html`
- Create: `extension/popup.js`
- Create: `extension/popup.css`
- Create: `extension/tests/settingsClient.test.js`

- [x] **Step 1: Write failing Node tests for localhost-only settings requests**

Test that the client accepts only `http://127.0.0.1:8765` or `http://localhost:8765`, sends the key only in `X-DeepSeek-API-Key`, does not put it in a JSON body, returns configured status, and turns backend failures into generic errors.

- [x] **Step 2: Run the focused Node tests and verify they fail**

Run:

```powershell
npm.cmd test -- extension/tests/settingsClient.test.js
```

Expected: failure because the settings client does not exist.

- [x] **Step 3: Implement the pure settings client**

Keep endpoint validation and fetch behavior independent of the popup DOM. Use `credentials: "omit"`, no console logging, no local storage, and no key in response parsing. Clear the input in the popup after each save attempt.

- [x] **Step 4: Implement the MV3 popup and manifest wiring**

Set `action.default_popup` to `popup.html`; do not add `storage` permission because the key is not stored by the extension. Add a password input, save, clear, configured status, backend-unavailable state, and external CSS/JS only. The popup must not render the key after save.

- [x] **Step 5: Run frontend tests and syntax checks**

Run:

```powershell
npm.cmd test
npm.cmd run check
```

Expected: all Node tests pass and all extension JavaScript parses successfully.

### Task 4: Update docs and perform security/static verification

**Files:**
- Modify: `README.md`
- Create: `docs/validation/2026-08-16-extension-api-key-settings-validation.md`
- Create: `docs/task-lists/2026-08-16-v0.7-live-popup-key-qa.md`

- [x] **Step 1: Document the popup setup and Windows Credential Manager boundary**

Replace the primary environment-variable setup instructions with the popup flow. Keep the environment variable documented only as a development fallback and explicitly state that it must never be committed.

- [x] **Step 2: Run static security scans**

Search extension and backend source for `chrome.storage`, `localStorage`, API-key literals, input selectors, `.click()`, `.submit()`, cookie access, and transcript fields containing the key. Expected: no new unsafe matches; settings client header usage is the only intentional key path.

- [x] **Step 3: Run the full test and compile checks**

Run:

```powershell
npm.cmd test
npm.cmd run check
& 'backend\.venv\Scripts\python.exe' -m unittest discover -s 'backend\tests'
& 'backend\.venv\Scripts\python.exe' -m compileall -q backend\app
```

- [ ] **Step 4: Manually validate in Chrome**

Reload the unpacked extension, open the toolbar popup, save a test key without sharing it, close and reopen Chrome, verify only configured status is shown, clear the key, and run the existing manual draft flow. Inspect the BOSS page DOM and backend responses to confirm the key is absent.

- [x] **Step 5: Record results and create the next task list**

Write the validation report and use `docs/task-lists/2026-08-16-v0.7-live-popup-key-qa.md` as the next handoff. Do not publish until popup persistence and live draft generation pass.

## Stop Condition

Stop and report a scoped blocker if the Windows Credential Manager API cannot be initialized, the popup cannot reach localhost, or any test/manual check shows the key entering page content, transcript payloads, logs, or responses.
