/**
 * Runtime log sink for Vercel Observability / Runtime Logs.
 * Static SPA alone produces no function logs; this endpoint does.
 */
export default function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = { message: body };
    }
  }
  body = body || {};

  const level = String(body.level || "info").toLowerCase();
  const payload = {
    at: new Date().toISOString(),
    level,
    message: String(body.message || "client-event"),
    path: body.path || null,
    detail: body.detail || null,
    userAgent: req.headers["user-agent"] || null,
  };

  if (level === "error" || level === "warn") {
    console.error("[retail-client]", JSON.stringify(payload));
  } else {
    console.log("[retail-client]", JSON.stringify(payload));
  }

  return res.status(204).end();
}
