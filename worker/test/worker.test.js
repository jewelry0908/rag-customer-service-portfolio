import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.js";

const env = {
  DEMO_ENABLED: "true",
  ALLOWED_ORIGIN: "http://localhost:8080",
  DASHSCOPE_API_KEY: "test-dashscope-key",
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_SECRET_KEY: "test-supabase-key",
  DASHSCOPE_CHAT_MODEL: "qwen-plus"
};

function chatRequest(question = "退款需要什么条件？") {
  return new Request("https://example.workers.dev/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:8080" },
    body: JSON.stringify({ question })
  });
}

async function withFetchMock(mock, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = mock;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("closed demo does not accept model requests", async () => {
  const response = await worker.fetch(chatRequest(), { ...env, DEMO_ENABLED: "false" });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { message: "Demo 暂停体验。" });
});

test("enabled demo retrieves knowledge and returns a sourced answer", { concurrency: false }, async () => {
  const requests = [];
  await withFetchMock(async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith("/embeddings")) return Response.json({ data: [{ embedding: Array(1024).fill(0.1) }] });
    if (url.endsWith("/rpc/match_knowledge_chunks")) {
      return Response.json([{ document_title: "04 退款与改期规则", metadata: { heading_path: "退款条件" }, similarity: 0.659, content: "【退款条件】购买后未超过 7 个自然日。" }]);
    }
    if (url.endsWith("/chat/completions")) return Response.json({ choices: [{ message: { content: "退款需满足课程资料列出的条件。" } }] });
    throw new Error(`Unexpected request: ${url}`);
  }, async () => {
    const response = await worker.fetch(chatRequest(), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      answer: "退款需满足课程资料列出的条件。",
      sources: [{ title: "04 退款与改期规则", heading: "退款条件", similarity: 0.659 }]
    });
  });

  assert.equal(requests.length, 3);
  assert.equal(requests[0].options.headers.Authorization, "Bearer test-dashscope-key");
  assert.equal(requests[1].options.headers.apikey, "test-supabase-key");
});

test("invalid question is rejected before any upstream request", async () => {
  const response = await worker.fetch(chatRequest(""), env);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: "问题不能为空，且不能超过 500 个字符。" });
});
