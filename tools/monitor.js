// Weekly watch: runs the app headless on a set of Screener exports with fresh NSE prices and reports
// what crossed a line since the last run. Usage:
//   node tools/monitor.js <index.html> <watchlist.zip|bundle.json> <state.json in/out> [classes.json] [holdings.csv ...]
// classes.json: {"company name or NSE symbol": "Business type"} for companies the app cannot classify by itself.
// Prints a plain-text report to stdout and writes the new state to the state file.
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{
 const args=process.argv.slice(2),classesIdx=args.findIndex(a=>/classes\.json$/i.test(a)),classesPath=classesIdx>=0?args.splice(classesIdx,1)[0]:null;
 const [html,zipPath,statePath,...holdingFiles]=args;
 let classes={};if(classesPath){try{classes=JSON.parse(fs.readFileSync(classesPath,'utf8'))}catch(e){}}
 if(!html||!zipPath||!statePath){console.error('usage: node tools/monitor.js index.html watchlist.zip state.json [holdings.csv...]');process.exit(2)}
 let prev={};try{prev=JSON.parse(fs.readFileSync(statePath,'utf8'))}catch(e){}
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});
 await p.goto('file://'+path.resolve(html));await p.waitForTimeout(1500);
 const zip=fs.readFileSync(zipPath).toString('base64'),zipName=path.basename(zipPath);
 const holds=holdingFiles.map(f=>({name:path.basename(f),label:path.basename(f).replace(/\.(csv|xlsx)$/i,''),b64:fs.readFileSync(f).toString('base64')}));
 const res=await p.evaluate(async({zip,zipName,holds,classes})=>{
  const toFile=(b64,name)=>{let bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new File([u],name)};
  window.prompt=()=>'';
  await importFiles([toFile(zip,zipName)]);
  for(const m of models){let c=classes[normalizedNameKey(m.company)]||classes[(typeof soSymFor==='function'?soSymFor(m):'')||'-'];if(c)m.manualClass=c}
  for(const h of holds){try{await pfImport(toFile(h.b64,h.name),h.label)}catch(e){}}
  // wait for prices (auto-fetch queue)
  for(let i=0;i<90;i++){await new Promise(r=>setTimeout(r,1000));if(models.every(m=>(m.priceHistory&&m.priceHistory.length)||m._autoTried)&&!soAutoBusy)break}
  let rows=[];
  for(const m of models){
   let r;try{r=batchResult(m)}catch(e){rows.push({company:m.company,error:String(e)});continue}
   let row={company:m.company,sym:(typeof soSymFor==='function'?soSymFor(m):'')||'',price:m.price,status:r.status};
   let ph=m.priceHistory||[];if(ph.length){let lr=ph[ph.length-1];row.livePrice=lr.close;row.priceDate=lr.date instanceof Date?lr.date.toISOString().slice(0,10):String(lr.date)}
   if(r.status==='OK'){
    let so=null;try{so=secondOpinionEngine(m,r)}catch(e){}
    let a=null;try{a=actionPlan(m,r,so,r.tech)}catch(e){}
    let bc=typeof buyCeiling==='function'?buyCeiling(r):{price:NaN};
    let h=null;try{h=holdGet(m)}catch(e){}
    Object.assign(row,{verdict:r.verdict,cagr:r.opp.expectedCagr,fair:r.v.fair,fairHigh:r.v.fairHigh,ceiling:bc.price,light:so&&so.available?so.light:null,lightWeeks:so&&so.available?so.lightWeeks:null,
     trimFrom:a?a.trimFrom:NaN,alarm25:a?a.alarm25:NaN,altPrice:a?a.altPrice:NaN,buyLabel:a?a.nb.label:'',holdLabel:a?a.ho.label:'',
     held:h&&isFinite(h.cost)&&h.cost>0?{qty:h.qty,cost:h.cost,source:h.source}:null});
   }
   rows.push(row);
  }
  return {rows,held:null};
 },{zip,zipName,holds,classes});
 await b.close();
 const P=x=>isFinite(x)?'₹'+Math.round(x).toLocaleString('en-IN'):'—';
 const pct=x=>isFinite(x)?(x*100).toFixed(0)+'%':'—';
 let lines=[],quiet=[],state={};
 for(const r of res.rows){
  state[r.company]=r;
  const o=prev[r.company]||{},px=isFinite(r.livePrice)?r.livePrice:r.price,tag=r.held?`[HELD ${r.held.qty} @ ${P(r.held.cost)}] `:'';
  if(r.error){lines.push(`! ${r.company}: engine error ${r.error}`);continue}
  if(r.status!=='OK'){if(o.status==='OK')lines.push(`! ${r.company}: no longer valued (${r.status})`);continue}
  let ev=[];
  if(o.light&&o.light!==r.light)ev.push(`weekly light ${o.light} → ${r.light}`);
  if(o.verdict&&o.verdict!==r.verdict)ev.push(`verdict ${o.verdict} → ${r.verdict}`);
  if(isFinite(r.ceiling)&&isFinite(o.livePrice)){let was=o.livePrice<=o.ceiling,now=px<=r.ceiling;if(was&&!now)ev.push(`price ${P(px)} rose above the buy ceiling ${P(r.ceiling)}`);if(!was&&now)ev.push(`price ${P(px)} fell back inside the buy ceiling ${P(r.ceiling)}`)}
  if(r.held){
   if(isFinite(r.trimFrom)&&px>=r.trimFrom&&!(isFinite(o.livePrice)&&o.livePrice>=o.trimFrom))ev.push(`entered the trim zone (from ${P(r.trimFrom)})`);
   if(isFinite(r.alarm25)&&px<=r.alarm25&&!(isFinite(o.livePrice)&&o.livePrice<=o.alarm25))ev.push(`fell 25% from its 52-week high (review alarm ${P(r.alarm25)})`);
   if(r.light==='RED'&&o.light&&o.light!=='RED')ev.push('holding turned RED: review');
   if(isFinite(r.held.cost)&&px<r.held.cost*.85&&!(isFinite(o.livePrice)&&o.livePrice<o.held?.cost*.85))ev.push(`now 15%+ below your cost ${P(r.held.cost)}`);
  }
  if(ev.length)lines.push(`• ${tag}${r.company} (${P(px)}, ${r.verdict}, light ${r.light||'—'}): ${ev.join('; ')}`);
  else quiet.push(r.company);
 }
 let stale=res.rows.filter(r=>r.priceDate).map(r=>r.priceDate).sort().slice(-1)[0];
 let report=[`Watch report ${new Date().toISOString().slice(0,10)} · ${res.rows.length} companies · prices to ${stale||'?'}`,''];
 report.push(lines.length?lines.join('\n'):'Nothing crossed a line this week.');
 let held=res.rows.filter(r=>r.held);
 if(held.length){report.push('','Holdings:');for(const r of held){let px=isFinite(r.livePrice)?r.livePrice:r.price;report.push(`  ${r.company}: ${P(px)} vs cost ${P(r.held.cost)} (${pct(px/r.held.cost-1)}), ${r.verdict}, light ${r.light||'—'}, ${r.holdLabel}`)}}
 report.push('',`Quiet: ${quiet.length} companies unchanged.`);
 fs.writeFileSync(statePath,JSON.stringify(state,null,1));
 console.log(report.join('\n'));
})().catch(e=>{console.error('monitor failed:',e);process.exit(1)});
