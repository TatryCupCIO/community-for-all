// Community For All - Extensions
// Reservation availability display

function availabilityInfo(option) {
  const status = option?.availability_status || 'available';

  if (status === 'sold_out') {
    return {
      text: T('Vypredané', 'Sold out'),
      color: '#94a3b8'
    };
  }

  if (status === 'almost_sold_out') {
    return {
      text: T('Posledné miesta', 'Last places'),
      color: '#ef4444'
    };
  }

  if (status === 'limited') {
    return {
      text: T('Obmedzená dostupnosť', 'Limited availability'),
      color: '#f59e0b'
    };
  }

  return {
    text: T('Dostupné', 'Available'),
    color: '#22c55e'
  };
}

function availabilityHtml(option) {
  const info = availabilityInfo(option);

  return `
    <div style="
      margin-top:8px;
      font-size:13px;
      font-weight:800;
      color:${info.color};
    ">
      ● ${info.text}
    </div>
  `;
}


// Add availability status to reservation options

const originalShowEventDetail = showEventDetail;

showEventDetail = async function(id) {

  await originalShowEventDetail(id);

  const rows = document.querySelectorAll(
    '#eventDetailContent .option-row'
  );

  rows.forEach((row, index) => {

    const option = currentEventOptions[index];

    if (!option) return;

    const existing = row.querySelector(
      '.extension-availability'
    );

    if (existing) return;

    const info = availabilityInfo(option);

    const status = document.createElement('div');

    status.className = 'extension-availability';

    status.style.marginTop = '8px';
    status.style.fontSize = '13px';
    status.style.fontWeight = '800';
    status.style.color = info.color;

    status.textContent = '● ' + info.text;

    const price = row.querySelector('.option-price');

    if (price) {
      price.insertAdjacentElement('afterend', status);
    } else {
      row.appendChild(status);
    }

  });

};
// ============================================================
// COMMUNITY FOR ALL
// RESERVATION EXTENSION V2
// Specific days/nights + guests + detailed cart + SK/EN
// ============================================================

function extDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extEventDates(event) {
  const result = [];
  const start = new Date(event.start_date + 'T12:00:00');
  const end = new Date(event.end_date + 'T12:00:00');

  for (
    let d = new Date(start);
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    result.push(extDateISO(d));
  }

  return result;
}

function extEventNights(event) {
  const dates = extEventDates(event);
  return dates.slice(0, Math.max(0, dates.length - 1));
}

function extShortDate(date) {
  return new Intl.DateTimeFormat(
    currentLanguage === 'sk' ? 'sk-SK' : 'en-GB',
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }
  ).format(new Date(date + 'T12:00:00'));
}

function extNightLabel(date) {
  const start = new Date(date + 'T12:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return (
    extShortDate(extDateISO(start)) +
    ' → ' +
    extShortDate(extDateISO(end))
  );
}

function extSelectionBox(title, dates, nightMode = false) {
  const box = document.createElement('div');
  box.style.marginTop = '14px';
  box.style.padding = '12px';
  box.style.background = '#172033';
  box.style.border = '1px solid #334155';
  box.style.borderRadius = '10px';

  const heading = document.createElement('div');
  heading.style.fontWeight = '800';
  heading.style.marginBottom = '8px';
  heading.textContent = title;
  box.appendChild(heading);

  const selected = new Set();

  dates.forEach(date => {
    const line = document.createElement('label');
    line.style.display = 'flex';
    line.style.alignItems = 'center';
    line.style.gap = '9px';
    line.style.margin = '8px 0';
    line.style.fontWeight = '400';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = date;
    input.style.width = 'auto';
    input.style.margin = '0';

    input.onchange = () => {
      if (input.checked) selected.add(date);
      else selected.delete(date);
    };

    const text = document.createElement('span');
    text.textContent = nightMode
      ? extNightLabel(date)
      : extShortDate(date);

    line.append(input, text);
    box.appendChild(line);
  });

  return { box, selected };
}

function extSetBookingLanguage(bookingId) {
  if (!bookingId) return Promise.resolve();

  return supabaseClient
    .from('bookings')
    .update({ booking_language: currentLanguage })
    .eq('id', bookingId);
}

function extValidAges(ages, min = 0, max = 17) {
  return ages.every(age =>
    age !== '' &&
    Number.isInteger(Number(age)) &&
    Number(age) >= min &&
    Number(age) <= max
  );
}

