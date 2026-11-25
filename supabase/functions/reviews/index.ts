// Supabase Edge Function: reviews
// Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// PUBLIC_SITE_ORIGIN, REVIEW_OWNER_USER_ID, optional TWILIO_ACCOUNT_SID,
// TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, DAVID_NOTIFY_NUMBER.
// Authenticated owner actions require a valid Supabase JWT.
// Deploy with JWT verification disabled only if endpoint authentication is enforced below.
import { createClient } from "npm:@supabase/supabase-js@2";
const url=Deno.env.get("SUPABASE_URL")!;
const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const origin=Deno.env.get("PUBLIC_SITE_ORIGIN") ?? "https://tallandsmallyardwork.com";
const db=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
const headers={"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, content-type, apikey","Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
async function notifyDavid(r:{name:string,rating:number,comment:string}){
 const sid=Deno.env.get("TWILIO_ACCOUNT_SID"), token=Deno.env.get("TWILIO_AUTH_TOKEN"), from=Deno.env.get("TWILIO_FROM_NUMBER"), to=Deno.env.get("DAVID_NOTIFY_NUMBER");
 if(!sid||!token||!from||!to)return false;
 const body=new URLSearchParams({From:from,To:to,Body:`Tall and Small received a new review: ${r.rating}/5 from ${r.name}: ${r.comment.slice(0,220)}. Sign in to the owner dashboard to reply.`});
 const res=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{method:"POST",headers:{Authorization:"Basic "+btoa(sid+":"+token),"Content-Type":"application/x-www-form-urlencoded"},body});
 if(!res.ok)throw new Error("SMS provider returned "+res.status);
 return true;
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
   const j=await req.json();
   // Honeypot plus input validation. Add CAPTCHA and IP rate limiting before public launch.
   if(j.website)return reply({ok:true});
   const name=String(j.name??"").trim(),comment=String(j.comment??"").trim(),rating=Number(j.rating);
   if(name.length<1||name.length>60||comment.length<10||comment.length>1000||!Number.isInteger(rating)||rating<1||rating>5)return reply({error:"Invalid review"},400);
   // The Edge Function is not production-ready without rate limiting/CAPTCHA.
   if(Deno.env.get("REVIEW_SUBMISSIONS_ENABLED")!=="true")return reply({error:"Reviews are not accepting submissions yet"},503);
   const {data,error}=await db.from("customer_reviews").insert({name,comment,rating,status:"published"}).select("id").single();
   if(error)throw error;
   const customer_contact=String(j.contact??"").trim();
   if(customer_contact&&customer_contact.length<=150&&j.contact_permission===true)await db.from("review_contacts").insert({review_id:data.id,customer_contact,contact_permission:true});
   try{await notifyDavid({name,rating,comment})}catch(e){console.error("Review SMS failed",e)}
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
