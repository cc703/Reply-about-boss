const assert = require("node:assert/strict");
const test = require("node:test");

const panelApi = require("../src/panel.js");

function createClassList() {
  const values = new Set();
  return {
    add(value) {
      values.add(value);
    },
    remove(value) {
      values.delete(value);
    },
    contains(value) {
      return values.has(value);
    }
  };
}

function createDraggableFixture() {
  const listeners = {};
  const resizeListeners = [];
  const header = {
    capturedPointer: null,
    listeners,
    addEventListener(type, listener) {
      listeners[type] = listener;
    },
    setPointerCapture(pointerId) {
      this.capturedPointer = pointerId;
    },
    hasPointerCapture(pointerId) {
      return this.capturedPointer === pointerId;
    },
    releasePointerCapture() {
      this.capturedPointer = null;
    }
  };
  const panel = {
    classList: createClassList(),
    dataset: {},
    style: {},
    querySelector(selector) {
      return selector === ".bcl-header" ? header : null;
    },
    getBoundingClientRect() {
      return { left: 600, top: 100, width: 320, height: 500 };
    }
  };
  const runtime = {
    innerWidth: 1000,
    innerHeight: 700,
    addEventListener(type, listener) {
      if (type === "resize") {
        resizeListeners.push(listener);
      }
    }
  };

  return { header, panel, runtime, resizeListeners };
}

function createPanel(tone, customTone, replyIntent) {
  return {
    querySelector(selector) {
      if (selector === ".bcl-tone-select") {
        return { value: tone };
      }
      if (selector === ".bcl-custom-tone") {
        return { value: customTone };
      }
      if (selector === ".bcl-intent-select") {
        return { value: replyIntent || "auto" };
      }
      return null;
    }
  };
}

test("reads the selected preset without custom text", () => {
  const preference = panelApi.getDraftTonePreference(
    createPanel("cautious", "不应该发送")
  );

  assert.deepEqual(preference, {
    tone: "cautious",
    customTone: "",
    replyIntent: "auto"
  });
});

test("reads and bounds a normalized custom tone", () => {
  const preference = panelApi.getDraftTonePreference(
    createPanel("custom", "  像应届生聊天，\n自然一点  ")
  );

  assert.deepEqual(preference, {
    tone: "custom",
    customTone: "像应届生聊天， 自然一点",
    replyIntent: "auto"
  });
});

test("falls back to natural when controls are unavailable", () => {
  assert.deepEqual(panelApi.getDraftTonePreference(null), {
    tone: "natural",
    customTone: "",
    replyIntent: "auto"
  });
});

test("falls back to natural for an unknown select value", () => {
  assert.deepEqual(
    panelApi.getDraftTonePreference(createPanel("unknown-mode", "任意内容")),
    {
      tone: "natural",
      customTone: "",
      replyIntent: "auto"
    }
  );
});

test("reads the selected communication intent", () => {
  assert.equal(
    panelApi.getDraftTonePreference(createPanel("natural", "", "decline")).replyIntent,
    "decline"
  );
  assert.equal(
    panelApi.getDraftTonePreference(createPanel("natural", "", "unknown")).replyIntent,
    "auto"
  );
});

test("clamps panel coordinates to every viewport edge", () => {
  assert.deepEqual(
    panelApi.clampPanelPosition(
      { left: -30, top: 900 },
      { width: 320, height: 500 },
      { width: 1000, height: 700 },
      8
    ),
    { left: 8, top: 192 }
  );

  assert.deepEqual(
    panelApi.clampPanelPosition(
      { left: 900, top: -20 },
      { width: 320, height: 500 },
      { width: 1000, height: 700 },
      8
    ),
    { left: 672, top: 8 }
  );
});

test("drags the panel by its header and keeps it inside the viewport", () => {
  const fixture = createDraggableFixture();
  let prevented = false;

  panelApi.makePanelDraggable(fixture.panel, fixture.runtime);

  fixture.header.listeners.pointerdown({
    button: 0,
    pointerId: 7,
    clientX: 650,
    clientY: 120,
    target: { closest: () => null },
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(fixture.header.capturedPointer, 7);
  assert.equal(fixture.panel.classList.contains("bcl-panel-dragging"), true);
  assert.equal(fixture.panel.style.right, "auto");

  fixture.header.listeners.pointermove({
    pointerId: 7,
    clientX: 1200,
    clientY: 900,
    preventDefault() {}
  });

  assert.equal(fixture.panel.style.left, "672px");
  assert.equal(fixture.panel.style.top, "192px");

  fixture.header.listeners.pointerup({ pointerId: 7 });

  assert.equal(fixture.header.capturedPointer, null);
  assert.equal(fixture.panel.classList.contains("bcl-panel-dragging"), false);
  assert.equal(fixture.panel.dataset.bclDragged, "true");
  assert.equal(fixture.resizeListeners.length, 1);
});

test("does not start dragging from an interactive header control", () => {
  const fixture = createDraggableFixture();

  panelApi.makePanelDraggable(fixture.panel, fixture.runtime);
  fixture.header.listeners.pointerdown({
    button: 0,
    pointerId: 2,
    clientX: 900,
    clientY: 110,
    target: { closest: () => ({ className: "bcl-collapse" }) },
    preventDefault() {
      throw new Error("interactive controls must not prevent their normal click");
    }
  });

  assert.equal(fixture.header.capturedPointer, null);
  assert.deepEqual(fixture.panel.style, {});
  assert.equal(fixture.panel.classList.contains("bcl-panel-dragging"), false);
});
