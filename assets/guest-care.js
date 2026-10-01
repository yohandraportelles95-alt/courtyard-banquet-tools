
const occasions = {
  "birthday": {
    "label": "Birthday",
    "title": "A little birthday joy, just for you.",
    "message": "Happy Birthday! We’re so glad you’re here to celebrate another chapter of your story. Wishing you little surprises, big smiles, and moments that make you feel as special as you are.",
    "sign": "With warm birthday wishes,",
    "back": "Today is all about you.",
    "wish": "May the year ahead bring you wonderful moments, kind people, and so many reasons to smile.",
    "prompt": "e.g. We hope you enjoy your birthday dinner with your family."
  },
  "anniversary": {
    "label": "Wedding Anniversary",
    "title": "Here’s to your beautiful story.",
    "message": "Happy Anniversary! What a lovely reason to pause and celebrate the life you’ve shared and the memories still to come. We’re honored to be a small part of your celebration and hope your time here feels just a little extra special.",
    "sign": "With love and warm wishes,",
    "back": "To all your tomorrows.",
    "wish": "Wishing you more laughter, more little adventures, and many more moments to cherish together.",
    "prompt": "e.g. Wishing you both a wonderful 25th anniversary."
  },
  "sympathy": {
    "label": "With Sympathy / In Memory",
    "title": "Holding you in our thoughts.",
    "message": "We’re so sorry for your loss. There are no perfect words for a time like this, but please know you’re being thought of with care. We hope this can be a quiet, comforting place to rest while you’re here.",
    "sign": "With heartfelt sympathy,",
    "back": "A little comfort, a little care.",
    "wish": "May you find moments of gentleness, the comfort of those who care for you, and space to remember in your own way.",
    "prompt": "e.g. Please let our team know if there is a small way we can help."
  },
  "getwell": {
    "label": "Get Well / Wishing You Comfort",
    "title": "A little care, just for you.",
    "message": "We’re thinking of you and sending the warmest wishes for comfort and brighter days. We hope you find a little rest and ease here. Whether you need a quiet moment or a helping hand, please let our team know.",
    "sign": "With care and warm wishes,",
    "back": "One gentle day at a time.",
    "wish": "Wishing you restful moments, small comforts, and the kindness of people who care. You’re in our thoughts.",
    "prompt": "e.g. We hope your favorite tea brings a little comfort today."
  },
  "congratulations": {
    "label": "Congratulations / A Special Milestone",
    "title": "This moment deserves a little joy.",
    "message": "Congratulations on your special milestone! We’re delighted to share in a little piece of your happiness. We hope you take a moment to enjoy all that brought you here—and all the wonderful possibilities ahead.",
    "sign": "Cheering you on,",
    "back": "Here’s to what comes next.",
    "wish": "Wishing you happy memories of this moment and so many more reasons to celebrate.",
    "prompt": "e.g. Congratulations on your graduation—we’re so happy for you!"
  },
  "thinking": {
    "label": "Thinking of You / A Little Encouragement",
    "title": "A small note. A whole lot of care.",
    "message": "We just wanted you to know we’re glad you’re here. Whatever this day holds, we hope you find a little comfort, a quiet moment, and a reason to smile. You’re more than a room number to us.",
    "sign": "Warmly, and with care,",
    "back": "You’re thought of with kindness.",
    "wish": "Sometimes a little kindness can mean a lot. We hope this note brings a gentle bright spot to your day.",
    "prompt": "e.g. It was lovely chatting with you this morning."
  }
};
let wasOccasion = false;
let previousGift = null;
function syncOccasion(){
 const occasion = occasions[$('tone').value];
 if(occasion && !wasOccasion){
  previousGift = $('gift').value;
  $('gift').value = 'No gift';
 }else if(!occasion && wasOccasion && previousGift){
  $('gift').value = previousGift;
 }
 wasOccasion = !!occasion;
 $('personal-fields').hidden = !occasion;
 if(occasion) $('personal').placeholder = occasion.prompt;
 return occasion;
}
function renderOccasion(occasion){
 $('issue-fields').hidden = true;
 const none = $('gift').value === 'No gift';
 $('custom').disabled = none;
 const n = quantity('qty',100);
 if(!n){$('status').textContent='Enter a whole quantity from 1 to 100.';$('preview').replaceChildren();$('print').disabled=true;return;}
 const date=$('date').value?new Date($('date').value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
 const offer=$('custom').value.trim()||gifts[$('gift').value];
 const personal=$('personal').value.trim();
 const card=`<article class="care-face care-occasion"><div class="care-brand"><img src="../assets/branding/courtyard-logo.webp" alt="Courtyard by Marriott"><span>CARROLLTON, TEXAS</span></div><h2>${esc(occasion.title)}</h2><div class="care-copy"><p>Dear ${esc($('guest').value.trim()||'Guest')},</p><p>${esc(occasion.message)}</p>${personal?`<p class="care-personal">${esc(personal)}</p>`:''}</div>${none?'':`<div class="offer"><small style="display:block;font:9px Arial;letter-spacing:.15em;margin-bottom:5px">A LITTLE SOMETHING WITH OUR CARE</small>Please enjoy ${esc(offer)}.</div>`}<div class="care-sign"><span>${esc(occasion.sign)}<br>${esc($('staff').value.trim()||'Your Courtyard family')}</span><span>${esc([$ ('room').value.trim()?'Room '+$('room').value.trim():'',date].filter(Boolean).join(' · '))}</span></div></article>`;
 const back=`<article class="care-back care-occasion-back"><p class="care-family">From our Courtyard family</p><div class="care-back-rule"></div><h2>${esc(occasion.back)}</h2><p class="care-back-message">${esc(occasion.wish)}</p><p class="care-back-brand">Courtyard by Marriott<span>Carrollton, Texas</span></p></article>`;
 let html='';
 for(let i=0;i<n;i+=2){
  for(const side of ['front','back']){
   html+=`<div class="fd-sheet" data-side="${side}" aria-label="Sheet ${i/2+1} — ${side}">`;
   for(let k=0;k<2&&i+k<n;k++) html+=`<div class="fd-card" style="left:.75in;top:${.375+k*5.25}in;width:7in;height:5in">${cuts(7,5)}${side==='front'?card:back}</div>`;
   html+='</div>';
  }
 }
 $('preview').innerHTML=html;
 fitOccasionCards();
}
function fitOccasionCards(){
 if(!occasions[$('tone').value])return;
 let fits=true;
 document.querySelectorAll('.care-occasion').forEach(card=>{
  const copy=card.querySelector('.care-copy');
  const offer=card.querySelector('.offer');
  let size=16;
  copy.style.fontSize=size+'px';
  if(offer)offer.style.fontSize='17px';
  while(card.scrollHeight>card.clientHeight+1&&size>12){
   size-=.5;copy.style.fontSize=size+'px';
   if(offer)offer.style.fontSize=(size+1)+'px';
  }
  if(card.scrollHeight>card.clientHeight+1)fits=false;
 });
 const n=quantity('qty',100);
 $('print').disabled=!fits;
 $('status').textContent=fits?`${n} cards · ${Math.ceil(n/2)} duplex sheets · ${Math.ceil(n/2)*2} print pages (front, back)`:'Please shorten the personal note or offer so everything fits before printing.';
}
$('preview').addEventListener('load',fitOccasionCards,true);
window.addEventListener('beforeprint',fitOccasionCards);

const issues={'Housekeeping Issue':'your room was not as fresh and welcoming as it should have been','A/C / Temperature Issue':'the temperature in your room was uncomfortable','Plumbing Issue':'a plumbing issue interrupted your comfort','Service Issue':'our service fell short of the welcome we hoped to offer','Noise Issue':'noise disturbed your stay','Maintenance Issue':'a maintenance issue affected your stay','Other / Custom':'part of your stay fell short of your expectations'};
const gifts={'Market Item':'one complimentary Market item','Appetizer':'one complimentary appetizer','Drink':'one complimentary drink','Room Discount':'a discount on your room','Complimentary Night':'one complimentary night','Breakfast':'complimentary breakfast','Bonus Bonvoy Points':'bonus Marriott Bonvoy points','Custom':'a little something with our compliments'};
function render(){const occasion=syncOccasion();if(occasion){renderOccasion(occasion);return;}const thanks=$('tone').value==='thanks';$('issue-fields').hidden=thanks;const none=$('gift').value==='No gift';$('custom').disabled=none;const n=quantity('qty',100);if(!n){$('status').textContent='Enter a whole quantity from 1 to 100.';$('preview').replaceChildren();$('print').disabled=true;return;}const detail=$('detail').value.trim()||issues[$('issue').value];const offer=$('custom').value.trim()||gifts[$('gift').value];let msg=thanks?'Thank you for choosing to stay with us. It’s a pleasure to have you here, and we’re grateful to be part of your travels.':`We’re sorry that ${detail.replace(/[.!?]+$/,'')}. Thank you for giving us the opportunity to make it better. We’re committed to making the rest of your stay more comfortable.`;
const date=$('date').value?new Date($('date').value+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'';
const card=`<article class="care-face"><div class="care-brand"><img src="../assets/branding/courtyard-logo.webp" alt="Courtyard by Marriott"><span>CARROLLTON, TEXAS</span></div><h2>${thanks?'So glad you’re here.':'Let us make it better.'}</h2><div class="care-copy"><p>Dear ${esc($('guest').value.trim()||'Guest')},</p><p>${esc(msg)}</p></div>${none?'':`<div class="offer"><small style="display:block;font:9px Arial;letter-spacing:.15em;margin-bottom:5px">${thanks?'A LITTLE THANK-YOU':'WITH OUR COMPLIMENTS'}</small>Please enjoy ${esc(offer)}.</div>`}<div class="care-sign"><span>Warmly, ${esc($('staff').value.trim()||'Your Courtyard family')}</span><span>${esc([$ ('room').value.trim()?'Room '+$('room').value.trim():'',date].filter(Boolean).join(' · '))}</span></div></article>`;
const back=`<article class="care-back"><p class="care-family">From our Courtyard family</p><div class="care-back-rule"></div><h2>THANK YOU</h2><p class="care-back-lead">${thanks?'for being part of our day.':'for giving us the opportunity<br>to make things better.'}</p><p class="care-back-message">${thanks?'It was a pleasure having you with us.<br>We hope you felt right at home and look forward<br>to welcoming you again.':'We truly appreciate you being our guest<br>and hope the rest of your stay feels<br>just the way it should.'}</p><p class="care-back-brand">Courtyard by Marriott<span>Carrollton, Texas</span></p></article>`;
// Each front sheet is followed by its reverse. The centered single column
// maps to itself when Letter portrait stock is flipped on the long edge.
let html='';
for(let i=0;i<n;i+=2){
  for(const side of ['front','back']){
    html+=`<div class="fd-sheet" data-side="${side}" aria-label="Sheet ${i/2+1} — ${side}">`;
    for(let k=0;k<2&&i+k<n;k++){
      html+=`<div class="fd-card" style="left:.75in;top:${.375+k*5.25}in;width:7in;height:5in">${cuts(7,5)}${side==='front'?card:back}</div>`;
    }
    html+='</div>';
  }
}
$('preview').innerHTML=html;document.querySelectorAll('.care-face').forEach(card=>{let size=15;while(card.scrollHeight>card.clientHeight+1&&size>11){size-=.5;card.querySelector('.care-copy').style.fontSize=size+'px';const offer=card.querySelector('.offer');if(offer)offer.style.fontSize=(size+3)+'px';}});$('print').disabled=false;$('status').textContent=`${n} cards · ${Math.ceil(n/2)} duplex sheets · ${Math.ceil(n/2)*2} print pages (front, back)`;}
$('points').addEventListener('change',()=>{if($('points').checked){const o=new Option('Bonus Bonvoy Points','Bonus Bonvoy Points');$('gift').add(o);}else{const o=[...$('gift').options].find(o=>o.value==='Bonus Bonvoy Points');if(o)o.remove();}render();});document.querySelectorAll('.editor input,.editor select,.editor textarea').forEach(el=>el.addEventListener('input',render));render();
