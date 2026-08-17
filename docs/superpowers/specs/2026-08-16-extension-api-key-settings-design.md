# Extension API Key Settings Design

## Context

The extension currently asks the local FastAPI backend to generate reply drafts, while the backend reads `DEEPSEEK_API_KEY` from the process environment. The user needs to configure the key from a small browser-extension popup and keep it available after browser restarts without exposing it to the BOSS page, content-script UI, source files, logs, chat records, or GitHub.

## Decision

Use a popup-to-local-backend configuration flow backed by the Windows Credential Manager:

```text
popup.html password input
    -> PUT 127.0.0.1:8765/api/settings/deepseek-key
    -> Windows Credential Manager
    -> backend reads the credential for DeepSeek requests
```

The extension will not persist the API key in `chrome.storage.local`, `localStorage`, or the page DOM. The popup will keep the value only in the password input and request memory long enough to save it, then clear the input. The backend will expose only a boolean configured status and will never return the key.

## Components

### Extension popup

- `popup.html` provides a password input, save button, clear button, and status text.
- `popup.js` loads only configured/unconfigured state, sends the key to localhost through an `X-DeepSeek-API-Key` header, and clears the input after every save attempt.
- `popup.css` keeps the popup compact and readable.
- No background worker is needed because the content script never needs the key and the backend owns the DeepSeek call.

### Local backend

- `credential_store.py` wraps Windows Credential Manager using the Windows Credential API and stores one generic credential for this application.
- `main.py` exposes status, save, and clear endpoints. Responses contain only status or generic errors.
- Reply generation resolves the saved credential first and retains the environment variable only as a development/test fallback.
- CORS allows the extension settings requests to use the custom header; the API key is never returned in a response.

## Endpoints

| Method | Path | Input | Output |
| --- | --- | --- | --- |
| `GET` | `/api/settings/deepseek-key/status` | none | `{"configured": true/false}` |
| `PUT` | `/api/settings/deepseek-key` | `X-DeepSeek-API-Key` header | `{"configured": true}` |
| `DELETE` | `/api/settings/deepseek-key` | none | `{"configured": false}` |

The save endpoint rejects missing or blank values and never echoes request headers. The clear endpoint is idempotent.

## Security Boundaries

- The key is persisted only by the operating system credential store.
- The key is not placed in extension storage, source code, manifest metadata, page DOM, transcript records, clipboard content, logs, screenshots, or error messages.
- The extension sends the key only to `http://127.0.0.1:8765` during explicit save.
- BOSS chat requests contain transcript records but no API key.
- The backend uses generic error messages and does not include the key in exception text.
- This is local-user protection, not a hardware security module: a fully compromised local user account or a modified extension/backend could still access the credential when generating a request.

## Alternatives Rejected

- `chrome.storage.local`: convenient and persistent, but it leaves the bearer credential in extension-readable storage and does not meet the requested protection boundary.
- Session-only memory: stronger persistence boundary, but conflicts with the requirement to survive browser restarts.
- Custom encrypted file: avoids an extra package but duplicates OS credential storage behavior and creates a larger cryptographic maintenance surface.

## Testing

- Backend tests use an injected fake credential store and never write a real credential.
- Tests verify save/status/clear behavior, blank-key rejection, and that status responses never contain the key.
- Frontend tests verify localhost-only endpoints, header-based save, input cleanup behavior, and absence of `chrome.storage` usage.
- Static scans verify no API-key literals, local-storage writes, transcript inclusion, or automatic send/input behavior were added.
- Manual Chrome validation verifies popup persistence after browser restart, successful status reporting, draft generation, and a clean BOSS page with no key in its DOM.
