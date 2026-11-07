// Packs Screener exports (xlsx + notes json, or a zip of them) into one text bundle the monitor can read:
//   node tools/pack.js <index.html> <out bundle.json> <files or zip ...>
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
(async()=>{const [html,out,...inputs]=process.argv.slice(2);
 const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+path.resolve(html));await p.waitForTimeout(800);
 const files=inputs.map(f=>({name:path.basename(f),b64:fs.readFileSync(f).toString('base64')}));
 const bundle=await p.evaluate(async(files)=>{const toFile=(b64,name)=>{let bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new File([u],name)};
  let ex=await expandImportFiles(files.map(f=>toFile(f.b64,f.name))),outF={},notes={};
  for(const f of ex.files){try{outF[f.name.replace(/\.xlsx$/i,'.tsv')]=/\.tsv$/i.test(f.name)?await f.text():await readFile(f)}catch(e){outF['ERROR '+f.name]=String(e)}}
  for(const j of (ex.jsons||[])){try{notes[j.name]=JSON.parse(await j.text())}catch(e){}}
  return {kind:'sdd-bundle',packed:new Date().toISOString(),files:outF,notes}},files);
 await b.close();fs.writeFileSync(out,JSON.stringify(bundle));console.log(Object.keys(bundle.files).length,'companies,',Object.keys(bundle.notes).length,'notes ->',out,Math.round(fs.statSync(out).size/1024)+' KB')})();
