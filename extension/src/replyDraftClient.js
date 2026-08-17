(function attachReplyDraftClient(globalObject) {
  "use strict";

  var DEFAULT_ENDPOINT = "http://127.0.0.1:8765/api/reply-drafts";
  var MAX_RECORDS = 12;
  var MAX_TEXT_LENGTH = 600;
  var ALLOWED_REPLY_INTENTS = ["auto", "continue", "decline", "close"];

  function ReplyDraftClientError(code, message) {
    this.name = "ReplyDraftClientError";
    this.code = code;
    this.message = message || code;
  }
  ReplyDraftClientError.prototype = Object.create(Error.prototype);
  ReplyDraftClientError.prototype.constructor = ReplyDraftClientError;

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSourceRecords(transcriptResult) {
    if (Array.isArray(transcriptResult && transcriptResult.contextRecords)) {
      return transcriptResult.contextRecords;
    }
    if (Array.isArray(transcriptResult && transcriptResult.conversationRecords)) {
      return transcriptResult.conversationRecords;
    }
    return [];
  }

  function buildReplyDraftPayload(transcriptResult, options) {
    var sourceRecords = getSourceRecords(transcriptResult);
    var cleaned = [];
    var tone = options && options.tone ? normalizeText(options.tone) : "natural";
    var replyIntent = options && options.replyIntent
      ? normalizeText(options.replyIntent).toLowerCase()
      : "auto";
    var customTone = tone === "custom" && options && options.customTone
      ? normalizeText(options.customTone).slice(0, 80)
      : "";

    if (ALLOWED_REPLY_INTENTS.indexOf(replyIntent) === -1) {
      replyIntent = "auto";
    }

    for (var i = 0; i < sourceRecords.length; i += 1) {
      var record = sourceRecords[i] || {};
      var role = normalizeText(record.role).toLowerCase();
      var text = normalizeText(record.text);

      if ((role === "hr" || role === "self") && text) {
        cleaned.push({
          role: role,
          text: text.slice(0, MAX_TEXT_LENGTH)
        });
      }

    }

    var payload = {
      tone: tone || "natural",
      custom_tone: customTone,
      reply_intent: replyIntent,
      records: cleaned.slice(-MAX_RECORDS)
    };

    return payload;
  }

  function isLocalBackendUrl(endpoint) {
    try {
      var parsed = new URL(endpoint);
      return parsed.protocol === "http:"
        && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
        && parsed.port === "8765";
    } catch (error) {
      return false;
    }
  }

  function normalizeDrafts(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.slice(0, 3).map(function mapDraft(draft) {
      return {
        tone: normalizeText(draft && draft.tone) || "稳妥",
        text: normalizeText(draft && draft.text)
      };
    }).filter(function hasText(draft) {
      return Boolean(draft.text);
    });
  }

  async function requestReplyDrafts(transcriptResult, options) {
    var safeOptions = options || {};
    var endpoint = safeOptions.endpoint || DEFAULT_ENDPOINT;
    var fetchImpl = safeOptions.fetchImpl || globalObject.fetch;
    var payload = buildReplyDraftPayload(transcriptResult, safeOptions);
    var response;
    var responseBody;

    if (!isLocalBackendUrl(endpoint)) {
      throw new ReplyDraftClientError("local_backend_only", "只允许请求本地后端。");
    }

    if (!payload.records.length) {
      throw new ReplyDraftClientError("empty_context", "当前会话不足，先等待 HR 消息或重新识别。");
    }

    if (typeof fetchImpl !== "function") {
      throw new ReplyDraftClientError("fetch_unavailable", "当前浏览器不支持请求本地服务。");
    }

    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      responseBody = await response.json();
    } catch (error) {
      throw new ReplyDraftClientError("backend_unavailable", "本地服务未启动或不可用。");
    }

    if (!response.ok && !(responseBody && responseBody.error)) {
      throw new ReplyDraftClientError("backend_unavailable", "本地服务未启动或不可用。");
    }

    if (responseBody && responseBody.error) {
      throw new ReplyDraftClientError(responseBody.error, responseBody.message || responseBody.error);
    }

    return {
      drafts: normalizeDrafts(responseBody && responseBody.drafts),
      model: normalizeText(responseBody && responseBody.model)
    };
  }

  async function copyDraftText(text, options) {
    var normalized = normalizeText(text);
    var clipboard = options && Object.prototype.hasOwnProperty.call(options, "clipboard")
      ? options.clipboard
      : (globalObject.navigator && globalObject.navigator.clipboard);

    if (!normalized) {
      throw new ReplyDraftClientError("empty_copy_text", "没有可复制的草稿文本。");
    }

    if (!clipboard || typeof clipboard.writeText !== "function") {
      throw new ReplyDraftClientError("clipboard_unavailable", "复制失败，请手动选中文字复制。");
    }

    try {
      await clipboard.writeText(normalized);
    } catch (error) {
      throw new ReplyDraftClientError("clipboard_failed", "复制失败，请手动选中文字复制。");
    }

    return { ok: true };
  }

  var api = {
    DEFAULT_ENDPOINT: DEFAULT_ENDPOINT,
    ReplyDraftClientError: ReplyDraftClientError,
    normalizeText: normalizeText,
    buildReplyDraftPayload: buildReplyDraftPayload,
    isLocalBackendUrl: isLocalBackendUrl,
    requestReplyDrafts: requestReplyDrafts,
    copyDraftText: copyDraftText
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalObject.BossChatListener = Object.assign(
    {},
    globalObject.BossChatListener || {},
    { replyDraftClient: api }
  );
})(typeof globalThis !== "undefined" ? globalThis : window);
