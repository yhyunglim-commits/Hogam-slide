// 호감슬라이드 — 악보 읽기 · 맞춤법 검사
// Claude(Anthropic)로만 읽어요. 비밀값(Secrets): ANTHROPIC_API_KEY (선택: CLAUDE_MODEL)
// Supabase › Edge Functions 에 "ai" 라는 이름으로 만들어요. 함수 설정의 "Verify JWT"는 꺼 주세요.
// (팀원인지는 이 코드가 직접 확인해요)
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-church",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// 부르고 나면 쓴 양(토큰)을 적고, 답을 못 받았으면 잡아 둔 한 번을 돌려줘요
type Hold = { end?: () => Promise<void>; got?: boolean; by?: string; tin?: number; tout?: number };
Deno.serve(async (req) => {
  const hold: Hold = {};
  const res = await handle(req, hold);
  if (hold.end) await hold.end().catch((e) => console.error("ai_end", e));
  return res;
});

async function handle(req: Request, hold: Hold): Promise<Response> {
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
    const { prompt, images = [], tier, job, kind } = await req.json();
    const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    const { data: slot, error: lErr } = await admin.rpc("ai_begin", { p_user: u.user.id, p_church: church, p_job: uuid.test(job ?? "") ? job : null, p_kind: String(kind ?? "") });
    if (lErr || !slot) return reply({ error: "서버가 AI 횟수를 확인하지 못했어요. 잠시 뒤에 다시 해 주세요" }, 500);
    if (!slot.ok) return reply({ error: slot.error, code: slot.code }, 403);
    hold.end = async () => {
      const { error } = await admin.rpc("ai_end", { p_job: slot.job, p_ok: !!hold.got, p_by: hold.by ?? "", p_in: hold.tin ?? 0, p_out: hold.tout ?? 0 });
      if (error) console.error("ai_end", error.message);
    };

    // ── Claude로 읽어요 (무료 Gemini 예비는 2026-11-26에 뺐어요: 무료 키는 보낸 사진을 Google이 쓸 수 있어서) ──
    const ak = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ak) return reply({ error: "관리자가 아직 AI 키를 넣지 않았어요" }, 500);
    const content: unknown[] = [];
    for (const im of images.slice(0, 8)) content.push({ type: "image", source: { type: "base64", media_type: im.mime || "image/jpeg", data: im.data } });
    content.push({ type: "text", text: String(prompt ?? "") });
    let status = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const cr = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ak, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: Deno.env.get("CLAUDE_MODEL") || "claude-sonnet-5-5", max_tokens: 8000, messages: [{ role: "user", content }] }),
      });
      const cj = await cr.json().catch(() => ({}));
      if (cr.ok) {
        const text = (cj?.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
        hold.got = !!text.trim(); hold.by = "claude"; hold.tin = cj?.usage?.input_tokens; hold.tout = cj?.usage?.output_tokens;
        return reply({ text, by: "claude" });
      }
      status = cr.status;
      if (![429, 500, 529, 503].includes(cr.status)) break; // 키 오류 같은 문제면 다시 해 봐도 같아요
      if (attempt < 2) await new Promise((r) => setTimeout(r, attempt === 0 ? 2500 : 6000));
    }
    if ([429, 500, 529, 503].includes(status)) return reply({ error: "AI가 지금 붐벼서 답하지 못했어요. 1~2분 뒤 ‘다시 시도’를 눌러 주세요", code: "busy" }, 503);
    return reply({ error: "AI가 답하지 못했어요. 계속 안 되면 호감에게 알려 주세요" }, 502);
  } catch (_e) {
    return reply({ error: "AI 요청을 처리하지 못했어요" }, 500);
  }
}
