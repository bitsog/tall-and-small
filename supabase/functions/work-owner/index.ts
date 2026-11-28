import { createClient } from "npm:@supabase/supabase-js@2";
const env=(key:string)=>Deno.env.get(key)||"";
const db=createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
const privateBucket="yard-project-drafts",publicBucket="yard-project-public";
const allowed=new Set(["https://tallandsmallyardwork.com","https://www.tallandsmallyardwork.com"]);
const idOk=(s:unknown)=>typeof s==="string"&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(s);
const publicPath=(p:any)=>p.project_id+"/"+p.id+(p.mime_type==="image/jpeg"?".jpg":p.mime_type==="image/png"?".png":".webp");
const err=(e:any)=>{if(e)throw e};
async function makePublic(photo:any){
 const path=publicPath(photo);
 const {data:blob,error:dErr}=await db.storage.from(privateBucket).download(photo.draft_path);err(dErr);
 if(!blob)throw Error("Source photo unavailable");
 const {error:upErr}=await db.storage.from(publicBucket).upload(path,blob,{contentType:photo.mime_type,upsert:true,cacheControl:"3600"});err(upErr);
 const {error:dbErr}=await db.from("work_photos").update({public_path:path}).eq("id",photo.id);err(dbErr);
}
async function unpublish(photo:any){
 if(photo.public_path){
  const {error}=await db.storage.from(publicBucket).remove([photo.public_path]);err(error);
  const {error:dbErr}=await db.from("work_photos").update({public_path:null}).eq("id",photo.id);err(dbErr);
 }
}
async function ownerFrom(req:Request){
 const token=(req.headers.get("authorization")||"").match(/^Bearer\s+(.+)$/i)?.[1]||"";
 if(!token)return false;
 const {data:{user},error}=await db.auth.getUser(token);
 if(error||!user?.email||!user.email_confirmed_at)return false;
 const {data:owner,error:oerr}=await db.from("website_owner_emails").select("email").eq("email",user.email.trim().toLowerCase()).maybeSingle();err(oerr);
 return !!owner;
}
Deno.serve(async req=>{
 const origin=req.headers.get("origin")||"";
 const cors={"Access-Control-Allow-Origin":allowed.has(origin)?origin:"https://tallandsmallyardwork.com","Access-Control-Allow-Methods":"GET,PATCH,OPTIONS","Access-Control-Allow-Headers":"authorization,content-type,apikey","Vary":"Origin","Cache-Control":"no-store","Content-Type":"application/json"};
 const respond=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers:cors});
 if(req.method==="OPTIONS")return new Response(null,{headers:cors});
 if(origin&&!allowed.has(origin))return respond({error:"Origin not allowed"},403);
 if(!["GET","PATCH"].includes(req.method))return respond({error:"Method not allowed"},405);
 try{
  if(!await ownerFrom(req))return respond({error:"Not authorized"},401);
  if(req.method==="GET"){
   const {data:jobs,error}=await db.from("work_projects").select("id,title,status,capture_mode,created_at,published_at,updated_at").order("created_at",{ascending:false}).limit(100);err(error);
   const out=[];
   for(const job of jobs||[]){
    const {data:photos,error:e}=await db.from("work_photos").select("id,photo_type,draft_path,public_path,mime_type,created_at,hidden_at").eq("project_id",job.id).order("created_at");err(e);
    const mapped=[];
    for(const photo of photos||[]){
     const hidden=!!photo.hidden_at;
     let url="";
     if(!hidden&&job.status==="published"&&photo.public_path)url=db.storage.from(publicBucket).getPublicUrl(photo.public_path).data.publicUrl;
     else {
      const {data:signed,error:signError}=await db.storage.from(privateBucket).createSignedUrl(photo.draft_path,600);
      if(!signError)url=signed.signedUrl;
     }
     mapped.push({id:photo.id,type:photo.photo_type,hidden,url});
    }
    out.push({...job,photos:mapped});
   }
   return respond({projects:out});
  }
  const raw=await req.text();if(raw.length>2500)return respond({error:"Request too large"},413);
  let body:any;try{body=JSON.parse(raw)}catch{return respond({error:"Invalid JSON"},400)}
  const action=String(body.action||""),id=body.project_id;
  if(!idOk(id))return respond({error:"Invalid project"},400);
  const {data:job,error:loadErr}=await db.from("work_projects").select("*").eq("id",id).maybeSingle();err(loadErr);
  if(!job)return respond({error:"Project not found"},404);
  if(action==="rename"){
   const title=String(body.title||"").replace(/\s+/g," ").trim();
   if(title.length<3||title.length>70||/@|\b\d{3}[-. ]?\d{3}[-. ]?\d{4}\b|\b\d+\s+\w+\s+(?:st|street|ave|avenue|road|rd|drive|dr|lane|ln|court|ct)\b/i.test(title))
    return respond({error:"Use a short job description without names, addresses, or contact details"},400);
   const {error}=await db.from("work_projects").update({title,updated_at:new Date().toISOString()}).eq("id",id);err(error);
   return respond({ok:true});
  }
  if(action==="hide_photo"||action==="restore_photo"){
   if(!idOk(body.photo_id))return respond({error:"Invalid photo"},400);
   const {data:photo,error:pErr}=await db.from("work_photos").select("*").eq("id",body.photo_id).eq("project_id",id).maybeSingle();err(pErr);
   if(!photo)return respond({error:"Photo not found"},404);
   if(action==="hide_photo"){
    // Remove public copies, not just gallery listings, before marking hidden.
    await unpublish(photo);
    const {error}=await db.from("work_photos").update({hidden_at:new Date().toISOString()}).eq("id",photo.id);err(error);
   } else {
    if(job.status==="published")await makePublic(photo);
    const {error}=await db.from("work_photos").update({hidden_at:null}).eq("id",photo.id);err(error);
   }
   return respond({ok:true});
  }
  if(action==="archive"||action==="restore"){
   const {data:photos,error}=await db.from("work_photos").select("*").eq("project_id",id);err(error);
   if(action==="archive"){
    if(job.status==="archived")return respond({ok:true});
    // Archive is reversible. The private copies are retained. A CDN may cache old URLs briefly.
    for(const p of photos||[])await unpublish(p);
    const {error:u}=await db.from("work_projects").update({status:"archived",archived_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id);err(u);
   } else {
    if(job.status!=="archived")return respond({error:"Only archived projects can be restored"},409);
    // Preserve drafts without exposing them publicly; prevent two active SMS jobs.
    if(!job.published_at){
      const {data:active,error:activeErr}=await db.from("work_projects").select("id").in("status",["draft","awaiting_publish"]).neq("id",id).limit(1);err(activeErr);
      const nextStatus=active?.length?"held":"draft";
      const {error:u}=await db.from("work_projects").update({status:nextStatus,archived_at:null,updated_at:new Date().toISOString()}).eq("id",id);err(u);
    } else {
      for(const p of photos||[])if(!p.hidden_at)await makePublic(p);
      const {error:u}=await db.from("work_projects").update({status:"published",archived_at:null,updated_at:new Date().toISOString()}).eq("id",id);err(u);
    }
   }
   return respond({ok:true});
  }
  return respond({error:"Unsupported action"},400);
 }catch(e){console.error("Owner photo management failed",e);return respond({error:"Operation could not be completed. Please refresh and retry."},500)}
});