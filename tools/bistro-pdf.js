(function(root){
'use strict';
const pageWidth=612, pageHeight=792, margin=42, contentWidth=528;
const green='0.145 0.306 0.267', ink='0.14 0.23 0.20', pale='0.925 0.949 0.925';
const extended='€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
function literal(value){
 const text=String(value).normalize('NFC').replace(/[\r\n\t]/g,' ');
 return '('+[...text].map(c=>{
  const index=extended.indexOf(c);
  const code=index>=0?index+128:c.codePointAt(0);
  if(code>255)throw Error('A guest name uses characters outside this PDF font. Use Print / Save PDF to preserve the spelling.');
  if(code<32||code>126)return '\\'+code.toString(8).padStart(3,'0');
  return /[()\\]/.test(c)?'\\'+c:c;
 }).join('')+')';
}
function wrap(value,max){
 const lines=[];
 let line='';
 for(const word of String(value).split(/\s+/)){
  if(line&&line.length+word.length+1>max){lines.push(line);line='';}
  let rest=word;
  while(rest.length>max){lines.push(rest.slice(0,max));rest=rest.slice(max);}
  if(rest)line+=(line?' ':'')+rest;
 }
 lines.push(line);
 return lines;
}
function build(days,exceptions,nice){
 const pages=[];
 let ops,y;
 function label(text,x,top,size=10,bold=false,color=ink){
  ops.push(`BT /${bold?'F2':'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x} ${pageHeight-top-size} Tm ${literal(text)} Tj ET`);
 }
 function block(top,height,color){ops.push(`${color} rg ${margin} ${pageHeight-top-height} ${contentWidth} ${height} re f`);}
 function page(title,subtitle){
  ops=[];pages.push(ops);
  block(39,3,green);
  label('COURTYARD DALLAS CARROLLTON & CONFERENCE CENTER',margin,54,9,true,green);
  label(title,margin,73,23,true,green);
  label(subtitle,margin,105,10);
  label('Bistro operations  |  Internal guest information',margin,754,9);
  label(String(pages.length),pageWidth-margin-15,754,9);
  y=133;
 }
 function paragraph(text){for(const line of wrap(text,100)){label(line,margin,y,9);y+=13;}y+=8;}
 function row(cells,columns,widths,heading=false){
  const lines=cells.map((cell,i)=>String(cell).split('\n').flatMap(line=>wrap(line,widths[i])));
  const height=10+Math.max(...lines.map(x=>x.length))*13;
  block(y,height,heading?pale:'0.985 0.986 0.980');
  lines.forEach((values,i)=>values.forEach((line,j)=>label(line,margin+columns[i],y+4+j*13,heading?9:10,heading)));
  y+=height+1;
 }
 const first=nice(days[0].date),last=nice(days.at(-1).date);
 const range=first===last?first:`${first} - ${last}`;
 const overviewColumns=[8,245,333,411], overviewWidths=[40,13,11,17];
 const overviewHeader=()=>row(['Breakfast date','Total','Used','Remaining'],overviewColumns,overviewWidths,true);
 page('Bistro Breakfast Report',range);
 paragraph('One coupon per morning, from the day after check-in through checkout. Used coupons follow the dates recorded in Stay.');
 paragraph('When the unused balance is smaller than the number of eligible mornings, the report fills the latest mornings first.');
 if(exceptions)paragraph(`${exceptions} extra or undated coupon records could not be placed on a breakfast date and are excluded from the daily totals.`);
 overviewHeader();
 for(const day of days){
  if(y>713){page('Daily Totals (continued)',range);overviewHeader();}
  row([nice(day.date),day.total,day.used,day.remaining],overviewColumns,overviewWidths);
 }
 const guestColumns=[8,185,305,407,446,477],guestWidths=[26,18,16,6,5,10];
 const guestHeader=()=>row(['Guest / reservation','Member status','First / last breakfast','Total','Used','Remaining'],guestColumns,guestWidths,true);
 const shortDate=d=>nice(d).split(',')[0];
 for(const day of days){
  const title=nice(day.date),stats=`${day.total} total  |  ${day.used} used  |  ${day.remaining} remaining`;
  if(days.length===1&&y<610){y+=24;label('Guest list',margin,y,16,true,green);y+=28;}
  else page(title,stats);
  guestHeader();
  if(!day.guests.length)paragraph('No breakfast coupons for this date.');
  for(const guest of day.guests){
   const detail=`${guest.reservation} / ${guest.stayTotal} stay coupons`;
   const name=`${guest.name}\n${detail}`;
   const span=guest.first===guest.last?shortDate(guest.first):`${shortDate(guest.first)} - ${shortDate(guest.last)}`;
   const nameLines=wrap(guest.name,guestWidths[0]).length+wrap(detail,guestWidths[0]).length;
   const height=11+13*Math.max(nameLines,wrap(guest.tier,guestWidths[1]).length,wrap(span,guestWidths[2]).length);
   if(y+height>729){page(`${title} (continued)`,stats);guestHeader();}
   row([name,guest.tier,span,guest.total,guest.used,guest.remaining],guestColumns,guestWidths);
  }
 }
 return serialize(pages);
}
function serialize(pages){
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
 const kids=[];
 for(const ops of pages){
  const id=objects.length+1,stream=ops.join('\n');
  kids.push(`${id} 0 R`);
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${id+1} 0 R >>`,
   `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
 }
 objects[1]=`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`;
 let pdf='%PDF-1.4\n';
 const offsets=[0];
 objects.forEach((body,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;});
 const xref=pdf.length;
 pdf+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))pdf+=`${String(offset).padStart(10,'0')} 00000 n \n`;
 pdf+=`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return new TextEncoder().encode(pdf);
}
if(typeof module!=='undefined')module.exports={build};else root.BistroPdf={build};
})(typeof window==='undefined'?globalThis:window);
