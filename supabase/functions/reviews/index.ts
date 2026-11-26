// Supabase Edge Function: reviews
// Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// PUBLIC_SITE_ORIGIN, REVIEW_OWNER_USER_ID, optional TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, DAVID_NOTIFY_NUMBER.
// Authenticated owner actions require a valid Supabase JWT.
// Deploy with JWT verification disabled only if endpoint authentication is enforced below.
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateReviewInput } from "./review-validation.js";
const url=Deno.env.get("SUPABASE_URL")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const origin=Deno.env.get("PUBLIC_SITE_ORIGIN") ?? "https://tallandsmallyardwork.com";
const db=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, content-type, apikey","Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function notifyDavid(r:{id:string,review_code:string,name:string,rating:number,comment:string}){
 if(Deno.env.get("REVIEW_SMS_ENABLED")!=="true")return false;
 const sid=Deno.env.get("TWILIO_ACCOUNT_SID"), token=Deno.env.get("TWILIO_AUTH_TOKEN"), from=Deno.env.get("TWILIO_FROM_NUMBER"), to=Deno.env.get("DAVID_NOTIFY_NUMBER");
 if(!sid||!token||!from||!to)return false;
 const {data:budget,error:budgetError}=await db.rpc("reserve_review_sms_alert");
 if(budgetError)throw budgetError;
 if(!budget)throw Error("Daily SMS budget reached");
 const body=new URLSearchParams({From:from,To:to,Body:`Tall and Small review ${r.review_code}: ${r.rating}/5 stars from ${r.name}: ${r.comment.slice(0,180)}.\n\nReply by text: REPLY ${r.review_code} Your message\nThen confirm with YES ${r.review_code}. Review replies only.`});
 const res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{method:"POST",headers:{Authorization:"Basic "+btoa(sid+":"+token),"Content-Type":"application/x-www-form-urlencoded"},body});
 if(!res.ok)throw new Error("SMS provider returned "+res.status);
 return true;
}

async function verifyHuman(token:string,ip:string){
 const secret=Deno.env.get("TURNSTILE_SECRET_KEY");
 if(!secret||!token||token.length>2048)return false;
 const body=new URLSearchParams({secret,response:token});
 if(ip)body.set("remoteip",ip);
 const response=await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body,signal:AbortSignal.timeout(8000)});
 if(!response.ok)return false;
 const verification=await response.json();
 return verification.success===true && (verification.hostname==="tallandsmallyardwork.com"||verification.hostname==="www.tallandsmallyardwork.com");
}
async function hmacNetwork(ip:string){
 const salt=Deno.env.get("REVIEW_RATE_SALT");
 if(!salt||salt.length<24||!ip)return "";
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(salt),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const bytes=new Uint8Array(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(ip)));
 return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.headers.get("origin")&&req.headers.get("origin")!==origin)return reply({error:"Origin not permitted"},403);
 try{
  if(req.method==="GET"){
   const {data,error}=await db.from("customer_reviews").select("id,name,rating,comment,owner_reply,created_at,owner_replied_at").eq("status","published").order("created_at",{ascending:false}).limit(60);
   if(error)throw error;return reply({reviews:data});
  }
  if(req.method==="POST"){
   if(!req.headers.get("content-type")?.toLowerCase().includes("application/json"))return reply({error:"JSON required"},415);
   if(Number(req.headers.get("content-length")||"0")>6000)return reply({error:"Review too long"},413);
   let j:unknown;
   try{const raw=await req.text();if(raw.length>6000)return reply({error:"Review too long"},413);j=JSON.parse(raw)}catch{return reply({error:"Invalid review"},400)}
   if(!j||typeof j!=="object"||Array.isArray(j))return reply({error:"Invalid review"},400);
   const body=j as Record<string,unknown>;
   // Honeypot, CAPTCHA verification, and atomic per-network rate limiting.
   if(body.website)return reply({ok:true});
   const parsed=validateReviewInput(body);
   if(!parsed.ok)return reply({error:"Invalid review"},400);
   const {name,rating,comment}=parsed.value;
   // Keep the public review service off until its spam controls are configured and tested.
   if(Deno.env.get("REVIEW_SUBMISSIONS_ENABLED")!=="true")return reply({error:"Reviews are not accepting submissions yet"},503);
   const rateSalt=Deno.env.get("REVIEW_RATE_SALT")||"";
   if(!Deno.env.get("TURNSTILE_SECRET_KEY")||rateSalt.length<32)return reply({error:"Review submissions are not fully configured"},503);
   const ip=(req.headers.get("cf-connecting-ip")||"").trim();
   if(!ip)return reply({error:"Review submissions are temporarily unavailable"},503);
   if(!await verifyHuman(String(body.turnstile_token||""),ip))return reply({error:"Please complete the anti-spam check"},400);
   const networkKey=await hmacNetwork(ip);
   if(!networkKey)return reply({error:"Review submissions not fully configured"},503);
   const {data:allowed,error:rateError}=await db.rpc("take_review_rate_slot",{p_network_key:networkKey});
   if(rateError)throw rateError;
   if(!allowed)return reply({error:"Too many review submissions; please try again later"},429);
   const {data,error}=await db.from("customer_reviews").insert({name,comment,rating,status:"published"}).select("id,review_code").single();
   if(error)throw error;
   try{await notifyDavid({id:data.id,review_code:data.review_code,name,rating,comment})}catch(e){console.error("Review SMS failed",e)}
   return reply({ok:true},201);
  }
  if(req.method==="PATCH"){
   const bearer=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
   const {data:{user},error}=await db.auth.getUser(bearer);
   if(error||!user||user.id!==Deno.env.get("REVIEW_OWNER_USER_ID"))return reply({error:"Unauthorized"},401);
   const j=await req.json(),id=String(j.id||"");
   if(!/^[0-9a-f-]{36}$/i.test(id))return reply({error:"Invalid review id"},400);
   const updates:Record<string,unknown>={};
   if(typeof j.owner_reply==="string"){if(j.owner_reply.length>1000)return reply({error:"Reply too long"},400);updates.owner_reply=j.owner_reply.trim();updates.owner_replied_at=new Date().toISOString()}
   if(j.status==="hidden"||j.status==="published")updates.status=j.status;
   if(!Object.keys(updates).length)return reply({error:"No changes"},400);
   const {error:dbError}=await db.from("customer_reviews").update(updates).eq("id",id);
   if(dbError)throw dbError;
   return reply({ok:true});
  }
  return reply({error:"Method not allowed"},405);
 }catch(e){console.error(e);return reply({error:"Unable to complete request"},500)}
});
