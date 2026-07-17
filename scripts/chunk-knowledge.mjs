import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_CHARS = 400;
const OVERLAP_CHARS = 50;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const knowledgeDir = path.join(root, "knowledge");

function clean(text) {
  return text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function splitLongText(text) {
  const parts = clean(text).split(/\n\n+/).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const part of parts) {
    if ((current + "\n\n" + part).length <= MAX_CHARS) {
      current = current ? `${current}\n\n${part}` : part;
      continue;
    }
    if (current) chunks.push(current);

    let rest = part;
    while (rest.length > MAX_CHARS) {
      const naturalBreak = Math.max(rest.lastIndexOf("。", MAX_CHARS), rest.lastIndexOf("！", MAX_CHARS), rest.lastIndexOf("？", MAX_CHARS), rest.lastIndexOf("\n", MAX_CHARS));
      const breakAt = naturalBreak > MAX_CHARS * 0.6 ? naturalBreak + 1 : MAX_CHARS;
      chunks.push(rest.slice(0, breakAt).trim());
      rest = rest.slice(Math.max(0, breakAt - OVERLAP_CHARS)).trim();
    }
    current = rest;
  }
  if (current) chunks.push(current);
  return chunks;
}

export function chunkMarkdown(markdown, sourceFile) {
  const lines = clean(markdown).split("\n");
  const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() || path.basename(sourceFile, ".md");
  const documentId = path.basename(sourceFile, ".md");
  const parsed = [];
  const stack = [];
  const rootBody = [];
  let sectionBody = [];
  const flushParsed = () => {
    const text = clean(sectionBody.join("\n"));
    if (text && stack.length) parsed.push({ headingPath: stack.map((item) => item.text).join(" > "), text });
    sectionBody = [];
  };
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (!match) {
      (stack.length ? sectionBody : rootBody).push(line);
      continue;
    }
    flushParsed();
    const level = match[1].length;
    if (level === 1) {
      stack.length = 0;
      continue;
    }
    // ponytail: a small stack preserves Markdown heading context without a parser dependency.
    while (stack.length && stack.at(-1).level >= level) stack.pop();
    stack.push({ level, text: match[2].trim() });
  }
  flushParsed();
  if (!parsed.length && clean(rootBody.join("\n"))) parsed.push({ headingPath: title, text: clean(rootBody.join("\n")) });

  return parsed.flatMap(({ headingPath, text }) =>
    splitLongText(text).map((part, index) => ({
      document_id: documentId,
      document_title: title,
      chunk_index: index,
      content: `【${title}｜${headingPath}】\n${part}`,
      metadata: { source_file: sourceFile, heading_path: headingPath }
    }))
  ).map((chunk, chunkIndex) => ({ ...chunk, chunk_index: chunkIndex }));
}

async function main() {
  if (process.argv.includes("--self-test")) {
    const chunks = chunkMarkdown("# 退款与改期规则\n\n## 退款规则\n\n购买后 7 天内且未学习超过 2 节课程，可申请退款。\n\n### 不支持退款\n\n学习超过 2 节课程后不支持退款。", "04-refund.md");
    const outline = chunkMarkdown("# 课程大纲\n\n第 1 周：AI 产品机会与问题定义。", "02-outline.md");
    const longText = chunkMarkdown(`# 长文本\n\n${"知识库规则。".repeat(100)}`, "long.md");
    if (chunks.length !== 2 || !chunks[1].metadata.heading_path.includes("不支持退款") || outline.length !== 1 || longText.length < 2) throw new Error("切片自检失败");
    console.log("切片自检通过：标题层级与规则边界已保留。");
    return;
  }

  const files = (await readdir(knowledgeDir)).filter((file) => file.endsWith(".md") && file !== "README.md");
  if (!files.length) throw new Error("knowledge/ 中没有可切片的 Markdown 文件。");

  const chunks = [];
  for (const file of files) chunks.push(...chunkMarkdown(await readFile(path.join(knowledgeDir, file), "utf8"), file));
  await mkdir(knowledgeDir, { recursive: true });
  await writeFile(path.join(knowledgeDir, "chunks.json"), JSON.stringify(chunks, null, 2), "utf8");
  console.log(`已从 ${files.length} 份资料生成 ${chunks.length} 个切片：knowledge/chunks.json`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
