import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {Readable} from 'node:stream';
async function request(app,path,{method='GET',headers={},body}={}){
 const req=Readable.from(body?[Buffer.from(body)]:[]);req.url=path;req.method=method;req.headers={host:'sales.example',...Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),v]))};
 const responseHeaders={};let status;
 return new Promise((resolve,reject)=>{
  const res={setHeader(k,v){responseHeaders[k.toLowerCase()]=v;},writeHead(code,values){status=code;for(const[k,v]of Object.entries(values||{}))responseHeaders[k.toLowerCase()]=v;},end(content){resolve({status,headers:{get:k=>responseHeaders[k.toLowerCase()]},json:async()=>JSON.parse(content)});}};
  Promise.resolve(app.server.listeners('request')[0](req,res)).catch(reject);
 });
}
test('API fails closed without configuration, requires sign-in and rejects cross-origin mutations',async()=>{
 const disabled=createApp();
 try{assert.equal((await request(disabled,'/api/certificates')).status,503);}finally{disabled.store.close();}
 const app=createApp({password:'test-only-long-password',secure:false});
 try{
  assert.equal((await request(app,'/')).status,200);
  assert.equal((await request(app,'/api/certificates')).status,401);
  const headers={'Content-Type':'application/json','X-Sales-Hub':'1'};
  assert.equal((await request(app,'/api/login',{method:'POST',headers:{...headers,Origin:'https://other.example'},body:'{}'})).status,403);
  assert.equal((await request(app,'/api/login',{method:'POST',headers,body:JSON.stringify({password:'wrong'})})).status,401);
  const login=await request(app,'/api/login',{method:'POST',headers,body:JSON.stringify({password:'test-only-long-password'})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);
  const list=await request(app,'/api/certificates',{headers:{Cookie:cookie}});assert.equal(list.status,200);assert.deepEqual(await list.json(),[]);
  assert.equal((await request(app,'/api/import',{method:'POST',headers:{...headers,Cookie:cookie},body:JSON.stringify({rows:[],confirmComplete:true})})).status,400);
  await request(app,'/api/logout',{method:'POST',headers:{...headers,Cookie:cookie},body:'{}'});
  assert.equal((await request(app,'/api/certificates',{headers:{Cookie:cookie}})).status,401);
 }finally{app.store.close();}
});
