import assert from "node:assert/strict";
import test from "node:test";
import { Telepush, TelepushError } from "../dist/index.js";

const withFetch = (impl, fn) => {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      globalThis.fetch = original;
    });
};

const okResponse = (data, status = 200) => ({
  ok: true,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
  text: async () => JSON.stringify(data),
});

const errorResponse = (data, status = 400) => ({
  ok: false,
  status,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

const baseConfig = {
  botToken: "token",
  chatId: "123",
};

test("push sends message and returns result", async () => {
  await withFetch(
    async (url, init) => {
      assert.match(url, /sendMessage$/);
      const body = JSON.parse(init.body);
      assert.equal(body.chat_id, "123");
      assert.equal(body.text, "hello");
      return okResponse({
        ok: true,
        result: { message_id: 1, date: 1, text: "hello" },
      });
    },
    async () => {
      const client = new Telepush(baseConfig);
      const result = await client.push("hello");
      assert.equal(result.messageId, 1);
    },
  );
});

test("push throws on empty text", async () => {
  const client = new Telepush(baseConfig);
  await assert.rejects(() => client.push("  "), TelepushError);
});

test("push throws on api error", async () => {
  await withFetch(
    async () => errorResponse({ ok: false, description: "bad" }, 400),
    async () => {
      const client = new Telepush(baseConfig);
      await assert.rejects(() => client.push("hello"), /bad/);
    },
  );
});


import { TelepushConfigError } from "../dist/index.js";

test("constructor throws on missing token", async () => {
  assert.throws(() => new Telepush({ botToken: "", chatId: "123" }), TelepushConfigError);
});

test("constructor throws on missing chatId", async () => {
  assert.throws(() => new Telepush({ botToken: "token", chatId: "" }), TelepushConfigError);
});

test("push works with object config", async () => {
  await withFetch(
    async (url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.text, "obj");
      assert.equal(body.parse_mode, "Markdown");
      return okResponse({
        ok: true,
        result: { message_id: 2, date: 2, text: "obj" },
      });
    },
    async () => {
      const client = new Telepush(baseConfig);
      const result = await client.push({ text: "obj", parseMode: "Markdown" });
      assert.equal(result.messageId, 2);
    }
  );
});

test(".to() creates scoped instance without mutating", async () => {
  await withFetch(
    async (url, init) => {
      const body = JSON.parse(init.body);
      assert.equal(body.chat_id, "456"); // The new target
      return okResponse({
        ok: true,
        result: { message_id: 3, date: 3, text: "test" },
      });
    },
    async () => {
      const client = new Telepush(baseConfig);
      const scoped = client.to("456");
      await scoped.push("test");

      // Ensure original is still pointing to base config
      assert.notEqual(client, scoped);
    }
  );
});

test("semantic helpers prepend emoji", async () => {
  let requestBody;
  await withFetch(
    async (url, init) => {
      requestBody = JSON.parse(init.body);
      return okResponse({
        ok: true,
        result: { message_id: 4, date: 4, text: requestBody.text },
      });
    },
    async () => {
      const client = new Telepush(baseConfig);

      await client.success("ok");
      assert.equal(requestBody.text, "✅ ok");

      await client.error("bad");
      assert.equal(requestBody.text, "❌ bad");
    }
  );
});

test("timeout behavior", async () => {
  await withFetch(
    async (url, init) => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          if (init.signal?.aborted) {
            const err = new Error("AbortError");
            err.name = "AbortError";
            reject(err);
          }
        }, 10);
      });
    },
    async () => {
      const client = new Telepush(baseConfig);
      await assert.rejects(() => client.push({ text: "test", timeoutMs: 1 }), /Request timed out/);
    }
  );
});

test("retry logic on 429", async () => {
  let attempts = 0;
  await withFetch(
    async (url, init) => {
      attempts++;
      if (attempts === 1) {
        return errorResponse({
          ok: false,
          error_code: 429,
          description: "Too Many Requests",
          parameters: { retry_after: 0.1 }
        }, 429);
      }
      return okResponse({ ok: true, result: { message_id: 5, date: 5, text: "retried" } });
    },
    async () => {
      const client = new Telepush({ ...baseConfig, retry: { retries: 2, minDelayMs: 10 } });
      const result = await client.push("test");
      assert.equal(result.messageId, 5);
      assert.equal(attempts, 2);
    }
  );
});
