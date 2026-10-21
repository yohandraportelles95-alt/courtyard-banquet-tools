import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildContractPdf} from '../public/lnr-pdf.js';
const model=JSON.parse(fs.readFileSync(new URL('../public/lnr-template.json',import.meta.url),'utf8'));
const sample={company:'A Company (Texas) \\ Division',contactName:'Example Contact',contactEmail:'contact@example.test',contactTitle:'Travel Manager',rate2027:13500,availability:'NLRA',acceptBy:'2027-01-06'};
test('contract produces a complete two-page PDF with escaped fields, correct rates and no stale year or blackout language',()=>{
 const pdf=buildContractPdf(sample,model),text=Buffer.from(pdf).toString('latin1');
 assert.ok(text.startsWith('%PDF-'));assert.ok(text.endsWith('%%EOF\n'));assert.match(text,/135\.00/);assert.match(text,/01\/01\/27/);assert.match(text,/12\/31\/27/);assert.match(text,/NON-LAST ROOM AVAILABILITY/);assert.match(text,/A Company \\\(Texas\\\) \\\\ Division/);assert.doesNotMatch(text,/2026|Blackout|FIFA|Lashanna|Yadira|renson/);
 const tail=Number(text.match(/startxref\s+(\d+)\s+%%EOF\s*$/)[1]);assert.equal(text.slice(tail,tail+4),'xref');
 for(const m of text.slice(tail).matchAll(/(\d+) 1\n(\d{10}) 00000 n/g))assert.ok(text.slice(Number(m[2])).startsWith(m[1]+' 0 obj'));
});
test('contract requires usable details and handles LRA and additional rate terms',()=>{
 assert.throws(()=>buildContractPdf({...sample,rate2027:null},model),/rate/);
 assert.throws(()=>buildContractPdf({...sample,acceptBy:''},model),/return date/);
 const text=Buffer.from(buildContractPdf({...sample,availability:'LRA',additionalRate:'ONBT - 15% off retail'},model)).toString('latin1');
 assert.match(text,/ONBT - 15% off retail/);assert.doesNotMatch(text,/NON-LAST/);
});
globalThis.Deno={env:{get:k=>({'SUPABASE_URL':'https://database.example','SUPABASE_SERVICE_ROLE_KEY':'test-only'}[k])},serve(){}};
const {handle}=await import('../hosted/index.ts');
test('account routes use the authenticated account dispatcher and preserve gift routes',async()=>{
 const old=globalThis.fetch;let call;
 globalThis.fetch=async(url,opt)=>{call={url,body:JSON.parse(opt.body)};return new Response(JSON.stringify({ok:true}));};
 try{
  for(const [method,path,action] of [['GET','/lnr/accounts','list'],['POST','/lnr/accounts','create'],['GET','/lnr/accounts/11111111-1111-4111-8111-111111111111/history','history'],['POST','/lnr/accounts/11111111-1111-4111-8111-111111111111/generate','generate']]){
   const req=new Request('https://example.test/sales-hub-api'+path,{method,headers:{'x-sales-hub':'1','x-sales-session':'opaque-test','Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{})});
   assert.equal((await handle(req)).status,200);assert.ok(call.url.endsWith('/sales_hub_lnr'));assert.equal(call.body.p_action,action);assert.equal(call.body.p_token,'opaque-test');
  }
  await handle(new Request('https://example.test/sales-hub-api/certificates',{headers:{'x-sales-hub':'1'}}));assert.ok(call.url.endsWith('/sales_hub_dispatch'));
  assert.equal((await handle(new Request('https://example.test/sales-hub-api/lnr/accounts/11111111-1111-4111-8111-111111111111/save',{headers:{'x-sales-hub':'1'}}))).status,404);
 }finally{globalThis.fetch=old;}
});
