/* Presentation adapter: retains original DOM controls and application handlers. */
(function(){
'use strict';
if(window.CFACommunityDesign)return;
const byId=id=>document.getElementById(id);
const tr=(sk,en)=>currentLanguage==='en'?en:sk;
const strings=[];
function wording(node,sk,en){strings.push({node,sk,en});node.textContent=tr(sk,en);return node;}
function make(tag,sk,en,cls){const n=document.createElement(tag);if(cls)n.className=cls;if(sk!==undefined)wording(n,sk,en);return n;}
function button(sk,en,fn,cls='cfa-shell-button'){const b=make('button',sk,en,cls);b.type='button';b.addEventListener('click',fn);return b;}
const home=byId('homePage');if(!home)return;
const topbar=document.querySelector('.topbar'),brand=make('div',undefined,undefined,'cfa-brand');
for(const node of [document.querySelector('.logo'),document.querySelector('.charity')])if(node)brand.append(node);
if(topbar)topbar.prepend(brand);

const hero=make('section',undefined,undefined,'cfa-home-hero');
const copy=make('div');copy.append(make('p','KOMUNITA, V KTOREJ MÁŠ SVOJE MIESTO','A COMMUNITY WHERE YOU BELONG','cfa-home-kicker'),make('h1','Spolu je nám jednoducho lepšie.','Life is simply better together.'),make('p','Stretnúť známe tváre. Spoznávať nových ľudí. Dopriať deťom zážitky a sebe chvíľu medzi ľuďmi, s ktorými je dobre.','See familiar faces. Meet new people. Give children happy memories and enjoy time with people who make you feel welcome.'),button('Pozrieť podujatia','Explore events',()=>window.showEvents()));
hero.append(copy,make('div',undefined,undefined,'cfa-hero-image'));
const links=make('div',undefined,undefined,'cfa-home-links');
// Move existing buttons; never replace their listeners or child badges.
for(const child of Array.from(home.children))if(child.matches('button'))links.append(child);
home.prepend(hero,links);
const extras=make('div',undefined,undefined,'cfa-home-extras');
const about=make('section');about.append(make('h2','Aby sme k sebe mali bližšie.','Bringing us closer together.'),make('p','Spájame ľudí, rodiny a generácie prostredníctvom stretnutí, športu a rodinných podujatí. Pripravujeme ich srdcom, aby sa ľudia cítili vítaní a zo stretnutí vznikali priateľstvá.','We bring people, families and generations together through social gatherings, sport and family events. We put our hearts into helping people feel welcome and friendships grow.'),button('Viac o nás','More about us',()=>window.showAbout()));
const support=make('section');support.append(make('h2','Pomôžte vytvárať spoločné chvíle.','Help make shared moments possible.'),make('p','Ďakujeme každému, kto sa zapojí, podá pomocnú ruku alebo podporí našu činnosť.','Thank you to everyone who joins in, lends a hand or supports our work.'),button('Podporte nás','Support us',()=>window.showDonate()));extras.append(about,support);home.append(extras);
// Planned gallery/archive/partner administration is not presented as a working feature.
const gate=make('section',undefined,undefined,'cfa-private-gate');gate.id='cfaPrivateGate';gate.append(make('h1','Vitajte medzi nami','Welcome to our community'),make('p','Podujatia, fotografie aj rozhovory nájdete po prihlásení. Registrácia a používanie sú bezplatné.','Sign in to explore events, photographs and conversations. Registration and access are free.'),button('Prihlásiť sa','Sign in',()=>window.showLogin()),button('Zaregistrovať sa zadarmo','Register for free',()=>window.showRegister()));home.before(gate);
const nav=make('nav',undefined,undefined,'cfa-shell-nav');nav.setAttribute('aria-label',tr('Hlavná navigácia','Main navigation'));document.body.append(nav);
const messagesHub=make('section');messagesHub.id='cfaMessagesHub';messagesHub.className='page';messagesHub.style.display='none';
messagesHub.append(make('h2','Správy a komunita','Messages and community'),button('Súkromné správy','Private messages',()=>byId('privateMessagesBtn')?.click()),make('p','Rozhovory s jednotlivcami aj skupinami.','Conversations with individuals and groups.'),button('Komunitný chat','Community chat',()=>window.openCommunityChat()),make('p','Spoločné rozhovory našej komunity.','Conversations with our community.'));
document.querySelector('.container').append(messagesHub);pages.push('cfaMessagesHub');
function openMessages(){if(!requireLogin())return;window.go('cfaMessagesHub');}
function labelControl(id,sk,en){const control=byId(id);if(!control)return;const label=make('span',sk,en,'cfa-control-label');control.append(label);control.setAttribute('aria-label',tr(sk,en));}
labelControl('notificationBellBtn','Upozornenia','Notifications');
const communityLabel=byId('communityChatBtn')?.querySelector('span');if(communityLabel)wording(communityLabel,'Komunitný chat','Community chat');
const cart=document.querySelector('.cart-top-btn');if(cart)cart.append(wording(document.createElement('span'),'Košík','Cart'));
const contact=byId('contactPage');if(contact){const line=make('p');const a=make('a','info@tatrycupcio.uk','info@tatrycupcio.uk');a.href='mailto:info@tatrycupcio.uk';line.append(a);contact.prepend(line);}

for(const [icon,sk,en,fn] of [['⌂','Domov','Home',()=>window.showHome()],['▣','Podujatia','Events',()=>window.showEvents()],['✉','Správy','Messages',openMessages],['♧','Upozornenia','Notifications',()=>{if(requireLogin()){window.scrollTo({top:0,behavior:'smooth'});window.toggleNotificationsPanel();}}],['☺','Účet','Account',()=>window.openUserArea()]]){const b=document.createElement('button');b.type='button';const i=make('span',icon,icon);i.setAttribute('aria-hidden','true');b.append(i,wording(document.createElement('span'),sk,en));b.addEventListener('click',fn);nav.append(b);}
// Use existing routing and login forms. These guards are UX only; database policy audit is separate.
for(const name of ['showHome','showEvents','showEventDetail','showAbout','showDonate','showCartPage','showBookings']){const original=window[name];if(typeof original!=='function')continue;window[name]=function(){if(!currentUser){window.showLogin();return;}return original.apply(this,arguments);};}
const originalGo=window.go;if(typeof originalGo==='function')window.go=function(id){if(!currentUser&&!['loginPage','registerPage','forgotPage','resetPage'].includes(id)){window.showLogin();return;}return originalGo.apply(this,arguments);};
function refresh(){const signed=!!currentUser;document.body.classList.toggle('cfa-session-locked',!signed);gate.hidden=signed||['loginPage','registerPage','forgotPage','resetPage'].some(id=>byId(id)?.style.display==='block');nav.hidden=!signed||['chatPage','privateChatPage'].some(id=>{const n=byId(id);return n&&n.style.display!==''&&n.style.display!=='none';});const visible=id=>{const n=byId(id);return n&&n.style.display!==''&&n.style.display!=='none';};let active=visible('accountPage')?4:(visible('notificationPanel')?3:((visible('cfaMessagesHub')||visible('privateUsersPage')||visible('privateChatPage'))?2:((visible('eventsPage')||visible('eventDetailPage'))?1:0)));Array.from(nav.children).forEach((b,i)=>{if(i===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});byId('notificationBellBtn')?.setAttribute('aria-label',tr('Upozornenia','Notifications'));}
wording(document.querySelector('.footer'),'Registrovaná charitatívna organizácia č. 1216952','Registered charity no. 1216952');
const previousLanguage=window.setLanguage;window.setLanguage=function(){const result=previousLanguage.apply(this,arguments);for(const item of strings)item.node.textContent=tr(item.sk,item.en);nav.setAttribute('aria-label',tr('Hlavná navigácia','Main navigation'));refresh();return result;};
supabaseClient.auth.onAuthStateChange(()=>setTimeout(()=>{refresh();if(!currentUser)window.showLogin();},0));
let pending=false;const observer=new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;refresh();});});observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['style']});
const notificationBox=byId('cfaWebPushSettings');if(notificationBox){const help=notificationBox.querySelector(':scope > p');if(help){const updateHelp=()=>help.classList.toggle('cfa-notification-help-visible',/nepodpor|blokovan|nepodarilo|unsupported|blocked|could not|iPhone/i.test(help.textContent));new MutationObserver(updateHelp).observe(help,{childList:true,subtree:true,characterData:true});updateHelp();}}
refresh();window.CFACommunityDesign={refresh};
})();
