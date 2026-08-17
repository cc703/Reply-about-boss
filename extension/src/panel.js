(function attachPanel(globalObject) {
  "use strict";

  var PANEL_ID = "bcl-panel";

  function formatTime(date) {
    return date.toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function getStatusText(status) {
    if (status === "found") {
      return "识别成功";
    }
    if (status === "uncertain") {
      return "识别不确定";
    }
    return "未识别到聊天消息";
  }

  function getStatusClass(status) {
    if (status === "found") {
      return "bcl-status-ok";
    }
    if (status === "uncertain") {
      return "bcl-status-warn";
    }
    return "bcl-status-empty";
  }

  function getRoleText(role) {
    if (role === "hr") {
      return "HR";
    }
    if (role === "self") {
      return "我";
    }
    if (role === "system") {
      return "系统";
    }
    return "未知";
  }

  function getRenderableRecords(result) {
    if (Array.isArray(result && result.conversationRecords)) {
      return result.conversationRecords.filter(function keepVisibleRecord(record) {
        return record
          && (record.role === "hr" || record.role === "self" || record.role === "system")
          && record.text;
      });
    }

    if (result && result.message) {
      return [{
        role: "hr",
        text: result.message,
        confidence: result.confidence || "medium"
      }];
    }

    return [];
  }

  function renderRecords(container, records) {
    container.textContent = "";

    if (!records.length) {
      var empty = document.createElement("div");
      empty.className = "bcl-record-empty";
      empty.textContent = "暂未识别到当前会话记录。";
      container.appendChild(empty);
      return;
    }

    records.slice(-8).forEach(function appendRecord(record) {
      var row = document.createElement("div");
      var role = document.createElement("span");
      var text = document.createElement("span");

      row.className = "bcl-record-row bcl-record-" + (record.role || "unknown");
      role.className = "bcl-record-role";
      role.textContent = getRoleText(record.role);
      text.className = "bcl-record-text";
      text.textContent = record.text;

      row.appendChild(role);
      row.appendChild(text);
      container.appendChild(row);
    });
  }

  function renderDraftState(panel, state) {
    var safeState = state || {};
    var button = panel.querySelector(".bcl-draft-button");
    var status = panel.querySelector(".bcl-draft-status");
    var list = panel.querySelector(".bcl-draft-list");
    var drafts = Array.isArray(safeState.drafts) ? safeState.drafts : [];

    if (!button || !status || !list) {
      return;
    }

    list.textContent = "";
    button.disabled = safeState.status === "loading";

    if (safeState.status === "loading") {
      status.textContent = "正在生成...";
      return;
    }

    if (safeState.status === "success") {
      status.textContent = drafts.length
        ? "草稿仅供你手动判断使用"
        : "没有生成可用草稿。";

      drafts.forEach(function appendDraft(draft) {
        var item = document.createElement("div");
        var tone = document.createElement("div");
        var text = document.createElement("div");
        var copyButton = document.createElement("button");

        item.className = "bcl-draft-item";
        item.setAttribute("data-draft-index", String(list.children.length));
        tone.className = "bcl-draft-tone";
        tone.textContent = draft.tone || "稳妥";
        text.className = "bcl-draft-text";
        text.textContent = draft.text || "";
        copyButton.type = "button";
        copyButton.className = "bcl-copy-draft";
        copyButton.textContent = "复制";

        item.appendChild(tone);
        item.appendChild(text);
        item.appendChild(copyButton);
        list.appendChild(item);
      });
      return;
    }

    if (safeState.status === "error") {
      status.textContent = safeState.message || "本地服务未启动或不可用。";
      return;
    }

    status.textContent = "点击后由本地服务生成回复草稿。";
  }

  function renderCopyState(panel, draftItem, state) {
    var safeState = state || {};
    var targetItem = draftItem;
    var button = targetItem && targetItem.querySelector
      ? targetItem.querySelector(".bcl-copy-draft")
      : null;
    var status = panel.querySelector(".bcl-draft-status");

    if (!button || !status) {
      return;
    }

    if (safeState.status === "success") {
      button.textContent = "已复制";
      status.textContent = "已复制到剪贴板，请自行粘贴发送。";
      return;
    }

    if (safeState.status === "error") {
      button.textContent = "复制";
      status.textContent = safeState.message || "复制失败，请手动选中文字复制。";
      return;
    }

    button.textContent = "复制中...";
    status.textContent = "正在复制...";
  }

  function getDraftTonePreference(panel) {
    var intentSelect = panel && panel.querySelector
      ? panel.querySelector(".bcl-intent-select")
      : null;
    var toneSelect = panel && panel.querySelector
      ? panel.querySelector(".bcl-tone-select")
      : null;
    var customToneInput = panel && panel.querySelector
      ? panel.querySelector(".bcl-custom-tone")
      : null;
    var tone = toneSelect && toneSelect.value ? toneSelect.value : "natural";
    var allowedTones = ["natural", "concise", "cautious", "positive", "custom"];
    var replyIntent = intentSelect && intentSelect.value ? intentSelect.value : "auto";
    var allowedReplyIntents = ["auto", "continue", "decline", "close"];
    var customTone = customToneInput && customToneInput.value
      ? String(customToneInput.value).replace(/\s+/g, " ").trim().slice(0, 80)
      : "";

    if (allowedTones.indexOf(tone) === -1) {
      tone = "natural";
    }
    if (allowedReplyIntents.indexOf(replyIntent) === -1) {
      replyIntent = "auto";
    }

    return {
      tone: tone,
      customTone: tone === "custom" ? customTone : "",
      replyIntent: replyIntent
    };
  }

  function clampPanelPosition(position, panelSize, viewportSize, margin) {
    var safeMargin = Number.isFinite(margin) ? Math.max(0, margin) : 8;
    var panelWidth = Math.max(0, Number(panelSize && panelSize.width) || 0);
    var panelHeight = Math.max(0, Number(panelSize && panelSize.height) || 0);
    var viewportWidth = Math.max(0, Number(viewportSize && viewportSize.width) || 0);
    var viewportHeight = Math.max(0, Number(viewportSize && viewportSize.height) || 0);
    var maxLeft = Math.max(safeMargin, viewportWidth - panelWidth - safeMargin);
    var maxTop = Math.max(safeMargin, viewportHeight - panelHeight - safeMargin);
    var left = Number(position && position.left) || 0;
    var top = Number(position && position.top) || 0;

    return {
      left: Math.min(Math.max(left, safeMargin), maxLeft),
      top: Math.min(Math.max(top, safeMargin), maxTop)
    };
  }

  function makePanelDraggable(panel, runtimeOverride) {
    var runtime = runtimeOverride || globalObject;
    var header = panel && panel.querySelector
      ? panel.querySelector(".bcl-header")
      : null;
    var dragState = null;
    var interactiveSelector = "button, input, select, textarea, a, [role='button']";

    if (!panel || !header || (panel.dataset && panel.dataset.bclDraggable === "true")) {
      return;
    }

    if (panel.dataset) {
      panel.dataset.bclDraggable = "true";
    }

    function getViewportSize() {
      var documentElement = runtime.document && runtime.document.documentElement;
      return {
        width: Number(runtime.innerWidth)
          || Number(documentElement && documentElement.clientWidth)
          || 0,
        height: Number(runtime.innerHeight)
          || Number(documentElement && documentElement.clientHeight)
          || 0
      };
    }

    function setPanelPosition(position) {
      panel.style.left = Math.round(position.left) + "px";
      panel.style.top = Math.round(position.top) + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }

    function constrainDraggedPanel() {
      var rect;
      var position;

      if (!panel.dataset || panel.dataset.bclDragged !== "true") {
        return;
      }

      rect = panel.getBoundingClientRect();
      position = clampPanelPosition(
        { left: rect.left, top: rect.top },
        { width: rect.width, height: rect.height },
        getViewportSize(),
        8
      );
      setPanelPosition(position);
    }

    function finishDrag(event) {
      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      if (typeof header.hasPointerCapture === "function"
          && header.hasPointerCapture(event.pointerId)
          && typeof header.releasePointerCapture === "function") {
        header.releasePointerCapture(event.pointerId);
      }

      dragState = null;
      panel.classList.remove("bcl-panel-dragging");
    }

    header.addEventListener("pointerdown", function onPointerDown(event) {
      var interactiveTarget = event.target && event.target.closest
        ? event.target.closest(interactiveSelector)
        : null;
      var rect;

      if ((typeof event.button === "number" && event.button !== 0) || interactiveTarget) {
        return;
      }

      rect = panel.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: rect.left,
        startTop: rect.top,
        width: rect.width,
        height: rect.height
      };

      setPanelPosition({ left: rect.left, top: rect.top });
      panel.classList.add("bcl-panel-dragging");
      if (typeof header.setPointerCapture === "function") {
        header.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
    });

    header.addEventListener("pointermove", function onPointerMove(event) {
      var position;

      if (!dragState || event.pointerId !== dragState.pointerId) {
        return;
      }

      position = clampPanelPosition(
        {
          left: dragState.startLeft + event.clientX - dragState.startX,
          top: dragState.startTop + event.clientY - dragState.startY
        },
        { width: dragState.width, height: dragState.height },
        getViewportSize(),
        8
      );
      setPanelPosition(position);
      if (panel.dataset) {
        panel.dataset.bclDragged = "true";
      }
      event.preventDefault();
    });

    header.addEventListener("pointerup", finishDrag);
    header.addEventListener("pointercancel", finishDrag);

    if (runtime && typeof runtime.addEventListener === "function") {
      runtime.addEventListener("resize", constrainDraggedPanel);
    }
  }

  function createPanel() {
    var existing = document.getElementById(PANEL_ID);
    if (existing) {
      return existing;
    }

    var panel = document.createElement("aside");
    panel.id = PANEL_ID;
    panel.className = "bcl-panel";
    panel.innerHTML = [
      "<div class=\"bcl-header\" title=\"拖拽移动面板\">",
      "  <div>",
      "    <div class=\"bcl-title\">BOSS Chat Listener</div>",
      "    <div class=\"bcl-subtitle\">识别当前会话记录</div>",
      "  </div>",
      "  <button type=\"button\" class=\"bcl-collapse\" aria-label=\"折叠面板\">-</button>",
      "</div>",
      "<div class=\"bcl-body\">",
      "  <div class=\"bcl-status-row\">",
      "    <span class=\"bcl-status-dot\"></span>",
      "    <span class=\"bcl-status-text\">等待识别</span>",
      "  </div>",
      "  <div class=\"bcl-label\">当前会话记录</div>",
      "  <div class=\"bcl-record-list\">",
      "    <div class=\"bcl-record-empty\">打开 BOSS 聊天页后会自动显示。</div>",
      "  </div>",
      "  <div class=\"bcl-meta\">",
      "    <span class=\"bcl-time\">--:--:--</span>",
      "    <span class=\"bcl-debug\">candidate: 0 / record: 0</span>",
      "  </div>",
      "  <div class=\"bcl-draft-section\">",
      "    <div class=\"bcl-label\">回复草稿</div>",
      "    <label class=\"bcl-intent-label\" for=\"bcl-intent-select\">回复目的</label>",
      "    <select id=\"bcl-intent-select\" class=\"bcl-intent-select\">",
      "      <option value=\"auto\">自动判断</option>",
      "      <option value=\"continue\">继续了解</option>",
      "      <option value=\"decline\">婉拒岗位</option>",
      "      <option value=\"close\">礼貌结束</option>",
      "    </select>",
      "    <label class=\"bcl-tone-label\" for=\"bcl-tone-select\">回复语气</label>",
      "    <select id=\"bcl-tone-select\" class=\"bcl-tone-select\">",
      "      <option value=\"natural\">自然</option>",
      "      <option value=\"concise\">简洁直接</option>",
      "      <option value=\"cautious\">稳妥留余地</option>",
      "      <option value=\"positive\">积极一些</option>",
      "      <option value=\"custom\">自定义</option>",
      "    </select>",
      "    <input class=\"bcl-custom-tone\" type=\"text\" maxlength=\"80\" placeholder=\"例如：像平时聊天，短一点\" aria-label=\"自定义回复语气\" hidden />",
      "    <button type=\"button\" class=\"bcl-draft-button\">生成回复草稿</button>",
      "    <div class=\"bcl-draft-status\">点击后由本地服务生成回复草稿。</div>",
      "    <div class=\"bcl-draft-list\"></div>",
      "  </div>",
      "  <button type=\"button\" class=\"bcl-refresh\">重新识别</button>",
      "</div>"
    ].join("");

    document.documentElement.appendChild(panel);

    var collapseButton = panel.querySelector(".bcl-collapse");
    var toneSelect = panel.querySelector(".bcl-tone-select");
    var customToneInput = panel.querySelector(".bcl-custom-tone");

    makePanelDraggable(panel);

    function updateCustomToneVisibility() {
      var isCustom = toneSelect && toneSelect.value === "custom";
      if (customToneInput) {
        customToneInput.hidden = !isCustom;
      }
    }

    if (toneSelect) {
      toneSelect.addEventListener("change", updateCustomToneVisibility);
      updateCustomToneVisibility();
    }

    collapseButton.addEventListener("click", function toggleCollapse() {
      panel.classList.toggle("bcl-panel-collapsed");
      collapseButton.textContent = panel.classList.contains("bcl-panel-collapsed") ? "+" : "-";
      collapseButton.setAttribute(
        "aria-label",
        panel.classList.contains("bcl-panel-collapsed") ? "展开面板" : "折叠面板"
      );
    });

    return panel;
  }

  function renderPanel(panel, result) {
    var safeResult = result || {};
    var status = safeResult.status || "empty";
    var records = getRenderableRecords(safeResult);
    var now = new Date();
    var statusDot = panel.querySelector(".bcl-status-dot");
    var statusText = panel.querySelector(".bcl-status-text");

    statusDot.className = "bcl-status-dot " + getStatusClass(status);
    statusText.textContent = getStatusText(status);
    renderRecords(panel.querySelector(".bcl-record-list"), records);
    panel.querySelector(".bcl-time").textContent = formatTime(now);
    panel.querySelector(".bcl-debug").textContent = "会话: "
      + records.length
      + " / 忽略控件: "
      + (safeResult.controlCandidates || 0);
  }

  var api = {
    createPanel: createPanel,
    renderPanel: renderPanel,
    renderDraftState: renderDraftState,
    renderCopyState: renderCopyState,
    getDraftTonePreference: getDraftTonePreference,
    clampPanelPosition: clampPanelPosition,
    makePanelDraggable: makePanelDraggable
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalObject.BossChatListener = Object.assign(
    {},
    globalObject.BossChatListener || {},
    { panel: api }
  );
})(typeof globalThis !== "undefined" ? globalThis : window);
