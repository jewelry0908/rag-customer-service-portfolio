import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BATCH_SIZE = 10;
const DIMENSIONS = 1024;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chunksPath = path.join(root, "knowledge", "chunks.json");

function batches(items) {
  return Array.from({ length: Math.ceil(items.length / BATCH_SIZE) }, (_, index) => items.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE));
}

function rowsFor(chunks, embeddings) {
  assert.equal(chunks.length, embeddings.length, "切片与向量数量不一致");
  return chunks.map((chunk, index) => {
    assert.equal(embeddings[index].length, DIMENSIONS, `第 ${index + 1} 个向量维度不正确`);
    return { ...chunk, embedding: embeddings[index] };
  });
}

async function responseJson(label, response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label}失败（HTTP ${response.status}）：${body.message || body.error?.message || "请检查配置与权限"}`);
  return body;
}

async function embed(texts, apiKey, baseUrl) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-v4", input: texts, dimensions: DIMENSIONS, encoding_format: "float" })
  });
  const body = await responseJson("千问 Embedding 请求", response);
  const vectors = [...body.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
  assert.equal(vectors.length, texts.length, "千问返回的向量数量不正确");
  return vectors;
}

async function upsert(rows, supabaseUrl, secretKey) {
  const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/knowledge_chunks?on_conflict=document_id,chunk_index`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation"
    },
    body: JSON.stringify(rows)
  });
  return responseJson("Supabase 写入", response);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 ${name}。请检查 .env.local；不要把密钥发到聊天中。`);
  return value;
}

async function loadChunks() {
  const chunks = JSON.parse(await readFile(chunksPath, "utf8"));
  if (!Array.isArray(chunks) || !chunks.length) throw new Error("knowledge/chunks.json 为空；请先运行切片器。");
  return chunks;
}

async function main() {
  if (process.argv.includes("--self-test")) {
    const chunk = { document_id: "test", document_title: "测试", chunk_index: 0, content: "测试内容", metadata: {} };
    const rows = rowsFor([chunk], [Array(DIMENSIONS).fill(0)]);
    assert.equal(rows[0].embedding.length, DIMENSIONS);
    assert.deepEqual(batches([1, 2, 3]), [[1, 2, 3]]);
    console.log("导入脚本自检通过：批处理与 1024 维向量校验正常。");
    return;
  }

  const chunks = await loadChunks();
  if (process.argv.includes("--dry-run")) {
    console.log(`检查通过：${chunks.length} 个切片，来自 ${new Set(chunks.map((chunk) => chunk.document_id)).size} 份资料；未调用模型或数据库。`);
    return;
  }

  const apiKey = required("DASHSCOPE_API_KEY");
  const supabaseUrl = required("SUPABASE_URL");
  const secretKey = required("SUPABASE_SECRET_KEY");
  const baseUrl = process.env.DASHSCOPE_BASE_URL?.trim() || "https://dashscope.aliyuncs.com/compatible-mode/v1";
  let written = 0;

  // ponytail: 30 个切片按官方上限 10 条一批，先不引入队列或重试框架。
  console.log(`开始导入：${chunks.length} 个切片，共 ${Math.ceil(chunks.length / BATCH_SIZE)} 批。`);
  for (const [index, chunkBatch] of batches(chunks).entries()) {
    const embeddings = await embed(chunkBatch.map((chunk) => chunk.content), apiKey, baseUrl);
    const saved = await upsert(rowsFor(chunkBatch, embeddings), supabaseUrl, secretKey);
    written += saved.length;
    console.log(`第 ${index + 1}/${Math.ceil(chunks.length / BATCH_SIZE)} 批完成：${saved.length} 个切片已写入。`);
  }
  console.log(`导入完成：共写入 ${written} 个切片。可在 Supabase Table Editor 查看 knowledge_chunks。`);
}

main().catch((error) => {
  console.error(error.message);
  if (error.cause?.message) console.error(`网络原因：${error.cause.message}`);
  process.exitCode = 1;
});
