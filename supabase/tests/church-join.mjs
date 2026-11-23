// 교회별 공간 3단계 자동 시험: 초대 코드로 교회 들어가기 (join_church).
// 시험 프로젝트에서만 돌려요.  TEST_URL=... TEST_KEY=... TEST_PW=... node supabase/tests/church-join.mjs
// 돌리기 전에 church-join-reset.sql 을 넣어서 test4·test5 를 '아무 교회에도 안 속한 사람'으로 되돌려요.
// test3 = 시험교회 팀원 '다른교회시험', test2 = 옥수교회 팀원 '옥수시험', test4·test5 = 새로 오는 사람. 암호는 모두 TEST_PW.
import { readFileSync } from 'node:fs';
const URL_ = process.env.TEST_URL, KEY = process.env.TEST_KEY, PW = process.env.TEST_PW;
const live = readFileSync(new URL('../../config.js', import.meta.url), 'utf8').match(/SUPABASE_URL:\s*'([^']+)'/)[1];
if (!URL_ || !KEY || !PW) { console.error('TEST_URL, TEST_KEY, TEST_PW를 넣어 주세요'); process.exit(2); }
if (URL_.replace(/\/$/, '') === live.replace(/\/$/, '')) { console.error('실제 서버 주소예요. 시험 프로젝트에서만 돌려요'); process.exit(2); }
const C2 = '00000000-0000-0000-0000-000000000002';

async function login(email) {
  let auth = KEY;
  if (email) {
    const t = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json();
    if (!t.access_token) { console.error('로그인 실패', email, t); process.exit(2); }
    auth = t.access_token;
  }
  const api = async (path, { method = 'GET', body } = {}) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { apikey: KEY, Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
    const t = await r.text(); let j; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
    return j;
  };
  return { api, join: (code, name) => api('rpc/join_church', { method: 'POST', body: { p_code: code, p_name: name } }) };
}
const anon = await login(null), B = await login('test3@hogamslide.app'), N4 = await login('test4@hogamslide.app'), N5 = await login('test5@hogamslide.app');
const { code: CODE } = await B.api('rpc/get_invite', { method: 'POST', body: {} });
if ((await N4.api('churches?select=id')).length) { console.error('test4가 이미 교회에 들어가 있어요. church-join-reset.sql 을 먼저 넣어 주세요'); process.exit(2); }

let fail = 0;
async function check(name, fn) {
  try { const why = await fn(); if (why) { fail++; console.log('실패 ·', name, '·', why); } else console.log('통과 ·', name); }
  catch (e) { fail++; console.log('실패 ·', name, '·', e.message); }
}

await check('로그인 안 한 사람은 교회에 들어갈 수 없음', async () => {
  const r = await anon.join(CODE, '몰래').catch(() => 'blocked');
  if (r !== 'blocked') return JSON.stringify(r);
});
await check('교회 팀원은 자기 교회 초대 코드만 봄', async () => {
  const c = await B.api('churches?select=id,invite_code');
  if (c.length !== 1 || c[0].id !== C2 || !/^[A-HJ-NP-Z2-9]{8}$/.test(c[0].invite_code)) return JSON.stringify(c);
});
await check('들어가기 전에는 어느 교회도, 초대 코드도 안 보임', async () => {
  const c = await N4.api('churches?select=id,invite_code'), s = await N4.api('songs?select=title');
  if (c.length || s.length) return `교회 ${c.length}, 곡 ${s.length}`;
});
await check('틀린 초대 코드는 막힘', async () => {
  const r = await N4.join('ZZZZZZZZ', '새교인');
  if (r.ok || !/맞지 않거나/.test(r.error)) return JSON.stringify(r);
});
await check('이름이 너무 짧으면 막힘', async () => {
  const r = await N4.join(CODE, '김');
  if (r.ok || !/2~10글자/.test(r.error)) return JSON.stringify(r);
});
await check('같은 교회에 같은 이름이 있으면 막힘', async () => {
  const r = await N4.join(CODE, '다른교회시험');
  if (r.ok || !/같은 이름/.test(r.error)) return JSON.stringify(r);
});
await check('다른 교회에 있는 이름은 써도 됨 · 코드는 소문자·띄어쓰기도 받아 줌', async () => {
  const loose = CODE.toLowerCase().slice(0, 4) + ' ' + CODE.toLowerCase().slice(4);
  const r = await N4.join(loose, '  옥수시험 '); // 옥수교회 팀원 이름과 같아요
  if (!r.ok || r.church !== '시험교회') return JSON.stringify(r);
});
await check('들어간 뒤에는 그 교회 것만 보임', async () => {
  const c = await N4.api('churches?select=id'), s = await N4.api('songs?select=church_id'), m = await N4.api('members?select=name,church_id');
  if (c.length !== 1 || c[0].id !== C2) return `교회 ${JSON.stringify(c)}`;
  if (!s.length || s.some((x) => x.church_id !== C2)) return `곡 ${JSON.stringify(s)}`;
  if (!m.some((x) => x.name === '옥수시험') || m.some((x) => x.church_id !== C2)) return `팀원 ${JSON.stringify(m)}`;
});
await check('들어간 일이 편집 기록에 남음', async () => {
  const l = await N4.api('edit_log?select=action,name&action=eq.join&order=at.desc&limit=1');
  if (!l.length || l[0].name !== '옥수시험') return JSON.stringify(l);
});
await check('이미 들어간 교회에는 또 들어갈 수 없음', async () => {
  const r = await N4.join(CODE, '두번째');
  if (r.ok || !/이미/.test(r.error)) return JSON.stringify(r);
});
await check('초대 코드를 5번 틀리면 맞는 코드도 잠시 막힘', async () => {
  for (let i = 0; i < 5; i++) await N5.join('WRONG' + i, '새교인');
  const r = await N5.join(CODE, '새교인');
  if (r.ok || !/여러 번 틀렸어요/.test(r.error)) return JSON.stringify(r);
  if ((await N5.api('churches?select=id')).length) return '막혔다면서 교회에 들어가짐';
});

console.log(fail ? `\n${fail}개 실패` : '\n모두 통과');
process.exit(fail ? 1 : 0);
