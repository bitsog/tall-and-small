(()=>{
const api=window.TALL_SMALL_REVIEWS_API || "";
const list=document.getElementById('reviewList'),form=document.getElementById('reviewForm'),status=document.getElementById('reviewNotice'),submit=document.getElementById('reviewSubmit');
let rating=0,turnstileWidget=null;
const turnstileSitekey=window.TALL_SMALL_TURNSTILE_SITEKEY||'';
const stars=[...document.querySelectorAll('#rate button')];
stars.forEach(b=>b.addEventListener('click',()=>{rating=Number(b.dataset.star);for(const x of stars){x.classList.toggle('chosen',Number(x.dataset.star)<=rating);x.setAttribute('aria-pressed',String(Number(x.dataset.star)===rating))}document.getElementById('rateStatus').textContent=rating+' of 5 stars'}));
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;};
function showReview(r){
 const article=el('article','review-card'),heading=el('strong','',String(r.name).slice(0,60)),stars=el('div','stars','★'.repeat(r.rating)+'☆'.repeat(5-r.rating)),comment=el('p','',String(r.comment).slice(0,1000));
 article.append(heading,stars,comment);
 if(r.owner_reply){const box=el('div','review-card'),heading=el('strong','','David — Business owner'),response=el('p','',String(r.owner_reply).slice(0,1000));box.style.background='#e3edcf';box.append(heading,response);article.append(box)}
 list.append(article);
}
async function refresh(){
 if(!api)return;
 try{const res=await fetch(api,{headers:{Accept:'application/json'}});if(!res.ok)throw Error('unavailable');const data=await res.json();if(!Array.isArray(data.reviews))throw Error('invalid response');list.replaceChildren();if(!data.reviews.length)list.append(el('p','smallnote','No reviews published yet. Be the first to share your experience.'));
 for(const r of data.reviews){if(Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=5&&typeof r.comment==='string'&&typeof r.name==='string')showReview(r)}
 }catch{list.replaceChildren(el('p','smallnote','Customer reviews are temporarily unavailable.'))}
}
// Public review display does not depend on the CAPTCHA widget.
if(api)refresh();
if(api&&turnstileSitekey){
 const mount=document.createElement('div');mount.id='reviewTurnstile';submit.before(mount);
 const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;
 script.onload=()=>{try{if(!window.turnstile)throw Error('Missing Turnstile library');turnstileWidget=window.turnstile.render('#reviewTurnstile',{sitekey:turnstileSitekey});submit.disabled=false;submit.textContent='Post my review';status.textContent='Complete the anti-spam check, then post your review.'}catch{submit.disabled=true;status.textContent='Spam protection could not start. Please try again later.'}};
 script.onerror=()=>{submit.disabled=true;status.textContent='Spam protection could not load. Please try again later.'};
 document.head.append(script);
}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!api)return;if(!rating){document.getElementById('rateStatus').textContent='Choose a rating to continue';return}
 const token=turnstileWidget!==null&&window.turnstile?window.turnstile.getResponse(turnstileWidget):'';
 if(!token){status.textContent='Please complete the anti-spam check before submitting.';return}
 const payload={turnstile_token:token,name:document.getElementById('customerName').value.trim(),rating,comment:document.getElementById('customerComment').value.trim(),website:document.getElementById('websiteTrap').value};
 if(payload.comment.length<10){status.textContent='Please write at least 10 characters.';return}
 submit.disabled=true;status.textContent='Submitting your review…';
 try{const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!res.ok)throw Error('not accepted');status.textContent='Thank you! Your review has been submitted.';form.reset();rating=0;stars.forEach(x=>{x.classList.remove('chosen');x.setAttribute('aria-pressed','false')});document.getElementById('rateStatus').textContent='Choose 1 to 5 stars';await refresh()}
 catch{status.textContent='We could not submit your review. Please try again later.'}
 finally{if(turnstileWidget!==null&&window.turnstile)window.turnstile.reset(turnstileWidget);submit.disabled=false}
});
})();