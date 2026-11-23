// 교회별 공간 1단계 자동 시험: 화면이 서버를 부르는 방식 그대로 불러서 확인해요.
// 시험 프로젝트에서만 돌려요.  TEST_URL=... TEST_KEY=... TEST_PW=... node supabase/tests/church-step1.mjs
import { readFileSync } from 'node:fs';
const URL_ = process.env.TEST_URL, KEY = process.env.TEST_KEY, EMAIL = process.env.TEST_EMAIL || 'test1@hogamslide.app', PW = process.env.TEST_PW;
const live = readFileSync(new URL('../../config.js', import.meta.url), 'utf8').match(/SUPABASE_URL:\s*'([^']+)'/)[1];
if (!URL_ || !KEY || !PW) { console.error('TEST_URL, TEST_KEY, TEST_PW를 넣어 주세요'); process.exit(2); }
if (URL_.replace(/\/$/, '') === live.replace(/\/$/, '')) { console.error('실제 서버 주소예요. 시험 프로젝트에서만 돌려요'); process.exit(2); }
const OKSU = '00000000-0000-0000-0000-000000000001';

const tok = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: EMAIL, password: PW }) })).json();
if (!tok.access_token) { console.error('로그인 실패', tok); process.exit(2); }
const H = { apikey: KEY, Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };
async function api(path, { method = 'GET', body, prefer } = {}) {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: body && JSON.stringify(body) });
  const t = await r.text(); let j; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
  return j;
}
// supabase-js의 upsert와 같은 방식 (onConflict 없이)
const upsert = (t, row) => api(t, { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=representation' });
const rpc = (f, args) => api(`rpc/${f}`, { method: 'POST', body: args });

let fail = 0;
async function check(name, fn) {
  try { const why = await fn(); if (why) { fail++; console.log('실패 ·', name, '·', why); } else console.log('통과 ·', name); }
  catch (e) { fail++; console.log('실패 ·', name, '·', e.message); }
}

await check('교회 표시를 붙여도 고친 사람·판 번호·편집 기록이 그대로', async () => {
  // 시험 데이터의 '시험 예배'는 넣기만 하고 고친 적이 없어요. 고침 기록이나 판 번호 2가 있으면 옮기면서 생긴 것이에요.
  const [s] = await api('services?select=version,updated_by_name&id=eq.svc-test-1');
  const l = await api('edit_log?select=id&target_id=eq.svc-test-1&action=eq.edit');
  if (s.version !== 1) return `판 번호 ${s.version}`;
  if (l.length) return `고침 기록 ${l.length}줄`;
});
await check('있던 곡이 모두 옥수교회 것', async () => {
  const s = await api('songs?select=title,church_id');
  if (s.length < 2) return `곡이 ${s.length}개뿐`;
  const bad = s.filter((x) => x.church_id !== OKSU); if (bad.length) return `${bad.length}개가 다른 교회`;
});
await check('같은 제목으로 저장하면 새로 생기지 않고 고쳐짐', async () => {
  const before = (await api('songs?select=title')).length;
  const v0 = (await api('songs?select=version&title=eq.시험곡 둘'))[0].version;
  const [row] = await upsert('songs', { title: '시험곡 둘', result: { slides: ['다시'] }, thumb: null });
  const after = (await api('songs?select=title')).length;
  if (after !== before) return `곡 수 ${before} → ${after}`;
  if (row.church_id !== OKSU) return `교회 ${row.church_id}`;
  if (row.version !== v0 + 1) return `판 번호 ${v0} → ${row.version}`;
});
await check('새 곡은 저장한 사람의 교회로 들어감', async () => {
  const [row] = await upsert('songs', { title: '시험곡 셋', result: { slides: [] }, thumb: null });
  await api('songs?title=eq.시험곡 셋', { method: 'DELETE' });
  if (row.church_id !== OKSU) return `교회 ${row.church_id}`;
});
await check('팀 설정 저장이 겹치지 않음', async () => {
  await upsert('team_settings', { key: 'look', value: { a: 2 } });
  const s = await api('team_settings?select=key,church_id,value&key=eq.look');
  if (s.length !== 1) return `look이 ${s.length}개`;
  if (s[0].church_id !== OKSU || s[0].value.a !== 2) return JSON.stringify(s[0]);
});
await check('예배 저장 · 판 번호 충돌 막기', async () => {
  const id = 'svc-test-' + Date.now();
  const args = (base) => ({ p_id: id, p_base: base, p_name: '자동 시험 예배', p_text: '', p_results: [], p_verse_in: '', p_b_title: '', p_dirty: false });
  const a = await rpc('save_service', args(null)); if (!a.ok) return '처음 저장 실패';
  const b = await rpc('save_service', args(a.version)); if (!b.ok) return '이어 저장 실패';
  const c = await rpc('save_service', args(a.version)); if (c.ok) return '옛 판으로 덮어쓰기가 막히지 않음';
  const [row] = await api(`services?select=church_id&id=eq.${id}`);
  await api(`services?id=eq.${id}`, { method: 'PATCH', body: { deleted_at: new Date().toISOString() } }); // 바로 지우기는 닫혀서 휴지통으로
  if (row.church_id !== OKSU) return `교회 ${row.church_id}`;
});
await check('편집 기록에 교회가 붙음', async () => {
  const l = await api('edit_log?select=church_id&order=at.desc&limit=10');
  const bad = l.filter((x) => x.church_id !== OKSU); if (bad.length) return `${bad.length}줄이 다른 교회`;
});
await check('되돌리기가 곡을 새로 만들지 않고 되돌림', async () => {
  const [log] = await api('edit_log?select=id&target_type=eq.song&target_id=eq.시험곡 하나&before=not.is.null&order=at.asc&limit=1');
  if (!log) return '되돌릴 기록이 없음';
  const before = (await api('songs?select=title')).length;
  const msg = await rpc('restore_from_log', { p_log_id: log.id });
  const after = (await api('songs?select=title')).length;
  if (after !== before) return `곡 수 ${before} → ${after}`;
  if (!/되돌렸어요/.test(msg)) return msg;
});
await check('교회 목록에는 내 교회만', async () => {
  const c = await api('churches?select=id,name');
  if (c.length !== 1 || c[0].id !== OKSU) return JSON.stringify(c);
});

console.log(fail ? `\n${fail}개 실패` : '\n모두 통과');
process.exit(fail ? 1 : 0);
