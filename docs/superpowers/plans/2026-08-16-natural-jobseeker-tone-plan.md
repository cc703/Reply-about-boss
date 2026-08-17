# Natural Job-Seeker Tone Implementation Plan

**Goal:** Produce conversational job-seeking drafts and let the user choose a preset or temporary custom tone before manual generation.

**Architecture:** The panel exposes tone controls, `content.js` reads them at click time, and `replyDraftClient.js` sends a bounded tone preference to the local FastAPI service. The backend maps presets to explicit guidance, treats custom text as style-only input, strengthens the generation prompt, and provides natural deterministic fallbacks.

**Tech Stack:** Chrome Manifest V3, plain JavaScript, FastAPI, Pydantic, Node `node:test`, Python `unittest`.

## Task 1: Lock the backend voice contract

- [ ] Add failing prompt tests for conversational style, short replies, practical questions, banned formal phrases, and style-only custom guidance.
- [ ] Add failing fallback tests for five natural candidate replies.
- [ ] Run focused tests and confirm the new assertions fail.
- [ ] Implement preset/custom tone guidance and natural fallbacks.
- [ ] Re-run focused backend tests.

## Task 2: Add tone controls to the extension

- [ ] Add failing client tests for preset and custom tone payload fields.
- [ ] Add a content-script test proving the panel's current preference reaches the request.
- [ ] Add a compact selector and conditional custom input to the panel.
- [ ] Add a pure panel helper that returns the current bounded preference.
- [ ] Pass the preference to `requestReplyDrafts` on each manual click.
- [ ] Re-run focused extension tests.

## Task 3: Verify behavior and presentation

- [ ] Run all extension tests and syntax checks.
- [ ] Run all backend tests and Python compilation.
- [ ] Restart the local backend and verify health/version.
- [ ] Sample five anonymized recruiter scenarios against DeepSeek without exposing the stored API key.
- [ ] Check outputs for conversational tone, useful questions, factual grounding, and no schedule or capability commitments.

## Task 4: Version and handoff

- [ ] Bump extension, package, and backend versions to `0.10.0`.
- [ ] Write a validation report with exact evidence and remaining live-browser limitations.
- [ ] Create the next task-list file under `docs/task-lists/` and update its index.

## Stop Condition

Stop after automated checks pass, the updated backend serves `0.10.0`, five anonymized scenarios are reviewed, and the next live-browser QA task is documented. Do not add persistent custom-tone storage, automatic input filling, automatic sending, or additional external services.
