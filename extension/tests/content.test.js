const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

function createButton() {
  return {
    listeners: {},
    addEventListener(type, listener) {
      this.listeners[type] = listener;
    }
  };
}

function createPanel() {
  const refreshButton = createButton();
  const draftButton = createButton();
  const toneSelect = { value: "custom" };
  const customToneInput = { value: "自然一点，像正常求职聊天" };
  const panelListeners = {};

  return {
    listeners: panelListeners,
    querySelector(selector) {
      if (selector === ".bcl-refresh") {
        return refreshButton;
      }
      if (selector === ".bcl-draft-button") {
        return draftButton;
      }
      if (selector === ".bcl-tone-select") {
        return toneSelect;
      }
      if (selector === ".bcl-custom-tone") {
        return customToneInput;
      }
      return null;
    },
    addEventListener(type, listener) {
      panelListeners[type] = listener;
    },
    refreshButton,
    draftButton,
    toneSelect,
    customToneInput
  };
}

test("binds draft and refresh click handlers when boot creates the panel", async () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/content.js"), "utf8");
  const panel = createPanel();
  const draftStates = [];
  let requestOptions = null;
  const sandbox = {
    BossChatListener: {
      conversationExtractor: {
        extractConversationTranscript() {
          return {
            status: "found",
            conversationRecords: [{ role: "hr", text: "方便聊聊吗" }],
            contextRecords: [{ role: "hr", text: "方便聊聊吗" }]
          };
        }
      },
      replyDraftClient: {
        requestReplyDrafts: async (_transcript, options) => {
          requestOptions = options;
          return {
          drafts: [{ tone: "稳妥", text: "您好，可以进一步了解。" }],
          model: "test-model"
          };
        },
        copyDraftText: async () => ({ ok: true })
      },
      panel: {
        createPanel: () => panel,
        renderPanel: () => {},
        renderDraftState: (_panel, state) => draftStates.push(state.status),
        getDraftTonePreference: () => ({
          tone: "custom",
          customTone: "自然一点，像正常求职聊天",
          replyIntent: "decline"
        }),
        renderCopyState: () => {}
      }
    },
    document: {
      readyState: "complete",
      body: {},
      hidden: false,
      addEventListener: () => {}
    },
    MutationObserver: class {
      observe() {}
    },
    clearTimeout: () => {},
    setTimeout: (callback) => {
      callback();
      return 1;
    },
    addEventListener: () => {}
  };

  vm.runInNewContext(source, sandbox, { filename: "content.js" });

  assert.equal(typeof panel.refreshButton.listeners.click, "function");
  assert.equal(typeof panel.draftButton.listeners.click, "function");

  await panel.draftButton.listeners.click();
  assert.deepEqual(draftStates, ["loading", "success"]);
  assert.deepEqual(requestOptions, {
    tone: "custom",
    customTone: "自然一点，像正常求职聊天",
    replyIntent: "decline"
  });
});
