// 교회별 공간 2단계 자동 시험: 두 교회 팀원이 서로의 것을 보거나 고칠 수 없는지 확인해요.
// 시험 프로젝트에서만 돌려요.  TEST_URL=... TEST_KEY=... TEST_PW=... node supabase/tests/church-step2.mjs
// A = test2 (옥수교회), B = test3 (시험교회). 두 사람 암호는 같아요(TEST_PW).
import { readFileSync } from 'node:fs';
const URL_ = process.env.TEST_URL, KEY = process.env.TEST_KEY, PW = process.env.TEST_PW;
const live = readFileSync(new URL('../../config.js', import.meta.url), 'utf8').match(/SUPABASE_URL:\s*'([^']+)'/)[1];
if (!URL_ || !KEY || !PW) { console.error('TEST_URL, TEST_KEY, TEST_PW를 넣어 주세요'); process.exit(2); }
if (URL_.replace(/\/$/, '') === live.replace(/\/$/, '')) { console.error('실제 서버 주소예요. 시험 프로젝트에서만 돌려요'); process.exit(2); }
const OKSU = '00000000-0000-0000-0000-000000000001', C2 = '00000000-0000-0000-0000-000000000002';

async function login(email) {
  const tok = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json();
  if (!tok.access_token) { console.error('로그인 실패', email, tok); process.exit(2); }
  const H = { apikey: KEY, Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };
  const api = async (path, { method = 'GET', body, prefer } = {}) => {
    const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: body && JSON.stringify(body) });
    const t = await r.text(); let j; try { j = t ? JSON.parse(t) : null; } catch { j = t; }
    if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t}`);
    return j;
  };
  return {
    api,
    upsert: (t, row) => api(t, { method: 'POST', body: row, prefer: 'resolution=merge-duplicates,return=representation' }),
    patch: (path, body) => api(path, { method: 'PATCH', body, prefer: 'return=representation' }),
    del: (path) => api(path, { method: 'DELETE', prefer: 'return=representation' }),
    rpc: (f, args) => api(`rpc/${f}`, { method: 'POST', body: args }),
  };
}
const A = await login('test2@hogamslide.app'), B = await login('test3@hogamslide.app');
const enc = encodeURIComponent;
// 안 되는 게 맞는 일: 오류가 나거나, 아무것도 안 바뀌면 통과
const blocked = async (fn) => { try { const r = await fn(); return Array.isArray(r) ? r.length === 0 : r == null; } catch { return true; } };

let fail = 0;
async function check(name, fn) {
  try { const why = await fn(); if (why) { fail++; console.log('실패 ·', name, '·', why); } else console.log('통과 ·', name); }
  catch (e) { fail++; console.log('실패 ·', name, '·', e.message); }
}
const onlyChurch = (rows, c, key = 'church_id') => { const bad = rows.filter((x) => x[key] !== c); return bad.length ? `${bad.length}개가 다른 교회 것` : (rows.length ? '' : '하나도 안 보임'); };

// ── 보기
await check('곡: 각자 자기 교회 곡만 보임', async () =>
  onlyChurch(await A.api('songs?select=title,church_id'), OKSU) || onlyChurch(await B.api('songs?select=title,church_id'), C2));
await check('곡: 제목이 같아도 각자 자기 교회 가사', async () => {
  const [a] = await A.api(`songs?select=result&title=eq.${enc('시험곡 하나')}`), [b] = await B.api(`songs?select=result&title=eq.${enc('시험곡 하나')}`);
  if (!a || !b) return '어느 한쪽에서 안 보임';
  if (b.result.slides[0] !== '시험교회') return `시험교회 쪽 가사 ${JSON.stringify(b.result)}`;
  if (a.result.slides[0] === '시험교회') return '옥수교회에 시험교회 가사가 보임';
});
await check('예배: 각자 자기 교회 예배만 보임', async () =>
  onlyChurch(await A.api('services?select=id,church_id'), OKSU) || onlyChurch(await B.api('services?select=id,church_id'), C2));
await check('설정: 각자 자기 교회 설정만 보임', async () => {
  const a = await A.api('team_settings?select=key,church_id,value&key=eq.look'), b = await B.api('team_settings?select=key,church_id,value&key=eq.look');
  if (a.length !== 1 || b.length !== 1) return `look이 옥수 ${a.length}개, 시험교회 ${b.length}개`;
  if (a[0].church_id !== OKSU || b[0].church_id !== C2 || b[0].value.a !== 9) return JSON.stringify({ a, b });
});
await check('편집 기록: 각자 자기 교회 기록만 보임', async () =>
  onlyChurch(await A.api('edit_log?select=id,church_id&limit=500'), OKSU) || onlyChurch(await B.api('edit_log?select=id,church_id&limit=500'), C2));
await check('팀원 목록: 각자 자기 교회 팀원만 보임', async () => {
  const a = await A.api('members?select=name,church_id'), b = await B.api('members?select=name,church_id');
  return onlyChurch(a, OKSU) || onlyChurch(b, C2); // 이름은 교회끼리 겹칠 수 있어서 교회 번호로만 봐요
});
await check('교회 목록: 각자 자기 교회만 보임', async () => {
  const a = await A.api('churches?select=id'), b = await B.api('churches?select=id');
  if (a.length !== 1 || a[0].id !== OKSU || b.length !== 1 || b[0].id !== C2) return JSON.stringify({ a, b });
});

// ── 다른 교회 것 고치기·지우기·넣기
await check('다른 교회 곡을 고칠 수 없음', async () => {
  const ok = await blocked(() => B.patch(`songs?title=eq.${enc('시험곡 둘')}&church_id=eq.${OKSU}`, { result: { slides: ['침입'] } }));
  const [a] = await A.api(`songs?select=result&title=eq.${enc('시험곡 둘')}`);
  if (!ok || JSON.stringify(a.result).includes('침입')) return '옥수교회 곡이 바뀜';
});
await check('다른 교회 곡을 지울 수 없음', async () => {
  await blocked(() => B.del(`songs?title=eq.${enc('시험곡 둘')}&church_id=eq.${OKSU}`));
  if (!(await A.api(`songs?select=title&title=eq.${enc('시험곡 둘')}`)).length) return '옥수교회 곡이 지워짐';
});
await check('다른 교회 이름으로 곡을 넣을 수 없음', async () => {
  const ok = await blocked(() => B.upsert('songs', { church_id: OKSU, title: '몰래 넣은 곡', result: { slides: [] } }));
  const seen = await A.api(`songs?select=title&title=eq.${enc('몰래 넣은 곡')}`);
  if (!ok || seen.length) return '옥수교회에 곡이 들어감';
});
await check('내 곡을 다른 교회로 옮길 수 없음', async () => {
  const ok = await blocked(() => B.patch(`songs?title=eq.${enc('시험곡 하나')}`, { church_id: OKSU }));
  const [b] = await B.api(`songs?select=church_id&title=eq.${enc('시험곡 하나')}`);
  if (!ok || !b) return '시험교회 곡이 옥수교회로 옮겨짐';
});
await check('같은 제목으로 저장해도 다른 교회 곡은 그대로', async () => {
  const [row] = await B.upsert('songs', { title: '시험곡 하나', result: { slides: ['시험교회'] }, thumb: null });
  const [a] = await A.api(`songs?select=result&title=eq.${enc('시험곡 하나')}`);
  if (row.church_id !== C2) return `저장된 교회 ${row.church_id}`;
  if (JSON.stringify(a.result).includes('시험교회')) return '옥수교회 곡이 바뀜';
});
await check('다른 교회 예배를 고치거나 지울 수 없음', async () => {
  const before = (await A.api('services?select=name,version&id=eq.svc-test-1'))[0];
  await blocked(() => B.patch('services?id=eq.svc-test-1', { name: '침입' }));
  await blocked(() => B.del('services?id=eq.svc-test-1'));
  await blocked(() => B.rpc('save_service', { p_id: 'svc-test-1', p_base: before.version, p_name: '침입', p_text: '', p_results: [], p_verse_in: '', p_b_title: '', p_dirty: false }));
  const [after] = await A.api('services?select=name,version&id=eq.svc-test-1');
  if (!after) return '옥수교회 예배가 지워짐';
  if (after.name !== before.name || after.version !== before.version) return `옥수교회 예배가 바뀜 ${JSON.stringify(after)}`;
});
await check('다른 교회 설정을 바꿀 수 없음', async () => {
  const before = (await A.api('team_settings?select=value&key=eq.look'))[0].value;
  await blocked(() => B.upsert('team_settings', { church_id: OKSU, key: 'look', value: { a: -1 } }));
  await blocked(() => B.patch(`team_settings?key=eq.look&church_id=eq.${OKSU}`, { value: { a: -1 } }));
  const after = (await A.api('team_settings?select=value&key=eq.look'))[0].value;
  if (JSON.stringify(after) !== JSON.stringify(before)) return `옥수교회 설정이 바뀜 ${JSON.stringify(after)}`;
});
await check('다른 교회 편집 기록으로 되돌릴 수 없음', async () => {
  const [log] = await A.api('edit_log?select=id&before=not.is.null&order=at.asc&limit=1');
  if (!log) return '옥수교회에 되돌릴 기록이 없음';
  const msg = await B.rpc('restore_from_log', { p_log_id: log.id }).catch((e) => e.message);
  if (/되돌렸어요/.test(msg)) return msg;
});

// ── 자기 교회 일은 그대로 됨
await check('자기 교회 새 예배 저장 · 판 번호 충돌 막기', async () => {
  const id = 'svc-step2-' + Date.now();
  const args = (base) => ({ p_id: id, p_base: base, p_name: '자동 시험 예배', p_text: '', p_results: [], p_verse_in: '', p_b_title: '', p_dirty: false });
  const a = await B.rpc('save_service', args(null)); if (!a.ok) return '처음 저장 실패';
  const b = await B.rpc('save_service', args(a.version)); if (!b.ok) return '이어 저장 실패';
  const c = await B.rpc('save_service', args(a.version)); if (c.ok) return '옛 판으로 덮어쓰기가 막히지 않음';
  const [row] = await B.api(`services?select=church_id&id=eq.${id}`);
  const seenByA = await A.api(`services?select=id&id=eq.${id}`);
  await B.patch(`services?id=eq.${id}`, { deleted_at: new Date().toISOString() }); // 바로 지우기는 닫혀서 휴지통으로
  if (row.church_id !== C2) return `교회 ${row.church_id}`;
  if (seenByA.length) return '옥수교회에서 보임';
});
await check('자기 교회 곡은 고치고 지울 수 있음', async () => {
  const [row] = await A.upsert('songs', { title: '시험곡 넷', result: { slides: [] }, thumb: null });
  const gone = await A.del(`songs?title=eq.${enc('시험곡 넷')}`);
  if (row.church_id !== OKSU) return `교회 ${row.church_id}`;
  if (gone.length !== 1) return '지워지지 않음';
});

console.log(fail ? `\n${fail}개 실패` : '\n모두 통과');
process.exit(fail ? 1 : 0);