function extCounter(label, initial, callback, maxGetter = null) {
  let count = initial;

  const line = document.createElement('div');
  line.className = 'guest-counter';

  const lab = document.createElement('div');
  lab.className = 'guest-counter-label';
  lab.textContent = label;

  const controls = document.createElement('div');
  controls.className = 'guest-counter-controls';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'guest-btn';
  minus.textContent = '−';

  const value = document.createElement('span');
  value.className = 'guest-count';
  value.textContent = count;

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'guest-btn';
  plus.textContent = '+';

  minus.onclick = () => {
    if (count > 0) {
      count--;
      value.textContent = count;
      callback(count);
    }
  };

  plus.onclick = () => {
    const max =
      typeof maxGetter === 'function'
        ? maxGetter()
        : maxGetter;

    if (max !== null && max !== undefined && count >= max) {
      return;
    }

    count++;
    value.textContent = count;
    callback(count);
  };

  controls.append(minus, value, plus);
  line.append(lab, controls);

  return {
    element: line,
    getValue: () => count,
    setValue: n => {
      count = Math.max(0, Number(n) || 0);
      value.textContent = count;
      callback(count);
    }
  };
}

function extAgeInputs(container, ages, title, min = 0, max = 17) {
  container.innerHTML = '';

  if (!ages.length) return;

  const titleEl = document.createElement('div');
  titleEl.className = 'small';
  titleEl.innerHTML = `<b>${title}</b>`;
  container.appendChild(titleEl);

  ages.forEach((age, index) => {
    const row = document.createElement('div');
    row.className = 'child-age-row';

    const label = document.createElement('span');
    label.textContent = T(
      `Dieťa ${index + 1}`,
      `Child ${index + 1}`
    );

    const input = document.createElement('input');
    input.type = 'number';
    input.min = String(min);
    input.max = String(max);
    input.inputMode = 'numeric';
    input.value = age;

    input.oninput = () => {
      ages[index] =
        input.value === '' ? '' : Number(input.value);
    };

    row.append(label, input);
    container.appendChild(row);
  });
}


// ============================================================
// NEW RESERVATION CONTROL
// ============================================================

