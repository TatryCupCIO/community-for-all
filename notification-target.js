/* Shared, data-only routing validation for pages and the messaging service worker. */
(function(root){'use strict';
const integer=v=>{const s=String(v??'');return /^[1-9][0-9]{0,15}$/.test(s)&&Number.isSafeInteger(Number(s))?s:null;};
const uuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''))?String(v).toLowerCase():null;
function normalize(input,origin){if(!input||typeof input!=='object')return {type:'notifications'};const envelope=input.FCM_MSG||input;const d={...(envelope.data||{}),...(input.data||{}),...envelope,...input};delete d.data;delete d.FCM_MSG;const rawURL=d.url||d.link||envelope.fcmOptions?.link||envelope.notification?.click_action;let url;
if(typeof rawURL==='string'&&rawURL.length<6000){try{url=new URL(rawURL,origin);if(url.origin!==origin||!/^https?:$/.test(url.protocol))url=null;}catch(_){}if(url){const hash=url.hash.slice(1);if(hash==='owner-registrations')return {type:'owner'};const hp=new URLSearchParams(hash);if(hp.has('cfa_notice')){try{return normalize(JSON.parse(hp.get('cfa_notice')),origin);}catch(_){}}for(const [k,v]of [...url.searchParams,...hp])if(d[k]==null)d[k]=v;}}
const type=String(d.type||d.notification_type||d.source_table||'').toLowerCase().replace(/[ -]/g,'_');
const table=String(d.source_table||'').toLowerCase();const conversationId=integer(d.conversation_id||d.conversationId);const senderId=uuid(d.sender_id||d.senderId||d.actor_id);const messageId=integer(d.message_id||d.messageId||((table==='private_messages'||table==='chat_messages')?d.source_id:null));const recipientId=uuid(d.recipient_id||d.recipientId);
if(['owner','owner_approval','registration_request','cio_registration','cio_registration_requests'].includes(type))return {type:'owner',recipientId};
if(conversationId||['private','private_message','private_messages','private_chat'].includes(type)||table==='private_messages')return {type:'private',conversationId,senderId,messageId,recipientId};
if(['community','community_chat','community_message','chat_message','chat_messages'].includes(type)||table==='chat_messages')return {type:'community',messageId,recipientId};
if(['booking','reservation','booking_paid','payment','bookings'].includes(type))return {type:'bookings',recipientId};
if(['event','events'].includes(type)){const eventId=integer(d.event_id||d.eventId||d.source_id);if(eventId)return {type:'event',eventId,recipientId};}
return {type:'notifications',recipientId};}
function link(input,origin){const t=normalize(input,origin);const url=new URL('/',origin);url.hash=new URLSearchParams({cfa_notice:JSON.stringify(t)}).toString();return url.href;}
root.CFANotificationTarget={normalize,link};
})(typeof self!=='undefined'?self:globalThis);
