# MVP v0.1 Design

## Goal

Build a local Chrome/Edge extension that detects the latest recruiter-side text message on the currently open BOSS Zhipin web chat page and displays it in a small page panel.

## Non-Goals

- No AI reply generation.
- No DeepSeek API calls.
- No backend service.
- No automatic send, input fill, or message drafting.
- No job scraping, batch actions, login automation, cookie handling, or platform-risk bypass.
- No persistent storage of chat content.

## User Flow

1. User opens a BOSS web chat page.
2. The extension content script injects a small panel on the right side of the page.
3. The content script scans visible chat-like message elements.
4. The extractor selects the newest likely recruiter-side text message.
5. The panel shows the message, detection status, update time, and compact debug data.
6. When the page DOM changes, the listener reruns after a short debounce.

## Detection Strategy

The listener intentionally uses several weak signals instead of depending on one brittle BOSS class name.

Candidate messages are found from visible, text-bearing elements. The extractor filters common non-message content:

- time separators,
- read receipts,
- action buttons,
- job cards,
- analysis cards,
- menus,
- system notices,
- empty nodes,
- duplicate ancestor/descendant text.

Recruiter-side scoring uses:

- left-side alignment or recruiter-side class names,
- message/bubble/chat class names,
- avatar adjacency,
- conversational text length,
- absence of self-side signals.

If confidence is high, the panel shows `识别成功`. If confidence is medium or low, it shows `识别不确定`. If no usable candidate exists, it shows `未识别到聊天消息`.

## Files

```text
extension/
  manifest.json
  src/
    content.js
    messageExtractor.js
    panel.js
  styles/
    panel.css
  test-fixtures/
    boss-chat-sample.html
  tests/
    messageExtractor.test.js
```

## Acceptance Criteria

- The extension can be loaded unpacked from the `extension/` directory.
- A panel is injected into matching BOSS pages.
- The extractor selects the latest left-side HR text in the fixture.
- The extractor ignores right-side self messages in the fixture.
- The extractor ignores time separators, read receipts, job cards, and action buttons in the fixture.
- Tests run without network access or third-party packages.

## Future Gate

Only after this listener is stable on real BOSS pages should the project add reply generation or DeepSeek integration.
