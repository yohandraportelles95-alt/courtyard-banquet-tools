// Internal account-file cover sheet. Separate from the Sertifi contract.
const clean=v=>String(v??'').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2013\u2014]/g,'-').replace(/\u00a0/g,' ').replace(/[^\x20-\x7e\xa0-\xff\n]/g,'?');
const lit=v=>'('+clean(v).replace(/([\\()])/g,'\\$1').replace(/\n/g,' ')+')';
const money=v=>v==null||v===''?'Not recorded':'$'+(Number(v)/100).toFixed(2);
const statusLabels={not_started:'Not started',draft:'Draft',sent:'Sent',signed:'Signed',rejected:'Rejected',not_needed:'Not needed for 2027',not_renewing:'Not renewing'};
export function buildAccountSheet(data){
 const pages=[];let ops=[],y=744;
 function text(s,x=48,size=10,bold=false){ops.push('BT /'+(bold?'B':'F')+' '+size+' Tf 1 0 0 1 '+x+' '+y+' Tm '+lit(s)+' Tj ET');}
 function footer(){ops.push('BT /F 8 Tf 1 0 0 1 48 28 Tm (INTERNAL ACCOUNT FILE - Courtyard Dallas Carrollton & Conference Center) Tj ET');pages.push(ops.join('\n'));ops=[];y=744;}
 function space(n){if(y-n<55)footer();}
 function line(s,size=10,bold=false){
  // Helvetica's widest printable character is narrower than 1 em.
  const max=Math.floor(510/(size*.61)),words=clean(s).split(/\s+/);let row='';
  for(let word of words){while(word.length>max){if(row){space(15);text(row,48,size,bold);y-=15;row='';}space(15);text(word.slice(0,max),48,size,bold);y-=15;word=word.slice(max);}
   if((row+' '+word).length>max){space(15);text(row,48,size,bold);y-=15;row=word;}else row=row?row+' '+word:word;}
  space(15);text(row,48,size,bold);y-=15;
 }
 function section(s){space(45);y-=10;line(s,11,true);ops.push('0.6 G 48 '+(y+7)+' m 564 '+(y+7)+' l S 0 G');y-=5;}
 function field(label,value){line(label+': '+(value||'Not recorded'));}
 line('LOCAL NEGOTIATED RATE CHECKLIST',16,true);
 line(data.contractCompany||data.company||'Account',13,true);
 line('Account file cover sheet | 2027 renewal',9);
 section('COMPANY & CURRENT CONTACT');
 if(data.contractCompany&&data.contractCompany!==data.company)field('Account name',data.company);
 field('Contact',data.contactName);if(data.contactTitle)field('Title',data.contactTitle);
 field('Phone',data.contactPhone);field('Email',data.contactEmail);
 field('Address',[data.street,data.cityState,data.country].filter(Boolean).join(', '));
 field('Rate code',data.rateCode);field('Cluster code',data.clusterCode==='?'?'Needs confirmation':data.clusterCode);
 field('Account type',({local:'Locally negotiated',central:'Global / GPP / MarRFP',review:'Confirm account type'})[data.management]);
 section('RATES & RENEWAL');
 field('2027 status',statusLabels[data.status]||'Not started');
 if(data.sentDate)field('Sent date',data.sentDate);if(data.signedDate)field('Signed date recorded',data.signedDate);
 const rows=[
  ['2025',data.rate2025,data.rateSource2025],
  ['2026',data.rate2026,data.rateSource2026],
  ['2027 offered',data.rate2027,'Current account record']
 ];
 for(const [year,rate,source] of rows){line(year+'  |  '+money(rate)+(source?'  |  '+source:''));}
 const extra=(data.history||[]).filter(h=>h.year&&h.rate!=null&&!([2025,2026].includes(Number(h.year))&&Math.round(Number(h.rate)*100)===data['rate'+h.year]));
 if(extra.length){line('Other historical records (may differ from the summary above):',9,true);
 for(const h of [...extra].sort((a,b)=>Number(a.year)-Number(b.year)))line(h.year+(h.through2027?'-2027':'')+'  |  '+money(Math.round(Number(h.rate)*100))+'  |  '+(h.kind||'Record')+(h.source?' - '+h.source:''),9);}
 const textHistory=(data.history||[]).filter(h=>h.rate==null&&h.rateText);
 for(const h of textHistory)line(h.year+'  |  '+h.rateText+(h.source?'  |  '+h.source:''),9);
 if(data.reviewNotes?.length)line('Source review: '+data.reviewNotes.join(' '),9);
 section('BILLING & RESERVATIONS');
 field('Billing',({individual:'Individual traveler pays',company_room_tax:'Company credit card - Room & Tax',company_all:'Company credit card - All charges'})[data.billing||'individual']);
 field('Breakfast',((data.breakfast||(/breakfast included/i.test(data.additionalRate||'')?'included':'not_included'))==='included')?'Included in room rate':'Not included');
 field('Availability',data.availability||'Not recorded');if(data.additionalRate)field('Additional rate terms',data.additionalRate);
 line('Reservations:  Booking link ______   Email direct ______   Other ______');
 section('PAPER FILE CHECKLIST');
 for(const s of ['Signed contract with company and DOS signatures','Company credit card authorization on file (if applicable)','Rate code confirmed / rate loaded','Cluster code confirmed','Booking link sent']){space(22);ops.push('0 G 48 '+(y-1)+' 9 9 re S');text(s,65,10);y-=21;}
 line('Check each item after verification; contract status does not confirm both signatures.',8);
 if(data.notes){section('INTERNAL NOTES');for(const s of clean(data.notes).split('\n'))line(s,9);}
 space(35);y-=12;line('Verified by: _______________________    Date: __________________',9);
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