reservationControl = function(row, o, e) {

  let quantity = 1;

  let bedAdults =
    collectsGuests(o) ? 1 : 0;

  let noBedAdults = 0;
  let bedChildAges = [];
  let noBedChildAges = [];

  const childMin = Number(o.min_age ?? 0);
  const childMax = Number(o.max_age ?? 17);

  let ticketAges =
    isChild(o) ? [childMin] : [];

  const privateAccommodation = [
    'private_room_2',
    'private_lodge_4'
  ].includes(o.option_code);

  const sharedAccommodation =
    o.option_code === 'shared_accommodation_adult';

  const camping = [
    'small_tent',
    'large_tent',
    'caravan_motorhome'
  ].includes(o.option_code);

  const dayPricing = isDayPricing(o);
  const nightPricing = isNightPricing(o);

  let dateSelector = null;

  if (dayPricing) {
    dateSelector = extSelectionBox(
      T(
        'Vyberte deň:',
        'Select day:'
      ),
      extEventDates(e),
      false
    );

    row.appendChild(dateSelector.box);
  }

  if (nightPricing) {
    dateSelector = extSelectionBox(
      T(
        'Vyberte noc:',
        'Select night:'
      ),
      extEventNights(e),
      true
    );

    row.appendChild(dateSelector.box);
  }


  // ----------------------------------------------------------
  // GUEST DETAILS
  // ----------------------------------------------------------

  if (collectsGuests(o)) {

    const guestBox = document.createElement('div');
    guestBox.className = 'guest-box';

    const title = document.createElement('div');
    title.className = 'guest-title';
    title.textContent =
      '👥 ' +
      T(
        'Hostia v tejto rezervácii',
        'Guests in this booking'
      );

    guestBox.appendChild(title);


    // Accommodation units
    if (o.is_accommodation && !sharedAccommodation) {

      let unitLabel = T(
        'Počet ubytovacích jednotiek',
        'Number of accommodation units'
      );

      if (
        o.option_code === 'small_tent' ||
        o.option_code === 'large_tent'
      ) {
        unitLabel = T(
          'Počet stanov',
          'Number of tents'
        );
      }

      if (o.option_code === 'caravan_motorhome') {
        unitLabel = T(
          'Počet vozidiel',
          'Number of vehicles'
        );
      }

      if (o.option_code === 'private_room_2') {
        unitLabel = T(
          'Počet izieb',
          'Number of rooms'
        );
      }

      if (o.option_code === 'private_lodge_4') {
        unitLabel = T(
          'Počet chatiek',
          'Number of lodges'
        );
      }

      const unitCounter = extCounter(
        unitLabel,
        1,
        n => {
          quantity = Math.max(1, n);
          if (quantity < 1) quantity = 1;
        }
      );

      guestBox.appendChild(unitCounter.element);
    }


    // Adults using beds / adults in camping
    const adultLabel = privateAccommodation
      ? T(
          'Dospelí – lôžko',
          'Adults – bed'
        )
      : T(
          'Dospelí',
          'Adults'
        );

    const adultCounter = extCounter(
      adultLabel,
      bedAdults,
      n => bedAdults = n
    );

    guestBox.appendChild(adultCounter.element);


    // PRIVATE ROOM / LODGE
    if (privateAccommodation) {

      const bedSection = document.createElement('div');
      bedSection.className = 'guest-section';

      const bedTitle = document.createElement('div');
      bedTitle.className = 'paid-child-title';
      bedTitle.textContent = T(
        'Deti – lôžko',
        'Children – bed'
      );

      bedSection.appendChild(bedTitle);

      const bedAgeBox = document.createElement('div');
      bedAgeBox.className = 'child-age-list';

      const bedChildCounter = extCounter(
        T(
          'Počet detí na lôžku',
          'Children using a bed'
        ),
        0,
        n => {
          while (bedChildAges.length < n) {
            bedChildAges.push('');
          }

          bedChildAges =
            bedChildAges.slice(0, n);

          extAgeInputs(
            bedAgeBox,
            bedChildAges,
            T(
              'Vek každého dieťaťa:',
              'Age of each child:'
            )
          );
        }
      );

      bedSection.append(
        bedChildCounter.element,
        bedAgeBox
      );

      guestBox.appendChild(bedSection);


      // Without bed
      const noBedSection = document.createElement('div');
      noBedSection.className = 'child-free-note';

      const noBedTitle = document.createElement('div');
      noBedTitle.className = 'free-child-title';
      noBedTitle.textContent = T(
        'Ďalšie osoby – bez lôžka',
        'Additional guests – without bed'
      );

      noBedSection.appendChild(noBedTitle);

      const freePrice = document.createElement('span');
      freePrice.className = 'free-price';
      freePrice.textContent = T(
        '£0.00 / ZDARMA',
        '£0.00 / FREE'
      );

      noBedSection.appendChild(freePrice);

      const note = document.createElement('div');
      note.style.marginTop = '7px';
      note.textContent = T(
        'Maximálne 3 ďalšie osoby bez lôžka spolu. Môžu to byť dospelí, deti alebo ich kombinácia.',
        'Maximum 3 additional guests without a bed in total. They may be adults, children or a combination.'
      );

      noBedSection.appendChild(note);

      const remainingNoBed = () =>
        Math.max(
          0,
          3 -
          noBedAdults -
          noBedChildAges.length
        );

      const noBedAdultCounter = extCounter(
        T(
          'Dospelí bez lôžka',
          'Adults without a bed'
        ),
        0,
        n => noBedAdults = n,
        () => noBedAdults + remainingNoBed()
      );

      noBedSection.appendChild(
        noBedAdultCounter.element
      );

      const noBedAgeBox =
        document.createElement('div');

      noBedAgeBox.className =
        'child-age-list';

      const noBedChildCounter = extCounter(
        T(
          'Deti bez lôžka',
          'Children without a bed'
        ),
        0,
        n => {
          while (noBedChildAges.length < n) {
            noBedChildAges.push('');
          }

          noBedChildAges =
            noBedChildAges.slice(0, n);

          extAgeInputs(
            noBedAgeBox,
            noBedChildAges,
            T(
              'Vek každého dieťaťa:',
              'Age of each child:'
            )
          );
        },
        () =>
          noBedChildAges.length +
          remainingNoBed()
      );

      noBedSection.append(
        noBedChildCounter.element,
        noBedAgeBox
      );

      guestBox.appendChild(noBedSection);


      const capacity = document.createElement('div');
      capacity.className = 'capacity-note';

      const refreshCapacity = () => {
        const maxBeds =
          Number(o.max_occupancy || 0) *
          quantity;

        capacity.textContent = T(
          `Kapacita lôžok: ${maxBeds} osôb. Navyše sú povolené maximálne 3 osoby bez lôžka spolu.`,
          `Bed capacity: ${maxBeds} people. A maximum of 3 additional guests without a bed are allowed.`
        );
      };

      refreshCapacity();
      guestBox.appendChild(capacity);

    }


    // SHARED ACCOMMODATION
    else if (sharedAccommodation) {

      const bedSection =
        document.createElement('div');

      bedSection.className =
        'guest-section';

      const bedTitle =
        document.createElement('div');

      bedTitle.className =
        'paid-child-title';

      bedTitle.textContent = T(
        'Deti – vlastné lôžko',
        'Children – own bed'
      );

      bedSection.appendChild(bedTitle);

      const bedAgeBox =
        document.createElement('div');

      bedAgeBox.className =
        'child-age-list';

      bedSection.appendChild(
        extCounter(
          T(
            'Počet detí',
            'Number of children'
          ),
          0,
          n => {
            while (bedChildAges.length < n) {
              bedChildAges.push('');
            }

            bedChildAges =
              bedChildAges.slice(0, n);

            extAgeInputs(
              bedAgeBox,
              bedChildAges,
              T(
                'Vek každého dieťaťa:',
                'Age of each child:'
              )
            );
          }
        ).element
      );

      bedSection.appendChild(bedAgeBox);
      guestBox.appendChild(bedSection);


      const noBedSection =
        document.createElement('div');

      noBedSection.className =
        'child-free-note';

      const noBedTitle =
        document.createElement('div');

      noBedTitle.className =
        'free-child-title';

      noBedTitle.textContent = T(
        'Deti – bez vlastného lôžka',
        'Children – without own bed'
      );

      noBedSection.appendChild(noBedTitle);

      const freePrice =
        document.createElement('span');

      freePrice.className = 'free-price';
      freePrice.textContent =
        T('£0.00 / ZDARMA', '£0.00 / FREE');

      noBedSection.appendChild(freePrice);

      const ageBox =
        document.createElement('div');

      ageBox.className =
        'child-age-list';

      noBedSection.appendChild(
        extCounter(
          T(
            'Počet detí',
            'Number of children'
          ),
          0,
          n => {
            while (noBedChildAges.length < n) {
              noBedChildAges.push('');
            }

            noBedChildAges =
              noBedChildAges.slice(0, n);

            extAgeInputs(
              ageBox,
              noBedChildAges,
              T(
                'Vek každého dieťaťa:',
                'Age of each child:'
              )
            );
          }
        ).element
      );

      noBedSection.appendChild(ageBox);
      guestBox.appendChild(noBedSection);

    }


    // CAMPING
    else if (camping) {

      const ageBox =
        document.createElement('div');

      ageBox.className =
        'child-age-list';

      guestBox.appendChild(
        extCounter(
          T('Deti', 'Children'),
          0,
          n => {
            while (noBedChildAges.length < n) {
              noBedChildAges.push('');
            }

            noBedChildAges =
              noBedChildAges.slice(0, n);

            extAgeInputs(
              ageBox,
              noBedChildAges,
              T(
                'Vek každého dieťaťa:',
                'Age of each child:'
              )
            );
          }
        ).element
      );

      guestBox.appendChild(ageBox);
    }

    row.appendChild(guestBox);
  }


  // ----------------------------------------------------------
  // QUANTITY + ADD
  // ----------------------------------------------------------

  const line = document.createElement('div');
  line.className = 'qty-line';

  const minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'qty-btn';
  minus.textContent = '−';

  const qtyValue = document.createElement('span');
  qtyValue.className = 'qty-value';
  qtyValue.textContent = '1';

  const plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'qty-btn';
  plus.textContent = '+';

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'add-btn';
  add.textContent = T('Pridať', 'Add');

  if (o.is_accommodation) {
    line.style.justifyContent = 'flex-end';
    line.appendChild(add);
  } else {
    minus.onclick = () => {
      if (quantity > 1) {
        quantity--;
        qtyValue.textContent = quantity;

        if (isChild(o)) {
          ticketAges =
            ticketAges.slice(0, quantity);
          renderTicketAges();
        }
      }
    };

    plus.onclick = () => {
      quantity++;
      qtyValue.textContent = quantity;

      if (isChild(o)) {
        while (ticketAges.length < quantity) {
          ticketAges.push(childMin);
        }
        renderTicketAges();
      }
    };

    line.append(
      minus,
      qtyValue,
      plus,
      add
    );
  }

  row.appendChild(line);


  // ----------------------------------------------------------
  // CHILD TICKET / CHILD BREAKFAST AGES
  // ----------------------------------------------------------

  let ticketAgeBox = null;

  function renderTicketAges() {
    if (!ticketAgeBox) return;

    while (ticketAges.length < quantity) {
      ticketAges.push(childMin);
    }

    ticketAges =
      ticketAges.slice(0, quantity);

    extAgeInputs(
      ticketAgeBox,
      ticketAges,
      T(
        `Vek každého dieťaťa (${childMin}–${childMax} rokov):`,
        `Age of each child (${childMin}–${childMax} years):`
      ),
      childMin,
      childMax
    );
  }

  if (isChild(o)) {
    ticketAgeBox =
      document.createElement('div');

    ticketAgeBox.className =
      'child-box';

    row.appendChild(ticketAgeBox);
    renderTicketAges();
  }


  // ----------------------------------------------------------
  // ADD TO CART
  // ----------------------------------------------------------

  add.onclick = async () => {

    if (!requireLogin()) return;

    if (isTbd(o)) {
      return alert(
        T(
          'Cena tejto položky ešte nie je nastavená.',
          'The price for this item has not been set yet.'
        )
      );
    }

    const selectedDates =
      dateSelector
        ? Array.from(dateSelector.selected)
        : [null];

    if (
      (dayPricing || nightPricing) &&
      selectedDates.length === 0
    ) {
      return alert(
        T(
          dayPricing
            ? 'Vyberte aspoň jeden deň.'
            : 'Vyberte aspoň jednu noc.',
          dayPricing
            ? 'Select at least one day.'
            : 'Select at least one night.'
        )
      );
    }


    if (collectsGuests(o)) {

      const totalGuests =
        bedAdults +
        noBedAdults +
        bedChildAges.length +
        noBedChildAges.length;

      if (totalGuests < 1) {
        return alert(
          T(
            'Uveďte aspoň jedného hosťa.',
            'Please add at least one guest.'
          )
        );
      }

      if (
        !extValidAges(bedChildAges) ||
        !extValidAges(noBedChildAges)
      ) {
        return alert(
          T(
            'Zadajte vek každého dieťaťa od 0 do 17 rokov.',
            'Enter the age of every child from 0 to 17.'
          )
        );
      }

      if (privateAccommodation) {

        const noBedTotal =
          noBedAdults +
          noBedChildAges.length;

        if (noBedTotal > 3) {
          return alert(
            T(
              'Povolené sú maximálne 3 ďalšie osoby bez lôžka spolu.',
              'A maximum of 3 additional guests without a bed are allowed.'
            )
          );
        }

        const bedTotal =
          bedAdults +
          bedChildAges.length;

        const maxBeds =
          Number(o.max_occupancy || 0) *
          quantity;

        if (
          Number(o.max_occupancy || 0) > 0 &&
          bedTotal > maxBeds
        ) {
          return alert(
            T(
              `Kapacita lôžok je maximálne ${maxBeds} osôb.`,
              `Bed capacity is a maximum of ${maxBeds} people.`
            )
          );
        }
      }

      if (
        camping &&
        Number(o.max_occupancy || 0) > 0
      ) {
        const maxGuests =
          Number(o.max_occupancy) *
          quantity;

        if (totalGuests > maxGuests) {
          return alert(
            T(
              `Maximálna kapacita je ${maxGuests} osôb.`,
              `Maximum capacity is ${maxGuests} people.`
            )
          );
        }
      }
    }


    if (
      isChild(o) &&
      !extValidAges(
        ticketAges,
        childMin,
        childMax
      )
    ) {
      return alert(
        T(
          `Zadajte vek každého dieťaťa od ${childMin} do ${childMax} rokov.`,
          `Enter the age of every child from ${childMin} to ${childMax}.`
        )
      );
    }


    add.disabled = true;
    add.textContent =
      T('Pridávam…', 'Adding…');

    try {

      for (const selectedDate of selectedDates) {

        let result;

        if (
          collectsGuests(o) &&
          o.is_accommodation
        ) {

          result = await supabaseClient.rpc(
            'add_accommodation_to_cart',
            {
              p_event_option_id: o.id,
              p_quantity:
                sharedAccommodation
                  ? 1
                  : quantity,

              p_adult_count:
                bedAdults,

              p_paid_child_ages:
                isBedAccommodation(o)
                  ? bedChildAges.map(Number)
                  : [],

              p_free_child_ages:
                noBedChildAges.map(Number),

              p_number_of_nights:
                nightPricing ? 1 : 1,

              p_night_start_date:
                nightPricing
                  ? selectedDate
                  : null,

              p_no_bed_adult_count:
                privateAccommodation
                  ? noBedAdults
                  : 0
            }
          );

        } else {

          result = await supabaseClient.rpc(
            'add_item_to_cart',
            {
              p_event_option_id: o.id,
              p_quantity: quantity,

              p_child_ages:
                isChild(o)
                  ? ticketAges.map(Number)
                  : [],

              p_number_of_days:
                dayPricing ? 1 : 1,

              p_number_of_nights:
                nightPricing ? 1 : 1,

              p_option_date:
                (dayPricing || nightPricing)
                  ? selectedDate
                  : null,

              p_adult_count: 0
            }
          );
        }

        if (result.error) {
          throw result.error;
        }
      }

      const cart = await getActiveCart();

      if (cart) {
        await extSetBookingLanguage(cart.id);
      }

      await refreshCartBadge();

      alert(
        T(
          'Položka bola pridaná do košíka.',
          'Item added to cart.'
        )
      );

    } catch (error) {

      alert(
        T(
          'Nepodarilo sa pridať položku: ',
          'Could not add item: '
        ) +
        (error?.message || error)
      );

    } finally {

      add.disabled = false;
      add.textContent =
        T('Pridať', 'Add');
    }
  };
};


