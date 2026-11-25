(()=>{
const api=window.TALL_SMALL_REVIEWS_API || "";
const list=document.getElementById('reviewList'),form=document.getElementById('reviewForm'),status=document.getElementById('reviewNotice'),submit=document.getElementById('reviewSubmit');
let rating=0;
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
if(api){
 submit.disabled=false;submit.textContent='Post my review';status.textContent='Your review will be publicly visible after automated spam checks. Contact information is never displayed.';
 refresh();
}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!api)return;if(!rating){document.getElementById('rateStatus').textContent='Choose a rating to continue';return}
 const payload={name:document.getElementById('customerName').value.trim(),rating,comment:document.getElementById('customerComment').value.trim(),website:document.getElementById('websiteTrap').value,contact:document.getElementById('reviewContact').value.trim(),contact_permission:document.getElementById('contactPermission').checked};
 if(payload.comment.length<10){status.textContent='Please write at least 10 characters.';return}
 submit.disabled=true;status.textContent='Submitting your review…';
 try{const res=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!res.ok)throw Error('not accepted');status.textContent='Thank you! Your review has been submitted.';form.reset();rating=0;stars.forEach(x=>x.classList.remove('chosen'));await refresh()}
 catch{status.textContent='We could not submit your review. Please try again later or text David directly.'}
 finally{submit.disabled=false}
});
})();