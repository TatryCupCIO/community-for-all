/* CFA event and option galleries. Files stay in the private event-photos bucket. */
(function () {
  'use strict';
  if (window.CFAEventPhotos) return;
  const tr = (sk,en) => T(sk,en);
  const make = (tag,text,cls) => { const n=document.createElement(tag); if(text!=null)n.textContent=text;if(cls)n.className=cls;return n; };
  const bucket = () => supabaseClient.storage.from('event-photos');
  const editors = new Set(), galleries = new Set(), urls = new Set();
  const settingsKey = kind => kind === 'events' ? 'display_settings' : 'booking_form_settings';
  function paths(settings) { return Array.isArray(settings?.photos) ? settings.photos.filter(p=>typeof p==='string').slice(0,6) : []; }
  function url(blob) { const u=URL.createObjectURL(blob);urls.add(u);return u; }
  function revoke(u) { if(u&&urls.delete(u))URL.revokeObjectURL(u); }
  const button = (text,fn,cls='') => { const b=make('button',text,'cfa-photo-button '+cls);b.type='button';b.onclick=fn;return b; };
  const style=make('style');style.id='cfaPhotoStyles';style.textContent=`
.cfa-photo-editor{border:1px solid #64748b;border-radius:12px;padding:14px;margin:16px 0;background:#10243b;color:#fff}
.cfa-photo-editor h3{margin:0 0 10px;font-size:18px}.cfa-photo-editor p{font-size:14px;line-height:1.5}
.cfa-photo-editor .cfa-photo-check,#cfaAdminDialog .cfa-photo-editor .cfa-photo-check{display:flex;align-items:center;gap:10px;margin:12px 0}.cfa-photo-check input{width:22px;height:22px;flex-shrink:0}
.cfa-photo-button{width:auto;min-height:44px;margin:4px;padding:8px 12px;border:1px solid #94a3b8;border-radius:8px;background:#1e3a50;color:#fff;cursor:pointer;font-size:14px;line-height:1.3}
.cfa-photo-button:disabled{opacity:.45;cursor:default}.cfa-photo-button:focus-visible,.cfa-photo-preview:focus-visible{outline:2px solid #67e8f9;outline-offset:3px}
.cfa-photo-button-primary{background:#0e7490}.cfa-photo-button-remove{background:#7f1d1d}
.cfa-photo-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:12px 0}
.cfa-photo-tile{border:1px solid #526480;border-radius:8px;padding:8px;min-width:0}.cfa-photo-tile img{display:block;width:100%;height:110px;object-fit:contain;background:#0b1524;border-radius:5px}.cfa-photo-tile strong{display:block;font-size:13px;margin:6px 0}
.cfa-photo-editor-status{font-size:14px;line-height:1.5;white-space:pre-wrap}.cfa-photo-editor-status[data-error=true]{color:#fda4af}
.cfa-public-gallery{margin:14px 0}.cfa-photo-preview{display:block;width:100%;padding:0;border:1px solid #64748b;border-radius:10px;overflow:hidden;background:#0b1524;color:#fff;cursor:pointer;text-align:left}
.cfa-photo-preview img{display:block;width:100%;height:180px;object-fit:contain}.cfa-photo-preview span{display:block;padding:9px 12px;font-size:14px;line-height:1.4}
.cfa-photo-viewer{box-sizing:border-box;width:min(1000px,96vw);max-width:96vw;max-height:94dvh;margin:auto;padding:12px;border:1px solid #94a3b8;border-radius:12px;background:#0b1524;color:#fff;overflow:auto}
.cfa-photo-viewer::backdrop{background:rgba(0,0,0,.85)}.cfa-photo-viewer:not([open]){display:none}.cfa-photo-viewer[open]{display:flex;flex-direction:column}
.cfa-photo-viewer-top,.cfa-photo-viewer-nav{display:flex;align-items:center;justify-content:space-between;gap:8px}.cfa-photo-viewer-title{font-size:16px;line-height:1.4;margin:0;overflow-wrap:anywhere}
.cfa-photo-viewer-image{display:block;width:100%;min-height:100px;max-height:70dvh;object-fit:contain;touch-action:pan-y pinch-zoom}.cfa-photo-viewer-image[hidden]{display:none}.cfa-photo-viewer-status{font-size:14px;line-height:1.4;min-height:20px}
@media(max-width:400px){.cfa-photo-list{grid-template-columns:1fr 1fr}.cfa-photo-button{padding:7px 9px;margin:3px}.cfa-photo-viewer{padding:9px}}
`;document.head.appendChild(style);

  let viewer=null,externalItems=null;
  function closeViewer() {
    if(externalItems){window.CFAPhotoTools?.closeScope(externalItems);externalItems=null;}
    if(!viewer)return;const old=viewer;viewer=null;old.stopped=true;
    if(typeof old.dialog.close==='function'&&old.dialog.open)old.dialog.close();
    old.dialog.remove();if(old.focus?.isConnected)old.focus.focus();
  }
  async function photoUrl(item) {
    if(item.url)return item.url;
    if(!item.loading)item.loading=(async()=>{
      const result=await bucket().download(item.path);if(result.error)throw result.error;
      if(!(result.data instanceof Blob)||!/^image\/(jpeg|png|webp)$/.test(result.data.type))throw new Error(tr('Nepodporovaný súbor obrázka.','Unsupported image file.'));
      const u=url(result.data);if(item.disposed){revoke(u);throw new Error('Gallery closed');}item.url=u;return u;
    })().catch(e=>{item.loading=null;throw e;});
    return item.loading;
  }
  function disposeItems(items) {
    window.CFAPhotoTools?.closeScope(items); items.forEach(item=>{item.disposed=true;revoke(item.url);}); }
  function openViewer(items,start,title) {
    closeViewer();if(!items.length)return;
    if(window.CFAPhotoTools){externalItems=items;return window.CFAPhotoTools.open(items.map(item=>({getUrl:()=>photoUrl(item),alt:title})),start,title,{scope:items});}
    const dialog=make('dialog',null,'cfa-photo-viewer');dialog.setAttribute('aria-label',tr('Prezeranie fotiek','Photo viewer'));
    const top=make('div',null,'cfa-photo-viewer-top');top.append(make('h2',title,'cfa-photo-viewer-title'),button(tr('Zavrieť ×','Close ×'),closeViewer));
    const image=make('img',null,'cfa-photo-viewer-image');image.hidden=true;image.draggable=false;
    const status=make('div','', 'cfa-photo-viewer-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const nav=make('div',null,'cfa-photo-viewer-nav'),counter=make('span');let index=start,revision=0;
    const state={dialog,focus:document.activeElement,stopped:false,items};viewer=state;
    const previous=button(tr('← Predošlá','← Previous'),()=>show(index-1));const next=button(tr('Ďalšia →','Next →'),()=>show(index+1));
    previous.hidden=next.hidden=items.length<2;nav.append(previous,counter,next);dialog.append(top,image,status,nav);document.body.append(dialog);
    async function show(i) {
      index=(i+items.length)%items.length;const own=++revision;image.hidden=true;counter.textContent=`${index+1} / ${items.length}`;
      status.textContent=tr('Načítavam fotku…','Loading photo…');image.alt=title+' · '+tr('Fotka ','Photo ')+(index+1);
      try{const src=await photoUrl(items[index]);if(state.stopped||own!==revision)return;image.src=src;image.hidden=false;status.textContent='';}
      catch(e){if(!state.stopped&&own===revision)status.textContent=tr('Fotku sa nepodarilo načítať. Skús ďalšiu alebo ju otvor znova.','The photo could not be loaded. Try another photo or reopen it.');}
    }
    dialog.addEventListener('cancel',e=>{e.preventDefault();closeViewer();});
    dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(index-1);}if(e.key==='ArrowRight'){e.preventDefault();show(index+1);}if(e.key==='Escape'){e.preventDefault();closeViewer();}});
    let touch=null;image.addEventListener('touchstart',e=>{touch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null;},{passive:true});
    image.addEventListener('touchend',e=>{if(!touch||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;touch=null;if(Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.4)show(index+(dx<0?1:-1));},{passive:true});
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
    show(index);
  }
  function gallery(settings,title) {
    if(settings?.show_photos!==true||!paths(settings).length)return null;
    const root=make('div',null,'cfa-public-gallery'),items=paths(settings).map(path=>({path}));
    const preview=button('',()=>openViewer(items,0,title));preview.className='cfa-photo-preview';preview.setAttribute('aria-label',tr('Otvoriť fotky: ','Open photos: ')+title);
    const image=make('img');image.alt=title;image.hidden=true;image.decoding='async';
    const caption=make('span',tr(`Zobraziť fotky (${items.length}) · klikni na zväčšenie`,`View photos (${items.length}) · tap to enlarge`));preview.append(image,caption);root.append(preview);
    const entry={root,items,dispose(){if(viewer?.items===items)closeViewer();disposeItems(items);galleries.delete(entry);}};galleries.add(entry);
    let started=false;async function load(){if(started)return;started=true;try{const src=await photoUrl(items[0]);if(!root.isConnected)return;image.src=src;image.hidden=false;}catch(e){if(root.isConnected)caption.textContent=tr('Otvoriť fotogalériu','Open photo gallery');}}
    if(typeof IntersectionObserver==='function'){const observer=new IntersectionObserver(records=>{if(records.some(r=>r.isIntersecting)){observer.disconnect();load();}},{rootMargin:'160px'});observer.observe(root);entry.observer=observer;}
    else queueMicrotask(load);
    return root;
  }
  async function prepare(file) {
    if(window.CFAPhotoTools){const blob=await window.CFAPhotoTools.compress(file);return {blob,url:url(blob)};}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>25*1024*1024)throw new Error(tr('Vyber JPG, PNG alebo WEBP do 25 MB.','Choose JPG, PNG or WEBP up to 25 MB.'));
    const temporary=URL.createObjectURL(file);
    try {
      const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error(tr('Obrázok sa nepodarilo otvoriť.','The image could not be opened.')));image.src=temporary;});
      const scale=Math.min(1,1920/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=canvas.getContext('2d');if(!ctx)throw new Error(tr('Telefón nedokázal pripraviť obrázok.','The device could not prepare the image.'));ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
      let blob;for(const quality of [.88,.75,.6]){blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=2*1024*1024)break;}
      if(!blob||blob.size>5*1024*1024)throw new Error(tr('Obrázok je príliš veľký. Vyber menšiu fotku.','The image is too large. Choose a smaller photo.'));
      return {blob,url:url(blob)};
    } finally { URL.revokeObjectURL(temporary); }
  }
  function editor(kind,record,requireAdmin,onSaved) {
    const root=make('section',null,'cfa-photo-editor');root.append(make('h3',tr('Fotky a zverejnenie','Photos and publication')));
    if(!record?.id){root.append(make('p',tr('Najprv ulož podujatie alebo položku. Potom tu môžeš pridať najviac šesť fotiek.','Save the event or option first. You can then add up to six photos here.')));return root;}
    const table=kind==='events'?'events':'event_options',key=settingsKey(kind);
    let original=paths(record[key]),originalVisible=record[key]?.show_photos===true,items=original.map(path=>({path})),active=false,disposed=false;
    const notice=make('p',tr('Najviac 6 fotiek. Prvá je náhľad. Fotky a ich zverejnenie sa ukladajú samostatným tlačidlom pod galériou.','Up to 6 photos. The first is the preview. Save photos and their publication setting with the separate button below the gallery.'));root.append(notice);
    const checkLabel=make('label',null,'cfa-photo-check'),visible=make('input');visible.type='checkbox';visible.checked=originalVisible;checkLabel.append(visible,make('span',tr('Zverejniť fotky','Publish photos')));root.append(checkLabel);
    const list=make('div',null,'cfa-photo-list');root.append(list);
    const files=make('input');files.type='file';files.accept='image/jpeg,image/png,image/webp';files.multiple=true;files.hidden=true;
    const status=make('div','', 'cfa-photo-editor-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const choose=button(tr('Pridať fotky','Add photos'),()=>{if(!active&&items.length<6)files.click();});
    const save=button(tr('Uložiť fotky a zverejnenie','Save photos and publication'),savePhotos,'cfa-photo-button-primary');
    root.append(files,choose,save,status);
    function pending(){return visible.checked!==originalVisible||items.some(i=>i.blob)||JSON.stringify(items.map(i=>i.path))!==JSON.stringify(original);}
    function feedback(text,error=false){if(disposed)return;status.textContent=text;status.dataset.error=String(error);status.setAttribute('role',error?'alert':'status');}
    function controls(){root.querySelectorAll('button,input').forEach(b=>b.disabled=active||b.dataset.photoBoundary==='true');choose.disabled=active||items.length>=6;files.disabled=active||items.length>=6;save.disabled=active||!pending();}
    function render(){
      list.replaceChildren();items.forEach((item,index)=>{
        const tile=make('div',null,'cfa-photo-tile'),image=make('img');image.alt=tr('Fotka ','Photo ')+(index+1);tile.append(image,make('strong',index===0?tr('1 · Hlavný náhľad','1 · Main preview'):String(index+1)));
        photoUrl(item).then(src=>{if(!disposed&&image.isConnected)image.src=src;}).catch(()=>{image.alt=tr('Fotku sa nepodarilo načítať','Photo could not be loaded');});
        const open=button(tr('Zväčšiť','Enlarge'),()=>openViewer(items,index,tr('Fotky','Photos')));
        const left=button('←',()=>{if(active||index===0)return;[items[index-1],items[index]]=[items[index],items[index-1]];render();});left.setAttribute('aria-label',tr('Presunúť skôr','Move earlier'));left.dataset.photoBoundary=String(index===0);left.disabled=index===0;
        const right=button('→',()=>{if(active||index===items.length-1)return;[items[index+1],items[index]]=[items[index],items[index+1]];render();});right.setAttribute('aria-label',tr('Presunúť neskôr','Move later'));right.dataset.photoBoundary=String(index===items.length-1);right.disabled=index===items.length-1;
        const remove=button(tr('Odstrániť','Remove'),()=>{if(active)return;if(viewer?.items===items)closeViewer();items.splice(index,1);disposeItems([item]);render();},'cfa-photo-button-remove');
        tile.append(open,left,right,remove);list.append(tile);
      });controls();
    }
    const state={root,pending, busy:()=>active,dispose(){disposed=true;if(viewer?.items===items)closeViewer();disposeItems(items);editors.delete(state);}};editors.add(state);
    visible.onchange=controls;
    files.onchange=async()=>{
      const selection=Array.from(files.files||[]);files.value='';if(active||!selection.length)return;
      if(selection.length+items.length>6){feedback(tr('Môžeš mať najviac šesť fotiek.','You can have up to six photos.'),true);return;}
      active=true;controls();const prepared=[];
      try{await requireAdmin();for(const file of selection)prepared.push(await prepare(file));if(disposed){disposeItems(prepared);return;}items.push(...prepared);feedback(tr('Fotky sú pripravené. Ulož ich tlačidlom pod galériou.','The photos are ready. Save them with the button below the gallery.'));}
      catch(e){disposeItems(prepared);feedback(e.message||tr('Fotky sa nepodarilo pripraviť.','The photos could not be prepared.'),true);}
      finally{active=false;if(!disposed)render();}
    };
    async function savePhotos(){
      if(active||!pending())return;active=true;controls();feedback(tr('Ukladám fotky…','Saving photos…'));const uploaded=[];
      try{
        await requireAdmin();if(disposed)return;
        const fresh=await supabaseClient.from(table).select('id,'+key).eq('id',record.id).single();if(fresh.error)throw fresh.error;
        const current=fresh.data[key]||{};
        if(JSON.stringify(paths(current))!==JSON.stringify(original)||(current.show_photos===true)!==originalVisible)throw new Error(tr('Galériu medzitým zmenil iný admin. Obnov formulár a skús znova.','Another admin changed the gallery. Reload the form and try again.'));
        const savedPaths=[];
        for(const item of items){
          if(!item.blob){savedPaths.push(item.path);continue;}
          const path=kind+'/'+record.id+'/'+crypto.randomUUID()+'.jpg';
          const result=await bucket().upload(path,item.blob,{contentType:'image/jpeg',cacheControl:'0',upsert:false});if(result.error)throw result.error;uploaded.push(path);savedPaths.push(path);
        }
        await requireAdmin();if(disposed)throw new Error(tr('Úprava galérie bola zatvorená.','The gallery editor was closed.'));
        const merged={...current,photos:savedPaths,show_photos:visible.checked};
        const saved=await supabaseClient.from(table).update({[key]:merged}).eq('id',record.id).filter(key,'eq',JSON.stringify(current)).select('id,'+key).maybeSingle();
        if(saved.error)throw saved.error;if(!saved.data)throw new Error(tr('Nastavenia sa medzitým zmenili. Skús uložiť znova.','The settings changed. Try saving again.'));
        const obsolete=original.filter(path=>!savedPaths.includes(path));
        original=savedPaths.slice();originalVisible=visible.checked;record[key]=merged;items.forEach((item,i)=>{item.path=savedPaths[i];delete item.blob;});
        uploaded.length=0;if(onSaved)onSaved(merged);
        feedback(tr('Fotky a nastavenie zverejnenia boli uložené.','Photos and publication settings saved.'));
        if(obsolete.length){try{const removed=await bucket().remove(obsolete);if(removed.error)console.warn('CFA gallery cleanup:',removed.error.message);}catch(cleanupError){console.warn('CFA gallery cleanup:',cleanupError.message);}}
      }catch(e){if(uploaded.length){try{await bucket().remove(uploaded);}catch(_){} }feedback(e.message||tr('Fotky sa nepodarilo uložiť.','The photos could not be saved.'),true);}
      finally{active=false;if(!disposed)render();}
    }
    render();return root;
  }
  function clearEditors(){for(const e of [...editors])e.dispose();}
  function clearAll(){closeViewer();clearEditors();for(const g of [...galleries]){g.observer?.disconnect();g.root.remove();g.dispose();}for(const u of [...urls])revoke(u);}
  const observer=new MutationObserver(()=>{for(const e of [...editors])if(!e.root.isConnected)e.dispose();for(const g of [...galleries])if(!g.root.isConnected){g.observer?.disconnect();g.dispose();}});observer.observe(document.body,{childList:true,subtree:true});
  let user;
  supabaseClient.auth.onAuthStateChange((event,session)=>{const next=session?.user?.id||null;if(user!==undefined&&user!==next)clearAll();user=next;});
  window.addEventListener('beforeunload',e=>{if([...editors].some(s=>s.pending())){e.preventDefault();e.returnValue='';}});
  window.CFAEventPhotos={editor,gallery,clearEditors,hasPendingEdits:()=>[...editors].some(e=>e.root.isConnected&&e.pending()),isBusy:()=>[...editors].some(e=>e.root.isConnected&&e.busy())};
})();
