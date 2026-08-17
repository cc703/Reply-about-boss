# BOSS Chat Listener Agent Guide

## Project Intent

This project is a personal-use browser extension for BOSS Zhipin web chat.

Version 0.1 only solves one problem:

> Automatically detect and display the latest recruiter-side text message in the currently open BOSS web chat.

The first version must not generate replies, call DeepSeek, store chat history, auto-fill the input box, auto-send messages, scrape jobs, or automate applications. Those features are explicitly out of scope until the listener is stable in real use.

Current implementation status as of v0.12:

- v0.3 transcript extraction has been validated by the user as acceptable on the real page.
- v0.12 includes local-backend DeepSeek reply drafts, manual copy, tone selection, draggable panel positioning, and automatic/manual reply-purpose selection.
- Reply purposes cover continuing the conversation, declining the role, politely closing, and acknowledging recruiter rejection.
- Terminal reply purposes are enforced by deterministic backend filtering and local safe fallbacks, not only by model instructions.
- The extension may send cleaned `hr/self` transcript records to `http://127.0.0.1:8765` only after a manual user click.
- The backend is the only component allowed to call DeepSeek.
- Auto-fill, auto-send, cookie handling, login automation, platform API interception, batch outreach, and persistent chat storage remain out of scope.

## GitHub Target

When the user asks to publish this project, upload it to:

```text
https://github.com/cc703/Reply-about-boss
```

Current note as of 2026-08-17: the target repository is public and contains the owner-selected MIT License; the project source has not yet been published.

Do not push automatically just because this URL exists. Publishing is a separate user-requested step.

## MVP 0.1 Scope

### In Scope

- Chrome/Edge extension using Manifest V3.
- Content script runs only on BOSS Zhipin web pages.
- Detect the active chat area on the current page.
- Observe chat DOM updates with `MutationObserver`.
- Extract the latest recruiter-side text message.
- Render a small local panel on the page showing:
  - latest detected HR message,
  - detection time,
  - detection status,
  - optional debug summary such as candidate count.
- Work without any backend service or external API.

### Out of Scope

- DeepSeek API integration.
- AI reply generation.
- Reply copying, input filling, or sending.
- Automatic greeting, batch delivery, or job scraping.
- Account login automation, cookie handling, anti-risk bypass, or reverse-engineered API usage.
- Persisting chat content beyond short-lived in-page state.

## Product Rules

- Human-in-the-loop is mandatory for every future communication feature.
- Never auto-send any message.
- Never present automation that bypasses platform rules as a feature.
- For v0.1, do not transmit chat content over the network.
- Only read what is visible in the current tab.
- Prefer conservative detection. If the extension is unsure whether text is an HR message, mark it as uncertain instead of pretending it is correct.
- Do not collect or expose personal contact information unless the user explicitly adds a future feature for it.

## Publish Safety Protocol

Before any GitHub upload:

1. Inspect `git status --short`.
2. Inspect every tracked and staged file path.
3. Search for secrets and private data before commit:
   - API keys,
   - `.env` values,
   - cookies,
   - tokens,
   - phone numbers,
   - email addresses,
   - WeChat IDs,
   - raw resume files,
   - screenshots of chats,
   - BOSS account data.
4. Keep local-only or private files out of Git:
   - `.env`,
   - `.env.*`,
   - `*.docx`,
   - `*.pdf`,
   - chat screenshots,
   - `.claude/`,
   - `CLAUDE.md`,
   - local browser profiles,
   - temporary exports.
5. Commit only source code, docs, fixtures with anonymized content, and safe configuration examples.
6. Use the Lore Commit Protocol from the active task instructions when creating commits.
7. Push only after the privacy/tracked-file review is clean.

## Open Source References

Use these projects as references, not as direct product scope:

- `iiwish/chatboss`: Chrome extension direction for job-seeking message assistance. Borrow the browser-extension product shape and lightweight UX. Do not copy its greeting-generation scope into v0.1.
  - https://github.com/iiwish/chatboss
- `rifat17/ai-reply-assistant`: Generic browser AI reply assistant. Borrow the idea of user-controlled suggestions in future versions. Do not add AI in v0.1.
  - https://github.com/rifat17/ai-reply-assistant
- `yxheartipp/deepseek-boss-helper`: DeepSeek + BOSS extension reference for a later phase. Do not add job matching or greeting generation now.
  - https://github.com/yxheartipp/deepseek-boss-helper
- `yangfeng20/ai-job` and similar automated job tools: useful as negative references for scope boundaries. Avoid AI proxy, batch delivery, and automatic HR conversation behavior.
  - https://github.com/yangfeng20/ai-job

When researching external references, prefer GitHub source/README and official browser-extension documentation. Record only the design lesson needed for this project.

Detailed open-source lessons are tracked in:

```text
docs/references/open-source-lessons.md
```

Before each new project phase, quickly check that file and add new references if they materially improve listener accuracy, extension UX, privacy boundaries, or manual validation. Do not copy automation-heavy behavior just because another project supports it.

## Recommended Repository Shape

Keep v0.1 small:

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
docs/
  mvp-v0.1.md
