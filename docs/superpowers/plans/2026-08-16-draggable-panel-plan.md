# Draggable Panel Implementation Plan

**Goal:** Make the injected panel movable by dragging its title bar while preserving all existing controls and safety boundaries.

**Architecture:** Add a pure clamp helper and a Pointer Events binding helper to `panel.js`, call the binding from `createPanel`, and add drag-state CSS to the existing panel stylesheet. Keep position in page memory only.

## Task 1: Lock movement behavior

- [ ] Add tests for left, top, right, and bottom viewport clamping.
- [ ] Add tests for pointer-down position capture and pointer-move updates.
- [ ] Add tests proving interactive header controls do not start dragging.
- [ ] Run focused panel tests and confirm they fail before implementation.

## Task 2: Implement dragging

- [ ] Implement `clampPanelPosition` as a pure helper.
- [ ] Implement `makePanelDraggable` using pointer capture.
- [ ] Convert the initial right-positioned panel to `left/top` only after a real drag starts.
- [ ] Re-clamp a dragged panel after viewport resize.
- [ ] Bind dragging once from `createPanel`.

## Task 3: Add visual feedback

- [ ] Add grab/grabbing cursors to the header.
- [ ] Disable header text selection and native touch scrolling during drag.
- [ ] Keep the collapse button cursor and behavior unchanged.

## Task 4: Verify and hand off

- [ ] Run all extension tests and syntax checks.
- [ ] Run all backend tests and Python compilation as regression coverage.
- [ ] Bump package, manifest, and backend versions to `0.11.0`.
- [ ] Write validation evidence.
- [ ] Create the next real-page drag QA task list.

## Stop Condition

Stop after automated verification passes and the next real-page QA task is documented. Do not add coordinate persistence, resizing, snapping, automatic panel movement, or new extension permissions.
