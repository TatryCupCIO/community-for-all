/* Owner reward workflow and immutable member archive. All decisions are server-side. */
(function(){'use strict';if(window.CFARewards)return;
const $=id=>document.getElementById(id),tr=(sk,en)=>currentLanguage==='en'?en:sk;
const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
const button=(text,fn)=>{const n=el('button',text);n.type='button';n.style.cssText='background:#192b49!important;color:#fff!important;border:0!important;box-shadow:none!important';n.onclick=fn;return n;};
const style=el('style');style.textContent=`
#cfaRewardDialog{box-sizing:border-box;width:min(950px,96vw);max-height:92dvh;overflow:auto;padding:24px;background:#fff!important;color:#17243d!important;border:1px solid #bfc8d6;border-radius:14px}
#cfaRewardDialog::backdrop{background:#162338aa}#cfaRewardDialog:not([open]){display:none}
#cfaRewardDialog *,#cfaRewardPersonal *{box-sizing:border-box;overflow-wrap:anywhere}
#cfaRewardDialog button,#cfaRewardsButton,#cfaRewardsHeaderButton{background:#192b49!important;color:#fff!important;border:0!important;border-radius:8px;padding:12px 16px!important;min-height:46px;line-height:1.5;font-weight:700;font-size:18px;cursor:pointer}
#cfaRewardDialog button:disabled{opacity:.55;cursor:wait}#cfaRewardsButton{display:block;width:100%;margin:16px 0}#cfaRewardsHeaderButton{font-size:14px;margin:6px}
#cfaRewardDialog h2,#cfaRewardDialog h3,#cfaRewardDialog p,#cfaRewardDialog label,#cfaRewardDialog summary{color:#17243d!important}
#cfaRewardDialog .cfa-reward-card,#cfaRewardPersonal .cfa-reward-card{padding:18px;margin:16px 0;border:1px solid #c9d0dc;border-radius:10px;background:white!important;color:#17243d!important}
#cfaRewardDialog label{display:block;margin:12px 0;font-weight:650}#cfaRewardDialog input,#cfaRewardDialog select,#cfaRewardDialog textarea{display:block;width:100%;max-width:100%;min-height:44px;padding:10px;margin-top:6px;background:white!important;color:#17243d!important;border:1px solid #8c98aa!important;border-radius:6px;font-size:18px}
#cfaRewardDialog textarea{min-height:70px}#cfaRewardDialog .cfa-reward-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
#cfaRewardDialog .cfa-reward-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}#cfaRewardDialog [aria-pressed=true]{outline:3px solid #ec711c;outline-offset:2px}
#cfaRewardDialog .cfa-reward-info,#cfaRewardPersonal .cfa-reward-info{white-space:pre-wrap;font-size:16px;line-height:1.6;color:#17243d!important;background:transparent!important;border:0!important;padding:0!important}
#cfaRewardDialog .cfa-reward-card>h3{margin:0 0 8px!important}#cfaRewardDialog .cfa-reward-card>p{margin:8px 0!important;font-size:18px!important;line-height:1.5!important}
#cfaRewardDialog .cfa-reward-gift{margin:12px 0;border-bottom:1px solid #d7dce5;padding-bottom:10px}
#cfaRewardPersonal .cfa-reward-card h4,#cfaRewardPersonal .cfa-reward-card p{color:#17243d!important}#cfaRewardPersonal summary{cursor:pointer;font-weight:750;min-height:44px;padding:12px 0}
@media(max-width:600px){#cfaRewardDialog .cfa-reward-grid{grid-template-columns:1fr}}
`;document.head.append(style);
let requestedReward=new URL(location.href).searchParams.get('cfa-reward'),mailPending=0;
let owner=false,viewer=null,epoch=0,list=[],environment='live',tab='earned',busy=false,search='',selected=null,timer=null;
const drafts=new Map();let personalCache=null,personalFlight=0,ownerFlight=0;
const dialog=el('dialog');dialog.id='cfaRewardDialog';dialog.style.cssText='box-sizing:border-box!important;width:min(950px,96vw)!important;max-width:96vw!important;background:#fff!important;color:#17243d!important;border:1px solid #bfc8d6!important';dialog.setAttribute('aria-label',tr('Odmeny','Rewards'));
const title=el('h2'),status=el('p');status.className='cfa-reward-info';status.setAttribute('role','status');const body=el('div');
const close=button('',()=>{if(!busy)dialog.close()});dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});dialog.append(close,title,status,body);document.body.append(dialog);
const account=button('',()=>open());account.id='cfaRewardsButton';account.hidden=true;$('accountPage')?.querySelector('.card')?.append(account);
const header=button('',()=>open());header.id='cfaRewardsHeaderButton';header.hidden=true;$('cfaHeaderTools')?.append(header);
const mode=()=>window.CFABookingSandbox?.testMode?'sandbox':'live';
const date=v=>v?new Date(v).toLocaleString(currentLanguage==='en'?'en-GB':'sk-SK',{timeZone:'Europe/London',dateStyle:'short',timeStyle:'short'}):'';
const amount=n=>'GBP '+Number(n||0).toFixed(2);
const archived=r=>['delivered','message_provided'].includes(r.state);
const state=r=>({earned:tr('Nárok získaný','Entitlement earned'),assigned:tr('Na osobné odovzdanie','Awaiting personal collection'),delivered:tr('Odovzdané osobne','Handed over in person'),message_provided:tr('Poskytnuté správou','Provided by private message')})[r.state]||r.state;
const textItems=r=>(r.items||[]).map(i=>(currentLanguage==='en'?i.en:i.sk)+' / '+(currentLanguage==='en'?i.sk:i.en)).join('\n');
function errorMessage(error){return /reward_changed/.test(String(error?.message||error))?tr('Záznam už bol zmenený. Obnovujem prehľad.','This entry has changed. Refreshing the list.'):tr('Úpravu sa nepodarilo dokončiť. Obnovte prehľad; ak problém pretrváva, pošlite nám túto obrazovku.','Could not complete the change. Refresh the list; if it persists, send us this screen.');}
async function rpc(name,args){const r=await supabaseClient.rpc(name,args);if(r.error)throw r.error;return r.data;}
function badges(){const n=list.filter(r=>r.eligible&&!archived(r)).length;const s=tr('Odmeny','Rewards')+(environment==='sandbox'?tr(' · SKÚŠKA',' · TEST'):'')+' · '+n;account.textContent=header.textContent=s;account.hidden=header.hidden=!owner||!currentUser;}
function receipt(r){const card=el('article');card.className='cfa-reward-card';card.append(el('p',(r.display_name||'')+' · '+(r.email||'')),el('h4',tr('Odmena za ','Reward for ')+r.required_points+tr(' bodov',' points')),el('p',state(r)));
 const items=el('p',textItems(r)||tr('Obsah odmeny doplní náš tím.','Our team will specify your reward.'));items.className='cfa-reward-info';card.append(items);
 if(!r.eligible&&!archived(r))card.append(el('p',tr('Nárok je pozastavený po zmene úhrady.','Entitlement paused following a payment change.')));
 if(r.state==='assigned')card.append(el('p',tr('Na najbližšom podujatí organizovanom Tatry Cup Community Organisation CIO nás osobne vyhľadajte a preukážte sa týmto nárokom v aplikácii. Pred vydaním overíme jeho platnosť.','At the next event organised by Tatry Cup Community Organisation CIO, please find our team and show this entitlement in the app. We will verify it before handing over your reward.')));
 if(r.coupon_code){card.append(el('p',tr('Jednorazový kupón pre váš účet: ','Single-use coupon for your account: ')+r.coupon_code),el('p',r.coupon_percent+'% · '+tr('Platnosť do: ','Valid until: ')+date(r.coupon_expires)),el('p',r.coupon_used?tr('Kupón bol využitý.','Coupon used.'):tr('Kupón zatiaľ nebol využitý.','Coupon not yet used.')));}
 if(r.coupon_checkout_url){try{const u=new URL(r.coupon_checkout_url);if(u.protocol==='https:'&&['sandbox.square.link','square.link','sandbox.checkout.square.site','checkout.square.site','checkout.squareupsandbox.com'].includes(u.hostname)){const a=el('a',tr('Pokračovať v skúšobnej platbe s kupónom','Resume test checkout with this coupon'));a.href=u.href;card.append(a)}}catch{}}
 if(r.closed_at)card.append(el('p',tr('Vybavené: ','Completed: ')+date(r.closed_at)+(r.closed_by_name?' · '+r.closed_by_name:'')));
 card.append(el('p',tr('Číslo nároku: ','Reward ID: ')+r.id));return card;
}
function personalDraw(host,data){host.replaceChildren();host.append(el('h3',tr('Aktívne odmeny','Active rewards')));
 const claims=data?.claims||[],active=claims.filter(r=>!archived(r)),history=claims.filter(archived);
 if(!active.length)host.append(el('p',tr('Zatiaľ nemáte odmenu čakajúcu na vybavenie.','No rewards awaiting completion.')));for(const r of active)host.append(receipt(r));
 const archive=el('details'),summary=el('summary',tr('Archív odmien','Reward archive')+' · '+history.length);archive.append(summary);for(const r of history)archive.append(receipt(r));host.append(archive);
}
async function renderPersonal(host,sandbox){
 const section=el('section');section.id='cfaRewardPersonal';host.append(section);const uid=currentUser?.id;if(!uid)return;const gen=epoch,env=sandbox?'sandbox':'live',seq=++personalFlight;
 if(personalCache?.uid===uid&&personalCache.env===env)personalDraw(section,personalCache.data);else section.append(el('p',tr('Načítavam odmeny…','Loading rewards…')));
 try{const data=await rpc('cfa_reward_list',{p_environment:env,p_admin:false});if(gen!==epoch||uid!==currentUser?.id||seq!==personalFlight)return;personalCache={uid,env,data};personalDraw(section,data)}
 catch{if(gen===epoch&&seq===personalFlight)section.replaceChildren(el('p',tr('Odmeny sa nepodarilo načítať. Skúste Obnoviť.','Could not load rewards. Try Refresh.')))}
}
function inputLabel(label,node){const l=el('label',label);l.append(node);return l;}
function overview(){
 body.replaceChildren();title.textContent=tr('Správa odmien','Manage rewards')+(environment==='sandbox'?tr(' · SKÚŠKA',' · TEST'):'');close.textContent=tr('Zavrieť','Close');
 const tools=el('div');tools.className='cfa-reward-tabs';const env=el('select');env.setAttribute('aria-label',tr('Prostredie odmien','Reward environment'));for(const [v,label]of [['sandbox',tr('Skúšobné odmeny','Test rewards')],['live',tr('Skutočné odmeny','Live rewards')]]){const o=el('option',label);o.value=v;env.append(o)}env.value=environment;env.onchange=()=>{environment=env.value;selected=null;refreshOwner()};tools.append(env,button(tr('Obnoviť','Refresh'),()=>refreshOwner()));body.append(tools);if(mailPending){body.append(el('p',tr('E-maily čakajúce na odoslanie: ','Emails awaiting delivery: ')+mailPending),button(tr('Zopakovať odoslanie e-mailov','Retry pending emails'),async()=>{try{await rpc('cfa_reward_retry_mail');status.textContent=tr('Čakajúce e-maily sa odošlú znovu.','Pending emails will be retried.')}catch{status.textContent=tr('Odosielanie zatiaľ nebolo obnovené.','Sending has not been resumed yet.')}}));}
 const tabs=el('div');tabs.className='cfa-reward-tabs';for(const [v,label]of [['earned',tr('Nové nároky','New entitlements')],['assigned',tr('Na odovzdanie','To hand over')],['archive',tr('Archív','Archive')]]){const count=list.filter(r=>v==='archive'?archived(r):r.state===v).length;const b=button(label+' · '+count,()=>{tab=v;selected=null;overview()});b.setAttribute('aria-pressed',String(tab===v));tabs.append(b)}body.append(tabs);
 const find=el('input');find.type='search';find.value=search;find.placeholder=tr('Hľadať meno alebo e-mail','Search name or email');find.setAttribute('aria-label',find.placeholder);find.oninput=()=>{search=find.value;selected=null;drawCards()};body.append(find);
 const cards=el('div');body.append(cards);
 function drawCards(){cards.replaceChildren();for(const r of list){if(tab==='archive'?!archived(r):r.state!==tab)continue;if(selected&&r.id!==selected)continue;if(!(r.display_name+' '+r.email).toLowerCase().includes(search.toLowerCase()))continue;
  const card=el('article');card.className='cfa-reward-card';card.append(el('h3',r.display_name),el('p',r.email),el('p',tr('Nárok za ','Entitlement for ')+r.required_points+tr(' bodov',' points')),el('p',tr('Suma započítaných rezervácií: ','Qualifying bookings total: ')+amount(r.qualifying_amount)),el('p',state(r)));
  const source=el('details');source.append(el('summary',tr('Započítané rezervácie','Qualifying bookings')));for(const b of r.source_bookings||[])source.append(el('p',b.title+' · '+amount(b.amount)+' · '+b.points+tr(' bodov',' points')));card.append(source);
  if(!r.eligible&&!archived(r))card.append(el('p',tr('Pozastavené po zmene úhrady.','Paused following a payment change.')));
  if(r.state==='earned'&&r.eligible)assignment(card,r);
  else{const txt=el('p',textItems(r)||tr('Odmena od nášho tímu','Reward from our team'));txt.className='cfa-reward-info';card.append(txt);
   if(r.coupon_code)card.append(el('p',r.coupon_percent+'% · '+r.coupon_code+' · '+(r.coupon_used?tr('Využitý','Used'):tr('Nevyužitý','Not used'))));
   if(r.closed_at)card.append(el('p',tr('Vybavené: ','Completed: ')+date(r.closed_at)+(r.closed_by_name?' · '+r.closed_by_name:'')));
   if(r.state==='assigned'&&r.eligible)card.append(button(tr('Odovzdané osobne','Handed over in person'),()=>act(r,'deliver')));
   if(archived(r))card.append(button(tr('Odstrániť z môjho prehľadu','Remove from my overview'),()=>{if(confirm(tr('Odstrániť z vášho prehľadu? História príjemcu a evidencia vybavenia zostanú zachované.','Remove from your overview? The recipient history and completion record will remain.')))act(r,'hide')}));
  }
  card.append(el('p',tr('Číslo nároku: ','Reward ID: ')+r.id));cards.append(card);
 }if(!cards.children.length)cards.append(el('p',tr('V tomto zozname nie sú odmeny.','No rewards in this list.')));}
 drawCards();for(const n of body.querySelectorAll('button,input,select,textarea'))n.disabled=busy;close.disabled=busy;
}
function assignment(card,r){
 const draft=drafts.get(r.id)||{items:[{sk:'',en:''}],method:'personal',percent:20,days:90};drafts.set(r.id,draft);
 const method=el('select');for(const [v,label]of [['personal',tr('Osobné prevzatie na našom podujatí','Personal collection at our event')],['message',tr('Poskytnúť súkromnou správou','Provide by private message')],['coupon',tr('Jednorazový zľavový kupón správou','Single-use discount coupon by message')]]){const o=el('option',label);o.value=v;method.append(o)}method.value=draft.method;
 method.onchange=()=>{draft.method=method.value;overview()};card.append(inputLabel(tr('Spôsob odovzdania','Delivery method'),method));
 const count=el('select');count.setAttribute('aria-label',tr('Počet položiek odmeny','Number of reward items'));for(let i=0;i<=20;i++){const o=el('option',String(i));o.value=String(i);count.append(o)}count.value=String(draft.items.length);count.onchange=()=>{const size=Number(count.value);while(draft.items.length<size)draft.items.push({sk:'',en:''});draft.items.length=size;overview()};card.append(inputLabel(tr('Počet položiek odmeny (popis je nepovinný)','Number of reward items (description optional)'),count));
 draft.items.forEach((item,i)=>{const row=el('div');row.className='cfa-reward-grid cfa-reward-gift';for(const [lang,label]of [['sk','Slovensky'],['en','English / Anglicky']]){const text=el('textarea');text.value=item[lang];text.maxLength=500;text.oninput=()=>item[lang]=text.value;row.append(inputLabel((i+1)+'. '+label,text))}card.append(row)});
 if(draft.method==='coupon'){const pct=el('input');pct.type='number';pct.min='1';pct.max='99';pct.step='1';pct.value=String(draft.percent);pct.oninput=()=>draft.percent=Number(pct.value);const days=el('input');days.type='number';days.min='1';days.max='730';days.value=String(draft.days);days.oninput=()=>draft.days=Number(days.value);card.append(inputLabel(tr('Zľava v percentách','Discount percentage'),pct),inputLabel(tr('Platnosť v dňoch','Validity in days'),days));}
 card.append(button(tr('Prideliť a oznámiť','Assign and notify'),()=>{
  if(draft.items.some(i=>!!i.sk.trim()!==!!i.en.trim())){status.textContent=tr('Každú vyplnenú položku uveďte po slovensky aj anglicky, alebo nechajte obe polia prázdne.','Enter each item in Slovak and English, or leave both fields empty.');return;}
  if(draft.method==='coupon'&&(!Number.isInteger(draft.percent)||draft.percent<1||draft.percent>99||!Number.isInteger(draft.days)||draft.days<1||draft.days>730)){status.textContent=tr('Zadajte zľavu 1–99 % a platnosť 1–730 dní.','Enter a discount of 1–99% and validity of 1–730 days.');return;}
  act(r,'assign',{p_items:draft.items,p_method:draft.method,p_percent:draft.method==='coupon'?draft.percent:null,p_days:draft.days});
 }));
}
async function act(r,action,extra={}){
 if(busy||!owner||!currentUser)return;busy=true;overview();const uid=currentUser.id,gen=epoch;status.textContent=tr('Ukladám…','Saving…');
 try{const result=await rpc('cfa_reward_update',{p_claim:r.id,p_action:action,p_revision:r.revision,...extra});if(gen!==epoch||uid!==currentUser?.id)return;
  if(!result.ok)throw Error(result.error);drafts.delete(r.id);personalCache=null;status.textContent=action==='hide'?tr('Záznam je odstránený z vášho prehľadu.','Entry removed from your overview.'):tr('Uložené. Súkromná správa príjemcovi je zaznamenaná.','Saved. The recipient private message has been recorded.');
  await refreshOwner(false);window.CFALoyaltyTreasure?.refresh();
 }catch(e){if(gen===epoch){status.textContent=errorMessage(e);await refreshOwner(false)}}finally{if(gen===epoch){busy=false;overview()}}
}
async function refreshOwner(clear=true){
 if(!owner||!currentUser)return;const uid=currentUser.id,gen=epoch,seq=++ownerFlight,env=environment;
 if(clear)status.textContent=tr('Načítavam…','Loading…');
 try{const data=await rpc('cfa_reward_list',{p_environment:env,p_admin:true});if(gen!==epoch||uid!==currentUser?.id||seq!==ownerFlight)return;list=data.claims||[];mailPending=Number(data.pending_mail)||0;badges();if(clear)status.textContent='';if(dialog.open)overview()}
 catch{if(gen===epoch&&seq===ownerFlight){list=[];badges();status.textContent=tr('Správa odmien ešte nie je dostupná. Dokončite prípravu v časti Skúšobná rezervácia a stlačte Obnoviť.','Reward management is not available yet. Complete setup in the test booking section and press Refresh.');if(dialog.open)overview()}}
}
async function open(id){if(!currentUser)return;if(!owner)await refresh();if(!owner)return;selected=id||null;environment=mode();const url=new URL(location.href);if(id&&['live','sandbox'].includes(url.searchParams.get('reward-mode')))environment=url.searchParams.get('reward-mode');
 if(!dialog.open)dialog.showModal();overview();await refreshOwner();if(id){const r=list.find(r=>r.id===id);if(r){tab=archived(r)?'archive':r.state;overview()}}}
