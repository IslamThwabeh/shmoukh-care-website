/**
 * Shmoukh Care — Cloudflare Worker
 * Handles: /api/upload, /api/save-config, /api/get-config,
 *           /api/get-configs, /api/admin-login
 *
 * Bindings (set in wrangler.toml):
 *   DB    → D1 database (shmoukh-care-db)
 *   MEDIA → R2 bucket   (shmoukh-care-media)
 *
 * Secrets (set via `wrangler secret put`):
 *   ADMIN_PASSWORD
 */

// ── Public base URL for R2 objects ────────────────────────────────────────────
const R2_PUBLIC_BASE = "https://media.shmoukh-care.com";

// ── Allowed origins for CORS ───────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://shmoukh-care.com",
  "https://www.shmoukh-care.com",
  "http://localhost",
  "http://127.0.0.1",
  // file:// origin arrives as "null" from browsers
  "null",
];

// ── Allowed MIME types for uploads ────────────────────────────────────────────
const ALLOWED_MIME_PREFIXES = ["image/", "video/"];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// =============================================================================
// Entry point
// =============================================================================
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") ?? "";

    // Handle pre-flight CORS
    if (request.method === "OPTIONS") {
      return corsHeaders(origin, new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    // Normalise: strip trailing slash, strip /api prefix for routing
    const path = url.pathname.replace(/\/$/, "").replace(/^\/api/, "") || "/";

    let response;
    try {
      switch (path) {
        case "/upload":
          response = await handleUpload(request, env);
          break;
        case "/save-config":
          response = await handleSaveConfig(request, env);
          break;
        case "/get-config":
          response = await handleGetConfig(request, env, url);
          break;
        case "/get-configs":
          response = await handleGetConfigs(request, env);
          break;
        case "/admin-login":
          response = await handleAdminLogin(request, env);
          break;
        default:
          response = json({ error: "Not found" }, 404);
      }
    } catch (err) {
      console.error(err);
      response = json({ error: "Internal server error" }, 500);
    }

    return corsHeaders(origin, response);
  },
};

// =============================================================================
// Handlers
// =============================================================================

/**
 * POST /api/upload
 * Body: multipart/form-data with field "file"
 * Returns: { url: "https://media.shmoukh-care.com/<key>" }
 */
async function handleUpload(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Invalid multipart body" }, 400);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return json({ error: "No file provided" }, 400);
  }

  // Validate MIME type
  const mime = file.type || "";
  const allowed = ALLOWED_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
  if (!allowed) {
    return json({ error: `File type not allowed: ${mime}` }, 415);
  }

  // Validate size
  const buffer = await file.arrayBuffer();
  if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
    return json({ error: "File exceeds 50 MB limit" }, 413);
  }

  // Build a unique key: uploads/<timestamp>-<original-name>
  const safeFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const key = `uploads/${Date.now()}-${safeFileName}`;

  await env.MEDIA.put(key, buffer, {
    httpMetadata: { contentType: mime },
  });

  return json({ url: `${R2_PUBLIC_BASE}/${key}` }, 201);
}

/**
 * POST /api/save-config
 * Body: JSON { business: { email, ... }, products: [...], ... }
 * Upserts by email. Returns: { id, message }
 */
async function handleSaveConfig(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const email = body?.business?.email?.trim()?.toLowerCase();
  if (!email) return json({ error: "business.email is required" }, 422);

  const now = new Date().toISOString();

  // Upsert: insert on conflict update
  const result = await env.DB.prepare(
    `INSERT INTO businesses (email, data, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       data       = excluded.data,
       updated_at = excluded.updated_at`
  )
    .bind(email, JSON.stringify(body), now, now)
    .run();

  // Fetch the saved row id
  const row = await env.DB.prepare(
    "SELECT id FROM businesses WHERE email = ?"
  )
    .bind(email)
    .first();

  return json({ id: row?.id, message: "تم حفظ البيانات بنجاح" }, 200);
}

/**
 * GET /api/get-config?email=<email>
 * Returns: single business record or 404
 */
async function handleGetConfig(request, env, url) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const email = (url.searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) return json({ error: "email query param is required" }, 400);

  const row = await env.DB.prepare(
    "SELECT id, data, created_at, updated_at FROM businesses WHERE email = ?"
  )
    .bind(email)
    .first();

  if (!row) return json({ error: "Not found" }, 404);

  return json({
    id: row.id,
    data: JSON.parse(row.data),
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}

/**
 * GET /api/get-configs
 * Requires: Authorization: Bearer <ADMIN_PASSWORD>
 * Returns: array of all business records (paginated, latest first)
 */
async function handleGetConfigs(request, env) {
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

  if (!checkAdminAuth(request, env)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const rows = await env.DB.prepare(
    "SELECT id, email, data, created_at, updated_at FROM businesses ORDER BY updated_at DESC LIMIT 500"
  ).all();

  const records = (rows.results ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    data: JSON.parse(r.data),
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));

  return json({ records });
}

/**
 * POST /api/admin-login
 * Body: { password: "..." }
 * Returns 200 on match, 401 on mismatch.
 * No session/JWT is issued — admin.html re-sends the password on every request.
 */
async function handleAdminLogin(request, env) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const supplied = (body?.password ?? "").trim();
  if (!supplied) return json({ error: "Password required" }, 400);

  // Constant-time comparison to prevent timing attacks
  const expected = env.ADMIN_PASSWORD ?? "";
  if (!safeCompare(supplied, expected)) {
    return json({ error: "Unauthorized" }, 401);
  }

  return json({ ok: true });
}

// =============================================================================
// Helpers
// =============================================================================

/** Check Authorization: Bearer <ADMIN_PASSWORD> header */
function checkAdminAuth(request, env) {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return safeCompare(token, env.ADMIN_PASSWORD ?? "");
}

/**
 * Constant-time string comparison to prevent timing-based attacks.
 * Returns true only if both strings are equal AND non-empty.
 */
function safeCompare(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Build a JSON Response */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Attach CORS headers to a Response */
function corsHeaders(origin, response) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowed);
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  return new Response(response.body, { status: response.status, headers });
}
