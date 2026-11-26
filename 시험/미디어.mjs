// 미디어 시험: node 시험/미디어.mjs  (크롬만 있으면 돼요. 실제 서버에는 붙지 않아요)
import http from 'http';import fs from 'fs';import os from 'os';import path from 'path';import {spawn} from 'child_process';import {fileURLToPath} from 'url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..'),CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOT=process.env.SHOT,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hogam-media-')),z=ms=>new Promise(r=>setTimeout(r,ms));
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
const send=(method,params={},sessionId)=>new Promise(r=>{wait[++n]=r;ws.send(JSON.stringify({id:n,method,params,sessionId}));});
const attach=async id=>{const s=(await send('Target.attachToTarget',{targetId:id,flatten:true})).result.sessionId;for(const m of ['Runtime.enable','Page.enable','Network.enable'])await send(m,{},s);await send('Emulation.setFocusEmulationEnabled',{enabled:true},s);return s;};
const pages=async()=>(await send('Target.getTargets')).result.targetInfos.filter(t=>t.type==='page');
let S=await attach((await pages())[0].targetId);const main=(await pages())[0].targetId;
const ev=async(e,s=S)=>{const r=await send('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true,userGesture:true},s);if(r.result?.exceptionDetails)throw new Error(r.result.exceptionDetails.exception?.description||'eval');return r.result?.result?.value;};
const until=async(e,ms=40000,s=S)=>{const t=Date.now();while(Date.now()-t<ms){if(await ev(`return !!(${e})`,s).catch(()=>0))return true;await z(150);}return false;};
let ok=0,bad=0;const is=(name,v)=>{v?ok++:bad++;console.log(v?'통과':'실패',name);};
const key=async(k,code,s=S)=>{const vk={ArrowRight:39,ArrowLeft:37,Enter:13,' ':32}[k]||k.toUpperCase().charCodeAt(0);if(process.env.HEAD){await send('Page.bringToFront',{},s);await z(250);}for(const type of ['keyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:k,code:code||k,windowsVirtualKeyCode:vk},s);await z(350);};
const open=async()=>{await send('Page.navigate',{url:base},S);await until(`document.readyState==='complete'&&typeof liveRestore==='function'&&LOOK`);await z(1500);await ev(`$('gate').classList.remove('on')`);};
// 미디어 창 그림의 지문 (실제로 보이는 픽셀)
const pix=s=>ev(`const c=document.getElementById('c'),d=c.getContext('2d').getImageData(0,0,1920,1080).data;let h=0;for(let i=0;i<d.length;i+=404)h=(h*31+d[i]+d[i+1]*3+d[i+2]*7)|0;return h+':'+[...d.slice(0,3)]`,s);
const shot=async(f,s)=>{if(SHOT)fs.writeFileSync(path.join(SHOT,f),Buffer.from((await send('Page.captureScreenshot',{format:'png'},s)).result.data,'base64'));};
try{
  await ev(`localStorage`).catch(()=>{});await send('Page.navigate',{url:base},S);await z(2500);
  await ev(`sessionStorage.setItem('cj_church','test-church')`);await open();
  await ev(`window.W=ms=>new Promise(r=>setTimeout(r,ms));const e=$('outText');e.value='만복의 근원 하나님\\n온 백성 찬송 드리고';e.dispatchEvent(new Event('input',{bubbles:true}));INFO=[];saveInfo();setPage('info');return 1`);await z(800);
  const put=async(js)=>ev(`const f=await (async()=>{${js}})(),dt=new DataTransfer();dt.items.add(f);const i=$('mediaIn');i.files=dt.files;i.dispatchEvent(new Event('change'));return 1`);
  // 이미지
  await put(`const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#d33';x.fillRect(0,0,800,600);return new File([await new Promise(r=>c.toBlob(r,'image/png'))],'빨간 그림.png',{type:'image/png'})`);
  is('이미지를 넣으면 한 장',await until(`INFO.length===1&&INFO[0].k==='media'&&INFO[0].mk==='image'&&infoScreens().length===1`,8000));
  is('이미지가 슬라이드에 그려짐',await until(`(()=>{const c=document.createElement('canvas');c.width=192;c.height=108;drawScreen(c,songGroups().flatMap(g=>g.items).find(s=>s.ik==='media'),0);const d=c.getContext('2d').getImageData(96,54,1,1).data;return d[0]>180&&d[1]<90})()`,8000));
  // PDF 두 쪽
  await put(`const pdf='%PDF-1.4\\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\\n2 0 obj<</Type/Pages/Kids[3 0 R 4 0 R]/Count 2>>endobj\\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 300]>>endobj\\n4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 400 300]>>endobj\\ntrailer<</Root 1 0 R>>\\n%%EOF';return new File([pdf],'주보.pdf',{type:'application/pdf'})`);
  is('PDF는 쪽마다 한 장',await until(`INFO.length===2&&INFO[1].mk==='pdf'&&INFO[1].np===2&&infoScreens().filter(s=>s.iid===INFO[1].id).length===2`,20000));
  // 파워포인트는 PDF로 안내
  await put(`return new File(['x'],'광고.pptx',{type:'application/vnd.openxmlformats-officedocument.presentationml.presentation'})`);await z(400);
  is('파워포인트는 PDF로 저장하라고 안내',await ev(`return INFO.length===2&&$('toast').textContent.includes('PDF')`));
  // 동영상 (캔버스로 2초짜리 만들기)
  await put(`const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d'),st=c.captureStream(30),r=new MediaRecorder(st,{mimeType:'video/webm'}),ch=[];r.ondataavailable=e=>ch.push(e.data);r.start(100);let t=0;const iv=setInterval(()=>{x.fillStyle=t++%2?'#2a6':'#26a';x.fillRect(0,0,320,180);},50);await W(2000);r.stop();clearInterval(iv);await new Promise(q=>r.onstop=q);return new File(ch,'선교 영상.webm',{type:'video/webm'})`);
  is('동영상을 넣으면 이 컴퓨터에 저장되고 첫 장면이 보임',await until(`INFO.length===3&&INFO[2].mk==='video'&&!!MIMG[INFO[2].mid+'.0']`,20000));
  is('저장 글에 미디어 칸이 들어가고 다시 읽힘',await ev(`const s=splitCombined(combinedText());return s.info.filter(o=>o.k==='media').length===3`));
  // 송출: 동영상 장에서 재생 · 소리 · 멈춤
  await ev(`setPage('slides');$('dlLive').click()`);is('송출 준비',await until(`!$('lvStart').disabled`,30000));await ev(`$('lvStart').click()`);await z(1500);
  const pt=(await pages()).find(t=>t.targetId!==main),P=await attach(pt.targetId);await z(300);
  await ev(`const i=LIVE.slides.findIndex(s=>s.video);liveMove(i);return i`);await z(1500);
  is('동영상 장이면 송출 창에서 재생',await until(`(()=>{const v=document.getElementById('v');return v&&v.style.display!=='none'&&v.currentTime>0})()`,8000,P));
  is('조작 창에 동영상 단추가 보임',await ev(`return !$('lvVid').classList.contains('hidden')`));
  await ev(`$('lvVVol').value=30;$('lvVVol').oninput({target:$('lvVVol')});$('lvVPlay').click();await W(300);return 1`);
  is('소리 크기와 멈춤이 송출 창에 적용',await ev(`const v=document.getElementById('v');return Math.abs(v.volume-.3)<.01&&v.paused`,P));
  await ev(`$('lvVMute').click();await W(300);return 1`);is('음소거 아이콘으로 소리를 끄고 켬',await ev(`return document.getElementById('v').muted`,P)&&await ev(`return !!$('lvVMute').querySelector('.ph-speaker-slash')&&!$('lvVMute').textContent.trim()`));await ev(`$('lvVMute').click()`);await z(300);
  await ev(`liveMove(0)`);await z(600);is('다른 장으로 가면 동영상이 사라짐',await ev(`const v=document.getElementById('v');return !v||v.style.display==='none'`,P)&&await ev(`return $('lvVid').classList.contains('hidden')`));
  await ev(`await liveWipe()`);
  // 지우면 그림도 지움 (되돌리기 시간 뒤)
  await ev(`const mid=INFO[0].mid;window.MD=mid;removeInfo(0);return 1`);await z(7800);
  is('미디어를 지우면 이 컴퓨터의 그림도 지움',await ev(`const v=await mediaKv('readonly',s=>s.get('p:'+MD+'.0'));return !v`));
  is('코드 오류 없음',!errs.filter(e=>!/fetch|network|invalid|Failed/i.test(e)).length);if(errs.length)console.log(errs.slice(0,3).map(e=>e.slice(0,300)));
}catch(e){bad++;console.log('멈춤',e.stack);}
console.log(`통과 ${ok} · 실패 ${bad}`);ch.kill();srv.close();await z(500);fs.rmSync(tmp,{recursive:true,force:true});process.exit(bad?1:0);
