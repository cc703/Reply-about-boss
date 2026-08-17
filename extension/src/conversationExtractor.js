(function attachConversationExtractor(globalObject) {
  "use strict";

  var STATUS = {
    FOUND: "found",
    UNCERTAIN: "uncertain",
    EMPTY: "empty"
  };

  var TEXT_LIMIT = 600;

  var ACTION_EXACT_TEXT = new Set([
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
    "交换微信",
    "换一个",
    "收藏",
    "举报"
  ]);

  var TIME_PATTERNS = [
    /^\d{1,2}:\d{2}$/,
    /^\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}$/,
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/,
    /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\s+\d{1,2}:\d{2}$/,
    /^(今天|昨天|前天)\s*\d{1,2}:\d{2}$/,
    /^星期[一二三四五六日天]\s*\d{1,2}:\d{2}$/
  ];

  var RECEIPT_TEXT = new Set(["已读", "未读", "送达"]);

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
    /\bpk\b/i,
    /deliver/i,
    /resume-card/i
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

  var PLATFORM_CARD_PATTERNS = [
    /^共\s*\d+\s*人投递/,
    /你与该职位竞争者PK情况/,
    /优秀竞争者/,
    /查看详细分析/,
    /竞争者/,
    /职位.*详情/,
    /招聘.*职位/,
    /BOSS直聘/
  ];

  var NON_CHAT_CONTAINER_PATTERNS = [
    /\bbcl-/i,
    /#bcl-panel/i,
    /\bbcl-panel\b/i,
    /assistant/i,
    /helper/i,
    /plugin/i,
    /extension/i,
    /footer/i,
    /copyright/i
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

  function hasClassSignal(classText, patterns) {
    return includesAnyPattern(classText || "", patterns);
  }

  function isTimeText(text) {
    return includesAnyPattern(text, TIME_PATTERNS);
  }

  function isReceiptText(text) {
    return RECEIPT_TEXT.has(text);
  }

  function getClassText(element) {
    var parts = [];
    var cursor = element;
    var depth = 0;

    while (cursor && depth < 5) {
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

    return element.querySelectorAll("button,a,input,textarea,select,[role='button']").length > 0;
  }

  function queryAll(scope, selector) {
    if (!scope || typeof scope.querySelectorAll !== "function") {
      return [];
    }

    try {
      return Array.prototype.slice.call(scope.querySelectorAll(selector));
    } catch (error) {
      return [];
    }
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
    var tagName = element && element.tagName ? element.tagName.toLowerCase() : "";

    return {
      element: element,
      index: index,
      text: text,
      classText: getClassText(element),
      side: getHorizontalSide(element),
      tagName: tagName,
      roleAttribute: element && typeof element.getAttribute === "function"
        ? normalizeText(element.getAttribute("role"))
        : "",
      visible: isVisibleElement(element),
      interactiveNoise: containsInteractiveNoise(element),
      hasSameTextDescendant: hasSameTextDescendant(element, text)
    };
  }

  function countTextLikeDescendants(element) {
    return queryAll(element, "div,span,p,section,li,button,a").filter(function hasText(node) {
      return normalizeText(node && node.textContent).length > 0;
    }).length;
  }

  function scoreChatContainer(element) {
    var classText = getClassText(element);
    var text = normalizeText(element && element.textContent);
    var descendants;
    var score = 0;
    var messageLike = 0;
    var sideLike = 0;
    var systemLike = 0;

    if (!text || !isVisibleElement(element)) {
      return -100;
    }

    if (hasClassSignal(classText, NON_CHAT_CONTAINER_PATTERNS)) {
      return -100;
    }

    descendants = queryAll(element, "div,span,p,section,li,button,a");
    for (var i = 0; i < descendants.length; i += 1) {
      var nodeClassText = getClassText(descendants[i]);
      var nodeText = normalizeText(descendants[i].textContent);

      if (!nodeText) {
        continue;
      }
      if (hasClassSignal(nodeClassText, MESSAGE_CLASS_PATTERNS)) {
        messageLike += 1;
      }
      if (hasClassSignal(nodeClassText, SELF_CLASS_PATTERNS) || hasClassSignal(nodeClassText, HR_CLASS_PATTERNS)) {
        sideLike += 1;
      }
      if (isTimeText(nodeText) || isReceiptText(nodeText)) {
        systemLike += 1;
      }
    }

    score += Math.min(messageLike, 12) * 5;
    score += Math.min(sideLike, 12) * 3;
    score += Math.min(systemLike, 6) * 2;

    if (/chat|message|dialog|conversation|im|talk/i.test(classText)) {
      score += 4;
    }

    if (hasClassSignal(classText, CARD_CLASS_PATTERNS) || hasClassSignal(classText, ACTION_CLASS_PATTERNS)) {
      score -= 8;
    }

    if (countTextLikeDescendants(element) > 180) {
      score -= 8;
    }

    return score;
  }

  function findLikelyChatContainer(scope) {
    var containers = queryAll(scope, "main,section,div,ul,ol");
    var best = null;

    for (var i = 0; i < containers.length; i += 1) {
      var score = scoreChatContainer(containers[i]);
      var textCount = countTextLikeDescendants(containers[i]);

      if (score < 14) {
        continue;
      }

      if (!best || score > best.score || (score === best.score && textCount < best.textCount)) {
        best = {
          element: containers[i],
          score: score,
          textCount: textCount
        };
      }
    }

    return best ? best.element : scope;
  }

  function collectCandidatesFromDom(root) {
    var scope = root || document;
    var chatScope;
    if (!scope || typeof scope.querySelectorAll !== "function") {
      return [];
    }

    chatScope = findLikelyChatContainer(scope);

    var elements = chatScope.querySelectorAll("div,span,p,section,li,button,a");
    var candidates = [];

    for (var i = 0; i < elements.length; i += 1) {
      candidates.push(toDomCandidate(elements[i], i));
    }

    return candidates;
  }

  function confidenceFromScore(score) {
    if (score >= 7) {
      return "high";
    }
    if (score >= 4) {
      return "medium";
    }
    return "low";
  }

  function classifyCandidate(rawCandidate) {
    var candidate = rawCandidate || {};
    var text = normalizeText(candidate.text);
    var classText = candidate.classText || "";
    var side = candidate.side || "unknown";
    var tagName = candidate.tagName || "";
    var roleAttribute = candidate.roleAttribute || "";
    var reasons = [];
    var score = 0;
    var hasMessageClass = hasClassSignal(classText, MESSAGE_CLASS_PATTERNS);
    var hasSelfClass = hasClassSignal(classText, SELF_CLASS_PATTERNS);
    var hasHrClass = hasClassSignal(classText, HR_CLASS_PATTERNS);
    var hasActionClass = hasClassSignal(classText, ACTION_CLASS_PATTERNS);
    var hasCardClass = hasClassSignal(classText, CARD_CLASS_PATTERNS);

    if (!text || text.length > TEXT_LIMIT) {
      return { ignored: true, role: "unknown", sourceType: "unknown", reasons: ["empty-or-too-long"], score: -100 };
    }

    if (candidate.visible === false) {
      return { ignored: true, role: "unknown", sourceType: "unknown", reasons: ["hidden"], score: -100 };
    }

    if (/\bbcl-|#bcl-panel|\bbcl-panel\b/.test(classText)) {
      return { ignored: true, role: "unknown", sourceType: "panel", reasons: ["extension-ui"], score: -100 };
    }

    if (candidate.hasSameTextDescendant) {
      return { ignored: true, role: "unknown", sourceType: "unknown", reasons: ["ancestor-duplicate"], score: -100 };
    }

    if (isTimeText(text)) {
      return {
        role: "system",
        sourceType: "time",
        confidence: "high",
        score: 10,
        reasons: ["time-text"]
      };
    }

    if (isReceiptText(text)) {
      return {
        role: "system",
        sourceType: "receipt",
        confidence: "high",
        score: 10,
        reasons: ["receipt-text"]
      };
    }

    if (ACTION_EXACT_TEXT.has(text) || tagName === "button" || tagName === "a" || roleAttribute === "button") {
      return {
        role: "control",
        sourceType: "action",
        confidence: "high",
        score: 10,
        reasons: ["action-control"]
      };
    }

    if (includesAnyPattern(text, PLATFORM_CARD_PATTERNS) || hasCardClass) {
      return {
        role: "control",
        sourceType: "card",
        confidence: "high",
        score: 8,
        reasons: ["platform-card"]
      };
    }

    if (candidate.interactiveNoise && !hasMessageClass) {
      return {
        role: "control",
        sourceType: "action",
        confidence: "medium",
        score: 5,
        reasons: ["interactive-container"]
      };
    }

    if (hasSelfClass) {
      score += 5;
      reasons.push("self-class-signal");
    }
    if (side === "right") {
      score += 3;
      reasons.push("right-side");
    }
    if (hasHrClass) {
      score += 5;
      reasons.push("hr-class-signal");
    }
    if (side === "left") {
      score += 3;
      reasons.push("left-side");
    }
    if (hasMessageClass) {
      score += 2;
      reasons.push("message-class-signal");
    }
    if (/[\u4e00-\u9fa5A-Za-z]/.test(text)) {
      score += 1;
      reasons.push("text-bearing");
    }
    if (hasActionClass) {
      score -= 4;
      reasons.push("action-class-signal");
    }

    if ((hasSelfClass || side === "right") && hasMessageClass && !hasHrClass) {
      return {
        role: "self",
        sourceType: "message",
        confidence: confidenceFromScore(score),
        score: score,
        reasons: reasons
      };
    }

    if ((hasHrClass || side === "left") && hasMessageClass && !hasSelfClass) {
      return {
        role: "hr",
        sourceType: "message",
        confidence: confidenceFromScore(score),
        score: score,
        reasons: reasons
      };
    }

    return {
      role: "unknown",
      sourceType: "unknown",
      confidence: "low",
      score: score,
      reasons: reasons.length ? reasons : ["low-signal"]
    };
  }

  function toRecord(candidate, classified, order) {
    return {
      id: "record-" + order,
      role: classified.role,
      sourceType: classified.sourceType,
      text: normalizeText(candidate.text),
      confidence: classified.confidence || "low",
      order: order,
      index: Number.isFinite(candidate.index) ? candidate.index : order,
      debug: {
        score: classified.score || 0,
        reasons: classified.reasons || []
      }
    };
  }

  function buildResult(records, scanned) {
    var conversationRecords = records.filter(function keepConversationRecord(record) {
      return record.role === "hr" || record.role === "self" || record.role === "system";
    });
    var contextRecords = conversationRecords.filter(function keepContextRecord(record) {
      return record.role === "hr" || record.role === "self";
    });
    var unknownRecords = records.filter(function countUnknown(record) {
      return record.role === "unknown";
    });
    var controlRecords = records.filter(function countControl(record) {
      return record.role === "control";
    });
    var status = STATUS.EMPTY;

    if (contextRecords.length > 0) {
      status = STATUS.FOUND;
    } else if (unknownRecords.length > 0) {
      status = STATUS.UNCERTAIN;
    }

    return {
      status: status,
      confidence: status === STATUS.FOUND ? "high" : (status === STATUS.UNCERTAIN ? "low" : "none"),
      records: records,
      conversationRecords: conversationRecords,
      contextRecords: contextRecords,
      candidatesScanned: scanned || 0,
      matchedCandidates: records.length,
      controlCandidates: controlRecords.length,
      unknownCandidates: unknownRecords.length
    };
  }

  function extractConversationTranscriptFromCandidates(rawCandidates) {
    var candidates = Array.isArray(rawCandidates) ? rawCandidates : [];
    var sorted = candidates.slice().sort(function byIndex(a, b) {
      var left = Number.isFinite(a && a.index) ? a.index : 0;
      var right = Number.isFinite(b && b.index) ? b.index : 0;
      return left - right;
    });
    var records = [];

    for (var i = 0; i < sorted.length; i += 1) {
      var candidate = Object.assign({}, sorted[i], {
        text: normalizeText(sorted[i] && sorted[i].text),
        index: Number.isFinite(sorted[i] && sorted[i].index) ? sorted[i].index : i
      });
      var classified = classifyCandidate(candidate);

      if (!classified.ignored) {
        records.push(toRecord(candidate, classified, records.length + 1));
      }
    }

    return buildResult(records, candidates.length);
  }

  function extractConversationTranscript(root) {
    return extractConversationTranscriptFromCandidates(collectCandidatesFromDom(root));
  }

  var api = {
    STATUS: STATUS,
    normalizeText: normalizeText,
    collectCandidatesFromDom: collectCandidatesFromDom,
    findLikelyChatContainer: findLikelyChatContainer,
    classifyCandidate: classifyCandidate,
    extractConversationTranscriptFromCandidates: extractConversationTranscriptFromCandidates,
    extractConversationTranscript: extractConversationTranscript
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalObject.BossChatListener = Object.assign(
    {},
    globalObject.BossChatListener || {},
    { conversationExtractor: api }
  );
})(typeof globalThis !== "undefined" ? globalThis : window);
