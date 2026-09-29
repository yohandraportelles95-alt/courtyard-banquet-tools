document.addEventListener('DOMContentLoaded',()=>{
 const host=document.querySelector('.editor')||document.querySelector('.controls');
 if(!host)return;
 const panel=document.createElement('div');panel.className='print-mode-panel';
 panel.innerHTML='<label for="printMode">Print finish</label><select id="printMode"><option value="premium">Premium — full color</option><option value="ink">Ink Saver — light background</option></select><p>Ink Saver keeps the wording and layout with less background ink.</p>';
 host.appendChild(panel);
 panel.querySelector('select').addEventListener('change',e=>{document.body.classList.toggle('ink-saver',e.target.value==='ink')});
});
