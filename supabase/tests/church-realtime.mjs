// 교회별 공간 실시간 시험: 접속 중 방이 교회별로 잠겼는지, 다른 교회 지움 알림을 화면이 걸러낼 수 있는지 확인해요.
// 시험 프로젝트에서만 돌려요.  TEST_URL=... TEST_KEY=... TEST_PW=... node supabase/tests/church-realtime.mjs
// church-step2-seed.sql 을 넣은 뒤에 돌려요. A = test2 (옥수교회), B = test3 (시험교회).
import { readFileSync } from 'node:fs';
const URL_ = process.env.TEST_URL, KEY = process.env.TEST_KEY, PW = process.env.TEST_PW;
const live = readFileSync(new URL('../../config.js', import.meta.url), 'utf8').match(/SUPABASE_URL:\s*'([^']+)'/)[1];
if (!URL_ || !KEY || !PW) { console.error('TEST_URL, TEST_KEY, TEST_PW를 넣어 주세요'); process.exit(2); }
if (URL_.replace(/\/$/, '') === live.replace(/\/$/, '')) { console.error('실제 서버 주소예요. 시험 프로젝트에서만 돌려요'); process.exit(2); }
const OKSU = '00000000-0000-0000-0000-000000000001', C2 = '00000000-0000-0000-0000-000000000002';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function token(email) {
  const t = await (await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json();
  if (!t.access_token) { console.error('로그인 실패', email, t); process.exit(2); }
  return t.access_token;
}
const tA = await token('test2@hogamslide.app'), tB = await token('test3@hogamslide.app');
const rest = (tok) => async (path, { method = 'GET', body } = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: { apikey: KEY, Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: body && JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${await r.text()}`);
};

// supabase-js 없이 실시간 서버와 직접 말해요 (화면이 쓰는 것과 같은 방식)
function socket() {
  const ws = new WebSocket(`${URL_.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`);
  const got = [];
  let ref = 0; const joined = {};
  ws.onmessage = (e) => got.push(JSON.parse(e.data));
  const opened = new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  return {
    got,
    async join(topic, config, tok) {
      await opened;
      const r = String(++ref); joined[topic] = r;
      ws.send(JSON.stringify({ topic: `realtime:${topic}`, event: 'phx_join', payload: { config, ...(tok ? { access_token: tok } : {}) }, ref: r, join_ref: r }));
      for (let i = 0; i < 50; i++) {
        const m = got.find((x) => x.ref === r && x.event === 'phx_reply');
        if (m) return m.payload;
        const c = got.find((x) => x.topic === `realtime:${topic}` && x.event === 'system' && x.payload?.status === 'error');
        if (c) return { status: 'error', response: c.payload };
        await sleep(100);
      }
      return { status: 'timeout' };
    },
    send(topic, event, payload) { ws.send(JSON.stringify({ topic: `realtime:${topic}`, event, payload, ref: String(++ref), join_ref: joined[topic] })); },
    close() { ws.close(); },
  };
}
const presence = { private: true, presence: { key: 'test', enabled: true }, broadcast: { self: false } };

let fail = 0;
async function check(name, fn) {
  try { const why = await fn(); if (why) { fail++; console.log('실패 ·', name, '·', why); } else console.log('통과 ·', name); }
  catch (e) { fail++; console.log('실패 ·', name, '·', e.message); }
}

await check('우리 교회 접속 방에는 들어갈 수 있음', async () => {
  const s = socket(); const r = await s.join(`online:${OKSU}`, presence, tA); s.close();
  if (r.status !== 'ok') return JSON.stringify(r);
});
await check('다른 교회 접속 방에는 못 들어감', async () => {
  const s = socket(); const r = await s.join(`online:${OKSU}`, presence, tB); s.close();
  if (r.status === 'ok') return '들어가짐';
});
await check('로그인 안 한 사람은 접속 방에 못 들어감', async () => {
  const s = socket(); const r = await s.join(`online:${OKSU}`, presence, null); s.close();
  if (r.status === 'ok') return '들어가짐';
});
await check('같은 교회 사람 이름은 접속 방에 보임', async () => {
  const a = socket(), b = socket(), room = `online:${C2}`;
  const until = async (fn, ms = 6000) => { for (let t = 0; t < ms; t += 200) { if (fn()) return true; await sleep(200); } return false; };
  const ready = (s) => s.got.some((m) => m.topic === `realtime:${room}` && m.event === 'presence_state'); // 방 준비가 끝났다는 신호
  await a.join(room, presence, tB);
  const r = await b.join(room, { ...presence, presence: { key: 'other', enabled: true } }, tB);
  if (r.status !== 'ok') { a.close(); b.close(); return JSON.stringify(r); }
  await until(() => ready(a) && ready(b));
  b.send(room, 'presence', { type: 'presence', event: 'track', payload: { name: '다른교회시험' } });
  const seen = await until(() => a.got.some((m) => /presence_(diff|state)/.test(m.event) && JSON.stringify(m.payload).includes('다른교회시험')));
  a.close(); b.close();
  if (!seen) return '이름이 안 보임';
});
await check('다른 교회가 곡을 지우면 알림에 그 교회 번호가 붙어 옴 (화면이 걸러냄)', async () => {
  const a = socket();
  const r = await a.join('hogam-live', { postgres_changes: [{ event: '*', schema: 'public', table: 'songs' }] }, tA);
  if (r.status !== 'ok') { a.close(); return JSON.stringify(r); }
  await sleep(1500);
  const B = rest(tB), title = '실시간 시험곡 ' + Date.now();
  await B('songs', { method: 'POST', body: { title, result: { slides: [] } } });
  await B(`songs?title=eq.${encodeURIComponent(title)}`, { method: 'DELETE' });
  await sleep(2500);
  const ev = a.got.filter((m) => m.event === 'postgres_changes').map((m) => m.payload.data);
  a.close();
  if (ev.some((d) => d.type !== 'DELETE')) return '다른 교회의 넣기·고치기 알림이 옴';
  const del = ev.find((d) => d.type === 'DELETE');
  if (!del) return '지움 알림이 안 옴 (서버가 걸러 주게 바뀌었으면 이 시험을 고쳐요)';
  if (del.old_record?.church_id !== C2) return `지움 알림에 교회 번호가 없음 ${JSON.stringify(del.old_record)}`;
});

console.log(fail ? `\n${fail}개 실패` : '\n모두 통과');
process.exit(fail ? 1 : 0);
