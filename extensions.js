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
// ===== CART EXTENSION =====

let extensionCart = JSON.parse(localStorage.getItem('communityForAllCart') || '[]');

function saveExtensionCart() {
  localStorage.setItem('communityForAllCart', JSON.stringify(extensionCart));
}

function extensionCartCount() {
  return extensionCart.reduce((total, item) => total + (item.quantity || 1), 0);
}
// ===== ADD RESERVATION TO CART =====

function addReservationToExtensionCart(item) {
  if (!item) return;

  const cartItem = {
    ...item,
    quantity: Number(item.quantity || 1)
  };

  extensionCart.push(cartItem);
  saveExtensionCart();

  const badge = document.querySelector('.cart-badge');
  if (badge) {
    badge.textContent = extensionCartCount();
    badge.style.display = extensionCartCount() > 0 ? 'inline-flex' : 'none';
  }
}
// ===== CART BADGE =====

function updateExtensionCartBadge() {
  const badge = document.querySelector('.cart-badge');
  if (!badge) return;

  const count = extensionCartCount();

  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}
// ===== COMPLETE CART FUNCTIONS =====

// Update cart badge
function refreshExtensionCart() {
  saveExtensionCart();
  updateExtensionCartBadge();

  if (document.querySelector('#cartPage')) {
    renderExtensionCart();
  }
}


// Add item to cart
function extensionAddItem(item) {
  if (!item) return;

  const existing = extensionCart.find(x =>
    x.id === item.id &&
    x.type === item.type
  );

  if (existing) {
    existing.quantity = Number(existing.quantity || 1) +
                        Number(item.quantity || 1);
  } else {
    extensionCart.push({
      ...item,
      quantity: Number(item.quantity || 1)
    });
  }

  refreshExtensionCart();
}


// Change quantity
function extensionChangeQuantity(index, change) {
  const item = extensionCart[index];
  if (!item) return;

  item.quantity = Number(item.quantity || 1) + change;

  if (item.quantity <= 0) {
    extensionCart.splice(index, 1);
  }

  refreshExtensionCart();
}


// Remove item
function extensionRemoveItem(index) {
  extensionCart.splice(index, 1);
  refreshExtensionCart();
}


// Calculate total
function extensionCartTotal() {
  return extensionCart.reduce((total, item) => {
    const price = Number(item.price || 0);
    const quantity = Number(item.quantity || 1);
    const nights = Number(item.nights || 1);

    return total + (price * quantity * nights);
  }, 0);
}


// Render cart
function renderExtensionCart() {
  const page = document.querySelector('#cartPage');
  if (!page) return;

  let container = page.querySelector('.extension-cart-content');

  if (!container) {
    container = document.createElement('div');
    container.className = 'extension-cart-content';
    page.appendChild(container);
  }

  if (!extensionCart.length) {
    container.innerHTML = `
      <div style="
        margin-top:20px;
        padding:20px;
        text-align:center;
        background:#1e293b;
        border-radius:14px;
      ">
        ${T('Košík je prázdny.', 'Your cart is empty.')}
      </div>
    `;
    return;
  }

  container.innerHTML = extensionCart.map((item, index) => {

    const quantity = Number(item.quantity || 1);
    const nights = Number(item.nights || 1);
    const price = Number(item.price || 0);
    const subtotal = price * quantity * nights;

    return `
      <div style="
        background:#1e293b;
        border:1px solid #334155;
        border-radius:14px;
        padding:16px;
        margin-top:12px;
      ">

        <div style="font-weight:800;font-size:17px;">
          ${item.name || item.title || T('Rezervácia','Reservation')}
        </div>

        ${item.details ? `
          <div style="margin-top:6px;color:#cbd5e1;">
            ${item.details}
          </div>
        ` : ''}

        <div style="margin-top:8px;color:#86efac;font-weight:700;">
          £${subtotal.toFixed(2)}
        </div>

        <div style="
          display:flex;
          align-items:center;
          gap:12px;
          margin-top:12px;
        ">
          <button
            type="button"
            onclick="extensionChangeQuantity(${index},-1)"
          >−</button>

          <strong>${quantity}</strong>

          <button
            type="button"
            onclick="extensionChangeQuantity(${index},1)"
          >+</button>

          <button
            type="button"
            onclick="extensionRemoveItem(${index})"
            style="margin-left:auto;"
          >
            ${T('Odstrániť','Remove')}
          </button>
        </div>

      </div>
    `;
  }).join('');

  container.innerHTML += `
    <div style="
      margin-top:20px;
      padding:18px;
      background:#0f172a;
      border:1px solid #334155;
      border-radius:14px;
      font-size:20px;
      font-weight:800;
    ">
      ${T('Spolu','Total')}: £${extensionCartTotal().toFixed(2)}
    </div>

    <button
      type="button"
      id="extensionCheckoutButton"
      style="
        width:100%;
        margin-top:16px;
        padding:15px;
        font-size:17px;
        font-weight:800;
        border:0;
        border-radius:12px;
        background:#22c55e;
      "
    >
      ${T('Pokračovať k pokladni','Continue to checkout')}
    </button>
  `;
}


// Watch ADD buttons and connect them to cart
document.addEventListener('click', function(event) {

  const button = event.target.closest('.add-btn');
  if (!button) return;

  setTimeout(() => {
    updateExtensionCartBadge();
  }, 50);

});


// Refresh cart when cart button is opened
document.addEventListener('click', function(event) {

  if (event.target.closest('.cart-top-btn')) {
    setTimeout(() => {
      renderExtensionCart();
      updateExtensionCartBadge();
    }, 50);
  }

});


// Checkout button
document.addEventListener('click', function(event) {

  if (!event.target.closest('#extensionCheckoutButton')) return;

  window.dispatchEvent(new CustomEvent('communityForAllCheckout', {
    detail: {
      items: extensionCart,
      total: extensionCartTotal()
    }
  }));

});
// ===== CART FIX =====

// Remove duplicate extension empty-cart message
function removeDuplicateExtensionEmptyCart() {
  const container = document.querySelector('.extension-cart-content');

  if (container && extensionCart.length === 0) {
    container.remove();
  }
}

// Capture reservation ADD button
document.addEventListener('click', function (event) {
  const button = event.target.closest('.add-btn');
  if (!button) return;

  const row = button.closest('.option-row');
  if (!row) return;

  const name =
    row.querySelector('.option-name')?.textContent?.trim() ||
    T('Rezervácia', 'Reservation');

  const priceText =
    row.querySelector('.option-price')?.textContent || '0';

  const priceMatch = priceText.match(/[\d,.]+/);
  const price = priceMatch
    ? Number(priceMatch[0].replace(',', '.'))
    : 0;

  const qty =
    Number(
      row.querySelector('.qty-value')?.textContent ||
      row.querySelector('.guest-count')?.textContent ||
      1
    ) || 1;

  const item = {
    id: Date.now() + '-' + Math.random(),
    type: 'reservation',
    name: name,
    price: price,
    quantity: qty,
    nights: 1
  };

  extensionAddItem(item);
});

// Keep badge updated
document.addEventListener('DOMContentLoaded', function () {
  updateExtensionCartBadge();
  removeDuplicateExtensionEmptyCart();
});

// Restore cart after page load
document.addEventListener('DOMContentLoaded', function() {
  updateExtensionCartBadge();

  setTimeout(() => {
    updateExtensionCartBadge();
  }, 300);
});
