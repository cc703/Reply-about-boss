(function attachMessageExtractor(globalObject) {
  "use strict";

  var STATUS = {
    FOUND: "found",
    UNCERTAIN: "uncertain",
    EMPTY: "empty"
  };

  var TEXT_LIMIT = 320;
  var HIGH_CONFIDENCE_SCORE = 7;
  var MIN_CANDIDATE_SCORE = 3;

  var IGNORE_EXACT_TEXT = new Set([
    "已读",
    "未读",
    "送达",
    "更多",
    "发送",
    "取消",
    "确定",
    "查看职位",
    "查看详情",
    "查看详细分析",
    "发简历",
    "发送简历",
    "投递简历",
    "上传简历",
    "完善简历",
    "立即投递",
    "继续投递",
    "去投递",
    "立即沟通",
    "继续沟通",
    "换一个",
    "收藏",
    "举报"
  ]);

  var IGNORE_PATTERNS = [
    /^\d{1,2}:\d{2}$/,
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/,
    /^(今天|昨天|前天)\s*\d{1,2}:\d{2}$/,
    /^星期[一二三四五六日天]\s*\d{1,2}:\d{2}$/,
    /^共\s*\d+\s*人投递/,
    /你与该职位竞争者PK情况/,
    /优秀竞争者/,
    /查看详细分析/,
    /竞争者/,
    /职位.*详情/,
    /招聘.*职位/,
    /BOSS直聘/
  ];

  var SELF_CLASS_PATTERNS = [
    /\bself\b/i,
    /\bmine\b/i,
    /\bmyself\b/i,
    /\bright\b/i,
    /\bme\b/i,
    /item-myself/i,
    /message-my/i,
    /chat-my/i,
    /msg-me/i,
    /user-sent/i
  ];

  var HR_CLASS_PATTERNS = [
    /\bleft\b/i,
    /\bfriend\b/i,
    /\bother\b/i,
    /\brecruiter\b/i,
    /\bopposite\b/i,
    /item-friend/i,
    /message-other/i,
    /chat-other/i,
    /msg-other/i,
    /hr/i
  ];

  var MESSAGE_CLASS_PATTERNS = [
    /message/i,
    /\bmsg\b/i,
    /chat-message/i,
    /chat-bubble/i,
    /chat-item/i,
    /bubble/i
  ];

  var CARD_CLASS_PATTERNS = [
    /card/i,
    /job/i,
    /position/i,
    /recommend/i,
    /analysis/i,
    /pk/i,
    /button/i,
    /menu/i
  ];

  var ACTION_CLASS_PATTERNS = [
    /action/i,
    /operation/i,
    /operate/i,
    /toolbar/i,
    /footer/i,
    /button/i,
    /\bbtn\b/i,
    /menu/i,
    /resume/i
  ];

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includesAnyPattern(value, patterns) {
    return patterns.some(function testPattern(pattern) {
      return pattern.test(value);
    });
  }

  function isIgnoredText(text) {
    var normalized = normalizeText(text);

    if (!normalized || normalized.length < 2 || normalized.length > TEXT_LIMIT) {
      return true;
    }

    if (IGNORE_EXACT_TEXT.has(normalized)) {
      return true;
    }

    return includesAnyPattern(normalized, IGNORE_PATTERNS);
  }

  function hasClassSignal(classText, patterns) {
    return includesAnyPattern(classText || "", patterns);
  }

  function getClassText(element) {
    var parts = [];
    var cursor = element;
    var depth = 0;

    while (cursor && depth < 4) {
      if (cursor.className && typeof cursor.className === "string") {
        parts.push(cursor.className);
      }
      if (cursor.id) {
        parts.push("#" + cursor.id);
      }
      cursor = cursor.parentElement;
      depth += 1;
    }

    return parts.join(" ");
  }

  function isVisibleElement(element) {
    if (!element || element.nodeType !== 1) {
      return false;
    }

    var ownerWindow = element.ownerDocument && element.ownerDocument.defaultView;
    var computedStyle = ownerWindow && ownerWindow.getComputedStyle
      ? ownerWindow.getComputedStyle(element)
      : null;

    if (computedStyle) {
      if (computedStyle.display === "none" || computedStyle.visibility === "hidden") {
        return false;
      }
      if (Number(computedStyle.opacity) === 0) {
        return false;
      }
    }

    if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) {
      return false;
    }

    return true;
  }

  function getHorizontalSide(element) {
    if (!element || typeof element.getBoundingClientRect !== "function") {
      return "unknown";
    }

    var rect = element.getBoundingClientRect();
    var documentElement = element.ownerDocument && element.ownerDocument.documentElement;
    var width = documentElement && documentElement.clientWidth
      ? documentElement.clientWidth
      : 0;

    if (!width || !rect.width) {
      return "unknown";
    }

    var center = rect.left + rect.width / 2;
    if (center < width * 0.45) {
      return "left";
    }
    if (center > width * 0.55) {
      return "right";
    }
    return "center";
  }

  function containsInteractiveNoise(element) {
    if (!element || typeof element.querySelectorAll !== "function") {
      return false;
    }

    var interactiveCount = element.querySelectorAll("button,a,input,textarea,select,[role='button']").length;
    return interactiveCount > 0;
  }

  function hasSameTextDescendant(element, text) {
    if (!element || typeof element.querySelectorAll !== "function") {
      return false;
    }

    var descendants = element.querySelectorAll("*");
    for (var i = 0; i < descendants.length; i += 1) {
      if (normalizeText(descendants[i].textContent) === text) {
        return true;
      }
    }
    return false;
  }

  function toDomCandidate(element, index) {
    var text = normalizeText(element && element.textContent);
    var classText = getClassText(element);
    var side = getHorizontalSide(element);
    var tagName = element && element.tagName ? element.tagName.toLowerCase() : "";

    return {
      element: element,
      index: index,
      text: text,
      classText: classText,
      side: side,
      tagName: tagName,
      visible: isVisibleElement(element),
      interactiveNoise: containsInteractiveNoise(element),
      hasSameTextDescendant: hasSameTextDescendant(element, text)
    };
  }

  function collectCandidatesFromDom(root) {
    var scope = root || document;
    if (!scope || typeof scope.querySelectorAll !== "function") {
      return [];
    }

    var elements = scope.querySelectorAll("div,span,p,section,li");
    var candidates = [];

    for (var i = 0; i < elements.length; i += 1) {
      candidates.push(toDomCandidate(elements[i], i));
    }

    return candidates;
  }

  function scoreCandidate(candidate) {
    var text = normalizeText(candidate && candidate.text);
    var classText = candidate && candidate.classText ? candidate.classText : "";
    var side = candidate && candidate.side ? candidate.side : "unknown";
    var tagName = candidate && candidate.tagName ? candidate.tagName : "";
    var score = 0;
    var reasons = [];

    if (isIgnoredText(text)) {
      return { score: -100, reasons: ["ignored-text"], rejected: true };
    }

    if (candidate.visible === false) {
      return { score: -100, reasons: ["hidden"], rejected: true };
    }

    if (/\bbcl-|#bcl-panel|\bbcl-panel\b/.test(classText)) {
      return { score: -100, reasons: ["extension-ui"], rejected: true };
    }

    if (candidate.hasSameTextDescendant) {
      return { score: -100, reasons: ["ancestor-duplicate"], rejected: true };
    }

    if (tagName === "button" || candidate.interactiveNoise) {
      score -= 3;
      reasons.push("interactive-noise");
    }

    if (hasClassSignal(classText, ACTION_CLASS_PATTERNS)) {
      score -= 6;
      reasons.push("action-class-signal");
    }

    if (hasClassSignal(classText, SELF_CLASS_PATTERNS) || side === "right") {
      score -= 8;
      reasons.push("self-side-signal");
    }

    if (hasClassSignal(classText, HR_CLASS_PATTERNS)) {
      score += 5;
      reasons.push("hr-class-signal");
    }

    if (side === "left") {
      score += 3;
      reasons.push("left-side");
    }

    if (hasClassSignal(classText, MESSAGE_CLASS_PATTERNS)) {
      score += 2;
      reasons.push("message-class-signal");
    }

    if (!hasClassSignal(classText, CARD_CLASS_PATTERNS)) {
      score += 1;
      reasons.push("not-card-like");
    } else {
      score -= 2;
      reasons.push("card-like");
    }

    if (/[\u4e00-\u9fa5A-Za-z]/.test(text) && text.length <= 160) {
      score += 1;
      reasons.push("conversational-length");
    }

    return {
      score: score,
      reasons: reasons,
      rejected: score < MIN_CANDIDATE_SCORE
    };
  }

  function buildResult(status, message, extra) {
    return Object.assign({
      status: status,
      message: message || "",
      confidence: status === STATUS.FOUND ? "high" : "none",
      score: 0,
      candidatesScanned: 0,
      matchedCandidates: 0,
      reasons: []
    }, extra || {});
  }

  function getTranscriptExtractor() {
    var namespace = globalObject.BossChatListener || {};
    return namespace.conversationExtractor || null;
  }

  function extractLatestHrMessageFromTranscript(transcript) {
    var sourceRecords = [];

    if (!transcript || typeof transcript !== "object") {
      return null;
    }

    if (Array.isArray(transcript.contextRecords)) {
      sourceRecords = transcript.contextRecords;
    } else if (Array.isArray(transcript.conversationRecords)) {
      sourceRecords = transcript.conversationRecords;
    } else if (Array.isArray(transcript.records)) {
      sourceRecords = transcript.records;
    }

    var hrRecords = sourceRecords.filter(function keepHrRecord(record) {
      return record
        && record.role === "hr"
        && record.sourceType === "message"
        && normalizeText(record.text);
    });

    if (hrRecords.length === 0) {
      return buildResult(STATUS.EMPTY, "", {
        candidatesScanned: transcript.candidatesScanned || 0,
        matchedCandidates: transcript.matchedCandidates || 0
      });
    }

    hrRecords.sort(function byOrderThenIndex(a, b) {
      var leftOrder = Number.isFinite(a.order) ? a.order : 0;
      var rightOrder = Number.isFinite(b.order) ? b.order : 0;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      var leftIndex = Number.isFinite(a.index) ? a.index : 0;
      var rightIndex = Number.isFinite(b.index) ? b.index : 0;
      return leftIndex - rightIndex;
    });

    var selected = hrRecords[hrRecords.length - 1];
    var score = selected.debug && Number.isFinite(selected.debug.score)
      ? selected.debug.score
      : 0;
    var reasons = selected.debug && Array.isArray(selected.debug.reasons)
      ? selected.debug.reasons
      : [];

    return buildResult(STATUS.FOUND, selected.text, {
      confidence: selected.confidence || "high",
      score: score,
      candidatesScanned: transcript.candidatesScanned || 0,
      matchedCandidates: transcript.matchedCandidates || sourceRecords.length,
      reasons: reasons,
      index: Number.isFinite(selected.index) ? selected.index : selected.order
    });
  }

  function extractLatestHrMessageFromCandidates(rawCandidates) {
    var candidates = Array.isArray(rawCandidates) ? rawCandidates : [];
    var matched = [];

    for (var i = 0; i < candidates.length; i += 1) {
      var candidate = Object.assign({}, candidates[i], {
        text: normalizeText(candidates[i] && candidates[i].text),
        index: Number.isFinite(candidates[i] && candidates[i].index) ? candidates[i].index : i
      });
      var scored = scoreCandidate(candidate);

      if (!scored.rejected) {
        matched.push(Object.assign({}, candidate, scored));
      }
    }

    if (matched.length === 0) {
      return buildResult(STATUS.EMPTY, "", {
        candidatesScanned: candidates.length
      });
    }

    var selectionPool = matched.filter(function highConfidenceOnly(candidate) {
      return candidate.score >= HIGH_CONFIDENCE_SCORE;
    });

    if (selectionPool.length === 0) {
      selectionPool = matched;
    }

    selectionPool.sort(function byDomOrderThenScore(a, b) {
      if (a.index !== b.index) {
        return a.index - b.index;
      }
      return a.score - b.score;
    });

    var selected = selectionPool[selectionPool.length - 1];
    var highConfidence = selected.score >= HIGH_CONFIDENCE_SCORE;

    return buildResult(highConfidence ? STATUS.FOUND : STATUS.UNCERTAIN, selected.text, {
      confidence: highConfidence ? "high" : "medium",
      score: selected.score,
      candidatesScanned: candidates.length,
      matchedCandidates: matched.length,
      reasons: selected.reasons,
      index: selected.index
    });
  }

  function extractLatestHrMessage(root) {
    var transcriptExtractor = getTranscriptExtractor();

    if (transcriptExtractor && typeof transcriptExtractor.extractConversationTranscript === "function") {
      try {
        return extractLatestHrMessageFromTranscript(
          transcriptExtractor.extractConversationTranscript(root)
        );
      } catch (error) {
        // Fall back to the older candidate scanner if the transcript path cannot parse the page.
      }
    }

    return extractLatestHrMessageFromCandidates(collectCandidatesFromDom(root));
  }

  var api = {
    STATUS: STATUS,
    normalizeText: normalizeText,
    isIgnoredText: isIgnoredText,
    scoreCandidate: scoreCandidate,
    collectCandidatesFromDom: collectCandidatesFromDom,
    extractLatestHrMessageFromCandidates: extractLatestHrMessageFromCandidates,
    extractLatestHrMessageFromTranscript: extractLatestHrMessageFromTranscript,
    extractLatestHrMessage: extractLatestHrMessage
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalObject.BossChatListener = Object.assign(
    {},
    globalObject.BossChatListener || {},
    { messageExtractor: api }
  );
})(typeof globalThis !== "undefined" ? globalThis : window);
