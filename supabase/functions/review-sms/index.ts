// Receive and validate incoming Twilio SMS replies from David.
// NOT active until a Twilio number, verified webhook URL, and secrets are configured.
// Requires function JWT verification OFF (Twilio posts without Supabase JWT).
import { createClient } from "npm:@supabase/supabase-js@2";
const get=(n:string)=>Deno.env.get(n)||"";
const supabase=createClient(get("SUPABASE_URL"),get("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false,autoRefreshToken:false}});
const xml=(msg:string,status=200)=>new Response('<?xml version="1.0" encoding="UTF-8"?><Response></Response>',{status,headers:{"Content-Type":"text/xml; charset=utf-8"}});
const byteEqual=(a:string,b:string)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0};
async function twilioValid(req:Request,form:URLSearchParams){
 const token=get("TWILIO_AUTH_TOKEN"),expectedUrl=get("TWILIO_WEBHOOK_URL"),signature=req.headers.get("X-Twilio-Signature")||"";
 // Compare configured exact public URL, including scheme, path, and query parameters.
 if(!token||!expectedUrl||req.url!==expectedUrl||!signature)return false;
 const keys=Array.from(new Set(Array.from(form.keys()))).sort();
 let signedUrl=expectedUrl;for(const key of keys){for(const val of form.getAll(key))signedUrl+=key+val}
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(token),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
 const raw=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(signedUrl));
 const bytes=Array.from(new Uint8Array(raw));const expected=btoa(String.fromCharCode(...bytes));
 return byteEqual(signature,expected);
}
async function send(to:string,message:string){
 const sid=get("TWILIO_ACCOUNT_SID"),token=get("TWILIO_AUTH_TOKEN"),from=get("TWILIO_FROM_NUMBER");
 if(!sid||!token||!from)throw Error("SMS not configured");
 const body=new URLSearchParams({To:to,From:from,Body:message});
 const res=await fetch("https://api.twilio.com/2010-04-01/Accounts/"+encodeURIComponent(sid)+"/Messages.json",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded",Authorization:"Basic "+btoa(sid+":"+token)},body});
 if(!res.ok)throw Error("SMS status "+res.status);
}
Deno.serve(async(req)=>{
 if(req.method!=="POST")return new Response("Method not allowed",{status:405});
 if(!req.headers.get("content-type")?.includes("application/x-www-form-urlencoded"))return new Response("Unsupported Media Type",{status:415});
 if(!get("DAVID_NOTIFY_NUMBER")||!get("TWILIO_FROM_NUMBER")||!get("TWILIO_AUTH_TOKEN")||!get("TWILIO_WEBHOOK_URL"))return new Response("Not configured",{status:503});
 try{
  const form=new URLSearchParams(await req.text());
  if(!await twilioValid(req,form))return new Response("Forbidden",{status:403});
  // Only allow David's exact confirmed number to create public business replies.
  if(form.get("From")!==get("DAVID_NOTIFY_NUMBER")||form.get("To")!==get("TWILIO_FROM_NUMBER"))return xml("");
  const sid=form.get("MessageSid")||"";if(!/^SM[a-f0-9]{32}$/i.test(sid))return xml("");
  const {error:duplicate}=await supabase.from("review_sms_processed").insert({message_sid:sid});
  if(duplicate){if(duplicate.code==="23505")return xml("");throw duplicate}
  const body=(form.get("Body")||"").trim();
  const reply=body.match(/^REPLY\s+([0-9a-f]{8})\s+([\s\S]+)$/i);
  const confirm=body.match(/^YES\s+([0-9a-f]{8})$/i);
  if(reply){
   const code=reply[1].toLowerCase(),content=reply[2].trim();
   if(!content||content.length>1000){await send(get("DAVID_NOTIFY_NUMBER"),"Reply must be 1–1000 characters. Try: REPLY "+code+" Your response");return xml("")}
   const {data,error}=await supabase.from("customer_reviews").select("id,owner_reply").eq("status","published").like("id",code+"%").limit(2);
   if(error)throw error;
   if(!data||data.length!==1){await send(get("DAVID_NOTIFY_NUMBER"),"Review code not found or ambiguous. Please use the code from the review alert.");return xml("")}
   // Upsert only if review has no existing reply; existing replies require owner portal.
   if(data[0].owner_reply){await send(get("DAVID_NOTIFY_NUMBER"),"This review already has a public reply. To edit it, use the owner dashboard.");return xml("")}
   const expires=new Date(Date.now()+15*60*1000).toISOString();
   const {error:saveError}=await supabase.from("review_sms_pending").upsert({review_id:data[0].id,reply_text:content,expires_at:expires});
   if(saveError)throw saveError;
   await send(get("DAVID_NOTIFY_NUMBER"),"Preview for review "+code+": "+content.slice(0,600)+"\n\nText YES "+code+" within 15 minutes to publish this reply publicly. Otherwise it will not post.");
  }else if(confirm){
   const code=confirm[1].toLowerCase();
   const {data,error}=await supabase.from("customer_reviews").select("id,owner_reply").eq("status","published").like("id",code+"%").limit(2);
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
