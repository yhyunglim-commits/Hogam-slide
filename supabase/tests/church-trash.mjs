// 예배 휴지통 자동 시험. 시험 프로젝트에서만 돌려요.  TEST_URL=... TEST_KEY=... TEST_PW=... node supabase/tests/church-trash.mjs
// A = test2 (옥수교회), B = test3 (시험교회). 30일 뒤 자동 삭제는 church-trash-old.sql 로 따로 봐요.
import { readFileSync } from 'node:fs';
const URL_ = process.env.TEST_URL, KEY = process.env.TEST_KEY, PW = process.env.TEST_PW;
const live = readFileSync(new URL('../../config.js', import.meta.url), 'utf8').match(/SUPABASE_URL:\s*'([^']+)'/)[1];
if (!URL_ || !KEY || !PW) { console.error('TEST_URL, TEST_KEY, TEST_PW를 넣어 주세요'); process.exit(2); }
if (URL_.replace(/\/$/, '') === live.replace(/\/$/, '')) { console.error('실제 서버 주소예요. 시험 프로젝트에서만 돌려요'); process.exit(2); }
async function login(email) {
  const t = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json();
  if (!t.access_token) { console.error('로그인 실패', email, t); process.exit(2); }
  const api = async (path, { method = 'GET', body, prefer } = {}) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { apikey: KEY, Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, body: body && JSON.stringify(body) });
    const x = await r.text(); let j; try { j = x ? JSON.parse(x) : null; } catch { j = x; }
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${x}`);
    return j;
  };
  return { api, rpc: (f, b) => api(`rpc/${f}`, { method: 'POST', body: b }), patch: (id, b) => api(`services?id=eq.${id}`, { method: 'PATCH', body: b, prefer: 'return=representation' }), get: async (id) => (await api(`services?id=eq.${id}&select=*`))[0] };
}
const A = await login('test2@hogamslide.app'), B = await login('test3@hogamslide.app');
let fail = 0;
async function check(name, fn) {
  try { const why = await fn(); if (why) { fail++; console.log('실패 ·', name, '·', why); } else console.log('통과 ·', name); }
  catch (e) { fail++; console.log('실패 ·', name, '·', e.message); }
}
const ID = 'trash-' + Date.now(), save = (base, text) => A.rpc('save_service', { p_id: ID, p_base: base, p_name: '휴지통 시험', p_text: text, p_results: [], p_verse_in: '', p_b_title: '', p_dirty: false });
let first;
await check('예배를 휴지통에 넣으면 지운 때·지운 사람을 서버가 적음 (고친 때는 그대로)', async () => {
  await save(null, '비밀내용'); first = await A.get(ID);
  const [x] = await A.patch(ID, { deleted_at: '2000-01-01T00:00:00Z', deleted_by_name: '가짜' });
  if (Math.abs(Date.now() - Date.parse(x.deleted_at)) > 120e3) return '지운 때 ' + x.deleted_at;
  if (x.deleted_by_name !== '옥수시험') return x.deleted_by_name;
  if (x.updated_at !== first.updated_at) return '고친 때가 바뀜';
});
await check('지운 때를 나중에 바꿀 수 없음', async () => {
  const b = await A.get(ID), [x] = await A.patch(ID, { deleted_at: '2000-01-01T00:00:00Z' });
  if (x.deleted_at !== b.deleted_at) return x.deleted_at;
});
await check('다른 교회는 휴지통을 못 보고, 못 되돌리고, 완전히 못 지움', async () => {
  if (await B.get(ID)) return '보임';
  if ((await B.patch(ID, { deleted_at: null })).length) return '되돌려짐';
  if ((await B.rpc('purge_service', { p_id: ID })) !== false || !(await A.get(ID))) return '지워짐';
});
await check('휴지통에 있는 예배를 모르고 저장하면 막고 알려 줌', async () => {
  const r = await save(first.version, '모르고 고침');
  if (r.ok || !r.trashed || r.by !== '옥수시험') return JSON.stringify(r);
});
await check('되돌리면 내용 그대로 나옴 · 기록에 남음', async () => {
  const [x] = await A.patch(ID, { deleted_at: null });
  if (x.deleted_at || x.deleted_by_name || x.text !== '비밀내용' || x.updated_at !== first.updated_at) return JSON.stringify(x);
  const l = await A.api(`edit_log?target_id=eq.${ID}&select=action&order=at.desc,id.desc&limit=1`);
  if (l[0]?.action !== 'restore') return JSON.stringify(l);
});
await check('휴지통에 없는 예배는 완전히 지울 수 없음', async () => {
  if ((await A.rpc('purge_service', { p_id: ID })) !== false || !(await A.get(ID))) return '지워짐';
});
await check('편집 기록에서 지운 것을 되돌려도 휴지통에서 나옴', async () => {
  await A.patch(ID, { deleted_at: new Date().toISOString() });
  const [l] = await A.api(`edit_log?target_id=eq.${ID}&action=eq.delete&select=id&order=id.desc&limit=1`);
  await A.rpc('restore_from_log', { p_log_id: l.id });
  if ((await A.get(ID)).deleted_at) return '아직 휴지통';
});
await check("'내 글로 저장'하면 휴지통에서 나옴", async () => {
  await A.patch(ID, { deleted_at: new Date().toISOString() });
  const r = await save((await A.get(ID)).version, '비밀내용 둘'), x = await A.get(ID);
  if (!r.ok || x.deleted_at || x.text !== '비밀내용 둘') return JSON.stringify([r, x]);
});
await check('완전히 지우면 예배도, 편집 기록에 남은 내용도 사라짐', async () => {
  await A.patch(ID, { deleted_at: new Date().toISOString() });
  if ((await A.rpc('purge_service', { p_id: ID })) !== true) return '안 지워짐';
  if (await A.get(ID)) return '예배가 남음';
  const l = await A.api(`edit_log?target_id=eq.${ID}&select=action,before,summary`);
  if (l.length !== 1 || l[0].action !== 'purge' || l[0].before) return JSON.stringify(l).slice(0, 300);
});
await check('자동 정리 함수는 화면에서 부를 수 없음', async () => {
  for (const [f, b] of [['purge_old_trash', {}], ['purge_one', { p_church: first.church_id, p_id: ID, p_name: 'x' }]])
    if (await A.rpc(f, b).then(() => true, () => false)) return f;
});
console.log(fail ? `\n${fail}개 실패` : '\n모두 통과');
process.exit(fail ? 1 : 0);
