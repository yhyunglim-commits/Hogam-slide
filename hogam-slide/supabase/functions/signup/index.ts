// 호감슬라이드 — 처음 오는 팀원 등록
// 팀 암호(TEAM_CODE)가 맞을 때만 이름과 개인 암호로 계정을 만들어요.
// Supabase › Edge Functions 에 "signup" 이라는 이름으로 만들고,
// 함수 설정에서 "Verify JWT" (JWT 확인)를 꺼 주세요. 아직 로그인 전이라 꺼야 해요.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// 이름을 로그인용 주소로 바꿔요 (화면과 같은 규칙)
function nameToEmail(name: string) {
  const hex = [...new TextEncoder().encode(name)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `u${hex}@hogamslide.app`;
}

// 같은 길이 비교로 암호를 맞춰 봐요
function same(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "POST로 보내 주세요" }, 405);
  try {
    const { name: rawName, password, code } = await req.json();
    const name = String(rawName ?? "").trim().replace(/\s+/g, " ");
    const team = Deno.env.get("TEAM_CODE") ?? "";
    if (!team) return reply({ error: "관리자가 아직 팀 암호를 정하지 않았어요" }, 500);
    if (!same(String(code ?? ""), team)) return reply({ error: "팀 암호가 맞지 않아요" }, 403);
    if (name.length < 2 || name.length > 10) return reply({ error: "이름은 2~10글자로 적어 주세요" }, 400);
    if (String(password ?? "").length < 6) return reply({ error: "개인 암호는 6글자 이상으로 정해 주세요" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: taken } = await admin.from("members").select("user_id").eq("name", name).maybeSingle();
    if (taken) return reply({ error: "이미 쓰고 있는 이름이에요. 다른 이름이나 이름 뒤에 숫자를 붙여 주세요" }, 409);

    const { data, error } = await admin.auth.admin.createUser({
      email: nameToEmail(name), password: String(password), email_confirm: true, user_metadata: { name },
    });
    if (error || !data.user) return reply({ error: error?.message?.includes("already") ? "이미 쓰고 있는 이름이에요" : "계정을 만들지 못했어요" }, 400);

    const { error: e2 } = await admin.from("members").insert({ user_id: data.user.id, name });
    if (e2) { await admin.auth.admin.deleteUser(data.user.id); return reply({ error: "팀원으로 등록하지 못했어요" }, 500); }
    await admin.from("edit_log").insert({ user_id: data.user.id, name, action: "join", target_type: "member", target_id: name, summary: name });
    return reply({ ok: true });
  } catch (_e) {
    return reply({ error: "요청을 읽지 못했어요" }, 400);
  }
});
