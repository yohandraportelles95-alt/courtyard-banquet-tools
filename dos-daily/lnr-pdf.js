// Builds a Sertifi-ready downloadable PDF using a sanitized copy of the 2026 agreement.
// Customer details exist only in the authenticated response and the downloaded document.
const replacements={'\u2018':"'",'\u2019':"'",'\u201c':'"','\u201d':'"','\u2013':'-','\u2014':'-','\u00a0':' '};
function clean(value){return String(value??'').replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u00a0]/g,c=>replacements[c]);}
function literal(value){const t=clean(value);if([...t].some(c=>c.charCodeAt(0)>255))throw Error('The PDF needs a Latin-alphabet spelling for this name or address.');return '('+t.replace(/([\\()])/g,'\\$1').replace(/[\r\n]/g,' ')+')';}
function bytes(s){return Uint8Array.from(s,c=>c.charCodeAt(0));}
function wrap(text,size,width,widths){const lines=[];for(const paragraph of clean(text).split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const trial=line?line+' '+word:word;if(measure(trial,size,widths)>width&&line){lines.push(line);line=word;}else line=trial;}lines.push(line);}return lines;}
const measure=(s,size,w)=>[...s].reduce((n,c)=>n+(w[c.charCodeAt(0)]||500),0)*size/1000;
function textOps(field,value,model){let size=field.size,lines;const w=model.widths[field.font];for(;size>=7;size-=.2){lines=wrap(value,size,field.w,w);if(lines.length*size*1.15<=field.h&&lines.every(l=>measure(l,size,w)<=field.w))break;}if(size<7)throw Error('Some contract details are too long for the template. Shorten the company name, title or address.');return lines.map((line,i)=>`BT /${field.font} ${size.toFixed(2)} Tf 0 g 1 0 0 1 ${field.x} ${(792-field.y-size-i*size*1.15).toFixed(2)} Tm ${literal(line)} Tj ET`).join('\n');}
export function buildContractPdf(data,model){
 if(!Number.isInteger(data.rate2027)||data.rate2027<100)throw Error('Enter the 2027 rate first.');
 const values={...data,company:data.contractCompany||data.company,availabilityText:data.availability==='LRA'?'LAST ROOM AVAILABILITY':'NON-LAST ROOM AVAILABILITY',fax:'',acceptByDisplay:data.acceptBy?.split('-').slice(1).concat(data.acceptBy.split('-')[0]).join('/')};
 if(!data.acceptBy||!/^\d{4}-\d{2}-\d{2}$/.test(data.acceptBy))throw Error('Choose the contract return date.');
 const breakfast=data.breakfast||(/breakfast included/i.test(data.additionalRate||'')?'included':'not_included');
 const billing=data.billing||'individual';
 if(!['included','not_included'].includes(breakfast)||!['individual','company_room_tax','company_all'].includes(billing))throw Error('Choose valid breakfast and billing options.');
 const billingText=billing==='company_all'?'All charges for company-designated guests, including room, applicable taxes and incidentals, will be charged to the company credit card on file, subject to a completed credit card authorization covering those charges before arrival.':billing==='company_room_tax'?'Room and applicable taxes for company-designated guests will be charged to the company credit card on file, subject to a completed credit card authorization before arrival. Each traveler is responsible for incidentals and must provide payment at check-in.':null;
 const streams=model.pages.map(()=>[]);
 for(const f of model.fields){const signatureLabel=f.page===1&&[553,640].includes(f.y)&&f.x===310?'Signature:':f.page===1&&[579,666].includes(f.y)&&f.x===310?'Date:':f.page===1&&f.y===579&&f.x===54?'Title:':f.text;let content=signatureLabel;
 if(f.page===1&&f.y===202&&billingText)content=billingText;
 if(f.page===0&&f.y===516)content=(breakfast==='included'?'Breakfast is included in the negotiated room rate. ':'Breakfast is not included in the negotiated room rate. ')+content;
 const value=content.replace(/\{\{(\w+)\}\}/g,(_,k)=>values[k]??'');streams[f.page].push(textOps(f,value,model));}
 function table(y,rate,room,additional=''){
  const x=142,cw=66,width=cw*4,header=28,row=21,height=header+row+(additional?22:0),ops=['q 0.6 G 0.45 w'];
  for(const yy of [y,y+header,y+header+row,...(additional?[y+height]:[])])ops.push(`${x} ${792-yy} m ${x+width} ${792-yy} l S`);
  for(let i=0;i<=4;i++)ops.push(`${x+i*cw} ${792-y} m ${x+i*cw} ${792-y-height} l S`);
  ops.push('Q');
  ['Season Start\nDate','Season End\nDate','Room Type','Rate'].forEach((s,i)=>ops.push(textOps({x:x+i*cw+4,y:y+3,w:cw-8,h:25,size:9.5,font:'tibo'},s,model)));
  ['01/01/27','12/31/27',room,rate].forEach((s,i)=>ops.push(textOps({x:x+i*cw+3,y:y+header+4,w:cw-6,h:15,size:10,font:'tiro'},s,model)));
  if(additional)ops.push('q 1 g '+`${x+.5} ${792-y-height+.5} ${width-1} 21 re f Q`,textOps({x:x+4,y:y+header+row+3,w:width-8,h:17,size:9.5,font:'tiro'},additional,model));return ops.join('\n');
 }
 streams[0].push(table(338,'$189','GENR'),table(441,'$'+(data.rate2027/100).toFixed(2),data.roomType||'GENR/QNQN',(data.additionalRate||'').replace(/Breakfast included in the rate\.?/gi,'').trim()));
 const raw=atob(model.base64);let result=raw+'\n',next=model.size;const entries=[];
 function obj(id,body){entries.push([id,result.length]);result+=`${id} 0 obj\n${body}\nendobj\n`;}
 // Named AcroForm text widgets are recognized by Sertifi on upload.
 // Keep signer levels aligned with the tested client (1) / hotel (2) setup.
 const fontId=next++;obj(fontId,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const signingPage=model.pages[1];
 if(!signingPage)throw Error('The contract signature page is missing.');
 const signingFields=[
  {name:'SertifiSignature_1',x:356,y:220,w:198,h:26,value:''},
  {name:'SertifiTitle_1',x:80,y:193,w:209,h:20,value:data.contactTitle||''},
  {name:'SertifiDate_1',x:340,y:193,w:214,h:20,value:''},
  {name:'SertifiSignature_2',x:356,y:133,w:198,h:26,value:''},
  {name:'SertifiDate_2',x:340,y:106,w:214,h:20,value:''}
 ];
 const fieldIds=signingFields.map(f=>{
  const appearance=next++,id=next++;
  const value=clean(f.value);
  const fontSize=Math.min(9,Math.max(5,f.w/(Math.max(1,value.length)*.6)));
  const content=`q 0.96 g 0 0 ${f.w} ${f.h} re f 0.7 G 0.5 w .25 .25 ${f.w-.5} ${f.h-.5} re S Q\nBT /Helv ${fontSize} Tf 0 g 3 6 Td ${literal(value)} Tj ET`;
  obj(appearance,`<< /Type /XObject /Subtype /Form /BBox [0 0 ${f.w} ${f.h}] /Resources << /Font << /Helv ${fontId} 0 R >> >> /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(id,`<< /Type /Annot /Subtype /Widget /FT /Tx /T ${literal(f.name)} /TU ${literal(f.name)} /V ${literal(value)} /Rect [${f.x} ${f.y} ${f.x+f.w} ${f.y+f.h}] /P ${signingPage.id} 0 R /F 4 /DA (/Helv 9 Tf 0 g) /AP << /N ${appearance} 0 R >> >>`);
  return id;
 });
 const formId=next++;obj(formId,`<< /Fields [${fieldIds.map(id=>id+' 0 R').join(' ')}] /DR << /Font << /Helv ${fontId} 0 R >> >> /DA (/Helv 9 Tf 0 g) /NeedAppearances false >>`);
 const catalog=raw.match(new RegExp('(?:^|\\n)'+model.root+' 0 obj\\s*([\\s\\S]*?)\\s*endobj'));
 if(!catalog)throw Error('The PDF catalog could not be read.');
 obj(model.root,catalog[1].replace(/>>\s*$/,` /AcroForm ${formId} 0 R >>`));
 model.pages.forEach((p,i)=>{const id=next++,content=streams[i].join('\n');obj(id,`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);let dict=p.dictionary;if(i===1)dict=dict.replace(/>>\s*$/,` /Annots [${fieldIds.map(id=>id+' 0 R').join(' ')}] >>`);if(/\/Contents\s*\[/.test(dict))dict=dict.replace(/\/Contents\s*\[([^\]]*)\]/,(_,a)=>`/Contents [${a} ${id} 0 R]`);else dict=dict.replace(/\/Contents\s*(\d+\s+0\s+R)/,`/Contents [$1 ${id} 0 R]`);obj(p.id,dict);});
 const start=result.length;result+='xref\n';for(const [id,offset] of entries.sort((a,b)=>a[0]-b[0]))result+=`${id} 1\n${String(offset).padStart(10,'0')} 00000 n \n`;
 result+=`trailer\n<< /Size ${next} /Root ${model.root} 0 R /Prev ${model.previousXref} >>\nstartxref\n${start}\n%%EOF\n`;return bytes(result);
}
export function downloadContract(data,model){const bytes=buildContractPdf(data,model),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download=(data.company+' - 2027 Corporate Rate Agreement').replace(/[^a-zA-Z0-9 ._-]/g,'')+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
