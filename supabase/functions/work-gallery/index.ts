// Public, read-only gallery. Never return private staging paths or draft projects.
import { createClient } from "npm:@supabase/supabase-js@2";
const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(async(req)=>{
 const origin=req.headers.get("origin")||"";
 const allowed=["https://tallandsmallyardwork.com","https://www.tallandsmallyardwork.com"];
 const headers={"Content-Type":"application/json","Cache-Control":"public, max-age=60","Access-Control-Allow-Origin":allowed.includes(origin)?origin:allowed[0],"Access-Control-Allow-Methods":"GET, OPTIONS","Vary":"Origin"};
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="GET")return new Response(JSON.stringify({error:"Method not allowed"}),{status:405,headers});
 if(origin&&!allowed.includes(origin))return new Response(JSON.stringify({error:"Forbidden"}),{status:403,headers});
 try{
  const {data:projects,error}=await db.from("work_projects").select("id,title,published_at")
   .eq("status","published").order("published_at",{ascending:false}).limit(24);
  if(error)throw error;
  const out=[];
  for(const p of projects||[]){
   const {data:photos,error:photosError}=await db.from("work_photos")
    .select("photo_type,public_path,created_at").eq("project_id",p.id).order("created_at",{ascending:true});
   if(photosError)throw photosError;
   const visible=(photos||[]).filter(x=>typeof x.public_path==="string"&&x.public_path.length>0).slice(0,24);
   if(!visible.length)continue;
   out.push({title:p.title,published_at:p.published_at,photos:visible.map(x=>({
    type:x.photo_type,url:db.storage.from("yard-project-public").getPublicUrl(x.public_path).data.publicUrl
   }))});
  }
  return new Response(JSON.stringify({projects:out}),{headers});
 }catch(e){console.error("Gallery unavailable",e);return new Response(JSON.stringify({error:"Unable to load gallery"}),{status:500,headers})}
});