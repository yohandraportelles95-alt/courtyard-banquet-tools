import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.Deno={env:{get:key=>({'SUPABASE_URL':'https://database.example','SUPABASE_SERVICE_ROLE_KEY':'server-only-test-key'}[key])},serve(){}};
const {handle}=await import('../hosted/index.ts');
test('hosted handler restricts origins, validates routes and passes opaque sessions to the private dispatcher',async()=>{
 const original=globalThis.fetch;let last;
 globalThis.fetch=async(url,options)=>{last={url,options,body:JSON.parse(options.body)};return new Response(JSON.stringify(last.body.p_token?{ready:false}:{error:'Sign in',_status:401}),{headers:{'Content-Type':'application/json'}});};
 try{
  const base='https://project.supabase.co/functions/v1/sales-hub-api';
  assert.equal((await handle(new Request(base+'/certificates',{headers:{origin:'https://other.example','x-sales-hub':'1'}}))).status,403);
  const preflight=await handle(new Request(base+'/certificates',{method:'OPTIONS',headers:{origin:'https://yohandraportelles95-alt.github.io'}}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://yohandraportelles95-alt.github.io');
  const health=await handle(new Request(base+'/health'));assert.equal(health.status,200);assert.deepEqual(await health.json(),{ok:true,database:'connected'});
  const result=await handle(new Request(base+'/settings',{headers:{'x-sales-hub':'1','x-sales-session':'test-session'}}));assert.equal(result.status,200);assert.equal(last.body.p_token,'test-session');assert.equal(last.body.p_action,'settings');assert.equal(last.options.headers.Authorization,'Bearer server-only-test-key');assert.equal(JSON.stringify(await result.json()).includes('server-only'),false);
  const anonymous=await handle(new Request(base+'/certificates',{headers:{'x-sales-hub':'1'}}));assert.equal(anonymous.status,401);
 }finally{globalThis.fetch=original;}
});
