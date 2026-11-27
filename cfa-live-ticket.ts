import { PDFDocument, rgb, degrees } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';

type TicketAssets = { regular: Uint8Array; bold: Uint8Array; logo: Uint8Array; eventLogo?: Uint8Array };
const n=(v:any)=>Math.max(0,Number(v)||0);
const date=(v:any)=>{const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:''};
const names=(i:any)=>[String(i.name_en||i.name_sk||i.item_name||''),String(i.name_sk||i.name_en||i.item_name||'')];
export function testEventNames(e:any):string[]{
  const sk=String(e.title||''),en=String(e.display_settings?.title_en||(/rodinn[eé]\s+olympijsk[eé]\s+hry/i.test(sk)?sk.replace(/rodinn[eé]\s+olympijsk[eé]\s+hry/i,'Family Olympic Games'):sk));
  return [en,sk];
}
// Every figure describes its own booking line. Accommodation occupants are never
// added to admission counts, and ages are shown only when present in the snapshot.
export function testItemDetails(i:any):string[]{
  const rows:string[]=[],age=(a:any)=>Array.isArray(a)&&a.length?' ('+a.join(', ')+')':'';
  if(i.option_date||i.service_date)rows.push('VALID / PLATÍ: '+date(i.option_date||i.service_date));
  if(i.is_accommodation){
    if(i.night_start_date)rows.push('ARRIVAL / PRÍCHOD: '+date(i.night_start_date));
    rows.push('NIGHTS / NOCI: '+n(i.number_of_nights));
  }
  if(n(i.adult_count))rows.push('ADULTS / DOSPELÍ: '+n(i.adult_count));
  if(n(i.paid_child_count))rows.push((i.is_accommodation?'CHILDREN WITH OWN BED / DETI NA LÔŽKU: ':'PAID CHILDREN / PLATIACE DETI: ')+n(i.paid_child_count)+age(i.paid_child_ages));
  if(n(i.free_child_count))rows.push((i.is_accommodation?(i.option_code==='small_tent'||i.option_code==='large_tent'||i.option_code==='caravan_motorhome'?'CHILDREN STAYING / UBYTOVANÉ DETI: ':'CHILDREN WITHOUT OWN BED / DETI BEZ VLASTNÉHO LÔŽKA: '):'REGISTERED CHILDREN / REGISTROVANÉ DETI: ')+n(i.free_child_count)+age(i.free_child_ages));
  if(!n(i.paid_child_count)&&!n(i.free_child_count)&&i.child_ages?.length)rows.push('CHILD AGES / VEK DETÍ: '+i.child_ages.join(', '));
  if(n(i.bed_adult_count)||n(i.bed_child_count))rows.push('OWN BED / VLASTNÉ LÔŽKO: '+n(i.bed_adult_count)+' adults / dospelí, '+n(i.bed_child_count)+' children / deti'+age(i.bed_child_ages));
  if(n(i.no_bed_adult_count)||n(i.no_bed_child_count))rows.push('NO OWN BED / BEZ LÔŽKA: '+n(i.no_bed_adult_count)+' adults / dospelí, '+n(i.no_bed_child_count)+' children / deti'+age(i.no_bed_child_ages));
  // State breakfast only when the purchased option explicitly includes it.
  if(/with breakfast|breakfast included|s raňajkami|vrátane raňajok/i.test(names(i).join(' ')))rows.unshift('BREAKFAST INCLUDED FOR PAID WEEKEND ADMISSION / RAŇAJKY K PLATENÉMU VÍKENDOVÉMU VSTUPNÉMU');
  return rows;
}
export type BillingRow={en:string;sk:string;quantity:number;unit:number;total:number};
const pennies=(v:any)=>Math.round(Number(v||0)*100);
const amount=(v:any)=>'GBP '+Number(v||0).toFixed(2);
export function itemBilling(i:any,stored?:BillingRow[]):BillingRow[]{
  const gross=pennies(i.original_line_total??i.line_total),qty=n(i.quantity)||1;
  if(stored?.length&&stored.every(r=>Number.isFinite(r.total)&&r.total>=0&&Number.isFinite(r.unit)&&r.unit>=0&&r.quantity>0&&pennies(r.quantity*r.unit)===pennies(r.total))&&stored.reduce((a,r)=>a+pennies(r.total),0)===gross)return stored;
  const [en,sk]=names(i),unit=pennies(i.unit_price);
  if(unit*qty===gross)return [{en,sk,quantity:qty,unit:unit/100,total:gross/100}];
  // Historical snapshots carry the unit room price. A remainder is labelled as
  // included mattress admission, never as another charge for accommodation.
  if(i.is_accommodation&&['private_lodge_4','private_room_2'].includes(i.option_code)&&unit*qty<=gross&&unit>0){
    const extra=gross-unit*qty,adults=n(i.no_bed_adult_count),ages=i.no_bed_child_ages?.length?i.no_bed_child_ages:(i.free_child_ages||[]),paid=ages.filter((v:number)=>v>=5).length;
    if(extra!==adults*3500+paid*1500)return [{en:en+' - package total',sk:sk+' - cena balíka',quantity:1,unit:gross/100,total:gross/100}];
    const rows:BillingRow[]=[{en:'Room package - fixed price',sk:'Balík izby - pevná cena',quantity:qty,unit:unit/100,total:unit*qty/100}];
    if(extra){const q=adults&&!paid?adults:paid&&!adults?paid:1;rows.push({en:adults&&!paid?'Weekend admission - mattress adults 18+':paid&&!adults?'Weekend admission - mattress children 5-17':'Mattress guest admission - total',sk:adults&&!paid?'Víkendové vstupné - dospelí na matraci 18+':paid&&!adults?'Víkendové vstupné - deti na matraci 5-17':'Vstupné osôb na matraci - spolu',quantity:q,unit:extra/100/q,total:extra/100})}
    return rows;
  }
  return [{en:en+' - package total',sk:sk+' - cena balíka',quantity:1,unit:gross/100,total:gross/100}];
}
export function prepareBilling(snapshot:any,options:any[]):BillingRow[][]{
  return snapshot.items.map((i:any)=>{
    const cfg=options.find(o=>String(o.id)===String(i.event_option_id));
    if(!i.is_accommodation||!cfg||!['private_lodge_4','private_room_2'].includes(i.option_code))return itemBilling(i);
    const q=n(i.quantity),nights=['per_room_per_night','per_night'].includes(cfg.pricing_unit)?n(i.number_of_nights):1;
    if(!q||!nights)return itemBilling(i);
    const base=pennies(i.unit_price)*q*nights;
    const rows:BillingRow[]=[{en:'Room package - fixed price'+(nights>1?' per night':''),sk:'Balík izby - pevná cena'+(nights>1?' za noc':''),quantity:q*nights,unit:pennies(i.unit_price)/100,total:base/100}];
    const ages=i.no_bed_child_ages?.length?i.no_bed_child_ages:(i.free_child_ages||[]);
    const guests=[{q:n(i.no_bed_adult_count),id:cfg.adult_ticket_option_id,en:'Weekend admission - mattress adults 18+',sk:'Víkendové vstupné - dospelí na matraci 18+'},
      {q:ages.filter((a:number)=>a>=5).length,id:cfg.child_ticket_option_id,en:'Weekend admission - mattress children 5-17',sk:'Víkendové vstupné - deti na matraci 5-17'},
      {q:ages.filter((a:number)=>a<5).length,id:cfg.free_child_ticket_option_id,en:'Admission - children aged 0-4',sk:'Vstupné - deti 0-4 roky'}];
    for(const g of guests){if(!g.q)continue;const t=options.find(o=>String(o.id)===String(g.id));if(!t||t.is_accommodation||t.admission_type!=='weekend'||!Number.isFinite(Number(t.price)))return itemBilling(i);
      rows.push({en:g.en,sk:g.sk,quantity:g.q,unit:pennies(t.price)/100,total:g.q*pennies(t.price)/100});}
    return itemBilling(i,rows);
  });
}
export function billingText(i:any,stored?:BillingRow[]):string[]{
  return itemBilling(i,stored).map(r=>r.en+' / '+r.sk+': '+r.quantity+' × '+amount(r.unit)+' = '+amount(r.total));
}
export const childPolicy='AGES 0-4: admission free, no included breakfast or competition entry; accompanied by a parent. / DETI 0-4: vstup zdarma, bez raňajok a súťaží, v sprievode rodiča.';
export function createLiveEmail(order:any):{subject:string;text:string}{
 const s=order.snapshot,e=s.event,titles=testEventNames(e);
 const items=s.items.map((i:any,index:number)=>[`${i.quantity} × ${names(i).join(' / ')}`,...testItemDetails(i),...billingText(i,s.billing_lines?.[index])].join('\n')).join('\n\n');
 return {subject:('Booking confirmed / Rezervácia potvrdená: '+titles.join(' / ')).replace(/[\r\n]/g,' ').slice(0,240),text:[
 'BOOKING CONFIRMED / REZERVÁCIA POTVRDENÁ',
 'Your reservation is confirmed. Your valid PDF ticket is attached.\nVaša rezervácia je potvrdená. Platná PDF vstupenka je v prílohe.',
 'TICKET / VSTUPENKA: '+order.ticket_code,
 'BOOKING HOLDER / DRŽITEĽ: '+[s.customer.name,s.customer.email].filter(Boolean).join(' | '),
 titles.join(' / '),date(e.start_date)+' - '+date(e.end_date),
 [e.venue_name,e.address,e.postcode].filter(Boolean).join(', '),items,
 'SUBTOTAL / MEDZISÚČET: '+amount(s.subtotal),
 'DISCOUNT / ZĽAVA: '+amount(s.discount),
 'AMOUNT PAID / UHRADENÉ: '+amount(s.total),
 Number(s.total)===0?'No card charge was made. / Z karty nebola stiahnutá žiadna suma.':'',
 'The ticket is valid only while the booking remains confirmed. / Vstupenka platí iba pri potvrdenej, nezrušenej rezervácii.',
 'Tatry Cup Community Organisation CIO | Charity 1216952 | app@tatrycupcio.uk'
 ].filter(Boolean).join('\n\n')};
}
export async function createLiveTicket(order:any,assets:TicketAssets):Promise<Uint8Array>{
  if(order.status!=='paid'||order.currency!=='GBP'||order.snapshot?.environment!=='live')throw new Error('ticket_not_paid');
  const s=order.snapshot,e=s.event,doc=await PDFDocument.create();doc.registerFontkit(fontkit);
  const regular=await doc.embedFont(assets.regular,{subset:true}),bold=await doc.embedFont(assets.bold,{subset:true});
  const logo=await doc.embedPng(assets.logo);let eventLogo:any=null;
  if(assets.eventLogo){try{eventLogo=await doc.embedPng(assets.eventLogo)}catch{eventLogo=await doc.embedJpg(assets.eventLogo)}}
  const glyphs=new Set(regular.getCharacterSet());
  const clean=(v:any)=>Array.from(String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ')).map(c=>glyphs.has(c.codePointAt(0)!)?c:'?').join('');
  const navy=rgb(.075,.13,.25),blue=rgb(.16,.28,.49),orange=rgb(.96,.40,.13),gold=rgb(1,.73,.23),muted=rgb(.32,.37,.46),white=rgb(1,1,1);
  const titles=testEventNames(e),money=(v:any)=>'GBP '+Number(v||0).toFixed(2);
  function wrap(v:any,font:any,size:number,width:number){
    const words=clean(v).split(/\s+/).filter(Boolean),lines:string[]=[];let line='';
    for(const word of words){let part='';for(const ch of word){if(font.widthOfTextAtSize(part+ch,size)>width&&part){if(line){lines.push(line);line=''}lines.push(part);part=ch}else part+=ch}const next=line?line+' '+part:part;if(font.widthOfTextAtSize(next,size)<=width)line=next;else{if(line)lines.push(line);line=part}}
    if(line)lines.push(line);return lines.length?lines:[''];
  }
  let page:any,y=0;
  const text=(v:any,x:number,yy:number,size=12,font=regular,c=navy)=>page.drawText(clean(v),{x,y:yy,size,font,color:c});
  const image=(im:any,x:number,yy:number,w:number,h:number)=>{const scale=Math.min(w/im.width,h/im.height);page.drawImage(im,{x:x+(w-im.width*scale)/2,y:yy+(h-im.height*scale)/2,width:im.width*scale,height:im.height*scale})};
  function newPage(details=false){
    page=doc.addPage([1050,470]);page.drawRectangle({x:0,y:0,width:1050,height:470,color:white});
    // Faceted decoration stays in the stub, away from registration information.
    page.drawRectangle({x:844,y:0,width:206,height:470,color:navy});
    page.drawSvgPath('M 0 0 L 206 0 L 206 140 Z',{x:844,y:470,color:blue});
    page.drawSvgPath('M 0 0 L 206 0 L 206 70 Z',{x:844,y:70,color:orange,opacity:.28});
    page.drawLine({start:{x:844,y:35},end:{x:844,y:440},color:gold,thickness:1,dashArray:[4,5]});
    page.drawRectangle({x:0,y:462,width:844,height:8,color:orange});
    // Subtle watermark below the content, with no effect on contrast.
    page.drawText('COMMUNITY FOR ALL',{x:160,y:65,size:36,font:bold,color:blue,opacity:.035,rotate:degrees(13)});
    image(logo,24,380,63,66);text('COMMUNITY FOR ALL',103,436,10,bold,blue);
    const width=eventLogo?620:700;
    let titleSize=21;while(titleSize>8&&wrap(titles[0],bold,titleSize,width).length>2)titleSize--;
    const main=wrap(titles[0],bold,titleSize,width);
    main.forEach((l,i)=>text(l,103,412-i*23,titleSize,bold));
    const subtitle=titles[1]===titles[0]?'EVENT PASS / VSTUPENKA NA PODUJATIE':titles[1];
    let subSize=11;while(subSize>6&&bold.widthOfTextAtSize(clean(subtitle),subSize)>width)subSize--;
    text(subtitle,103,main.length===2?365:387,subSize,bold,blue);
    if(eventLogo)image(eventLogo,765,390,58,58);
    text(date(e.start_date)+(e.end_date!==e.start_date?' - '+date(e.end_date):''),28,370,16,bold);
    let vy=353;for(const l of wrap([e.venue_name,e.address,e.postcode].filter(Boolean).join(', '),regular,10.5,790)){text(l,28,vy,10.5,regular,muted);vy-=13}
    y=Math.min(330,vy-12);
    if(details){text('Booking holder / Držiteľ: '+(s.customer.name||s.customer.email),28,y,12,bold);y-=22}else{
    text('BOOKING HOLDER / DRŽITEĽ REZERVÁCIE',28,y,9,bold,blue);y-=24;
    for(const l of wrap(s.customer.name||s.customer.email,bold,21,790)){text(l,28,y,21,bold);y-=25}
    text([s.customer.email,s.customer.phone].filter(Boolean).join(' | '),28,y+4,10,regular,muted);y-=16;
    }
    text('EVENT TICKET',861,432,19,bold,white);text('VSTUPENKA',861,414,10,bold,white);
    page.drawRectangle({x:858,y:338,width:178,height:54,color:gold});
    text('PAYMENT',869,372,12,bold);text('COMPLETE',869,354,16,bold);
    text('ZAPLATENÉ',861,318,11,bold,white);
    text('CONFIRMED BOOKING',861,278,10,bold,white);text('POTVRDENÁ REZERVÁCIA',861,262,10,bold,white);
    text('RESERVATION / REZERVÁCIA',861,222,9,bold,white);
    wrap(order.ticket_code,bold,10,168).forEach((l,i)=>text(l,861,201-i*15,10,bold,white));
    text('Total / Celkom',861,100,9,regular,white);text(money(s.total),861,80,13,bold,white);
    text('Currency / Mena: GBP',861,54,8,regular,white);
    if(order.paid_at)text(new Date(order.paid_at).toLocaleString('en-GB',{timeZone:'Europe/London',dateStyle:'short',timeStyle:'short'}),861,32,8,regular,white);
  }
  newPage();
  // The first pass is a registration overview: admissions on the left,
  // accommodation on the right. Complete original option wording follows.
  const shortened=(i:any)=>{
    const [en,sk]=names(i),all=en+' '+sk;
    if(/weekend|víkend/i.test(all)&&/adult|dospel/i.test(all)&&/18/.test(all)&&!i.is_accommodation)return ['WEEKEND - ADULT 18+','VÍKEND - DOSPELÝ OD 18 ROKOV'];
    if(/weekend|víkend/i.test(all)&&/child|dieťa/i.test(all)&&/5\s*[-–]\s*17/.test(all)&&!i.is_accommodation)return ['WEEKEND - CHILD 5-17','VÍKEND - DIEŤA 5-17 ROKOV'];
    if(/small tent|malý stan/i.test(all))return ['SMALL TENT PITCH','MIESTO PRE VLASTNÝ MALÝ STAN'];
    if(/four[ -]*bed|4[ -]*(?:bed|lôžkov)/i.test(all))return ['FOUR-BED SCOUT ROOM','ŠTVORLÔŽKOVÁ SKAUTSKÁ IZBA'];
    return [en,sk];
  };
  const top=y;
  const groups=[s.items.filter((i:any)=>!i.is_accommodation),s.items.filter((i:any)=>i.is_accommodation)];
  const overviewPages=[page];
  groups.forEach((items:any[],col:number)=>{
    let cy=top,pi=0;page=overviewPages[0];const x=28+col*408;
    const nextColumnPage=()=>{pi++;if(!overviewPages[pi]){newPage();overviewPages.push(page)}else page=overviewPages[pi];cy=top;};
    text(col?'ACCOMMODATION / UBYTOVANIE':'ADMISSION / VSTUP',x,cy,10,bold,blue);cy-=23;
    for(const i of items){
      const [en,sk]=shortened(i),rows:any[]=[];
      wrap(`${i.quantity} × ${en}`,bold,15,375).forEach(v=>rows.push({v,size:15,font:bold,c:navy}));
      if(sk!==en)wrap(sk,regular,10,375).forEach(v=>rows.push({v,size:10,font:regular,c:muted}));
      const details:string[]=[];
      if(i.option_date||i.service_date)details.push('Valid / Platí: '+date(i.option_date||i.service_date));
      if(i.is_accommodation)details.push((i.night_start_date?'From / Od: '+date(i.night_start_date)+' | ':'')+'Nights / Noci: '+n(i.number_of_nights));
      if(n(i.adult_count))details.push('Adults / Dospelí: '+n(i.adult_count));
      if(n(i.paid_child_count))details.push((i.is_accommodation?'Children with bed / Deti na lôžku: ':'Paid children / Platiace deti: ')+n(i.paid_child_count)+' | Age / Vek: '+(i.paid_child_ages||[]).join(', '));
      if(n(i.free_child_count))details.push((i.is_accommodation&&['small_tent','large_tent','caravan_motorhome'].includes(i.option_code)?'Children staying / Ubytované deti: ':'Children without bed / Deti bez lôžka: ')+n(i.free_child_count)+' | Age / Vek: '+(i.free_child_ages||[]).join(', '));
      if(!n(i.paid_child_count)&&!n(i.free_child_count)&&i.child_ages?.length)details.push('Child ages / Vek detí: '+i.child_ages.join(', '));
      if(testItemDetails(i).some(d=>d.startsWith('BREAKFAST')))details.unshift('BREAKFAST / RAŇAJKY: PAID WEEKEND / PLATENÝ VÍKEND');
      for(const d of details)wrap(d,bold,10.5,375).forEach(v=>rows.push({v,size:10.5,font:bold,c:blue}));
      const h=rows.reduce((a:number,r:any)=>a+r.size+2,0)+7;
      if(cy-h<43&&h<top-66){nextColumnPage();text(col?'ACCOMMODATION / UBYTOVANIE':'ADMISSION / VSTUP',x,cy,10,bold,blue);cy-=23}
      page.drawRectangle({x:x-12,y:cy-3,width:4,height:17,color:orange});
      for(const r of rows){if(cy-r.size<43)nextColumnPage();text(r.v,x,cy,r.size,r.font,r.c);cy-=r.size+2}
      cy-=7;
    }

  });
  // Full wording, bed allocation and financial detail stay available, without
  // reducing the size of the information checked at the gate.
  newPage(true);text('FULL BOOKING DETAILS / ÚPLNÉ PODROBNOSTI REZERVÁCIE',28,y,12,bold,blue);y-=23;
  for(const [index,i] of s.items.entries()){
    const [en,sk]=names(i),rows:any[]=[];
    wrap(`${i.quantity} × ${en}`,bold,12,780).forEach(v=>rows.push({v,size:12,font:bold,c:navy}));
    if(sk!==en)wrap(sk,regular,10,780).forEach(v=>rows.push({v,size:10,font:regular,c:muted}));
    for(const d of testItemDetails(i).filter(d=>d.startsWith('OWN BED')||d.startsWith('NO OWN BED')))wrap(d,bold,9,780).forEach(v=>rows.push({v,size:9,font:bold,c:blue}));
    for(const b of billingText(i,s.billing_lines?.[index]))wrap(b,bold,10,780).forEach(v=>rows.push({v,size:10,font:bold,c:navy}));
    const h=rows.reduce((a:number,r:any)=>a+r.size+3,0)+10;
    if(y-h<44&&h<250)newPage(true);
    for(const r of rows){if(y-r.size<44)newPage(true);text(r.v,28,y,r.size,r.font,r.c);y-=r.size+3}y-=10;
  }
  for(const line of wrap(childPolicy,regular,8,790)){if(y<45)newPage(true);text(line,28,y,8,regular,muted);y-=11}
  // Financial details are subordinate and remain available on the final page.
  const financial='Subtotal / Medzisúčet: '+money(s.subtotal)+'    Discount / Zľava: '+money(s.discount)+'    Total / Celkom: '+money(s.total);
  if(y<42)newPage(true);text(financial,28,y,9,regular,muted);
  const pages=doc.getPages();pages.forEach((p:any,i:number)=>{page=p;
    text('Valid with an active booking. / Platí s aktívnou, nezrušenou rezerváciou.',28,24,8,bold);
    text('Tatry Cup Community Organisation CIO | Charity 1216952 | app@tatrycupcio.uk',28,10,7,regular,muted);
    text(`${i+1} / ${pages.length}`,794,10,8,bold,muted);
  });
  doc.setTitle('EVENT TICKET / VSTUPENKA - '+titles[0]);doc.setAuthor('Tatry Cup Community Organisation CIO');doc.setSubject(order.ticket_code);doc.setCreator('Community For All');return doc.save();
}
