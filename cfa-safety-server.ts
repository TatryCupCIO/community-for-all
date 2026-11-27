import postgres from 'npm:postgres@3.4.7';
import {SAFETY_SQL,SUPABASE_CA} from './cfa-safety-install.ts';
export function safetySetupHandler(env:(name:string)=>string|undefined=Deno.env.get,request:typeof fetch=fetch,install?:(url:string)=>Promise<void>){
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'https://tatrycupcio.uk','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'}});
 return async(req:Request)=>{
  if(req.method==='OPTIONS')return reply(200,{ok:true});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  try{
   const base=(env('SUPABASE_URL')||'').replace(/\/$/,'');const anon=env('SUPABASE_ANON_KEY')||'';const service=env('SUPABASE_SERVICE_ROLE_KEY')||'';
   const token=req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
   if(!base||!anon||!token||token.length>8192||token===anon||token===service)return reply(401,{error:'sign_in_required'});
   const auth=await request(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)});
   if(!auth.ok)return reply(401,{error:'sign_in_required'});const user=await auth.json();if(!user?.id||!user.email_confirmed_at)return reply(401,{error:'sign_in_required'});
   const role=await request(base+'/rest/v1/rpc/cfa_is_owner',{method:'POST',headers:{apikey:anon,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
   if(!role.ok||await role.json()!==true)return reply(403,{error:'owner_required'});
   if(Number(req.headers.get('content-length')||0)>1024)return reply(400,{error:'invalid_request'});
   const reader=req.body?.getReader();let text='',length=0;if(reader){const decoder=new TextDecoder();for(;;){const chunk=await reader.read();if(chunk.done)break;length+=chunk.value.length;if(length>1024){await reader.cancel();return reply(400,{error:'invalid_request'});}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}
   let payload;try{payload=JSON.parse(text||'{}')}catch{return reply(400,{error:'invalid_request'});}
   if(payload.action!=='setup')return reply(400,{error:'invalid_request'});
   const url=env('SUPABASE_DB_URL')||'';let parsed;try{parsed=new URL(url)}catch{return reply(500,{error:'database_configuration'});}
   if(!['postgres:','postgresql:'].includes(parsed.protocol)||!parsed.hostname||!parsed.password)return reply(500,{error:'database_configuration'});
   if(install)await install(url);else{
    const db=postgres(url,{max:1,prepare:false,connect_timeout:15,idle_timeout:5,ssl:{rejectUnauthorized:true,ca:SUPABASE_CA}});
    try{await db.unsafe(SAFETY_SQL);}finally{await db.end({timeout:5});}
   }
   return reply(200,{ok:true,version:'2026-11-27.1'});
  }catch(error){const code=typeof(error as {code?:unknown})?.code==='string'?(error as {code:string}).code:'';return reply(500,{error:'setup_failed',code:/^[A-Z0-9]{5}$/.test(code)?code:undefined});}
 };
}
Deno.serve(safetySetupHandler());
