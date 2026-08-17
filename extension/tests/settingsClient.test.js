const assert = require("node:assert/strict");
const test = require("node:test");

let client = null;
try {
  client = require("../src/settingsClient.js");
} catch (error) {
  client = null;
}

function assertClientLoaded() {
  assert.ok(client, "settingsClient module should be available");
}

function successfulFetch(body) {
  return async () => ({
    ok: true,
    json: async () => body
  });
}

test("accepts only the local backend origin", () => {
  assertClientLoaded();
  assert.equal(client.isLocalBackendUrl("http://127.0.0.1:8765"), true);
  assert.equal(client.isLocalBackendUrl("http://localhost:8765"), true);
  assert.equal(client.isLocalBackendUrl("https://api.deepseek.com"), false);
  assert.equal(client.isLocalBackendUrl("http://127.0.0.1:9000"), false);
});

test("saves the key in a localhost header without a request body", async () => {
  assertClientLoaded();
  let requestOptions = null;

  const result = await client.saveApiKey("test-key", {
    fetchImpl: async (url, options) => {
      requestOptions = options;
      assert.equal(url, "http://127.0.0.1:8765/api/settings/deepseek-key");
      return { ok: true, json: async () => ({ configured: true }) };
    }
  });

  assert.deepEqual(result, { configured: true });
  assert.equal(requestOptions.method, "PUT");
  assert.equal(requestOptions.headers["X-DeepSeek-API-Key"], "test-key");
  assert.equal(Object.prototype.hasOwnProperty.call(requestOptions, "body"), false);
  assert.equal(requestOptions.credentials, "omit");
});

test("does not send a key when reading configured status", async () => {
  assertClientLoaded();
  let requestOptions = null;

  const result = await client.getKeyStatus({
    fetchImpl: async (url, options) => {
      requestOptions = options;
      assert.equal(url, "http://127.0.0.1:8765/api/settings/deepseek-key/status");
      return { ok: true, json: async () => ({ configured: false }) };
    }
  });

  assert.deepEqual(result, { configured: false });
  assert.equal(requestOptions.method, "GET");
  assert.equal(Object.prototype.hasOwnProperty.call(requestOptions, "headers"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(requestOptions, "body"), false);
});

test("clears the key through an idempotent localhost request", async () => {
  assertClientLoaded();
  let requestOptions = null;

  const result = await client.clearApiKey({
    fetchImpl: async (url, options) => {
      requestOptions = options;
      assert.equal(url, "http://127.0.0.1:8765/api/settings/deepseek-key");
      return { ok: true, json: async () => ({ configured: false }) };
    }
  });

  assert.deepEqual(result, { configured: false });
  assert.equal(requestOptions.method, "DELETE");
  assert.equal(Object.prototype.hasOwnProperty.call(requestOptions, "body"), false);
});

test("rejects an empty key before making a request", async () => {
  assertClientLoaded();
  let called = false;

  await assert.rejects(
    () => client.saveApiKey("   ", {
      fetchImpl: async () => {
        called = true;
        return { ok: true, json: async () => ({ configured: true }) };
      }
    }),
    (error) => error.code === "empty_api_key"
  );

  assert.equal(called, false);
});

test("turns backend failures into generic settings errors", async () => {
  assertClientLoaded();

  await assert.rejects(
    () => client.getKeyStatus({
      fetchImpl: successfulFetch({ detail: "private backend details" })
    }),
    (error) => error.code === "settings_unavailable"
  );
});
