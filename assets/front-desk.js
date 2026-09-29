const $=id=>document.getElementById(id);const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function cuts(w,h){let html='';for(const x of [0,w])for(const y of [0,h]){html+=`<i class="cut h" style="left:${x===0?-.12:x+.03}in;top:${y}in"></i><i class="cut v" style="left:${x}in;top:${y===0?-.12:y+.03}in"></i>`;}return html;}
function quantity(id,max){const n=Number($(id).value);return Number.isInteger(n)&&n>=0&&n<=max?n:null;}
$('print').onclick=async()=>{const b=$('print');b.disabled=true;try{await Promise.all([...document.querySelectorAll('#preview img')].map(im=>im.decode()));window.print();}catch(e){$('status').textContent='An image could not load. Please reload before printing.';}finally{b.disabled=false;}};
