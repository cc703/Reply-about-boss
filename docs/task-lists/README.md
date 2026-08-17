# Task Lists

This folder stores step-by-step handoff files for this project.

Rule: after each completed step, create the next step's Markdown task list here before moving into the next phase.

Each file should be specific enough that a future Codex session or agent can execute it without re-discovering the project goal.

## Naming

Use this format:

```text
YYYY-MM-DD-vX.Y-short-task-name.md
```

Example:

```text
2026-08-01-v0.2-real-boss-page-validation.md
```

## Current Sequence

1. `2026-08-01-v0.2-real-boss-page-validation.md`
   - Validate v0.1 on a real BOSS web chat page.
   - Decide whether selectors/detection need repair before adding any new feature.
2. `2026-08-01-v0.2b-manual-login-extension-validation.md`
   - Complete the live validation that requires a logged-in BOSS session and a manually loaded unpacked extension.
   - Do not move to v0.3 until this passes or produces an anonymized failure fixture.
3. `2026-08-02-v0.2c-reload-extension-live-recheck.md`
   - Reload the fixed extension in Chrome/Edge and recheck the same real BOSS chat pattern.
   - Recheck both the resume-action false positive and the broader action/control hardening.
   - Superseded by the v0.3 transcript-first direction after real-page evidence showed the single latest-message model was still too brittle.
4. `2026-08-02-v0.3-conversation-transcript-extraction.md`
   - Extract the visible current-conversation transcript instead of selecting only one latest HR message.
   - Classify records as HR, self, system, control, or unknown.
   - Keep DeepSeek and reply generation deferred to v0.4.
5. `2026-08-02-v0.3c-live-chat-container-recheck.md`
   - Reload the fixed extension and verify the real BOSS page no longer shows third-party assistant/page chrome text as conversation records.
   - Do not start DeepSeek work until this passes.
6. `2026-08-02-v0.4-deepseek-draft-suggestions.md`
   - Add local-backend DeepSeek draft suggestions after v0.3 is stable on a real BOSS page.
   - Keep suggestions user-reviewed and never auto-fill or auto-send.
7. `2026-08-02-v0.5-manual-copy-draft.md`
   - Add a manual copy action for generated drafts.
   - Do not fill the BOSS input or send messages.
8. `2026-08-02-v0.6-live-deepseek-qa.md`
   - Verify the full live workflow with a real local DeepSeek API key.
   - Do not move to publishing until this passes.
9. `2026-08-16-v0.7-live-popup-key-qa.md`
   - Verify popup-based Key configuration, Windows Credential Manager persistence, and live draft generation.
   - Do not publish until the Key exposure checks pass.
10. `2026-08-16-v0.9-live-reply-quality-qa.md`
   - Validate v0.8 latest-message focus and grounded reply quality across five real recruiter intent categories.
   - Do not start publish preparation until unsafe wording and privacy checks pass.
11. `2026-08-16-v0.9b-live-browser-reply-qa.md`
   - Reload extension v0.9.0 in the existing logged-in profile and verify rendered draft, fallback, copy, and privacy behavior.
   - Keep publication blocked until this real-browser gate passes.
12. `2026-08-16-v0.10b-live-tone-selector-qa.md`
   - Reload extension v0.10.0 and verify preset/custom tone controls plus grounded draft rendering in the existing logged-in profile.
   - Supersedes the v0.9b browser gate; keep publication blocked until this passes.
13. `2026-08-16-v1.0-publish-prep.md`
   - Prepare a privacy-clean first public release and review the exact tracked-file scope.
   - Paused until the v0.12b live conversation-intent gate passes; do not commit or push until privacy checks pass and the user explicitly authorizes publication.
14. `2026-08-16-v0.11b-live-drag-qa.md`
   - Reload extension v0.11.0 and verify title-bar dragging, viewport containment, and unchanged controls on the real BOSS page.
   - Resume v1.0 publication preparation only after this gate passes.
15. `2026-08-16-v0.12b-live-intent-qa.md`
   - Reload extension v0.12.0 and verify automatic/manual reply purposes across initial contact, continued discussion, recruiter rejection, and natural closing.
   - Resume v1.0 publication preparation only after purpose accuracy, existing controls, and no-send boundaries pass.
16. `2026-08-17-v1.0-license-and-publication-authorization.md`
   - Select a public license and prepare the exact initial Git history only after explicit owner authorization.
   - Do not infer a license, configure a remote, commit, or push without the stated authorization.
17. `2026-08-17-v1.0-post-publish-verification.md`
   - Verify the public repository tree, commit, license, and privacy boundaries after the authorized initial push.
18. `2026-08-17-v1.1-product-iteration.md`
   - Improve one reproducible reply-draft or live-page issue while preserving manual review, no-send behavior, and credential privacy.