// ============================================================
// DETAILED CART DISPLAY
// ============================================================

function extItemDateHtml(item) {

  if (item.night_start_date) {
    return `
      <div class="small">
        🌙 <b>${T('Noc:', 'Night:')}</b>
        ${escapeHtml(extNightLabel(item.night_start_date))}
      </div>
    `;
  }

  if (item.service_date || item.option_date) {
    const date =
      item.service_date ||
      item.option_date;

    return `
      <div class="small">
        📅 <b>${T('Deň:', 'Day:')}</b>
        ${escapeHtml(extShortDate(date))}
      </div>
    `;
  }

  return '';
}

function extGuestCartHtml(item) {

  let html = '';

  const bedAdults =
    Number(
      item.bed_adult_count ??
      item.adult_count ??
      0
    );

  const bedChildren =
    Number(
      item.bed_child_count ??
      item.paid_child_count ??
      0
    );

  const bedAges =
    item.bed_child_ages?.length
      ? item.bed_child_ages
      : (item.paid_child_ages || []);

  const noBedAdults =
    Number(
      item.no_bed_adult_count || 0
    );

  const noBedChildren =
    Number(
      item.no_bed_child_count ??
      item.free_child_count ??
      0
    );

  const noBedAges =
    item.no_bed_child_ages?.length
      ? item.no_bed_child_ages
      : (item.free_child_ages || []);

  const code =
    item.event_options?.option_code || '';

  const privateAccommodation = [
    'private_room_2',
    'private_lodge_4'
  ].includes(code);

  const camping = [
    'small_tent',
    'large_tent',
    'caravan_motorhome'
  ].includes(code);


  if (bedAdults > 0) {
    html += `
      <div class="small">
        ${privateAccommodation
          ? T('Dospelí – lôžko: ', 'Adults – bed: ')
          : T('Dospelí: ', 'Adults: ')
        }${bedAdults}
      </div>
    `;
  }

  if (bedChildren > 0) {
    html += `
      <div class="small">
        ${T(
          'Deti – lôžko: ',
          'Children – bed: '
        )}${bedChildren}
        <br>
        ${T('Vek: ', 'Ages: ')}
        ${escapeHtml(bedAges.join(', '))}
      </div>
    `;
  }

  if (noBedAdults > 0) {
    html += `
      <div class="small">
        ${T(
          'Dospelí – bez lôžka: ',
          'Adults – without bed: '
        )}${noBedAdults}
      </div>
    `;
  }

  if (noBedChildren > 0) {

    const label = camping
      ? T('Deti: ', 'Children: ')
      : T(
          'Deti – bez lôžka: ',
          'Children – without bed: '
        );

    html += `
      <div class="small">
        ${label}${noBedChildren}
        <br>
        ${T('Vek: ', 'Ages: ')}
        ${escapeHtml(noBedAges.join(', '))}
      </div>
    `;
  }

  if (
    !bedChildren &&
    !noBedChildren &&
    item.child_ages?.length
  ) {
    html += `
      <div class="small">
        ${T(
          'Deti – vek: ',
          'Children – ages: '
        )}
        ${escapeHtml(item.child_ages.join(', '))}
      </div>
    `;
  }

  if (
    code === 'day_parking' &&
    Number(item.line_total) === 0
  ) {
    html += `
      <div class="small"
           style="color:#86efac;font-weight:700">
        ${T(
          'Parkovanie zdarma k ubytovaniu',
          'Free parking with accommodation'
        )}
      </div>
    `;
  }

  return html;
}


