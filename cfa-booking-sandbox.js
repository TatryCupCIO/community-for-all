/* Private end-to-end test tools. All payment, email and point decisions are server-side. */
(function(){'use strict';if(window.CFABookingSandbox)return;
const $=id=>document.getElementById(id),tr=(sk,en)=>currentLanguage==='en'?en:sk;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const btn=(text,fn)=>{const b=node('button',text,'secondary-btn');b.type='button';b.onclick=fn;return b;};
const style=node('style');style.textContent=`
#cfaSandboxPanel{border-top:1px solid #c5dcd9;margin-top:24px;padding-top:18px}
#cfaSandboxPanel[hidden]{display:none!important}.cfa-sandbox-controls{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.cfa-sandbox-controls button{flex:1 1 170px;min-height:44px}.cfa-sandbox-mode{display:flex;gap:10px;align-items:center}
.cfa-sandbox-mode input{width:22px;height:22px}.cfa-sandbox-tag{display:block;color:#005d61;font-size:11px;font-weight:700}
#cfaSandboxDialog{box-sizing:border-box;width:min(620px,94vw);max-height:90dvh;overflow:auto;background:#fff;color:#143d46;border:1px solid #b8d5cf;border-radius:16px;padding:20px}
#cfaSandboxDialog::backdrop{background:#092f38aa}#cfaSandboxDialog:not([open]){display:none}
.cfa-sandbox-order{border:1px solid #b8d5cf;border-radius:12px;padding:12px;margin:10px 0;overflow-wrap:anywhere}
.cfa-sandbox-label{display:block;margin:12px 0}.cfa-sandbox-label input,.cfa-sandbox-label select{display:block;width:100%;box-sizing:border-box;min-height:44px;margin-top:6px}
`;document.head.append(style);
const panel=node('section');panel.id='cfaSandboxPanel';panel.hidden=true;
const host=$('accountPage')?.querySelector('.card');if(!host)return;host.append(panel);
const dialog=node('dialog');dialog.id='cfaSandboxDialog';dialog.setAttribute('aria-label',tr('Skúšobná rezervácia','Test booking'));
const close=btn('',()=>{pollRevision++;clearTimeout(timer);dialog.close();});
const dialogTitle=node('h2'),dialogMessage=node('div',null,'message info'),dialogActions=node('div',null,'cfa-sandbox-controls');
dialogMessage.setAttribute('role','status');dialog.append(close,dialogTitle,dialogMessage,dialogActions);document.body.append(dialog);
dialog.addEventListener('cancel',()=>{pollRevision++;clearTimeout(timer)});
let user=null,isOwner=false,ready=false,enabled=false,generation=0,pollRevision=0,timer=null,running=false,message='',messageType='info',orders=[],alerts=[],testEvents=[];
let emailDraft='';const styleDrafts=new Map();
let pendingId=new URL(location.href).searchParams.get('cfa-test'),activeId=null;
const errors={
 setup_required:['Najprv dokončite prípravu skúšobného servera.','Complete the test server setup first.'],
 installation_failed:['Automatická príprava databázy sa nepodarila. Pošlite nám túto hlášku, doplníme ju v SQL editore.','Automatic database setup failed. Send this message so setup can be completed in the SQL editor.'],
 sign_in_required:['Prihláste sa znova.','Please sign in again.'],
 test_access_required:['Tento účet ešte nemá povolenú skúšku.','This account has not been enabled for testing.'],
 owner_required:['Túto prípravu môže spustiť iba vlastníčka.','Only the owner can run this setup.'],
 verified_account_not_found:['Účet s týmto e-mailom neexistuje alebo ešte nemá overený e-mail.','This account does not exist or its email has not been verified.'],
 cart_unavailable:['Košík už nie je dostupný. Vytvorte nový skúšobný košík.','This cart is no longer available. Create a new test cart.'],
 event_unavailable:['Podujatie má zatvorené rezervácie. V administrácii zapnite rezervácie; podujatie môže zostať skryté.','Bookings are closed. Enable reservations in administration; the event can remain hidden.'],
 cart_total_invalid:['Suma košíka sa zmenila alebo je nulová. Obnovte košík.','The cart total has changed or is zero. Refresh the cart.'],
 cart_items_invalid:['Skontrolujte dostupnosť položiek a vybrané dátumy.','Check the items and selected dates.'],
 test_rate_limit:['Vytvorili ste viac skúšok. Skúste to o desať minút.','Several tests have been created. Try again in ten minutes.'],
 checkout_expired:['Platnosť tejto skúšobnej platby vypršala. Vytvorte nový košík.','This test checkout has expired. Create a new cart.'],
 payment_mismatch:['Platbu sa nepodarilo bezpečne potvrdiť. Skúšku treba preveriť.','The payment could not be securely verified. This test needs checking.'],
 smtp_configuration:['V serveri chýba nastavenie e-mailu.','Email settings are missing on the server.'],
 smtp_unavailable:['Prihlásenie k e-mailovému serveru sa nepodarilo.','Could not connect to the email server.'],
 pdf_assets_unavailable:['Písmo alebo logo pre PDF ešte nie je dostupné v správnej verzii.','The correct PDF font or logo is not available yet.'],
 webhook_gateway_blocked:['V nastaveniach novej funkcie cfa-booking-sandbox vypnite Verify JWT with legacy secret a prípravu zopakujte.','In the new cfa-booking-sandbox function settings, turn off Verify JWT with legacy secret and retry setup.'],
 square_unavailable:['Skúšobný Square neodpovedal správne. Skúste obnoviť stav.','Square Sandbox did not respond correctly. Try refreshing.'],
 not_found:['Táto skúšobná rezervácia nepatrí prihlásenému účtu.','This test booking does not belong to the signed-in account.'],
 unknown:['Skúšobný server sa nepodarilo načítať. Po dokončení nahratia skúste Obnoviť.','Could not load the test server. Once deployment is complete, try Refresh.']};
const explanation=e=>tr(...(errors[e?.code]||errors.unknown));
function current(){return !!user&&currentUser?.id===user;}
async function api(body){
 const r=await supabaseClient.functions.invoke('cfa-booking-sandbox',{body});let data=r.data;
 if(r.error){try{data=await r.error.context?.json()}catch{}const e=new Error('test_failed');e.code=data?.error||'unknown';throw e}
 if(!data?.ok){const e=new Error('test_failed');e.code=data?.error||'unknown';throw e}return data;
}
function statusName(value){return ({creating:tr('Pripravuje sa','Preparing'),awaiting_payment:tr('Čaká na skúšobnú platbu','Awaiting test payment'),
 paid:tr('Skúšobne zaplatené','Test paid'),refunded:tr('Skúšobne vrátené','Test refunded'),
 partially_refunded:tr('Skúšobne čiastočne vrátené','Test partially refunded'),failed:tr('Platba nebola dokončená','Payment not completed')})[value]||tr('Na preverenie','Needs checking');}
function decorateCart(){
 const b=$('cartPageContent')?.querySelector('.checkout-btn');if(!b)return;
 const can=current()&&enabled&&ready;
 if(b.dataset.cfaSandbox===String(can))return;b.dataset.cfaSandbox=String(can);
 b.disabled=!can;b.textContent=can?tr('Skúšobne zaplatiť celú rezerváciu','Test full booking payment'):tr('Prejsť k platbe – čoskoro','Proceed to checkout – coming soon');
 b.onclick=can?begin:null;
}
function tag(){
 let label=$('cfaSandboxChestTag');
 if(enabled&&current()){
  if(!label){label=node('span',null,'cfa-sandbox-tag');label.id='cfaSandboxChestTag';$('cfaTreasureBtn')?.append(label)}
  if(label)label.textContent=tr('SKÚŠKA','TEST');
 }else label?.remove();
}
function mode(value){enabled=!!value&&current();if(user)try{sessionStorage.setItem('cfa-test-mode:'+user,enabled?'1':'0')}catch{}
 tag();decorateCart();window.CFALoyaltyTreasure?.refresh();render();}
function render(){
 panel.hidden=!current();if(panel.hidden)return;panel.replaceChildren();
 panel.append(node('h3',tr('Kompletná skúšobná rezervácia','Complete test booking')),
 node('p',tr('Skúšobná platba kartou, potvrdenie e-mailom, PDF vstupenka a skúšobné body. Skúšobné doklady nie sú platné na vstup.','Test card payment, confirmation email, PDF ticket and test points. Test documents are not valid for entry.')));
 const label=node('label',null,'cfa-sandbox-mode'),check=node('input');check.type='checkbox';check.checked=enabled;check.onchange=()=>mode(check.checked);
 label.append(check,node('span',tr('Skúšobný režim vrátane truhličky','Test mode including treasure chest')));panel.append(label);
 const controls=node('div',null,'cfa-sandbox-controls');
 if(isOwner){const setup=btn(tr('Pripraviť celú skúšku','Prepare complete test'),setupAll);setup.disabled=running;controls.append(setup)}
 controls.append(btn(tr('Obnoviť stav','Refresh status'),refresh),btn(tr('Otvoriť podujatia a rezerváciu','Open events and booking'),()=>{mode(true);showEvents()}));panel.append(controls);
 if(message){const m=node('p',message,'message '+messageType);m.setAttribute('role',messageType==='error'?'alert':'status');panel.append(m)}
 if(isOwner){
  const form=node('form');const l=node('label',tr('E-mail ďalšieho skúšobného účtu','Email of another test account'),'cfa-sandbox-label'),input=node('input');input.type='email';input.required=true;input.maxLength=254;input.autocomplete='off';input.value=emailDraft;input.oninput=()=>emailDraft=input.value;l.append(input);
  const add=node('button',tr('Povoliť skúšku tomuto účtu','Enable testing for this account'),'secondary-btn');add.type='submit';add.disabled=running;
  form.append(l,add);form.onsubmit=async e=>{e.preventDefault();if(running||!current())return;const id=user,gen=generation;running=true;add.disabled=true;
   try{const r=await supabaseClient.rpc('cfa_allow_test_account',{p_email:input.value.trim()});if(r.error){const err=new Error();err.code=r.error.message;throw err}
    if(gen!==generation||user!==id)return;message=tr('Skúšobný účet je povolený.','The test account is enabled.');messageType='success';emailDraft='';input.value='';}
   catch(e){if(gen===generation){message=explanation(e);messageType='error'}}finally{if(gen===generation){running=false;render()}}};panel.append(form);
  for(const a of alerts)panel.append(node('p',tr('Skúšobný nárok na odmenu: ','Test reward earned: ')+a.name+' · '+a.points+tr(' bodov',' points'),'message success'));
 }
 if(testEvents.length){panel.append(node('h4',tr('Skryté podujatia na skúšku','Hidden events for testing')));
  for(const event of testEvents){
   const card=node('article',null,'cfa-sandbox-order');card.append(node('strong',event.title),btn(tr('Rezervovať skúšobne','Make a test booking'),()=>openEvent(event)));
   if(isOwner){
    const label=node('label',tr('Vzhľad PDF vstupenky','PDF ticket style'),'cfa-sandbox-label'),select=node('select');
    for(const [value,sk,en]of [['community','Komunita','Community'],['family','Rodinné hry','Family games'],['sport','Šport','Sport'],['winter','Zimné podujatie','Winter event']]){const o=node('option',tr(sk,en));o.value=value;select.append(o)}
    const draft=styleDrafts.get(event.id)||{theme:event.display_settings?.ticket_theme||'community',file:null};styleDrafts.set(event.id,draft);
    select.value=draft.theme;select.onchange=()=>draft.theme=select.value;label.append(select);card.append(label);
    const logoLabel=node('label',tr('Logo podujatia na PDF (PNG alebo JPG do 2 MB, voliteľné)','Event logo for the PDF (PNG or JPG up to 2 MB, optional)'),'cfa-sandbox-label'),file=node('input');file.type='file';file.accept='image/png,image/jpeg';file.onchange=()=>draft.file=file.files?.[0]||null;logoLabel.append(file);if(draft.file)logoLabel.append(node('span',draft.file.name));card.append(logoLabel);
    card.append(btn(tr('Uložiť vzhľad vstupenky','Save ticket style'),()=>saveStyle(event,draft.theme,draft.file)));
   }
   panel.append(card);
  }
 }
 const list=node('div');drawOrders(list);panel.append(list);tag();
}
function drawOrders(list){
 list.replaceChildren();list.append(node('h4',tr('Moje skúšobné rezervácie','My test bookings')));
 for(const s of orders){const card=node('article',null,'cfa-sandbox-order');card.append(node('strong',s.ticket_code),node('p',statusName(s.status)+' · GBP '+(Number(s.expected_pence)/100).toFixed(2)),btn(tr('Zobraziť platbu a doručenie','View payment and delivery'),()=>openStatus(s.id)));list.append(card)}
 if(!orders.length)list.append(node('p',tr('Zatiaľ tu nie je skúšobná rezervácia.','No test bookings yet.')));
}
async function openEvent(event){
 const gen=generation;if(!current()||running)return;mode(true);
 if(isOwner&&!event.reservations_open){
  const r=await supabaseClient.from('events').update({reservations_open:true}).eq('id',event.id).eq('status','hidden').select('id').single();
  if(gen!==generation)return;if(r.error){message=tr('Rezervácie sa nepodarilo otvoriť. Skontrolujte podujatie v administrácii.','Could not enable reservations. Check the event in administration.');messageType='error';render();return;}
  event.reservations_open=true;
 }
 if(gen===generation)showEventDetail(event.id);
}
async function saveStyle(event,theme,file){
 if(!current()||!isOwner||running)return;const gen=generation;running=true;
 try{
  const fresh=await supabaseClient.from('events').select('display_settings').eq('id',event.id).single();if(fresh.error)throw fresh.error;
  const original=fresh.data.display_settings||{},settings={...original,ticket_theme:theme};
  if(file){
   if(!['image/png','image/jpeg'].includes(file.type)||file.size>2*1024*1024)throw Error('logo_size');
   const path='events/'+event.id+'/'+crypto.randomUUID()+(file.type==='image/png'?'.png':'.jpg');
   const r=await supabaseClient.storage.from('event-photos').upload(path,file,{contentType:file.type,upsert:false});if(r.error)throw r.error;
   settings.ticket_logo_path=path;
  }
  if(gen!==generation)return;
  const saved=await supabaseClient.from('events').update({display_settings:settings}).eq('id',event.id).filter('display_settings','eq',JSON.stringify(original)).select('id').single();
  if(saved.error)throw saved.error;event.display_settings=settings;styleDrafts.delete(event.id);message=tr('Vzhľad vstupenky je uložený.','The ticket style has been saved.');messageType='success';
 }catch{if(gen===generation){message=tr('Vzhľad sa nepodarilo uložiť. Použite PNG/JPG do 2 MB a skúste Obnoviť.','Could not save the style. Use a PNG/JPG up to 2 MB and try Refresh.');messageType='error'}}
 finally{if(gen===generation){running=false;render()}}
}
async function loadOrders(){
 const id=user,gen=generation;if(!current())return;
 try{const r=await api({action:'list'});if(gen!==generation||user!==id)return;orders=r.orders||[];render();drawBookings()}catch{}
}
function drawBookings(){
 const host=$('bookingsContent');if(!host)return;host.querySelector('#cfaSandboxBookingList')?.remove();
 if(!current()||!enabled)return;const list=node('section',null,'card');list.id='cfaSandboxBookingList';drawOrders(list);host.prepend(list);
}
async function refresh(){
 const id=user,gen=generation;if(!current())return;
 try{const r=await api({action:'info'});if(gen!==generation||user!==id)return;ready=r.ready===true;
  message=ready?tr('Celá skúška je pripravená: platba, e-mail, PDF a truhlička.','The complete test is ready: payment, email, PDF and treasure chest.'):tr('Dokončujeme prípravu skúšobného servera.','Test server setup is being completed.');messageType=ready?'success':'info';
 }catch(e){if(gen!==generation)return;ready=false;message=explanation(e);messageType='error'}
 if(gen!==generation||user!==id)return;render();decorateCart();if(ready)window.CFALoyaltyTreasure?.refresh();await loadOrders();
 try{const e=await supabaseClient.from('events').select('id,title,display_settings,status,reservations_open').eq('status','hidden').order('start_date');if(gen===generation&&user===id&&!e.error){testEvents=e.data||[];render()}}catch{}
 if(isOwner&&ready){try{const r=await api({action:'owner_summary'});if(gen===generation&&user===id){alerts=r.members||[];render()}}catch{}}
}
async function setupAll(){
 if(running||!isOwner||!current())return;const gen=generation;running=true;message=tr('Pripravujem platobné potvrdenie, PDF a e-mailový server…','Preparing payment confirmation, PDF and email server…');messageType='info';render();
 try{await api({action:'setup'});if(gen!==generation)return;await refresh()}
 catch(e){if(gen===generation){message=explanation(e);messageType='error'}}finally{if(gen===generation){running=false;render()}}
}
function showDialog(){close.textContent=tr('Zavrieť','Close');dialogTitle.textContent=tr('Skúšobná rezervácia','Test booking');if(!dialog.open)dialog.showModal();}
function testCard(){
 const box=node('section',null,'cfa-sandbox-order');box.append(node('h4',tr('Iba testovacia karta Square','Square test card only')),
  node('p','Visa: 4111 1111 1111 1111'),node('p',tr('Platnosť: 12/29 · bezpečnostný kód: 111','Expiry: 12/29 · security code: 111')),
  node('p',tr('Ak formulár žiada ZIP, použite 10001. Ak žiada britské PSČ, použite SW1A 1AA.','If the form asks for a ZIP code, use 10001. If it asks for a UK postcode, use SW1A 1AA.')));
 const source=node('a',tr('Oficiálne skúšobné údaje Square','Official Square test data'));source.href='https://developer.squareup.com/docs/devtools/sandbox/payments';source.target='_blank';source.rel='noopener';box.append(source);return box;
}
async function begin(){
 if(running||!current()||!enabled||!ready||!activeCart?.id)return;
 const gen=generation,id=user,booking=activeCart.id;running=true;showDialog();dialogActions.replaceChildren();dialogMessage.className='message info';dialogMessage.textContent=tr('Pripravujem celú skúšobnú platbu…','Preparing the complete test checkout…');
 try{
  const r=await api({action:'begin',booking_id:String(booking),language:currentLanguage});if(gen!==generation||user!==id)return;
  activeId=r.id;try{sessionStorage.setItem('cfa-test-active:'+id,r.id)}catch{}
  if(r.status==='paid'){await openStatus(r.id);return}
  const u=new URL(r.url);if(u.protocol!=='https:')throw Error('invalid_checkout');
  dialogMessage.textContent=tr('Otvorí sa skúšobný Square. Použite iba testovaciu kartu. Po zaplatení sa vráťte sem; systém odošle e-mail s PDF a pripočíta skúšobné body.','Square Sandbox will open. Use only a test card. Return here after payment; the system will email the PDF and add test points.');
  const a=node('a',tr('Otvoriť skúšobnú platbu Square','Open Square test payment'),'primary-btn');a.href=u.href;dialogActions.append(a);
  dialogActions.append(testCard());
 }catch(e){if(gen===generation){dialogMessage.className='message error';dialogMessage.textContent=explanation(e)}}
 finally{if(gen===generation)running=false}
}
async function download(id){
 const gen=generation,uid=user;
 try{
  const {data,error}=await supabaseClient.auth.getSession();if(error||!data.session?.access_token)throw Error('sign_in_required');
  const r=await fetch(SUPABASE_URL+'/functions/v1/cfa-booking-sandbox',{method:'POST',headers:{
   apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'pdf',id})});
  if(!r.ok)throw Error('pdf_failed');const blob=await r.blob();if(!blob.type.includes('application/pdf'))throw Error('pdf_failed');
  if(gen!==generation||uid!==user)return;const url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='TEST-'+id+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch{if(gen===generation){dialogMessage.className='message error';dialogMessage.textContent=tr('PDF sa nepodarilo stiahnuť. Nájdete ho aj v potvrdzujúcom e-maile.','Could not download the PDF. It is also attached to the confirmation email.')}}
}
async function openStatus(id){
 if(!current())return;activeId=id;const seq=++pollRevision,gen=generation,uid=user;clearTimeout(timer);showDialog();dialogActions.replaceChildren();
 const retry=btn(tr('Overiť platbu a doručenie','Verify payment and delivery'),()=>openStatus(id));dialogActions.append(retry);
 let attempts=0;
 async function poll(){
  if(seq!==pollRevision||gen!==generation||uid!==user)return;retry.disabled=true;
  dialogMessage.className='message info';dialogMessage.textContent=tr('Overujem platbu, e-mail a PDF…','Checking payment, email and PDF…');
  try{
   const r=await api({action:'status',id});if(seq!==pollRevision||gen!==generation||uid!==user)return;
   if(r.status==='paid'){
    dialogMessage.className='message '+(r.mail_status==='sent'?'success':'info');
    dialogMessage.textContent=tr('Skúšobná rezervácia je zaplatená. Body za túto rezerváciu: ','The test booking is paid. Points for this booking: ')+r.points+'. '+
     (r.mail_status==='sent'?tr('Potvrdenie s PDF bolo odoslané na ','The confirmation and PDF were sent to ')+r.recipient+'.':tr('Odosielanie potvrdenia s PDF ešte čaká.','The confirmation email and PDF are still pending.'));
    if(!dialogActions.querySelector('[data-cfa-test-pdf]')){const b=btn(tr('Stiahnuť skúšobnú PDF vstupenku','Download test PDF ticket'),()=>download(id));b.dataset.cfaTestPdf='1';dialogActions.append(b)}
    window.CFALoyaltyTreasure?.refresh();await loadOrders();refreshCartBadge();
    if($('cartPage')?.style.display==='block')showCartPage();
    if(r.mail_status==='sent')return;
   }else{dialogMessage.textContent=statusName(r.status);if(['refunded','partially_refunded','review'].includes(r.status)){window.CFALoyaltyTreasure?.refresh();return}}
   if(++attempts<24&&dialog.open)timer=setTimeout(poll,5000);
  }catch(e){if(seq===pollRevision&&gen===generation){dialogMessage.className='message error';dialogMessage.textContent=explanation(e)}}
  finally{if(seq===pollRevision)retry.disabled=false}
 }
 await poll();
}
async function refreshAuth(){
 const gen=++generation;user=null;isOwner=false;ready=false;enabled=false;orders=[];alerts=[];testEvents=[];message='';running=false;panel.hidden=true;panel.replaceChildren();emailDraft='';styleDrafts.clear();activeId=null;
 pollRevision++;clearTimeout(timer);if(dialog.open)dialog.close();tag();decorateCart();
 const id=currentUser?.id;if(!id)return;
 try{
  const [member,owner]=await Promise.all([supabaseClient.rpc('cfa_test_is_member'),supabaseClient.rpc('cfa_is_owner')]);
  if(gen!==generation||currentUser?.id!==id||!((!member.error&&member.data===true)||(!owner.error&&owner.data===true)))return;
  user=id;isOwner=!owner.error&&owner.data===true;let saved=null;try{saved=sessionStorage.getItem('cfa-test-mode:'+id)}catch{}
  enabled=saved!=='0';render();tag();window.CFALoyaltyTreasure?.refresh();await refresh();
  if(gen!==generation||user!==id)return;
  if(pendingId&&/^[0-9a-f-]{36}$/i.test(pendingId)){
   const returned=pendingId;pendingId=null;const url=new URL(location.href);url.searchParams.delete('cfa-test');history.replaceState(null,'',url);await openStatus(returned);
  }
 }catch{/* Keep private controls hidden when membership cannot be verified. */}
}
for(const name of ['showCartPage','showBookings']){
 const previous=window[name];if(typeof previous==='function')window[name]=async function(){const r=await previous.apply(this,arguments);if(name==='showCartPage')decorateCart();else{drawBookings();if(current())loadOrders()}return r;};
}
const observer=new MutationObserver(decorateCart);if($('cartPageContent'))observer.observe($('cartPageContent'),{childList:true,subtree:true});
const language=window.setLanguage;if(typeof language==='function')window.setLanguage=function(){const r=language.apply(this,arguments);document.querySelectorAll('[data-cfa-sandbox]').forEach(b=>delete b.dataset.cfaSandbox);render();decorateCart();tag();return r;};
supabaseClient.auth.onAuthStateChange(()=>{generation++;user=null;enabled=false;panel.hidden=true;panel.replaceChildren();dialogMessage.textContent='';dialogActions.replaceChildren();pollRevision++;clearTimeout(timer);if(dialog.open)dialog.close();tag();decorateCart();setTimeout(refreshAuth,0)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&current()&&!running){refresh();if(dialog.open&&activeId)openStatus(activeId)}});
window.CFABookingSandbox={get testMode(){return enabled&&current()},refresh,refreshAuth,setMode:mode};refreshAuth();
})();
