const assert = require("node:assert/strict");
const test = require("node:test");

const extractor = require("../src/conversationExtractor.js");

function candidate(overrides) {
  return Object.assign(
    {
      text: "",
      index: 0,
      classText: "chat-message item-friend bubble text",
      side: "left",
      tagName: "div",
      visible: true,
      interactiveNoise: false,
      hasSameTextDescendant: false
    },
    overrides
  );
}

test("extracts ordered HR, self, and system records from candidates", () => {
  const result = extractor.extractConversationTranscriptFromCandidates([
    candidate({ index: 1, text: "10:08", classText: "chat-time", side: "center" }),
    candidate({ index: 2, text: "你好，看了你的简历，方便聊聊吗" }),
    candidate({
      index: 3,
      text: "可以的，想了解一下岗位要求",
      classText: "chat-message item-myself bubble text",
      side: "right"
    }),
    candidate({
      index: 4,
      text: "你对 Python 和 FastAPI 掌握程度怎么样",
      classText: "chat-message item-friend bubble text",
      side: "left"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.FOUND);
  assert.deepEqual(
    result.conversationRecords.map((record) => record.role),
    ["system", "hr", "self", "hr"]
  );
  assert.deepEqual(
    result.contextRecords.map((record) => record.text),
    [
      "你好，看了你的简历，方便聊聊吗",
      "可以的，想了解一下岗位要求",
      "你对 Python 和 FastAPI 掌握程度怎么样"
    ]
  );
});

test("classifies resume actions as controls outside conversation context", () => {
  const result = extractor.extractConversationTranscriptFromCandidates([
    candidate({ index: 1, text: "终于等到优秀的你了，期待你的加入。" }),
    candidate({
      index: 2,
      text: "发简历",
      classText: "dialog-action resume-btn",
      side: "left",
      interactiveNoise: true
    })
  ]);

  const control = result.records.find((record) => record.text === "发简历");
  assert.equal(control.role, "control");
  assert.equal(control.sourceType, "action");
  assert.equal(result.conversationRecords.some((record) => record.text === "发简历"), false);
  assert.equal(result.contextRecords.some((record) => record.text === "发简历"), false);
});

test("classifies time separators and read receipts as system records", () => {
  const result = extractor.extractConversationTranscriptFromCandidates([
    candidate({ index: 1, text: "07-20 11:34", classText: "time-line", side: "center" }),
    candidate({ index: 2, text: "已读", classText: "read-status", side: "right" }),
    candidate({ index: 3, text: "方便聊聊到岗时间吗" })
  ]);

  assert.deepEqual(
    result.records.map((record) => [record.text, record.role, record.sourceType]),
    [
      ["07-20 11:34", "system", "time"],
      ["已读", "system", "receipt"],
      ["方便聊聊到岗时间吗", "hr", "message"]
    ]
  );
});

test("ignores injected extension panel text", () => {
  const result = extractor.extractConversationTranscriptFromCandidates([
    candidate({
      index: 1,
      text: "当前会话记录",
      classText: "bcl-panel bcl-label #bcl-panel",
      side: "right"
    }),
    candidate({
      index: 2,
      text: "打开 BOSS 聊天页后会自动显示。",
      classText: "bcl-panel bcl-message #bcl-panel",
      side: "right"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.EMPTY);
  assert.deepEqual(result.records, []);
});

test("collapses duplicate ancestor and descendant text", () => {
  const result = extractor.extractConversationTranscriptFromCandidates([
    candidate({
      index: 1,
      text: "你好，看了你的简历，方便聊聊吗",
      classText: "chat-message item-friend wrapper",
      hasSameTextDescendant: true
    }),
    candidate({
      index: 2,
      text: "你好，看了你的简历，方便聊聊吗",
      classText: "chat-message item-friend bubble text"
    })
  ]);

  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].text, "你好，看了你的简历，方便聊聊吗");
});

test("keeps weak conversational text unknown instead of HR when signals conflict", () => {
  const result = extractor.extractConversationTranscriptFromCandidates([
    candidate({
      index: 1,
      text: "补充信息",
      classText: "content chat-scroll boss-chat-page",
      side: "left"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.UNCERTAIN);
  assert.equal(result.records[0].role, "unknown");
  assert.equal(result.records[0].confidence, "low");
  assert.equal(result.contextRecords.length, 0);
  assert.equal(result.conversationRecords.length, 0);
});

test("keeps third-party assistant chrome out of displayed conversation records", () => {
  const result = extractor.extractConversationTranscriptFromCandidates([
    candidate({
      index: 1,
      text: "你好，看了你的简历，方便聊聊吗",
      classText: "chat-message item-friend bubble text",
      side: "left"
    }),
    candidate({
      index: 2,
      text: "你好，可以的，方便了解一下这个岗位主要做哪些工作",
      classText: "chat-message item-myself bubble text",
      side: "right"
    }),
    candidate({
      index: 3,
      text: "BOSS",
      classText: "assistant-panel title",
      side: "right"
    }),
    candidate({
      index: 4,
      text: "智能对话 · 高效沟通",
      classText: "assistant-panel subtitle",
      side: "right"
    }),
    candidate({
      index: 5,
      text: "[13:47:54] 欢迎使用海投助手，我将自动发送简历!",
      classText: "assistant-panel log",
      side: "right"
    }),
    candidate({
      index: 6,
      text: "© 2026 Yangshengzhou · All Rights Reserved.",
      classText: "assistant-panel footer",
      side: "right"
    })
  ]);

  assert.deepEqual(
    result.conversationRecords.map((record) => record.text),
    [
      "你好，看了你的简历，方便聊聊吗",
      "你好，可以的，方便了解一下这个岗位主要做哪些工作"
    ]
  );
  assert.equal(result.unknownCandidates, 4);
});
