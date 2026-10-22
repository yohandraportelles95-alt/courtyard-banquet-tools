const ORIGIN = 'https://yohandraportelles95-alt.github.io';
// Authentication uses random opaque sessions checked by the database on EVERY request.
// The platform JWT gateway is disabled only because this function implements its own auth.
export async function handle(req: Request) {
 const origin = req.headers.get('origin');
 const headers: Record<string,string> = {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin === ORIGIN) {headers['Access-Control-Allow-Origin']=ORIGIN;headers['Access-Control-Allow-Headers']='content-type, x-sales-hub, x-sales-session';headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';}
 const reply=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers});
 if(origin && origin!==ORIGIN)return reply({error:'Access denied.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(!['GET','POST'].includes(req.method))return reply({error:'Method not allowed.'},405);
 try {
  const path=new URL(req.url).pathname.split('/sales-hub-api')[1]||'/';
  if(req.headers.get('x-sales-hub')!=='1' && path!=='/health')return reply({error:'Request verification failed.'},403);
  let body:Record<string,unknown>={};
  if(req.method==='POST'){
   if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'JSON is required.'},415);
   if(Number(req.headers.get('content-length')||0)>5_000_000)return reply({error:'Import is too large.'},413);
   const text=await req.text();if(text.length>5_000_000)return reply({error:'Import is too large.'},413);
   body=JSON.parse(text);if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid request.'},400);
  }
  let action='';let lnr=false;let profit=false;
  if(req.method==='GET')action=({'/settings':'settings','/certificates':'list','/legacy':'legacy_list'} as Record<string,string>)[path]||'';
  else action=({'/setup':'setup','/login':'login','/logout':'logout','/import':'import','/certificates':'issue'} as Record<string,string>)[path]||'';
  const match=path.match(/^\/certificates\/([a-f0-9-]{36})\/(redeem|void|history)$/);
  if(match && ((match[2]==='history'&&req.method==='GET')||(match[2]!=='history'&&req.method==='POST'))){action=match[2];body={...body,id:match[1]};}
  if(path==='/lnr/accounts'&&['GET','POST'].includes(req.method)){lnr=true;action=req.method==='GET'?'list':'create';}
  const accountMatch=path.match(/^\/lnr\/accounts\/([a-f0-9-]{36})\/(history|save|generate)$/);
  if(accountMatch&&((accountMatch[2]==='history'&&req.method==='GET')||(accountMatch[2]!=='history'&&req.method==='POST'))){lnr=true;action=accountMatch[2];body={...body,id:accountMatch[1]};}
  if(path==='/profit/config'&&req.method==='GET'){profit=true;action='config';}
  if(path==='/health'&&req.method==='GET')action='settings';
  if(!action)return reply({error:'Page not found.'},404);
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const url=Deno.env.get('SUPABASE_URL');
  if(!key||!url)return reply({error:'Database connection is unavailable.'},503);
  const response=await fetch(url+'/rest/v1/rpc/'+(profit?'sales_hub_profit':lnr?'sales_hub_lnr':'sales_hub_dispatch'),{method:'POST',headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+key},body:JSON.stringify({p_action:action,p_body:body,p_token:req.headers.get('x-sales-session')||''})});
  if(!response.ok)return reply({error:'The saved tracker could not complete the request.'},503);
  const result=await response.json();
  if(path==='/health')return reply({ok:result?._status===401,database:result?._status===401?'connected':'unavailable'},result?._status===401?200:503);
  if(result && !Array.isArray(result) && result._status){const status=result._status;delete result._status;return reply(result,status);}
  return reply(result,action==='issue'?201:200);
 } catch {return reply({error:'Could not complete the request. Please try again.'},400);}
}
Deno.serve(handle);