// Replace cart detail renderer used by cart and bookings

guestCartHtml = function(item) {
  return (
    extItemDateHtml(item) +
    extGuestCartHtml(item)
  );
};


// ============================================================
// BOOKING LANGUAGE
// Keep active cart language synced with SK / EN selection
// ============================================================

const extOriginalSetLanguage = setLanguage;

setLanguage = function(lang) {

  extOriginalSetLanguage(lang);

  setTimeout(async () => {

    if (!currentUser) return;

    const cart = await getActiveCart();

    if (cart) {
      await extSetBookingLanguage(cart.id);
    }

  }, 0);
};
// ============================================================
// CART + BOOKINGS - FORCE FULL SK / EN TRANSLATION
// ============================================================

function extTranslatedItemName(item) {
  const code = item?.event_options?.option_code || '';

  if (code && optionNames[code]) {
    return optionNames[code][currentLanguage === 'sk' ? 0 : 1];
  }

  return item?.item_name || '';
}


// CART
const extOriginalShowCartPage = showCartPage;

showCartPage = async function() {
  await extOriginalShowCartPage();

  const cart = await getActiveCart();
  if (!cart) return;

  const items = await getCartItems(cart.id);

  const renderedItems =
    document.querySelectorAll('#cartPageContent .cart-item');

  renderedItems.forEach((row, index) => {
    const item = items[index];
    if (!item) return;

    const title = row.querySelector('b');
    if (!title) return;

    title.textContent =
      `${item.quantity}× ${extTranslatedItemName(item)}`;
  });
};


