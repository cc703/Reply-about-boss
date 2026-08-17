# Open Source Lessons

This project can learn from open-source job-search assistants, but v0.1-v0.2 remains a local listener only. References below are inputs for design judgment, not permission to copy automation-heavy scope.

Checked on: 2026-08-02

## Reference Projects

### `iiwish/chatboss`

URL: https://github.com/iiwish/chatboss

Useful lessons:

- Chrome extension is a good product surface for job-search assistance because it works directly where the user is reading the job or chat page.
- Lightweight install docs matter. Keep our README focused on `chrome://extensions/`, developer mode, and loading the `extension/` directory.
- Future AI features should stay user-facing and explainable, with visible context and generated text the user can review.

Do not copy into current scope:

- AI greeting generation.
- Cross-platform generic reply generation before the BOSS listener is stable.

### `yangfeng20/ai-job`

URL: https://github.com/yangfeng20/ai-job

Useful lessons:

- Embedded page UI is more ergonomic than switching to a separate app.
- If a later backend is added, keep browser UI and server responsibilities clearly separated.
- A bundled/local script path can be more reliable than CDN-dependent assets.

Negative lessons:

- Protocol interception, batch delivery, automatic chatting, and automatic contact exchange are outside this project's safety boundary.
- Automation-heavy systems need more risk controls than this personal listener should carry.

### `DYxiaochen/AI-BossJob`

URL: https://github.com/DYxiaochen/AI-BossJob

Useful lessons:

- Resume/job context can improve future response quality.
- Privacy warnings around resumes and contact details should be explicit before any future AI or upload feature.
- HR activity/time filtering is useful for job-search tools, but not relevant to the current chat listener.

Do not copy into current scope:

- Auto-send resume.
- Mass outreach.
- AI chat mode.

### `longsizhuo/BossZhiPin_Job_Search`

URL: https://github.com/longsizhuo/BossZhiPin_Job_Search

Useful lessons:

- Dry-run or review-before-send modes are valuable when AI text generation appears in a later phase.
- Setup diagnostics and beginner-friendly onboarding reduce support cost.
- Keeping user data in a dedicated local profile/storage area is safer than mixing it with source files.

Boundary lesson:

- Even when a project generates messages, the user should review generated text before any send action. This aligns with this project's human-in-the-loop rule.

Do not copy into current scope:

- Browser automation for sending.
- Anti-scraping or anti-risk bypass techniques.

### `open-agent-power/offer-laolao-plugin`

URL: https://github.com/open-agent-power/offer-laolao-plugin

Useful lessons:

- Browser-extension UX can support manual and assisted modes side by side.
- Field-level precision is important. For this project, the analogous rule is element-level precision: identify message bubbles, not nearby action labels.
- Future fill/copy features should be explicit user actions, not hidden automation.

Do not copy into current scope:

- Form auto-fill.
- Resume parsing or external service calls.

### `can4hou6joeng4/boss-agent-cli`

URL: https://github.com/can4hou6joeng4/boss-agent-cli

Useful lessons:

- Low-risk defaults should block automatic outreach, batch operations, platform-risk bypass, and personal-data processing.
- Local assist is a defensible positioning: the tool should help the user decide, not act as the user.
- JSON-like, inspectable outputs are useful for later agent/backend phases.

Do not copy into current scope:

- CLI job search.
- Any BOSS interface access outside visible user-controlled pages.

## Design Principles Adopted

1. Keep the tool embedded in the active browser page.
2. Prefer local-only behavior until there is a strong reason to add a backend.
3. Make every potentially risky action manual and visible.
4. Treat action labels such as `发简历` as UI controls, not chat messages.
5. Keep fixtures anonymized and based on structure, not real private chat content.
6. Add dry-run/review gates before any future AI or send-related feature.
7. Separate source code from private user data, profiles, screenshots, resumes, and API keys.

## Scope Guard

Do not implement these without an explicit new design and task list:

- automatic sending,
- automatic resume delivery,
- batch greeting,
- protocol/WebSocket interception,
- cookie/session handling,
- anti-risk bypass,
- background scraping,
- storing raw chat logs,
- uploading resumes or screenshots.
