// 화면 편집 빠른 시험: node 시험/화면편집.mjs  (1분 안팎. 크롬만 있으면 돼요. 실제 서버에는 붙지 않아요)
// 설교 전체 화면 새 디자인 · 순서 화면(순서 이름/맡은 이) 나누기 · 편집 칸에서 글자를 고르면 '고른 글자만' 도구 · 맞춤법 창은 시험/맞춤법.mjs
// 느린 시험(10분쯤, 항목 146개를 하나씩 눌러 봐요): 슬라이드 편집(미리보기·바로 편집)을 고쳤을 때만 돌려요. 평소에는 다른 빠른 시험들로 충분해요 (2026-11-28 호감 결정)
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-direct-')),z=ms=>new Promise(r=>setTimeout(r,ms));
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));
  if(q.url.startsWith('/config.js'))return r.end('window.HOGAM_CONFIG={SUPABASE_URL:"https://example.invalid",SUPABASE_ANON_KEY:"x"};');
  if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.statusCode=404;return r.end();}
  r.setHeader('content-type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png'})[path.extname(f)]||'application/octet-stream');r.end(fs.readFileSync(f));});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${srv.address().port}/index.html`;
const ch=spawn(CHROME,[...(process.env.HEAD?[]:['--headless=new']),'--remote-debugging-port=0',`--user-data-dir=${tmp}`,'--no-first-run','--window-size=1440,900','about:blank'],{stdio:['ignore','ignore','pipe']});
const url=await new Promise(r=>{let b='';ch.stderr.on('data',d=>{b+=d;const m=b.match(/ws:\/\/\S+/);if(m)r(m[0]);});});
const ws=new WebSocket(url);await new Promise(r=>ws.onopen=r);let n=0,wait={},errs=[];
ws.onmessage=e=>{const d=JSON.parse(e.data);if(d.id){wait[d.id]?.(d);delete wait[d.id];}
  if(d.method==='Runtime.exceptionThrown'){const t=d.params.exceptionDetails;errs.push(t.exception?.description||t.text);}
  if(d.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true},d.sessionId);};
// 크롬이 답을 안 하면 끝없이 기다리지 않고 어디서 걸렸는지 알리고 멈춤
const send=(method,params={},sessionId)=>new Promise((r,j)=>{const id=++n,t=setTimeout(()=>{delete wait[id];j(new Error('60초 동안 답 없음: '+method+' '+JSON.stringify(params).slice(0,300)));},60000);wait[id]=d=>{clearTimeout(t);r(d);};ws.send(JSON.stringify({id,method,params,sessionId}));});
const attach=async id=>{const s=(await send('Target.attachToTarget',{targetId:id,flatten:true})).result.sessionId;for(const m of ['Runtime.enable','Page.enable','Network.enable'])await send(m,{},s);await send('Emulation.setFocusEmulationEnabled',{enabled:true},s);return s;};
const pages=async()=>(await send('Target.getTargets')).result.targetInfos.filter(t=>t.type==='page');
let S=await attach((await pages())[0].targetId);const main=(await pages())[0].targetId;
const ev=async(e,s=S)=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true,userGesture:true},s);if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description||'eval');return r.result?.result?.value;};
const until=async(e,ms=40000,s=S)=>{const t=Date.now();while(Date.now()-t<ms){if(await ev(`return !!(${e})`,s).catch(()=>0))return true;await z(150);}return false;};
let ok=0,bad=0;const is=(name,v)=>{v?ok++:bad++;console.log(v?'통과':'실패',name);};
const key=async(k,code,s=S)=>{const vk={ArrowRight:39,ArrowLeft:37,Enter:13,' ':32}[k]||k.toUpperCase().charCodeAt(0);if(process.env.HEAD){await send('Page.bringToFront',{},s);await z(250);}for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:k,code:code||k,windowsVirtualKeyCode:vk},s);await z(350);};
const open=async()=>{await send('Page.navigate',{url:base},S);await until(`document.readyState==='complete'&&typeof liveRestore==='function'&&LOOK`);await z(1500);await ev(`$('gate').classList.remove('on')`);};
// 송출 창 그림의 지문 (실제로 보이는 픽셀)
const pix=s=>ev(`const c=document.getElementById('c'),d=c.getContext('2d').getImageData(0,0,1920,1080).data;let h=0;for(let i=0;i<d.length;i+=404)h=(h*31+d[i]+d[i+1]*3+d[i+2]*7)|0;return h+':'+[...d.slice(0,3)]`,s);
const shot=async(f,s)=>{if(SHOT)fs.writeFileSync(path.join(SHOT,f),Buffer.from((await send('Page.captureScreenshot',{format:'png'},s)).result.data,'base64'));};
try{
  await ev(`localStorage`).catch(()=>{});await send('Page.navigate',{url:base},S);await z(2500);
  await ev(`sessionStorage.setItem('cj_church','test-church')`);await open();
  await ev(`for(const [id,v] of [['outText','만복의 근원 하나님\\n온 백성 찬송 드리고\\n\\n저 천사여 찬송하세\\n찬송 성부 성자 성령\\n\\n아멘 아멘\\n아멘'],['wordText','요한복음 3:16\\n하나님이 세상을 이처럼 사랑하사\\n독생자를 주셨으니\\n\\n이는 저를 믿는 자마다\\n멸망치 않고 영생을 얻게'],['quoteText','시편 23:1\\n여호와는 나의 목자시니\\n내가 부족함이 없으리로다']]){const e=$(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));}
    LOOK.quote.quoteStyle='caption';setPage('slides')`);await z(1500);
  await ev(`INFO=[{id:'a1',k:'cover',title:'감사주일',band:'주일예배',time:'11시',note:'작은글 하나\\n작은글 둘'},{id:'a2',k:'notice',body:'기도\\n홍길동 장로',note:'작은 안내\\n둘째 줄'},{id:'a3',k:'ad',title:'광고제목',body:'광고 내용입니다\\n둘째 줄'},{id:'a4',k:'sermon',title:'설교제목',sub:'부제목',who:'홍길동 목사',ref:'요 3:16'},{id:'a5',k:'text',title:'고백문',body:'전능하사 천지를\\n만드신'}];LOOK.quote.quoteStyle='body';renderInfoList();setPage('slides')`);await z(1200);

  const mouse=async(type,x,y,o={})=>{await send('Input.dispatchMouseEvent',{type,x,y,button:type==='mouseMoved'&&!o.down?'none':'left',buttons:type==='mouseReleased'||type==='mouseMoved'&&!o.down?0:1,clickCount:o.n||1,modifiers:o.shift?8:0},S);};
  const click=async(p,o={})=>{await mouse('mouseMoved',p[0],p[1]);await mouse('mousePressed',p[0],p[1],o);await mouse('mouseReleased',p[0],p[1],o);await z(60);};
  const dbl=async p=>{await click(p);await z(260);await click(p,{n:2});await z(120);};
  const drag=async(a,b)=>{await mouse('mouseMoved',a[0],a[1]);await mouse('mousePressed',a[0],a[1]);for(let i=1;i<=4;i++)await mouse('mouseMoved',a[0]+(b[0]-a[0])*i/4,a[1]+(b[1]-a[1])*i/4,{down:true});await mouse('mouseReleased',b[0],b[1]);await z(250);};
  const keys=async(k,mod)=>{const vk=k==='Escape'?27:k==='Enter'?13:k.toUpperCase().charCodeAt(0);for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:k,code:k.length===1?'Key'+k.toUpperCase():k,windowsVirtualKeyCode:vk,modifiers:mod||0},S);await z(250);};
  await ev(`window.W=ms=>new Promise(r=>setTimeout(r,ms));for(const k of ['song','word','info'])LOOK[k].footer='호감교회 HOGAM';LOOK.info.tag1='주일예배';LOOK.quote.capRight='설교 제목';
    $('outText').value='만복의 근원 하나님\\n\\n온 백성 찬송 드리고\\n저 천사여 찬송하세\\n\\n아멘 아멘 할렐루야';$('outText').dispatchEvent(new Event('input',{bubbles:true}));
    $('wordText').value='요한복음 3:16\\n1 하나님이 세상을 이처럼 사랑하사\\n2 독생자를 주셨으니 이는 저를 믿는 자마다\\n3 멸망치 않고 영생을 얻게 하려 하심이라\\n4 하나님이 그 아들을 세상에 보내신 것은\\n5 세상을 심판하려 하심이 아니요\\n6 저로 말미암아 세상이 구원을 받게 하려 하심이라\\n7 저를 믿는 자는 심판을 받지 아니하는 것이요';$('wordText').dispatchEvent(new Event('input',{bubbles:true}));
    window.J0=JSON.stringify(LOOK);window.I0=JSON.stringify(INFO);window.T0=['outText','wordText','quoteText'].map(i=>$(i).value);
    window.rs=async()=>{endInline(false);if($('slidebox').classList.contains('on'))closeSlide();LOOK=mkLook(JSON.parse(J0));SLIDE_OV={};OV_AT={};INFO=JSON.parse(I0);lookChanged();['outText','wordText','quoteText'].forEach((id,i)=>{if($(id).value!==T0[i]){$(id).value=T0[i];$(id).dispatchEvent(new Event('input',{bubbles:true}));}});ED=null;lookScope='all';lookSlideKey=null;lookHist=[];lookFut=[];lookPrev=lookSnap();lookPrevT=0;buildLookUI();renderShots();await W(350);};
    window.all=()=>songGroups().flatMap(g=>g.items);
    window.look=(q,st)=>{if(q==='quote')LOOK.quote.quoteStyle=st;if(q.startsWith('info'))LOOK.info.style=st;lookChanged();['outText','wordText','quoteText'].forEach((id,i)=>{if($(id).value!==T0[i]){$(id).value=T0[i];$(id).dispatchEvent(new Event('input',{bubbles:true}));}});lookPrev=lookSnap();};
    window.find=p=>{const[g,id]=p.split(':');return all().find(s=>tabOf(s)===g&&(!id||s.iid===id)&&!s.blank);};
    window.cvOf=p=>{const s=find(p);return[...document.querySelectorAll('#shots .shotw[data-k="'+CSS.escape(shotKey(s))+'"] canvas')][0];};
    // 항목에서 다른 항목과 안 겹치는 점 (화면 좌표)
    window.at=(cv,k)=>{const c=edOf(cv),r=c.lay.regions.find(q=>q.k===k);if(!r)return null;const b=cv.getBoundingClientRect(),zz=b.width/cv.width;for(const pass of [0,1])for(let i=1;i<12;i++)for(let j=1;j<12;j++){const e={clientX:b.left+(r.x+r.w*j/12)*zz,clientY:b.top+(r.y+r.h*i/12)*zz},h=edHit(cv,e),t=document.elementFromPoint(e.clientX,e.clientY);if(h&&h.k===k&&t&&(t===cv||pass&&t.closest('.edfr'))){const ok=[[-1,-1],[1,1]].every(([dx,dy])=>edHit(cv,{clientX:e.clientX+dx,clientY:e.clientY+dy})?.k===k);if(ok)return[e.clientX,e.clientY];}}return null;};
    window.handle=h=>{const b=document.querySelector('.edfr i[data-h='+h+']').getBoundingClientRect();return[b.left+b.width/2,b.top+b.height/2];};
    window.regs=cv=>Object.fromEntries(edOf(cv).lay.regions.map(r=>[r.k,[r.x/cv.width,r.y/cv.height,r.w/cv.width,r.h/cv.height]]));return 1`);
  const KIND=[['song','','찬양'],['word','','본문'],['quote','body','참고 본문'],['quote','caption','참고 자막'],['quote','box2','두 색 상자'],['info:a1','full','표지'],['info:a2','full','안내'],['info:a3','full','광고'],['info:a4','full','설교'],['info:a5','full','고백문'],['info:a2','cap','안내 자막'],['info:a3','cap','광고 자막'],['info:a4','cap','설교 자막'],['info:a5','cap','고백문 자막']];
  const prep=async(p,st,big)=>{await ev(`await rs();look('${p}','${st}');renderShots();await W(350);${big?`openSlide(all().findIndex(s=>shotKey(s)===shotKey(find('${p}'))));await W(250);window.CV=bigCv;`:`window.CV=cvOf('${p}');CV.scrollIntoView({block:'center'});await W(120);`}return 1`);return ev(`return edOf(CV).lay.regions.filter(r=>r.k!=='logo').map(r=>r.k)`);};
  const sermonSet=`const o=INFO.find(o=>o.id==='a4');o.title='너는 복의 근원이 될지라';o.sub='';o.who='최기순 목사';o.ref='창세기 12:1-9';$('docTitle').value='1월 25일 주일예배';const c=SESS.find(x=>x.id===curSess);if(c)c.created=Date.parse('2026-01-20');`;
  // 1) 설교 전체 화면
  await prep('info:a4','full',true);await ev(`${sermonSet}drawSlide();await W(300);return 1`);
  const L1=await ev(`const l=edOf(bigCv).lay,W=bigCv.width,H=bigCv.height,g=k=>l.regions.find(r=>r.k===k);const t=g('ititle'),d=g('iband'),b=g('bandr'),w=g('itime'),n=g('inote');
    return JSON.stringify({keys:l.regions.map(r=>r.k).sort().join(),tc:Math.abs(t.x+t.w/2-W/2)/W,ty:(t.y+t.h/2)/H,dr:(b.x+b.w)/W,dy:(b.y+b.h/2)/H,dIn:d.x>=b.x&&d.x+d.w<=b.x+b.w+1,wr:(w.x+w.w)/W,nr:(n.x+n.w)/W,nb:(n.y+n.h)/H,wy:w.y/H,date:l.texts.find(x=>x.kind==='iband').lines[0]})`);
  const S1=JSON.parse(L1);
  is('설교: 날짜·제목·구절·설교자·날짜 띠가 따로 (부제목은 없으면 안 보임)',S1.keys==='bandr,footer,iband,inote,itime,ititle');
  is('설교: 제목은 가운데(높이 44% 근처)',S1.tc<.01&&S1.ty>.4&&S1.ty<.48);
  is('설교: 날짜 띠는 오른쪽 위 끝에 붙고 날짜 글자는 띠 안',S1.dr>.999&&S1.dy<.2&&S1.dIn);
  is('설교: 날짜는 예배 이름에서 (만든 날 기준 연도) 2026.1.25',S1.date==='2026.1.25');
  is('설교: 설교자는 오른쪽 아래(끝 92%), 구절은 바로 위 줄 (오른쪽 끝을 맞춤)',Math.abs(S1.wr-.92)<.01&&Math.abs(S1.nr-.92)<.01&&S1.nb<=S1.wy+.001&&S1.wy-S1.nb<.05);
  is('설교: 설교자는 칸 글 그대로 한 줄·같은 크기',await ev(`const ts=edOf(bigCv).lay.texts.filter(t=>t.kind==='itime');return ts.length===1&&ts[0].lines.join()==='최기순 목사'`));
  is('설교: 설교자 크기를 바꿔도 구절 자리는 그대로',await ev(`const g=()=>JSON.stringify(edOf(bigCv).lay.regions.find(r=>r.k==='inote'));const a=g();LOOK.info.k_sermon_tmSize=6;drawSlide();await W(200);const b=g(),w=edOf(bigCv).lay.texts.find(t=>t.kind==='itime').size;delete LOOK.info.k_sermon_tmSize;drawSlide();await W(200);return a===b&&Math.abs(w-bigCv.width*.06)<1`));
  is('설교: 설교자 블록 지정이 그 글자에 먹음',await ev(`const sc=edOf(bigCv).sc,ov=SLIDE_OV[sc.ovKey]||(SLIDE_OV[sc.ovKey]={});ov.runs=JSON.stringify([{k:'itime',t:'목사',n:0,s:{size:1.5,color:'#ff0000'}}]);drawSlide();await W(200);const t=edOf(bigCv).lay.texts.find(t=>t.kind==='itime'),seg=t.rl&&t.rl[0]&&t.rl[0][0];delete ov.runs;drawSlide();await W(200);return !!seg&&seg[0]===4&&seg[1]===6&&seg[2].color==='#ff0000'`));
  is('설교: 이름과 "목사"는 한 항목',await ev(`return edOf(bigCv).lay.regions.filter(r=>r.k==='itime').length===1`));
  is('설교: 기본값은 설교에만 (Pretendard 아주 굵게 · 8.2) · 표지는 그대로',await ev(`return lv(LOOK.info,'k_sermon_size','info')===8.2&&lv(LOOK.info,'k_sermon_weight','info')===800&&lv(LOOK.info,'k_cover_size','info')===lv(LOOK.info,'size','info')&&KL(LOOK.info,'cover').font===LOOK.info.font`));
  is('설교: 제목 색은 배경에서 뽑은 연한 색 (정하면 그 색)',await ev(`const t=edOf(bigCv).lay.texts.find(x=>x.kind==='ititle');const a=/^hsl\\(/.test(t.color);LOOK.info.k_sermon_color='#ff0000';drawSlide();await W(200);const b=edOf(bigCv).lay.texts.find(x=>x.kind==='ititle').color==='#ff0000';delete LOOK.info.k_sermon_color;drawSlide();await W(200);return a&&b`));
  is('설교: 항목 이름이 설교에 맞게 (날짜·설교자·성경 구절·날짜 띠)',await ev(`const sc=edOf(bigCv).sc,l=edOf(bigCv).lay;return ['iband','itime','inote','bandr'].map(k=>edName(l.regions.find(r=>r.k===k),sc)).join()==='날짜,설교자,성경 구절,날짜 띠 (도형)'`));
  is('설교: 날짜·구절을 슬라이드에서 고치면 그 칸에 저장',await ev(`const sc=edOf(bigCv).sc;return editTextOf('iband',sc)==='2026.1.25'&&editTextOf('inote',sc)==='창세기 12:1-9'&&editTextOf('itime',sc)==='최기순 목사'&&infoField(sc.item,'iband')==='date'&&infoField(sc.item,'inote')==='ref'`));
  await ev(`INFO.find(o=>o.id==='a4').sub='창세기 강해';drawSlide();await W(200);return 1`);
  is('설교: 부제목을 적으면 제목 아래에',await ev(`const l=edOf(bigCv).lay,t=l.regions.find(r=>r.k==='ititle'),s=l.regions.find(r=>r.k==='isub');return !!s&&s.y>t.y+t.h*.8&&infoField(edOf(bigCv).sc.item,'isub')==='sub'`));
  // 2) 순서 화면
  await prep('info:a2','full',true);await ev(`INFO.find(o=>o.id==='a2').body='대표기도\\n홍길동 장로';drawSlide();await W(300);return 1`);
  is('순서: 순서 이름과 맡은 이가 따로',await ev(`const l=edOf(bigCv).lay,h=l.regions.find(r=>r.k==='ihead'),n=l.regions.find(r=>r.k==='inotice');return !!h&&!!n&&n.y>h.y+h.h*.8`));
  is('순서: 기본은 순서 이름 아주 굵게 · 맡은 이 보통·60% · 한 덩어리 같은 굵기 · 가운데',await ev(`const l=edOf(bigCv).lay,h=l.texts.find(t=>t.kind==='ihead'),ns=l.texts.filter(t=>t.kind==='inotice');return +h.weight===800&&ns.length===1&&Math.abs(ns[0].size/h.size-.6)<.01&&ns[0].lines.join()==='홍길동 장로'&&+ns[0].weight===500&&ns[0].align==='center'&&Math.abs(ns[0].ax-bigCv.width/2)<2`));
  is('순서: 맡은 이 앞 글자를 블록으로 줄이면 뒤 글자가 따라와 가운데 맞춤',await ev(`INFO.find(o=>o.id==='a2').body='특별찬양\\n옥수교회 윤광웅 장로';drawSlide();await W(200);const g=()=>edOf(bigCv).lay.regions.find(r=>r.k==='inotice');const a=g();const sc=edOf(bigCv).sc,ov=SLIDE_OV[sc.ovKey]||(SLIDE_OV[sc.ovKey]={});ov.runs=JSON.stringify([{k:'inotice',t:'옥수교회',n:0,s:{size:1.5}}]);drawSlide();await W(200);const t=edOf(bigCv).lay.texts.find(t=>t.kind==='inotice'),cv=bigCv,x=cv.getContext('2d');let L=0,R=0;const d=x.getImageData(0,0,cv.width,cv.height).data,r=g(),y0=Math.round(t.y0),y1=Math.round(t.y0+t.lh);let gap=0,run=0;for(let X=0;X<cv.width;X++){let hit=false;for(let Y=y0;Y<y1;Y+=2){const q=(Y*cv.width+X)*4;if(d[q]>235&&d[q+1]>235&&d[q+2]>235){hit=true;break;}}if(hit){if(!L)L=X;R=X;if(L)gap=Math.max(gap,run);run=0;}else if(L)run++;}delete ov.runs;drawSlide();await W(200);return !!t.rl&&Math.abs((L+R)/2-cv.width/2)<cv.width*.02&&(R-L)<a.w&&gap<t.size*.8`));
  is('순서: 맡은 이를 눌러 고치면 글 상자가 한 줄 그대로 (줄이 안 깨짐)',await ev(`startInline('inotice');await W(150);const ta=$('sbInl'),r=edOf(bigCv).lay.regions.find(r=>r.k==='inotice'),z=bigCv.getBoundingClientRect().width/bigCv.width;const ok=!ta.hidden&&ta.value==='옥수교회 윤광웅 장로'&&ta.getBoundingClientRect().width>=r.w*z&&ta.scrollHeight<r.h*z*1.6;endInline(false);INFO.find(o=>o.id==='a2').body='대표기도\\n홍길동 장로';drawSlide();await W(200);return ok`));
  is('순서: 이름 붙여 부름 (순서 이름 · 맡은 이)',await ev(`const sc=edOf(bigCv).sc,l=edOf(bigCv).lay;return edName(l.regions.find(r=>r.k==='ihead'),sc)==='순서 이름'&&edName(l.regions.find(r=>r.k==='inotice'),sc)==='맡은 이'`));
  is('순서: 따로 고쳐도 한 칸에 합쳐 저장',await ev(`const sc=edOf(bigCv).sc;inC={sc,big:true};saveTextEdit('ihead','특별찬양');const a=INFO.find(o=>o.id==='a2').body;inC={sc:edOf(bigCv).sc,big:true};saveTextEdit('inotice','호산나 찬양대');const b=INFO.find(o=>o.id==='a2').body;inC=null;return a==='특별찬양\\n홍길동 장로'&&b==='특별찬양\\n호산나 찬양대'`));
  is('순서: 기본값을 바꾸면 그 값이 이김',await ev(`LOOK.info.k_notice_hdSize=4;drawSlide();await W(200);const h=edOf(bigCv).lay.texts.find(t=>t.kind==='ihead');const ok=Math.abs(h.size-bigCv.width*.04)<1;delete LOOK.info.k_notice_hdSize;return ok`));
  await ev(`closeSlide();return 1`);
  // 3) 편집 칸에서 글자 고르기 → 고른 글자만 도구
  const pick=async(js)=>{await ev(js);await z(500);return ev(`return JSON.stringify({run:lookRun,bar:$('lookCtl').textContent.includes('고른 글자만')})`);};
  let r=JSON.parse(await pick(`await rs();setPage('song');await W(400);const ta=$('outText'),i=ta.value.indexOf('온 백성');ta.focus();ta.setSelectionRange(i,i+4);ta.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 1`));
  is('찬양 자막 칸: 고르면 그 슬라이드 가사의 "고른 글자만" 도구',r.bar&&r.run.k==='lyrics'&&r.run.t==='온 백성'&&r.run.ov.startsWith('s:'));
  is('색을 바꾸면 그 슬라이드의 그 글자에만',await ev(`const c=$('lookCtl').querySelector('.tp-run')?.parentElement?.querySelector('input[type=color]');c.value='#ff0000';c.dispatchEvent(new Event('input',{bubbles:true}));await W(200);const rs=runParse(SLIDE_OV[lookRun.ov].runs);return rs.length===1&&rs[0].t==='온 백성'&&rs[0].s.color==='#ff0000'&&Object.keys(SLIDE_OV).filter(k=>SLIDE_OV[k].runs).length===1`));
  r=JSON.parse(await pick(`const ta=$('outText'),i=ta.value.indexOf('만복');ta.focus();ta.setSelectionRange(i,i+2);ta.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 1`));
  is('찬양 자막 칸: 곡 제목 줄을 고르면 곡 제목',r.bar&&r.run.k==='title');
  r=JSON.parse(await pick(`setPage('word');await W(400);const ed=$('wEd'),i=ed.value.indexOf('독생자');ed.focus();ed.setSelectionRange(i,i+3);ed.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 1`));
  is('설교 본문 칸: 고르면 그 슬라이드 본문의 도구',r.bar&&r.run.k==='body'&&r.run.t==='독생자'&&r.run.ov.startsWith('w:'));
  r=JSON.parse(await pick(`setPage('info');await W(300);infoSel=INFO.findIndex(o=>o.id==='a2');renderInfoList();renderInfoEd();await W(150);const el=$('infoEd').querySelector('[data-f=nwho]'),i=el.value.indexOf('홍길동');el.focus();el.setSelectionRange(i,i+3);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 1`));
  is('순서 글 칸: 맡은 이를 고르면 맡은 이의 도구',r.bar&&r.run.k==='inotice'&&r.run.t==='홍길동');
  r=JSON.parse(await pick(`const el=$('infoEd').querySelector('[data-f=nhead]');el.focus();el.setSelectionRange(0,2);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 1`));
  is('순서 글 칸: 순서 이름 칸을 고르면 순서 이름의 도구',r.bar&&r.run.k==='ihead');
  is('순서 글 칸: 순서 이름 · 맡은 이 두 칸, 고치면 한 칸에 합쳐 저장',await ev(`const o=INFO.find(o=>o.id==='a2'),h=$('infoEd').querySelector('[data-f=nhead]'),w=$('infoEd').querySelector('[data-f=nwho]');if(!h||!w||$('infoEd').querySelector('[data-f=body]'))return false;const a=h.value+'|'+w.value===o.body.replace('\\n','|');w.value='김철수 집사\\n이영희 권사';w.dispatchEvent(new Event('input'));h.value='특별찬양';h.dispatchEvent(new Event('input'));const b=o.body==='특별찬양\\n김철수 집사\\n이영희 권사';renderInfoEd();const c=$('infoEd').querySelector('[data-f=nhead]').value==='특별찬양'&&$('infoEd').querySelector('[data-f=nwho]').value==='김철수 집사\\n이영희 권사';return a&&b&&c`));
  r=JSON.parse(await pick(`infoSel=INFO.findIndex(o=>o.id==='a4');renderInfoEd();await W(150);const el=$('infoEd').querySelector('[data-f=who]');el.focus();el.setSelectionRange(0,3);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 1`));
  is('설교 글 칸: 설교자를 고르면 설교자의 도구',r.bar&&r.run.k==='itime');
  await ev(`const ta=$('outText');ta.focus();ta.setSelectionRange(3,3);ta.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 1`);
  is('그냥 누르기(고른 글자 없음)는 도구를 안 바꿈',await ev(`return lookRun&&lookRun.k==='itime'`));
  // 방송 자막: 맡은 이·설교자도 한 덩어리 같은 굵기
  await prep('info:a2','cap',true);
  is('방송 자막 이름표: 맡은 이는 한 덩어리·같은 굵기',await ev(`INFO.find(o=>o.id==='a2').body='특별찬양\\n옥수교회 윤광웅 장로';drawSlide();await W(250);const ts=edOf(bigCv).lay.texts.filter(t=>t.lines.join('').trim());const m=ts.find(t=>t.lines.join()==='옥수교회 윤광웅 장로');const ok=!!m&&!ts.some(t=>t.lines.join()==='옥수교회')&&+m.weight===400;INFO.find(o=>o.id==='a2').body='대표기도\\n홍길동 장로';closeSlide();return ok`));
  await prep('info:a4','cap',true);
  is('방송 자막 설교: 설교자는 한 덩어리',await ev(`INFO.find(o=>o.id==='a4').who='총회장 정동균 목사';drawSlide();await W(250);const ts=edOf(bigCv).lay.texts;const ok=ts.some(t=>t.lines.join()==='총회장 정동균 목사')&&!ts.some(t=>t.lines.join()==='총회장');closeSlide();return ok`));
  // 4) 미리보기 Shift 여러 개 고르기
  await ev(`await rs();closeSlide?.();setPage('slides');shotSel='all';renderShots();await W(600);return 1`);
  is('위쪽 탭: Shift로 두 묶음을 고르면 두 묶음 슬라이드만',await ev(`const tabs=[...document.querySelectorAll('#gtabs .gtab')];tabs[0].click();await W(400);tabs[1]=document.querySelectorAll('#gtabs .gtab')[1];tabs[1].dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));await W(500);const g=songGroups(),want=g[0].items.length+g[1].items.length,n=document.querySelectorAll('#shots .shotw').length,on=document.querySelectorAll('#gtabs .gtw.on').length;
    document.querySelectorAll('#gtabs .gtab')[1].dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));await W(500);const n2=document.querySelectorAll('#shots .shotw').length;$('gtAll').click();await W(500);return Array.isArray(shotSel)===false&&on===2&&n===want&&n2===g[0].items.length`));
  is('슬라이드: Shift로 여러 장 고르면 "고른 N장"으로 한 번에 바꿈',await ev(`const all0=[...document.querySelectorAll('#shots .shotw')],ws=[...all0.filter(w=>w.dataset.k.startsWith('word:')).slice(0,2),all0[0]];const b=i=>ws[i].querySelector('.shot');b(0).dispatchEvent(new MouseEvent('click',{bubbles:true}));await W(300);b(1).dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}));await W(300);
    const a=allShots(),k0=a.find(s=>shotKey(s)===ws[0].dataset.k).ovKey,k1=a.find(s=>shotKey(s)===ws[1].dataset.k).ovKey,lab=document.querySelector('.lkscope [data-sc=slide]').textContent;
    lookScope='slide';buildLookUI();const inp=[...document.querySelectorAll('#lookBox input[type=number]')].find(i=>!i.disabled&&i.offsetParent);const v0=+inp.value;inp.value=v0+3;inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));await W(300);
    const o0=JSON.stringify(SLIDE_OV[k0]||{}),o1=JSON.stringify(SLIDE_OV[k1]||{});b(2).dispatchEvent(new MouseEvent('click',{bubbles:true}));await W(300);return lab==='고른 2장'&&o0!=='{}'&&o0===o1&&selKeys.size===0`));
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,300)));
}catch(e){bad++;console.log('멈춤',e.stack);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
