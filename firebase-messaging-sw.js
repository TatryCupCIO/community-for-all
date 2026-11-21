/* Messaging only, without fetch handlers or application asset caches. */
importScripts('/notification-target.js?v=20261121-nav-9');
self.addEventListener('notificationclick',event=>{
  event.notification.close();event.stopImmediatePropagation();
  event.waitUntil((async()=>{
    const target=self.CFANotificationTarget.normalize(event.notification.data||{},self.location.origin);
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const client=windows.find(c=>new URL(c.url).origin===self.location.origin);
    if(client){client.postMessage({type:'CFA_NOTIFICATION_OPEN',payload:target});await client.focus();return;}
    await self.clients.openWindow(self.CFANotificationTarget.link(target,self.location.origin));
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
  if(payload.notification)return;
  const data=payload.data||{},target=self.CFANotificationTarget.normalize(payload,self.location.origin);
  return self.registration.showNotification(data.title||'Community For All',{
    body:data.body||'Máte nové upozornenie. / You have a new notification.',
    icon:'/app/src/main/res/drawable/tatry_cup_cio_512x512.png',
    data:target,tag:data.message_id||payload.messageId||undefined
  });
});
