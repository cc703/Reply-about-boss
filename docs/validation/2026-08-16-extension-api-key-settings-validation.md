# Extension API Key Settings Validation

## Scope

This validation covers the persistent API Key configuration path:

```text
extension popup -> localhost backend -> Windows Credential Manager -> DeepSeek client
```

The key must not be persisted by the extension, included in BOSS transcript records, returned by the backend, or printed in logs.

## Automated Tests

Commands:

```powershell
npm.cmd test
npm.cmd run check
& 'backend\.venv\Scripts\python.exe' -m unittest discover -s 'backend\tests'
& 'backend\.venv\Scripts\python.exe' -m compileall -q backend\app
```

Results:

- Node tests: `31` passed, `0` failed.
- JavaScript syntax checks: passed.
- Python tests: `16` passed, `0` failed.
- Python compile check: passed.

## Credential Store Smoke Test

Used a temporary non-secret validation target, not the production credential target:

- Wrote a validation-only value through the Windows Credential API.
- Read it through a newly created store instance.
- Cleared it.
- Read it again and confirmed an empty result.

Result: `windows credential persistence smoke: ok`.

No user API Key was read, printed, overwritten, or inspected.

## Backend Smoke Test

Started an isolated backend process on port `8766` and requested:

```text
GET /api/settings/deepseek-key/status
```

Result:

```json
{"configured":false}
```

The response contained exactly one field and no credential value.

## Static Security Scan

Scanned extension source for:

- `chrome.storage`, `localStorage`, and `sessionStorage`;
- hard-coded API-key patterns;
- Cookie access;
- automatic `.click()`, `.submit()`, or `execCommand` behavior.

Result: no matches in extension source. The only intentional Key path is the `X-DeepSeek-API-Key` request header in `settingsClient.js`; the header is sent only to localhost.

## Popup Render Check

Used an isolated temporary Chrome profile and a `file://` render of `extension/popup.html` because the Browser plugin was unavailable in this Codex surface.

Verified visually:

- `DeepSeek 设置` title renders.
- Status text renders.
- Password input renders.
- Save and clear buttons render without clipping.
- Popup fits a 360px viewport.

The `file://` page cannot represent a real `chrome-extension://` origin, so its fetch status was not counted as live extension integration evidence.

## Not Yet Verified

- Live Chrome extension popup save action with a real user-provided Key.
- Persistence after closing and reopening the actual browser.
- Live BOSS draft generation after the popup-configured Key is used.
- Manual confirmation that the BOSS page DOM never contains the Key.

These checks are the next task and must be completed before publishing.
