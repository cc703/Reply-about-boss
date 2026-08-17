(function attachSettingsClient(globalObject) {
  "use strict";

  var DEFAULT_BASE_URL = "http://127.0.0.1:8765";
  var SETTINGS_PATH = "/api/settings/deepseek-key";
  var STATUS_PATH = "/api/settings/deepseek-key/status";

  function SettingsClientError(code, message) {
    this.name = "SettingsClientError";
    this.code = code;
    this.message = message || code;
  }
  SettingsClientError.prototype = Object.create(Error.prototype);
  SettingsClientError.prototype.constructor = SettingsClientError;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isLocalBackendUrl(endpoint) {
    try {
      var parsed = new URL(endpoint);
      return parsed.protocol === "http:"
        && (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost")
        && parsed.port === "8765"
        && !parsed.username
        && !parsed.password;
    } catch (error) {
      return false;
    }
  }

  function buildEndpoint(path, options) {
    var baseUrl = options && options.baseUrl ? options.baseUrl : DEFAULT_BASE_URL;

    if (!isLocalBackendUrl(baseUrl)) {
      throw new SettingsClientError("local_backend_only", "只允许连接本地后端。");
    }

    return new URL(path, baseUrl).toString();
  }

  async function requestSettings(path, requestOptions, options) {
    var fetchImpl = options && options.fetchImpl ? options.fetchImpl : globalObject.fetch;
    var endpoint = buildEndpoint(path, options);
    var response;
    var body;

    if (typeof fetchImpl !== "function") {
      throw new SettingsClientError("fetch_unavailable", "当前浏览器无法连接本地服务。");
    }

    try {
      response = await fetchImpl(endpoint, requestOptions);
      body = await response.json();
    } catch (error) {
      throw new SettingsClientError("settings_unavailable", "本地设置服务不可用。请先启动后端。");
    }

    if (!response.ok || !body || typeof body.configured !== "boolean") {
      throw new SettingsClientError("settings_unavailable", "本地设置服务不可用。请先启动后端。");
    }

    return { configured: body.configured };
  }

  function getKeyStatus(options) {
    return requestSettings(STATUS_PATH, {
      method: "GET",
      credentials: "omit"
    }, options);
  }

  function saveApiKey(value, options) {
    var apiKey = normalizeText(value);

    if (!apiKey) {
      return Promise.reject(new SettingsClientError("empty_api_key", "请输入 DeepSeek API Key。"));
    }

    return requestSettings(SETTINGS_PATH, {
      method: "PUT",
      headers: {
        "X-DeepSeek-API-Key": apiKey
      },
      credentials: "omit"
    }, options);
  }

  function clearApiKey(options) {
    return requestSettings(SETTINGS_PATH, {
      method: "DELETE",
      credentials: "omit"
    }, options);
  }

  var api = {
    DEFAULT_BASE_URL: DEFAULT_BASE_URL,
    SettingsClientError: SettingsClientError,
    normalizeText: normalizeText,
    isLocalBackendUrl: isLocalBackendUrl,
    getKeyStatus: getKeyStatus,
    saveApiKey: saveApiKey,
    clearApiKey: clearApiKey
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  globalObject.BossChatListener = Object.assign(
    {},
    globalObject.BossChatListener || {},
    { settingsClient: api }
  );
})(typeof globalThis !== "undefined" ? globalThis : window);
