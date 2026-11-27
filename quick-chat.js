/* In-page private replies. All requests use the signed-in Supabase client and RLS. */
(() => {
  'use strict';
  const recent = new Map(), drafts = new Map(), seen = new Set();
  let owner = null, panel = null, active = null, generation = 0, timer, running = false;
  const tr = (sk,en) => currentLanguage === 'en' ? en : sk;
  const uid = () => typeof currentUser !== 'undefined' && currentUser?.id;
  function reset() { generation++; panel?.remove(); panel=null; active=null; recent.clear(); drafts.clear(); seen.clear(); owner=uid(); }
  async function refreshNow() {
    if (running || !uid()) return;
    if(owner !== uid()) reset();
    const user=uid(); running=true;
    try {
      const {data:mine,error} = await supabaseClient.from('private_conversation_memberships').select('conversation_id').eq('user_id',user).is('left_at',null);
      if(error || !mine?.length) return;
      const ids=mine.map(m=>m.conversation_id);
      const {data:members,error:me} = await supabaseClient.from('private_conversation_memberships').select('conversation_id,user_id').in('conversation_id',ids).is('left_at',null);
      if(me) return;
      const latest=new Map();
      for(let start=0;;start+=1000) {
        const {data,error:e}=await supabaseClient.from('private_messages').select('conversation_id,sender_id,created_at').in('conversation_id',ids).order('created_at',{ascending:false}).order('id',{ascending:false}).range(start,start+999);
        if(e || user!==uid()) return;
        for(const m of data||[]) if(!latest.has(String(m.conversation_id))) latest.set(String(m.conversation_id),m);
        if((data||[]).length<1000 || latest.size===ids.length) break;
      }
      if(user!==uid()) return;
      recent.clear();
      for(const m of members||[]) {
        const last=latest.get(String(m.conversation_id));
        if(m.user_id===user || !last) continue;
        const time=Date.parse(last.created_at)||0;
        if(time>(recent.get(m.user_id)?.time||0)) recent.set(m.user_id,{time,conversationId:m.conversation_id});
      }
      if(typeof renderPrivateUsers==='function') renderPrivateUsers();
    } catch(e) { console.warn('Private conversation order:',e); }
    finally { running=false; }
  }
  function refresh(){clearTimeout(timer);timer=setTimeout(refreshNow,150);}
  function hide(){if(panel && active) drafts.set(String(active.conversation_id),panel.querySelector('textarea').value);generation++;panel?.remove();panel=null;active=null;}
  async function incoming(message) {
    if(window.CFASafety?.unavailable(message.sender_id)&&!message.cfa_system_receipt)return;
    if(!uid() || message.sender_id===uid()) return;
    if(owner!==uid()) reset();
    if(seen.has(String(message.id))) return;
    seen.add(String(message.id));
    if(seen.size>500) seen.delete(seen.values().next().value);
    if(typeof privateChatOpen!=='undefined' && privateChatOpen && String(privateChatConversationId)===String(message.conversation_id)) return;
    // Do not displace an unfinished reply to another conversation.
    if(panel && active && (panel.querySelector('form button').disabled || (String(active.conversation_id)!==String(message.conversation_id) && panel.querySelector('textarea').value.trim()))) {
      const link=document.createElement('button');link.type='button';link.textContent=tr('Ďalšia nová správa · otvoriť','Another new message · open');
      link.onclick=()=>{hide();seen.delete(String(message.id));incoming(message);};panel.querySelector('.cfa-quick-more').append(link);return;
    }
    const user=uid(), token=++generation;
    const {data:profile}=await supabaseClient.from('user_profiles').select('user_id,display_name,avatar_url').eq('user_id',message.sender_id).maybeSingle();
    if(token!==generation || user!==uid()) return;
    if(!panel) {
      panel=document.createElement('section');panel.className='cfa-quick-chat';panel.setAttribute('role','region');panel.setAttribute('aria-label',tr('Nová súkromná správa','New private message'));
      panel.innerHTML='<header><strong></strong><button type="button" class="cfa-quick-close">×</button></header><div class="cfa-quick-messages" aria-live="polite"></div><div class="cfa-quick-more"></div><form><textarea rows="2" maxlength="10000"></textarea><button type="submit"></button></form><button type="button" class="cfa-quick-full"></button><div class="cfa-quick-error" role="status"></div>';
      document.body.append(panel);
      panel.querySelector('.cfa-quick-close').ariaLabel=tr('Zavrieť','Close');panel.querySelector('.cfa-quick-close').onclick=hide;
    }
    active=message;
    panel.querySelector('strong').textContent=profile?.display_name||tr('Súkromná správa','Private message');
    panel.querySelector('textarea').placeholder=tr('Napísať odpoveď…','Write a reply…');
    panel.querySelector('form button').textContent=tr('Odoslať','Send');
    panel.querySelector('.cfa-quick-full').textContent=tr('Otvoriť celý rozhovor a fotografie','Open full conversation and photos');
    panel.querySelector('.cfa-quick-full').onclick=()=>{hide();window.openPrivateChatConversation(Number(message.conversation_id),profile||{user_id:message.sender_id});};
    const input=panel.querySelector('textarea');if(!input.value) input.value=drafts.get(String(message.conversation_id))||'';
    let displayed=[];
    input.onfocus=async()=>{
      if(document.hidden || user!==uid() || token!==generation) return;
      const rows=displayed.filter(m=>m.sender_id!==user).map(m=>({message_id:m.id,user_id:user,read_at:new Date().toISOString()}));
      if(rows.length) await supabaseClient.from('private_message_reads').upsert(rows,{onConflict:'message_id,user_id'});
      if(user===uid()) refreshPrivateMessageNotifications();
    };
    async function load() {
      const {data,error}=await supabaseClient.from('private_messages').select('id,sender_id,message_text,image_url,created_at,cfa_system_receipt').eq('conversation_id',message.conversation_id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(30);
      if(token!==generation || user!==uid() || !panel) return;
      const box=panel.querySelector('.cfa-quick-messages');box.replaceChildren();
      if(error){box.textContent=tr('Rozhovor sa nepodarilo načítať.','Could not load the conversation.');return;}
      displayed=data||[];
      for(const m of [...displayed].reverse()) {const row=document.createElement('div');row.className=m.sender_id===user?'cfa-quick-own':'';row.textContent=m.message_text||(m.image_url?tr('Fotografia · otvorte celý rozhovor','Photo · open full conversation'):'');if(!window.CFASafety||window.CFASafety.decorateMessage(row,{kind:'private',id:m.id,author:m.sender_id,system:m.cfa_system_receipt}))box.append(row);}
      box.scrollTop=box.scrollHeight;
    }
    panel.querySelector('form').onsubmit=async event=>{
      event.preventDefault();if(window.CFASafety&&!await window.CFASafety.ensure('private'))return;const text=input.value.trim();if(!text || user!==uid()) return;
      const button=panel.querySelector('form button');button.disabled=true;input.disabled=true;
      const {error}=await supabaseClient.from('private_messages').insert({conversation_id:message.conversation_id,sender_id:user,receiver_id:null,message_text:text,image_url:null});
      if(token!==generation || user!==uid() || !panel) return;
      button.disabled=false;input.disabled=false;
      panel.querySelector('.cfa-quick-error').textContent=error?tr('Správa sa neodoslala. Skúste znova.','Message was not sent. Please try again.'):'';
      if(!error){input.value='';drafts.delete(String(message.conversation_id));await load();refresh();}
    };
    await load();
  }
  const style=document.createElement('style');style.textContent=`.cfa-quick-chat{position:fixed;right:12px;bottom:calc(90px * var(--cfa-nav-scale,1));z-index:100050;width:min(440px,92vw);max-height:65dvh;background:#fff;color:#123a40;border:2px solid #148886;border-radius:16px;box-shadow:0 8px 36px #0005;padding:12px;font:16px/1.4 sans-serif;box-sizing:border-box}.cfa-quick-chat header{display:flex;align-items:center;justify-content:space-between;gap:10px}.cfa-quick-chat button{min-height:44px;border:1px solid #acd4d0;border-radius:8px;background:#e7f5f1;color:#123a40;padding:8px;cursor:pointer}.cfa-quick-chat textarea{width:100%;box-sizing:border-box;font:inherit;padding:10px;border:1px solid #88aaa7;border-radius:8px}.cfa-quick-chat form{display:flex;gap:8px;margin:10px 0}.cfa-quick-messages{max-height:28dvh;overflow:auto;overscroll-behavior:contain}.cfa-quick-messages>div{white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 24px 6px 0;background:#eef5f5;padding:8px;border-radius:10px}.cfa-quick-messages>.cfa-quick-own{margin:6px 0 6px 24px;background:#d9f1e8}.cfa-quick-full{width:100%}.cfa-quick-more{display:flex;flex-wrap:wrap;gap:4px}.cfa-quick-error{color:#a32626}@media(pointer:coarse){.cfa-quick-chat{width:92vw;font-size:calc(16px * var(--cfa-nav-scale,1));right:4vw;max-height:65dvh}.cfa-quick-chat button{font:inherit;min-height:calc(44px * var(--cfa-nav-scale,1))}}`;
  document.head.append(style);
  window.CFAQuickChat={recent,refresh,incoming};
  setInterval(()=>{if(owner!==uid())reset();},1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});refresh();
})();
