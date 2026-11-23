import fs from 'fs';const z=ms=>new Promise(r=>setTimeout(r,ms));let l;for(let i=0;i<40;i++){try{l=await(await fetch('http://127.0.0.1:9399/json')).json();if(l.some(x=>x.type=='page'))break}catch{}await z(250)}
const w=new WebSocket(l.find(x=>x.type=='page').webSocketDebuggerUrl);await new Promise(r=>w.onopen=r);let n=0,m={};w.onmessage=e=>{const d=JSON.parse(e.data);if(d.method=='Runtime.exceptionThrown')console.log('ERR',d.params.exceptionDetails.exception?.description?.slice(0,200));m[d.id]?.(d.result)};
const c=(method,params={})=>new Promise(r=>{m[++n]=r;w.send(JSON.stringify({id:n,method,params}))});
const ev=async e=>{const r=await c('Runtime.evaluate',{expression:`(async()=>{${e}})()`,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)console.log('EX',r.exceptionDetails.exception?.description);return r.result.value};
await c('Runtime.enable');await c('Page.enable');await c('Network.enable');await c('Network.setBlockedURLs',{urls:['*supabase.co*']});
await c('Emulation.setDeviceMetricsOverride',{width:1440,height:1400,deviceScaleFactor:2,mobile:false});await c('Page.navigate',{url:'http://127.0.0.1:8792/index.html'});await z(5000);
await ev(`document.getElementById('gate').classList.remove('on');document.documentElement.dataset.theme='light';LOOK.song.footer='';LOOK.song.footerOn=false;LOOK.song.size=7;renderSongs()`);await z(800);
const rect=async s=>JSON.parse(await ev(`const r=document.querySelector('${s}').getBoundingClientRect();return JSON.stringify([r.x,r.y,r.width,r.height])`));
const snap=async(f,x,y,W,H)=>fs.writeFileSync('cap_'+f+'.jpg',Buffer.from((await c('Page.captureScreenshot',{format:'jpeg',quality:86,clip:{x,y,width:W,height:H,scale:1}})).data,'base64'));
const out={};const a=await rect('#colSong');out.a=a;out.drop=await rect('#drop');const H=548;out.pf=await rect('#colSong .pf');const PF=f=>snap(f,a[0]+1,out.pf[1],a[2]-2,out.pf[3]);
const A=f=>snap(f,a[0]+1,a[1]+1,a[2]-2,H);
await A('a0');await PF('f0');await ev(`document.getElementById('drop').classList.add('over')`);await z(500);await A('a1');await ev(`document.getElementById('drop').classList.remove('over')`);
const b64=fs.readFileSync('score.png').toString('base64');
await ev(`const url='data:image/png;base64,${b64}',blob=await(await fetch(url)).blob();window.__s=newSong({mode:'score',pages:[{blob,url}],fileName:'아침 햇살.png'});__s.status='work';songs.push(__s);renderSongs()`);await z(900);await A('a2');
await ev(`__s.title='아침 햇살';__s.result={title:'아침 햇살',linesUsed:2,charsUsed:17,sections:[{label:'1절',slides:[['아침 햇살 비추듯','주님 사랑 내게 와'],['나의 작은 노래로','주를 높이 찬양해']]},{label:'후렴',slides:[['오늘도 주와 함께','기쁨으로 걸어가']]}]};__s.status='done';renderSongs();document.getElementById('convStatus').textContent='1곡 다 읽었어요. ‘찬양 자막에 넣기’를 눌러 주세요.'`);await z(700);await A('a3');await ev(`document.getElementById('convertBtn').disabled=false`);await z(300);await PF('f1');out.btn=await rect('#convertBtn');
const r=await rect('#resPanel');
const pe=await rect('#pvSong');await snap('ce',pe[0]+1,pe[1]+1,pe[2]-2,pe[2]*548/387);await snap('b0',r[0]+1,r[1]+1,r[2]-2,H);
await ev(`document.getElementById('convertBtn').disabled=false;document.getElementById('convertBtn').click()`);await z(4500);
out.b=await rect('#resPanel');await snap('b1',out.b[0]+1,out.b[1]+1,out.b[2]-2,H);
out.ta=JSON.parse(await ev(`const t=document.getElementById('outText'),r=t.getBoundingClientRect(),s=getComputedStyle(t);return JSON.stringify({r:[r.x,r.y,r.width,r.height],lh:s.lineHeight,pt:s.paddingTop,pl:s.paddingLeft,fs:s.fontSize,al:s.textAlign,v:t.value})`));
out.pv=await rect('#pvSong');out.cs=JSON.parse(await ev(`return JSON.stringify([...document.querySelectorAll('#pvSong canvas,#pvSong img')].map(e=>{const r=e.getBoundingClientRect();return[r.x,r.y,r.width,r.height]}).filter(r=>r[2]>200))`));
const p=out.pv,cs=out.cs;await snap('c0',p[0]+1,p[1]+1,p[2]-2,cs[0][1]-p[1]-7);
for(let i=0;i<3;i++)await snap('s'+(i+1),cs[i][0],cs[i][1],cs[i][2],cs[i][3]);
fs.writeFileSync('flow.json',JSON.stringify(out));console.log(JSON.stringify(out));await c('Browser.close');process.exit()
