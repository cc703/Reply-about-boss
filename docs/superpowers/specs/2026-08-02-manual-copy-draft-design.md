# v0.5 Manual Copy Draft Design

## Context

v0.4 shows DeepSeek reply draft suggestions in the extension panel. The next practical step is to let the user copy a chosen draft manually.

This version must not fill the BOSS input box or send messages.

## Scope

In scope:

- Add a `复制` button to each generated draft.
- Copy only the selected draft text to the system clipboard after a user click.
- Show short success or failure feedback in the panel.
- Keep the generated draft text visible so the user can inspect it before copying.

Out of scope:

- Filling the BOSS input box.
- Clicking BOSS send buttons.
- Auto-send.
- Hidden textarea fallback.
- `document.execCommand`.
- Reading clipboard content.
- Storing copied drafts.

## Clipboard Strategy

Use `navigator.clipboard.writeText` from the manual button click path.

Rationale:

- It matches the browser's modern Clipboard API.
- It keeps the action tied to a user gesture.
- It avoids hidden DOM inputs or textarea fallbacks that could be confused with BOSS input manipulation.
- It avoids extra extension permissions for now.

If live validation shows Chrome blocks clipboard write from the content script, the next fix should evaluate the official extension clipboard permission path before adding any fallback.

## UI Behavior

Each generated draft item contains:

- tone label,
- draft text,
- `复制` button.

On click:

- button briefly shows `已复制`,
- draft section status shows `已复制到剪贴板，请自行粘贴发送。`

On failure:

- button returns to `复制`,
- draft section status shows `复制失败，请手动选中文字复制。`

## Safety Boundary

The code must not:

- query `textarea`, `input`, or BOSS editor elements,
- call `.click()` on page controls,
- call `.submit()`,
- read or write cookies,
- use hidden textarea fallback,
- send copied text automatically.

## Testing Strategy

Frontend tests:

- `copyDraftText` writes normalized text using an injected clipboard implementation.
- Empty draft text is rejected before clipboard write.
- Missing Clipboard API returns a controlled error.

Smoke checks:

- Chrome fixture renders copy buttons after draft state is rendered.
- The panel still renders conversation records and draft button.
- No forbidden input/send patterns are introduced.

## Acceptance Criteria

- `npm.cmd test` passes.
- `npm.cmd run check` passes.
- The copy helper has tests.
- Chrome fixture smoke confirms draft copy buttons render.
- Forbidden behavior scan has no input fill, send, cookie, hidden textarea, or `execCommand`.
- No new network or storage behavior is added.

## Self Review

- The feature is manual and user-controlled.
- It copies visible draft text only.
- It does not interact with BOSS page inputs.
- It does not add clipboard read or persistent storage.
