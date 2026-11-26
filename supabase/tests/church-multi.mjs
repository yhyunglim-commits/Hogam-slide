// 교회별 공간 4단계 자동 시험: 한 사람(test4, TEST_P=test5 로 바꿀 수 있음)이 교회 두 곳을 오가도 섞이지 않는지 + 새 교회 만들기.
// 시험 프로젝트에서만 돌려요.  TEST_URL=... TEST_KEY=... TEST_PW=... node supabase/tests/church-multi.mjs
// 돌리기 전에 church-join-reset.sql. test2 = 옥수교회, test3 = 시험교회 팀원, test4 = 아무 데도 안 속한 사람.
import { readFileSync } from 'node:fs';
const URL_ = process.env.TEST_URL, KEY = process.env.TEST_KEY, PW = process.env.TEST_PW;
const live = readFileSync(new URL('../../config.js', import.meta.url), 'utf8').match(/SUPABASE_URL:\s*'([^']+)'/)[1];
if (!URL_ || !KEY || !PW) { console.error('TEST_URL, TEST_KEY, TEST_PW를 넣어 주세요'); process.exit(2); }
if (URL_.replace(/\/$/, '') === live.replace(/\/$/, '')) { console.error('실제 서버 주소예요. 시험 프로젝트에서만 돌려요'); process.exit(2); }
const C2 = '00000000-0000-0000-0000-000000000002', OKSU = '00000000-0000-0000-0000-000000000001';
async function login(email) {
  const t = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json();
  if (!t.access_token) { console.error('로그인 실패', email, t); process.exit(2); }
  return (church) => {
    const api = async (path, { method = 'GET', body, prefer } = {}) => {
      const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { apikey: KEY, Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json', ...(church ? { 'x-church': church } : {}), ...(prefer ? { Prefer: prefer } : {}) }, body: body && JSON.stringify(body) });
      const x = await r.text(); let j; try { j = x ? JSON.parse(x) : null; } catch { j = x; }
      if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${x}`);
      return j;
    };
    return { api, rpc: (f, b) => api(`rpc/${f}`, { method: 'POST', body: b }),
      upsert: (tb, b) => api(tb, { method: 'POST', body: b, prefer: 'resolution=merge-duplicates,return=representation' }),
      patch: (p, b) => api(p, { method: 'PATCH', body: b, prefer: 'return=representation' }) };
  };
}
const blocked = async (fn) => { try { const r = await fn(); return Array.isArray(r) ? r.length === 0 : r == null; } catch { return true; } };
let fail = 0;
async function check(name, fn) {
  try { const why = await fn(); if (why) { fail++; console.log('실패 ·', name, '·', why); } else console.log('통과 ·', name); }
  catch (e) { fail++; console.log('실패 ·', name, '·', e.message); }
}
const all = (rows, c) => rows.length && rows.every((x) => x.church_id === c) ? '' : JSON.stringify(rows).slice(0, 300);
const P = await login((process.env.TEST_P || 'test4') + '@hogamslide.app'), B = (await login('test3@hogamslide.app'))(), A = (await login('test2@hogamslide.app'))();
const free = P();
if ((await free.api('churches?select=id')).length) { console.error('church-join-reset.sql 을 먼저 넣어 주세요'); process.exit(2); }
const { code: CODE } = await B.api('rpc/get_invite', { method: 'POST', body: {} });
let NEW, N, T;
await check('약관에 동의하기 전에는 교회를 못 만듦 (14단계)', async () => {
  const r = await free.rpc('create_church', { p_church: '새교회', p_name: '만든이' });
  if (r.ok || !/동의/.test(r.error)) return JSON.stringify(r);
  if (!(await free.rpc('agree_terms', { p_ver: 1 })).ok) return '동의가 안 됨';
});

await check('교회 이름·내 이름이 너무 짧으면 못 만듦', async () => {
  const a = await free.rpc('create_church', { p_church: '가', p_name: '만든이' }), b = await free.rpc('create_church', { p_church: '새교회', p_name: '가' });
  if (a.ok || b.ok) return JSON.stringify([a, b]);
});
await check('새 교회 만들기 · 만든 사람은 관리자 · 텅 비어 있음', async () => {
  const r = await free.rpc('create_church', { p_church: ' 새  교회 ', p_name: '만든이' });
  if (!r.ok || r.church !== '새 교회') return JSON.stringify(r);
  NEW = r.church_id; N = P(NEW); T = P(C2);
  const m = await N.api('members?select=name,role,church_id');
  if (m.length !== 1 || m[0].role !== 'admin' || m[0].name !== '만든이') return JSON.stringify(m);
  if ((await N.api('songs?select=title')).length) return '곡이 있음';
});
await check('두 번째 교회는 못 만듦', async () => {
  const r = await N.rpc('create_church', { p_church: '또교회', p_name: '만든이' });
  if (r.ok || !/한 곳만/.test(r.error)) return JSON.stringify(r);
});
await check('초대로 다른 교회에도 들어감 (이름은 교회마다 따로)', async () => {
  const r = await N.rpc('join_church', { p_code: CODE, p_name: '두교회사람' });
  if (!r.ok || r.church_id !== C2) return JSON.stringify(r);
});
await check('내 교회 목록에는 두 곳이 다 보임', async () => {
  const c = await N.api('churches?select=id'), m = await N.api(`members?select=church_id&user_id=eq.${await me()}`);
  if (c.length !== 2 || m.length !== 2) return JSON.stringify([c, m]);
});
async function me() { return (await N.api('members?select=user_id&name=eq.' + encodeURIComponent('만든이')))[0].user_id; }
await check('같은 제목의 곡을 두 교회에 저장해도 따로', async () => {
  await N.upsert('songs', { title: '섞임시험', result: { slides: ['새교회것'] } });
  await T.upsert('songs', { title: '섞임시험', result: { slides: ['시험교회것'] } });
  const n = await N.api('songs?select=*'), t = await T.api('songs?select=*');
  const x = n.find((s) => s.title === '섞임시험'), y = t.find((s) => s.title === '섞임시험');
  if (x?.result.slides[0] !== '새교회것' || y?.result.slides[0] !== '시험교회것') return JSON.stringify([x, y]);
  if (x.updated_by_name !== '만든이' || y.updated_by_name !== '두교회사람') return `고친 사람 ${x.updated_by_name}/${y.updated_by_name}`;
  return all(n, NEW) || all(t, C2);
});
await check('설정도 따로', async () => {
  await N.upsert('team_settings', { key: 'multi', value: 1 }); await T.upsert('team_settings', { key: 'multi', value: 2 });
  const n = await N.api('team_settings?select=*'), t = await T.api('team_settings?select=*');
  if (n.find((s) => s.key === 'multi').value !== 1 || t.find((s) => s.key === 'multi').value !== 2) return JSON.stringify([n, t]);
  return all(n, NEW) || all(t, C2);
});
const svc = (id, name, base = null) => ({ p_id: id, p_base: base, p_name: name, p_text: '', p_results: [], p_verse_in: '', p_b_title: '', p_dirty: false });
const S = 'multi-' + Date.now();
await check('예배도 따로 · 다른 교회 예배 번호로 저장하면 막힘', async () => {
  if (!(await N.rpc('save_service', svc(S, '새교회 예배'))).ok) return '저장 안 됨';
  if (!(await T.rpc('save_service', svc(S + 't', '시험교회 예배'))).ok) return '저장 안 됨';
  if (!(await blocked(() => T.rpc('save_service', svc(S, '덮어쓰기', 1))))) return '다른 교회 예배가 고쳐짐';
  return all(await N.api('services?select=*'), NEW) || all(await T.api('services?select=*'), C2);
});
await check('편집 기록·팀원 목록도 지금 교회 것만', async () => {
  const l = await N.api('edit_log?select=*');
  if (l.some((x) => x.name !== '만든이')) return JSON.stringify(l).slice(0, 300);
  return all(l, NEW) || all(await T.api('edit_log?select=church_id'), C2);
});
await check('지금 교회가 아닌 곳을 콕 집어 써도 막힘', async () => {
  if (!(await blocked(() => N.upsert('songs', { church_id: C2, title: '몰래', result: {} })))) return '저장됨';
  if (!(await blocked(() => N.patch(`songs?church_id=eq.${C2}`, { hymn: 1 })))) return '고쳐짐';
});
await check('곡·예배·설정을 다른 교회로 옮길 수 없음 (교회를 안 알려도)', async () => {
  for (const [p] of [[`songs?church_id=eq.${NEW}&title=eq.${encodeURIComponent('섞임시험')}`], [`services?id=eq.${S}`], [`team_settings?church_id=eq.${NEW}&key=eq.multi`]])
    if (!(await blocked(() => P().patch(p, { church_id: C2, ...(p.startsWith('songs') ? { title: '옮김' } : p.startsWith('team') ? { key: 'moved' } : {}) })))) return p;
});
await check('두 교회 사람이 교회를 안 알리면 저장이 막힘 (짐작하지 않음)', async () => {
  if (!(await blocked(() => P().upsert('songs', { title: '어디로', result: {} })))) return '곡 저장됨';
  if (!(await blocked(() => P().rpc('save_service', svc(S + 'x', '어디로'))))) return '예배 저장됨';
});
await check('안 속한 교회·이상한 교회 번호를 알리면 아무것도 안 됨', async () => {
  for (const c of [OKSU, 'abc', OKSU + 'x']) {
    const X = P(c);
    if ((await X.api('songs?select=title')).length || (await X.api('services?select=id')).length) return c + ' 보임';
    if (!(await blocked(() => X.upsert('songs', { title: '몰래', result: {} })))) return c + ' 저장됨';
  }
});
await check('되돌리기: 다른 교회 기록은 못 되돌림, 내 교회 것은 됨', async () => {
  await N.patch(`songs?title=eq.${encodeURIComponent('섞임시험')}`, { result: { slides: ['고침'] } });
  await N.api(`songs?title=eq.${encodeURIComponent('섞임시험')}`, { method: 'DELETE' });
  const [l] = await N.api('edit_log?select=id&action=eq.delete&order=at.desc&limit=1');
  const no = await T.rpc('restore_from_log', { p_log_id: l.id });
  if (!/없는 기록/.test(no)) return no;
  await N.rpc('restore_from_log', { p_log_id: l.id });
  const s = await N.api('songs?select=result'), t = await T.api(`songs?select=result&title=eq.${encodeURIComponent('섞임시험')}`);
  if (s[0]?.result.slides[0] !== '고침' || t[0]?.result.slides[0] !== '시험교회것') return JSON.stringify([s, t]);
});
await check('한 교회 팀원은 교회를 안 알려도 그대로 씀 (지금 화면)', async () =>
  all(await A.api('songs?select=church_id'), OKSU) || all(await A.upsert('songs', { title: '옛화면', result: {} }), OKSU));
await check('브라우저가 x-church 를 보내도 서버가 받아 줌 (CORS)', async () => {
  const r = await fetch(`${URL_}/rest/v1/songs`, { method: 'OPTIONS', headers: { Origin: 'https://yhyunglim-commits.github.io', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'apikey,authorization,x-church' } });
  const h = r.headers.get('access-control-allow-headers') || '';
  if (!r.ok || !(/x-church/i.test(h) || h === '*')) return r.status + ' ' + h;
});
// 시험교회·옥수교회에 남긴 것 치우기
await A.api(`songs?title=eq.${encodeURIComponent('옛화면')}`, { method: 'DELETE' }).catch(() => {});
if (T) for (const p of [`songs?title=eq.${encodeURIComponent('섞임시험')}`, `services?id=eq.${S}t`, 'team_settings?key=eq.multi']) await T.api(p, { method: 'DELETE' }).catch(() => {});
console.log(fail ? `\n${fail}개 실패` : '\n모두 통과');
process.exit(fail ? 1 : 0);
