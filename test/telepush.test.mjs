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
});

const errorResponse = (data, status = 400) => ({
  ok: false,
  status,
  json: async () => data,
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
      assert.equal(result.message_id, 1);
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
