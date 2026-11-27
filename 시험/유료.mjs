// 유료 1단계 화면 시험: node 시험/유료.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요. SHOT=폴더 를 주면 화면을 찍어요)
// 남은 AI 표시 · 다 쓰면 충전 신청 · 신청 창 · 교회 정보 창(신청 내역 · 교회 주소) · 새 교회 주소 · 관리 홈 유료 신청·입금(승인·취소·환불됨)
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-pay-')),z=ms=>new Promise(r=>setTimeout(r,ms));
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
// 가짜 서버: 부른 함수를 CALLS에 적고, window.R[함수 이름]의 답을 돌려줘요 (함수면 불러서)
const fake=(role='member')=>ev(`window.CALLS=[];window.R={};
  sb.rpc=async(f,a)=>{CALLS.push([f,a]);const r=R[f];const v=typeof r==='function'?r(a):r;return v===undefined?{data:null,error:null}:{data:v,error:null};};
  Object.defineProperty(sb,'functions',{configurable:true,value:{invoke:async()=>({data:R.__ai,error:null})}}); // sb.functions는 부를 때마다 새로 만들어져서 통째로 바꿔요
  window.daum={Postcode:function(o){this.embed=el=>{el.innerHTML='<button type="button" id="fakePick">고르기</button>';el.querySelector('button').onclick=()=>o.oncomplete({roadAddress:'서울 성동구 무학로 1',zonecode:'04701'});};}};
  me={id:'u1',name:'김목자',church:'c1',role:'${role}'};CHURCHES=[{id:'c1',name:'호감교회',my:'김목자'}];RU=null;hideGate();hideAdm();`);
