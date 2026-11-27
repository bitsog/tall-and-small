// Owner-only MMS job collection. Called after Twilio HMAC and sender checks.
// Public URLs are never created until David sends POST for a completed project.
import { stripPhotoMetadata, sniffPhotoType } from "./photo-safety.js";
const PRIVATE="yard-project-drafts",PUBLIC="yard-project-public";
const xmlOk=true;
const commands=/^(JOB|BEFORE|AFTER|DONE|POST|HOLD|MORE|RESUME|PHOTOS)(?:\s|$)|^NAME\s+/i;
const countPhotos=async(db,id)=>{
 const {data,error}=await db.from("work_photos").select("photo_type").eq("project_id",id);
 if(error)throw error;
 return {before:data.filter(p=>p.photo_type==="before").length,after:data.filter(p=>p.photo_type==="after").length,total:data.length};
};
const activeJob=async(db)=>{
 const {data,error}=await db.from("work_projects").select("*").in("status",["draft","awaiting_publish"]).limit(2);
 if(error)throw error;
 if(data.length>1)throw Error("More than one active project");
 return data[0]||null;
};
const createJob=async(db,mode="after")=>{
 const {data,error}=await db.from("work_projects").insert({title:"Completed Yard Work",status:"draft",capture_mode:mode}).select("*").single();
 if(error)throw error;
 return data;
};
const recentHeld=async(db)=>{
 const {data,error}=await db.from("work_projects").select("*").eq("status","held").order("updated_at",{ascending:false}).limit(2);
 if(error)throw error;
 return data;
};
async function fetchMedia(raw,sid,token,maxBytes){
 let url=new URL(raw);
 if(url.protocol!=="https:"||url.hostname!=="api.twilio.com"||!url.pathname.startsWith("/2010-04-01/Accounts/"+sid+"/Messages/"))throw Error("Unexpected MMS URL");
 for(let i=0;i<4;i++){
  const api=url.hostname==="api.twilio.com";
  const allowed=api||(url.hostname==="media.twiliocdn.com"||url.hostname.endsWith(".twiliocdn.com"));
  if(!allowed||url.protocol!=="https:")throw Error("Unsafe MMS redirect");
  const res=await fetch(url.toString(),{redirect:"manual",headers:api?{Authorization:"Basic "+btoa(sid+":"+token)}:{}});
  if([301,302,303,307,308].includes(res.status)){
   const dest=res.headers.get("location");if(!dest)throw Error("Missing redirect target");
   url=new URL(dest,url);continue;
  }
  if(!res.ok||!res.body)throw Error("Twilio photo download failed: "+res.status);
  if(Number(res.headers.get("content-length")||0)>maxBytes)throw Error("Photo too large");
  const reader=res.body.getReader();const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>maxBytes){await reader.cancel();throw Error("Photo exceeds size limit")}
   chunks.push(value);
  }
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return bytes;
 }
 throw Error("Too many media redirects");
}
function safeTitle(raw){
 const t=raw.trim().replace(/\s+/g," ").slice(0,70);
 if(!t||t.length<3||/@|\b\d{3}[-. ]?\d{3}[-. ]?\d{4}\b|\b\d+\s+\w+\s+(?:st|street|ave|avenue|road|rd|drive|dr|lane|ln|court|ct)\b/i.test(t))return null;
 return t;
}
export function isPhotoMessage(form){
 return Number(form.get("NumMedia")||"0")>0 || commands.test((form.get("Body")||"").trim());
}
export async function handlePhotoMessage({form,db,send,get}){
 const command=(form.get("Body")||"").trim();
 const upper=command.toUpperCase();
 const number=Number(form.get("NumMedia")||"0");
 const say=async msg=>send(get("DAVID_NOTIFY_NUMBER"),msg);
 let job=await activeJob(db);
 if(upper==="PHOTOS"){
  if(!job){await say("No current photo job. Send a photo to start one, or text JOB.");return true}
  const n=await countPhotos(db,job.id);await say(job.title+": "+n.before+" BEFORE, "+n.after+" AFTER. Mode: "+job.capture_mode.toUpperCase()+". Text DONE when finished.");return true;
 }
 if(upper==="JOB"){
  if(job){await say("Finish your current photo job with DONE, or save it with HOLD, before starting another.");return true}
  await createJob(db,"before");await say("New job started. Send BEFORE pictures now. Text AFTER once when ready for finished pictures. AFTER-only jobs are fine too.");return true;
 }
 if(upper==="HOLD"){
  if(!job){await say("No active photo job to save.");return true}
  const {error}=await db.from("work_projects").update({status:"held",updated_at:new Date().toISOString()}).eq("id",job.id);
  if(error)throw error;await say("Saved this job privately. Text JOB to start a new one or RESUME to reopen your most recent saved job.");return true;
 }
 if(upper==="RESUME"){
  if(job){await say("Finish or HOLD the current photo job first.");return true}
  const held=await recentHeld(db);
  if(held.length!==1){await say(held.length?"More than one saved job. Use the Owner Portal to choose which to resume.":"No saved photo jobs.");return true}
  const {error}=await db.from("work_projects").update({status:"draft",updated_at:new Date().toISOString()}).eq("id",held[0].id);
  if(error)throw error;await say("Resumed "+held[0].title+". Send photos, or text DONE when ready.");return true;
 }
 if(upper==="BEFORE"||upper==="AFTER"){
  const mode=upper.toLowerCase();
  if(!job)job=await createJob(db,mode);
  else{
   const {error}=await db.from("work_projects").update({capture_mode:mode,status:"draft",updated_at:new Date().toISOString()}).eq("id",job.id);
   if(error)throw error;
  }
  await say("Ready for "+upper+" pictures. Send one or several photos; all will stay together in this job.");return true;
 }
 if(/^NAME\s+/i.test(command)){
  if(!job){await say("Start a photo job before naming it.");return true}
  const title=safeTitle(command.replace(/^NAME\s+/i,""));
  if(!title){await say("Use a general title like Backyard Cleanup. Please don't include a customer's address or personal details.");return true}
  const {error}=await db.from("work_projects").update({title,updated_at:new Date().toISOString()}).eq("id",job.id);
  if(error)throw error;await say("Job renamed: "+title+".");return true;
 }
 if(upper==="MORE"){
  if(!job){await say("No current job. Text JOB or send a photo.");return true}
  const {error}=await db.from("work_projects").update({status:"draft",updated_at:new Date().toISOString()}).eq("id",job.id);
  if(error)throw error;await say("You can send more "+job.capture_mode.toUpperCase()+" pictures now.");return true;
 }
 if(upper==="DONE"){
  if(!job){await say("No current photo job. Send a photo to start one.");return true}
  const n=await countPhotos(db,job.id);
  if(!n.total){await say("No pictures yet. Send a photo first.");return true}
  const {error}=await db.from("work_projects").update({status:"awaiting_publish",updated_at:new Date().toISOString()}).eq("id",job.id);
  if(error)throw error;
  await say("Ready to publish "+job.title+" with "+n.before+" BEFORE and "+n.after+" AFTER photos. Reply POST to publish, MORE to add pictures, or HOLD to save privately.");
  return true;
 }
 if(upper==="POST"){
  if(!job||job.status!=="awaiting_publish"){await say("Text DONE first to preview your photo job before posting.");return true}
  const {data:photos,error}=await db.from("work_photos").select("*").eq("project_id",job.id);
  if(error)throw error;
  if(!photos?.length){await say("There are no photos to publish.");return true}
  const created=[];
  try{
   for(const p of photos){
    const {data:blob,error:downloadError}=await db.storage.from(PRIVATE).download(p.draft_path);
    if(downloadError||!blob)throw downloadError||Error("Missing draft");
    const path=p.project_id+"/"+p.id+(p.mime_type==="image/jpeg"?".jpg":p.mime_type==="image/png"?".png":".webp");
    const {error:uploadError}=await db.storage.from(PUBLIC).upload(path,blob,{contentType:p.mime_type,upsert:false,cacheControl:"3600"});
    if(uploadError)throw uploadError;created.push(path);
    const {error:updateError}=await db.from("work_photos").update({public_path:path}).eq("id",p.id);
    if(updateError)throw updateError;
   }
   const {error:publishError}=await db.from("work_projects").update({status:"published",published_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",job.id).eq("status","awaiting_publish");
   if(publishError)throw publishError;
  }catch(e){
   if(created.length)await db.storage.from(PUBLIC).remove(created);
   await db.from("work_photos").update({public_path:null}).eq("project_id",job.id);
   throw e;
  }
  await say("Your "+job.title+" photos are published on tallandsmallyardwork.com! Text JOB to begin another project.");
  return true;
 }
 if(number>0){
  if(!Number.isSafeInteger(number)||number<1||number>8){await say("Please send up to 8 photos in one text. You can send more in another message.");return true}
  if(!job)job=await createJob(db,"after");
  if(job.status==="awaiting_publish"){
   await say("This job is waiting for POST. Text MORE to add pictures, or HOLD to save it.");return true;
  }
  const n=await countPhotos(db,job.id);
  if(n.total+number>24){await say("This job has a 24-photo limit. Text DONE, or start a new job after publishing.");return true}
  let accepted=0;
  for(let i=0;i<number;i++){
   const existing=await db.from("work_photos").select("id").eq("source_message_sid",form.get("MessageSid")||"").eq("source_photo_index",i).limit(1);
   if(existing.error)throw existing.error;
   if(existing.data?.length){accepted++;continue}
   const raw=form.get("MediaUrl"+i),type=form.get("MediaContentType"+i)||"";
   if(!raw||!["image/jpeg","image/png","image/webp"].includes(type))continue;
   const bytes=await fetchMedia(raw,get("TWILIO_ACCOUNT_SID"),get("TWILIO_AUTH_TOKEN"),5*1024*1024);
   const actual=sniffPhotoType(bytes);
   if(actual!==type)continue;
   const clean=stripPhotoMetadata(bytes,actual);
   const photoId=crypto.randomUUID(),ext=actual==="image/jpeg"?"jpg":actual==="image/png"?"png":"webp";
   const path=job.id+"/"+photoId+"."+ext;
   const {error:uploadError}=await db.storage.from(PRIVATE).upload(path,clean,{contentType:actual,upsert:false,cacheControl:"3600"});
   if(uploadError)throw uploadError;
   const {error:recordError}=await db.from("work_photos").insert({id:photoId,project_id:job.id,photo_type:job.capture_mode,draft_path:path,mime_type:actual,source_message_sid:form.get("MessageSid"),source_photo_index:i});
   if(recordError){await db.storage.from(PRIVATE).remove([path]);throw recordError}
   accepted++;
  }
  if(!accepted){await say("I couldn't save those pictures. Please send JPG, PNG, or WebP images, each smaller than 5 MB.");return true}
  await say("Saved "+accepted+" "+job.capture_mode.toUpperCase()+" picture"+(accepted===1?"":"s")+". Send more, text AFTER or BEFORE to change type, or DONE when ready.");
  return true;
 }
 return false;
}
