(()=>{"use strict";
 const root=document.getElementById("workGallery");
 if(!root)return;
 const url="https://mltkksvlgvkqudrbnscv.supabase.co/functions/v1/work-gallery";
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const paragraph=(text)=>el("p","smallnote",text);
 async function show(){
  try{
   const res=await fetch(url,{headers:{Accept:"application/json"}});
   if(!res.ok)throw Error("Gallery unavailable");
   const data=await res.json();if(!Array.isArray(data.projects))throw Error("Unexpected response");
   root.replaceChildren();
   if(!data.projects.length){root.append(paragraph("Our project photos are coming soon!"));return}
   for(const p of data.projects){
    if(!Array.isArray(p.photos))continue;
    const article=el("article","work-card"),title=el("h3","",String(p.title||"Our Work").slice(0,80)),gallery=el("div","work-photos");
    article.append(title);
    let count=0;
    for(const photo of p.photos.slice(0,24)){
     if(!["before","after"].includes(photo.type)||typeof photo.url!=="string")continue;
     let url;
     try{url=new URL(photo.url)}catch{continue}
     if(url.protocol!=="https:"||url.hostname!=="mltkksvlgvkqudrbnscv.supabase.co"||!url.pathname.startsWith("/storage/v1/object/public/yard-project-public/"))continue;
     const fig=el("figure","work-photo"),img=el("img"),caption=el("figcaption","",photo.type==="before"?"Before":"After");
     img.src=url.href;img.alt=photo.type==="before"?"Before yard work":"After yard work";img.loading="lazy";img.decoding="async";
     fig.append(img,caption);gallery.append(fig);count++;
    }
    if(count){article.append(gallery);root.append(article)}
   }
   if(!root.childElementCount)root.append(paragraph("Our project photos are coming soon!"));
  }catch{root.replaceChildren(paragraph("Our project gallery is temporarily unavailable."))}
 }
 show();
})();