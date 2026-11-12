/* Stay coupon rows are records, including identical rows. Never deduplicate them. */
(function(root){
'use strict';
function csv(text){
 text=text.replace(/^\uFEFF/,'');let rows=[],row=[],v='',q=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(q&&text[i+1]==='"'){v+='"';i++;}else q=!q;}else if(c===','&&!q){row.push(v.trim());v='';}else if((c==='\n'||c==='\r')&&!q){if(c==='\r'&&text[i+1]==='\n')i++;row.push(v.trim());if(row.some(Boolean))rows.push(row);row=[];v='';}else v+=c;}
 if(q)throw Error('The CSV has an unfinished quoted field. Export it again from Stay.');
 row.push(v.trim());if(row.some(Boolean))rows.push(row);if(!rows.length)throw Error('This file is empty.');
 const h=rows.shift().map(x=>x.toUpperCase());for(const key of ['NAME','CODE','DATE','STATUS','RESERVATION','GUEST NAME','LOYALTY TIER'])if(!h.includes(key))throw Error('Missing column: '+key+'. Use the Stay Coupon Activity CSV export.');
 return rows.map((r,i)=>{if(r.length!==h.length)throw Error('CSV row '+(i+2)+' has an unexpected number of columns.');return Object.fromEntries(h.map((k,j)=>[k,r[j]]));});
}
function date(s){let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/),y,mo,d;if(m){[,y,mo,d]=m;mo=+mo-1;}else{m=s.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/);if(!m)throw Error('Unrecognized date: '+s);mo=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(m[1].toLowerCase());d=m[2];y=m[3];}const dt=new Date(Date.UTC(+y,+mo,+d));if(mo<0||dt.getUTCFullYear()!==+y||dt.getUTCMonth()!==+mo||dt.getUTCDate()!==+d)throw Error('Invalid date: '+s);return dt.toISOString().slice(0,10);}
function add(s,n){return new Date(new Date(s+'T00:00:00Z').getTime()+n*86400000).toISOString().slice(0,10);}
function days(a,b){const n=(new Date(b+'T00:00:00Z')-new Date(a+'T00:00:00Z'))/86400000;if(!Number.isInteger(n)||n<0||n>366)throw Error('Choose a date range of at most 367 days.');return Array.from({length:n+1},(_,i)=>add(a,i));}
function load(text, exportDate){const rows=csv(text),groups=new Map(),excluded=new Map();for(const r of rows){if(r.CODE.toUpperCase()!=='1B'||r.NAME.toUpperCase()!=='BKFST 1'){const k=r.NAME+' / '+r.CODE;excluded.set(k,(excluded.get(k)||0)+1);continue;}
 const status=r.STATUS.toLowerCase();if(!['available','future use','consumed'].includes(status))throw Error('Breakfast status needs review: '+r.STATUS+'. No report was generated.');
 if(!r.RESERVATION||!r['GUEST NAME'])throw Error('A breakfast row is missing its reservation or guest name.');
 const parts=r.DATE.split(/\s+-\s+/),start=date(parts[0]),end=parts.length===1?start:date(parts[1]);if(parts.length>2)throw Error('Unrecognized date range: '+r.DATE);days(start,end);
 const key=JSON.stringify([r.RESERVATION,r['GUEST NAME'],r.CODE,start,end,status]);let g=groups.get(key);if(!g){g={id:groups.size,name:r['GUEST NAME'],reservation:r.RESERVATION,tier:r['LOYALTY TIER']||'Not listed',start,end,status,count:0,allocation:{}};groups.set(key,g);}else if(g.tier!==(r['LOYALTY TIER']||'Not listed'))throw Error('Conflicting member status for '+g.name+'. Review the source report.');g.count++;}
 if(!groups.size)throw Error('No BKFST 1 / 1B breakfast coupons were found.');
 const list=[...groups.values()];
 allocate(list,exportDate);
 return {groups:list,excluded:[...excluded],sourceRows:rows.length};
}
function guestKey(g){return JSON.stringify([g.reservation,g.name.toLowerCase()]);}
function allocate(groups,exportDate){
 const occupied=new Map();
 const datesFor=g=>{
  const key=guestKey(g);
  if(!occupied.has(key))occupied.set(key,new Set());
  return occupied.get(key);
 };
 for(const g of groups){
  if(g.start!==g.end)continue;
  g.allocation[g.start]=g.count;
  datesFor(g).add(g.start);
 }
 const ranges=groups.filter(g=>g.start!==g.end&&g.status!=='consumed').sort((a,b)=>a.end.localeCompare(b.end)||a.start.localeCompare(b.start));
 for(const g of ranges){
  // Breakfast starts the morning after the range opens. Past dates in a
  // current export do not use up coupons that Stay still marks as available.
  const occupiedDates=datesFor(g);
  const firstMorning=add(g.start,1);
  const start=exportDate&&exportDate>firstMorning?exportDate:firstMorning;
  if(start>g.end)continue;
  const availableDates=days(start,g.end).filter(d=>!occupiedDates.has(d));
  // Already available coupons are the remaining balance. Place a short
  // balance on the last eligible mornings so it includes checkout.
  const scheduled=availableDates.slice(-g.count);
  for(const d of scheduled){
   g.allocation[d]=1;
   occupiedDates.add(d);
  }
 }
}
function pending(g){return g.count-Object.values(g.allocation).reduce((a,b)=>a+b,0);}
function summarize(model,start,end){
 const spans=new Map();
 for(const g of model.groups){
  const key=guestKey(g);
  const span=spans.get(key)||{stayTotal:0};
  for(const [day,count] of Object.entries(g.allocation)){
   if(!span.first||day<span.first)span.first=day;
   if(!span.last||day>span.last)span.last=day;
   span.stayTotal+=count;
  }
  spans.set(key,span);
 }
 return days(start,end).map(d=>{let guests=new Map();for(const g of model.groups){let n=g.allocation[d]||0;if(!n)continue;const k=guestKey(g);let x=guests.get(k);if(!x){x={name:g.name,reservation:g.reservation,tier:g.tier,total:0,used:0,remaining:0,...spans.get(k)};guests.set(k,x);}x.total+=n;x[g.status==='consumed'?'used':'remaining']+=n;}
 const list=[...guests.values()].sort((a,b)=>a.name.localeCompare(b.name));return {date:d,guests:list,total:list.reduce((a,b)=>a+b.total,0),used:list.reduce((a,b)=>a+b.used,0),remaining:list.reduce((a,b)=>a+b.remaining,0)};});}
const api={csv,date,add,days,load,pending,summarize};if(typeof module!=='undefined')module.exports=api;else root.Bistro=api;
})(typeof window==='undefined'?globalThis:window);
