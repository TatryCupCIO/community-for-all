/* Messaging only: deliberately no fetch handler and no page/asset caching. */
self.addEventListener('notificationclick', event => {
  event.notification.close();event.stopImmediatePropagation();
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=windows.find(c=>new URL(c.url).origin===self.location.origin);
    if(client){await client.focus();return;}
    await self.clients.openWindow('/');
  })());
});
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.6.0/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey:'AIzaSyB05wuwF3H-S4fXLeGDRGE2h1-AdMsBKRs',
  authDomain:'community-for-all.firebaseapp.com',projectId:'community-for-all',
  storageBucket:'community-for-all.firebasestorage.app',
  messagingSenderId:'747376294407',appId:'1:747376294407:web:cd27ed639d25faa6ab08a2'
});
firebase.messaging().onBackgroundMessage(payload=>{
  // FCM displays notification payloads itself; do not create a duplicate.
  if(payload.notification)return;
  const data=payload.data||{};
  return self.registration.showNotification(data.title||'Community For All',{
    body:data.body||'Máte nové upozornenie. / You have a new notification.',
    icon:'/app/src/main/res/drawable/tatry_cup_cio_512x512.png',data:{url:'/'},tag:data.message_id||payload.messageId||undefined
  });
});
