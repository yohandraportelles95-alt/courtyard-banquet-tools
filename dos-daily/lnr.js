import {downloadAccountSheet} from './lnr-account-sheet.js?v=sheet3';
import {buildContractPdf,downloadContract} from './lnr-pdf.js?v=transparent1';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>v==null?'\u2014':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v/100);
const labels={not_started:'Not started',draft:'Draft',sent:'Sent',signed:'Signed',rejected:'Rejected',not_needed:'Not needed for 2027',not_renewing:'Not renewing'};
const kinds={local:'Locally negotiated',central:'Global / GPP / MarRFP',review:'Confirm account type'};
const sourceKinds={spreadsheet:'Spreadsheet',contract:'Contract file',signed_contract:'Signed contract',accepted_rfp:'Accepted RFP',rate_loading:'Rate-loading form'};
export function initLnr({api,toast,sessionKey,onSignout}){
 let accounts=[],selected=null,history=null,model=null,busy=false;
 const form=$('#lnr-form');
 async function template(){if(!model){const r=await fetch('lnr-template.json?v=lnr1');if(!r.ok)throw Error('The contract template could not load. Please refresh.');model=await r.json();}return model;}
 function render(){
  const q=$('#lnr-search').value.trim().toLowerCase(),type=$('#lnr-type').value,state=$('#lnr-status').value,availability=$('#lnr-availability').value;
  const shown=accounts.filter(a=>(type==='all'||a.management===type)&&(state==='all'||a.status===state)&&(availability==='all'||a.availability===availability)&&[a.company,...(a.formerNames||[]),a.contactName,a.contactEmail,a.rateCode,a.clusterCode].join(' ').toLowerCase().includes(q));
  $('#lnr-rows').innerHTML=shown.map(a=>`<tr><td><button class="text-button account-name" data-account="${esc(a.id)}">${esc(a.company)}</button><small>${esc(a.contactName||'')}</small>${a.formerNames?.length?`<small>Formerly: ${esc(a.formerNames.join(', '))}</small>`:''}${a.clusterCode?`<small>Cluster: ${esc(a.clusterCode==='?'?'Needs confirmation':a.clusterCode)}</small>`:''}${a.management!=='local'?`<small>${esc(kinds[a.management])}</small>`:''}${a.reviewNotes?.length?'<small class="review-label">Review source differences</small>':''}</td><td><span class="status" title="${a.availability==='LRA'?'Last room availability':'Non-last room availability'}">${esc(a.availability||'Not set')}</span></td><td>${money(a.rate2025)}<small>${esc(a.rateSource2025||'')}</small></td><td>${money(a.rate2026)}<small>${esc(a.rateSource2026||'')}</small></td><td>${money(a.proposed2027)}</td><td><strong>${money(a.rate2027)}</strong></td><td><span class="status ${esc(a.status)}">${esc(labels[a.status]||'Not started')}</span>${a.contract2027?'<small>Existing agreement through 2027</small>':''}</td><td><button class="text-button" data-account="${esc(a.id)}">Open</button></td></tr>`).join('');
  $('#lnr-empty').hidden=shown.length>0;$('#lnr-count').textContent=`${shown.length} of ${accounts.length} accounts`;
  const local=accounts.filter(a=>a.management==='local');$('#lnr-total').textContent=local.length;for(const s of ['sent','signed'])$('#lnr-'+s+'-count').textContent=local.filter(a=>a.status===s).length;$('#lnr-open-count').textContent=local.filter(a=>['not_started','draft'].includes(a.status)).length;
  document.querySelectorAll('[data-account]').forEach(b=>b.onclick=()=>open(b.dataset.account));
 }
 function clear(){accounts=[];selected=null;history=null;$('#lnr-detail').close();$('#lnr-rows').innerHTML='';$('#lnr-source-history').innerHTML='';$('#lnr-activity').innerHTML='';$('#lnr-versions').innerHTML='';form.reset();render();}
 async function refresh(){
  $('#lnr-message').textContent='Opening your saved accounts...';
  try{accounts=await api('lnr/accounts');$('#lnr-login').hidden=true;$('#lnr-signout').hidden=false;$('#lnr-workspace').hidden=false;$('#lnr-message').textContent='2027 renewals. Changes are saved when you confirm them.';render();}
  catch(e){clear();$('#lnr-workspace').hidden=true;$('#lnr-login').hidden=e.status!==401;$('#lnr-signout').hidden=true;$('#lnr-message').textContent=e.message;}
 }
 function updateStateFields(){const status=form.elements.status.value;$('#lnr-sent-date').hidden=!['sent','signed'].includes(status);$('#lnr-signed-date').hidden=status!=='signed';form.elements.sentDate.required=status==='sent';form.elements.signedDate.required=status==='signed';$('#lnr-generate').hidden=form.elements.management.value!=='local';$('#lnr-central-note').hidden=form.elements.management.value==='local';}
 async function open(id){
  selected=accounts.find(a=>a.id===id);if(!selected)return;history=null;form.reset();$('#lnr-detail-title').textContent=selected.company;
  for(const el of form.elements){if(!el.name)continue;let value=selected[el.name]??'';if(['rate2027','proposed2027'].includes(el.name))value=value===''?'':(value/100).toFixed(2);el.value=value;}
  form.elements.breakfast.value=selected.breakfast||(/breakfast included/i.test(selected.additionalRate||'')?'included':'not_included');form.elements.billing.value=selected.billing||'individual';
  form.elements.contractCompany.value=selected.contractCompany||selected.company;form.elements.availability.value=selected.availability||'NLRA';form.elements.roomType.value=selected.roomType||'GENR/QNQN';form.elements.acceptBy.value=selected.acceptBy||'2027-01-06';form.elements.status.value=selected.status||'not_started';
  $('#lnr-review').textContent=(selected.reviewNotes||[]).join(' ');$('#lnr-review').hidden=!selected.reviewNotes?.length;
  $('#lnr-contact-source').textContent=selected.contactSource?'Contact source: '+selected.contactSource:'Contact from the account spreadsheet.';
  $('#lnr-source-history').innerHTML=(selected.history||[]).length?`<div class="table-scroll"><table><thead><tr><th>Year</th><th>Rate</th><th>Record</th><th>Contact</th><th>Source</th></tr></thead><tbody>${[...(selected.history||[])].sort((a,b)=>b.year-a.year).map(h=>`<tr><td>${h.year}${h.through2027?'\u20132027':''}</td><td>${h.rate!=null?money(Math.round(h.rate*100)):esc(h.rateText||'\u2014')}</td><td>${esc(sourceKinds[h.kind]||h.kind)}</td><td>${esc(h.contactName||'')}<small>${esc(h.contactEmail||'')}</small></td><td class="source-cell">${esc(h.source)}</td></tr>`).join('')}</tbody></table></div>`:'<p>No historical rate is recorded.</p>';
  $('#lnr-error').textContent='';$('#lnr-activity').textContent='Loading activity...';$('#lnr-versions').textContent='';updateStateFields();$('#lnr-detail').showModal();
  try{const h=await api(`lnr/accounts/${id}/history`);if(selected?.id!==id)return;history=h;renderHistory();}catch(e){$('#lnr-activity').textContent=e.message;}
 }
 function renderHistory(){
  $('#lnr-activity').innerHTML=history?.events?.length?'<ul class="activity-list">'+history.events.map(e=>`<li>${esc(new Date(e.at).toLocaleString())}: ${esc(({account_updated:'Account updated',contract_generated:'Contract generated',account_created:'Account added'})[e.action]||e.action)}${e.details.status?' \u00b7 '+esc(labels[e.details.status]||e.details.status):''}</li>`).join('')+'</ul>':'<p>No changes recorded yet.</p>';
  $('#lnr-versions').innerHTML=history?.versions?.length?history.versions.map(v=>`<div class="saved-version"><span>${esc(new Date(v.at).toLocaleString())}<small>${money(v.details.rate2027)} \u00b7 ${esc(v.details.contactName)}</small></span><button class="secondary" data-version="${esc(v.id)}">Download PDF</button></div>`).join(''):'<p>No generated contracts yet.</p>';
  document.querySelectorAll('[data-version]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{downloadContract(history.versions.find(v=>v.id===b.dataset.version).details,await template());}catch(e){$('#lnr-error').textContent=e.message;}finally{b.disabled=false;}});
 }
 function payload(){const body=Object.fromEntries(new FormData(form));body.company=body.company.trim();if(body.company!==selected.company&&(!body.contractCompany||body.contractCompany===selected.company))body.contractCompany=body.company;for(const key of ['rate2027','proposed2027'])body[key]=body[key]===''?null:Math.round(Number(body[key])*100);return {...body,id:selected.id,revision:selected.revision};}
 async function save(generate=false,accountSheet=false){
  if(busy||!form.reportValidity())return;const body=payload();$('#lnr-error').textContent='';busy=true;$('#lnr-save').disabled=true;$('#lnr-generate').disabled=true;$('#lnr-account-sheet').disabled=true;
  try{
   let m;if(generate){if(!body.rate2027||!body.contactName)throw Error('Enter the 2027 rate and contact name.');m=await template();buildContractPdf({...selected,...body},m);}
   const result=await api(`lnr/accounts/${selected.id}/${generate?'generate':'save'}`,'POST',body);selected=result;accounts=accounts.map(a=>a.id===result.id?result:a);render();
   if(accountSheet)downloadAccountSheet(result);if(generate)downloadContract(result,m);$('#lnr-detail').close();toast(accountSheet?'Account saved and file sheet downloaded.':generate?'Contract downloaded and saved as a version.':'Account saved.');
  }catch(e){$('#lnr-error').textContent=e.message;}finally{busy=false;$('#lnr-save').disabled=false;$('#lnr-generate').disabled=false;$('#lnr-account-sheet').disabled=false;}
 }
 $('#lnr-login').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const result=await api('login','POST',{password:new FormData(e.target).get('password')});sessionStorage.setItem(sessionKey,result.token);e.target.reset();await refresh();}catch(e){$('#lnr-message').textContent=e.message;}finally{b.disabled=false;}};
 $('#lnr-signout').onclick=onSignout;$('#lnr-refresh').onclick=refresh;for(const s of ['#lnr-search','#lnr-type','#lnr-status','#lnr-availability'])$(s).addEventListener(s==='#lnr-search'?'input':'change',render);
 form.onsubmit=e=>{e.preventDefault();save(false);};$('#lnr-generate').onclick=()=>save(true);$('#lnr-account-sheet').onclick=()=>save(false,true);form.elements.status.onchange=updateStateFields;form.elements.management.onchange=updateStateFields;
 $('#lnr-new').onclick=()=>{$('#lnr-new-form').reset();$('#lnr-new-error').textContent='';$('#lnr-new-dialog').showModal();};
 $('#lnr-new-form').onsubmit=async e=>{e.preventDefault();e.submitter.disabled=true;try{const a=await api('lnr/accounts','POST',{company:new FormData(e.target).get('company')});accounts.push(a);render();$('#lnr-new-dialog').close();await open(a.id);}catch(e){$('#lnr-new-error').textContent=e.message;}finally{e.submitter.disabled=false;}};
 $('#lnr-export').onclick=()=>{const keys=['company','management','availability','contactName','contactEmail','contactPhone','clusterCode','breakfast','billing','rate2025','rate2026','proposed2027','rate2027','status','sentDate','signedDate','notes'];const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';const rows=[keys,...accounts.map(a=>keys.map(k=>['rate2025','rate2026','proposed2027','rate2027'].includes(k)?a[k]==null?'':(a[k]/100).toFixed(2):a[k]))];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='2027-negotiated-accounts.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
 return {refresh,clear};
}
