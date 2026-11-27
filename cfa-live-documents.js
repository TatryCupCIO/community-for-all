/* Live booking documents. No client action changes payment or inventory. */
(()=>{'use strict';if(window.CFALiveDocuments)return;
const tr=(sk,en)=>currentLanguage==='en'?en:sk,node=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
let epoch=0;const uid=()=>currentUser?.id;
async function attach(card,id){
 const owner=uid(),gen=epoch;if(!owner||card.dataset.cfaLiveDocument)return;card.dataset.cfaLiveDocument='loading';
 let data,error;try{({data,error}=await supabaseClient.rpc('cfa_live_document_state',{p_booking:String(id)}))}catch{return;}
 if(gen!==epoch||uid()!==owner||!card.isConnected)return;
 if(error||!data){delete card.dataset.cfaLiveDocument;return;}
 card.dataset.cfaLiveDocument='ready';const box=node('section'),title=node('strong',tr('Vstupenka a potvrdenie','Ticket and confirmation')),status=node('p'),actions=node('div');
 box.className='cfa-live-document';box.style.cssText='margin-top:14px;padding:14px;border:1px solid #9ccabd;border-radius:12px;background:#e7f6ef;color:#164d46';status.setAttribute('role','status');box.append(title,status,actions);card.append(box);
 const valid=()=>gen===epoch&&uid()===owner&&card.isConnected;
 function paint(s){status.textContent=s?.mail_status==='sent'?tr('Potvrdenie s PDF bolo odoslané na ','Confirmation with PDF was sent to ')+s.recipient:s?.mail_status==='failed'?tr('Rezervácia je potvrdená. E-mail sa zatiaľ nepodarilo odoslať; PDF si môžete stiahnuť.','Your booking is confirmed. Email delivery has not succeeded yet; you can download the PDF.'):tr('Rezervácia je potvrdená. Pripravujeme e-mail s PDF.','Your booking is confirmed. Preparing the email with PDF.');}
 const button=(label,fn)=>{const b=node('button',label);b.type='button';b.className='secondary-btn';b.style.cssText='min-height:44px;padding:12px;margin:6px 8px 0 0';b.onclick=fn;actions.append(b);return b;};
 const retry=button(tr('Overiť doručenie','Check delivery'),async()=>{retry.disabled=true;try{const r=await supabaseClient.functions.invoke('cfa-live-documents',{body:{action:'status',booking_id:String(id)}});if(!valid())return;if(r.error||!r.data?.ok)throw Error();paint(r.data);}catch{if(valid())status.textContent=tr('Stav doručenia sa nepodarilo načítať. Rezerváciu neobjednávajte znova.','Could not load delivery status. Do not book again.');}finally{if(valid())retry.disabled=false;}});
 const pdf=button(tr('Stiahnuť PDF vstupenku','Download PDF ticket'),async()=>{pdf.disabled=true;try{const r=await supabaseClient.auth.getSession();if(r.error||!r.data.session?.access_token)throw Error();
 const response=await fetch(SUPABASE_URL+'/functions/v1/cfa-live-documents',{method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+r.data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'pdf',booking_id:String(id)})});
 if(!response.ok)throw Error();const blob=await response.blob();if(!blob.type.includes('application/pdf'))throw Error();if(!valid())return;
 const url=URL.createObjectURL(blob),link=node('a');link.href=url;link.download='CFA-vstupenka-'+id+'.pdf';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }catch{if(valid())status.textContent=tr('PDF sa nepodarilo stiahnuť. Skúste znova neskôr.','Could not download the PDF. Try again later.');}finally{if(valid())pdf.disabled=false;}});
 paint(data);
}
supabaseClient.auth.onAuthStateChange(()=>{epoch++;document.querySelectorAll('.cfa-live-document').forEach(n=>n.remove());});
window.CFALiveDocuments={attach};
})();
