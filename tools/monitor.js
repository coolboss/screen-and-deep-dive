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
  for(let i=0;i<240;i++){await new Promise(r=>setTimeout(r,1000));if(i>=15&&models.every(m=>(m.priceHistory&&m.priceHistory.length)||m._autoTried)&&!soAutoBusy)break}
  let rows=[];let px0;
  for(const m of models){
   let r;try{r=batchResult(m)}catch(e){rows.push({company:m.company,error:String(e)});continue}
   let row={company:m.company,sym:(typeof soSymFor==='function'?soSymFor(m):'')||'',price:m.price,status:r.status};
   let ph=m.priceHistory||[];if(ph.length){let lr=ph[ph.length-1];row.livePrice=lr.close;row.priceDate=lr.date instanceof Date?lr.date.toISOString().slice(0,10):String(lr.date)}
   if(r.status==='OK'){
    let so=null;try{so=secondOpinionEngine(m,r)}catch(e){}
    let a=null;try{a=actionPlan(m,r,so,r.tech)}catch(e){}
    let bc=typeof buyCeiling==='function'?buyCeiling(r):{price:NaN};
    let h=null;try{h=holdGet(m)}catch(e){}
    // The owner's routine (Book 2): price alarms need weekly closes; the review needs the latest quarter, debt and flags
    let wk=[];try{let last=null;for(const x of ph){let d=x.date instanceof Date?x.date:new Date(x.date);if(!isFinite(d))continue;let key=Math.floor((d.getTime()/86400000+3)/7);if(last&&last.key===key){last.close=x.close;last.date=d}else{last={key,close:x.close,date:d};wk.push(last)}}}catch(e){}
    let w40=wk.length>=40?wk.slice(-40).reduce((t,x)=>t+x.close,0)/40:NaN,wClose=wk.length?wk[wk.length-1].close:NaN;
    let qs=(m.ttm&&m.ttm.qSales)||[],qp=(m.ttm&&m.ttm.qPats)||[];qs=qs.filter(Number.isFinite);qp=qp.filter(Number.isFinite);let nq=Math.min(qs.length,qp.length);qs=qs.slice(-nq);qp=qp.slice(-nq);
    let qSalesYoY=nq>=5&&qs[nq-5]>0?qs[nq-1]/qs[nq-5]-1:NaN,qPatYoY=nq>=5&&qp[nq-5]>0?qp[nq-1]/qp[nq-5]-1:NaN;
    let sg3=NaN,pg3=NaN;try{let S=m.sales,P=m.pat,L=S.length-1;sg3=(S[L]/S[L-3])**(1/3)-1;pg3=(P[L]/P[L-3])**(1/3)-1}catch(e){}
    let debtNow=NaN,debtPrev=NaN;try{let D=m.debt,L=D.length-1;debtNow=D[L];debtPrev=D[L-1]}catch(e){}
    let sc=r.s||null;let flags=((sc&&sc.forensic&&sc.forensic.flags)||[]).filter(f=>f[0]==='bad').map(f=>f[1]);let warns=((sc&&sc.forensic&&sc.forensic.flags)||[]).filter(f=>f[0]==='warn').map(f=>f[1]);
    Object.assign(row,{wClose,w40,hiSinceHeld:NaN,qSalesYoY,qPatYoY,sg3,pg3,debtNow,debtPrev,lender:!!(r.pi&&/bank|nbfc|lend|finance|insur/i.test(r.pi.className||'')),flagsBad:flags,flagsWarn:warns,mos:r.v&&isFinite(r.v.fair)&&isFinite(px0=(isFinite(row.livePrice)?row.livePrice:m.price))?1-px0/r.v.fair:NaN});
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
   // Book 2 alarms: weekly close below the 40-week average, or 20% below the highest close since bought
   let since=o.heldSince||r.priceDate;r.heldSince=since;
   let hi52=o.hi52;r.hi52=Math.max(isFinite(hi52)?hi52:0,isFinite(r.livePrice)?r.livePrice:0)||NaN; // running high since the watch first saw it
   let belowAvg=isFinite(r.wClose)&&isFinite(r.w40)&&r.wClose<r.w40,wasBelow=isFinite(o.wClose)&&isFinite(o.w40)&&o.wClose<o.w40;
   let off20=isFinite(r.hi52)&&px<=r.hi52*.8,wasOff20=isFinite(o.hi52)&&isFinite(o.livePrice)&&o.livePrice<=o.hi52*.8;
   let alarm=(belowAvg&&!wasBelow)||(off20&&!wasOff20);
   if(alarm){ev.push(`PRICE ALARM: ${belowAvg?`weekly close ${P(r.wClose)} is below the 40-week average ${P(r.w40)}`:''}${belowAvg&&off20?'; ':''}${off20?`price is ${pct(1-px/r.hi52)} below its high of ${P(r.hi52)} since the watch began`:''}`);
    // the four-question review, answered from the accounts
    let q1=isFinite(r.qSalesYoY)&&isFinite(r.qPatYoY)?`sales ${r.qSalesYoY>=0?'+':''}${pct(r.qSalesYoY)} and profit ${r.qPatYoY>=0?'+':''}${pct(r.qPatYoY)} in the latest quarter against a 3-year trend of ${pct(r.sg3)} / ${pct(r.pg3)}`:'latest quarter not available';
    let onPlan=isFinite(r.qSalesYoY)&&isFinite(r.sg3)?(r.qSalesYoY>=r.sg3-.05&&(isNaN(r.qPatYoY)||r.qPatYoY>=-.1)):null;
    let q2=r.lender?'a lender: check gross NPA and provisioning in the latest results (the statements cannot show this)':isFinite(r.debtNow)&&isFinite(r.debtPrev)?`debt ${P(r.debtNow)} Cr against ${P(r.debtPrev)} Cr a year earlier (${r.debtNow>r.debtPrev*1.15?'rising':'steady or falling'})`:'debt not available';
    let debtWorse=!r.lender&&isFinite(r.debtNow)&&isFinite(r.debtPrev)&&r.debtNow>r.debtPrev*1.15;
    let q3=r.flagsBad.length?`red flags: ${r.flagsBad.join('; ')}`:r.flagsWarn.length?`no red flag; cautions: ${r.flagsWarn.slice(0,2).join('; ')}`:'no red flags on the statements';
    let q4=isFinite(r.fair)?`${P(px)} is ${pct(Math.abs(r.mos))} ${r.mos>=0?'below':'above'} fair value ${P(r.fair)} (${r.verdict})`:'no fair value';
    let cracks=(onPlan===false?1:0)+(debtWorse?1:0)+(r.flagsBad.length?1:0);
    let decide=cracks===0&&r.mos>0?'HOLD / ADD — thesis intact, price cheaper':cracks===0?'HOLD — thesis intact, but not cheap enough to add':cracks===1?'STOP ADDING — one crack; sell part if it touches the heart of the thesis':'SELL — thesis broken on more than one count';
    ev.push(`   Review 1: ${q1}${onPlan===null?'':onPlan?' — on plan':' — off plan'}`);ev.push(`   Review 2: ${q2}`);ev.push(`   Review 3: ${q3}`);ev.push(`   Review 4: ${q4}`);ev.push(`   → ${decide}`);
   }
   if(isFinite(r.trimFrom)&&px>=r.trimFrom&&!(isFinite(o.livePrice)&&o.livePrice>=o.trimFrom))ev.push(`entered the trim zone (from ${P(r.trimFrom)})`);
   if(isFinite(r.alarm25)&&px<=r.alarm25&&!(isFinite(o.livePrice)&&o.livePrice<=o.alarm25))ev.push(`fell 25% from its 52-week high (review alarm ${P(r.alarm25)})`);
   if(r.light==='RED'&&o.light&&o.light!=='RED')ev.push('holding turned RED: review');
   if(isFinite(r.held.cost)&&px<r.held.cost*.85&&!(isFinite(o.livePrice)&&o.livePrice<o.held?.cost*.85))ev.push(`now 15%+ below your cost ${P(r.held.cost)}`);
  }
  if(ev.length){let main=ev.filter(x=>!/^   /.test(x)),sub=ev.filter(x=>/^   /.test(x));lines.push(`• ${tag}${r.company} (${P(px)}, ${r.verdict}, light ${r.light||'—'}): ${main.join('; ')}`+(sub.length?'\n'+sub.join('\n'):''))}
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
