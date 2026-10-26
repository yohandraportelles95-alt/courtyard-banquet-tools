// Internal account-file cover sheet. Separate from the Sertifi contract.
const clean=v=>String(v??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\u00a0/g,' ').replace(/[^\x20-\x7e\xa0-\xff\n]/g,'?');
const lit=v=>'('+clean(v).replace(/([\\()])/g,'\\$1').replace(/\n/g,' ')+')';
const money=v=>v==null||v===''?'Not recorded':'$'+(Number(v)/100).toFixed(2);
const statusLabels={not_started:'Not started',draft:'Draft',sent:'Sent',signed:'Signed',rejected:'Rejected',not_needed:'Not needed for 2027',not_renewing:'Not renewing'};
export function buildAccountSheet(data){
 const pages=[];let ops=[],y=744;
 function text(s,x=48,size=10,bold=false){ops.push('BT /'+(bold?'B':'F')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm '+lit(s)+' Tj ET');}
 function footer(){ops.push('BT /F 8 Tf 1 0 0 1 48 28 Tm (INTERNAL ACCOUNT FILE - Courtyard Dallas Carrollton & Conference Center) Tj ET');pages.push(ops.join('\n'));ops=[];y=744;}
 function space(n){}
 function line(s,size=10,bold=false){
  // Helvetica's widest printable character is narrower than 1 em.
  const max=Math.floor(510/(size*.61)),words=clean(s).split(/\s+/);let row='';
  for(let word of words){while(word.length>max){if(row){space(15);text(row,48,size,bold);y-=15;row='';}space(15);text(word.slice(0,max),48,size,bold);y-=15;word=word.slice(max);}
   if((row+' '+word).length>max){space(15);text(row,48,size,bold);y-=15;row=word;}else row=row?row+' '+word:word;}
  space(15);text(row,48,size,bold);y-=15;
 }
 function section(s){space(45);y-=10;line(s,11,true);ops.push('0.6 G 48 '+(y+7)+' m 564 '+(y+7)+' l S 0 G');y-=5;}
 function field(label,value){const v=clean(value||'Not recorded');line(label+': '+(v.length>150?v.slice(0,130)+'... (see tool)':v));}
 line('NEGOTIATED ACCOUNT RECORD',16,true);
 line(data.contractCompany||data.company||'Account',13,true);
 line('Account reference | Annual updates',9);
 section('COMPANY & CURRENT CONTACT');
 if(data.contractCompany&&data.contractCompany!==data.company)field('Account name',data.company);
 field('Contact',data.contactName);if(data.contactTitle)field('Title',data.contactTitle);
 field('Phone',data.contactPhone);field('Email',data.contactEmail);
 field('Address',[data.street,data.cityState,data.country].filter(Boolean).join(', '));
 line('Rate code: '+(data.rateCode||'Not recorded')+'     |     Cluster code: '+(data.clusterCode==='?'?'Needs confirmation':data.clusterCode||'Not recorded'));
 field('Account type',({local:'Locally negotiated',central:'Global / GPP / MarRFP',review:'Confirm account type'})[data.management]);
 section('ANNUAL RATE & RENEWAL LOG');
 const earlier=[...new Set((data.history||[]).map(h=>Number(h.year)).filter(n=>Number.isInteger(n)&&n>=2000&&n<2025))].sort((a,b)=>b-a).slice(0,2);
 const years=[...earlier,2025,2026,2027,2028,2029,2030,2031,2032].sort((a,b)=>a-b);
 const widths=[40,64,77,43,43,43,206],xs=[48];for(const w of widths)xs.push(xs.at(-1)+w);
 function tableRow(values,header=false){
  const h=header?24:18;space(h+5);const top=y+9,bottom=top-h;
  if(header)ops.push('0.94 g 48 '+bottom+' 516 '+h+' re f 0 g');
  ops.push('0.6 G 0.45 w');for(const x of xs)ops.push(x+' '+bottom+' m '+x+' '+top+' l S');
  for(const yy of [bottom,top])ops.push('48 '+yy+' m 564 '+yy+' l S');ops.push('0 G');
  const original=y;
  values.forEach((v,i)=>{const parts=String(v??'').split('\n');parts.forEach((p,j)=>{y=original-j*9;text(p,xs[i]+4,header?7.5:9,header);});});
  y=bottom-9;
 }
 const headings=['Year','Nightly rate','Signed date','Rate\nloaded','CC auth','Link\nsent','Notes / changes'];
 tableRow(headings,true);
 for(const year of years){
  const records=(data.history||[]).filter(h=>Number(h.year)===year);
  const knownRates=[...new Set(records.filter(h=>h.rate!=null).map(h=>Math.round(Number(h.rate)*100)))];
  let amount=data['rate'+year],note='';
  if(year===2027)note=data.status==='signed'?'Signed status recorded':'Offered rate; '+(statusLabels[data.status]||'Not started');
  if(amount==null&&knownRates.length===1)amount=knownRates[0];
  if(amount==null&&knownRates.length>1)note='Conflicting source rates - review';
  const rateTexts=[...new Set(records.map(h=>h.rateText).filter(Boolean))];if(rateTexts.length)note+=(note?'; ':'')+rateTexts.join('; ');
  // Details continue below when too long for handwriting space.
  if(note.length>35)note=note.slice(0,32)+'...';
  
  tableRow([String(year),amount==null?'':money(amount),year===2027?data.signedDate||'':'','','','',note]);
 }
 tableRow(['','','','','','','']);
 line('Mark annual steps after verification. N/A = not applicable. Full account history is in the tool.',8);
 section('BILLING & RESERVATIONS');
 field('Billing',({individual:'Individual traveler pays',company_room_tax:'Company credit card - Room & Tax',company_all:'Company credit card - All charges'})[data.billing||'individual']);
 field('Breakfast',((data.breakfast||(/breakfast included/i.test(data.additionalRate||'')?'included':'not_included'))==='included')?'Included in room rate':'Not included');
 field('Availability',data.availability||'Not recorded');if(data.additionalRate)field('Additional rate terms',data.additionalRate);
 line('Reservations:  Booking link ______   Email direct ______   Other ______');
 section('CONTACT / TERMS CHANGES');
 for(let i=0;i<2;i++){space(22);ops.push('0.7 G 48 '+(y-8)+' m 564 '+(y-8)+' l S 0 G');y-=22;}
 if(data.notes){section('INTERNAL NOTES');const note=clean(data.notes).replace(/\s+/g,' ');line(note.length>230?note.slice(0,210)+'... (more in tool)':note,9);}
 // Fit unusually long contact records on one page without adding a second sheet.
 if(y<58){const scale=686/(744-y);ops=['q 1 0 0 '+scale.toFixed(5)+' 0 '+(744*(1-scale)).toFixed(3)+' cm',...ops,'Q'];}
 footer();
 const objects=['','<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 const kids=[];for(const content of pages){const id=objects.length;objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F 3 0 R /B 4 0 R >> >> /Contents '+(id+1)+' 0 R >>');objects.push('<< /Length '+content.length+' >>\nstream\n'+content+'\nendstream');kids.push(id+' 0 R');}
 objects[2]='<< /Type /Pages /Count '+pages.length+' /Kids ['+kids.join(' ')+'] >>';
 let pdf='%PDF-1.4\n',offsets=[0];for(let i=1;i<objects.length;i++){offsets[i]=pdf.length;pdf+=i+' 0 obj\n'+objects[i]+'\nendobj\n';}
 const start=pdf.length;pdf+='xref\n0 '+objects.length+'\n0000000000 65535 f \n';for(const n of offsets.slice(1))pdf+=String(n).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+objects.length+' /Root 1 0 R >>\nstartxref\n'+start+'\n%%EOF\n';return Uint8Array.from(pdf,c=>c.charCodeAt(0));
}
export function downloadAccountSheet(data){
 const url=URL.createObjectURL(new Blob([buildAccountSheet(data)],{type:'application/pdf'}));
 const a=document.createElement('a');a.href=url;a.download=((data.company||'Account')+' - Account File Sheet').replace(/[^a-zA-Z0-9 ._-]/g,'')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
