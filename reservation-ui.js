/* Community For All: event information, linked reservations and per-option controls. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const t = (sk, en) => T(sk, en);
  const previousAvailabilityInfo = availabilityInfo;
  availabilityInfo = function (option) {
    const info = previousAvailabilityInfo(option);
    return option?.availability_status === 'sold_out' ? {...info, color: '#ff4d5e'} : info;
  };
  const node = (tag, value, cls) => {
    const n = document.createElement(tag);
    if (value != null) n.textContent = value;
    if (cls) n.className = cls;
    return n;
  };
  const setting = (o, key) => o?.booking_form_settings?.[key] !== false;
  const privateRoom = o => ['private_room_2', 'private_lodge_4'].includes(o.option_code);
  const errorText = error => {
    const value = String(error?.message || error || t('Operácia sa nepodarila.', 'The operation failed.'));
    const parts = value.split(' / ');
    return parts.length === 2 ? parts[currentLanguage === 'en' ? 1 : 0] : value;
  };
  function statusBox(parent) {
    const box = node('div', '', 'cfa-reservation-message');
    box.hidden = true;
    box.setAttribute('role', 'status');
    parent.appendChild(box);
    return (message, error = false) => {
      box.hidden = !message;
      box.textContent = message;
      box.classList.toggle('cfa-reservation-error', error);
      box.setAttribute('role', error ? 'alert' : 'status');
      if (error) box.scrollIntoView?.({block: 'nearest', behavior: 'smooth'});
    };
  }
  function field(parent, label, min, value = '', max) {
    const wrap = node('label', null, 'cfa-reservation-field');
    const input = node('input');
    input.type = 'number'; input.inputMode = 'numeric'; input.step = '1';
    input.min = String(min); input.value = String(value); input.required = true;
    if (max != null) input.max = String(max);
    wrap.append(node('span', label), input); parent.appendChild(wrap);
    return input;
  }
  function integer(input, min = 0) {
    if (!input || input.value.trim() === '') return null;
    const n = Number(input.value);
    return Number.isInteger(n) && n >= min ? n : null;
  }
  function validationSummary(box, button, message, error, disabled) {
    box.classList.toggle('cfa-reservation-error', !!error);
    box.setAttribute('role', error ? 'alert' : 'status');
    box.setAttribute('aria-live', error ? 'assertive' : 'polite');
    if (message != null) box.textContent = message;
    button.disabled = !!disabled;
    button.setAttribute('aria-disabled', String(!!disabled));
    button.style.setProperty('opacity', disabled ? '0.45' : '1', 'important');
    button.style.cursor = disabled ? 'not-allowed' : 'pointer';
  }
  function nightsForItem(item) {
    if (!item?.night_start_date) return [];
    const date = new Date(item.night_start_date + 'T12:00:00');
    return Array.from({length: Number(item.number_of_nights || 1)}, (_, i) => {
      const d = new Date(date); d.setDate(d.getDate() + i); return extDateISO(d);
    });
  }
  let pendingEdit = null, activeEdit = null, renderGeneration = 0;
  function dayControl(row, option, event) {
    const form = node('form', null, 'cfa-linked-form');
    const note = statusBox(form);
    const quantity = field(form, t('Počet vstupeniek', 'Number of tickets'), 1, 1);
    const ageBox = node('div', null, 'cfa-reservation-grid'); form.appendChild(ageBox);
    let ages = [];
    function ageFields() {
      const old = ages.map(i => i.value); ages = []; ageBox.replaceChildren();
      if (!isChild(option)) return;
      const count = Math.min(500, integer(quantity, 1) || 0);
      for (let i = 0; i < count; i++) ages.push(field(ageBox, t(`Vek dieťaťa ${i + 1}`, `Child ${i + 1} age`), Number(option.min_age ?? 0), old[i] ?? '', Number(option.max_age ?? 17)));
    }
    ageFields();
    const label = node('label', null, 'cfa-reservation-field');
    const day = node('select'); day.required = true;
    const dates = option.option_date ? [option.option_date] : extEventDates(event);
    if (dates.length !== 1) { const empty = node('option', t('Vyberte deň', 'Select day')); empty.value = ''; day.appendChild(empty); }
    for (const date of dates) { const item = node('option', extShortDate(date)); item.value = date; day.appendChild(item); }
    label.append(node('span', t('Deň návštevy', 'Visit date')), day); form.appendChild(label);
    const summary = node('div', '', 'cfa-package-summary'); summary.setAttribute('aria-live', 'polite');
    const add = node('button', t('Pridať vstupenky', 'Add tickets'), 'add-btn'); add.type = 'submit';
    form.append(summary, add); let busy = false;
    const update = () => {
      const q = integer(quantity, 1);
      let error = '';
      if (quantity.value.trim() !== '' && (!q || q > 500)) error = t('Zadajte platný celý počet vstupeniek.', 'Enter a valid whole number of tickets.');
      const invalidAge = ages.some(i => i.value.trim() !== '' && (integer(i) == null || Number(i.value) < Number(option.min_age ?? 0) || Number(i.value) > Number(option.max_age ?? 17)));
      if (invalidAge) error = t(`Vek dieťaťa musí byť ${option.min_age ?? 0}–${option.max_age ?? 17} rokov.`, `The child’s age must be ${option.min_age ?? 0}–${option.max_age ?? 17}.`);
      if (isTbd(option)) error = t('Cena tejto možnosti ešte nie je nastavená.', 'The price for this option has not been set.');
      const missing = ages.some(i => i.value.trim() === '') || !day.value || !q;
      const message = error || (missing ? t('Vyplňte počet vstupeniek, veky všetkých detí a deň návštevy.', 'Enter the ticket quantity, every child’s age and the visit date.') : t('Spolu: ', 'Total: ') + money(Number(option.price) * q));
      validationSummary(summary, add, message, !!error, busy || !!error || missing);
    };
    quantity.oninput = () => { ageFields(); update(); };
    form.addEventListener('input', update); day.addEventListener('change', update); update();
    form.onsubmit = async ev => {
      ev.preventDefault(); if (busy || isTbd(option) || !form.reportValidity() || !requireLogin()) return;
      const q = integer(quantity, 1), childAges = ages.map(i => integer(i));
      if (!q || q > 500 || !dates.includes(day.value) || childAges.some(a => a == null || a < Number(option.min_age ?? 0) || a > Number(option.max_age ?? 17))) return;
      busy = true; update();
      try {
        const result = await supabaseClient.rpc('add_item_to_cart', {p_event_option_id: option.id, p_quantity: q, p_child_ages: childAges,
          p_number_of_days: 1, p_number_of_nights: 1, p_option_date: day.value, p_adult_count: isChild(option) ? 0 : q});
        if (result.error) throw result.error;
        await refreshCartBadge(); note(t('Vstupenky sú v košíku.', 'The tickets are in your cart.'));
      } catch (error) { note(errorText(error), true); }
      finally { busy = false; update(); }
    };
    row.appendChild(form);
  }
  function linkedControl(row, option, event, edit) {
    const form = node('form', null, 'cfa-linked-form');
    const note = statusBox(form);
    const quantities = node('div', null, 'cfa-reservation-grid');
    form.appendChild(quantities);
    const unitLabel = currentLanguage === 'en'
      ? option.booking_form_settings?.unit_label_en
      : option.booking_form_settings?.unit_label_sk;
    const tent = ['small_tent', 'large_tent'].includes(option.option_code);
    const units = field(quantities, unitLabel || (tent ? t('Počet stanov', 'Number of tents') : t('Počet ubytovacích jednotiek', 'Number of accommodation units')), 1, edit?.quantity || 1);
    if (!setting(option, 'show_unit_counter')) units.closest('label').hidden = true;
    const minimum = Math.max(1, Number(option.minimum_adults || 1));
    const adults = field(quantities, t('Dospelí od 18 rokov', 'Adults aged 18+'), minimum, edit?.adult_count ?? '');
    const children = field(quantities, t('Počet detí (uveďte aj 0)', 'Number of children (enter 0 if none)'), 0, edit ? (edit.child_ages || []).length : '', 500);
    const ageBox = node('div', null, 'cfa-reservation-grid'); form.appendChild(ageBox);
    let ageInputs = [];
    function updateAgeFields() {
      const saved = ageInputs.map(i => i.value);
      const count = Math.min(500, integer(children) ?? 0);
      ageBox.replaceChildren(); ageInputs = [];
      for (let i = 0; i < count; i++) {
        ageInputs.push(field(ageBox, t(`Vek dieťaťa ${i + 1}`, `Child ${i + 1} age`), 0,
          saved[i] ?? edit?.child_ages?.[i] ?? '', 17));
      }
    }
    updateAgeFields();
    const dates = node('fieldset', null, 'cfa-night-options');
    dates.appendChild(node('legend', t('Vyberte noci pobytu', 'Select the nights of your stay')));
    const selected = new Set(edit ? nightsForItem(edit) : []);
    const eventNights = extEventNights(event);
    for (const day of eventNights.slice(0, 366)) {
      const label = node('label'); const input = node('input');
      input.type = 'checkbox'; input.value = day; input.checked = selected.has(day);
      input.onchange = () => { input.checked ? selected.add(day) : selected.delete(day); update(); };
      label.append(input, node('span', extNightLabel(day))); dates.appendChild(label);
    }
    form.appendChild(dates);
    const summary = node('div', '', 'cfa-package-summary'); summary.setAttribute('aria-live', 'polite');
    const info = node('p', t('Vstupenky pre všetkých uvedených hostí sa pridajú automaticky za celý pobyt.',
      'Tickets for every listed guest are added automatically for the full stay.'), 'cfa-reservation-help');
    if (!setting(option, 'show_linked_ticket_note')) info.hidden = true;
    const button = node('button', edit ? t('Uložiť zmeny rezervácie', 'Save booking changes') : tent ? t('Pridať stan aj vstupenky', 'Add tent and tickets') : t('Pridať ubytovanie aj vstupenky', 'Add accommodation and tickets'), 'add-btn');
    button.type = 'submit';
    form.append(summary, info, button);
    if (edit) {
      const cancel = node('button', t('Zrušiť úpravu', 'Cancel editing'), 'cfa-reservation-secondary'); cancel.type = 'button';
      cancel.onclick = () => { activeEdit = null; pendingEdit = null; showEventDetail(event.id); };
      form.appendChild(cancel);
    }
    const all = () => (allEventOptions || []);
    let busy = false;
    function details() {
      const q = integer(units, 1), a = integer(adults, minimum), c = integer(children);
      const ages = ageInputs.map(i => integer(i));
      const tickets = [option.adult_ticket_option_id, option.child_ticket_option_id, option.free_child_ticket_option_id]
        .map(id => all().find(o => Number(o.id) === Number(id)));
      if (units.value.trim() !== '' && q == null) return {error: t('Počet ubytovacích jednotiek musí byť celé číslo aspoň 1.', 'Accommodation quantity must be a whole number of at least 1.')};
      if (adults.value.trim() !== '' && a == null) return {error: t(`Rezervácia musí zahŕňať aspoň ${minimum} dospelú osobu vo veku 18 rokov alebo viac. Zadajte celý počet dospelých.`, `The booking must include at least ${minimum} adult aged 18 or over. Enter a whole number of adults.`)};
      if (children.value.trim() !== '' && (c == null || c > 500)) return {error: t('Zadajte platný celý počet detí. Ak deti neprídu, zadajte 0.', 'Enter a valid whole number of children. Enter 0 if no children are coming.')};
      if (q == null || a == null || c == null) return null;
      const capacity = Number(option.max_occupancy || 0) * q;
      if (!capacity || a + c > capacity) return {error: t(`Zadali ste ${a + c} osôb. Maximálna kapacita je ${capacity} osôb. Znížte počet hostí.`, `You entered ${a + c} guests. Maximum capacity is ${capacity} people. Reduce the guest count.`)};
      if (ageInputs.some(i => i.value.trim() !== '' && (integer(i) == null || Number(i.value) > 17))) return {error: t('Pri každom dieťati zadajte celý vek od 0 do 17 rokov.', 'Enter a whole age from 0 to 17 for every child.')};
      if (ages.length !== c || ages.some(v => v == null)) return null;
      if (!selected.size || selected.size > 366) return null;
      const nights = [...selected].sort();
      const positions = nights.map(d => eventNights.indexOf(d));
      if (positions.some((n, i) => n < 0 || (i > 0 && n !== positions[i - 1] + 1))) return {error: t('Vyberte po sebe nasledujúce noci.', 'Select consecutive nights.')};
      if (!tickets[0]) return {error: t('Prepojené vstupenky ešte nie sú zapnuté. Kontaktujte organizátora.', 'Linked tickets are not enabled yet. Contact the organiser.')};
      let paid = 0, free = 0;
      for (const age of ages) {
        const matches = [1, 2].filter(i => tickets[i] && age >= Number(tickets[i].min_age) && age <= Number(tickets[i].max_age));
        if (matches.length !== 1) return {error: t('Pre uvedený vek dieťaťa nie je dostupná správna vstupenka.', 'A matching ticket is unavailable for a child’s age.')};
        matches[0] === 1 ? paid++ : free++;
      }
      const nightly = ['per_night', 'per_tent_per_night', 'per_room_per_night', 'per_vehicle_per_night'].includes(option.pricing_unit);
      const accommodation = Number(option.price || 0) * q * (nightly ? nights.length : 1);
      return {q, a, c, ages, nights, paid, free, tickets, accommodation,
        total: accommodation + a * Number(tickets[0].price) + paid * Number(tickets[1]?.price || 0) + free * Number(tickets[2]?.price || 0)};
    }
    function update() {
      const d = details();
      validationSummary(summary, button, null, !!d?.error, busy || !d || !!d.error);
      summary.replaceChildren();
      if (!d) { summary.textContent = t('Vyplňte počty osôb, veky detí a noci pobytu.', 'Enter all guest counts, child ages and nights.'); return; }
      if (d.error) { summary.textContent = d.error; return; }
      summary.append(node('strong', t(`Spolu ${d.a + d.c} osôb · ${money(d.total)} za pobyt`, `${d.a + d.c} guests · ${money(d.total)} for the stay`)));
      summary.append(node('div', `${d.a}× ${localName(d.tickets[0])}: ${money(d.a * Number(d.tickets[0].price))}`));
      if (d.paid) summary.append(node('div', `${d.paid}× ${localName(d.tickets[1])}: ${money(d.paid * Number(d.tickets[1].price))}`));
      if (d.free) summary.append(node('div', `${d.free}× ${localName(d.tickets[2])}: ${money(d.free * Number(d.tickets[2].price))}`));
      summary.append(node('div', `${localName(option)}: ${money(d.accommodation)}`));
    }
    children.oninput = () => { updateAgeFields(); update(); };
    form.addEventListener('input', update);
    form.onsubmit = async ev => {
      ev.preventDefault(); if (busy || !form.reportValidity()) return;
      if (!requireLogin()) return;
      const d = details(); if (!d || d.error) { note(d?.error || t('Doplňte všetky údaje.', 'Complete every field.'), true); return; }
      busy = true; update(); note(t('Ukladám rezerváciu…', 'Saving booking…'));
      try {
        const args = {p_adult_count: d.a, p_child_ages: d.ages, p_nights: d.nights, p_quantity: d.q};
        const rpc = edit ? 'update_camping_package_in_cart' : 'add_camping_package_to_cart';
        if (edit) args.p_booking_item_id = edit.id; else args.p_event_option_id = option.id;
        const result = await supabaseClient.rpc(rpc, args); if (result.error) throw result.error;
        await refreshCartBadge();
        const cart = await getActiveCart(); if (cart && typeof extSetBookingLanguage === 'function') await extSetBookingLanguage(cart.id);
        if (edit) { activeEdit = null; await showCartPage(); }
        else { note(t('Ubytovanie aj správne vstupenky sú v košíku.', 'The accommodation and matching tickets are in your cart.')); button.hidden = true;
          const next = node('button', t('Otvoriť košík', 'Open cart'), 'cfa-reservation-secondary'); next.type = 'button'; next.onclick = () => showCartPage(); form.appendChild(next);
          const another = node('button', t('Nová rezervácia', 'New booking'), 'cfa-reservation-secondary'); another.type = 'button'; another.onclick = () => showEventDetail(event.id); form.appendChild(another); }
      } catch (error) { note(errorText(error), true); }
      finally { busy = false; update(); }
    };
    row.appendChild(form); update();
  }
  function roomControl(row, option, event) {
    const form = node('form', null, 'cfa-linked-form');
    form.classList.add('cfa-room-form');
    const notify = statusBox(form);
    if (setting(option, 'show_guest_title')) form.append(node('h4', t('Hostia v tejto rezervácii', 'Guests in this booking')));
    const grid = node('div', null, 'cfa-reservation-grid'); form.append(grid);
    const unitLabel = option.booking_form_settings?.[currentLanguage === 'en' ? 'unit_label_en' : 'unit_label_sk'];
    const units = field(grid, unitLabel || t('Počet izieb', 'Number of rooms'), 1, 1, 500);
    if (!setting(option, 'show_unit_counter')) units.closest('label').hidden = true;
    const adults = field(grid, t('Dospelí na pevných lôžkach (18+)', 'Adults using permanent beds (18+)'), 0, 1, 500);
    const children = field(grid, t('Deti na pevných lôžkach (0–17 rokov)', 'Children using permanent beds (aged 0–17)'), 0, 0, 500);
    if (!setting(option, 'allow_bed_children')) children.closest('label').hidden = true;
    const bedAgeBox = node('div', null, 'cfa-reservation-grid'); form.append(bedAgeBox);
    let bedAges = [], extraAges = [];
    const configured = Number(option.booking_form_settings?.max_extra_guests ?? 0);
    const maxExtra = setting(option, 'allow_extra_guests') && configured === 1 ? 1 : 0;
    const extras = node('section', null, 'cfa-room-mattress'); extras.hidden = maxExtra === 0;
    if (setting(option, 'show_extra_frame')) extras.classList.add('cfa-room-extra-frame');
    if (setting(option, 'show_extra_title')) extras.append(node('h4', t('Voliteľná osoba na prídavnom matraci', 'Optional guest on an extra mattress')));
    if (setting(option, 'show_extra_note')) extras.append(node('p', t('Najviac jedna ďalšia osoba na jednu izbu. Za túto osobu sa pripočíta iba celovíkendové vstupné podľa veku. Platené celovíkendové vstupné zahŕňa raňajky aj pre osobu na matraci. Iba dieťa 0–4 roky na matraci s bezplatným vstupom nemá raňajky zdarma.', 'At most one additional guest per room. Only full-weekend admission for their age category is added. Paid full-weekend admission includes breakfast for the mattress guest too. Only a child aged 0–4 staying on the mattress with free admission does not receive complimentary breakfast.')));
    const extraGrid = node('div', null, 'cfa-reservation-grid'); extras.append(extraGrid);
    const extraAdults = field(extraGrid, t('Dospelí na prídavnom matraci (18+)', 'Adults on an extra mattress (18+)'), 0, 0, 500);
    const extraChildren = field(extraGrid, t('Deti na prídavnom matraci (0–17 rokov)', 'Children on an extra mattress (aged 0–17)'), 0, 0, 500);
    if (!setting(option, 'allow_extra_adults')) extraAdults.closest('label').hidden = true;
    if (!setting(option, 'allow_extra_children')) extraChildren.closest('label').hidden = true;
    const extraAgeBox = node('div', null, 'cfa-reservation-grid'); extras.append(extraAgeBox); form.append(extras);
    function ageFields(input, parent, old, mattress) {
      const saved = old.map(i => i.value), result = [];
      parent.replaceChildren();
      for (let i = 0; i < Math.min(500, integer(input) ?? 0); i++) result.push(field(parent,
        mattress ? t(`Vek dieťaťa na matraci ${i + 1}`, `Mattress guest child ${i + 1} age`) : t(`Vek dieťaťa na lôžku ${i + 1}`, `Child using a bed ${i + 1} age`), 0, saved[i] ?? '', 17));
      return result;
    }
    const nightly = ['per_room_per_night', 'per_night'].includes(option.pricing_unit);
    const eventNights = extEventNights(event), selected = new Set();
    if (nightly) {
      const dates = node('fieldset', null, 'cfa-night-options'); dates.append(node('legend', t('Vyberte noci pobytu', 'Select the nights of your stay')));
      for (const day of eventNights.slice(0, 366)) {
        const label = node('label'), input = node('input'); input.type = 'checkbox'; input.value = day;
        input.onchange = () => { input.checked ? selected.add(day) : selected.delete(day); update(); };
        label.append(input, node('span', extNightLabel(day))); dates.append(label);
      }
      form.append(dates);
    } else form.append(node('p', t('Rezervácia izby platí na celý pobyt podujatia.', 'The room booking covers the full event stay.'), 'cfa-reservation-help'));
    const summary = node('div', '', 'cfa-package-summary');
    const add = node('button', t('Pridať izbu do košíka', 'Add room to cart'), 'add-btn'); add.type = 'submit'; form.append(summary, add);
    let busy = false;
    const ticketFor = id => (allEventOptions || []).find(o => Number(o.id) === Number(id));
    function details() {
      const q = integer(units, 1), a = integer(adults), c = integer(children), ea = integer(extraAdults), ec = integer(extraChildren);
      if ([units, adults, children, extraAdults, extraChildren].some(i => i.value.trim() !== '' && (integer(i) == null || Number(i.value) > 500)) || (units.value.trim() !== '' && !q)) return {error: t('Zadajte platné celé počty osôb a izieb.', 'Enter valid whole numbers of guests and rooms.')};
      if ([q, a, c, ea, ec].some(n => n == null)) return null;
      if (a + ea < Math.max(1, Number(option.minimum_adults || 1)) * q) return {error: t('Každá izba musí zahŕňať aspoň jedného dospelého od 18 rokov.', 'Each room must include at least one adult aged 18+.')};
      if (a + c > Number(option.max_occupancy || 0) * q) return {error: t(`Na pevných lôžkach môže byť najviac ${Number(option.max_occupancy || 0) * q} osôb.`, `At most ${Number(option.max_occupancy || 0) * q} guests may use permanent beds.`)};
      if (ea + ec > maxExtra * q) return {error: t('Na jednu izbu je povolená najviac jedna ďalšia osoba na matraci, ak je táto možnosť zapnutá.', 'At most one extra mattress guest per room is allowed when enabled.')};
      if ((!setting(option, 'allow_bed_children') && c) || (!setting(option, 'allow_extra_adults') && ea) || (!setting(option, 'allow_extra_children') && ec)) return {error: t('Táto možnosť je vypnutá.', 'This option is disabled.')};
      if ([...bedAges, ...extraAges].some(i => i.value.trim() !== '' && (integer(i) == null || Number(i.value) > 17))) return {error: t('Pri každom dieťati zadajte celý vek od 0 do 17 rokov.', 'Enter a whole age from 0 to 17 for every child.')};
      if (bedAges.length !== c || extraAges.length !== ec || [...bedAges, ...extraAges].some(i => i.value.trim() === '')) return null;
      const nights = nightly ? [...selected].sort() : eventNights;
      if (nightly && !nights.length) return null;
      if (nightly && nights.some((d,i) => eventNights.indexOf(d) < 0 || (i && eventNights.indexOf(d) !== eventNights.indexOf(nights[i-1]) + 1))) return {error: t('Vyberte po sebe nasledujúce noci.', 'Select consecutive nights.')};
      if (isTbd(option)) return {error: t('Cena izby ešte nie je nastavená.', 'The room price has not been set.')};
      const items = [], extraPrices = [];
      for (const age of [...Array(ea).fill(-1), ...extraAges.map(i => integer(i))]) {
        const ticket = ticketFor(age < 0 ? option.adult_ticket_option_id : age < 5 ? option.free_child_ticket_option_id : option.child_ticket_option_id);
        if (!ticket || !ticket.enabled || ticket.admission_type !== 'weekend' || ticket.is_accommodation || Number(ticket.event_id) !== Number(option.event_id) || !['per_stay','item','per_person'].includes(ticket.pricing_unit)
          || (age >= 0 && (ticket.min_age == null || ticket.max_age == null || age < Number(ticket.min_age) || age > Number(ticket.max_age)))
          || (age < 0 && (Number(ticket.min_age) !== 18 || ticket.max_age != null))) return {error: t('Pre osobu na matraci nie je nastavená správna víkendová vstupenka. Kontaktujte organizátora.', 'The correct weekend ticket for the mattress guest is not configured. Contact the organiser.')};
        items.push(ticket); extraPrices.push(Number(ticket.price));
      }
      const base = Number(option.price) * q * (nightly ? nights.length : 1);
      return {q, a, c, ea, ec, nights, bedAges: bedAges.map(i => integer(i)), extraAges: extraAges.map(i => integer(i)), base, items, extraPrices, total: base + extraPrices.reduce((s,n) => s+n, 0)};
    }
    function update() {
      const d = details(); validationSummary(summary, add, null, !!d?.error, busy || !d || !!d.error); summary.replaceChildren();
      if (!d) { summary.textContent = t('Doplňte všetky počty, veky detí a prípadne noci pobytu.', 'Enter all counts, child ages and, where applicable, nights.'); return; }
      if (d.error) { summary.textContent = d.error; return; }
      summary.append(node('strong', t('Spolu: ', 'Total: ') + money(d.total)));
      if (setting(option, 'show_price')) summary.append(node('div', t('Cena izieb: ', 'Room price: ') + money(d.base)));
      if (setting(option, 'show_extra_price')) d.items.forEach((ticket,i) => summary.append(node('div', t('Vstupné osoby na matraci: ', 'Mattress guest admission: ') + localName(ticket) + ' · ' + money(d.extraPrices[i]))));
      if (setting(option, 'show_capacity_note')) summary.append(node('div', t(`Osoby na lôžkach: ${d.a + d.c}/${Number(option.max_occupancy) * d.q}. Osoby na matraci: ${d.ea + d.ec}/${maxExtra * d.q}.`, `Guests using beds: ${d.a + d.c}/${Number(option.max_occupancy) * d.q}. Mattress guests: ${d.ea + d.ec}/${maxExtra * d.q}.`)));
    }
    children.oninput = () => { bedAges = ageFields(children, bedAgeBox, bedAges, false); update(); };
    extraChildren.oninput = () => { extraAges = ageFields(extraChildren, extraAgeBox, extraAges, true); update(); };
    form.addEventListener('input', update);
    form.onsubmit = async ev => {
      ev.preventDefault(); if (busy || !form.reportValidity() || !requireLogin()) return;
      const d = details(); if (!d || d.error) { notify(d?.error || t('Doplňte všetky údaje.', 'Complete every field.'), true); return; }
      busy = true; update();
      try {
        const result = await supabaseClient.rpc('add_accommodation_to_cart', {
          p_event_option_id: option.id, p_quantity: d.q, p_adult_count: d.a, p_paid_child_ages: d.bedAges,
          p_free_child_ages: d.extraAges, p_number_of_nights: Math.max(1,d.nights.length),
          p_night_start_date: nightly ? d.nights[0] : null, p_no_bed_adult_count: d.ea
        });
        if (result.error) throw result.error;
        await refreshCartBadge();
        const cart = await getActiveCart(); if (cart && typeof extSetBookingLanguage === 'function') await extSetBookingLanguage(cart.id);
        notify(t('Izba a vstupné osoby na matraci sú zahrnuté v rezervácii v košíku.', 'The room and mattress guest admission are included in the cart booking.'));
      } catch (error) { notify(errorText(error), true); }
      finally { busy = false; update(); }
    };
    row.append(form); update();
  }

  function applyOptionSettings(row, option) {
    row.dataset.cfaAvailability = option.availability_status || 'available';
    if (option.availability_status === 'sold_out') {
      for (const child of [...row.children]) {
        if (child.classList.contains('small') && ['Vypredané', 'Sold out'].includes(child.textContent.trim())) child.remove();
      }
    }
    const hide = (selector, key) => row.querySelectorAll(selector).forEach(n => { if (!setting(option, key)) n.hidden = true; });
    hide('.option-description', 'show_description'); hide('.option-price', 'show_price');
    hide('.extension-availability', 'show_availability'); hide('.guest-title', 'show_guest_title');
    hide('.paid-child-title', 'show_bed_child_title'); hide('.capacity-note', 'show_capacity_note');
    if (option.option_code === 'day_parking') hide('.option-special', 'show_parking_note');
    if (option.option_code === 'electric_hookup') hide('.option-special', 'show_electric_note');
    if (privateRoom(option)) {
      const box = row.querySelector('.child-free-note');
      if (box) {
        if (!setting(option, 'allow_extra_guests')) box.hidden = true;
        hide('.child-free-note .free-child-title', 'show_extra_title');
        hide('.child-free-note .free-price', 'show_extra_price');
        const counters = box.querySelectorAll('.guest-counter');
        if (!setting(option, 'allow_extra_adults') && counters[0]) counters[0].hidden = true;
        if (!setting(option, 'allow_extra_children') && counters[1]) {
          counters[1].hidden = true; box.querySelectorAll('.child-age-list').forEach(n => n.hidden = true);
        }
        for (const n of box.children) {
          if (!n.className && !setting(option, 'show_extra_note')) n.hidden = true;
        }
        if (!setting(option, 'show_extra_frame')) box.classList.add('cfa-unframed-note');
      }
      if (!setting(option, 'allow_bed_children')) {
        const title = row.querySelector('.paid-child-title'); if (title) title.closest('.guest-section').hidden = true;
      }
      if (!setting(option, 'allow_extra_guests') || (!setting(option, 'allow_extra_adults') && !setting(option, 'allow_extra_children'))) {
        const capacity = row.querySelector('.capacity-note');
        const quantity = Number(row.querySelector('.guest-counter .guest-count')?.textContent || 1);
        if (capacity && setting(option, 'show_capacity_note')) capacity.textContent = t(`Kapacita lôžok: ${Number(option.max_occupancy) * quantity} osôb.`, `Bed capacity: ${Number(option.max_occupancy) * quantity} people.`);
      }
    }
    const labels = row.querySelectorAll('.guest-counter-label');
    if (labels[0] && option.is_accommodation) {
      const configured = currentLanguage === 'en' ? option.booking_form_settings?.unit_label_en : option.booking_form_settings?.unit_label_sk;
      if (configured) labels[0].textContent = configured;
      else if (option.option_code === 'private_lodge_4') labels[0].textContent = t('Počet izieb', 'Number of rooms');
      if (!setting(option, 'show_unit_counter')) labels[0].closest('.guest-counter').hidden = true;
    }
    hide('.child-age-list > .small, .child-box > .small', 'show_age_heading');
    if (!row._cfaSettingsListener) {
      row._cfaSettingsListener = true;
      row.addEventListener('click', () => queueMicrotask(() => applyOptionSettings(row, option)));
    }
  }
  const previousControl = reservationControl;
  reservationControl = function (row, option, event) {
    row.dataset.cfaOptionId = String(option.id);
    if (option.requires_linked_tickets) linkedControl(row, option, event, Number(activeEdit?.event_option_id) === Number(option.id) ? activeEdit : null);
    else if (option.admission_type === 'day') dayControl(row, option, event);
    else if (privateRoom(option)) roomControl(row, option, event);
    else previousControl(row, option, event);
    if (option.category === 'ticket' && Number(option.price) === 0 && setting(option, 'show_breakfast_note')) row.append(node('p', t('Bezplatný vstup nezahŕňa raňajky zdarma.', 'Free admission does not include complimentary breakfast.'), 'cfa-reservation-help'));
    applyOptionSettings(row, option);
  };

  function disclosure(title, cls) {
    const section = node('details', null, cls);
    const summary = node('summary', null, 'cfa-disclosure-summary');
    const label = node('span', '', 'cfa-disclosure-state');
    const update = () => { label.textContent = section.open ? t('Skryť ↑', 'Hide ↑') : t('Zobraziť ↓', 'Show ↓'); };
    summary.append(node('h3', title), label); section.appendChild(summary);
    section.addEventListener('toggle', update); update();
    return section;
  }
  function textSection(parent, title, value, warning = false) {
    if (!value || !String(value).trim()) return;
    const section = disclosure(title, 'cfa-event-section' + (warning ? ' cfa-event-warning' : ''));
    section.appendChild(node('div', value, 'cfa-full-text')); parent.appendChild(section);
  }
  function ticketWarning(options) {
    const linked = options.find(o => o.requires_linked_tickets);
    const free = linked ? options.find(o => Number(o.id) === Number(linked.free_child_ticket_option_id))
      : options.find(o => o.category === 'ticket' && Number(o.price) === 0 && o.min_age != null && o.max_age != null && Number(o.max_age) <= 17);
    const range = free ? `${free.min_age}–${free.max_age}` : null;
    if (!linked) return t(
      `Každý návštevník musí mať vlastnú platnú vstupenku zodpovedajúcu skutočnej vekovej kategórii. ${range ? `Deti vo veku ${range} rokov majú vstup zdarma, musia však byť uvedené v rezervácii. Bezplatný vstup nezahŕňa raňajky zdarma.` : 'Aj osoby s oprávneným bezplatným vstupom musia byť uvedené v rezervácii.'}\n\nJedna vstupenka platí iba pre jednu osobu. Pri vstupe organizátori skontrolujú počet osôb a vekové kategórie. Osobám bez zodpovedajúcej platnej vstupenky nebude umožnený vstup. Pri pochybnostiach môžu organizátori požiadať o primerané preukázanie veku.\n\nPo kontrole dostane každý návštevník identifikačný náramok, ktorý musí nosiť počas pobytu. Pred dokončením rezervácie sa oboznámte s podmienkami podujatia.`,
      `Every visitor must have their own valid ticket matching their actual age category. ${range ? `Children aged ${range} have free admission but must be included in the booking. Free admission does not include complimentary breakfast.` : 'Visitors eligible for free admission must also be included in the booking.'}\n\nOne ticket admits one person only. Organisers will check guest numbers and age categories at the entrance. Visitors without a matching valid ticket will not be admitted. Organisers may request reasonable proof of age if there is doubt.\n\nEach visitor will receive an identification wristband after the check and must wear it throughout their stay. Read the event conditions before completing your booking.`);
    return t(
      `Každý návštevník je povinný zakúpiť si vstupenku zodpovedajúcu svojej skutočnej vekovej kategórii. ${range ? `Deti vo veku ${range} rokov majú vstup zdarma, musia však byť uvedené v rezervácii. Bezplatný vstup nezahŕňa raňajky zdarma.` : 'Aj osoby s oprávneným bezplatným vstupom musia byť uvedené v rezervácii.'}\n\nJedna vstupenka oprávňuje na vstup výhradne jednu osobu.\n\nPri vstupe do areálu budú všetky vstupenky dôsledne kontrolované. Organizátori overia počet prichádzajúcich osôb a príslušné vekové kategórie podľa zakúpených vstupeniek. Po kontrole dostane každý návštevník identifikačný náramok, ktorý musí nosiť počas pobytu.\n\nRezervácia stanového miesta neoprávňuje na vstup ďalších osôb bez platných víkendových vstupeniek.\n\nKaždá rezervácia stanu musí zahŕňať minimálne jednu dospelú osobu vo veku 18 rokov alebo viac. Samostatné stanovanie maloletých osôb nie je povolené.\n\nAk počet prichádzajúcich osôb alebo ich vekové kategórie nezodpovedajú zakúpeným vstupenkám, osobám bez zodpovedajúcej platnej vstupenky nebude umožnený vstup do areálu. Pri pochybnostiach môžu organizátori požiadať o primerané preukázanie veku.\n\nÚmyselné uvedenie nepravdivého počtu osôb alebo nesprávnych vekových kategórií nezakladá nárok na vstup ani na bezplatné ubytovanie.\n\nCelodenné vstupenky neoprávňujú na prenocovanie v areáli.\n\nVšetci návštevníci sú povinní oboznámiť sa s týmito podmienkami pred dokončením rezervácie.`,
      `Every visitor must have a ticket matching their actual age category. ${range ? `Children aged ${range} have free admission but must be included in the booking. Free admission does not include complimentary breakfast.` : 'Visitors eligible for free admission must also be included in the booking.'}\n\nOne ticket admits one person only.\n\nAll tickets will be checked carefully at the entrance. Organisers will check the number of arriving guests and their age categories against the tickets purchased. Each visitor will receive an identification wristband after the check and must wear it throughout their stay.\n\nA tent pitch reservation does not admit additional guests without valid weekend tickets.\n\nEvery tent booking must include at least one adult aged 18 or over. Minors are not permitted to camp unaccompanied.\n\nGuests without a ticket matching their actual age category will not be admitted if the arriving party does not match the tickets purchased. Organisers may request reasonable proof of age if there is doubt.\n\nDeliberately declaring incorrect guest numbers or age categories does not create any entitlement to admission or free accommodation.\n\nDay tickets do not permit an overnight stay.\n\nAll visitors must read these conditions before completing a booking.`);
  }
  function renderEventInformation(event, options) {
    const root = $('eventDetailContent'); const head = root?.querySelector('.card'); if (!head) return;
    const settings = event.display_settings || {};
    head.id = 'cfaEventInformation'; head.classList.add('cfa-event-information'); head.replaceChildren();
    head.append(node('h2', currentLanguage === 'en' ? settings.title_en || t('Chýba anglický názov podujatia.', 'The English event title has not been filled in yet.') : event.title, 'event-title'));
    head.append(node('p', `${formatDate(event.start_date)} – ${formatDate(event.end_date || event.start_date)}`));
    if (event.venue_name) head.append(node('p', event.venue_name));
    if (event.address || event.postcode) head.append(node('p', [event.address, event.postcode].filter(Boolean).join(', ')));
    if (event.maps_url) {
      try { const url = new URL(event.maps_url); if (['https:', 'http:'].includes(url.protocol)) {
        const link = node('a', t('Otvoriť mapu', 'Open map')); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; head.appendChild(link);
      } } catch (_) { /* An invalid optional map link does not hide the event text. */ }
    }
    const seen = new Set();
    const add = (key, sk, en, fallback, warning) => {
      if (settings['show_' + key] === false) return;
      const source = key === 'description' ? event.description_sk || event.description : event[key];
      const value = currentLanguage === 'en' ? settings[key + '_en'] || (key === 'description' ? localEventDescription(event) : source ? t('Chýba anglický preklad.', 'The English translation has not been filled in yet.') : '') : settings[key + '_sk'] || fallback;
      if (!value || seen.has(value)) return; seen.add(value); textSection(head, t(sk, en), value, warning);
    };
    add('short_description', 'O podujatí', 'About the event', event.short_description);
    add('description', 'Ďalšie informácie', 'Further information', localEventDescription(event));
    if (settings.show_legacy_description !== false && event.description && ![event.description_sk, event.description_en].includes(event.description) && !seen.has(event.description)) {
      seen.add(event.description); textSection(head, t('Ďalší uložený opis', 'Additional saved description'), currentLanguage === 'en' ? settings.legacy_description_en || 'The English translation of the original description has not been filled in yet.' : event.description);
    }
    add('event_details', 'Praktické informácie', 'Practical information', event.event_details);
    add('programme', 'Program', 'Programme', event.programme);
    add('important_information', 'Dôležité informácie', 'Important information', event.important_information, true);
    add('booking_information', 'Podmienky rezervácie a ubytovania', 'Booking and accommodation conditions', event.booking_information);
    if (options.some(o => o.category === 'ticket' || o.requires_linked_tickets)) {
      textSection(head, t('DÔLEŽITÉ UPOZORNENIE: POVINNÁ KONTROLA VSTUPENIEK', 'IMPORTANT: MANDATORY TICKET CHECKS'), ticketWarning(options), true);
    }
    const reserve = root.querySelector('.reserve-heading');
    if (reserve) {
      reserve.id = 'cfaReservationForm'; reserve.tabIndex = -1;
      const jump = () => { reserve.scrollIntoView({behavior: 'smooth', block: 'start'}); reserve.focus({preventScroll: true}); };
      const bookingButton = () => {
        const button = node('button', t('Pokračovať na rezerváciu ↓', 'Continue to booking ↓'), 'cfa-reservation-primary');
        button.type = 'button'; button.onclick = jump; return button;
      };
      const controls = node('div', null, 'cfa-information-controls');
      controls.appendChild(bookingButton());
      for (const [open, sk, en] of [[true, 'Rozbaliť všetko', 'Expand all'], [false, 'Skryť všetko', 'Hide all']]) {
        const button = node('button', t(sk, en), 'cfa-reservation-secondary'); button.type = 'button';
        button.onclick = () => head.querySelectorAll('details.cfa-event-section').forEach(section => { section.open = open; });
        controls.appendChild(button);
      }
      const firstSection = head.querySelector('.cfa-event-section');
      head.insertBefore(controls, firstSection);
      head.appendChild(bookingButton());
      const back = node('button', t('↑ Späť k informáciám', '↑ Back to information'), 'cfa-reservation-secondary'); back.type = 'button';
      back.onclick = () => head.scrollIntoView({behavior: 'smooth', block: 'start'}); reserve.insertAdjacentElement('afterend', back);
    }
  }
  function capacityOverview(options) {
    const wrap = disclosure(t('Prehľad kapacít', 'Capacity overview'), 'cfa-capacity-overview');
    const scroll = node('div', null, 'cfa-capacity-scroll'); const table = node('table');
    const header = node('tr'); for (const title of [t('Položka', 'Item'), t('Celkom', 'Total'), t('Rezervované', 'Reserved'), t('Predané', 'Sold'), t('Voľné', 'Remaining')]) header.appendChild(node('th', title));
    const thead = node('thead'); thead.appendChild(header); table.appendChild(thead);
    const body = node('tbody');
    for (const o of options) {
      const row = node('tr'); const left = o.stock_capacity == null ? null : Math.max(0, Number(o.stock_capacity) - Number(o.reserved_quantity || 0) - Number(o.sold_quantity || 0));
      const ratio = o.stock_capacity ? 100 * left / Number(o.stock_capacity) : 0;
      row.dataset.level = left == null || ratio > Number(o.availability_green_threshold ?? 50) ? 'green' : ratio > Number(o.availability_orange_threshold ?? 25) ? 'orange' : 'red';
      for (const value of [localName(o) + (o.enabled ? '' : t(' (vypnuté)', ' (disabled)')), o.stock_capacity ?? '∞', o.reserved_quantity || 0, o.sold_quantity || 0, left ?? '∞']) row.appendChild(node('td', String(value)));
      body.appendChild(row);
    }
    table.appendChild(body); scroll.appendChild(table); wrap.appendChild(scroll); return wrap;
  }
  const previousDetail = showEventDetail;
  showEventDetail = async function(id) {
    const generation = ++renderGeneration; activeEdit = pendingEdit; pendingEdit = null;
    await previousDetail(id);
    if (generation !== renderGeneration || Number(currentEvent?.id) !== Number(id)) return;
    renderEventInformation(currentEvent, allEventOptions || []);
    const rows = document.querySelectorAll('#eventDetailContent .option-row');
    const includedTickets = new Set((allEventOptions || []).filter(o => o.requires_linked_tickets)
      .flatMap(o => [o.adult_ticket_option_id, o.child_ticket_option_id, o.free_child_ticket_option_id]).filter(id => id != null).map(Number));
    rows.forEach((row, index) => {
      const option = currentEventOptions?.[index]; if (!option) return;
      row.dataset.cfaOptionId = String(option.id);
      if (includedTickets.has(Number(option.id)) && currentEvent.reservation_settings?.show_standalone_weekend_tickets !== true) row.hidden = true;
      if (activeEdit?.event_option_id === option.id && option.requires_linked_tickets && !row.querySelector('.cfa-linked-form')) linkedControl(row, option, currentEvent, activeEdit);
      applyOptionSettings(row, option);
    });
    $('eventDetailContent').querySelectorAll('.option-group').forEach(group => {
      const children = [...group.querySelectorAll('.option-row')]; if (children.length && children.every(row => row.hidden)) group.hidden = true;
    });
    if (activeEdit) {
      const target = [...rows].find(row => Number(row.dataset.cfaOptionId) === Number(activeEdit.event_option_id));
      target?.scrollIntoView?.({block: 'start'});
    }
    if (currentUser) {
      const userId = currentUser.id;
      try {
        const permission = await supabaseClient.rpc('cfa_can_manage_events');
        if (!permission.error && permission.data === true && generation === renderGeneration && currentUser?.id === userId) {
          const result = await supabaseClient.from('event_options').select('*').eq('event_id', id).order('sort_order');
          if (!result.error && generation === renderGeneration && currentUser?.id === userId) $('eventDetailContent').prepend(capacityOverview(result.data || []));
        }
      } catch (error) { console.warn('Capacity overview:', error); }
    }
  };
  const previousGuestHtml = guestCartHtml;
  guestCartHtml = function(item) {
    if (!item.camping_group_id) return previousGuestHtml(item);
    const div = node('div');
    if (item.camping_item_role === 'pitch') {
      const nights = nightsForItem(item);
      if (nights.length) div.appendChild(node('div', nights.map(extNightLabel).join(' · '), 'small'));
      div.appendChild(node('div', t(`Dospelí: ${item.adult_count}`, `Adults: ${item.adult_count}`), 'small'));
      div.appendChild(node('div', t(`Deti: ${(item.child_ages || []).length}`, `Children: ${(item.child_ages || []).length}`), 'small'));
    }
    if (item.child_ages?.length) div.appendChild(node('div', t('Vek detí: ', 'Children’s ages: ') + item.child_ages.join(', '), 'small'));
    return div.innerHTML;
  };
  let lastItems = [], lastBooking = null, lastUser = null;
  const previousGetItems = getCartItems;
  getCartItems = async function(id) {
    const items = await previousGetItems(id); lastItems = items; lastBooking = id; lastUser = currentUser?.id; return items;
  };
  const previousCart = showCartPage;
  showCartPage = async function() {
    await previousCart(); if (!currentUser || !activeCart) return;
    const items = lastBooking === activeCart.id && lastUser === currentUser.id ? lastItems : await getCartItems(activeCart.id);
    const rows = document.querySelectorAll('#cartPageContent .cart-item');
    rows.forEach((row, index) => {
      const item = items[index];
      if (item?.event_options && privateRoom(item.event_options) && (Number(item.no_bed_adult_count || 0) + Number(item.free_child_count || 0)) > 0) {
        row.append(node('p', t('Vstupné osoby na matraci je zahrnuté v uvedenej cene rezervácie. Platené celovíkendové vstupné zahŕňa raňajky. Dieťa 0–4 roky na matraci s bezplatným vstupom nemá raňajky zdarma.', 'Mattress guest admission is included in the displayed booking price. Paid full-weekend admission includes breakfast. A child aged 0–4 staying on the mattress with free admission does not receive complimentary breakfast.'), 'cfa-reservation-help'));
      }
      if (!item?.camping_group_id) return;
      const remove = row.querySelector('.remove-btn'); if (!remove) return;
      if (item.camping_item_role !== 'pitch') {
        remove.hidden = true;
        if (setting(item.event_options, 'show_linked_ticket_note')) row.appendChild(node('div', t('Súčasť rezervácie stanu', 'Part of the tent booking'), 'small'));
        return;
      }
      remove.textContent = t('Odstrániť stan aj vstupenky', 'Remove tent and tickets');
      remove.onclick = async () => {
        if (!window.confirm(t('Odstrániť tento stan aj všetky jeho prepojené vstupenky?', 'Remove this tent and all its linked tickets?'))) return;
        remove.disabled = true;
        const note = statusBox(row);
        try {
          const result = await supabaseClient.rpc('remove_cart_item', {p_booking_item_id: item.id});
          if (result.error) throw result.error; await refreshCartBadge(); await showCartPage();
        } catch (error) { note(errorText(error), true); remove.disabled = false; }
      };
      const edit = node('button', t('Upraviť osoby a noci', 'Edit guests and nights'), 'cfa-reservation-secondary'); edit.type = 'button';
      edit.onclick = () => { pendingEdit = item; return showEventDetail(activeCart.event_id); };
      row.appendChild(edit);
    });
  };
  window.CFAReservationUI = {capacityOverview, applyOptionSettings};
})();
