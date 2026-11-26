// @ts-types="npm:@types/nodemailer@8.0.2"
import nodemailer from 'npm:nodemailer@9.1.1';
import { Buffer } from 'node:buffer';
import postgres from 'npm:postgres@3.4.7';
import { createTestTicket, createTestEmail } from './cfa-sandbox-ticket.ts';
import { INSTALL_SQL, SUPABASE_CA } from './cfa-sandbox-install.ts';

const SITE='https://tatrycupcio.uk';
const SQUARE='https://connect.squareupsandbox.com';
const VERSION='2026-11-18';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9_-]{1,192}$/;
const SAFE=new Set(['invalid_request','sign_in_required','test_access_required','owner_required',
 'verified_email_required','cart_unavailable','event_unavailable','cart_items_invalid','cart_total_invalid',
 'test_rate_limit','payment_mismatch','checkout_expired','setup_required','database_operation_failed',
 'square_unavailable','smtp_configuration','smtp_unavailable','pdf_assets_unavailable','mail_pending',
 'verified_account_not_found','webhook_setup_failed','webhook_gateway_blocked','installation_failed','not_found']);
type Options={env:(name:string)=>string|undefined;fetch?:typeof fetch;
  pdf?:typeof createTestTicket;transport?:()=>any;install?:()=>Promise<void>};