async function refresh(){const uid=currentUser?.id,gen=epoch;if(!uid){reset();return}viewer=uid;
 try{const yes=await rpc('cfa_is_owner');if(gen!==epoch||uid!==currentUser?.id)return;owner=yes===true;if(!dialog.open)environment=mode();badges();if(owner){await refreshOwner(false);if(requestedReward){const id=requestedReward;requestedReward=null;open(id)}}else if(requestedReward){requestedReward=null;if(new URL(location.href).searchParams.get('reward-mode')==='sandbox'){await window.CFABookingSandbox?.refreshAuth();window.CFABookingSandbox?.setMode(true)}if(gen!==epoch||uid!==currentUser?.id)return;const chest=$('cfaTreasureBtn');if(chest)chest.click();else window.addEventListener('cfa-loyalty-ready',()=>{if(uid===currentUser?.id)$('cfaTreasureBtn')?.click()},{once:true})}}catch{if(gen===epoch){owner=false;badges()}}}
function reset(){epoch++;viewer=null;owner=false;list=[];personalCache=null;drafts.clear();busy=false;selected=null;status.textContent='';body.replaceChildren();document.querySelectorAll('#cfaRewardPersonal').forEach(n=>n.replaceChildren());badges();if(dialog.open)dialog.close();}
supabaseClient.auth.onAuthStateChange(()=>{reset();setTimeout(refresh,0)});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)refresh()});
const language=window.setLanguage;if(typeof language==='function')window.setLanguage=function(){const r=language.apply(this,arguments);badges();if(dialog.open)overview();return r};
window.CFARewards={open,refresh,renderPersonal,destroy:()=>clearInterval(timer)};timer=setInterval(()=>{if(!document.hidden&&!busy)refresh()},60000);
refresh();
})();
