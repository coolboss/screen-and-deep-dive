// ==UserScript==
// @name         Screener batch export for Screen & Deep Dive
// @namespace    screen-and-deep-dive
// @version      12.0
// @description  Adds a "Batch export" button on screener.in. Downloads each company's Excel export plus a notes file (pros, cons, shareholding, announcements) into one zip for Screen & Deep Dive. Same code as the app's built-in bookmark.
// @match        https://www.screener.in/*
// @match        https://screener.in/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function(){
'use strict';
function openPanel(){

if(!/(^|\.)screener\.in$/.test(location.hostname)){alert('Open www.screener.in, log in, then click this bookmark again.');return}
if(document.getElementById('sbx')){document.getElementById('sbx').style.display='block';return}
const S=(id)=>document.getElementById(id),wait=ms=>new Promise(r=>setTimeout(r,ms));
const box=document.createElement('div');box.id='sbx';
box.style.cssText='position:fixed;z-index:2147483647;top:64px;right:14px;width:400px;max-width:calc(100vw - 28px);max-height:calc(100vh - 78px);overflow:auto;background:#11182a;color:#edf3ff;font:13px/1.45 system-ui,Segoe UI,Arial,sans-serif;border:1px solid #27334d;border-radius:14px;padding:14px;box-shadow:0 16px 45px rgba(0,0,0,.45)';
const inp='width:100%;box-sizing:border-box;background:#0a1120;color:#edf3ff;border:1px solid #27334d;border-radius:8px;padding:8px;font:12px ui-monospace,Consolas,monospace';
const btn='background:#39c792;color:#06140f;border:0;border-radius:8px;padding:8px 14px;font-weight:700;cursor:pointer;margin-right:6px';
const btn2='background:#151f35;color:#edf3ff;border:1px solid #27334d;border-radius:8px;padding:8px 12px;font-weight:700;cursor:pointer;margin-right:6px';
box.innerHTML='<div id="sbhd" style="display:flex;justify-content:space-between;align-items:center;cursor:move;user-select:none;-webkit-user-select:none;touch-action:none" title="Drag to move"><b style="font-size:15px">⠿ Screener batch export</b><span style="white-space:nowrap"><span id="sbmn" style="cursor:pointer;color:#92a1bd;font-size:18px;padding:0 10px" title="Minimise">–</span><span id="sbxx" style="cursor:pointer;color:#92a1bd;font-size:16px;padding:0 2px" title="Close">✕</span></span></div>'
+'<div style="color:#92a1bd;margin:6px 0 8px">Paste NSE symbols, BSE codes or Screener company links: one per line, or separated by commas or spaces. Each company\'s Excel export is downloaded in turn, a few seconds apart.</div>'
+'<textarea id="sbt" rows="7" style="'+inp+'" placeholder="PIDILITIND&#10;ICRA&#10;500325"></textarea>'
+'<div style="margin:8px 0"><label style="margin-right:12px"><input type="radio" name="sbv" value="c" checked> Consolidated</label><label><input type="radio" name="sbv" value="s"> Standalone</label></div>'
+'<div style="margin:0 0 8px"><label><input type="checkbox" id="sbz" checked> Put everything in one zip file (drop it straight into Screen &amp; Deep Dive)</label></div>'
+'<div style="margin:0 0 8px;color:#92a1bd">Gap between companies: <input id="sbd" type="number" min="1" max="30" value="3" style="'+inp+';width:60px;display:inline-block;padding:3px 6px"> seconds</div>'
+'<div style="margin:0 0 10px"><button id="sbf" style="'+btn2+'">Take the companies from this page</button><div style="color:#92a1bd;margin-top:4px">On a screen\'s results, a watchlist or an industry page: fills the box with every company listed, across all pages.</div></div>'
+'<button id="sbg" style="'+btn+'">Start</button><button id="sbp" style="'+btn2+'" disabled>Stop</button>'
+'<div id="sbs" style="margin-top:8px;font-weight:700"></div><div id="sbl" style="margin-top:6px;max-height:240px;overflow:auto;font:12px ui-monospace,Consolas,monospace;color:#c9d6ee"></div><div id="sbe" style="margin-top:8px"></div>';
document.body.appendChild(box);
S('sbxx').onclick=()=>{box.style.display='none'};S('sbmn').onclick=()=>{let m=box.dataset.min!=='1';box.dataset.min=m?'1':'0';[...box.children].forEach((c,i)=>{if(i)c.style.display=m?'none':''});box.style.width=m?'260px':'400px';box.style.overflow=m?'hidden':'auto';S('sbmn').textContent=m?'▢':'–';S('sbmn').title=m?'Restore':'Minimise'};(()=>{let hd=S('sbhd'),sx,sy,bx,by,on=false;const pt=e=>e.touches?e.touches[0]:e;const down=e=>{if(e.target.id==='sbmn'||e.target.id==='sbxx')return;let p=pt(e),r=box.getBoundingClientRect();sx=p.clientX;sy=p.clientY;bx=r.left;by=r.top;on=true;box.style.right='auto';box.style.left=bx+'px';box.style.top=by+'px';e.preventDefault()};const move=e=>{if(!on)return;let p=pt(e),w=box.offsetWidth;let x=Math.max(0,Math.min(window.innerWidth-60,bx+p.clientX-sx)),y=Math.max(0,Math.min(window.innerHeight-40,by+p.clientY-sy));box.style.left=x+'px';box.style.top=y+'px';e.preventDefault()};const up=()=>{on=false};hd.addEventListener('mousedown',down);hd.addEventListener('touchstart',down,{passive:false});document.addEventListener('mousemove',move);document.addEventListener('touchmove',move,{passive:false});document.addEventListener('mouseup',up);document.addEventListener('touchend',up)})();
let stop=false;S('sbp').onclick=()=>{stop=true;S('sbs').textContent='Stopping after this company…'};
const log=(t,c)=>{let p=document.createElement('div');p.textContent=t;if(c)p.style.color=c;S('sbl').appendChild(p);S('sbl').scrollTop=1e9};
const codesFrom=t=>{let out=[];String(t||'').split(/[\s,;|]+/).forEach(x=>{x=x.trim();let m=x.match(/screener\.in\/company\/([^\/?#]+)/i);if(m)x=m[1];x=x.replace(/^NSE:|^BSE:/i,'').replace(/\.(NS|BO)$/i,'');if(/^[A-Za-z0-9&\-_.]{2,25}$/.test(x))out.push(x)});let seen=new Set();return out.map(x=>x.toUpperCase()).filter(x=>!seen.has(x)&&seen.add(x))};
const cookie=n=>{let m=document.cookie.match(new RegExp('(?:^|; )'+n+'=([^;]*)'));return m?decodeURIComponent(m[1]):''};
const safe=s=>String(s||'').replace(/[\\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
function notesFrom(doc,code,name){
 try{
  const T=el=>(el&&el.textContent||'').replace(/\s+/g,' ').trim(),li=sel=>[...doc.querySelectorAll(sel)].map(T).filter(Boolean);
  let pros=li('#analysis .pros li'),cons=li('#analysis .cons li'),about=T(doc.querySelector('.company-profile .about')||doc.querySelector('.about')).slice(0,700);
  let ratios={};doc.querySelectorAll('#top-ratios li').forEach(l=>{let n=T(l.querySelector('.name')),v=T(l.querySelector('.value')||l.querySelector('.number'));if(!v)v=T(l).replace(n,'').trim();if(n)ratios[n]=v});
  let sh={},tbl=doc.querySelector('#quarterly-shp table')||doc.querySelector('#shareholding table');
  if(tbl){let heads=[...tbl.querySelectorAll('thead th')].map(T).slice(1);tbl.querySelectorAll('tbody tr').forEach(tr=>{let c=[...tr.children],lab=T(c[0]).replace(/\s*\+\s*$/,''),vals=c.slice(1).map(x=>parseFloat(T(x).replace('%','')));if(/promoter|fii|dii|public|government/i.test(lab))sh[lab]=heads.map((h,i)=>[h,vals[i]]).filter(x=>isFinite(x[1]))})}
  const items=sel=>[...doc.querySelectorAll(sel)];
  let ann=items('#documents .announcements li').slice(0,8).map(l=>{let a=l.querySelector('a'),d=T(l.querySelector('.ink-600')||l.querySelector('.smaller')),t=T(a||l);if(d)t=t.replace(d,'').trim();return {title:t.slice(0,160),date:d,href:a?a.href:''}});
  let cc=items('#documents .concalls li').slice(0,3).map(l=>{let d=T(l.querySelector('.ink-900')||l.querySelector('.nowrap')),tr=[...l.querySelectorAll('a')].find(a=>/transcript/i.test(a.textContent));if(!d)d=T(l).slice(0,10);return {date:d,transcript:tr?tr.href:''}});
  let cr=items('#documents .credit-ratings li').slice(0,3).map(l=>({title:T(l).slice(0,160),href:(l.querySelector('a')||{}).href||''}));
  let pledge=null;for(const k in ratios)if(/pledg/i.test(k)){let v=parseFloat(String(ratios[k]).replace(/[^\d.]/g,''));if(isFinite(v))pledge=v}
  return {kind:'screener-notes',code,name,captured:new Date().toISOString().slice(0,10),about,pros,cons,ratios,shareholding:sh,pledgePct:pledge,announcements:ann,concalls:cc,creditRatings:cr};
 }catch(e){return {kind:'screener-notes',code,name,captured:new Date().toISOString().slice(0,10),error:String(e)}}
}
async function exportOne(code,cons){
 let page='/company/'+encodeURIComponent(code)+'/'+(cons?'consolidated/':''),r=await fetch(page,{credentials:'same-origin'});
 if(r.status===404&&cons){page='/company/'+encodeURIComponent(code)+'/';r=await fetch(page,{credentials:'same-origin'})}
 if(r.status===404)throw Error('not found on Screener');
 if(r.status===429)throw Error('Screener says too many requests; wait a while and use a longer gap');
 if(!r.ok)throw Error('company page returned '+r.status);
 let html=await r.text(),doc=new DOMParser().parseFromString(html,'text/html');
 let el=doc.querySelector('form[action*="/user/company/export/"]')||doc.querySelector('[formaction*="/user/company/export/"]'),url=el?(el.getAttribute('formaction')||el.getAttribute('action')):'';
 if(!url){let w=doc.querySelector('[data-warehouse-id]');if(w)url='/user/company/export/'+w.getAttribute('data-warehouse-id')+'/'}
 if(!url)throw Error(/login|sign in/i.test(html)&&!/logout/i.test(html)?'not logged in to Screener':'export button not found on the company page');
 let csrf=(doc.querySelector('input[name=csrfmiddlewaretoken]')||{}).value||cookie('csrftoken');
 let name=safe(((doc.querySelector('h1')||{}).textContent||code).trim());
 let x=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/x-www-form-urlencoded','X-CSRFToken':csrf},body:'csrfmiddlewaretoken='+encodeURIComponent(csrf)});
 if(x.status===429)throw Error('Screener says too many requests; wait a while and use a longer gap');
 if(!x.ok)throw Error('export returned '+x.status);
 let buf=new Uint8Array(await x.arrayBuffer());
 if(!(buf[0]===0x50&&buf[1]===0x4b))throw Error('Screener returned a web page instead of an Excel file (export limit reached, or logged out)');
 let notes=new TextEncoder().encode(JSON.stringify(notesFrom(doc,code,name)));
 return {name:code+' - '+name+'.xlsx',data:buf,notes:{name:code+' - notes.json',data:notes}};
}
const crcT=(()=>{let t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
const crc=u=>{let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=crcT[(c^u[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0};
function zip(files){
 let enc=new TextEncoder(),parts=[],cd=[],off=0,now=new Date(),dt=((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1))&0xFFFF,dd=(((now.getFullYear()-1980)<<9)|((now.getMonth()+1)<<5)|now.getDate())&0xFFFF;
 for(const f of files){
  let nm=enc.encode(f.name),c=crc(f.data),h=new DataView(new ArrayBuffer(30));
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,dt,true);h.setUint16(12,dd,true);h.setUint32(14,c,true);h.setUint32(18,f.data.length,true);h.setUint32(22,f.data.length,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
  parts.push(new Uint8Array(h.buffer),nm,f.data);
  let e=new DataView(new ArrayBuffer(46));e.setUint32(0,0x02014b50,true);e.setUint16(4,20,true);e.setUint16(6,20,true);e.setUint16(8,0x0800,true);e.setUint16(10,0,true);e.setUint16(12,dt,true);e.setUint16(14,dd,true);e.setUint32(16,c,true);e.setUint32(20,f.data.length,true);e.setUint32(24,f.data.length,true);e.setUint16(28,nm.length,true);e.setUint32(42,off,true);
  cd.push(new Uint8Array(e.buffer),nm);off+=30+nm.length+f.data.length;
 }
 let cdLen=cd.reduce((a,b)=>a+b.length,0),q=new DataView(new ArrayBuffer(22));q.setUint32(0,0x06054b50,true);q.setUint16(8,files.length,true);q.setUint16(10,files.length,true);q.setUint32(12,cdLen,true);q.setUint32(16,off,true);
 return new Blob([...parts,...cd,new Uint8Array(q.buffer)],{type:'application/zip'});
}
const save=(blob,name)=>{let a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)};
const pageCodes=doc=>{let out=[];doc.querySelectorAll('a[href*="/company/"]').forEach(a=>{let m=(a.getAttribute('href')||'').match(/^(?:https?:\/\/[^\/]+)?\/company\/([A-Za-z0-9&\-_.]+)\/(?:consolidated\/)?(?:[?#].*)?$/);if(m&&!/^(compare|search)$/i.test(m[1])&&!a.closest('#sbx'))out.push(decodeURIComponent(m[1]).toUpperCase())});return out};
S('sbf').onclick=async()=>{
 let codes=pageCodes(document),seen=new Set(codes),pages=[...document.querySelectorAll('a[href*="page="]')].map(a=>{let m=(a.getAttribute('href')||'').match(/[?&]page=(\d+)/);return m?+m[1]:0}),last=Math.max(1,...pages);
 S('sbs').textContent=last>1?'Reading '+last+' pages of results…':'';
 for(let p=2;p<=Math.min(last,40);p++){try{let u=new URL(location.href);u.searchParams.set('page',p);let r=await fetch(u.toString(),{credentials:'same-origin'});if(!r.ok)break;let d=new DOMParser().parseFromString(await r.text(),'text/html');for(const c of pageCodes(d))if(!seen.has(c)){seen.add(c);codes.push(c)}S('sbs').textContent='Read page '+p+' of '+last+'…';await wait(700)}catch(e){break}}
 codes=[...new Set(codes)];
 if(!codes.length){S('sbs').textContent='No company links found on this page. Open a screen\'s results first.';return}
 S('sbt').value=codes.join('\n');S('sbs').textContent=codes.length+' companies taken from this page. Press Start to download them.';
};
S('sbg').onclick=async()=>{
 let codes=codesFrom(S('sbt').value);if(!codes.length){S('sbs').textContent='Paste at least one symbol.';return}
 let cons=document.querySelector('input[name=sbv]:checked').value==='c',z=S('sbz').checked,gap=Math.max(1,Math.min(30,+S('sbd').value||3))*1000,done=[],failed=[];
 stop=false;S('sbg').disabled=true;S('sbp').disabled=false;S('sbl').innerHTML='';S('sbe').innerHTML='';
 for(let i=0;i<codes.length&&!stop;i++){
  S('sbs').textContent='Exporting '+(i+1)+' of '+codes.length+': '+codes[i]+'…';
  try{let f=await exportOne(codes[i],cons);done.push(f);if(f.notes)done.push(f.notes);log('✓ '+f.name,'#65e6ad');if(!z){save(new Blob([f.data]),f.name);if(f.notes){await wait(400);save(new Blob([f.notes.data],{type:'application/json'}),f.notes.name)}}}
  catch(e){failed.push(codes[i]);log('✗ '+codes[i]+': '+e.message,'#ff9696');if(/too many requests|logged in|logged out|limit/i.test(e.message)){log('Stopped: fix the problem above, then run the failed ones again.','#f4c95d');break}}
  if(i<codes.length-1&&!stop)await wait(gap+Math.random()*800);
 }
 if(z&&done.length){let d=new Date(),stamp=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');save(zip(done),'screener-exports-'+stamp+'.zip')}
 S('sbs').textContent='Done: '+done.filter(f=>/\.xlsx$/i.test(f.name)).length+' downloaded (each with a notes file: pros, cons, shareholding, announcements)'+(failed.length?', '+failed.length+' failed':'')+(z&&done.length?'. Drop the zip file on the Get data page.':'.');
 if(failed.length){let b=document.createElement('button');b.textContent='Put the failed ones back in the box';b.style.cssText=btn2;b.onclick=()=>{S('sbt').value=failed.join('\n')};S('sbe').appendChild(b)}
 S('sbg').disabled=false;S('sbp').disabled=true;
};

}
// a small tab at the bottom right of every Screener page
function addTab(){
 if(document.getElementById('sbtab'))return;
 let t=document.createElement('button');t.id='sbtab';t.type='button';t.textContent='Batch export';t.title='Screen & Deep Dive: export these companies to a zip';
 t.style.cssText='position:fixed;z-index:2147483646;right:14px;bottom:calc(90px + env(safe-area-inset-bottom));background:#0E6B6B;color:#fff;border:0;border-radius:999px;padding:9px 14px;font:600 13px system-ui,Segoe UI,Arial,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer';
 t.onclick=openPanel;document.body.appendChild(t);
}
addTab();
// Screener swaps page content without a full reload on some pages; keep the tab present
new MutationObserver(()=>{if(!document.getElementById('sbtab'))addTab()}).observe(document.documentElement,{childList:true,subtree:true});
})();
