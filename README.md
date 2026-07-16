# RAG Customer Service Portfolio

一个用于作品集展示的 RAG 智能客服项目。业务资料为模拟内容，目标是练习从知识库、检索、提示词、评测到部署的完整流程。

## 当前阶段

- 静态聊天界面已完成，可直接打开 `frontend/index.html` 预览。
- Worker 接口默认关闭，不会调用模型或消耗额度。
- 下一阶段接入 Supabase pgvector、千问 Embedding 和生成模型。

## 安全原则

- 任何密钥只保存到 Cloudflare Worker Secrets，绝不提交到 GitHub。
- `DEMO_ENABLED` 默认是 `false`，需要你手动开启后才允许真实问答。
- `knowledge/` 只存放可公开展示的模拟资料。

## 本地运行

聊天界面没有依赖，直接打开 `frontend/index.html` 即可查看。

接入 Worker 前，需要安装 Node.js。之后在 `worker/` 目录运行：

```bash
npm test
npm run dev
```

## 目录

```text
frontend/   GitHub Pages 静态聊天页面
worker/     Cloudflare Worker，负责安全开关和后续 RAG API
knowledge/  公开的 Markdown 业务资料
```

