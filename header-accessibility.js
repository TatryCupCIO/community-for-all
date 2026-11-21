/* Move original controls without replacing their handlers, state or identifiers. */
(function(){'use strict';if(window.CFAHeaderAccessibility)return;
const $=id=>document.getElementById(id),header=$('cfaApprovedHeader'),head=header?.querySelector('.head'),brand=header?.querySelector('.brand'),account=$('userTopBtn');
if(!head||!brand||!account)return;
const make=(id,cls)=>{const n=document.createElement('div');n.id=id;if(cls)n.className=cls;return n;};
const identity=make('cfaHeaderIdentity'),tools=make('cfaHeaderTools'),userRow=make('cfaHeaderUserRow');
head.prepend(identity);identity.append(brand);const support=header.querySelector('.support');if(support)identity.append(support);
head.append(tools);tools.append(userRow);userRow.append(account);
const language=header.querySelector('.language');if(language)userRow.append(language);
for(const [id,flag,sk,en]of [['skLangBtn','🇸🇰','Slovenčina','Slovak'],['enLangBtn','🇬🇧','Angličtina','English']]){const b=$(id);if(b){b.textContent=flag;b.dataset.flagLabelSk=sk;b.dataset.flagLabelEn=en;}}
const notifications=$('globalNotifications');if(notifications)tools.append(notifications);
const cart=header.querySelector('.cart-top-btn');if(cart)tools.append(cart);
const push=$('cfaWebPushSettings');if(push)tools.append(push);
const oldActions=header.querySelector('.actions');if(oldActions&&!oldActions.textContent.trim()&&!oldActions.querySelector('button,a'))oldActions.hidden=true;
function label(){for(const id of ['skLangBtn','enLangBtn']){const b=$(id);if(b){const s=currentLanguage==='en'?b.dataset.flagLabelEn:b.dataset.flagLabelSk;b.title=s;b.setAttribute('aria-label',s);b.setAttribute('aria-pressed',String(currentLanguage===(id==='skLangBtn'?'sk':'en')));}}}
const set=window.setLanguage;if(typeof set==='function')window.setLanguage=function(){const result=set.apply(this,arguments);label();return result;};label();
window.CFAHeaderAccessibility={refresh:label};
})();
