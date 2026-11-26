import { PDFDocument, rgb, degrees } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';

type TicketAssets = { regular: Uint8Array; bold: Uint8Array; logo: Uint8Array; eventLogo?: Uint8Array };
export async function createTestTicket(order: any, assets: TicketAssets): Promise<Uint8Array> {
  if (order.status !== 'paid' || order.currency !== 'GBP' || order.snapshot?.environment !== 'sandbox') throw new Error('ticket_not_paid');
  const s=order.snapshot,sk=order.language==='sk',e={...s.event,title:sk?s.event.title:(s.event.display_settings?.title_en||s.event.title)},tr=(a:string,b:string)=>sk?a:b;
  const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
  const regular=await doc.embedFont(assets.regular,{subset:true});
  const bold=await doc.embedFont(assets.bold,{subset:true});
  const logo=await doc.embedPng(assets.logo);
  let eventLogo:any=null;
  if(assets.eventLogo){
    try{eventLogo=await doc.embedPng(assets.eventLogo)}catch{eventLogo=await doc.embedJpg(assets.eventLogo)}
  }
  const glyphs=new Set(regular.getCharacterSet());
  const clean=(v:any)=>Array.from(String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ')).map(c=>glyphs.has(c.codePointAt(0)!)?c:'?').join('');
  const theme=e.display_settings?.ticket_theme||'community';
  const palette:Record<string,number[]>={community:[0.02,0.38,0.39],family:[0.43,0.22,0.05],sport:[0.06,0.25,0.40],winter:[0.14,0.23,0.43]};
  const p=palette[theme]||palette.community;
  const color=rgb(p[0],p[1],p[2]),ink=rgb(0.07,0.18,0.22),muted=rgb(0.30,0.40,0.43),white=rgb(1,1,1);
  const money=(n:any)=>'GBP '+Number(n||0).toFixed(2);
  const date=(d:any)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d)))return '';const [y,m,day]=String(d).split('-');return sk?`${Number(day)}. ${Number(m)}. ${y}`:`${day}/${m}/${y}`};
  function wrap(v:any,font:any,size:number,width:number){
    const words=clean(v).split(/\s+/).filter(Boolean),lines:string[]=[];let line='';
    for(const word of words){
      let parts=[''];
      for(const ch of word){const n=parts.length-1;if(font.widthOfTextAtSize(parts[n]+ch,size)>width&&parts[n])parts.push(ch);else parts[n]+=ch}
      for(const part of parts){const next=line?line+' '+part:part;if(font.widthOfTextAtSize(next,size)<=width)line=next;else{if(line)lines.push(line);line=part}}
    }
    if(line)lines.push(line);return lines.length?lines:[''];
  }
  let page:any,y=0;
  const text=(v:any,x:number,yy:number,size=10,font=regular,c=ink)=>page.drawText(clean(v),{x,y:yy,size,font,color:c});
  function image(im:any,x:number,yy:number,w:number,h:number){const scale=Math.min(w/im.width,h/im.height);page.drawImage(im,{x:x+(w-im.width*scale)/2,y:yy+(h-im.height*scale)/2,width:im.width*scale,height:im.height*scale})}
  function newPage(){
    page=doc.addPage([842,595]);
    page.drawRectangle({x:0,y:0,width:842,height:595,color:rgb(0.95,0.98,0.97)});
    page.drawRectangle({x:24,y:40,width:794,height:518,color:white,borderColor:rgb(0.79,0.87,0.85),borderWidth:1});
    page.drawRectangle({x:636,y:40,width:182,height:518,color});
    // Decorative orbital lines and a visible trial watermark; no QR code.
    for(let i=0;i<4;i++)page.drawEllipse({x:480,y:300,xScale:140+i*32,yScale:65+i*20,borderColor:color,borderWidth:0.5,borderOpacity:0.06,rotate:degrees(27)});
    page.drawText('TEST / SKUSOBNE',{x:115,y:190,size:43,font:bold,color,opacity:0.055,rotate:degrees(21)});
    image(logo,42,463,82,80);text('Community For All',140,528,13,bold,color);
    const title=wrap(e.title,bold,20,eventLogo?380:465).slice(0,2);title.forEach((l,i)=>text(l,140,498-i*24,20,bold));
    if(eventLogo)image(eventLogo,550,470,65,65);
    text(tr('SKÚŠOBNÁ VSTUPENKA','TEST TICKET'),652,525,12,bold,white);
    text(tr('NEPLATNÁ NA VSTUP','NOT VALID FOR ENTRY'),652,504,9,bold,white);
    const code=String(order.ticket_code).replace(/^TEST-/,'');
    text('TEST-',652,465,12,bold,white);
    code.match(/.{1,16}/g)?.forEach((part:string,i:number)=>text(part,652,445-i*18,10,bold,white));
    text(tr('Držiteľ rezervácie','Booking holder'),652,380,9,regular,white);
    let yy=361;
    for(const l of wrap(s.customer.name||s.customer.email,bold,11,148).slice(0,3)){text(l,652,yy,11,bold,white);yy-=15}
    yy-=10;for(const l of wrap(s.customer.email,regular,9,148).slice(0,6)){text(l,652,yy,9,regular,white);yy-=12}
    if(s.customer.phone){yy-=10;for(const l of wrap(s.customer.phone,regular,9,148).slice(0,2)){text(l,652,yy,9,regular,white);yy-=12}}
    text(tr('Skúšobne uhradené','Test amount paid'),652,158,9,regular,white);
    text(money(s.total),652,134,18,bold,white);
    text(tr('Skutočne stiahnuté: GBP 0.00','Real charge: GBP 0.00'),652,110,8,regular,white);
    if(order.paid_at){const issued=new Date(order.paid_at).toLocaleString(sk?'sk-SK':'en-GB',{timeZone:'Europe/London',dateStyle:'short',timeStyle:'short'});text(issued,652,85,8,regular,white)}
    text(date(e.start_date)+(e.end_date!==e.start_date?' - '+date(e.end_date):''),42,430,12,bold,color);
    y=409;
    for(const l of wrap([e.venue_name,e.address,e.postcode].filter(Boolean).join(', '),regular,10,572)){text(l,42,y,10);y-=14}
    y-=16;
    text(tr('PODROBNOSTI REZERVÁCIE','BOOKING DETAILS'),42,y,10,bold,color);y-=24;
  }
  function line(v:any,size=10,font=regular,c=ink){
    for(const l of wrap(v,font,size,568)){
      if(y<110)newPage();text(l,42,y,size,font,c);y-=size+5;
    }
  }
  const count=(v:any)=>Math.max(0,Number(v)||0);
  const ages=(v:any)=>Array.isArray(v)&&v.length?' ('+tr('vek: ','ages: ')+v.join(', ')+')':'';
  newPage();
  line(tr('Podujatie: ','Event: ')+e.title,10,bold);
  line(tr('Rezervujúca osoba: ','Booking holder: ')+[s.customer.name,s.customer.email,s.customer.phone].filter(Boolean).join(' | '),9);
  y-=8;
  for(const i of s.items){
    if(y<160)newPage();
    line(`${i.quantity} × ${sk?i.name_sk:i.name_en} | ${money(i.line_total)}`,11,bold);
    if(i.option_date||i.service_date)line(tr('Dátum: ','Date: ')+date(i.option_date||i.service_date),9,regular,muted);
    if(i.is_accommodation){
      if(i.night_start_date)line(tr('Príchod: ','Arrival: ')+date(i.night_start_date),9,regular,muted);
      line(tr('Počet nocí: ','Nights: ')+count(i.number_of_nights),9,regular,muted);
    }
    if(count(i.adult_count))line(tr('Dospelí: ','Adults: ')+count(i.adult_count),9,regular,muted);
    if(count(i.paid_child_count))line(tr('Deti s plateným miestom: ','Children with a paid place: ')+count(i.paid_child_count)+ages(i.paid_child_ages),9,regular,muted);
    if(count(i.free_child_count))line(tr('Bezplatne registrované deti: ','Children registered free: ')+count(i.free_child_count)+ages(i.free_child_ages),9,regular,muted);
    if(!count(i.paid_child_count)&&!count(i.free_child_count)&&i.child_ages?.length)line(tr('Vek detí: ','Children\'s ages: ')+i.child_ages.join(', '),9,regular,muted);
    if(count(i.bed_adult_count)||count(i.bed_child_count))line(tr('Vlastné lôžko - dospelí: ','Own bed - adults: ')+count(i.bed_adult_count)+tr(', deti: ',', children: ')+count(i.bed_child_count)+ages(i.bed_child_ages),9,regular,muted);
    if(count(i.no_bed_adult_count)||count(i.no_bed_child_count))line(tr('Bez vlastného lôžka - dospelí: ','Without own bed - adults: ')+count(i.no_bed_adult_count)+tr(', deti: ',', children: ')+count(i.no_bed_child_count)+ages(i.no_bed_child_ages),9,regular,muted);
    y-=10;
  }
  if(y<145)newPage();
  line(tr('Medzisúčet: ','Subtotal: ')+money(s.subtotal),10);
  line(tr('Zľava: ','Discount: ')+money(s.discount),10);
  line(tr('Celkom skúšobne uhradené: ','Total test amount paid: ')+money(s.total),12,bold,color);
  const pages=doc.getPages();pages.forEach((p:any,i:number)=>{
    page=p;text(tr('Skúšobná rezervácia. Tento doklad neoprávňuje na vstup ani na ubytovanie.','Test booking. This document does not permit admission or accommodation.'),42,78,8,bold);
    text('Tatry Cup Community Organisation CIO | Charity 1216952 | app@tatrycupcio.uk',42,61,7,regular,muted);
    text(`${i+1}/${pages.length}`,786,25,8,regular,muted);
  });
  doc.setTitle(tr('Skúšobná vstupenka - ','Test ticket - ')+e.title);
  doc.setAuthor('Tatry Cup Community Organisation CIO');
  doc.setSubject(order.ticket_code);doc.setCreator('Community For All');
  return doc.save();
}
