# v0.4 DeepSeek Draft Suggestions Design

## Context

v0.3 can identify the visible current BOSS conversation records and exclude controls such as `发简历`. v0.4 adds the next useful layer: reply draft suggestions.

This version must keep the product human-in-the-loop. It must not fill the BOSS input box or send messages.

## External Documentation Checked

Checked on 2026-08-02:

- DeepSeek official API docs:
  - OpenAI-compatible base URL: `https://api.deepseek.com`
  - Chat Completions endpoint: `POST /chat/completions`
  - Current models include `deepseek-v4-flash` and `deepseek-v4-pro`
- FastAPI official CORS docs:
  - Browser frontend calls to a different origin require `CORSMiddleware`.
  - Allowed origins should be explicit instead of wildcard when possible.

## Scope

In scope:

- Add a local FastAPI backend under `backend/`.
- Add a local-only DeepSeek client.
- Keep `DEEPSEEK_API_KEY` in the local environment.
- Add a manual panel button: `生成回复草稿`.
- On click, send only cleaned v0.3 transcript context to `http://127.0.0.1:8765/api/reply-drafts`.
- Return 1-3 user-reviewed draft suggestions.
- Show loading, success, empty-context, missing-backend, missing-key, and model-error states in the panel.
- Keep the generated text visible only as suggestions.

Out of scope:

- Automatic input fill.
- Automatic send.
- Copy-to-input or copy button.
- Persistent chat storage.
- Resume upload or parsing.
- Cookie/session handling.
- BOSS API/protocol interception.
- Background scraping or batch outreach.

## Architecture

```text
BOSS page
  -> content script extracts cleaned transcript records
  -> user clicks "生成回复草稿"
  -> extension sends compact context to local FastAPI
  -> FastAPI builds DeepSeek prompt
  -> DeepSeek returns JSON-style suggestions
  -> panel renders suggestions for manual review
```

The extension talks only to localhost. The backend is the only component that talks to DeepSeek.

## Backend API

### `GET /health`

Returns:

```json
{
  "ok": true,
  "service": "boss-chat-listener-backend"
}
```

### `POST /api/reply-drafts`

Request:

```json
{
  "records": [
    { "role": "hr", "text": "你好，看了你的简历，方便聊聊吗" },
    { "role": "self", "text": "可以的，想了解一下岗位要求" }
  ],
  "tone": "balanced"
}
```

Response:

```json
{
  "drafts": [
    {
      "tone": "稳妥",
      "text": "您好，可以的。我想进一步了解一下这个岗位的主要工作内容、技术栈和实习生的具体要求。"
    }
  ],
  "model": "deepseek-v4-flash"
}
```

## Privacy Boundary

- The extension must strip records to `{ role, text }` before request.
- Only `hr` and `self` records are sent.
- System records, controls, unknowns, debug reasons, classes, IDs, DOM paths, URLs, cookies, resume files, and screenshots are not sent.
- No request is sent until the user clicks the manual button.
- The backend does not persist the request or response.

## Prompt Policy

The backend prompt should instruct the model to:

- Act as a job-search reply assistant.
- Generate concise Chinese replies.
- Prefer accurate, polite, leave-room wording.
- Never claim experience or skills not shown in the conversation.
- Ask clarifying questions when the HR asks about requirements, salary, availability, interview, or technical stack.
- Avoid phone, WeChat, private contact, automatic sending, or fake commitments unless the user explicitly provided that context.
- Return strict JSON with `drafts`.

## Frontend Panel

Add a separate draft section below conversation records:

- Button: `生成回复草稿`
- Loading text: `正在生成...`
- Empty state: `当前会话不足，先等待 HR 消息或重新识别。`
- Backend error: `本地服务未启动或不可用。`
- API key error: `本地服务缺少 DEEPSEEK_API_KEY。`
- Suggestions render as plain text blocks with tone labels.

No copy button in v0.4. Manual copy is v0.5.

## Test Strategy

Backend tests:

- Prompt payload includes only `hr` and `self` records.
- Empty transcript is rejected before DeepSeek call.
- DeepSeek response parser accepts JSON responses.
- DeepSeek response parser falls back safely on non-JSON text.
- Missing `DEEPSEEK_API_KEY` returns a controlled error.

Extension tests:

- Request payload strips debug and non-context records.
- Draft client calls localhost only.
- Draft client handles success, backend unavailable, and validation errors.

Smoke checks:

- Panel renders button.
- Click with no backend shows local-service error.
- No code fills or sends a BOSS message.

## Acceptance Criteria

- `npm.cmd test` passes.
- `npm.cmd run check` passes.
- Backend unit tests pass.
- Backend syntax checks pass.
- Manifest includes localhost host permissions only for the local backend.
- Extension source has no input fill or auto-send behavior.
- DeepSeek call exists only in backend code.
- `.env.example` exists, but no real `.env` or API key is committed.
- A validation report documents whether a live DeepSeek call was tested.

## Self Review

- The design keeps v0.3 transcript extraction as the source of truth.
- The user must click before any request leaves the page.
- The extension sends only cleaned records to localhost.
- The backend is the only DeepSeek caller.
- No automatic sending, input filling, or persistent storage is introduced.