// BOOKINGS
const extOriginalShowBookings = showBookings;

showBookings = async function() {
  await extOriginalShowBookings();

  if (!currentUser) return;

  const { data: bookings } = await supabaseClient
    .from('bookings')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  const cards =
    document.querySelectorAll('#bookingsContent .card');

  for (let bIndex = 0; bIndex < (bookings || []).length; bIndex++) {

    const booking = bookings[bIndex];
    const card = cards[bIndex];

    if (!booking || !card) continue;

    const { data: items } = await supabaseClient
      .from('booking_items')
      .select('*,event_options(option_code,is_accommodation,free_with_accommodation)')
      .eq('booking_id', booking.id)
      .order('created_at');

    const renderedItems =
      card.querySelectorAll('.cart-item');

    renderedItems.forEach((row, itemIndex) => {
      const item = items?.[itemIndex];
      if (!item) return;

      const title = row.querySelector('b');
      if (!title) return;

      title.textContent =
        `${item.quantity}× ${extTranslatedItemName(item)}`;
    });
  }
};


// Re-render current cart/bookings immediately after SK / EN switch
const extLanguageTranslationFix = setLanguage;

setLanguage = function(lang) {
  extLanguageTranslationFix(lang);

  setTimeout(() => {
    if (
      document.getElementById('cartPage')?.style.display === 'block' &&
      currentUser
    ) {
      showCartPage();
    }

    if (
      document.getElementById('bookingsPage')?.style.display === 'block' &&
      currentUser
    ) {
      showBookings();
    }
  }, 50);
};
// ============================================================
// BREAKFAST AGE LABEL FIX
// 0–11 child / 12+ adult
// ============================================================

const extOriginalLocalName = localName;

localName = function(o) {
  if (o?.option_code === 'breakfast_adult') {
    return T(
      'Raňajky – dospelý (od 12 rokov)',
      'Breakfast – adult (12+ years)'
    );
  }

  if (o?.option_code === 'breakfast_child') {
    return T(
      'Raňajky – dieťa (0–11 rokov)',
      'Breakfast – child (0–11 years)'
    );
  }

  return extOriginalLocalName(o);
};
