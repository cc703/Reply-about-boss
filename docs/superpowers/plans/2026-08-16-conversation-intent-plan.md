# Conversation Intent Implementation Plan

**Goal:** Add automatic and manual communication-purpose handling for continue, decline, recruiter rejection acknowledgement, and conversation closing.

**Architecture:** The panel sends a bounded `reply_intent` enum to FastAPI. `prompt_builder.py` resolves automatic intent from the latest HR message and inserts the result into the model prompt. `draft_guard.py` provides intent-aware safe fallbacks. Tone remains independent.

## Task 1: Define and test backend intent resolution

- [ ] Add tests for recruiter rejection keywords.
- [ ] Add tests for explicit closing/notification messages.
- [ ] Add tests proving neutral messages remain `continue`.
- [ ] Add tests proving manual choices override automatic recognition.
- [ ] Implement a pure `analyze_reply_intent` helper.

## Task 2: Make prompts and fallbacks intent-aware

- [ ] Add prompt tests for requested/resolved intent and purpose-specific rules.
- [ ] Add fallback tests for rejection acknowledgement, candidate decline, and close.
- [ ] Pass intent through the FastAPI request model and route.
- [ ] Ensure terminal intents never introduce a new question.

## Task 3: Add the panel selector

- [ ] Add payload tests for valid and unknown intent values.
- [ ] Add a `回复目的` select above the tone selector.
- [ ] Read the selector on every manual generation click.
- [ ] Keep intent unpersisted and add no permissions.

## Task 4: Verify and hand off

- [ ] Run all extension and backend tests.
- [ ] Run syntax and compilation checks.
- [ ] Run anonymized DeepSeek samples for four intent categories.
- [ ] Bump package, extension, and backend versions to `0.12.0`.
- [ ] Record validation and create a real-page intent QA task list.

## Stop Condition

Stop after intent resolution, UI selection, model prompting, safe fallbacks, automated tests, and anonymized samples pass. Do not add automated sending, persistent intent history, rejection analytics, or job-platform automation.
