// Generic calculation engine. Hotel staffing and cost assumptions load after sign-in.
export const round=n=>Math.round((n+Number.EPSILON)*100)/100;
export function holiday(date){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return '';
 const [y,m,d]=date.split('-').map(Number),dt=new Date(Date.UTC(y,m-1,d));
 if(dt.toISOString().slice(0,10)!==date)return '';
 if(m===1&&d===1)return "New Year's Day";
 if(m===7&&d===4)return 'Independence Day';
 if(m===12&&d===25)return 'Christmas Day';
 if(m===5&&dt.getUTCDay()===1&&d+7>31)return 'Memorial Day';
 if(m===9&&dt.getUTCDay()===1&&d<=7)return 'Labor Day';
 if(m===11&&dt.getUTCDay()===4&&d>=22&&d<=28)return 'Thanksgiving Day';
 return '';
}
export function calculate(f,model,overrides={}){
 const n=k=>Number(f[k]||0),g=n('guests'),isHotel=f.category==='hotel',match=holiday(f.date);
 const premium=f.holiday==='yes'||(f.holiday==='auto'&&!!match);
 const labor=model.roles.map(r=>{
  const o=overrides[r.id]||{},enabled=r.condition==='all'||(r.condition==='hotel'&&isHotel)||(r.condition==='seated'&&f.style!=='Reception')||r.condition.toLowerCase()===String(f.style).toLowerCase();
  const recommended=enabled?Math.max(r.minimum,Math.ceil(g/r.ratio)):0;
  const value=(key,def)=>o[key]==null||o[key]===''?def:Number(o[key]);
  const count=value('count',recommended),hours=value('hours',r.hours),rate=value('rate',r.rate),prior=value('prior',0);
  const ot=r.contract?0:Math.min(hours,Math.max(0,prior+hours-n('otThreshold')));
  const mult=premium?n(r.contract?'contractMultiplier':'hotelMultiplier'):1;
  // Planning assumption: use the higher premium on overtime hours; do not compound premiums.
  const cost=round(count*rate*((hours-ot)*mult+ot*Math.max(mult,n('otMultiplier'))));
  return {...r,recommended,count,hours,rate,prior,ot,mult,cost};
 });
 const base=round(g*n('pp')),nonalc=round(g*n('nonalc')),alcohol=round(g*n('alcohol'));
 const other=round(nonalc+alcohol+n('rental')+n('av')),service=round((base+other)*n('service')/100),revenue=round(base+other+service);
 const food=round(isHotel?(f.foodMethod==='actual'?g*n('actualFood'):base*n('foodPct')/100):0);
 const beverage=round(nonalc*n('nonalcPct')/100+alcohol*n('alcoholPct')/100),laborCost=round(labor.reduce((s,r)=>s+r.cost,0)),payout=round(service*n('payout')/100);
 const profit=round(revenue-food-beverage-laborCost-payout),margin=revenue?profit/revenue:0;
 function minimum(target){
  if(!g)return null;
  const s=n('service')/100,p=n('payout')/100,v=isHotel&&f.foodMethod!=='actual'?n('foodPct')/100:0;
  const denom=g*((1-target)*(1+s)-v-s*p);
  if(denom<=0)return null;
  const fixed=laborCost+beverage+(isHotel&&f.foodMethod==='actual'?g*n('actualFood'):0)+s*other*p;
  return Math.ceil(Math.max(0,(fixed-(1-target)*other*(1+s))/denom)*100-1e-7)/100;
 }
 const withoutRevenue=revenue-n('rental')*(1+n('service')/100);
 return {match,premium,labor,revenue,base,nonalc,alcohol,service,food,beverage,laborCost,payout,profit,margin,withoutRental:withoutRevenue?(profit-n('rental')*(1+n('service')/100))/withoutRevenue:null,minimum45:minimum(.45),minimum50:minimum(.5),roomRevenue:round(n('rooms')*n('adr'))};
}
