import assert from "node:assert/strict";

const DIMENSIONS = 1024;
const cases = [
  ["R1", "退款需要同时满足哪些条件？", "04 退款与改期规则"],
  ["R2", "课程价格是多少，包含哪些权益？", "03 价格与权益"],
  ["R3", "完全没有产品经验可以学吗？", "01 课程介绍"],
  ["R4", "我要投诉，客服应该怎么处理？", "08 人工服务边界"],
  ["R5", "第三周主要学习什么？", "02 课程大纲"]
];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 ${name}。请检查 .env.local。`);
  return value;
}

async function responseJson(label, response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label}失败（HTTP ${response.status}）：${body.message || body.error?.message || "请检查配置与权限"}`);
  return body;
}

async function embed(question, apiKey, baseUrl) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-v4", input: question, dimensions: DIMENSIONS, encoding_format: "float" })
  });
  const body = await responseJson("千问 Embedding 请求", response);
  const vector = body.data?.[0]?.embedding;
  assert.equal(vector?.length, DIMENSIONS, "千问返回的查询向量维度不正确");
  return vector;
}

function embeddingFingerprint(vector) {
  return vector.slice(0, 6).map((value) => Number(value).toFixed(6)).join(",");
}

async function retrieve(question, config) {
  const vector = await embed(question, config.apiKey, config.baseUrl);
  const response = await fetch(`${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/match_knowledge_chunks`, {
    method: "POST",
    headers: {
      apikey: config.secretKey,
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query_embedding: vector, match_count: 5 })
  });
  return responseJson("Supabase 检索", response);
}

function showResults(question, results) {
  console.log(`\n问题：${question}`);
  for (const [index, item] of results.entries()) {
    console.log(`Top ${index + 1} ｜${item.document_title}｜${item.metadata.heading_path}｜相似度 ${Number(item.similarity).toFixed(3)}`);
    console.log(item.content.replace(/\n/g, " "));
  }
}

async function main() {
  if (process.argv.includes("--self-test")) {
    assert.equal(cases.length, 5);
    assert.ok(cases.every((item) => item.length === 3));
    console.log("检索验证器自检通过：5 条种子问题已就绪。");
    return;
  }

  const config = {
    apiKey: required("DASHSCOPE_API_KEY"),
    supabaseUrl: required("SUPABASE_URL"),
    secretKey: required("SUPABASE_SECRET_KEY"),
    baseUrl: process.env.DASHSCOPE_BASE_URL?.trim() || "https://dashscope.aliyuncs.com/compatible-mode/v1"
  };

  if (process.argv.includes("--suite")) {
    let hits = 0;
    for (const [id, question, expectedDocument] of cases) {
      const results = await retrieve(question, config);
      const hit = results.some((item) => item.document_title === expectedDocument);
      hits += Number(hit);
      console.log(`\n${id} ${hit ? "命中" : "未命中"}目标文档：${expectedDocument}`);
      showResults(question, results);
    }
    console.log(`\n检索验证完成：${hits}/${cases.length} 条在 Top-5 命中目标文档。`);
    return;
  }

  const args = process.argv.slice(2);
  const question = args.filter((arg) => arg !== "--fingerprint").join(" ").trim();
  if (!question) throw new Error('请提供问题，例如：node --env-file=.env.local scripts/test-retrieval.mjs "退款需要什么条件？"');
  if (args.includes("--fingerprint")) {
    console.log(`Embedding 指纹：${embeddingFingerprint(await embed(question, config.apiKey, config.baseUrl))}`);
    return;
  }
  showResults(question, await retrieve(question, config));
}

main().catch((error) => {
  console.error(error.message);
  if (error.cause?.message) console.error(`网络原因：${error.cause.message}`);
  process.exitCode = 1;
});
