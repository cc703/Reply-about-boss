# Draggable Panel Design

## Goal

Allow the BOSS Chat Listener panel to be repositioned when it covers relevant page content, without adding permissions, storage, or automatic page interaction.

## Interaction

- The panel header is the drag handle.
- The collapse button remains a normal button and never starts a drag.
- Mouse, pen, and touch input use Pointer Events through one implementation.
- Dragging changes the fixed panel's `left` and `top` coordinates.
- The panel is clamped to an 8-pixel viewport margin so it cannot be lost off-screen.
- Resizing the viewport re-clamps a previously dragged panel.
- The position lasts only for the current page instance and is not persisted.

## Visual Feedback

- The header uses a `grab` cursor.
- Active dragging uses `grabbing` and disables text selection.
- The header exposes a native tooltip naming the drag behavior.
- Existing collapse, transcript, tone, generate, copy, and refresh controls keep their current layout and behavior.

## Technical Shape

`panel.js` owns two testable APIs:

- `clampPanelPosition`: pure viewport-boundary calculation.
- `makePanelDraggable`: Pointer Event binding for the panel header.

`createPanel` calls `makePanelDraggable` once after the panel is inserted. Pointer capture keeps drag updates active when the pointer leaves the header.

## Safety And Scope

- Do not persist coordinates in extension storage.
- Do not inspect or modify BOSS page controls while dragging.
- Do not add extension permissions.
- Do not change draft generation, copying, API Key handling, input filling, or sending behavior.

## Verification

- Unit tests cover all four viewport edges.
- Unit tests cover pointer down, movement, release, and collapse-button exclusion.
- Existing extension and backend tests remain green.
- Real-page QA confirms the panel moves smoothly, remains visible, and existing controls still work.

## Stop Condition

The feature is complete when title-bar drag works with pointer input, the panel cannot be dragged off-screen, controls remain clickable, and no persistence or new permissions are introduced.
