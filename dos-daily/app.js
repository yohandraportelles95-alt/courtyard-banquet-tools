import {initProfit} from './profit.js?v=profit1';
import {initLnr} from './lnr.js?v=transparent1';
import {readWorkbook,dateCell} from './xlsx.js?v=icons2';
import {API_URL} from './config.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100);
const displayDate=s=>s?new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'Not recorded';
let rows=[],settings=null,selected=null,busy=false,workbook=[],imported=[],requestKey='';
let legacyRows=[];
const sessionKey='carrollton-sales-session';
const setupParams=new URLSearchParams(location.hash.slice(1));
let setupToken=setupParams.get('setup')||sessionStorage.getItem('carrollton-sales-setup')||'';
if(setupParams.has('setup')){sessionStorage.setItem('carrollton-sales-setup',setupToken);history.replaceState(null,'',location.pathname+'#certificates');}
const status=r=>r.state==='redeemed'?'redeemed':r.state==='void'?'void':!r.expires?'review':r.expires<(settings?.today||'')?'expired':'available';
const labels={available:'Available',redeemed:'Redeemed',expired:'Expired',void:'Void',review:'Needs review'};
const badge=r=>`<span class="status ${status(r)}">${labels[status(r)]}</span>`;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;setTimeout(()=>$('#toast').hidden=true,4500);}
async function api(path,method='GET',body){
 const response=await fetch(API_URL+path,{method,headers:{'Content-Type':'application/json','X-Sales-Hub':'1','X-Sales-Session':sessionStorage.getItem(sessionKey)||''},body:body===undefined?undefined:JSON.stringify(body)});
 const type=response.headers.get('content-type')||'';
 if(!type.includes('application/json'))throw Error('The saved tracker is not connected yet. You can explore the page, but records cannot be issued or changed.');
 const data=await response.json();if(!response.ok){if(response.status===401&&path!=='login')sessionStorage.removeItem(sessionKey);const error=Error(data.error||'Could not complete the request.');error.status=response.status;throw error;}return data;
}
const profit=initProfit({api,sessionKey,onSignout:()=>$('#signout').click()});
const lnr=initLnr({api,toast,sessionKey,onSignout:()=>$('#signout').click()});
async function refresh(){
 try{
  [settings,rows,legacyRows]=await Promise.all([api('settings'),api('certificates'),api('legacy')]);
  $('#login').hidden=true;$('#setup-form').hidden=true;$('#signout').hidden=false;$('#connection').classList.toggle('success',settings.ready);
  $('#connection').textContent=settings.ready?'Your saved certificate log is connected. Changes are saved when you confirm them.':'Import the complete existing log to verify numbering and enable new certificates.';
  $('#new-certificate').disabled=!settings.ready;$('#export').disabled=false;$('#import-open').disabled=false;$('#refresh').disabled=false;
  render();
  renderLegacy();
 }catch(error){
  $('#connection').classList.remove('success');$('#connection').textContent=error.message;
  $('#login').hidden=error.status!==401||!!setupToken;$('#setup-form').hidden=error.status!==401||!setupToken;$('#signout').hidden=true;$('#new-certificate').disabled=true;$('#export').disabled=true;$('#import-open').disabled=true;$('#refresh').disabled=true;
 }
}
function route(){const name=location.hash.slice(1)||'home';const target=['home','certificates','calculator','lnr'].includes(name)?name:'home';$$('.view').forEach(el=>el.hidden=el.id!==target);$$('[data-nav]').forEach(el=>{el.classList.toggle('active',el.dataset.nav===target);if(el.dataset.nav===target)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});if(target==='certificates')refresh();if(target==='lnr')lnr.refresh();if(target==='calculator')profit.refresh();}
addEventListener('hashchange',route);route();
$('#login').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const result=await api('login','POST',{password:new FormData(e.target).get('password')});sessionStorage.setItem(sessionKey,result.token);e.target.reset();await refresh();}catch(error){$('#connection').textContent=error.message;}finally{button.disabled=false;}};
$('#setup-form').onsubmit=async e=>{e.preventDefault();const form=e.target,button=e.submitter;button.disabled=true;try{const password=form.elements.password.value;if(password!==form.elements.confirmPassword.value)throw Error('The passwords do not match.');const result=await api('setup','POST',{setupToken,password});sessionStorage.setItem(sessionKey,result.token);sessionStorage.removeItem('carrollton-sales-setup');setupToken='';form.reset();await refresh();toast('Your private tracker is ready to import the log.');}catch(error){$('#connection').textContent=error.message;}finally{button.disabled=false;}};
$('#signout').onclick=async()=>{try{await api('logout','POST',{});}finally{sessionStorage.removeItem(sessionKey);lnr.clear();profit.clear();rows=[];legacyRows=[];selected=null;settings=null;$$('dialog[open]').forEach(d=>d.close());$('#print-area').innerHTML='';render();renderLegacy();await refresh();}};
$('#refresh').onclick=refresh;
function render(){
 const counts={available:0,redeemed:0,expired:0};for(const row of rows)if(status(row) in counts)counts[status(row)]++;
 for(const key in counts)$('#stat-'+key).textContent=counts[key];$('#stat-total').textContent=rows.length;
 const search=$('#search').value.toLowerCase().trim(),filter=$('#status-filter').value;
 const visible=rows.filter(r=>(filter==='all'||status(r)===filter)&&`${r.number} ${r.recipient} ${r.organization}`.toLowerCase().includes(search));
 $('#certificate-rows').innerHTML=visible.map(r=>`<tr><td>${esc(r.number)}</td><td>${esc(r.recipient||r.organization||'Not recorded')}${r.recipient&&r.organization?`<small>${esc(r.organization)}</small>`:''}</td><td>${esc(r.benefit)}</td><td>${displayDate(r.expires)}</td><td>${badge(r)}</td><td><button class="text-button" data-id="${esc(r.id)}">View</button></td></tr>`).join('');
 $('#empty').hidden=visible.length>0;$('#empty h3').textContent=rows.length?'No matching certificates':'Your certificate records go here';$('#empty p').textContent=rows.length?'Try another name, number or status.':'Import the existing log before issuing new certificates.';
 $('#record-count').textContent=`${visible.length} of ${rows.length} certificates`;
 $$('[data-id]').forEach(button=>button.onclick=()=>openDetail(button.dataset.id));
}
$('#search').oninput=render;$('#status-filter').onchange=render;
function renderLegacy(){
 $('#legacy-panel').hidden=!legacyRows.length;
 $('#legacy-rows').innerHTML=legacyRows.map(r=>`<tr><td>${esc(r.organization)}<small>${esc(r.contact||'')}</small><small>${esc(r.notes||'')}</small></td><td>${displayDate(r.givenDate)}</td><td>${esc(r.compNights)}</td><td>${displayDate(r.expires)}</td><td>${r.certificateNumbers?.length?r.certificateNumbers.map(n=>`<button class="text-button" data-number="${esc(n)}">${esc(n)}</button>`).join('<br>'):'Not recorded'}</td><td>${r.state==='redeemed'?`<span class="status redeemed">Redeemed ${displayDate(r.redeemedDate)}</span>`:'Not marked redeemed in Excel'}</td></tr>`).join('');
 $$('[data-number]').forEach(b=>b.onclick=()=>{const found=rows.find(r=>r.number===b.dataset.number);if(found)openDetail(found.id);});
}
$$('[data-close]').forEach(button=>button.onclick=()=>button.closest('dialog').close());
function formData(form){return Object.fromEntries(new FormData(form));}
$('#new-certificate').onclick=()=>{
 requestKey=crypto.randomUUID();
 const form=$('#issue-form');form.reset();form.elements.issuedDate.value=settings.today;const d=new Date(settings.today+'T12:00:00');d.setFullYear(d.getFullYear()+1);form.elements.expires.value=d.toISOString().slice(0,10);form.elements.terms.value=settings.terms;$('#issue-error').textContent='';$('#editor').showModal();
};
function certificate(row,draft=false){return`<article class="certificate">${draft?'<div class="draft-stamp">DRAFT \u00b7 NOT VALID FOR REDEMPTION</div>':''}<div class="cert-brand">COURTYARD</div><div class="cert-property">DALLAS CARROLLTON &amp; CONFERENCE CENTER</div><h3>Gift Certificate</h3><div class="cert-benefit">${esc(row.benefit)}</div><dl><dt>Certificate number</dt><dd><strong>${draft?'Assigned when saved':esc(row.number)}</strong></dd>${row.recipient?`<dt>Recipient</dt><dd>${esc(row.recipient)}</dd>`:''}${row.organization?`<dt>Organization</dt><dd>${esc(row.organization)}</dd>`:''}<dt>Expiration date</dt><dd>${displayDate(row.expires)}</dd><dt>Issued by</dt><dd>${esc(row.issuedBy||'Not recorded')}</dd></dl><div class="cert-terms"><strong>Terms &amp; Conditions</strong>\n${esc(row.terms)}</div><div class="cert-address">1201 Raiford Road, Carrollton, TX 75007 \u00b7 972 446 0001</div></article>`;}
$('#preview-draft').onclick=()=>{if(!$('#issue-form').reportValidity())return;$('#draft-preview').innerHTML=certificate(formData($('#issue-form')),true);$('#preview-dialog').showModal();};
$('#issue-form').onsubmit=async e=>{
 e.preventDefault();if(busy)return;busy=true;e.submitter.disabled=true;
 try{const result=await api('certificates','POST',{...formData(e.target),requestKey});$('#editor').close();await refresh();await openDetail(result.id);toast(`Certificate ${result.number} saved to the log.`);}catch(error){$('#issue-error').textContent=error.message;}finally{busy=false;e.submitter.disabled=false;}
};
async function openDetail(id){
 selected=rows.find(r=>r.id===id);if(!selected)return;
 $('#detail-title').textContent='Certificate '+selected.number;
 $('#detail-content').innerHTML=`${badge(selected)}${certificate(selected)}${selected.notes?`<div class="record-notes"><strong>Internal notes</strong>\n${esc(selected.notes)}</div>`:''}${selected.state==='redeemed'?`<p>Redeemed ${selected.redeemedDate?displayDate(selected.redeemedDate):'(date not recorded)'}${selected.redeemedBy?' \u00b7 '+esc(selected.redeemedBy):''}${selected.confirmation?' \u00b7 Confirmation '+esc(selected.confirmation):''}</p>`:''}<div class="history" id="history">Loading history\u2026</div>`;
 $('#print').disabled=selected.state!=='issued'||!selected.expires;
 $('#redeem-open').hidden=selected.state!=='issued';$('#void-open').hidden=selected.state!=='issued';$('#redeem-form').hidden=true;$('#void-form').hidden=true;
 $('#redeem-error').textContent='';$('#void-error').textContent='';
 if(!$('#detail').open)$('#detail').showModal();
 const detailId=selected.id;
 try{const events=await api(`certificates/${id}/history`);if(selected?.id!==detailId)return;$('#history').innerHTML='<strong>Record history</strong>'+events.map(e=>`<p>${esc(new Date(e.at).toLocaleString())} \u00b7 ${esc(e.action.replaceAll('_',' '))}${e.action==='voided'?': '+esc(JSON.parse(e.details).reason):''}</p>`).join('');}catch{$('#history').textContent='History could not be loaded. Refresh to try again.';}
}
$('#print').onclick=()=>{
 if(!selected || selected.state!=='issued'||!selected.expires)return;
 $('#print-area').innerHTML=certificate(selected);const previous=document.title;document.title=`Gift_Certificate_${selected.number}`;
 window.print();document.title=previous;
};
$('#redeem-open').onclick=()=>{$('#redeem-form').reset();$('#redeem-form').elements.redeemedDate.value=settings.today;$('#redeem-form').hidden=false;$('#void-form').hidden=true;$('#redeem-form').scrollIntoView({behavior:'smooth',block:'end'});};
$('#void-open').onclick=()=>{$('#void-form').reset();$('#void-form').hidden=false;$('#redeem-form').hidden=true;};
for(const action of ['redeem','void'])$('#'+action+'-form').onsubmit=async e=>{
 e.preventDefault();if(busy||!selected)return;busy=true;e.submitter.disabled=true;
 try{const id=selected.id;await api(`certificates/${id}/${action}`,'POST',formData(e.target));await refresh();await openDetail(id);toast(action==='redeem'?'Redemption recorded.':'Certificate voided. Its number will not be reused.');}
 catch(error){$('#'+action+'-error').textContent=error.message;}finally{busy=false;e.submitter.disabled=false;}
};
function csvCell(value){let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return'"'+s.replaceAll('"','""')+'"';}
$('#export').onclick=()=>{
 const fields=['number','recipient','organization','benefit','issuedBy','issuedDate','expires','state','redeemedDate','redeemedBy','confirmation','notes','terms'];
 const csv='\uFEFF'+[fields,...rows.map(r=>fields.map(k=>r[k]))].map(row=>row.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=`Gift_Certificate_Log_${settings.today}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('#export-legacy').onclick=()=>{
 const fields=['organization','contact','givenDate','compNights','expires','state','redeemedDate','notes','certificateNumbers'];
 const csv='\uFEFF'+[fields,...legacyRows.map(r=>fields.map(k=>Array.isArray(r[k])?r[k].join('; '):r[k]))].map(row=>row.map(csvCell).join(',')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='Original_2026_Gift_Log.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
const mapFields=[['number','Certificate number',/certificate.*(number|#|no)|cert.*no|^number$|^cert$|^#$/i],['recipient','Recipient name',/recipient|winner|guest|person|^name$/i],['organization','Organization',/organization|company|donat|event|charity/i],['benefit','Benefit',/benefit|description|offer|item/i],['issuedBy','Issued by',/issued.?by|issuer|authoriz/i],['issuedDate','Issue date',/issue.*date|date.*issue|^date$/i],['expires','Expiration date',/expir|valid.*until/i],['state','Redemption status',/status|redeemed(?!.*date)|used(?!.*date)/i],['redeemedDate','Redemption date',/redeem.*date|date.*redeem|used.*date/i],['notes','Notes',/notes|comments|remarks/i]];
$('#import-open').onclick=()=>{$('#import-error').textContent='';$('#import-dialog').showModal();};
$('#import-file').onchange=async e=>{
 $('#import-error').textContent='';$('#mapping').hidden=true;$('#sheet-choice').hidden=true;
 try{const file=e.target.files[0];if(!file)return;workbook=await readWorkbook(file);if(!workbook.length)throw Error('No worksheets found.');$('#import-sheet').innerHTML=workbook.map((s,i)=>`<option value="${i}">${esc(s.name)}</option>`).join('');$('#sheet-choice').hidden=workbook.length<2;chooseSheet();}catch(error){$('#import-error').textContent=error.message;}
};
function chooseSheet(){
 const sheet=workbook[+$('#import-sheet').value];$('#header-row').innerHTML=sheet.rows.slice(0,25).map((r,i)=>`<option value="${i}">Row ${i+1}: ${esc(r.filter(Boolean).slice(0,4).join(' \u00b7 ').slice(0,120))}</option>`).join('');
 const guess=sheet.rows.slice(0,25).findIndex(r=>r.some(c=>/certificate.*(number|#|no)|^cert.*(number|no)|^number$/i.test(c||'')));$('#header-row').value=String(Math.max(0,guess));mapColumns();
}
$('#import-sheet').onchange=chooseSheet;$('#header-row').onchange=mapColumns;
function mapColumns(){
 const sheet=workbook[+$('#import-sheet').value],header=sheet.rows[+$('#header-row').value]||[];
 const width=Math.min(50,Math.max(header.length,...sheet.rows.slice(0,25).map(r=>r.length)));
 $('#column-map').innerHTML=mapFields.map(([key,label,pattern])=>{
 const guess=header.findIndex(h=>pattern.test(h||''));return`<label>${label}${key==='number'?' *':''}<select data-column="${key}"><option value="">Not in log</option>${Array.from({length:width},(_,i)=>`<option value="${i}"${i===guess?' selected':''}>${String.fromCharCode(65+Math.floor(i/26)-(i<26?0:1))}${i<26?'':String.fromCharCode(65+i%26)} \u00b7 ${esc(header[i]||'Untitled')}</option>`).join('')}</select></label>`;
 }).join('');
 $('#mapping').hidden=false;$$('[data-column]').forEach(s=>s.onchange=previewImport);$('#confirm-complete').checked=false;previewImport();
}
function readState(value,redeemedDate){
 const s=String(value??'').trim().toLowerCase();
 if(['redeemed','yes','y','used','1','true'].includes(s))return'redeemed';
 if(['void','voided','cancelled','canceled'].includes(s))return'void';
 if(['','issued','active','available','no','n','0','false','not redeemed','expired','outstanding','unused'].includes(s))return redeemedDate?'redeemed':'issued';
 throw Error(`Unknown status \u201c${value}\u201d. Check the status column before importing.`);
}
function previewImport(){
 $('#import-error').textContent='';imported=[];$('#import-confirm').disabled=true;
 try{
  const sheet=workbook[+$('#import-sheet').value],header=+$('#header-row').value,map=Object.fromEntries($$('[data-column]').map(s=>[s.dataset.column,s.value]));
  if(map.number==='')throw Error('Select the certificate-number column.');
  const source=sheet.rows.slice(header+1),used=new Set();let skipped=0;
  for(let i=0;i<source.length;i++){
   const row=source[i];if(!row.some(c=>String(c??'').trim())){skipped++;continue;}
   const raw=String(row[+map.number]??'').trim();
   if(!raw)throw Error(`Worksheet row ${header+i+2} has data but no certificate number. Remove summary rows or choose the correct column.`);
   const match=raw.match(/^(\d{4})\s*[-\u2013]\s*(\d{1,6})$/);if(!match||+match[2]<1)throw Error(`Check certificate number \u201c${raw}\u201d on worksheet row ${header+i+2}.`);
   const result={number:`${match[1]}-${String(+match[2]).padStart(2,'0')}`,terms:settings.terms};
   if(used.has(result.number))throw Error(`Duplicate certificate number ${result.number}. Check the log before importing.`);used.add(result.number);
   for(const [key]of mapFields)if(key!=='number'&&key!=='state')result[key]=map[key]===''?'':String(row[+map[key]]??'').trim();
   for(const key of ['issuedDate','expires','redeemedDate'])result[key]=dateCell(result[key],sheet.date1904);
   Object.assign(result,settings.corrections?.[result.number]||{});
   result.state=readState(map.state===''?'':row[+map.state],result.redeemedDate);
   if(!result.benefit)result.benefit='One night complimentary stay';imported.push(result);
  }
  if(!imported.length)throw Error('No certificates found beneath the selected header.');
  const missing=imported.filter(r=>!r.expires).length;
  $('#import-preview').innerHTML='<table><thead><tr><th>Number</th><th>Name / organization</th><th>Expires</th><th>Status</th></tr></thead><tbody>'+imported.slice(0,10).map(r=>`<tr><td>${esc(r.number)}</td><td>${esc(r.recipient||r.organization||'Not recorded')}</td><td>${displayDate(r.expires)}</td><td>${esc(r.state)}</td></tr>`).join('')+'</tbody></table>';
  $('#import-summary').textContent=`${imported.length} certificates found. Preview shows the first ${Math.min(10,imported.length)}.${missing?' '+missing+' missing expiration dates will be marked Needs review.':''}${skipped?' '+skipped+' blank rows ignored.':''}`;
  $('#import-confirm').disabled=!$('#confirm-complete').checked;
 }catch(error){$('#import-error').textContent=error.message;$('#import-preview').innerHTML='';$('#import-summary').textContent='';}
}
$('#confirm-complete').onchange=previewImport;
$('#import-confirm').onclick=async()=>{
 if(busy||!imported.length||!$('#confirm-complete').checked)return;busy=true;$('#import-confirm').disabled=true;
 try{const result=await api('import','POST',{rows:imported,confirmComplete:true});$('#import-dialog').close();await refresh();toast(`${result.added} certificates imported. ${result.skipped} unchanged records skipped.`);}catch(error){$('#import-error').textContent=error.message;}finally{busy=false;$('#import-confirm').disabled=false;}
};
