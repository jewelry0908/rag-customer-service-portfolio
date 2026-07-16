const MAX_QUESTION_CHARS = 500;

function corsHeaders(origin, allowedOrigin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };

  if (origin && origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env.ALLOWED_ORIGIN);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return json({ message: "Not found." }, 404, headers);
    }

    // ponytail: keep the public endpoint closed until the retrieval pipeline is connected.
    if (env.DEMO_ENABLED !== "true") {
      return json({ message: "Demo 暂停体验。" }, 503, headers);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ message: "请求格式不正确。" }, 400, headers);
    }

    const question = typeof payload.question === "string" ? payload.question.trim() : "";
    if (!question || question.length > MAX_QUESTION_CHARS) {
      return json({ message: `问题不能为空，且不能超过 ${MAX_QUESTION_CHARS} 个字符。` }, 400, headers);
    }

    return json(
      { message: "RAG 检索链路尚未连接。" },
      501,
      headers
    );
  }
};