const fail=(code:string):never=>{throw new Error(code)};
async function limited(input:Request|Response,max:number):Promise<Uint8Array>{
  const reader=input.body?.getReader();if(!reader)return new Uint8Array();
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const r=await reader.read();if(r.done)break;length+=r.value.length;
    if(length>max){await reader.cancel();fail('invalid_request')}chunks.push(r.value)}
  const result=new Uint8Array(length);let i=0;for(const c of chunks){result.set(c,i);i+=c.length}return result;
}
export function ticketPoints(snapshot:any):number{
  return (snapshot.items||[]).reduce((n:number,i:any)=>{
    if(i.category!=='ticket'||!(Number(i.unit_price)>0)||!(Number(i.line_total)>0))return n;
    const quantity=Number(i.quantity);if(!Number.isSafeInteger(quantity)||quantity<1)return n;
    const free=Array.isArray(i.child_ages)&&i.child_ages.length===quantity?i.child_ages.filter((a:number)=>a<5).length:0;
    return n+Math.max(0,quantity-free);
  },0);
}
export async function validSignature(key:string,url:string,raw:string,signature:string):Promise<boolean>{
  if(!key||!/^[A-Za-z0-9+/]{43}=$/.test(signature))return false;
  const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  try{return await crypto.subtle.verify('HMAC',k,Uint8Array.from(atob(signature),c=>c.charCodeAt(0)),new TextEncoder().encode(url+raw))}catch{return false}
}
export function makeSandboxHandler(options:Options){
  const env=options.env,request=options.fetch||fetch,pdf=options.pdf||createTestTicket;
  const base=(env('SUPABASE_URL')||'').replace(/\/$/,'');
  const service=env('SUPABASE_SERVICE_ROLE_KEY')||'',anon=env('SUPABASE_ANON_KEY')||'';
  const webhookURL=base+'/functions/v1/cfa-booking-sandbox?square-webhook=1';
  let assetCache:Promise<any>|null=null,transport:any=null;
  async function json(url:string,init:RequestInit={},error='database_operation_failed'){
    const r=await request(url,{...init,signal:AbortSignal.timeout(18000)});
    const bytes=await limited(r,2*1024*1024);let data:any;
    try{data=JSON.parse(new TextDecoder().decode(bytes)||'null')}catch{fail(error)}
    if(!r.ok){const message=String(data?.message||'');fail(SAFE.has(message)?message:error)}return data;
  }
  function db(table:string,method='GET',params:Record<string,string>={},body?:any){
    const u=new URL(base+'/rest/v1/'+table);for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);
    return json(u.href,{method,headers:{apikey:service,Authorization:'Bearer '+service,
      'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
  }
  async function rpc(name:string,args:any,token?:string){
    return json(base+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:token?anon:service,
      Authorization:'Bearer '+(token||service),'Content-Type':'application/json'},body:JSON.stringify(args)});
  }
  async function square(path:string,method='GET',body?:any){
    const token=env('SQUARE_SANDBOX_ACCESS_TOKEN');if(!token)fail('setup_required');
    return json(SQUARE+path,{method,headers:{Authorization:'Bearer '+token,'Square-Version':VERSION,
      'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)},'square_unavailable');
  }
  async function settings(){return (await db('cfa_test_settings','GET',{id:'eq.true',select:'*'}))?.[0]||fail('setup_required')}
  async function authenticate(req:Request){
    const token=req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
    if(!token||token.length>8192||token===service||token===anon)fail('sign_in_required');
    const u=await json(base+'/auth/v1/user',{headers:{apikey:anon,Authorization:'Bearer '+token}},'sign_in_required');
    if(!UUID.test(u?.id||'')||!u.email_confirmed_at)fail('sign_in_required');
    const member=await db('cfa_test_access','GET',{user_id:'eq.'+u.id,select:'user_id'});
    if(!member?.length){
      if(await rpc('cfa_is_owner',{},token)!==true)fail('test_access_required');
      await rpc('cfa_allow_test_account',{p_email:u.email},token);
    }
    return {token,user:u};
  }
  async function ownOrder(id:string,user?:string){
    if(!UUID.test(id||''))fail('invalid_request');
    const params:Record<string,string>={id:'eq.'+id,select:'*'};if(user)params.user_id='eq.'+user;
    const s=(await db('cfa_test_checkouts','GET',params))?.[0];if(!s)fail('not_found');return s;
  }
  function mailTransport(){
    if(transport)return transport;
    if(options.transport)return transport=options.transport();
    const host=env('CFA_SMTP_HOST')?.trim(),port=Number(env('CFA_SMTP_PORT'));
    const user=env('CFA_SMTP_USER')?.trim(),pass=env('CFA_SMTP_PASSWORD')?.replace(/\s/g,'');
    const from=env('CFA_MAIL_FROM')?.trim();
    if(!host||!user||!pass||![465,587].includes(port)||!from||!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from))fail('smtp_configuration');
    return transport=nodemailer.createTransport({host,port,secure:port===465,requireTLS:port===587,
      auth:{user,pass},tls:{minVersion:'TLSv1.2'},connectionTimeout:15000,greetingTimeout:15000,socketTimeout:25000});
  }
  async function smtpReady(){
    try{await mailTransport().verify()}catch(e){
      transport?.close?.();transport=null;
      if(e instanceof Error&&e.message==='smtp_configuration')throw e;fail('smtp_unavailable');
    }
  }
  async function assets(){
    if(!assetCache)assetCache=(async()=>{
      async function get(name:string,hash:string){
        const r=await request(SITE+'/'+name,{signal:AbortSignal.timeout(20000)});if(!r.ok)fail('pdf_assets_unavailable');
        const b=await limited(r,2*1024*1024);
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(b).buffer))).map(x=>x.toString(16).padStart(2,'0')).join('');
        if(digest!==hash)fail('pdf_assets_unavailable');return b;
      }
      const [regular,bold,logo]=await Promise.all([
        get('cfa-ticket-regular.ttf','ad0d94c6eb341fadb4cd79fc628574ef9b9d7548ea3705a83549072893d61c03'),
        get('cfa-ticket-bold.ttf','73a2f24d2dfe48c0d8b1dbe8773d36733cdac9aa46e3c1ee697c165dbef6fbbf'),
        get('Logo.png','df22592e50b3ceb56ea251d115b3ae75306b4136fcea726f0a85c003382c7f93')]);
      return {regular,bold,logo};
    })().catch(e=>{assetCache=null;throw e});return assetCache;
  }
  async function document(s:any){
    const a={...await assets()};
    const path=s.snapshot?.event?.display_settings?.ticket_logo_path;
    if(typeof path==='string'&&new RegExp('^events/'+s.snapshot.event.id+'/[a-f0-9-]+\\.(png|jpg)$').test(path)){
      const r=await request(base+'/storage/v1/object/authenticated/event-photos/'+path,{headers:{apikey:service,Authorization:'Bearer '+service},signal:AbortSignal.timeout(15000)});
      if(!r.ok)fail('pdf_assets_unavailable');a.eventLogo=await limited(r,2*1024*1024);
    }
    return pdf(s,a);
  }
  async function deliver(id:string):Promise<string>{
    const claim=await rpc('cfa_test_claim_mail',{p_checkout_id:id});
    if(!claim)return (await db('cfa_test_mail','GET',{checkout_id:'eq.'+id,select:'status'}))?.[0]?.status||'pending';
    const s=claim.checkout;
    let bytes:Uint8Array;
    try{bytes=await document(s)}catch{
      await rpc('cfa_test_finish_mail',{p_checkout_id:id,p_lock_token:claim.lock_token,p_success:false,p_error:'pdf_failed'});return 'failed';
    }
    try{
      const fresh=await ownOrder(id);if(fresh.status!=='paid')return 'void';
      const email=createTestEmail(s,ticketPoints(s.snapshot));
      const sent=await mailTransport().sendMail({
        from:env('CFA_MAIL_FROM'),to:s.recipient,replyTo:'app@tatrycupcio.uk',
        subject:email.subject,
        text:email.text,messageId:'<cfa-test-'+s.id+'@tatrycupcio.uk>',
        disableFileAccess:true,disableUrlAccess:true,
        attachments:[{filename:s.ticket_code+'.pdf',content:Buffer.from(bytes),contentType:'application/pdf'}]});
      if(!sent.accepted?.length)throw new Error('not_accepted');
    }catch{
      transport?.close?.();transport=null;
      await rpc('cfa_test_finish_mail',{p_checkout_id:id,p_lock_token:claim.lock_token,p_success:false,p_error:'smtp_failed'});return 'failed';
    }
    // If SMTP accepted but the acknowledgement fails, preserve the lease for recovery.
    const acknowledged=await rpc('cfa_test_finish_mail',{p_checkout_id:id,p_lock_token:claim.lock_token,p_success:true,p_error:null});
    return acknowledged?'sent':'pending';
  }
  async function applyPayment(paymentId:string){
    if(!ID.test(paymentId))fail('invalid_request');
    const {payment:p}=await square('/v2/payments/'+paymentId);
    if(!p?.order_id||p.status!=='COMPLETED')return null;
    const s=(await db('cfa_test_checkouts','GET',{square_order_id:'eq.'+p.order_id,select:'*'}))?.[0];
    if(!s)return null;
    const money=p.total_money||p.amount_money;
    if(!money||!Number.isSafeInteger(money.amount)||p.tip_money?.amount>0||p.location_id!==s.square_location_id
      ||p.amount_money?.currency!=='GBP'||p.amount_money?.amount!==s.expected_pence)fail('payment_mismatch');
    const refunded=p.refunded_money?.amount||0;
    if(p.refunded_money&&p.refunded_money.currency!=='GBP')fail('payment_mismatch');
    await rpc('cfa_test_accept_payment',{p_checkout_id:s.id,p_order:p.order_id,p_payment:p.id,
      p_location:p.location_id,p_pence:money.amount,p_currency:money.currency,p_refunded:refunded});
    const mail=await deliver(s.id);return {id:s.id,mail};
  }
  async function sync(s:any){
    if(s.square_payment_id)await applyPayment(s.square_payment_id);
    else if(s.square_order_id){
      const {order:o}=await square('/v2/orders/'+encodeURIComponent(s.square_order_id));
      if(o?.id!==s.square_order_id||o?.location_id!==s.square_location_id)fail('payment_mismatch');
      for(const tender of o.tenders||[])if(tender.payment_id)await applyPayment(tender.payment_id);
    }
    return ownOrder(s.id);
  }
  async function setup(){
    let installed=false;try{installed=(await settings()).schema_version===1}catch{}
    if(!installed&&options.install)await options.install();
    else if(!installed){
      const url=env('SUPABASE_DB_URL')||'';if(!url)fail('installation_failed');
      let connection:ReturnType<typeof postgres>|null=null;
      try{
        const parsed=new URL(url);
        if(!['postgres:','postgresql:'].includes(parsed.protocol))fail('installation_failed');
        parsed.searchParams.delete('sslmode');
        connection=postgres(parsed.href,{ssl:{rejectUnauthorized:true,ca:SUPABASE_CA,minVersion:'TLSv1.2'},
          max:1,prepare:false,connect_timeout:10,idle_timeout:5});
        await connection.unsafe(INSTALL_SQL);
      }catch{fail('installation_failed')}
      finally{if(connection)await connection.end({timeout:2}).catch(()=>{})}
    }
    let config:any=null;
    for(let attempt=0;attempt<8;attempt++){
      try{const value=await settings();if(value.schema_version===1){config=value;break}}catch{}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    if(!config)fail('installation_failed');
    await rpc('cfa_test_ticket_points',{p_user:'00000000-0000-0000-0000-000000000000'});
    const loc=env('SQUARE_SANDBOX_LOCATION_ID')?.trim();if(!loc||!ID.test(loc))fail('setup_required');
    const {location}=await square('/v2/locations/'+loc);
    if(location?.id!==loc||location.status!=='ACTIVE'||location.currency!=='GBP'||location.country!=='GB')fail('setup_required');
    await assets();
    await smtpReady();
    const created=await square('/v2/webhooks/subscriptions','POST',{
      idempotency_key:config.setup_id,subscription:{name:'CFA complete sandbox test',enabled:true,
        event_types:['payment.created','payment.updated','refund.created','refund.updated'],
        notification_url:webhookURL,api_version:VERSION}});
    const sub=created.subscription;
    if(!sub?.id||!sub.signature_key||sub.notification_url!==webhookURL)fail('webhook_setup_failed');
    await db('cfa_test_settings','PATCH',{id:'eq.true'},{webhook_id:sub.id,webhook_key:sub.signature_key,
      notification_url:webhookURL,configured_at:null});
    const probe=JSON.stringify({type:'cfa.health',event_id:config.setup_id});
    const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(sub.signature_key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
    const signed=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(webhookURL+probe)));
    const signature=btoa(String.fromCharCode(...signed));
    const checked=await json(webhookURL,{method:'POST',headers:{'Content-Type':'application/json',
      'x-square-hmacsha256-signature':signature},body:probe},'webhook_gateway_blocked');
    if(checked?.ok!==true)fail('webhook_gateway_blocked');
    await db('cfa_test_settings','PATCH',{id:'eq.true'},{configured_at:new Date().toISOString()});
    return {ok:true,environment:'sandbox',ready:true};
  }
  return async(req:Request):Promise<Response>=>{
    const origin=req.headers.get('origin');
    const headers:Record<string,string>={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
      Vary:'Origin','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
    if(origin===SITE||origin==='https://www.tatrycupcio.uk')headers['Access-Control-Allow-Origin']=origin;
    const reply=(status:number,data:any)=>new Response(JSON.stringify(data),{status,headers});
    if(origin&&origin!==SITE&&origin!=='https://www.tatrycupcio.uk')return reply(403,{error:'origin_not_allowed'});
    if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(req.method!=='POST')return reply(405,{error:'method_not_allowed'});
    const isWebhook=new URL(req.url).searchParams.get('square-webhook')==='1';
    try{
      if(!base||!service||!anon)fail('setup_required');
      const webhook=isWebhook;
      const raw=new TextDecoder().decode(await limited(req,webhook?256*1024:4096));
      if(webhook){
        const config=await settings();
        if(config.notification_url!==webhookURL||!await validSignature(config.webhook_key,webhookURL,raw,req.headers.get('x-square-hmacsha256-signature')||''))return reply(403,{error:'signature_invalid'});
        let event:any;try{event=JSON.parse(raw)}catch{return reply(400,{error:'invalid_request'})}
        let id:string|undefined;
        if(['payment.created','payment.updated'].includes(event.type))id=event.data?.object?.payment?.id;
        if(['refund.created','refund.updated'].includes(event.type))id=event.data?.object?.refund?.payment_id;
        const result=id?await applyPayment(id):null;
        if(result&&['failed','pending','sending'].includes(result.mail))return reply(503,{error:'mail_pending'});
        return reply(200,{ok:true});
      }
      const {token,user}=await authenticate(req);
      let body:any;try{body=JSON.parse(raw)}catch{fail('invalid_request')}
      if(!body||Array.isArray(body)||typeof body!=='object')fail('invalid_request');
      if(body.action==='setup'){
        if(await rpc('cfa_is_owner',{},token)!==true)fail('owner_required');return reply(200,await setup());
      }
      if(body.action==='info'){
        let ready=false;try{ready=!!(await settings()).configured_at}catch{/* Owner setup installs the remaining schema. */}
        return reply(200,{ok:true,environment:'sandbox',ready});
      }
      if(body.action==='owner_summary'){
        if(await rpc('cfa_is_owner',{},token)!==true)fail('owner_required');
        const allowed=await db('cfa_test_access','GET',{select:'user_id',limit:'50'});
        const members=[];
        for(const a of allowed){
          const points=await rpc('cfa_test_ticket_points',{p_user:a.user_id});
          const count=points.reduce((n:number,r:any)=>n+Number(r.points||0),0);
          if(count>=6){const profile=(await db('user_profiles','GET',{user_id:'eq.'+a.user_id,select:'display_name'}))?.[0];
            members.push({name:profile?.display_name||'Member',points:count,rewards:Math.floor(count/6)});
          }
        }
        return reply(200,{ok:true,members});
      }
      if(body.action==='begin'){
        if(!(await settings()).configured_at)fail('setup_required');
        if(!/^[1-9][0-9]{0,18}$/.test(String(body.booking_id)))fail('invalid_request');
        const result=await rpc('cfa_prepare_test_checkout',{p_booking_id:String(body.booking_id),p_language:body.language==='en'?'en':'sk'},token);
        const s=await ownOrder(result.id,user.id);
        if(s.status==='paid')return reply(200,{ok:true,id:s.id,status:s.status});
        if(new Date(s.expires_at).getTime()<=Date.now())fail('checkout_expired');
        await assets();await smtpReady();
        if(s.checkout_url)return reply(200,{ok:true,id:s.id,status:s.status,url:s.checkout_url});
        const loc=env('SQUARE_SANDBOX_LOCATION_ID')?.trim();if(!loc||!ID.test(loc))fail('setup_required');
        const created=await square('/v2/online-checkout/payment-links','POST',{
          idempotency_key:s.id,order:{location_id:loc,reference_id:s.id,
            line_items:[{name:('TEST - '+s.snapshot.event.title).slice(0,200),quantity:'1',base_price_money:{amount:s.expected_pence,currency:'GBP'}}]},
          checkout_options:{allow_tipping:false,ask_for_shipping_address:false,redirect_url:SITE+'/?cfa-test='+s.id},
          pre_populated_data:{buyer_email:s.recipient},payment_note:('TEST - '+s.ticket_code).slice(0,500)});
        const link=created.payment_link;
        if(!link?.id||!ID.test(link.order_id||''))fail('square_unavailable');
        const u=new URL(link.url);
        if(u.protocol!=='https:'||!['sandbox.square.link','square.link','sandbox.checkout.square.site','checkout.square.site','checkout.squareupsandbox.com'].includes(u.hostname))fail('square_unavailable');
        const rows=await db('cfa_test_checkouts','PATCH',{id:'eq.'+s.id,square_link_id:'is.null'},
          {square_location_id:loc,square_link_id:link.id,square_order_id:link.order_id,checkout_url:u.href,status:'awaiting_payment'});
        const saved=rows[0]||await ownOrder(s.id,user.id);
        if(saved.square_order_id!==link.order_id)fail('payment_mismatch');
        return reply(200,{ok:true,id:s.id,status:saved.status,url:saved.checkout_url});
      }
      if(body.action==='list'){
        const data=await db('cfa_test_checkouts','GET',{user_id:'eq.'+user.id,
          select:'id,ticket_code,status,expected_pence,created_at',order:'created_at.desc',limit:'20'});
        return reply(200,{ok:true,orders:data});
      }
      if(body.action==='status'||body.action==='pdf'){
        let s=await ownOrder(body.id,user.id);s=await sync(s);
        if(body.action==='pdf'){
          if(s.status!=='paid')fail('payment_mismatch');const bytes=await document(s);
          return new Response(new Uint8Array(bytes).buffer,{headers:{...headers,'Content-Type':'application/pdf',
            'Content-Disposition':'attachment; filename="'+s.ticket_code+'.pdf"'}});
        }
        const mail=s.status==='paid'?await deliver(s.id):'pending';
        return reply(200,{ok:true,id:s.id,status:s.status,mail_status:mail,
          recipient:s.recipient,ticket_code:s.ticket_code,points:s.status==='paid'?ticketPoints(s.snapshot):0});
      }
      return reply(400,{error:'invalid_request'});
    }catch(e){
      const code=e instanceof Error&&SAFE.has(e.message)?e.message:'operation_failed';
      const status=['sign_in_required'].includes(code)?401:['test_access_required','owner_required'].includes(code)?403:code==='not_found'?404:400;
      return reply(isWebhook?503:status,{error:code});
    }
  };
}

// The deployed module starts only in Deno; tests import it without binding a server.
if(typeof Deno!=='undefined')Deno.serve(makeSandboxHandler({env:name=>Deno.env.get(name)}));
