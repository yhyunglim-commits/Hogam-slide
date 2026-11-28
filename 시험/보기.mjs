// 읽기 전용 보기 화면 시험: node 시험/보기.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요. SHOT=폴더 를 주면 화면을 찍어요)
// 관리 홈에서 열기 · 보기 띠 · 쓰기/AI/송출 막기 · 남은 시간 · 나가면 그 교회 자료를 이 브라우저에서 지움 · 2시간 지나면 끝
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-view-')),z=ms=>new Promise(r=>setTimeout(r,ms));
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  if(q.url.startsWith('/config.js'))return r.end('window.HOGAM_CONFIG={SUPABASE_URL:"https://example.invalid",SUPABASE_ANON_KEY:"x"};');
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end();}
  r.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f));});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const host=`http://127.0.0.1:${srv.address().port}`,base=host+'/index.html';
const ch=spawn(CHROME,[...(process.env.HEAD?[]:['--headless=new']),'--remote-debugging-port=0',`--user-data-dir=${tmp}`,'--no-first-run','--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
const url=await new Promise(r=>{let b='';ch.stderr.on('data',d=>{b+=d;const m=b.match(/ws:\/\/\S+/);if(m)r(m[0]);});});
const ws=new WebSocket(url);await new Promise(r=>ws.onopen=r);let n=0,wait={},errs=[];
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){wait[d.id]?.(d);delete wait[d.id];}
  if(d.method==='Runtime.exceptionThrown'){const t=d.params.exceptionDetails;errs.push(t.exception?.description||t.text);}
  if(d.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true},d.sessionId);};
const send=(method,params={},sessionId)=>new Promise(r=>{wait[++n]=r;ws.send(JSON.stringify({id:n,method,params,sessionId}));});
const pages=async()=>(await send('Target.getTargets')).result.targetInfos.filter(t=>t.type==='page');
const S=(await send('Target.attachToTarget',{targetId:(await pages())[0].targetId,flatten:true})).result.sessionId;
for(const m of ['Runtime.enable','Page.enable'])await send(m,{},S);
const ev=async e=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true,userGesture:true},S);if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description||'eval');return r.result?.result?.value;};
const until=async(e,ms=20000)=>{const t=Date.now();while(Date.now()-t<ms){if(await ev(`return !!(${e})`).catch(()=>0))return true;await z(150);}return false;};
let ok=0,bad=0;const is=(name,v)=>{v?ok++:bad++;console.log(v?'통과':'실패',name);};
const shot=async f=>{if(SHOT)fs.writeFileSync(path.join(SHOT,f),Buffer.from((await send('Page.captureScreenshot',{format:'png'},S)).result.data,'base64'));};
const vis=id=>`(()=>{const e=$('${id}');return !!e&&e.getClientRects().length>0})()`;
const load=async()=>{await send('Page.navigate',{url:base},S);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(800);};
const day=n=>new Date(Date.now()-n*864e5).toISOString();
const C2='c2000000-0000-4000-8000-000000000002';
const SV=[{id:'s1',name:'주일예배(보기)',text:'주 하나님 지으신 모든 세계',results:[],church_id:C2,created_at:day(1),updated_at:day(1),version:3}];
// 가짜 서버: sb.from 은 표 이름별 답, sb.rpc 는 R[이름]. 진짜 요청 길목(churchFetch)은 window.fetch 를 바꿔 따로 봐요
const fake=(o={})=>ev(`window.CALLS=[];window.R=${JSON.stringify(o.r||{})};window.SUP=${JSON.stringify(o.sup??true)};
  const q=d=>{const x={select:()=>x,eq:()=>x,order:()=>x,is:()=>x,not:()=>x,limit:()=>x,in:()=>x,then:r=>r({data:d,error:null}),upsert:async()=>({error:null}),insert:async()=>({error:null}),update:()=>x,delete:()=>x};return x;};
  sb.from=t=>q(t==='members'?${JSON.stringify(o.ms||[])}:t==='churches'?[]:t==='services'?${JSON.stringify(SV)}:t==='team_settings'?[]:[]);
  sb.rpc=async(f,a)=>{CALLS.push([f,a]);if(f==='is_super')return {data:SUP,error:null};const v=R[f];return {data:v===undefined?null:v,error:null};};
  sb.auth.signOut=async()=>({error:null});window.U={id:'m1',user_metadata:{nickname:'호감'},identities:[{provider:'kakao'}]};`);
