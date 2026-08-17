(function startBossChatListener(globalObject) {
  "use strict";

  var namespace = globalObject.BossChatListener || {};
  var messageExtractor = namespace.messageExtractor;
  var conversationExtractor = namespace.conversationExtractor;
  var replyDraftClient = namespace.replyDraftClient;
  var panelApi = namespace.panel;
  var observer = null;
  var updateTimer = null;
  var panel = null;
  var latestTranscript = null;
  var draftInFlight = false;

  if ((!conversationExtractor && !messageExtractor) || !panelApi) {
    return;
  }

  if (globalObject.__bossChatListenerStarted) {
    return;
  }
  globalObject.__bossChatListenerStarted = true;

  function scheduleUpdate(delay) {
    globalObject.clearTimeout(updateTimer);
    updateTimer = globalObject.setTimeout(updatePanel, delay || 250);
  }

  function updatePanel() {
    if (!panel) {
      panel = panelApi.createPanel();
      var refreshButton = panel.querySelector(".bcl-refresh");
      var draftButton = panel.querySelector(".bcl-draft-button");
      refreshButton.addEventListener("click", function onRefreshClick() {
        scheduleUpdate(0);
      });
      if (draftButton) {
        draftButton.addEventListener("click", requestDrafts);
      }
      panel.addEventListener("click", onPanelClick);
    }

    var result = conversationExtractor
      ? conversationExtractor.extractConversationTranscript(document)
      : messageExtractor.extractLatestHrMessage(document);
    latestTranscript = result;
    panelApi.renderPanel(panel, result);
  }

  async function requestDrafts() {
    if (draftInFlight || !panel || !replyDraftClient) {
      return;
    }

    draftInFlight = true;
    panelApi.renderDraftState(panel, {
      status: "loading",
      message: "正在生成..."
    });

    try {
      var transcript = latestTranscript || (
        conversationExtractor
          ? conversationExtractor.extractConversationTranscript(document)
          : null
      );
      var toneOptions = typeof panelApi.getDraftTonePreference === "function"
        ? panelApi.getDraftTonePreference(panel)
        : undefined;
      var result = await replyDraftClient.requestReplyDrafts(transcript, toneOptions);
      panelApi.renderDraftState(panel, {
        status: "success",
        drafts: result.drafts,
        model: result.model
      });
    } catch (error) {
      panelApi.renderDraftState(panel, {
        status: "error",
        code: error && error.code,
        message: error && error.message ? error.message : "本地服务未启动或不可用。"
      });
    } finally {
      draftInFlight = false;
    }
  }

  async function onPanelClick(event) {
    var target = event.target;
    var copyButton = target && target.closest ? target.closest(".bcl-copy-draft") : null;
    var draftItem;
    var draftText;

    if (!copyButton || !panel || !replyDraftClient) {
      return;
    }

    draftItem = copyButton.closest(".bcl-draft-item");
    draftText = draftItem && draftItem.querySelector
      ? draftItem.querySelector(".bcl-draft-text")
      : null;

    panelApi.renderCopyState(panel, draftItem, { status: "loading" });

    try {
      await replyDraftClient.copyDraftText(draftText ? draftText.textContent : "");
      panelApi.renderCopyState(panel, draftItem, { status: "success" });
    } catch (error) {
      panelApi.renderCopyState(panel, draftItem, {
        status: "error",
        message: error && error.message ? error.message : "复制失败，请手动选中文字复制。"
      });
    }
  }

  function startObserver() {
    if (!document.body || observer) {
      return;
    }

    observer = new MutationObserver(function onMutation() {
      scheduleUpdate(350);
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function boot() {
    startObserver();
    scheduleUpdate(0);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  globalObject.addEventListener("focus", function onFocus() {
    scheduleUpdate(100);
  });

  document.addEventListener("visibilitychange", function onVisibilityChange() {
    if (!document.hidden) {
      scheduleUpdate(100);
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
