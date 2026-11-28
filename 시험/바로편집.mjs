// 슬라이드 바로 편집 시험: node 시험/바로편집.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요)
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
  // 0) 다른 탭의 슬라이드를 처음 눌러도 그림이 안 바뀌어 고른 것·두 번 누르기가 살아 있음 (자막 칸 탭만 맞춰요)
  {const res=[];for(const[p,st,k,from]of [['quote','body','body','w'],['word','','body','q'],['song','','lyrics','q']]){await prep(p,st,false);
    await ev(`wTab={k:'${from}',i:0};WMODE='${from}';songTab=-1;window.C0=CV`);const q=await ev(`return at(CV,'${k}')`);await click(q);
    const one=await ev(`return document.contains(C0)&&ED&&ED.keys.join()==='${k}'`);await z(260);await click(q,{n:2});await z(150);
    res.push(one&&await ev(`return !$('sbInl').hidden&&sbEditK==='${k}'`)?'':p+(one?' 두 번 누르기 안 열림':' 첫 클릭에 그림이 바뀜'));await ev(`endInline(false)`);}
   const b=res.filter(Boolean);if(b.length)console.log('  '+b.join(', '));is('다른 탭 슬라이드도 처음 누르면 골라지고 두 번 누르면 열림',!b.length);}
  // 1) 고르기 · 2) 크기 · 3) 두 번 누르기: 화면 종류마다 모든 항목
  const badRest=[],badMove=[],badSel=[],badSize=[],badEdit=[],noReach=[];let nItem=0;
  for(const[p,st,nm]of KIND)for(const big of [false,true]){
    console.error(`${Math.round(performance.now()/1000)}초 ${nm}${big?' 크게':''}`);const ks=await prep(p,st,big);
    for(const k of ks){nItem++;const tag=`${nm}${big?' 크게':''} · ${k}`;
      await prep(p,st,big);const pt=await ev(`return at(CV,'${k}')`);if(!pt){noReach.push(tag);continue;}
      await click(pt);
      if(!await ev(`return ED&&ED.keys.join()==='${k}'&&$('sbInl').hidden&&document.querySelectorAll('.edfr').length===1&&document.querySelectorAll('.edfr i').length===8`)){badSel.push(tag);continue;}
      // 크기
      const before=await ev(`return regs(CV)`),a=await ev(`return handle('se')`),sz=await ev(`return edSizes(edOf(CV).sc,'${k}').map(x=>edVal(edOf(CV).sc,x))`);
      const bw=await ev(`const b=CV.getBoundingClientRect();return[b.width,b.height]`),r0=before[k];
      await drag(a,[a[0]+Math.max(14,r0[2]*bw[0]*.25),a[1]+(await ev(`return isShape('${k}')`)?14:0)]);await z(250);
      if(!big)await ev(`window.CV=cvOf('${p}')`);
      const after=await ev(`return CV?regs(CV):null`),sz2=await ev(`return CV?edSizes(edOf(CV).sc,'${k}').map(x=>edVal(edOf(CV).sc,x)):[]`);
      // 다른 항목은 제자리 (상자는 안의 글이 다시 나뉘니 빼고)
      if(after&&k!=='box'&&k!=='cap'){ // 자막 글은 커지면 띠가 위로 늘어나요
        const mv=Object.keys(before).filter(q=>q!==k&&after[q]&&Math.hypot(after[q][0]-before[q][0],after[q][1]-before[q][1])>.004);if(mv.length)badRest.push(tag+' → '+mv);}
      const grown=sz2.some((v,i)=>v>sz[i]+.01),r1=after&&after[k],stay=!r1||['cap','capref','capright'].includes(k)||Math.abs(r1[0]-r0[0])<.006&&Math.abs(r1[1]-r0[1])<.011;
      if(!grown||!stay)badSize.push(tag+(grown?' 자리 밀림 '+JSON.stringify([r0,r1]):' 안 커짐 '+sz+'→'+sz2));
      // 끌면 그 항목만 움직임
      await prep(p,st,big);{const w=await ev(`window.b2=regs(CV);return at(CV,'${k}')`);if(w){await drag(w,[w[0]+16,w[1]-9]);if(!big)await ev(`window.CV=cvOf('${p}')`);
        const m=await ev(`const n=regs(CV);return Object.keys(n).filter(q=>b2[q]&&Math.hypot(n[q][0]-b2[q][0],n[q][1]-b2[q][1])>.003).join()`);if(m!==k)badMove.push(tag+' 움직인 것: '+m);}}
      // 두 번 누르기
      if(await ev(`return isShape('${k}')`))continue;
      await prep(p,st,big);const q=await ev(`return at(CV,'${k}')`);await dbl(q);
      if(!await ev(`return !$('sbInl').hidden&&sbEditK==='${k}'`)){badEdit.push(tag+' 안 열림');continue;}
      const orig=await ev(`return $('sbInl').value`);
      await ev(`const t=$('sbInl');t.setSelectionRange(t.value.length,t.value.length)`);await send('Input.insertText',{text:'갸'},S);await z(80);
      await ev(`endInline(true)`);await z(350);if(!big)await ev(`window.CV=cvOf('${p}')`);
      const r=await ev(`const l=CV&&edOf(CV).lay,t=l?[...l.texts.filter(t=>(t.el||t.kind)==='${k}').flatMap(t=>t.lines),...(l.footer&&'${k}'==='footer'?[l.footer.text]:[])].join(''):'';const sc=CV&&edOf(CV).sc;return t.includes('갸')||['cap','capref','capright'].includes('${k}')&&[editTextOf('${k}',sc)].join().includes('갸')`);
      if(!r)badEdit.push(tag+' 저장 안 됨 ('+orig+')');
      // 되돌리기
      await ev(`undoLook()`);await z(350);
      const u=await ev(`const T=['outText','wordText','quoteText'].every((id,i)=>$(id).value===T0[i]),I=JSON.stringify(INFO)===I0;const o=T&&I&&!JSON.stringify([LOOK,SLIDE_OV]).includes('갸');return o?'':JSON.stringify([$('toast').textContent,T,I,I?'':JSON.stringify(INFO)+I0,lookHist.length,lookFut.slice(-1)]).slice(0,500)`);
      if(u)badEdit.push(tag+' 되돌리기 안 됨 '+u);
    }}
  if(noReach.length)console.log('  못 누른 항목:',noReach.join(', '));for(const l of [badSel,badSize,badEdit,badRest,badMove])if(l.length)console.log('  '+l.join('\n  '));
  is(`모든 항목을 누르면 골라짐 (항목 ${nItem}개)`,!badSel.length);is('모든 항목을 누를 수 있음',!noReach.length);is('모서리를 끌면 커지고 맞은편 모서리는 제자리',!badSize.length);is('두 번 누르면 글을 고치고 되돌릴 수 있음',!badEdit.length);is('끌면 그 항목만 움직임',!badMove.length);is('크기를 바꿔도 다른 항목은 제자리',!badRest.length);
  // 글을 안 고치고 빈 곳을 눌러 나가도 글자가 그대로 보임
  {const gone=[];for(const[p,st,k]of [['song','','lyrics'],['word','','ref'],['quote','body','body'],['info:a1','full','ititle'],['info:a3','full','ihead']]){await prep(p,st,false);await ev(`window.RG=edOf(CV).lay.regions.find(r=>r.k==='${k}');window.px=c=>c.getContext('2d').getImageData(RG.x,RG.y,RG.w,RG.h).data;window.far=(a,b)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>90)n++;return n;};px(CV);CV._draw();window.p0=px(CV)`);await dbl(await ev(`return at(CV,'${k}')`));await z(150);
    const opened=await ev(`return !$('sbInl').hidden&&(window.p1=px(cvOf('${p}')),window.nHid=far(p0,p1))>20`);const e=await ev(`const b=cvOf('${p}').closest('.sgroup').getBoundingClientRect();return[b.right-30,Math.min(innerHeight-20,b.bottom-5)]`);await click(e);await z(500);
    if(!opened||await ev(`return far(px(cvOf('${p}')),p1)<nHid*.8`))gone.push(p+' '+k+(opened?'':' 안 열림'));}if(gone.length)console.log('  '+gone.join(', '));is('고치지 않고 빈 곳을 눌러 나가도 글자가 보임',!gone.length);}
  // 단축키
  await prep('info:a1','full',false);{await click(await ev(`return at(CV,'bandr')`));is('띠 도형을 글자와 따로 고름',await ev(`return ED.keys.join()==='bandr'`));
    for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Delete',code:'Delete',windowsVirtualKeyCode:46},S);await z(300);
    is('Delete는 그 장에서만 숨김 · 글은 그대로',await ev(`window.CV=cvOf('info:a1');const a=Object.keys(regs(CV)),b=Object.keys(regs(cvOf('info:a4')));return !a.includes('bandr')&&a.includes('iband')&&b.includes('bandr')&&JSON.stringify(INFO)===I0`));
    is('숨긴 것이 저장되고 되돌려짐',await ev(`const o=textOv(ovLine()[0]);const r=Object.values(o.v).some(v=>v.hide_bandr===true);undoLook();await W(300);return r&&Object.keys(regs(cvOf('info:a1'))).includes('bandr')`));
    await ev(`window.CV=cvOf('info:a1')`);await click(await ev(`return at(CV,'ititle')`));await ev(`window.b3=regs(CV)`);for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'ArrowRight',code:'ArrowRight',windowsVirtualKeyCode:39},S);await z(300);
    is('화살표로 그 항목만 옮김',await ev(`const n=regs(cvOf('info:a1'));return Object.keys(n).filter(q=>Math.abs(n[q][0]-b3[q][0])>.0005).join()==='ititle'`));
    for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9},S);await z(200);is('Tab으로 다음 항목',await ev(`return ED&&ED.keys.length===1&&ED.keys[0]!=='ititle'`));
    await keys('a',4);is('⌘A로 모두 고름',await ev(`return ED.keys.length===edCtx().lay.regions.length`));await keys('Escape');
    await ev(`window.CV=cvOf('info:a1')`);await click(await ev(`return at(CV,'iband')`));await keys('Enter');is('Enter로 글 고치기',await ev(`return !$('sbInl').hidden&&sbEditK==='iband'`));await keys('Escape');}
  // 복사·붙여넣기는 항목 자체 · 새 글상자·도형 · 도형 8점 · 가이드 · 말풍선 · 숫자 위아래
  await prep('song','',false);{await click(await ev(`return at(CV,'lyrics')`));await keys('c',4);await keys('v',4);await z(400);
    is('⌘C·⌘V로 항목 자체를 복사 (이 장에만)',await ev(`window.CV=cvOf('song');const s=find('song'),o=objsOf(s);return o.length===1&&o[0].t==='text'&&o[0].text.includes('온 백성')&&ED.keys[0]==='o:'+o[0].id&&!objParse(LOOK.song.objsAll).length&&!!SLIDE_OV[s.ovKey].objs`));
    await keys('d',4);await z(300);is('⌘D로 복제',await ev(`return objsOf(find('song')).length===2`));
    for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Delete',code:'Delete',windowsVirtualKeyCode:46},S);await z(300);is('Delete로 새 글상자 지움',await ev(`return objsOf(find('song')).length===1`));
    is('저장했다 다시 열어도 그대로',await ev(`const t=textOv(ovLine()[0]),s=find('song');return objParse(t.v[s.ovKey].objs).length===1`));}
  await prep('info:a1','full',false);{await ev(`lookSlideKey=find('info:a1').ovKey;buildLookUI();document.querySelector('[data-ins=shape]').click();await W(200);document.querySelector('.tp-pop [data-k=rect]').click();await W(500);window.CV=cvOf('info:a1')`);
    is('+ 도형으로 이 장에 넣고 골라짐',await ev(`const o=objsOf(find('info:a1')).filter(q=>q.t==='shape');return o.length===1&&ED&&ED.keys[0]==='o:'+o[0].id`));
    is('도형은 점이 8개',await ev(`return document.querySelectorAll('.edfr i').length===8`));
    const r0=await ev(`return regs(CV)[ED.keys[0]]`),hE=await ev(`return handle('e')`);await drag(hE,[hE[0]+40,hE[1]]);await z(300);
    is('옆 점은 너비만 바꿈',await ev(`window.CV=cvOf('info:a1');const r=regs(CV)[ED.keys[0]],a=${JSON.stringify(r0)};return r[2]>a[2]+.02&&Math.abs(r[3]-a[3])<.002&&Math.abs(r[0]-a[0])<.002`));
    await ev(`window.CV=cvOf('info:a1');window.g0=null;const o=MutationObserver;window.GL=[];new o(()=>{const n=document.querySelectorAll('.edgd');if(n.length)GL.push(n.length);}).observe(document.body,{subtree:true,childList:true})`);
    const p=await ev(`return at(CV,ED.keys[0])`);await drag(p,[p[0]+25,p[1]+12]);is('끌면 십자 가이드가 나오고 놓으면 사라짐',await ev(`return GL.some(n=>n>=2)&&!document.querySelector('.edgd')`));
    await ev(`window.CV=cvOf('info:a1')`);await click(await ev(`return at(CV,ED.keys[0])`));await ev(`lookPane='place';buildLookUI()`);const b=await ev(`const r=$('tpW').closest('.tp-num').querySelector('.tp-ud button').getBoundingClientRect();window.w0=+$('tpW').value;return[r.left+r.width/2,r.top+r.height/2]`);await click(b);await z(300);
    is('숫자 칸 위 단추로 올림',await ev(`return Math.abs(+$('tpW').value-(w0+.5))<.01&&Math.abs(objsOf(find('info:a1')).find(q=>q.t==='shape').w-(w0+.5))<.01`));
    await ev(`window.CV=cvOf('info:a1');CV.scrollIntoView({block:'center'});await W(150)`);const q=await ev(`return at(CV,'ititle')`);await mouse('mouseMoved',q[0],q[1]);await z(700);
    is('커서를 올리면 이름이 그 아래 나옴',await ev(`const t=document.querySelector('.edtip');if(!t)return false;const r=t.getBoundingClientRect();return t.textContent.includes('제목')&&r.top>`+q[1]+`-60&&r.top<`+q[1]+`+260`));
    await mouse('mouseMoved',5,5);await ev(`lookPane='text';buildLookUI()`);}
  await prep('song','',false);{await click(await ev(`return at(CV,'lyrics')`));await ev(`lookPane='text';buildLookUI()`);const it=await ev(`const b=[...document.querySelectorAll('.tp-sty button')][1].getBoundingClientRect();return[b.left+b.width/2,b.top+b.height/2]`);await click(it);await z(300);
    is('기울임 단추는 그 글자만',await ev(`window.CV=cvOf('song');const l=edOf(CV).lay.texts;return LOOK.song.lyricsIt===true&&l.find(t=>t.kind==='lyrics').it&&!l.find(t=>t.kind==='title').it`));
    is('파워포인트에도 기울임',await ev(`const c=document.createElement('canvas');c.width=1920;c.height=1080;const l=drawScreen(c,find('song'),0,{noText:true});return !!l.texts.find(t=>t.kind==='lyrics').it`));}
  is('툴바에 되돌리기 화살표가 없음 · 갓피아 아이콘이 보임',await ev(`const i=document.querySelector('.tlink img');setPage('word');await W(700);const r=!$('lkUndo')&&!$('lkRedo')&&i.complete&&i.naturalWidth>0;setPage('slides');await W(500);return r`));
  // 도형 고르기 · 아래 문구 정렬
  await prep('song','',false);{await ev(`lookSlideKey=find('song').ovKey;buildLookUI();document.querySelector('[data-ins=shape]').click();await W(200);return 1`);
    is('도형 말풍선에 6가지',await ev(`return [...document.querySelectorAll('.tp-pop [data-k]')].map(b=>b.dataset.k).join()==='rect,round,ellipse,tri,arrow,line'`));
    await ev(`document.querySelector('.tp-pop [data-k=ellipse]').click();await W(500);return 1`);
    is('고른 모양으로 들어가고 모양 탭이 열림',await ev(`const o=objsOf(find('song'));return o.length===1&&o[0].kind==='ellipse'&&!!$('tpFill')&&!document.querySelector('.tp-pop')`));
    is('아래 문구 왼쪽·오른쪽 정렬',await ev(`const c=document.createElement('canvas');c.width=1920;c.height=1080;const x=a=>{LOOK.song.fAlign=a;return drawScreen(c,find('song'),0).regions.find(q=>q.k==='footer').x;};const l=x('left'),m=x('center'),r=x('right');LOOK.song.fAlign=undefined;return l<200&&m>600&&r>m+300`));}
  // 블록 지정한 글자만
  await prep('song','',false);{await dbl(await ev(`return at(CV,'lyrics')`));await z(200);
    await ev(`const t=$('sbInl'),a=t.value.indexOf('찬송');t.setSelectionRange(a,a+2);t.dispatchEvent(new Event('select'))`);
    const b=await ev(`lookPane='text';buildLookUI();const r=[...document.querySelectorAll('.tp-sty button')][1].getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]`);
    await ev(`document.querySelector('.tp-sty button').focus()`);await z(400);
    is('블록을 지정하고 칸을 누르면 고른 글자만 모드',await ev(`return !!document.querySelector('.tp-run')&&lookRun&&lookRun.t==='찬송'`));
    await click(await ev(`const r=[...document.querySelectorAll('.tp-sty button')][1].getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]`));await z(300);
    await ev(`$('tpColor').value='#ff0000';$('tpColor').oninput()`);await z(300);
    is('고른 글자에만 기울임·색',await ev(`window.CV=cvOf('song');const s=find('song'),r=runParse(SLIDE_OV[s.ovKey].runs),t=edOf(CV).lay.texts.find(q=>q.kind==='lyrics');return r.length===1&&r[0].t==='찬송'&&r[0].s.it===true&&r[0].s.color==='#ff0000'&&!LOOK.song.lyricsIt&&!!t.rl&&t.rl.some(l=>l.length)`));
    is('일부 모양이 파워포인트 토막 글로',await ev(`const c=document.createElement('canvas');c.width=1920;c.height=1080;const l=drawScreen(c,find('song'),0,{noText:true}),t=l.texts.find(q=>q.kind==='lyrics');const sg=t.lines.flatMap((x,i)=>t.rl[i]&&t.rl[i].length?runSegs(t,x,i):[]);return sg.some(g=>g.s.it&&g.tx.includes('찬송'))`));
    is('그 글자를 고쳐도 다른 줄을 고치면 따라감',await ev(`const ta=$('outText');ta.value=ta.value.replace('아멘 아멘 할렐루야','아멘 아멘 할렐루야 아멘');ta.dispatchEvent(new Event('input',{bubbles:true}));await W(500);const c=document.createElement('canvas');c.width=960;c.height=540;const t=drawScreen(c,all().find(s=>s.ed==='song'&&!s.blank),0).texts.find(q=>q.kind==='lyrics');return !!t.rl`));
    is('고른 글자 풀기',await ev(`document.querySelector('.tp-run .tbtn').click();return !lookRun&&!document.querySelector('.tp-run')`));}
  // 여러 개
  await prep('word','',false);{const a=await ev(`return at(CV,'head')`);await click(a);const b=await ev(`return at(CV,'ref')`);await click(b,{shift:true});await z(300);await ev(`window.CV=cvOf('word');window.b0=regs(CV)`);
    is('Shift로 여러 개 고르기',await ev(`return ED.keys.join()==='head,ref'&&document.querySelectorAll('.edfr').length===2`));await shot('여러개.png',S);
    const p=await ev(`return at(CV,'head')`);await drag(p,[p[0]+30,p[1]+12]);await z(250);
    is('같이 옮겨짐',await ev(`window.CV=cvOf('word');const n=regs(CV),d=k=>n[k][0]-b0[k][0];window.b1=n;return d('head')>.02&&Math.abs(d('head')-d('ref'))<.002&&Math.abs(d('body'))<.0001&&ED.keys.length===2`));
    const h=await ev(`return handle('se')`);await drag(h,[h[0]+40,h[1]+6]);await z(250);
    is('같이 커지고 비율이 같음',await ev(`window.CV=cvOf('word');const a=LOOK.word.hSize/3.1,b=LOOK.word.rSize/2.9;return a>1.03&&Math.abs(a-b)<.01`));
    await keys('z',4);is('⌘Z로 크기만 되돌림',await ev(`return lv(LOOK.word,'hSize','word')===3.1&&Math.abs(LOOK.word.ox_head)>1`));await keys('z',4);is('한 번 더 누르면 자리도 되돌림',await ev(`return !LOOK.word.ox_head&&!LOOK.word.ox_ref`));
    await keys('z',12);await keys('z',12);is('Shift+⌘Z로 다시 하기',await ev(`return LOOK.word.hSize>3.1&&LOOK.word.rSize>2.9&&!lookFut.length`));
    await keys('z',2);is('Ctrl+Z도 됨',await ev(`return lv(LOOK.word,'hSize','word')===3.1`));
    await keys('Escape');is('Esc로 고르기 풀림',await ev(`return !ED&&!document.querySelector('.edfr')`));}
  await prep('word','',false);{await click(await ev(`return at(CV,'box')`));await ev(`window.l0=edOf(CV).lay.texts.find(t=>t.kind==='body').lines.join('|');window.n0=all().filter(s=>s.ed==='word').length;window.s0=LOOK.word.size;window.x0=regs(CV).box`);await z(300);
    const h=await ev(`return handle('sw')`);await drag(h,[h[0]+120,h[1]-40]);await z(700);
    is('본문 상자만 줄이면 글자 크기 그대로, 줄과 장이 다시 나뉨',await ev(`window.CV=cvOf('word');const l=edOf(CV).lay,t=l.texts.find(t=>t.kind==='body'),b=l.regions.find(r=>r.k==='box'),y=l.regions.find(r=>r.k==='body'),n=regs(CV).box;return LOOK.word.size===s0&&t.lines.join('|')!==l0&&all().filter(s=>s.ed==='word').length>=n0&&y.x+y.w<=b.x+b.w&&y.y+y.h<=b.y+b.h&&Math.abs(n[0]+n[2]-x0[0]-x0[2])<.004`));
    is('상자를 바꿔도 편집 칸과 슬라이드 줄이 같음',await ev(`setPage('word');setWordTab('body');await W(900);const d=all().filter(s=>s.ed==='word').flatMap(s=>{const c=document.createElement('canvas');c.width=1920;c.height=1080;return drawScreen(c,s,0).texts.find(t=>t.kind==='body').lines;}).filter(Boolean).join('|');const r=$('wEd').value.split('\\n').filter(Boolean).join('|')===d;setPage('slides');await W(600);return r`));}
  await prep('word','',false);{await click(await ev(`return at(CV,'box')`));await z(300);await ev(`window.CV=cvOf('word')`);await click(await ev(`return at(CV,'body')`),{shift:true});await z(200);const h=await ev(`const f=[...document.querySelectorAll('.edfr')].find(x=>x.textContent.includes('상자'));const b=f.querySelector('[data-h=se]').getBoundingClientRect();return[b.left+6,b.top+6]`);await drag(h,[h[0]-60,h[1]-24]);await z(400);
    is('상자와 본문을 같이 고르면 글자도 같이',await ev(`return LOOK.word.size<2.95&&LOOK.word.bxW<71&&Math.abs(LOOK.word.size/3-LOOK.word.bxW/71.9)<.01`));}
  // 이 슬라이드만
  await prep('word','',false);{await click(await ev(`return at(CV,'ref')`));is('모든 슬라이드가 기본',await ev(`return lookScope==='all'`));await ev(`$('lookCtl').querySelector('[data-sc=slide]').click();window.CV=cvOf('word')`);await click(await ev(`return at(CV,'head')`));is('같은 장의 다른 항목을 눌러도 범위가 그대로',await ev(`return lookScope==='slide'`));
    const h=await ev(`return handle('se')`);await drag(h,[h[0]+30,h[1]+4]);await z(300);
    is('이 슬라이드만 키우면 그 장만',await ev(`const a=all().filter(s=>s.ed==='word');return lv(LOOK.word,'hSize','word')===3.1&&SLIDE_OV[a[0].ovKey].hSize>3.1&&!SLIDE_OV[a[1].ovKey]`));}
  await prep('word','',false);{await dbl(await ev(`return at(CV,'ref')`));await ev(`$('sbInl').value='요한복음 3:16 하반절';endInline(true)`);await z(400);
    is('구절 이름은 그 장만 · 본문 이름은 그대로',await ev(`const a=all().filter(s=>s.ed==='word'),n=s=>{const c=document.createElement('canvas');c.width=960;c.height=540;return drawScreen(c,s,0).texts.find(t=>t.kind==='ref').lines[0];};return a.length>1&&n(a[0])==='요한복음 3:16 하반절'&&n(a[1])==='요한복음 3:16'&&$('wordText').value===T0[1]&&dmRows().find(r=>r.s.ed==='word').title==='요한복음 3:16 하반절'`));
    await ev(`window.CV=cvOf('word')`);await dbl(await ev(`return at(CV,'ref')`));await ev(`$('sbInl').value='';endInline(true)`);await z(300);is('구절 이름을 비우면 본문 이름으로',await ev(`return !Object.values(SLIDE_OV).some(o=>o.refT)`));}
  // 장이 늘고 줄어도 안 옮겨 붙음 · 예배에 저장
  await ev(`await rs();const a=all().filter(s=>s.ed==='word');window.txt=a[1].lines[0];SLIDE_OV[a[1].ovKey]={rColor:'#ff0000'};saveLook();await W(300);window.red=()=>all().filter(s=>SLIDE_OV[s.ovKey]?.rColor).map(s=>s.lines.join(' '))`);
  is('한 장에 한 절을 켜고 꺼도 그 글의 장을 따라감',await ev(`LOOK.word.oneVerse=true;const a=red();LOOK.word.oneVerse=false;const b=red();return a.length===1&&a[0].startsWith(txt.slice(0,6))&&b.length===1&&b[0].startsWith(txt.slice(0,6))`));
  is('앞에 장이 늘어도 따라감',await ev(`const t=$('wordText');t.value=t.value.replace('1 하나님이','1 새로 넣은 첫째 절입니다\\n1 새로 넣은 둘째 절입니다\\n1 새로 넣은 셋째 절입니다\\n1 새로 넣은 넷째 절입니다\\n1 하나님이');t.dispatchEvent(new Event('input',{bubbles:true}));const a=red();return a.length===1&&/[67] 저/.test(a[0])&&!a[0].includes('새로 넣은')`));
  is('그 글을 지우면 다른 장에 안 붙고, 되살리면 다시 붙음',await ev(`const t=$('wordText'),k=t.value;t.value='요한복음 3:16\\n1 전혀 다른 글';t.dispatchEvent(new Event('input',{bubbles:true}));const a=red();t.value=k;t.dispatchEvent(new Event('input',{bubbles:true}));const b=red();return a.length===0&&b.length===1&&/[67] 저/.test(b[0])`));
  is('예배에 저장되고 다시 열면 그대로',await ev(`saveSession();const c=curS(),k=JSON.stringify(SLIDE_OV);SLIDE_OV={};OV_AT={};loadSession(c.id);const r=JSON.stringify(SLIDE_OV)===k&&c.text.includes('"k":"ov"')&&red().length===1;return r`));
  is('다른 예배에는 안 나옴',await ev(`const id=curSess,t=T0[1];newSessClick();$('wordText').value=t;$('wordText').dispatchEvent(new Event('input',{bubbles:true}));await W(200);const a=red().length;loadSession(id);return a===0&&red().length===1&&!lookHist.length`));
  is('저장된 글이 이상해도 안전',await ev(`const o=textOv('〔순서〕 '+JSON.stringify({k:'ov',v:{'s:a:0':{font:'x"><img>',size:5,bad:{a:1}},'__proto__x':{size:1},'w:b:0':7}}));return JSON.stringify(o.v)==='{"s:a:0":{"size":5}}'`));
  is('저장 줄이 가사나 순서로 안 나옴',await ev(`const s=splitCombined(combinedText());return !s.song.includes('"k"')&&s.info.every(o=>IKIND[o.k])`));
  is('예전에 이 컴퓨터에만 있던 것은 한 번 옮겨짐',await ev(`const c=curS(),t=c.text;c.text=t.split('\\n').filter(l=>!l.includes('"k":"ov"')).join('\\n');const k=all().find(s=>s.ed==='word').ovKey;OV_OLD={[k]:{size:4},'w:없는 본문:0':{size:5}};loadSession(c.id);const r=SLIDE_OV[k]?.size===4&&Object.keys(SLIDE_OV).length===1;OV_OLD={};return r`));
  // 팀원이 먼저 고친 글은 되돌리기가 안 덮음
  is('되돌리기가 팀원이 고친 글을 안 덮음',await ev(`await rs();openSlide(all().findIndex(s=>s.ed==='word'));startInline('body');$('sbInl').value=$('sbInl').value.replace('하나님이','하나님께서');endInline(true);await W(300);$('wordText').value='요한복음 3:16\\n1 팀원이 바꿈';$('wordText').dispatchEvent(new Event('input',{bubbles:true}));undoLook();const a=$('wordText').value;closeSlide();return a==='요한복음 3:16\\n1 팀원이 바꿈'&&$('toast').textContent.includes('못했어요')`));
  is('글을 고치고 새로 고치면 다시 하기는 비움',await ev(`await rs();LOOK.song.size=6;saveLook();undoLook();const a=lookFut.length;lookPrevT=0;LOOK.song.size=4;saveLook();return a===1&&lookFut.length===0&&lookHist.length>0`));
  is('곡 제목을 고치면 색과 설정도 따라감',await ev(`await rs();const s=find('song');songColors[s.title]='rose';SLIDE_OV[s.ovKey]={size:6};renderShots();await W(300);openSlide(all().findIndex(x=>x.ed==='song'));startInline('title');const old=$('sbInl').value;$('sbInl').value='새 제목';endInline(true);await W(300);const n=find('song'),r=n.title==='새 제목'&&songColors['새 제목']==='rose'&&SLIDE_OV[n.ovKey]?.size===6;closeSlide();return r&&!!old`));
  is('광고 여러 장 중 한 장만 고침',await ev(`await rs();INFO[2].body=Array.from({length:9},(_,i)=>(i+1)+'번째 줄').join('\\n')+'\\n\\n끝 문단';saveInfo();await W(300);const b=all().filter(s=>s.iid==='a3');openSlide(all().findIndex(s=>s.iid==='a3'&&s.page===1));startInline('ibody');$('sbInl').value=$('sbInl').value.replace('8번째','여덟째');endInline(true);await W(300);closeSlide();return b.length===3&&INFO[2].body===['1번째 줄','2번째 줄','3번째 줄','4번째 줄','5번째 줄','6번째 줄','7번째 줄','여덟째 줄','9번째 줄'].join('\\n')+'\\n\\n끝 문단'`));
  // 작은 미리보기 글 고치기 · 확대 단추
  await prep('song','',false);{await dbl(await ev(`return at(CV,'lyrics')`));await z(200);is('미리보기에서 고치는 칸이 글자 위에 놓임',await ev(`const b=CV.getBoundingClientRect(),t=$('sbInl').getBoundingClientRect();return t.width>20&&t.left>=b.left-2&&t.top>=b.top-2&&t.right<=b.right+4`));await shot('미리보기고치기.png',S);await keys('Escape');
    await ev(`window.CV=cvOf('song')`);await click(await ev(`return at(CV,'lyrics')`));await z(300);await ev(`window.CV=cvOf('song')`);await shot('미리보기고르기.png',S);const g=await ev(`const b=CV.closest('.shotw').querySelector('.shotbig').getBoundingClientRect();return[b.left+9,b.top+9]`);await click(g);await z(300);is('확대 단추로 크게 보기',await ev(`return $('slidebox').classList.contains('on')`));await click(await ev(`return at(bigCv,'lyrics')`));await shot('크게보기.png',S);await keys('Escape');is('크게 보기: Esc 한 번은 고르기만 풀림',await ev(`return $('slidebox').classList.contains('on')&&!ED`));await keys('Escape');is('크게 보기: 한 번 더는 닫기',await ev(`return !$('slidebox').classList.contains('on')`));}
  for(const pg of ['song','word','info']){await ev(`await rs();setPage('${pg}');await W(900);window.CV=[...document.querySelectorAll('.pvbody canvas')].find(c=>c.offsetParent);CV.scrollIntoView({block:'center'});await W(150)`);const k=await ev(`return ['lyrics','body','ititle','inotice','ibody'].find(k=>at(CV,k))`);await dbl(await ev(`return at(CV,'${k}')`));await z(250);is(`${pg} 탭 미리보기에서도 바로 고치기`,await ev(`return !$('sbInl').hidden&&sbEditK==='${k}'`));await keys('Escape');}
  // 파워포인트·송출도 같은 그림을 쓰는지
  is('내려받기·송출과 같은 그리기',await ev(`await rs();setPage('slides');LOOK.song.ox_lyrics=7;LOOK.song.size=6;saveLook();await W(300);const s=find('song'),b=await shotJpg(s,0),a=liveSig();LOOK.song.size=5;return b.size>1000&&a!==liveSig()`));
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,300)));
}catch(e){bad++;console.log('멈춤',e.stack);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