const CS=[{id:C2,name:'새빛교회',created_at:day(10),is_new:false,suspended_at:null,ai_month:3,ai_limit:0,ai_left:47,members:2,admins:1,member_limit:5,mb_limit:20,bytes:0,last_used:day(1)}];
try{
  await load();await ev(`localStorage.clear();sessionStorage.clear()`);await load();
  // 1) 관리 홈 → 교회 상세 → 읽기 전용으로 보기
  await fake({r:{super_home:{ai_month:0,ai_service:3000,ai_days:Array(14).fill(0),tokens:{},people:2,agreed:2,terms_ver:1,log:[]},super_churches:CS,
    super_church:{memo:'',bytes:{},history:[],ai_kinds:[],ai_days:Array(14).fill(0),free:47,paid:0,info:null},super_members:[],super_view_open:{ok:true,name:'새빛교회',until:new Date(Date.now()+7200e3).toISOString()}}});
  await ev(`localStorage.setItem('cj_c:c1000000-0000-4000-8000-000000000001:keep','"내 교회 것"');localStorage.setItem('cj_theme','"dark"');await afterLogin(U);await new Promise(r=>setTimeout(r,200));admGo('churches');await new Promise(r=>setTimeout(r,300));document.querySelector('#spGrid .spcard').click();await new Promise(r=>setTimeout(r,300))`);
  is('교회 상세에 "읽기 전용으로 보기" 단추와 안내',await ev(`return ${vis('spView')}&&$('spPane').textContent.includes('열 때마다 호감 기록에 남고 2시간 뒤 닫혀요')&&!$('spPane').textContent.includes('호감에게도 보이지 않아요')`));
  await shot('1-sp-view.png');
  await ev(`window.confirm=()=>false;$('spView').click();await new Promise(r=>setTimeout(r,200))`);
  is('확인 창에서 취소하면 열지 않음',await ev(`return !CALLS.some(c=>c[0]==='super_view_open')&&!sessionStorage.getItem('hogam_view')`));
  await ev(`window.confirm=()=>true;$('spView').click()`);await z(1500);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(800);
  is('열면 이 탭에 보기 표시를 남기고 새로 엶 (CH = 그 교회)',await ev(`const v=JSON.parse(sessionStorage.getItem('hogam_view')||'null');return v&&v.id==='${C2}'&&v.name==='새빛교회'&&v.until>Date.now()&&VIEW&&CH==='${C2}'`));
  // 2) 보기 화면
  await fake({r:{}});await ev(`await afterLogin(U);await new Promise(r=>setTimeout(r,400))`);
  is('보기 띠: 교회 이름 · 저장 안 됨 · 남은 시간',await ev(`return ${vis('viewBar')}&&$('viewBar').textContent.includes('읽기 전용으로 보는 중')&&$('viewBar').textContent.includes('저장되지 않아요')&&$('viewName').textContent==='새빛교회'&&/^(11[0-9]|120)분 남음$/.test($('viewLeft').textContent)`));
  is('보기 띠는 화면 아래라 위쪽 탭을 안 가림',await ev(`const r=$('viewBar').getBoundingClientRect(),t=document.querySelector('.tabs, nav, header')?.getBoundingClientRect();return r.top>innerHeight/2`));
  is('그 교회 예배가 열림',await ev(`return $('docTitle').value==='주일예배(보기)'&&me.role==='viewer'&&!$('gate').classList.contains('on')&&$('adm').hidden`));
  is('송출 · AI 읽기 · 초대 · 교회 바꾸기 단추가 숨음',await ev(`const h=id=>{const e=$(id);return !e||!e.getClientRects().length};return document.body.classList.contains('viewonly')&&['dlLive','convertBtn','invite','churchBtn'].every(h)&&[...document.querySelectorAll('[data-read]')].every(e=>!e.getClientRects().length)`));
  is('팀원 접속 방에 안 들어가고 남은 AI도 안 물음',await ev(`return !pres&&!CALLS.some(c=>c[0]==='ai_left')`));
  await shot('2-view.png');
  is('송출을 열려고 해도 막힘',await ev(`return liveOpen()===false&&$('toast').textContent.includes('송출할 수 없어요')`));
  // 3) 요청 길목: 쓰기·AI는 서버로 안 나감
  await ev(`window.NET=[];window._f=window.fetch;window.fetch=async(u,o)=>{NET.push([String(u?.url||u),o?.method||'GET',new Headers(o?.headers||{}).get('x-church')]);return new Response('[]',{status:200,headers:{'content-type':'application/json'}});};`);
  const B='https://example.invalid';
  is('예배 저장(save_service)은 서버로 안 나가고 저장된 것처럼',await ev(`const r=await churchFetch('${B}/rest/v1/rpc/save_service',{method:'POST',body:'{}'});const j=await r.json();return j.ok===true&&!NET.length`));
  is('표에 쓰기(올리기·고치기·지우기)도 안 나감',await ev(`for(const m of ['POST','PATCH','DELETE']){const r=await churchFetch('${B}/rest/v1/team_settings',{method:m});if(r.status!==204)return false;}return !NET.length`));
  is('다른 함수(초대·신청 등)도 안 나감',await ev(`for(const f of ['get_invite','pay_request','restore_from_log','purge_service','set_my_name']){const r=await churchFetch('${B}/rest/v1/rpc/'+f,{method:'POST'});if(await r.json()!==null)return false;}return !NET.length`));
  is('AI는 안내와 함께 막힘',await ev(`const r=await churchFetch('${B}/functions/v1/ai',{method:'POST'});const j=await r.json();return r.status===403&&j.code==='view'&&!NET.length`));
  is('읽기는 그 교회 번호를 달고 나감',await ev(`await churchFetch('${B}/rest/v1/services?select=*',{method:'GET'});await churchFetch('${B}/rest/v1/rpc/super_home',{method:'POST'});return NET.length===2&&NET.every(n=>n[2]==='${C2}')`));
  await ev(`window.fetch=window._f`);
  is('교회 바꾸기 전 저장 확인(flushAll)은 바로 통과',await ev(`return (await flushAll())===''`));
  is('팀원 확인(checkIn)으로 "나가게 됨"이 안 뜸',await ev(`await checkIn(true);return ${vis('viewBar')}&&!$('gate').classList.contains('on')`));
  // 4) 남은 시간 · 나가기
  await ev(`VIEW.until=Date.now()+5*60000+1000;viewTick()`);is('남은 시간이 줄어듦',await ev(`return $('viewLeft').textContent==='6분 남음'`));
  is('보는 동안 받은 자료는 그 교회 칸에만 저장',await ev(`return Object.keys(localStorage).some(k=>k.startsWith('cj_c:${C2}:'))`));
  await ev(`$('viewOut').click()`);await z(1500);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(2000);
  is('나가면 보기 표시가 지워지고 관리 홈 쪽으로',await ev(`return !sessionStorage.getItem('hogam_view')&&!VIEW&&!sessionStorage.getItem('cj_church')`));
  is('나가면 그 교회 자료를 이 브라우저에서 지움',await ev(`return !Object.keys(localStorage).some(k=>k.startsWith('cj_c:${C2}:'))`));
  is('내 다른 교회 자료와 개인 설정은 그대로',await ev(`return localStorage.getItem('cj_c:c1000000-0000-4000-8000-000000000001:keep')==='"내 교회 것"'&&localStorage.getItem('cj_theme')==='"dark"'`));
  is('끝냈다는 알림',await ev(`return $('toast').textContent.includes('읽기 전용 보기를 끝냈어요')`));
  // 5) 2시간이 지나 다시 열면 끝
  await ev(`sessionStorage.setItem('hogam_view',JSON.stringify({id:'${C2}',name:'새빛교회',until:Date.now()-1000}));sessionStorage.setItem('cj_church','${C2}');localStorage.setItem('cj_c:${C2}:sessions','[]')`);
  await load();await fake({r:{}});ev(`await afterLogin(U)`).catch(()=>{});await z(1500);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(2000);
  is('2시간이 지났으면 열지 않고 지우고 알림',await ev(`return !sessionStorage.getItem('hogam_view')&&!localStorage.getItem('cj_c:${C2}:sessions')&&$('toast').textContent.includes('2시간이 끝났어요')`));
  // 6) 호감이 아니면 보기 표시를 무시하고 지움
  await ev(`sessionStorage.setItem('hogam_view',JSON.stringify({id:'${C2}',name:'새빛교회',until:Date.now()+3600e3}));sessionStorage.setItem('cj_church','${C2}')`);
  await load();await fake({r:{},sup:false});ev(`await afterLogin(U)`).catch(()=>{});await z(1500);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(800);
  is('호감이 아니면 보기 화면이 안 열리고 표시가 지워짐',await ev(`return !sessionStorage.getItem('hogam_view')&&!document.body.classList.contains('viewonly')`));
  // 7) 이미 팀원인 교회면 내 자료라 지우지 않음
  await ev(`sessionStorage.setItem('hogam_view',JSON.stringify({id:'${C2}',name:'새빛교회',until:Date.now()+3600e3}));sessionStorage.setItem('cj_church','${C2}');localStorage.setItem('cj_c:${C2}:zz_test_keep','"팀원 자료"')`);
  await load();await fake({r:{},ms:[{name:'호감',church_id:C2,role:'admin'}]});ev(`await afterLogin(U)`).catch(()=>{});await z(1500);await until(`document.readyState==='complete'&&typeof afterLogin==='function'`);await z(800);
  is('팀원인 교회는 보기를 끝내도 자료를 안 지움',await ev(`return !sessionStorage.getItem('hogam_view')&&localStorage.getItem('cj_c:${C2}:zz_test_keep')==='"팀원 자료"'`));
  // 8) 휴대폰 폭
  await ev(`sessionStorage.setItem('hogam_view',JSON.stringify({id:'${C2}',name:'새빛교회',until:Date.now()+3600e3}));sessionStorage.setItem('cj_church','${C2}')`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true},S);
  await load();await fake({r:{}});await ev(`await afterLogin(U);await new Promise(r=>setTimeout(r,300))`);
  is('휴대폰 폭: 보기 띠가 화면 아래 한 줄',await ev(`const r=$('viewBar').getBoundingClientRect();return ${vis('viewBar')}&&r.left>=0&&r.right<=innerWidth&&r.height<56&&r.bottom>innerHeight-80`));
  await shot('3-phone-view.png');
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,300)));
}catch(e){bad++;console.log('멈춤',e.message);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
