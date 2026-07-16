import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

const env = { DEMO_ENABLED: "false", ALLOWED_ORIGIN: "http://localhost:8080" };

test("closed demo does not accept model requests", async () => {
  const request = new Request("https://example.workers.dev/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question: "课程适合零基础吗？" })
  });

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { message: "Demo 暂停体验。" });
});

