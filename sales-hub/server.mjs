import http from 'node:http';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { openStore, AppError } from './lib/store.mjs';

const root = dirname(fileURLToPath(import.meta.url));
export function createApp({ filename=':memory:', password='', secure=true }={}) {
  const store = openStore(filename), sessions = new Map();
  let failures = { count:0, until:0 };
  const equal = (a,b) => { const aa=Buffer.from(a),bb=Buffer.from(b); return aa.length===bb.length && timingSafeEqual(aa,bb); };
  const send = (res,status,data) => { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); };
  async function body(req) {
    let size=0, chunks=[];
    for await (const chunk of req) { size+=chunk.length; if(size>5_000_000) throw new AppError('Import is too large.',413); chunks.push(chunk); }
    try { const value=JSON.parse(Buffer.concat(chunks).toString() || '{}'); if(!value || typeof value!=='object') throw 0; return value; }
    catch { throw new AppError('Invalid request.'); }
  }
  const server = http.createServer(async(req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: https://yohandraportelles95-alt.github.io; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      const path = new URL(req.url,'http://localhost').pathname;
      if (path.startsWith('/api/')) {
        if (!password || password.length < 16) throw new AppError('The saved tracker is not connected yet. Certificate issuing is unavailable.',503);
        if (!['GET','HEAD'].includes(req.method)) {
          const origin=req.headers.origin;
          // Proxy must preserve Host. Never trust a caller-supplied forwarded host.
          if (origin && new URL(origin).host!==req.headers.host) throw new AppError('Request origin does not match.',403);
          if (req.headers['x-sales-hub']!=='1') throw new AppError('Request verification failed.',403);
          if(!req.headers['content-type']?.startsWith('application/json')) throw new AppError('JSON is required.',415);
        }
        if (path==='/api/login' && req.method==='POST') {
          if (Date.now()<failures.until) throw new AppError('Too many attempts. Try again in a minute.',429);
          const input=await body(req);
          if(typeof input.password!=='string'||!equal(input.password,password)) {
            failures.count++; if(failures.count>=5) {failures={count:0,until:Date.now()+60_000};}
            throw new AppError('Incorrect password.',401);
          }
          failures={count:0,until:0};
          for(const [key,expiry] of sessions) if(expiry<Date.now()) sessions.delete(key);
          const token=randomBytes(32).toString('hex'); sessions.set(token,Date.now()+8*60*60*1000);
          res.setHeader('Set-Cookie',`sales_session=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=28800${secure?'; Secure':''}`);
          return send(res,200,{ok:true,token});
        }
        const token=req.headers['x-sales-session']||req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('sales_session='))?.slice(14);
        if(!token || (sessions.get(token)??0)<Date.now()) throw new AppError('Sign in to open your saved tracker.',401);
        if(path==='/api/logout'&&req.method==='POST') {sessions.delete(token);res.setHeader('Set-Cookie','sales_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0');return send(res,200,{ok:true});}
        if(path==='/api/settings'&&req.method==='GET') return send(res,200,store.settings());
        if(path==='/api/certificates'&&req.method==='GET') return send(res,200,store.list());
        if(path==='/api/legacy'&&req.method==='GET') return send(res,200,[]);
        if(path==='/api/certificates'&&req.method==='POST') return send(res,201,store.issue(await body(req)));
        if(path==='/api/import'&&req.method==='POST') {const input=await body(req);return send(res,200,store.importRows(input.rows,input.confirmComplete));}
        const match=path.match(/^\/api\/certificates\/([a-f0-9-]+)\/(redeem|void|history)$/);
        if(match && match[2]==='history' && req.method==='GET') return send(res,200,store.history(match[1]));
        if(match && ['redeem','void'].includes(match[2]) && req.method==='POST') return send(res,200,store[match[2]](match[1],await body(req)));
        throw new AppError('Page not found.',404);
      }
      if(!['GET','HEAD'].includes(req.method)) throw new AppError('Method not allowed.',405);
      const files={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/style.css':'style.css','/xlsx.js':'xlsx.js','/config.js':'config.js'};
      if(!files[path]) throw new AppError('Page not found.',404);
      const file=files[path], bytes=readFileSync(join(root,'public',file));
      res.writeHead(200,{'Content-Type':{'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'}[extname(file)],'Cache-Control':'no-cache'});
      res.end(req.method==='HEAD'?undefined:bytes);
    } catch(error) { send(res,error.status??500,{error:error instanceof AppError?error.message:'Could not save the change. Please try again.'}); }
  });
  return {server,store};
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  const dataDir=process.env.SALES_HUB_DATA_DIR || join(root,'data'); mkdirSync(dataDir,{recursive:true});
  const host=process.env.HOST || '127.0.0.1', port=Number(process.env.PORT || 4173);
  const {server}=createApp({filename:join(dataDir,'certificates.sqlite'),password:process.env.SALES_HUB_PASSWORD||'',secure:process.env.SALES_HUB_LOCAL!=='1'});
  server.listen(port,host,()=>console.log(`Sales Hub: http://${host}:${port}`));
}
