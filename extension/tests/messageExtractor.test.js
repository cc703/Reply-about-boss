const assert = require("node:assert/strict");
const test = require("node:test");

const extractor = require("../src/messageExtractor.js");

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

test("normalizes whitespace in chat text", () => {
  assert.equal(
    extractor.normalizeText("  你好，\n  方便聊聊吗  "),
    "你好， 方便聊聊吗"
  );
});

test("selects the newest recruiter-side text message", () => {
  const result = extractor.extractLatestHrMessageFromCandidates([
    candidate({ index: 1, text: "你好，看了你的简历，方便聊聊吗" }),
    candidate({
      index: 2,
      text: "可以的",
      classText: "chat-message item-myself bubble text",
      side: "right"
    }),
    candidate({
      index: 3,
      text: "你对 Python 和 FastAPI 掌握程度怎么样",
      classText: "chat-message item-friend bubble text",
      side: "left"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.FOUND);
  assert.equal(result.message, "你对 Python 和 FastAPI 掌握程度怎么样");
});

test("keeps the latest recruiter-side message when the newest page message is self-sent", () => {
  const result = extractor.extractLatestHrMessageFromCandidates([
    candidate({
      index: 1,
      text: "你对 Python 的原理，或者相关技术栈掌握程度咋样呢",
      classText: "chat-message item-friend bubble text",
      side: "left"
    }),
    candidate({
      index: 2,
      text: "我 Python 基础和 FastAPI 有一些项目经验",
      classText: "chat-message item-myself bubble text",
      side: "right"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.FOUND);
  assert.equal(result.message, "你对 Python 的原理，或者相关技术栈掌握程度咋样呢");
});

test("ignores time separators, read receipts, job cards, and action text", () => {
  const result = extractor.extractLatestHrMessageFromCandidates([
    candidate({ index: 1, text: "10:08", classText: "time-line", side: "center" }),
    candidate({
      index: 2,
      text: "你与该职位竞争者PK情况 查看详细分析",
      classText: "job-card analysis-card",
      side: "center",
      interactiveNoise: true
    }),
    candidate({
      index: 3,
      text: "查看职位",
      classText: "button job-card",
      side: "center",
      interactiveNoise: true
    }),
    candidate({ index: 4, text: "已读", classText: "read-status", side: "right" }),
    candidate({
      index: 5,
      text: "方便了解一下你的到岗时间吗",
      classText: "chat-message item-friend bubble text",
      side: "left"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.FOUND);
  assert.equal(result.message, "方便了解一下你的到岗时间吗");
});

test("does not treat injected extension panel text as a chat message", () => {
  const result = extractor.extractLatestHrMessageFromCandidates([
    candidate({
      index: 1,
      text: "打开 BOSS 聊天页后会自动显示。",
      classText: "bcl-panel bcl-message #bcl-panel",
      side: "right"
    }),
    candidate({
      index: 2,
      text: "最新HR消息",
      classText: "bcl-label #bcl-panel",
      side: "right"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.EMPTY);
  assert.equal(result.message, "");
});

test("marks weak recruiter-side candidates as uncertain instead of high confidence", () => {
  const result = extractor.extractLatestHrMessageFromCandidates([
    candidate({
      index: 1,
      text: "方便聊聊吗",
      classText: "plain",
      side: "left"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.UNCERTAIN);
  assert.equal(result.message, "方便聊聊吗");
});

test("prefers a real recruiter bubble over later resume action text", () => {
  const result = extractor.extractLatestHrMessageFromCandidates([
    candidate({
      index: 1,
      text: "终于等到优秀的你了！这是校招内推信息，期待你的加入。",
      classText: "chat-message item-friend bubble text",
      side: "left"
    }),
    candidate({
      index: 2,
      text: "你与该职位竞争者PK情况 查看详细分析",
      classText: "job-card analysis-card",
      side: "center",
      interactiveNoise: true
    }),
    candidate({
      index: 3,
      text: "发简历",
      classText: "dialog-action content",
      side: "left"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.FOUND);
  assert.equal(result.message, "终于等到优秀的你了！这是校招内推信息，期待你的加入。");
});

test("rejects generic page action controls that are not exact ignored words", () => {
  const result = extractor.extractLatestHrMessageFromCandidates([
    candidate({
      index: 1,
      text: "补充信息",
      classText: "dialog-action content chat-scroll boss-chat-page",
      side: "left"
    }),
    candidate({
      index: 2,
      text: "交换微信",
      classText: "operation-btn content chat-scroll boss-chat-page",
      side: "left"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.EMPTY);
  assert.equal(result.message, "");
});

test("does not treat broad boss or chat container classes as message confidence", () => {
  const result = extractor.extractLatestHrMessageFromCandidates([
    candidate({
      index: 1,
      text: "补充信息",
      classText: "content chat-scroll boss-chat-page",
      side: "left"
    }),
    candidate({
      index: 2,
      text: "方便了解一下你的项目经历吗",
      classText: "message-row item-friend bubble",
      side: "left"
    })
  ]);

  assert.equal(result.status, extractor.STATUS.FOUND);
  assert.equal(result.message, "方便了解一下你的项目经历吗");
});

test("derives the latest HR message from transcript extraction when available", () => {
  const previousNamespace = globalThis.BossChatListener;
  const root = { marker: "transcript-root" };

  globalThis.BossChatListener = Object.assign({}, previousNamespace || {}, {
    conversationExtractor: {
      extractConversationTranscript(currentRoot) {
        assert.equal(currentRoot, root);
        return {
          status: "found",
          candidatesScanned: 6,
          matchedCandidates: 4,
          contextRecords: [
            {
              role: "hr",
              sourceType: "message",
              text: "你好，看了你的简历，方便聊聊吗",
              confidence: "high",
              order: 1,
              debug: { score: 9, reasons: ["hr-class-signal"] }
            },
            {
              role: "self",
              sourceType: "message",
              text: "可以的",
              confidence: "high",
              order: 2,
              debug: { score: 9, reasons: ["self-class-signal"] }
            },
            {
              role: "hr",
              sourceType: "message",
              text: "你对 Python 和 FastAPI 掌握程度怎么样",
              confidence: "high",
              order: 3,
              debug: { score: 10, reasons: ["hr-class-signal"] }
            }
          ]
        };
      }
    }
  });

  try {
    const result = extractor.extractLatestHrMessage(root);

    assert.equal(result.status, extractor.STATUS.FOUND);
    assert.equal(result.message, "你对 Python 和 FastAPI 掌握程度怎么样");
    assert.equal(result.candidatesScanned, 6);
    assert.equal(result.matchedCandidates, 4);
  } finally {
    globalThis.BossChatListener = previousNamespace;
  }
});
