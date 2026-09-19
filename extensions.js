// Community For All - Extensions
// New app functions will be added here.
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
