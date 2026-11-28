// Receive and validate incoming Twilio SMS replies from David.
// NOT active until a Twilio number, verified webhook URL, and secrets are configured.
// Requires function JWT verification OFF (Twilio posts without Supabase JWT).
import { createClient } from "npm:@supabase/supabase-js@2";
import { parseReplyCommand, twilioSignatureValid } from "./sms-protocol.js";
import { parseSimpleReplyCommand } from "./simple-sms-protocol.js";
import { handlePhotoMessage, isPhotoMessage } from "./photo-handler.js";
const get=(n:string)=>Deno.env.get(n)||"";
const supabase=createClient(get("SUPABASE_URL"),get("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
const xml=(msg:string,status=200)=>new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>',{status,headers:{"Content-Type":"text/xml; charset=utf-8"}});
async function twilioValid(req:Request,form:URLSearchParams){
 return twilioSignatureValid({url:req.url,expectedUrl:get("TWILIO_WEBHOOK_URL"),signature:req.headers.get("X-Twilio-Signature")||"",form,token:get("TWILIO_AUTH_TOKEN")});
}
async function send(to:string,message:string){
 const sid=get("TWILIO_ACCOUNT_SID"),token=get("TWILIO_AUTH_TOKEN"),from=get("TWILIO_FROM_NUMBER");
 if(!sid||!token||!from)throw Error("SMS not configured");
 const {data:budget,error:budgetError}=await supabase.rpc("reserve_review_sms_alert");
 if(budgetError)throw budgetError;
 if(!budget)throw Error("Daily SMS budget reached");
 const body=new URLSearchParams({To:to,From:from,Body:message});
 const res=await fetch("https://api.twilio.com/2010-04-01/Accounts/"+encodeURIComponent(sid)+"/Messages.json",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Authorization:"Basic "+btoa(sid+":"+token)},body});
 if(!res.ok)throw Error("SMS status "+res.status);
}
async function sendSafely(to:string,message:string){
 try {await send(to,message);return true;}
 catch(e){console.error("Outbound SMS notification failed",e);return false;}
}
async function deliverNext(nextId:string){
 const {data:next,error:nextError}=await supabase.from("customer_reviews")
  .select("name,rating,comment").eq("id",nextId).single();
 if(nextError||!next){console.error("Could not load next review",nextError);await supabase.rpc("fail_review_sms_alert",{p_review_id:nextId});return;}
 const sent=await sendSafely(get("DAVID_NOTIFY_NUMBER"),"Next review: "+next.rating+"/5 stars from "+next.name+": "+next.comment.slice(0,180)+".\\n\\nReply naturally, then YES to publish, NO to cancel a draft, or SKIP to move on.");
 if(!sent)await supabase.rpc("fail_review_sms_alert",{p_review_id:nextId});
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 if(!req.headers.get("content-type")?.includes("application/x-www-form-urlencoded"))return new Response("Unsupported Media Type",{status:415});
 if(get("REVIEW_SMS_ENABLED")!=="true"||!get("DAVID_NOTIFY_NUMBER")||!get("TWILIO_FROM_NUMBER")||!get("TWILIO_AUTH_TOKEN")||!get("TWILIO_WEBHOOK_URL"))return new Response("Not configured",{status:503});
 try{
  const form=new URLSearchParams(await req.text());
  if(!await twilioValid(req,form))return new Response("Forbidden",{status:403});
  // Only allow David's exact confirmed number to create public business replies.
  if(form.get("From")!==get("DAVID_NOTIFY_NUMBER")||form.get("To")!==get("TWILIO_FROM_NUMBER"))return xml("");
  const sid=form.get("MessageSid")||"";if(!/^(?:SM|MM)[a-f0-9]{32}$/i.test(sid))return xml("");
  const {error:duplicate}=await supabase.from("review_sms_processed").insert({message_sid:sid});
  if(duplicate){if(duplicate.code==="23505")return xml("");throw duplicate}
  // Help is always available, regardless of an active photo job or review queue.
  // Owner link lives in the website footer rather than in every help SMS.
  const helpText=(form.get("Body")||"").trim().toUpperCase();
  if(helpText==="HELP"||helpText==="COMMANDS"){
   await send(get("DAVID_NOTIFY_NUMBER"),
    `Tall and Small help:\n\nSend a picture to start an AFTER-only job.\nJOB = new BEFORE/AFTER job\nBEFORE / AFTER = choose picture type\nDONE = review photos\nPOST = publish\nMORE = add more photos\nHOLD / RESUME = save / reopen job\nPHOTOS = job photo count\nNAME Backyard Cleanup = rename\nREVIEW = review reply help\n\nOwner Login is at the bottom of the website.");
   return xml("");
  }
  if(helpText==="REVIEW"){
   await send(get("DAVID_NOTIFY_NUMBER"),
    "Customer reviews: When a new review arrives, text your response in your own words. Then reply YES to publish that reply. NO cancels your draft, SKIP moves to the next review. Photo projects use POST instead of YES.");
   return xml("");
  }
  // MMS photographs and explicit photo-job commands are handled independently
  // from the review reply queue, so DONE/POST cannot confirm a customer reply.
  if(isPhotoMessage(form)){
   try {
    await handlePhotoMessage({form,db:supabase,send,get});
    return xml("");
   } catch(error) {
    // Let Twilio retry failed uploads; don't permanently mark a failed MMS handled.
    await supabase.from("review_sms_processed").delete().eq("message_sid",sid);
    throw error;
   }
  }
  const body=(form.get("Body")||"").trim();
  const command=parseReplyCommand(body);
  // Simplified SMS workflow: exactly one active review, with all other reviews queued.
  // This path is feature-gated so existing production code-based replies stay available until tested.
  if(get("REVIEW_SIMPLE_SMS_ENABLED")==="true"){
   const {data:active,error:activeError}=await supabase.from("review_sms_queue").select("review_id").eq("state","active").limit(2);
   if(activeError)throw activeError;
   if(!active||active.length!==1){
    await send(get("DAVID_NOTIFY_NUMBER"),"No active customer review to answer right now.");
    return xml("");
   }
   const reviewId=active[0].review_id;
   const {data:review,error:reviewError}=await supabase.from("customer_reviews").select("id,name,rating,comment,owner_reply,status").eq("id",reviewId).single();
   if(reviewError)throw reviewError;
   if(review.status!=="published"||review.owner_reply){
    await send(get("DAVID_NOTIFY_NUMBER"),"This review is no longer available for a reply. Please contact the website administrator.");
    return xml("");
   }
   const simpleCommand=parseSimpleReplyCommand(body);
   const upper=body.toUpperCase();
   if(simpleCommand.type==="status"){
    await send(get("DAVID_NOTIFY_NUMBER"),"Current review from "+review.name+": "+review.comment.slice(0,160)+". Reply naturally with your message; then YES to publish, NO to cancel a draft, or SKIP to move on.");
    return xml("");
   }
   if(simpleCommand.type==="reserved"){
    // Twilio normally handles these opt-in/opt-out keywords; never publish them as reviews.
    return xml("");
   }
   if(simpleCommand.type==="cancel"){
    const {error:deleteError}=await supabase.from("review_sms_pending").delete().eq("review_id",reviewId);
    if(deleteError)throw deleteError;
    await send(get("DAVID_NOTIFY_NUMBER"),"Draft cancelled. Reply with a new message for "+review.name+" whenever you're ready.");
    return xml("");
   }
   if(simpleCommand.type==="skip"){
    await supabase.from("review_sms_pending").delete().eq("review_id",reviewId);
    const {data:nextId,error:advanceError}=await supabase.rpc("advance_review_sms",{p_review_id:reviewId});
    if(advanceError)throw advanceError;
    await sendSafely(get("DAVID_NOTIFY_NUMBER"),"Skipped "+review.name+"'s review without posting a reply.");
    if(nextId)await deliverNext(nextId);
    return xml("");
   }
   if(simpleCommand.type==="confirm"){
    const {data:pending,error:pendingError}=await supabase.from("review_sms_pending").select("reply_text,expires_at").eq("review_id",reviewId).maybeSingle();
    if(pendingError)throw pendingError;
    if(!pending||new Date(pending.expires_at).getTime()<=Date.now()){
     await send(get("DAVID_NOTIFY_NUMBER"),"There is no active draft, or it expired. Reply with your response to "+review.name+" first.");
     return xml("");
    }
    const {data:updated,error:updateError}=await supabase.from("customer_reviews").update({owner_reply:pending.reply_text,owner_replied_at:new Date().toISOString()}).eq("id",reviewId).is("owner_reply",null).eq("status","published").select("id");
    if(updateError)throw updateError;
    if(!updated?.length){
     await send(get("DAVID_NOTIFY_NUMBER"),"Review changed; reply was not published.");
     return xml("");
    }
    await supabase.from("review_sms_pending").delete().eq("review_id",reviewId);
    const {data:nextId,error:advanceError}=await supabase.rpc("advance_review_sms",{p_review_id:reviewId});
    if(advanceError)throw advanceError;
    await sendSafely(get("DAVID_NOTIFY_NUMBER"),"Your reply to "+review.name+" is now published on the website.");
    if(nextId)await deliverNext(nextId);
    return xml("");
   }
   if(simpleCommand.type!=="draft"){
    await send(get("DAVID_NOTIFY_NUMBER"),"Reply with your own message (1–1000 characters), without a code. Then YES to publish.");
    return xml("");
   }
   const expires=new Date(Date.now()+15*60*1000).toISOString();
   const {error:saveError}=await supabase.from("review_sms_pending").upsert({review_id:reviewId,reply_text:simpleCommand.content,expires_at:expires});
   if(saveError)throw saveError;
   await send(get("DAVID_NOTIFY_NUMBER"),"Preview for "+review.name+": "+simpleCommand.content.slice(0,600)+"\n\nPublish under "+review.name+"'s review? Reply YES within 15 minutes or NO to cancel.");
   return xml("");
  }
  if(command.type==="reply"){
   const {code,content}=command;
   if(!content||content.length>1000){await send(get("DAVID_NOTIFY_NUMBER"),"Reply must be 1–1000 characters. Try: REPLY "+code+" Your response");return xml("")}
   const {data,error}=await supabase.from("customer_reviews").select("id,owner_reply").eq("status","published").eq("review_code",code).limit(2);
   if(error)throw error;
   if(!data||data.length!==1){await send(get("DAVID_NOTIFY_NUMBER"),"Review code not found or ambiguous. Please use the code from the review alert.");return xml("")}
   if(data[0].owner_reply){await send(get("DAVID_NOTIFY_NUMBER"),"This review already has a public reply. To edit it, use the owner dashboard.");return xml("")}
   const expires=new Date(Date.now()+15*60*1000).toISOString();
   const {error:saveError}=await supabase.from("review_sms_pending").upsert({review_id:data[0].id,reply_text:content,expires_at:expires});
   if(saveError)throw saveError;
   await send(get("DAVID_NOTIFY_NUMBER"),"Preview for review "+code+": "+content.slice(0,600)+"\n\nText YES "+code+" within 15 minutes to publish this reply publicly. Otherwise it will not post.");
  }else if(command.type==="confirm"){
   const {code}=command;
   const {data,error}=await supabase.from("customer_reviews").select("id,owner_reply").eq("status","published").eq("review_code",code).limit(2);
   if(error)throw error;
   if(!data||data.length!==1){await send(get("DAVID_NOTIFY_NUMBER"),"Review code not found.");return xml("")}
   const {data:pending,error:pendingError}=await supabase.from("review_sms_pending").select("reply_text,expires_at").eq("review_id",data[0].id).maybeSingle();
   if(pendingError)throw pendingError;
   if(!pending||new Date(pending.expires_at).getTime()<=Date.now()){await send(get("DAVID_NOTIFY_NUMBER"),"No pending reply, or confirmation expired. Send REPLY "+code+" followed by your message again.");return xml("")}
   if(data[0].owner_reply){await send(get("DAVID_NOTIFY_NUMBER"),"This review already has a response. No changes made.");return xml("")}
   const {data:updated,error:updateError}=await supabase.from("customer_reviews").update({owner_reply:pending.reply_text,owner_replied_at:new Date().toISOString()}).eq("id",data[0].id).is("owner_reply",null).eq("status","published").select("id");
   if(updateError)throw updateError;
   await supabase.from("review_sms_pending").delete().eq("review_id",data[0].id);
   await send(get("DAVID_NOTIFY_NUMBER"),updated?.length?"Your reply has been published under review "+code+".":"Unable to publish: review changed or already has a reply.");
  }else{
   await send(get("DAVID_NOTIFY_NUMBER"),"Review replies only: text REPLY <review code> <your message>. You'll receive a confirmation request before publication. Use the code shown in a review alert.");
  }
  return xml("");
 }catch(err){console.error("Inbound reply failure",err);return new Response("Processing error",{status:500})}
});