const called=f=>ev(`return CALLS.filter(c=>c[0]==='${f}').length`);
const AQ=(o={})=>JSON.stringify({limit:0,month:0,free:0,paid:0,left:0,pending:false,...o});
try{
  await load();await ev(`localStorage.clear()`);await load();
  // 1) 남은 AI 표시
  await fake();await ev(`R.ai_left=${AQ({left:42.4,free:12.4,paid:30})};R.church_usage={ai_limit:0,member_limit:5,mb_limit:20,members:4,ai_month:9,bytes:14.2*1048576,month:0,free:12.4,paid:30,left:42.4};await aiLeft(true);await new Promise(r=>setTimeout(r,200))`);
  is('남은 AI는 소수 한 자리까지 "AI 42.4번 남음"',await ev(`return [...document.querySelectorAll('.aileft')].some(e=>!e.hidden&&e.textContent.startsWith('AI 42.4번 남음'))`));
  is('남아 있으면 충전 안내 없음',await ev(`return [...document.querySelectorAll('.aimore')].every(e=>e.hidden)`));
  is('옆 메뉴 사용량: AI 남은 횟수와 어디서 온 것인지',await ev(`const t=$('railUse').textContent;return t.includes('AI 남은 횟수')&&t.includes('42.4번')&&t.includes('처음 무료 12.4')&&t.includes('충전 30')&&!t.includes('이번 달 무료')`));
  await ev(`R.ai_left=${AQ({left:0.8,free:0.8})};await aiLeft(true)`);
  is('1번이 안 남으면(0.8) 충전 안내가 뜸',await ev(`return [...document.querySelectorAll('.aimore')].some(e=>!e.hidden&&e.querySelector('button').textContent==='충전 신청')`));
  await ev(`R.ai_left=${AQ()};await aiLeft(true)`);
  is('다 쓰면 "AI를 다 썼어요" + 50번 5천 원 안내',await ev(`const a=[...document.querySelectorAll('.aileft')].find(e=>!e.hidden),m=[...document.querySelectorAll('.aimore')].find(e=>!e.hidden);return a.textContent==='AI를 다 썼어요'&&a.classList.contains('no')&&m.textContent.includes('50번에 5천 원')&&!m.textContent.includes('100원')`));
  is('악보 읽기는 남은 횟수만큼만 (0번이면 0곡)',await ev(`return Math.floor(AIQ.left)===0&&await aiOut()`));
  await ev(`R.ai_left=${AQ({limit:50})};await aiLeft(true)`);
  is('초기 교회(매달 50번)는 다음 달 안내도 같이',await ev(`return [...document.querySelectorAll('.aimore')].some(e=>!e.hidden&&e.textContent.includes('다음 달 1일에 50번'))`));
  // 2) 충전 신청 창
  await ev(`R.ai_left=${AQ()};await aiLeft(true);[...document.querySelectorAll('.aimore')].find(e=>!e.hidden).querySelector('button').click();await new Promise(r=>setTimeout(r,200))`);
  is('충전 신청 → 신청 창 (AI 50번 골라짐 · 교회·신청한 팀원 · 입금자에 내 이름)',await ev(`return $('payDlg').open&&$('payTitle').textContent==='충전 신청'&&$('payDlg').querySelector('[data-k=ai]').getAttribute('aria-pressed')==='true'&&$('paySub').textContent==='호감교회 · 신청한 팀원 김목자'&&$('payName').value==='김목자'`));
  is('입금 계좌·받는 사람·5천 원 · AI 5번 먼저 안내',await ev(`const t=$('payDlg').textContent;return t.includes('토스뱅크 1002-6805-7619')&&t.includes('윤형림(호감)')&&t.includes('5,000원')&&t.includes('AI 5번이 바로 열려요')&&t.includes('45번')`));
  await shot('1-pay-ai.png');
  await ev(`window.CB='';navigator.clipboard.writeText=async t=>{CB=t;};$('payCopy').click();await new Promise(r=>setTimeout(r,100))`);
  is('복사하면 계좌 번호만',await ev(`return CB==='1002-6805-7619'`));
  await ev(`$('payDlg').querySelector('[data-k=mb]').click()`);
  is('용량을 고르면 제목·안내가 바뀜',await ev(`return $('payTitle').textContent==='용량 추가 신청'&&$('payS3').textContent.includes('50MB')&&!$('payS2').textContent.includes('5번')&&$('payFine').textContent.includes('20MB')`));
  await ev(`$('payDlg').querySelector('[data-k=ai]').click();$('payName').value='  ';$('payGo').click();await new Promise(r=>setTimeout(r,100))`);
  is('입금자 이름이 없으면 막고 서버를 안 부름',await ev(`return $('payErr').textContent.includes('입금자')`)&&!(await called('pay_request')));
  await ev(`R.pay_request={ok:false,error:'입금 확인 중인 신청이 있어요. 확인이 끝난 뒤 다시 신청해 주세요'};$('payName').value='김 입금';$('payGo').click();await new Promise(r=>setTimeout(r,200))`);
  is('서버가 막으면 이유를 보여 주고 창은 그대로',await ev(`return $('payDlg').open&&$('payErr').textContent.startsWith('입금 확인 중인')`));
  await ev(`R.pay_request={ok:true,id:7};R.ai_left=${AQ({left:5,paid:5,pending:true})};CALLS.length=0;$('payGo').click();await new Promise(r=>setTimeout(r,300))`);
  is('신청: 종류·입금자를 보내고 창이 닫히고 "5번" 알림',await ev(`const c=CALLS.find(c=>c[0]==='pay_request');return !$('payDlg').open&&c[1].p_kind==='ai'&&c[1].p_payer==='김 입금'&&$('toast').textContent.includes('AI 5번을 지금 바로')`));
  is('신청하면 남은 횟수를 바로 다시 받아 "입금 확인 중" 표시',await ev(`return CALLS.some(c=>c[0]==='ai_left')&&[...document.querySelectorAll('.aileft')].some(e=>!e.hidden&&e.textContent==='AI 5번 남음 · 입금 확인 중')`));
  await shot('2-after-pay.png');
  // 3) AI를 부르다 막히면 그 자리에서 충전 안내
  await ev(`R.__ai={error:'AI 횟수를 다 썼어요. 충전을 신청하면 바로 5번을 먼저 쓸 수 있어요',code:'charge'};R.ai_left=${AQ()};window.GOT=null;try{await sample('x',{})}catch(e){GOT=e;}await new Promise(r=>setTimeout(r,200))`);
  is('AI가 "charge"로 막히면 알림에 충전 신청 단추',await ev(`const b=$('toast').querySelector('.tundo');return GOT?.code==='charge'&&$('toast').textContent.includes('AI 횟수를 다 썼어요')&&b&&b.textContent==='충전 신청'`));
  await ev(`$('toast').querySelector('.tundo').click();await new Promise(r=>setTimeout(r,200))`);
  is('알림 단추 → 신청 창',await ev(`return $('payDlg').open`));await ev(`$('payClose').click()`);
  await ev(`R.ai_left=${AQ({pending:true})};await aiLeft(true)`);
  is('확인 중이면 안내가 "신청 내역 보기"',await ev(`const m=[...document.querySelectorAll('.aimore')].find(e=>!e.hidden);return m.querySelector('button').textContent==='신청 내역 보기'&&m.textContent.includes('입금을 확인하고 있어요')`));
  // 4) 교회 정보 창: 신청 내역(팀원) · 교회 정보(관리자만)
  const PAYS=[{id:3,at:day(0),kind:'ai',amount:5000,user_name:'김목자',payer:'김 입금',status:'pending'},{id:2,at:day(20),kind:'ai',amount:5000,user_name:'이집사',payer:'<b>이영희',status:'approved',done_at:day(19)},{id:1,at:day(30),kind:'mb',amount:5000,user_name:'김목자',payer:'김목자',status:'cancelled'}];
  await ev(`R.pay_mine=${JSON.stringify(PAYS)};R.church_info_get={road:'서울 성동구 한림말5길 33-9',detail:'2층',zip:'04700',denom:'',phone:''};[...document.querySelectorAll('.aimore')].find(e=>!e.hidden).querySelector('button').click();await new Promise(r=>setTimeout(r,300))`);
  is('신청 내역 보기 → 교회 창에 신청 3개 (확인 중 · 충전됨 · 취소됨)',await ev(`return $('chDlg').open&&!$('chPay').hidden&&[...$('chPayList').querySelectorAll('.paytag')].map(e=>e.textContent).join()==='입금 확인 중,충전됨,취소됨'`));
  is('입금자 이름은 글자 그대로 (태그로 안 읽음)',await ev(`return $('chPayList').textContent.includes('<b>이영희')&&!$('chPayList').querySelector('li b')`));
  is('팀원에게는 교회 정보(주소)가 안 보이고 서버에 묻지도 않음',await ev(`return $('chInfo').hidden&&!CALLS.some(c=>c[0]==='church_info_get')`));
  is('팀원에게도 "더 필요해요" 단추',await ev(`return ${vis('chMore')}`));
  await ev(`$('chMore').click();await new Promise(r=>setTimeout(r,200))`);
  is('더 필요해요 → 교회 창이 닫히고 신청 창',await ev(`return !$('chDlg').open&&$('payDlg').open`));await ev(`$('payClose').click()`);
  await fake('admin');await ev(`R.church_usage={ai_limit:50,member_limit:5,mb_limit:20,members:4,ai_month:9,bytes:3*1048576,month:41,free:0,paid:5,left:46};R.pay_mine=[];R.church_info_get={road:'서울 성동구 한림말5길 33-9',detail:'2층',zip:'04700',denom:'',phone:''};R.church_info_set={ok:true};openChurch();await new Promise(r=>setTimeout(r,300))`);
  is('교회 창 사용량: 초기 교회는 이번 달 무료와 충전을 같이',await ev(`const t=$('chUse').textContent;return t.includes('AI 남은 횟수46번')&&t.includes('이번 달 무료 41 · 충전 5')`));
  is('신청이 없으면 신청 내역 칸은 숨김',await ev(`return $('chPay').hidden`));
  is('관리자: 교회 정보 (주소·상세·우편번호, 빈 칸은 —)',await ev(`const t=$('chInfoV').textContent;return !$('chInfo').hidden&&t.includes('서울 성동구 한림말5길 33-9, 2층 (04700)')&&t.includes('교단—')`));
  await ev(`$('chInfoEdit').click();await new Promise(r=>setTimeout(r,100))`);
  is('고치기 → 지금 값이 채워진 칸',await ev(`const b=$('chInfoAddr');return !$('chInfoF').hidden&&b.querySelector('[data-road]').value==='서울 성동구 한림말5길 33-9'&&b.querySelector('[data-detail]').value==='2층'&&b.dataset.zip==='04700'`));
  await ev(`$('chInfoAddr').querySelector('[data-find]').click();await new Promise(r=>setTimeout(r,100));$('fakePick').click();$('chInfoAddr').querySelector('details').open=true;$('chInfoAddr').querySelector('[data-denom]').value='예장';$('chInfoSave').click();await new Promise(r=>setTimeout(r,200))`);
  is('저장: 이 교회 번호와 새 주소를 보내고 바로 보여 줌',await ev(`const c=CALLS.find(c=>c[0]==='church_info_set');return c&&c[1].p_church==='c1'&&c[1].p_info.road==='서울 성동구 무학로 1'&&c[1].p_info.zip==='04701'&&c[1].p_info.denom==='예장'&&$('chInfoF').hidden&&$('chInfoV').textContent.includes('서울 성동구 무학로 1')`));
  await ev(`R.church_info_get=null;openChurch();await new Promise(r=>setTimeout(r,300))`);
  is('초기 교회(정보 없음)는 "채우기"',await ev(`return $('chInfoEdit').textContent==='채우기'&&$('chInfoV').textContent.includes('아직 적지 않았어요')`));
  await shot('3-church.png');
  // 5) 교회 창에서 새 교회 만들기: 주소 필수
  await ev(`R.create_church={ok:false,error:'(시험) 멈춤'};openMake();$('chName').value='둘째교회';$('chNewGo').click();await new Promise(r=>setTimeout(r,200))`);
  is('새 교회: 주소를 안 고르면 막음',await ev(`return $('chErr').textContent.includes('주소')&&!CALLS.some(c=>c[0]==='create_church')`));
  await ev(`$('chAddr').querySelector('[data-road]').click();await new Promise(r=>setTimeout(r,100));$('fakePick').click();$('chNewGo').click();await new Promise(r=>setTimeout(r,400))`);
  is('고르면 검색 칸을 비움 (다른 주소 칸과 안 섞임)',await ev(`return !document.querySelector('#chInfoAddr #fakePick')&&$('chAddr').querySelector('[data-embed]').innerHTML===''`));
  is('주소 칸을 눌러도 검색이 열리고, 고르면 교회 정보와 함께 만들기',await ev(`const c=CALLS.find(c=>c[0]==='create_church');return c&&c[1].p_church==='둘째교회'&&c[1].p_info.road==='서울 성동구 무학로 1'&&$('chErr').textContent==='(시험) 멈춤'`));
  is('같은 주소 안내 문구',await ev(`return madeMsg({church:'둘째교회',free:false}).includes('처음 무료 AI 50번은 없어요')&&madeMsg({church:'둘째교회',free:true}).includes('팀원 초대')`));
  await ev(`$('chDlg').close();sessionStorage.setItem('hogam_note','새 교회를 만들었어요: 시험. 같은 주소의 교회가 이미 있어서 처음 무료 AI 50번은 없어요')`);
  await load();await z(1000);
  is('새로고침 뒤에도 만든 결과 알림이 한 번 뜸',await ev(`return $('toast').textContent.includes('처음 무료 AI 50번은 없어요')&&!sessionStorage.getItem('hogam_note')`));
  // 6) 관리 홈: 유료 신청·입금
  const L=[{id:11,at:day(0),church_id:'c1',church_name:'호감교회',kind:'ai',amount:5000,user_name:'김목자',payer:'김 입금',status:'pending',done_at:null,is_new:true},
    {id:10,at:day(1),church_id:'c2',church_name:'은혜<i>교회',kind:'mb',amount:5000,user_name:'박전도사',payer:'박은혜',status:'pending',done_at:null,is_new:false},
    {id:9,at:day(8),church_id:'c3',church_name:'새빛교회',kind:'ai',amount:5000,user_name:'최집사',payer:'최빛나',status:'approved',done_at:day(0),is_new:false},
    {id:8,at:day(20),church_id:null,church_name:'소망교회',kind:'ai',amount:5000,user_name:'정소망',payer:'정소망',status:'refunded',done_at:day(18),is_new:false}];
  const HOME={ai_month:62,ai_service:3000,ai_days:Array(14).fill(1),tokens:{},people:7,agreed:7,terms_ver:1,log:[],pay_new:1,pay_pending:2,db_bytes:38*1048576};
  const CS=[{id:'c1',name:'옥수교회',created_at:day(40),is_new:false,suspended_at:null,ai_month:12,ai_limit:50,ai_left:38,members:3,admins:1,member_limit:5,mb_limit:20,bytes:0,last_used:day(1)},
    {id:'c2',name:'새교회',created_at:day(10),is_new:false,suspended_at:null,ai_month:3,ai_limit:0,ai_left:47,members:2,admins:1,member_limit:5,mb_limit:20,bytes:0,last_used:day(1)},
    {id:'c3',name:'다쓴교회',created_at:day(30),is_new:false,suspended_at:null,ai_month:50,ai_limit:0,ai_left:0,members:2,admins:1,member_limit:5,mb_limit:20,bytes:0,last_used:day(1)}];
  await fake('admin');await ev(`window.PL=${JSON.stringify(L)};R.super_home=${JSON.stringify(HOME)};R.super_churches=${JSON.stringify(CS)};R.super_pay_list=()=>({db_bytes:38*1048576,list:JSON.parse(JSON.stringify(PL))});R.super_pay_seen=1;
    R.super_pay_set=a=>{const x=PL.find(y=>y.id===a.p_id);if(a.p_action==='approve'&&x.status!=='pending')return {ok:false,error:'이미 처리한 신청이에요'};x.status={approve:'approved',cancel:'cancelled',refund:'refunded'}[a.p_action];x.done_at=new Date().toISOString();x.is_new=false;return {ok:true};};
    me=null;await showAdm();await new Promise(r=>setTimeout(r,200))`);
  is('관리 홈 카드: 확인 중 2 · 경고 · NEW (3단계 표시 없음)',await ev(`const c=document.querySelector('#admGrid [data-k=pay]');return c.querySelector('.acnt').textContent==='확인 중 2'&&c.querySelector('.acnt').classList.contains('warn')&&!!c.querySelector('.anew')&&!c.classList.contains('later')`));
  is('왼쪽 메뉴: 유료 신청·입금은 "다음 단계" 묶음 위',await ev(`const s=document.querySelector('#admSide .admsep'),p=document.querySelector('#admSide [data-p=pay]');return !!(s.compareDocumentPosition(p)&Node.DOCUMENT_POSITION_PRECEDING)`));
  is('카드에 서버 전체 사용량',await ev(`return document.querySelector('#admGrid [data-k=pay]').textContent.includes('38.0MB / 500MB')`));
  is('확인할 일 = AI 다 쓴 교회 1 + 입금 2 (매달 0번인 새 교회는 다 쓴 걸로 안 봄)',await ev(`const k=[...$('admKpi').children].at(-1);return k.querySelector('b').textContent==='3'&&k.textContent.includes('AI 다 씀 1')&&k.textContent.includes('입금 2')`));
  await ev(`document.querySelector('#admGrid [data-k=pay] .aopen').click();await new Promise(r=>setTimeout(r,400))`);
  is('열면 유료 신청·입금 페이지: 숫자 3개 · 확인 중 2건만',await ev(`const o=$('admOther');return $('admT').textContent==='유료 신청·입금'&&o.querySelectorAll('.akpi').length===3&&o.querySelectorAll('.aptbl tbody tr').length===2&&o.querySelector('.akpi b').textContent==='2건'`));
  is('새 신청에 NEW, 열면 서버에 "봤어요"를 알리고 카드 NEW가 꺼짐',await ev(`return !!$('admOther').querySelector('.aptbl tbody tr .anew')&&CALLS.some(c=>c[0]==='super_pay_seen')&&!document.querySelector('#admGrid [data-k=pay] .anew')`));
  is('교회 이름·입금자는 글자 그대로',await ev(`return $('admOther').textContent.includes('은혜<i>교회')&&!$('admOther').querySelector('.aptbl i')`));
  is('넓은 화면: 입금 목록이 넓게 펼쳐지고 상태 꼬리표가 한 줄',await ev(`const o=$('admOther').querySelector('.apay');return o.getBoundingClientRect().width>900&&[...o.querySelectorAll('.paytag')].every(e=>e.getClientRects().length===1)`));
  is('이번 달 승인 5,000원 · 서버 38MB',await ev(`const t=$('admOther').textContent;return t.includes('5,000원')&&t.includes('38.0MB')&&t.includes('400MB면 Pro로')`));
  await shot('4-adm-pay.png');
  await ev(`$('admOther').querySelector('[data-id="11"][data-a=approve]').click();await new Promise(r=>setTimeout(r,100))`);
  is('승인을 누르면 바로 처리하지 않고 확인 칸 (입금자·금액)',await ev(`const b=$('apConf');return !CALLS.some(c=>c[0]==='super_pay_set')&&b.textContent.includes('호감교회 AI 50번을 승인할까요?')&&b.textContent.includes('김 입금')&&b.textContent.includes('45번')&&document.activeElement===$('apYes')`));
  await shot('5-adm-confirm.png');
  await ev(`$('apNo').click()`);is('돌아가기 → 확인 칸이 사라짐',await ev(`return $('apConf').textContent===''`));
  await ev(`$('admOther').querySelector('[data-id="11"][data-a=approve]').click();$('apYes').click();await new Promise(r=>setTimeout(r,500))`);
  is('승인: 그 신청 번호로 한 번만 보내고 목록을 다시 받음 (확인 중 1건)',await ev(`const s=CALLS.filter(c=>c[0]==='super_pay_set');return s.length===1&&s[0][1].p_id===11&&s[0][1].p_action==='approve'&&$('admOther').querySelectorAll('.aptbl tbody tr').length===1&&$('toast').textContent.includes('승인했어요')`));
  await ev(`$('admOther').querySelector('[data-id="10"][data-a=cancel]').click();await new Promise(r=>setTimeout(r,100))`);
  is('용량 취소 확인 칸에는 5번 차감 말이 없음',await ev(`const t=$('apConf').textContent;return t.includes('취소할까요')&&!t.includes('5번')`));
  await ev(`$('apNo').click();$('admOther').querySelector('.apflt [data-f=all]').click();await new Promise(r=>setTimeout(r,100))`);
  is('전체: 4건 · 환불됨 단추는 승인한 것에만 · 지워진 교회 표시',await ev(`const o=$('admOther');return o.querySelectorAll('.aptbl tbody tr').length===4&&o.querySelectorAll('[data-a=refund]').length===2&&o.querySelectorAll('[data-a=approve]').length===1&&o.textContent.includes('(지워진 교회) 소망교회')`));
  await ev(`R.super_pay_set={ok:false,error:'이미 처리한 신청이에요'};$('admOther').querySelector('[data-id="10"][data-a=approve]').click();$('apYes').click();await new Promise(r=>setTimeout(r,300))`);
  is('서버가 막으면 이유를 보여 줌',await ev(`return $('apErr').textContent==='이미 처리한 신청이에요'`));
  await ev(`R.super_pay_list=()=>({db_bytes:450*1048576,list:[]});await admPay()`);
  is('서버가 400MB를 넘으면 Pro 알림 · 신청 없으면 안내',await ev(`const o=$('admOther');return o.textContent.includes('Pro로 올릴 때예요')&&!!o.querySelector('.sptr i.hi')&&o.textContent.includes('맞는 신청이 없어요')`));
  // 7) 교회 관리: 남은 AI 기준
  await ev(`document.querySelector('#admSide [data-p=churches]').click();await new Promise(r=>setTimeout(r,300))`);
  is('교회 카드: AI 남은 횟수 · 다 쓴 교회만 확인 필요',await ev(`const f=n=>[...$('spGrid').querySelectorAll('.spcard')].find(c=>c.textContent.includes(n));return f('새교회').textContent.includes('AI 남은 횟수47번')&&f('다쓴교회').querySelector('.spneed').textContent==='AI를 다 썼어요'&&!f('새교회').querySelector('.spneed.w')`));
  await ev(`R.super_church={memo:'',bytes:{},history:[],ai_kinds:[],ai_days:Array(14).fill(0),free:40,paid:7,info:{road:'서울 성동구 한림말5길 33-9',detail:'',zip:'04700',denom:'예장',phone:''}};R.super_members=[];[...$('spGrid').querySelectorAll('.spcard')].find(c=>c.textContent.includes('새교회')).click();await new Promise(r=>setTimeout(r,300))`);
  is('교회 상세: 남은 AI(처음 무료·충전)와 교회 정보',await ev(`const t=$('spPane').textContent;return t.includes('처음 무료 40 · 충전 7')&&t.includes('서울 성동구 한림말5길 33-9 (04700)')&&t.includes('예장')`));
  await ev(`$('spTabs').querySelector('[data-t=limit]').click();await new Promise(r=>setTimeout(r,100));$('spLimBase').click()`);
  is('제한: "매달 무료 AI" · 기본값 0 · 5 · 20',await ev(`return $('spPane').textContent.includes('매달 무료 AI')&&$('sp_ai_limit').value==='0'&&$('sp_member_limit').value==='5'&&$('sp_mb_limit').value==='20'`));
  // 8) 휴대폰 폭
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true},S);
  await ev(`R.super_pay_list=()=>({db_bytes:38*1048576,list:JSON.parse(JSON.stringify(PL))});admGo('pay');await new Promise(r=>setTimeout(r,300))`);
  is('휴대폰 폭: 입금 목록이 옆으로 안 넘침',await ev(`return $('adm').scrollWidth<=innerWidth&&document.documentElement.scrollWidth<=innerWidth`));
  await shot('6-phone-adm-pay.png');
  await fake();await ev(`openPay();await new Promise(r=>setTimeout(r,200))`);
  is('휴대폰 폭: 신청 창이 화면 안',await ev(`const r=$('payDlg').getBoundingClientRect();return $('payDlg').open&&r.left>=0&&r.right<=innerWidth&&$('payDlg').scrollWidth<=$('payDlg').clientWidth+1`));
  await shot('7-phone-pay.png');
  await ev(`$('payClose').click();showGate('free');$('gfAddr').querySelector('[data-find]').click();await new Promise(r=>setTimeout(r,200))`);
  is('휴대폰 폭: 첫 화면 주소 칸이 안 넘침',await ev(`return document.documentElement.scrollWidth<=innerWidth&&$('gfAddr').getBoundingClientRect().right<=innerWidth`));
  await shot('8-phone-free-addr.png');
  is('우편번호 스크립트는 새 주소 (t1.daumcdn.net은 2026-11-30에 끝남)',(()=>{const h=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');return h.includes('https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js')&&!h.includes('daumcdn')})());
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,300)));
}catch(e){bad++;console.log('멈춤',e.message);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
