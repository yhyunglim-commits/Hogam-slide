// 호감슬라이드 — 악보 읽기 · 맞춤법 검사
// Secrets에 ANTHROPIC_API_KEY 가 있으면 Claude가 먼저 읽고, 안 되면 Gemini가 대신해요.
// ANTHROPIC_API_KEY 가 없으면 Gemini(무료)만 써요.
// Supabase › Edge Functions 에 "ai" 라는 이름으로 만들어요. 함수 설정의 "Verify JWT"는 꺼 주세요.
// (팀원인지는 이 코드가 직접 확인해요)
// 비밀값(Secrets): GEMINI_API_KEY  (선택: GEMINI_MODEL, 기본 gemini-3.8-flash)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-church",
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
    // 화면이 알린 지금 교회(x-church)의 팀원인지. 안 알리면 한 교회에만 속한 사람만 돼요. 멈춘 교회는 빼요
    const h = req.headers.get("x-church") ?? "";
    if (h && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(h)) return reply({ error: "교회를 다시 골라 주세요", code: "not_granted" }, 403);
    const { data: church, error: cErr } = await admin.rpc("ai_church", { p_user: u.user.id, p_church: h || null });
    if (cErr) return reply({ error: "서버가 교회를 확인하지 못했어요. 잠시 뒤에 다시 해 주세요" }, 500);
    if (!church) return reply({ error: "이 교회 팀원만 쓸 수 있어요. 새로고침한 뒤 다시 해 주세요", code: "not_granted" }, 403);

    // 한 사람이 하루(24시간)에 쓸 수 있는 횟수. Secrets의 AI_DAILY_LIMIT로 바꿀 수 있어요 (기본 200번)
    const limit = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "200") || 200;
    const { count: used } = await admin.from("ai_usage").select("id", { count: "exact", head: true })
      .eq("user_id", u.user.id).gte("at", new Date(Date.now() - 24 * 3600_000).toISOString());
    if ((used ?? 0) >= limit) return reply({ error: `오늘 AI를 ${limit}번 써서 더 쓸 수 없어요. 내일 다시 해 주세요`, code: "rate_limited" }, 429);
    const { error: lErr } = await admin.rpc("log_ai", { p_user: u.user.id, p_church: church });
    if (lErr) console.error("log_ai", lErr.message);

    const { prompt, images = [], tier } = await req.json();

    // ── Claude 먼저 (키가 있을 때만) ──
    const ak = Deno.env.get("ANTHROPIC_API_KEY");
    if (ak) {
      const content: unknown[] = [];
      for (const im of images.slice(0, 8)) content.push({ type: "image", source: { type: "base64", media_type: im.mime || "image/jpeg", data: im.data } });
      content.push({ type: "text", text: String(prompt ?? "") });
      for (let attempt = 0; attempt < 2; attempt++) {
        const cr = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": ak, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-5-5", max_tokens: 8000, messages: [{ role: "user", content }] }),
        });
        const cj = await cr.json().catch(() => ({}));
        if (cr.ok) {
          const text = (cj?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
          return reply({ text, by: "claude" });
        }
        if (![429, 500, 529, 503].includes(cr.status)) break; // 키 오류 같은 문제면 바로 Gemini로
        if (attempt === 0) await new Promise((r) => setTimeout(r, 2500));
      }
    }

    // ── Gemini (무료) ──
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return reply({ error: ak ? "Claude가 답하지 못했고, Gemini 키도 없어요" : "관리자가 아직 AI 키를 넣지 않았어요" }, 500);
    const first = (tier === "complex" && Deno.env.get("GEMINI_MODEL_COMPLEX")) || Deno.env.get("GEMINI_MODEL") || "gemini-3.8-flash";
    // 붐빌 때 차례로 써 볼 다른 모델들 (Secrets의 GEMINI_FALLBACK 에 쉼표로 바꿔 적을 수 있어요)
    const fallbacks = (Deno.env.get("GEMINI_FALLBACK") ?? "gemini-flash-lite-latest,gemini-flash-latest,gemini-3.8-flash-lite,gemini-2.5-flash-lite")
      .split(",").map((x) => x.trim()).filter((x) => x && x !== first);
    const models = [first, ...fallbacks];

    const parts: unknown[] = [];
    for (const im of images.slice(0, 8)) parts.push({ inline_data: { mime_type: im.mime || "image/jpeg", data: im.data } });
    parts.push({ text: String(prompt ?? "") });

    const call = (model: string, fast: boolean) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.2, responseMimeType: "application/json",
          ...(fast ? { thinkingConfig: { thinkingLevel: Deno.env.get("GEMINI_THINKING") || "low" } } : {}),
        },
      }),
    });
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const busy = (st: number, msg: string) => st === 503 || st === 500 || /high demand|overloaded|unavailable/i.test(msg);

    let r: Response | null = null, j: any = null, lastMsg = "";
    const tried: string[] = [];
    outer: for (const model of models) {
      // 같은 모델로 최대 3번 (2초, 5초 쉬고) 다시 해 봐요
      for (let attempt = 0; attempt < 3; attempt++) {
        let fast = true;
        r = await call(model, fast); j = await r.json().catch(() => ({}));
        if (r.status === 400 && /think/i.test(j?.error?.message ?? "")) { fast = false; r = await call(model, fast); j = await r.json().catch(() => ({})); }
        if (r.ok) break outer;
        lastMsg = j?.error?.message ?? "";
        if (r.status === 404 || /no longer available|not found|not supported/i.test(lastMsg)) continue outer; // 없는 모델이면 다음 모델로
        if (r.status === 429) {
          tried.push(model + ": " + (/limit: 0\b/.test(lastMsg) ? "무료 한도 없음" : /per ?day|PerDay|daily/i.test(lastMsg) ? "오늘 한도 끝" : "분당 한도"));
          if (/per ?day|PerDay|daily|limit: 0\b/i.test(lastMsg)) continue outer; // 이 모델 한도가 끝났으면 다른 모델로 (모델마다 한도가 따로예요)
          if (attempt < 2) { await sleep(attempt === 0 ? 5000 : 12000); continue; } // 분당 한도면 잠깐 쉬고 다시
          continue outer;
        }
        if (!busy(r.status, lastMsg)) break outer;
        if (attempt < 2) await sleep(attempt === 0 ? 2000 : 5000);
      }
    }
    if (!r) return reply({ error: "AI가 답하지 못했어요" }, 502);
    if (r.status === 429) {
      const day = tried.every((t) => !t.endsWith("분당 한도"));
      return reply({ error: (day ? "Gemini 무료 한도를 다 썼어요. 내일 다시 하거나 Claude 쪽 호감슬라이드로 읽어 주세요" : "Gemini 무료 요청이 몰렸어요. 1~2분 뒤 다시 시도해 주세요") + ` (${tried.join(" · ")})`, code: "rate_limited" }, 429);
    }
    if (!r.ok && busy(r.status, lastMsg)) return reply({ error: "Google AI가 지금 붐벼서 답하지 못했어요. 1~2분 뒤 ‘다시 시도’를 눌러 주세요", code: "busy" }, 503);
    if (!r.ok) return reply({ error: lastMsg || "AI가 답하지 못했어요" }, 502);
    const text = (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    return reply({ text });
  } catch (_e) {
    return reply({ error: "AI 요청을 처리하지 못했어요" }, 500);
  }
});
