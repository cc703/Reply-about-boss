(function startSettingsPopup(globalObject) {
  "use strict";

  var settingsClient = globalObject.BossChatListener && globalObject.BossChatListener.settingsClient;
  var form = document.getElementById("bcl-key-form");
  var input = document.getElementById("bcl-key-input");
  var saveButton = document.getElementById("bcl-key-save");
  var clearButton = document.getElementById("bcl-key-clear");
  var status = document.getElementById("bcl-key-status");

  if (!settingsClient || !form || !input || !saveButton || !clearButton || !status) {
    return;
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = "bcl-popup-status bcl-popup-status-" + kind;
  }

  function setBusy(isBusy) {
    input.disabled = isBusy;
    saveButton.disabled = isBusy;
    clearButton.disabled = isBusy;
  }

  async function refreshStatus() {
    try {
      var result = await settingsClient.getKeyStatus();
      setStatus(result.configured ? "已配置" : "尚未配置", result.configured ? "ok" : "neutral");
    } catch (error) {
      setStatus("本地服务未启动", "error");
    }
  }

  form.addEventListener("submit", async function onSave(event) {
    var apiKey;

    event.preventDefault();
    apiKey = input.value;
    input.value = "";
    setBusy(true);
    setStatus("正在保存...", "neutral");

    try {
      await settingsClient.saveApiKey(apiKey);
      setStatus("已安全保存", "ok");
    } catch (error) {
      setStatus(error && error.code === "empty_api_key" ? "请输入 API Key" : "保存失败，请确认本地服务已启动", "error");
    } finally {
      apiKey = "";
      input.value = "";
      setBusy(false);
    }
  });

  clearButton.addEventListener("click", async function onClear() {
    input.value = "";
    setBusy(true);
    setStatus("正在清除...", "neutral");

    try {
      await settingsClient.clearApiKey();
      setStatus("已清除", "neutral");
    } catch (error) {
      setStatus("清除失败，请确认本地服务已启动", "error");
    } finally {
      input.value = "";
      setBusy(false);
    }
  });

  refreshStatus();
})(typeof globalThis !== "undefined" ? globalThis : window);
