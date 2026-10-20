// Read cell values only; formulas, macros and external links are never executed.
const utf8=new TextDecoder();
function xml(value){const doc=new DOMParser().parseFromString(value,'application/xml');if(doc.querySelector('parsererror'))throw Error('The worksheet could not be read.');return doc;}
export function parseCSV(content){
 const rows=[];let row=[],cell='',quoted=false;
 content=content.replace(/^\uFEFF/,'');
 for(let i=0;i<content.length;i++){
  const c=content[i];if(c==='"'){if(quoted&&content[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else cell+=c;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&content[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
  else cell+=c;
 }
 if(quoted)throw Error('The CSV has an unclosed quote.');if(cell||row.length){row.push(cell);rows.push(row);}return rows;
}
async function unzip(buffer){
 const view=new DataView(buffer), bytes=new Uint8Array(buffer);let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)throw Error('Choose an .xlsx or .csv file. Older .xls files must be saved as .xlsx first.');
 const count=view.getUint16(end+10,true);let offset=view.getUint32(end+16,true);const files=new Map();let total=0;
 if(count>1500)throw Error('This workbook has too many files.');
 for(let i=0;i<count;i++){
  if(view.getUint32(offset,true)!==0x02014b50)throw Error('The workbook archive is invalid.');
  const flags=view.getUint16(offset+8,true), method=view.getUint16(offset+10,true), size=view.getUint32(offset+20,true), expanded=view.getUint32(offset+24,true), nl=view.getUint16(offset+28,true), el=view.getUint16(offset+30,true), cl=view.getUint16(offset+32,true), loc=view.getUint32(offset+42,true);
  const name=utf8.decode(bytes.subarray(offset+46,offset+46+nl));offset+=46+nl+el+cl;
  total+=expanded;if(total>30_000_000||expanded>12_000_000)throw Error('The workbook is too large. Please use a CSV copy.');
  if(!/^xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/sheet\d+.xml)$/.test(name))continue;
  if(flags&1)throw Error('Password-protected workbooks are not supported.');
  if(view.getUint32(loc,true)!==0x04034b50)throw Error('The workbook archive is invalid.');
  const start=loc+30+view.getUint16(loc+26,true)+view.getUint16(loc+28,true), raw=bytes.slice(start,start+size);
  let out;if(method===0)out=raw;else if(method===8){const stream=new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));out=new Uint8Array(await new Response(stream).arrayBuffer());}else throw Error('Unsupported workbook compression.');
  if(out.length!==expanded)throw Error('A worksheet is damaged.');files.set(name,utf8.decode(out));
 }
 return files;
}
export async function readWorkbook(file){
 if(file.size>10_000_000)throw Error('Choose a log smaller than 10 MB.');
 if(file.name.toLowerCase().endsWith('.csv'))return[{name:'Certificate log',rows:parseCSV(await file.text())}];
 const files=await unzip(await file.arrayBuffer());if(!files.has('xl/workbook.xml'))throw Error('This is not a supported Excel workbook.');
 const strings=files.has('xl/sharedStrings.xml')?[...xml(files.get('xl/sharedStrings.xml')).getElementsByTagName('si')].map(n=>[...n.getElementsByTagName('t')].map(t=>t.textContent).join('')):[];
 const relationships=new Map([...xml(files.get('xl/_rels/workbook.xml.rels')||'<Relationships/>').getElementsByTagName('Relationship')].map(n=>[n.getAttribute('Id'),n.getAttribute('Target')]));
 const date1904=xml(files.get('xl/workbook.xml')).querySelector('workbookPr')?.getAttribute('date1904')==='1';
 return [...xml(files.get('xl/workbook.xml')).getElementsByTagName('sheet')].map(sheet=>{
  const id=sheet.getAttribute('r:id'),target=relationships.get(id)||'',path=target.startsWith('/')?target.slice(1):`xl/${target.replace(/^\.\//,'')}`;
  const content=files.get(path);if(!content)return null;
  const rows=[...xml(content).getElementsByTagName('row')].map(r=>{
   const row=[];for(const cell of r.getElementsByTagName('c')){
    const address=cell.getAttribute('r')||'A1',col=address.match(/^[A-Z]+/)[0];let index=0;for(const c of col)index=index*26+c.charCodeAt(0)-64;index--;
    const type=cell.getAttribute('t'),value=cell.getElementsByTagName('v')[0]?.textContent||'';
    row[index]=type==='s'?(strings[+value]||''):type==='inlineStr'?[...cell.getElementsByTagName('t')].map(t=>t.textContent).join(''):value;
   }return row;
  });return{name:sheet.getAttribute('name'),rows,date1904};
 }).filter(Boolean);
}
export function dateCell(value,date1904=false){
 const str=String(value??'').trim();if(!str)return'';
 if(/^\d{5}(\.\d+)?$/.test(str)){const base=Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30);return new Date(base+Math.floor(+str)*86400000).toISOString().slice(0,10);}
 if(/^\d{4}-\d{2}-\d{2}$/.test(str))return str;
 const m=str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);if(m)return`${m[3].length===2?'20'+m[3]:m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
 throw Error(`Unrecognized date: ${str}. Use MM/DD/YYYY or YYYY-MM-DD.`);
}
