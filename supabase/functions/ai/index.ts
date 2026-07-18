// EQ GYM — Edge Function proxy Gemini (tuỳ chọn, Phase 2+)
// Mục đích: Premium dùng AI mà KHÔNG cần dán key riêng; key của chủ app giữ bí mật ở server.
//
// Triển khai:
//   1) supabase functions deploy ai
//   2) supabase secrets set GEMINI_KEY=xxxx   (key Gemini của bạn)
//   3) (client) khi user Premium: gọi function này thay vì gọi Gemini trực tiếp.
//
// Bảo mật: yêu cầu Authorization Bearer <access_token>; kiểm tra premium_until;
// giới hạn tần suất đơn giản theo user (in-memory — nâng cấp bằng bảng nếu cần).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GEMINI_KEY = Deno.env.get("GEMINI_KEY")!;
const MODEL = "gemini-2.0-flash";

const hits = new Map<string, { n: number; t: number }>();
const LIMIT = 40;             // request / cửa sổ
const WINDOW = 60 * 60 * 1000; // 1 giờ

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData } = await sb.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    // Kiểm tra Premium
    const { data: prof } = await sb.from("profiles").select("premium_until").eq("id", user.id).maybeSingle();
    const premium = prof?.premium_until && new Date(prof.premium_until) > new Date();
    if (!premium) return json({ error: "premium_required" }, 403);

    // Rate limit
    const now = Date.now();
    const h = hits.get(user.id);
    if (!h || now - h.t > WINDOW) hits.set(user.id, { n: 1, t: now });
    else { h.n++; if (h.n > LIMIT) return json({ error: "rate_limited" }, 429); }

    // Chuyển tiếp body sang Gemini
    const body = await req.json();
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    const data = await r.json();
    return json(data, r.status);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
