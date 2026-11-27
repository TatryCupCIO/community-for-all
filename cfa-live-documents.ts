// Confirmed live zero-value bookings only. The database remains authoritative.
import nodemailer from 'npm:nodemailer@9.1.1';
import { Buffer } from 'node:buffer';
import { createLiveTicket, createLiveEmail, prepareBilling } from './cfa-live-ticket.ts';
const SITE='https://tatrycupcio.uk';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(code:string):never=>{throw Error(code)};
type Options={env:(name:string)=>string|undefined;fetch?:typeof fetch;transport?:()=>any;pdf?:typeof createLiveTicket};
export function makeLiveDocumentHandler(options:Options){
 const env=options.env,request=options.fetch||fetch;
 const base=(env('SUPABASE_URL')||'').replace(/\/$/,''),service=env('SUPABASE_SERVICE_ROLE_KEY')||'',anon=env('SUPABASE_ANON_KEY')||'';
 let transport:any=null,assetCache:Promise<any>|null=null;
 async function limited(input:Request|Response,max:number){
  const reader=input.body?.getReader();if(!reader)return new Uint8Array();
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;if(length>max){await reader.cancel();fail('invalid_request')}chunks.push(r.value)}
  const result=new Uint8Array(length);let at=0;for(const c of chunks){result.set(c,at);at+=c.length}return result;
 }
 async function json(url:string,init:RequestInit={},code='operation_failed'){
  const r=await request(url,{...init,signal:AbortSignal.timeout(20000)});
  const bytes=await limited(r,2*1024*1024);let data:any;
  try{data=JSON.parse(new TextDecoder().decode(bytes)||'null')}catch{fail(code)}
  if(!r.ok)fail(code);return data;
 }
 async function rpc(name:string,args:any,token?:string){return json(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{
  apikey:token?anon:service,Authorization:'Bearer '+(token||service),'Content-Type':'application/json'},body:JSON.stringify(args)});}
 async function ownState(req:Request,id:string){
  const token=req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if(!token||token.length>8192||token===service||token===anon)fail('sign_in_required');
  const user=await json(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}},'sign_in_required');
  if(!UUID.test(user?.id||'')||!user.email_confirmed_at)fail('sign_in_required');
  const state=await rpc('cfa_live_document_state',{p_booking:id},token);
  if(!state)fail('not_found');return {state,token};
 }
 function mailTransport(){
  if(transport)return transport;if(options.transport)return transport=options.transport();
  const host=env('CFA_SMTP_HOST')?.trim(),port=Number(env('CFA_SMTP_PORT')),user=env('CFA_SMTP_USER')?.trim();
  const pass=env('CFA_SMTP_PASSWORD')?.replace(/\s/g,''),from=env('CFA_MAIL_FROM')?.trim();
  if(!host||![465,587].includes(port)||!user||!pass||!from||!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from))fail('smtp_configuration');
  return transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,
   auth:{user,pass},tls:{minVersion:'TLSv1.2'},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:25000});
 }
 async function assets(){
  if(!assetCache)assetCache=(async()=>{
   async function get(name:string,hash:string){const r=await request(SITE+'/'+name,{signal:AbortSignal.timeout(20000)});if(!r.ok)fail('pdf_assets_unavailable');
    const b=await limited(r,2*1024*1024),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b))).map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==digest)fail('pdf_assets_unavailable');return b;}
   const [regular,bold,logo]=await Promise.all([
    get('cfa-ticket-regular.ttf','ad0d94c6eb341fadb4cd79fc628574ef9b9d7548ea3705a83549072893d61c03'),
    get('cfa-ticket-bold.ttf','73a2f24d2dfe48c0d8b1dbe8773d36733cdac9aa46e3c1ee697c165dbef6fbbf'),
    get('Logo.png','df22592e50b3ceb56ea251d115b3ae75306b4136fcea726f0a85c003382c7f93')]);return {regular,bold,logo};
  })().catch(e=>{assetCache=null;throw e});return assetCache;
 }
 async function document(order:any){
  const a={...await assets()},path=order.snapshot?.event?.display_settings?.ticket_logo_path;
  if(typeof path==='string'&&new RegExp('^events/'+order.snapshot.event.id+'/[a-f0-9-]+\\.(png|jpg)$').test(path)){
   const r=await request(base+'/storage/v1/object/authenticated/event-photos/'+path,{headers:{apikey:service,Authorization:'Bearer '+service},signal:AbortSignal.timeout(15000)});
   if(!r.ok)fail('pdf_assets_unavailable');a.eventLogo=await limited(r,2*1024*1024);
  }
  return (options.pdf||createLiveTicket)(order,a);
 }
 async function deliver(id:string,secret?:string){
  const claim=await rpc('cfa_live_claim_document',{p_booking:id,p_secret:secret||null});
  if(!claim)return;
  const order=claim.document;
  try{
   // Reconcile the display breakdown only; financial state never changes here.
   const url=new URL(base+'/rest/v1/event_options');url.searchParams.set('event_id','eq.'+order.snapshot.event.id);url.searchParams.set('select','*');
   const options=await json(url.href,{headers:{apikey:service,Authorization:'Bearer '+service}});
   order.snapshot.billing_lines=prepareBilling(order.snapshot,options);
   const bytes=await document(order);
   if(!await rpc('cfa_live_pdf_document',{p_booking:id})){
    await rpc('cfa_live_finish_document',{p_booking:id,p_lock:claim.lock_token,p_success:false,p_error:'booking_no_longer_valid'});return;
   }
   const email=createLiveEmail(order);
   const sent=await mailTransport().sendMail({from:env('CFA_MAIL_FROM'),to:order.recipient,replyTo:'app@tatrycupcio.uk',
    subject:email.subject,text:email.text,messageId:'<cfa-live-booking-'+id+'@tatrycupcio.uk>',disableFileAccess:true,disableUrlAccess:true,
    attachments:[{filename:order.ticket_code+'.pdf',content:Buffer.from(bytes),contentType:'application/pdf'}]});
   if(!sent.accepted?.length)fail('smtp_not_accepted');
  }catch{
   transport?.close?.();transport=null;
   await rpc('cfa_live_finish_document',{p_booking:id,p_lock:claim.lock_token,p_success:false,p_error:'document_or_mail_failed'});return;
  }
  // Keep the lease if SMTP accepted but the acknowledgement failed.
  await rpc('cfa_live_finish_document',{p_booking:id,p_lock:claim.lock_token,p_success:true,p_error:null});
 }
 return async(req:Request)=>{
  const origin=req.headers.get('origin'),headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
   'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
  if(origin===SITE||origin==='https://www.tatrycupcio.uk')headers['Access-Control-Allow-Origin']=origin;
  const reply=(code:number,data:any)=>new Response(JSON.stringify(data),{status:code,headers});
  if(origin&&origin!==SITE&&origin!=='https://www.tatrycupcio.uk')return reply(403,{error:'origin_not_allowed'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
  try{
   if(!base||!service||!anon)fail('setup_required');
   let body:any;try{body=JSON.parse(new TextDecoder().decode(await limited(req,4096)))}catch{fail('invalid_request')}
   const id=String(body?.booking_id||'');if(!/^[1-9][0-9]{0,18}$/.test(id))fail('invalid_request');
   if(body.action==='dispatch'){
    if(!UUID.test(body.token||''))fail('invalid_request');
    await deliver(id,body.token);return reply(200,{ok:true});
   }
   if(!['status','pdf'].includes(body.action))fail('invalid_request');
   const {token}=await ownState(req,id);
   if(body.action==='status'){
    await deliver(id);const state=await rpc('cfa_live_document_state',{p_booking:id},token);
    if(!state)fail('not_found');return reply(200,{ok:true,...state});
   }
   const order=await rpc('cfa_live_pdf_document',{p_booking:id});if(!order)fail('not_found');
   const bytes=await document(order);
   // Cancellation may have happened while rendering.
   await ownState(req,id);
   return new Response(new Uint8Array(bytes).buffer,{headers:{...headers,'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="'+order.ticket_code+'.pdf"'}});
  }catch(e){const msg=e instanceof Error?e.message:'';const code=['sign_in_required','not_found','invalid_request','setup_required','smtp_configuration','pdf_assets_unavailable'].includes(msg)?msg:'operation_failed';
   return reply(code==='sign_in_required'?401:code==='not_found'?404:400,{error:code});}
 };
}
if(typeof Deno!=='undefined')Deno.serve(makeLiveDocumentHandler({env:name=>Deno.env.get(name)}));
