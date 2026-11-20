/* Isolated Firebase web-push registration. No Firebase Authentication is used. */
(function(){
  'use strict';
  const tr=(sk,en)=>currentLanguage==='en'?en:sk;
  const native=typeof window.AndroidFirebase?.postMessage==='function';
  const storageKey='cfa.webPush.disabled';
  const config={apiKey:'AIzaSyB05wuwF3H-S4fXLeGDRGE2h1-AdMsBKRs',authDomain:'community-for-all.firebaseapp.com',projectId:'community-for-all',storageBucket:'community-for-all.firebasestorage.app',messagingSenderId:'747376294407',appId:'1:747376294407:web:cd27ed639d25faa6ab08a2'};
  const vapidKey='BDzFx23oxkOFWqY4QuBEqzF7NWw8Sv_vUkueSfL3UvCwFWMkkG4AxuXGexQqrXWBQF2TrHolbh08A9mZ8ye5Gvk';
  let sdkPromise=null,registration=null,currentToken=null,registeredUser=null,inFlight=null,ready=false;
  const card=document.querySelector('#accountPage .card');if(!card)return;
  const language=document.querySelector('.container .language');
  const box=document.createElement('section');box.id='cfaWebPushSettings';box.hidden=true;
  box.style.cssText='margin:16px 0;padding:12px 14px;border:1px solid #64748b;border-radius:12px;background:#111827;color:white;';
  const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.setAttribute('role','switch');button.style.cssText='width:auto;min-height:44px;min-width:130px;margin:0;padding:10px 14px;border-radius:22px;border:2px solid white;color:white;font-size:16px;font-weight:bold;';
  const disable=document.createElement('button');disable.type='button';disable.className='secondary-btn';disable.style.marginTop='10px';
  const status=document.createElement('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.style.cssText='font-size:15px;line-height:1.5;margin-bottom:0;';
  const controls=document.createElement('div');controls.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;';
  const heading=document.createElement('strong');heading.style.fontSize='17px';controls.append(heading,button);box.append(controls,status);
  if(language?.parentNode)language.parentNode.insertBefore(box,language.nextSibling);else card.appendChild(box);
  function optedOut(){try{return localStorage.getItem(storageKey)==='true';}catch{return false;}}
  function setOptedOut(value){try{localStorage.setItem(storageKey,String(value));}catch{}}
  function needsHomeScreen(){const ua=navigator.userAgent||'';const apple=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);return apple&&!navigator.standalone&&!window.matchMedia?.('(display-mode: standalone)').matches;}
  function supported(){return window.isSecureContext&&'Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window;}
  function render(){
    box.hidden=!currentUser;
    heading.textContent=tr('Upozornenia','Notifications');
    button.textContent=inFlight?tr('Nastavujem…','Updating…'):(ready?tr('● Zapnuté','● On'):tr('● Vypnuté','● Off'));
    button.setAttribute('aria-checked',String(ready));button.setAttribute('aria-label',tr('Upozornenia na tomto zariadení','Notifications on this device'));button.style.background=ready?'#166534':'#991b1b';
    disable.textContent=tr('Vypnúť upozornenia na tomto zariadení','Disable notifications on this device');
    button.disabled=!!inFlight||(!native&&!supported());disable.hidden=true;
    if(native){status.textContent=ready?tr('Upozornenia sú zapnuté. Telefón musí mať povolené oznámenia pre aplikáciu.','Notifications are on. Phone notification permission for the app is also required.'):tr('Ťuknutím ich zapneš. Kedykoľvek ich tu môžeš vypnúť.','Tap to enable. You can switch them off here anytime.');return;}
    if(needsHomeScreen()){button.disabled=true;status.textContent=tr('Na iPhone otvor web v Safari, vyber Zdieľať → Pridať na plochu a potom ho otvor cez novú ikonu. Tam zapni upozornenia.','On iPhone, open this site in Safari, choose Share → Add to Home Screen, then open it from the new icon and enable notifications.');}
    else if(!supported())status.textContent=tr('Tento prehliadač nepodporuje webové upozornenia.','This browser does not support web notifications.');
    else if(ready)status.textContent=tr('Upozornenia na tomto zariadení sú zapnuté.','Notifications on this device are enabled.');
    else if(Notification.permission==='denied')status.textContent=tr('Upozornenia sú blokované. Povoľ ich v nastaveniach prehliadača pre tatrycupcio.uk.','Notifications are blocked. Allow them in browser settings for tatrycupcio.uk.');
    else status.textContent=tr('Zapni ich, aby telefón upozornil na novú správu aj pri prezeraní inej aplikácie.','Enable them to receive new message alerts while using another app.');
  }
  function loadSdk(){
    if(!sdkPromise)sdkPromise=Promise.all([
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging.js')
    ]).then(async([app,m])=>{
      if(!await m.isSupported())throw new Error('unsupported-browser');
      const instance=app.getApps().find(a=>a.name==='cfa-web-push')||app.initializeApp(config,'cfa-web-push');
      const messaging=m.getMessaging(instance);
      // Existing chat/bell listeners handle foreground messages. No duplicate popup.
      m.onMessage(messaging,()=>{if(typeof refreshPrivateMessageNotifications==='function')refreshPrivateMessageNotifications();});
      return {...m,messaging};
    }).catch(e=>{sdkPromise=null;throw e;});
    return sdkPromise;
  }
  async function storeToken(userId,token){
    const {data,error}=await supabaseClient.from('push_tokens').select('id').eq('user_id',userId).eq('token',token).limit(1);
    if(error)throw error;
    const action=data?.length?supabaseClient.from('push_tokens').update({updated_at:new Date().toISOString()}).eq('id',data[0].id).eq('user_id',userId):supabaseClient.from('push_tokens').insert({user_id:userId,token});
    const result=await action;if(result.error)throw result.error;
  }
  async function register(){
    const {data,error}=await supabaseClient.auth.getUser();if(error||!data?.user)throw new Error('sign-in-required');
    const userId=data.user.id;const sdk=await loadSdk();
    registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/',updateViaCache:'none'});
    await navigator.serviceWorker.ready;
    const token=await sdk.getToken(sdk.messaging,{vapidKey,serviceWorkerRegistration:registration});
    if(!token)throw new Error('empty-token');
    if(currentUser?.id!==userId){await sdk.deleteToken(sdk.messaging);throw new Error('session-changed');}
    currentToken=token;registeredUser=userId;await storeToken(userId,token);
    ready=true;render();
  }
  async function start(requestPermission){
    if(inFlight||native||!currentUser||!supported()||needsHomeScreen())return;
    // Invoke permission directly from the user's click, before imports/network calls.
    const permission=requestPermission?Notification.requestPermission():Promise.resolve(Notification.permission);
    inFlight=(async()=>{
      const granted=await permission;if(granted!=='granted'){ready=false;return;}
      setOptedOut(false);await register();
    })();render();
    try{await inFlight;}
    catch(error){console.warn('Web notifications could not be enabled:',error.code||error.message);ready=false;
      status.textContent=tr('Upozornenia sa nepodarilo zapnúť. Skús to znova.','Notifications could not be enabled. Please try again.')+(error.code?' ('+error.code+')':'');
      return;
    }finally{inFlight=null;button.disabled=false;disable.disabled=false;}
    render();
  }
  window.cfaWebPushUnregister=async function(userId){
    if(native)return;
    const pending=inFlight;if(pending)try{await pending;}catch{}
    if(currentToken&&userId){
      const {error}=await supabaseClient.from('push_tokens').delete().eq('user_id',userId).eq('token',currentToken);
      if(error)console.warn('Web notification registration cleanup failed:',error.code);
    }
    if(sdkPromise){try{const sdk=await sdkPromise;await sdk.deleteToken(sdk.messaging);}catch(error){console.warn('Web notification token cleanup failed:',error.code||error.message);}}
    currentToken=null;registeredUser=null;ready=false;render();
  };
  async function checkNative(){
    if(!native||!currentUser)return;
    if(optedOut()){ready=false;render();return;}
    if(typeof androidFirebaseToken==='undefined'||!androidFirebaseToken){requestAndroidFirebaseToken();ready=false;render();return;}
    const id=currentUser.id;
    const {data,error}=await supabaseClient.from('push_tokens').select('id').eq('user_id',id).eq('token',androidFirebaseToken).limit(1);
    if(currentUser?.id!==id)return;
    ready=!error&&!!data?.length;render();
  }
  async function toggleNative(){
    if(inFlight||!currentUser)return;
    const turnOff=ready;
    inFlight=(async()=>{
      if(turnOff){
        setOptedOut(true);
        const {error}=await supabaseClient.from('push_tokens').delete().eq('user_id',currentUser.id).eq('token',androidFirebaseToken);
        if(error){setOptedOut(false);throw error;}
        ready=false;
      }
      else{setOptedOut(false);if(typeof androidFirebaseToken!=='undefined'&&androidFirebaseToken)await saveAndroidFirebaseToken();else requestAndroidFirebaseToken();}
    })();render();
    let failure=false;
    try{await inFlight;}catch(error){failure=true;}
    finally{inFlight=null;await checkNative();if(failure)status.textContent=tr('Nastavenie sa nepodarilo. Skús to znova.','Could not update the setting. Try again.');}
  }
  button.addEventListener('click',async()=>{
    if(inFlight)return;
    if(native){await toggleNative();return;}
    if(!ready){start(true);return;}
    setOptedOut(true);
    inFlight=window.cfaWebPushUnregister(currentUser?.id);render();
    try{await inFlight;}catch(error){console.warn('Notification switch:',error.code||error.message);}
    finally{inFlight=null;render();}
  });
  window.addEventListener('cfa:android-push-registered',()=>{checkNative().catch(()=>{});});
  disable.addEventListener('click',async()=>{if(inFlight)return;setOptedOut(true);disable.disabled=true;try{await window.cfaWebPushUnregister(currentUser?.id);}finally{render();}});
  function restore(){render();if(native){checkNative().catch(()=>{});return;}if(!native&&currentUser&&supported()&&Notification.permission==='granted'&&!optedOut())start(false);}
  supabaseClient.auth.onAuthStateChange(event=>{
    if(event==='SIGNED_OUT'){ready=false;registeredUser=null;currentToken=null;box.hidden=true;}
    else setTimeout(restore,0);
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)return;render();if(currentUser&&(native||!ready||registeredUser!==currentUser.id))restore();});
  const previousLanguage=window.setLanguage;
  window.setLanguage=function(){const result=previousLanguage.apply(this,arguments);render();return result;};
  restore();
})();
