// Read-only production payment readiness and cancellation confirmation mail.
// This module neither creates a payment nor requests a refund.
import nodemailer from 'npm:nodemailer@9.1.1';
const SITE='https://tatrycupcio.uk',UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(message:string):never=>{throw Error(message)};
type Options={env:(name:string)=>string|undefined;fetch?:typeof fetch;transport?:()=>any};
export function makeFinanceHandler(options:Options){
 const env=options.env,request=options.fetch||fetch,base=(env('SUPABASE_URL')||'').replace(/\/$/,''),service=env('SUPABASE_SERVICE_ROLE_KEY')||'',anon=env('SUPABASE_ANON_KEY')||'';let transport:any=null;
 async function limited(input:Request|Response,max:number){const reader=input.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();fail('invalid_request')}chunks.push(r.value)}const all=new Uint8Array(size);let at=0;for(const c of chunks){all.set(c,at);at+=c.length}return all;}
 async function json(url:string,init:RequestInit={},error='operation_failed'){const r=await request(url,{...init,signal:AbortSignal.timeout(20000)});const bytes=await limited(r,256*1024);let data:any;try{data=JSON.parse(new TextDecoder().decode(bytes)||'null')}catch{fail(error)}if(!r.ok)fail(error);return data;}
 async function rpc(name:string,args:any,token?:string){return json(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:token?anon:service,Authorization:'Bearer '+(token||service),'Content-Type':'application/json'},body:JSON.stringify(args)});}
 async function owner(req:Request){const token=req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];if(!token||token.length>8192||token===service||token===anon)fail('sign_in_required');const user=await json(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}},'sign_in_required');if(!UUID.test(user?.id||'')||!user.email_confirmed_at)fail('sign_in_required');if(await rpc('cfa_is_owner',{},token)!==true)fail('owner_required');}
 function mailTransport(){if(transport)return transport;if(options.transport)return transport=options.transport();const host=env('CFA_SMTP_HOST')?.trim(),port=Number(env('CFA_SMTP_PORT')),user=env('CFA_SMTP_USER')?.trim(),pass=env('CFA_SMTP_PASSWORD')?.replace(/\s/g,''),from=env('CFA_MAIL_FROM')?.trim();if(!host||![465,587].includes(port)||!user||!pass||!from||!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from))fail('smtp_configuration');return transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,auth:{user,pass},tls:{minVersion:'TLSv1.2'},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:25000});}
 async function deliver(id:string,secret?:string){const claim=await rpc('cfa_cancel_claim_mail',{p_id:id,p_secret:secret||null});if(!claim)return;try{const sent=await mailTransport().sendMail({from:env('CFA_MAIL_FROM'),to:claim.recipient,replyTo:'app@tatrycupcio.uk',subject:'Booking cancelled / Rezervácia zrušená',text:claim.body,messageId:'<cfa-cancel-'+claim.id+'@tatrycupcio.uk>',disableFileAccess:true,disableUrlAccess:true});if(!sent.accepted?.length)throw Error();}catch{transport?.close?.();transport=null;await rpc('cfa_cancel_finish_mail',{p_id:id,p_lock:claim.lock_token,p_success:false});return;}await rpc('cfa_cancel_finish_mail',{p_id:id,p_lock:claim.lock_token,p_success:true});}
 return async(req:Request)=>{const origin=req.headers.get('origin'),headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};if(origin===SITE||origin==='https://www.tatrycupcio.uk')headers['Access-Control-Allow-Origin']=origin;const reply=(status:number,data:any)=>new Response(JSON.stringify(data),{status,headers});if(origin&&origin!==SITE&&origin!=='https://www.tatrycupcio.uk')return reply(403,{error:'origin_not_allowed'});if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
 try{if(!base||!service||!anon)fail('server_configuration');let body:any;try{body=JSON.parse(new TextDecoder().decode(await limited(req,4096)))}catch{fail('invalid_request')}
 if(body?.action==='cancellation_mail'){if(!UUID.test(body.id||'')||!UUID.test(body.token||''))fail('invalid_request');await deliver(body.id,body.token);return reply(200,{ok:true});}
 await owner(req);
 if(body?.action==='cancellation_status'){if(!UUID.test(body.id||''))fail('invalid_request');await deliver(body.id);const u=new URL(base+'/rest/v1/cfa_booking_cancellations');u.searchParams.set('id','eq.'+body.id);u.searchParams.set('select','mail_state,sent_at');const rows=await json(u.href,{headers:{apikey:service,Authorization:'Bearer '+service}});if(!rows?.[0])fail('not_found');return reply(200,{ok:true,...rows[0]});}
 if(body?.action==='check'){
 const access=env('SQUARE_PRODUCTION_ACCESS_TOKEN')?.trim(),loc=env('SQUARE_PRODUCTION_LOCATION_ID')?.trim();
 const present={access_token_present:!!access,location_id_present:!!loc};
 if(!access||!loc)return reply(200,{ok:true,environment:'production',payment_created:false,...present,connection_ready:false,checkout_enabled:false});
 if(!/^[A-Za-z0-9_-]{1,192}$/.test(loc))fail('production_location_invalid');
 const result=await json('https://connect.squareup.com/v2/locations/'+encodeURIComponent(loc),{headers:{Authorization:'Bearer '+access,'Square-Version':'2026-11-18'}},'production_connection_failed');
 const l=result.location;if(!l||l.id!==loc||l.status!=='ACTIVE'||l.currency!=='GBP'||l.country!=='GB')fail('production_location_invalid');
 const cardReady=Array.isArray(l.capabilities)&&l.capabilities.includes('CREDIT_CARD_PROCESSING');
 return reply(200,{ok:true,environment:'production',payment_created:false,...present,connection_ready:true,card_processing_ready:cardReady,checkout_enabled:false,business_name:String(l.business_name||l.name||''),currency:l.currency,country:l.country});
 }
 return reply(400,{error:'invalid_request'});
 }catch(e){const message=e instanceof Error?e.message:'';const code=['sign_in_required','owner_required','server_configuration','smtp_configuration','invalid_request','not_found','production_connection_failed','production_location_invalid'].includes(message)?message:'operation_failed';return reply(code==='sign_in_required'?401:code==='owner_required'?403:400,{error:code});}
 };
}
if(typeof Deno!=='undefined')Deno.serve(makeFinanceHandler({env:name=>Deno.env.get(name)}));
