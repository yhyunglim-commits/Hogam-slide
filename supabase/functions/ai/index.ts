// 호감슬라이드 — 악보 읽기 · 맞춤법 검사 (Google Gemini 무료 API)
// Supabase › Edge Functions 에 "ai" 라는 이름으로 만들어요. 함수 설정의 "Verify JWT"는 꺼 주세요.
// (팀원인지는 이 코드가 직접 확인해요)
// 비밀값(Secrets): GEMINI_API_KEY  (선택: GEMINI_MODEL, 기본 gemini-2.5-flash)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // 팀원만 쓸 수 있어요
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return reply({ error: "다시 로그인해 주세요", code: "not_granted" }, 401);
    const { data: m } = await admin.from("members").select("name").eq("user_id", u.user.id).maybeSingle();
    if (!m) return reply({ error: "팀원만 쓸 수 있어요", code: "not_granted" }, 403);

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return reply({ error: "관리자가 아직 Gemini 키를 넣지 않았어요" }, 500);
    const { prompt, images = [], tier } = await req.json();
    const model = (tier === "complex" && Deno.env.get("GEMINI_MODEL_COMPLEX")) || Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";

    const parts: unknown[] = [];
    for (const im of images.slice(0, 8)) parts.push({ inline_data: { mime_type: im.mime || "image/jpeg", data: im.data } });
    parts.push({ text: String(prompt ?? "") });

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });
    const j = await r.json();
    if (r.status === 429) return reply({ error: "오늘 무료 사용량을 거의 다 썼어요. 잠시 뒤나 내일 다시 해 주세요", code: "rate_limited" }, 429);
    if (!r.ok) return reply({ error: j?.error?.message ?? "AI가 답하지 못했어요" }, 502);
    const text = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return reply({ text });
  } catch (_e) {
    return reply({ error: "AI 요청을 처리하지 못했어요" }, 500);
  }
});