```

Do not add a backend folder until the listener is stable.

## Technical Design Direction

### Extension

- Use Manifest V3.
- Use a content script injected into BOSS web pages.
- Use no privileged permissions unless needed.
- Start with `host_permissions` scoped to BOSS domains only.
- Keep injected UI isolated with stable class prefixes such as `bcl-`.

### Detection Pipeline

Implement message detection as a pure, testable function:

```text
DOM snapshot -> candidate text nodes -> message bubble candidates -> HR-side scoring -> latest HR message
```

Recommended extraction strategy:

1. Observe page changes with `MutationObserver`.
2. Debounce updates to avoid repeated parsing during animations.
3. Find visible text-bearing elements inside likely chat containers.
4. Filter out:
   - time separators,
   - read receipts,
   - job cards,
   - analysis cards,
   - buttons,
   - menus,
   - system notices,
   - empty or duplicate text.
5. Score candidates using several weak signals instead of one brittle selector:
   - visible on screen,
   - short conversational text,
   - located in the message stream area,
   - left-side alignment or recruiter-side layout,
   - not inside a user-sent bubble,
   - not inside a card with action buttons.
6. Select the newest high-confidence recruiter-side candidate.
7. If confidence is low, show `识别不确定` in the panel.

Do not depend on a single BOSS class name unless it is wrapped in fallback logic.

### Panel

The panel is a debugging and user-facing status surface, not a chat tool yet.

It should show:

- `最新HR消息`
- the detected message text,
- `识别成功` / `识别不确定` / `未识别到聊天消息`,
- last update time,
- a compact debug line during development.

The panel must not include reply generation controls in v0.1.

## Quality Bar

The v0.1 success claim is allowed only when:

- the extension loads in Chrome/Edge developer mode,
- the content script injects the panel on a BOSS chat page,
- the listener updates when a new visible message appears,
- self-sent messages are not selected as HR messages in the tested case,
- system cards and time separators are ignored in the tested case,
- the same extraction logic passes against a local static fixture.

If live BOSS validation cannot be performed, say so explicitly and report fixture-only validation.

## Implementation Procedure

1. Inspect the current workspace before editing.
2. Keep v0.1 focused on listener-only behavior.
3. Write or update a short design note under `docs/` before adding implementation files.
4. Implement the extractor as a pure function first.
5. Add a static HTML fixture based on observed BOSS chat structure.
6. Add the content script and panel after the extractor works on the fixture.
7. Verify by loading the unpacked extension locally.
8. Verify on the fixture.
9. Verify on a real BOSS chat page if available.
10. Report exactly what was verified and what remains uncertain.

## Step Handoff Task Lists

After each completed project step, create the next step's task-list Markdown file under:

```text
docs/task-lists/
```

Each task-list file must include:

- work objective,
- concrete work content,
- prompt to hand to the next agent/session,
- open-source references to consult,
- required skills,
- useful MCP/tools,
- recommended agent modules,
- exact files expected to change,
- execution checklist,
- verification checklist,
- stop condition,
- next task-list file to create after completion.

Use `docs/task-lists/000-template.md` as the format baseline.

Do not start a materially new phase unless the previous phase has a corresponding next-step task list, except for emergency fixes.

## Testing Guidance

- Unit-test `messageExtractor.js` with fixture DOM where possible.
- Include cases for:
  - latest left-side HR text,
  - latest right-side self text,
  - time separators,
  - job cards,
  - repeated text,
  - empty messages,
  - multiple HR messages.
- Add manual QA notes for browser behavior because live BOSS DOM may change.

## Skills To Use

- Use `superpowers:brainstorming` before changing scope or adding new behavior.
- Use `build-web-apps:frontend-app-builder` when implementing the extension UI.
- Use `build-web-apps:frontend-testing-debugging` when debugging browser rendering or interaction.
- Use `superpowers:systematic-debugging` when detection fails unexpectedly.
- Use `superpowers:verification-before-completion` before claiming the extension works.

If a skill is selected, read its `SKILL.md` fully before acting.

## Agent Roles Available

Default posture: work directly. Use subagents only for independent, bounded work that improves throughput.

Available useful roles:

- `explore`: map current files, selectors, and prior code.
- `researcher`: check official browser-extension docs or source references.
- `dependency-expert`: evaluate libraries only if a dependency is being considered.
- `planner`: sequence implementation work.
- `architect`: review detection boundaries and extension architecture.
- `executor`: implement scoped files.
- `test-engineer`: design fixture and browser checks.
- `verifier`: validate completion evidence.
- `code-reviewer`: review changes before broadening scope.
- `designer`: review panel UX if UI becomes more important.
- `writer`: maintain docs and user-facing notes.
- `debugger`: isolate broken DOM detection.

Do not use `worker` unless an active team/swarm runtime explicitly requires it.

## MCP And Tooling Guidance

Use tools deliberately:

- `mcp__omx_memory`: read/write project memory when explicit project context is needed.
- `mcp__omx_state`: inspect or update OMX mode state only when a workflow needs it.
- `mcp__omx_trace`: inspect agent flow when debugging orchestration.
- `mcp__omx_code_intel`: check local diagnostic backend availability.
- `tool_search`: discover deferred tools before assuming an MCP/tool is unavailable.
- Web search: use for current official docs and GitHub references, then cite sources in final responses.

Do not use external network calls in the extension itself for v0.1.

## Future Upgrade Gates

Only after v0.1 is stable:

1. Add a manual `复制最新HR消息` button.
2. Add local FastAPI + DeepSeek reply generation.
3. Add user-controlled draft display.
4. Add copy or fill-input buttons.

Even in future versions, automatic sending remains forbidden unless the user explicitly changes the project policy.
