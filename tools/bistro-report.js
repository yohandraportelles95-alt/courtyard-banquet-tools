'use strict';
const $=id=>document.getElementById(id);
const nice=d=>new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(d+'T12:00:00Z'));
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let model=null;
let importVersion=0;

function status(message,error=false){
 $('status').textContent=message;
 $('status').className=error?'warn':'';
}
function reportDates(){
 if(!model)throw Error('Choose a Stay Coupon Activity CSV first.');
 return Bistro.summarize(model,$('start').value,$('end').value);
}
function exceptions(){
 return model.groups.filter(g=>Bistro.pending(g)>0&&g.start<=$('end').value&&g.end>=$('start').value)
  .reduce((total,g)=>total+Bistro.pending(g),0);
}
function table(headers,rows){
 return '<div class="table-wrap"><table><thead><tr>'+headers.map(h=>`<th scope="col">${escapeHtml(h)}</th>`).join('')+
  '</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(cell=>`<td>${cell}</td>`).join('')+'</tr>').join('')+'</tbody></table></div>';
}
function render(){
 const days=reportDates();
 const extra=exceptions();
 const summary=table(['Breakfast date','Total coupons','Used','Remaining'],days.map(d=>[nice(d.date),`<b>${d.total}</b>`,d.used,d.remaining]));
 const daily=days.map(d=>{
  const guests=d.guests.map(g=>[`${escapeHtml(g.name)}<br><small>${escapeHtml(g.reservation)} · ${g.stayTotal} stay coupons</small>`,escapeHtml(g.tier),
   `${nice(g.first)}${g.last===g.first?'':' – '+nice(g.last)}`,`<b>${g.total}</b>`,g.used,g.remaining]);
  return `<section class="day"><div class="day-title"><h2>${nice(d.date)}</h2><strong>${d.total} coupons</strong></div>`+
   (guests.length?table(['Guest / reservation','Member status','First – last breakfast','Total','Used','Remaining'],guests):'<p>No breakfast coupons for this date.</p>')+'</section>';
 });
 $('report').innerHTML='<p class="eyebrow">Courtyard Dallas Carrollton &amp; Conference Center</p><h2>Daily breakfast totals</h2>'+summary+
  '<p class="report-note"><small>One coupon per morning from the day after check-in through checkout. A short unused balance fills the latest eligible mornings first.</small></p>'+
  (extra?`<p class="report-note"><small>${extra} extra or undated coupon records fall outside the one-per-morning schedule for these reservations.</small></p>`:'')+
  daily.join('');
 $('report').hidden=false;
}
function renderSelection(){
 try{render();status('');}
 catch(error){$('report').hidden=true;status(error.message,true);}
}
function hotelToday(){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
 const fields=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return `${fields.year}-${fields.month}-${fields.day}`;
}
$('file').addEventListener('change',async event=>{
 const version=++importVersion;
 const file=event.target.files[0];
 model=null;
 $('report').hidden=true;
 $('controls').hidden=true;
 status('');
 if(!file)return;
 try{
  if(!/\.csv$/i.test(file.name))throw Error('Use the CSV export of Stay Coupon Activity.');
  if(file.size>10*1024*1024)throw Error('Choose a CSV smaller than 10 MB.');
  const content=await file.text();
  if(version!==importVersion)return;
  const exportDate=file.name.match(/\d{4}-\d{2}-\d{2}(?=_\d{2}-\d{2})/)?.[0]||hotelToday();
  model=Bistro.load(content,exportDate);
  const allDates=model.groups.flatMap(g=>Object.keys(g.allocation)).sort();
  const upcoming=allDates.filter(d=>d>=exportDate);
  $('start').value=upcoming.length?exportDate:(allDates[0]||exportDate);
  $('end').value=upcoming.at(-1)||allDates.at(-1)||exportDate;
  render();
  $('controls').hidden=false;
 }catch(error){
  if(version===importVersion){model=null;status(error.message,true);}
 }
});
for(const id of ['start','end'])$(id).addEventListener('change',renderSelection);
$('download').addEventListener('click',()=>{
 try{
  const days=reportDates();
  const bytes=BistroPdf.build(days,exceptions(),nice);
  const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
  const link=document.createElement('a');
  link.href=url;
  link.download=`Bistro_Breakfast_${days[0].date}_to_${days.at(-1).date}.pdf`;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
  status('');
 }catch(error){status(error.message,true);}
});
$('print').addEventListener('click',()=>{
 try{render();window.print();}
 catch(error){status(error.message,true);}
});
