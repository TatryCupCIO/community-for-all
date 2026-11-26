/* Owner-only, read-only Square Sandbox check. No payment credentials in the browser. */
(() => {
  'use strict';
  if (window.CFASquareCheck) return;
  const host = document.querySelector('#accountPage .card') || document.getElementById('accountPage');
  if (!host) return;
  const tr = (sk,en) => currentLanguage === 'en' ? en : sk;
  const section = document.createElement('section');
  section.id = 'cfaSquareCheck'; section.hidden = true;
  section.style.cssText = 'margin-top:20px;padding-top:16px;border-top:1px solid #bfd6d2';
  const title = document.createElement('h3');
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'secondary-btn'; button.id = 'cfaSquareCheckButton';
  const note = document.createElement('p');
  const status = document.createElement('p'); status.id = 'cfaSquareCheckStatus';
  status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
  section.append(title,note,button,status); host.append(section);
  let generation = 0, allowedUser = null, running = false;
  let statusCode = '', statusType = 'info';
  const messages = {
    checking: ['Overujem spojenie so Square…','Checking the Square connection…'],
    success: ['Skúšobné spojenie so Square funguje. Prevádzka je aktívna a používa GBP. Žiadna platba nebola vytvorená.','The Square test connection works. The location is active and uses GBP. No payment was created.'],
    sign_in_required: ['Prihlásenie sa nepodarilo overiť. Odhláste sa a znova sa prihláste.','Could not verify the sign-in. Sign out and sign in again.'],
    owner_required: ['Kontrolu môže spustiť iba vlastníčka.','Only the owner can run this check.'],
    sandbox_secrets_missing: ['V Supabase chýba skúšobný prístupový údaj alebo identifikátor prevádzky.','The Sandbox access token or location ID is missing in Supabase.'],
    sandbox_location_invalid: ['Identifikátor skúšobnej prevádzky má neplatný formát.','The Sandbox location ID format is invalid.'],
    sandbox_token_rejected: ['Square odmietol skúšobný prístupový údaj. Skontrolujeme jeho nastavenie.','Square rejected the Sandbox access token. We need to check its configuration.'],
    sandbox_location_unavailable: ['Skúšobná prevádzka sa nedá načítať. Skontrolujeme identifikátor a účet.','Could not retrieve the Sandbox location. We need to check the ID and account.'],
    sandbox_location_inactive: ['Skúšobná prevádzka nie je aktívna alebo identifikátor nesedí.','The Sandbox location is inactive or its ID does not match.'],
    sandbox_requires_gb_gbp: ['Skúšobná prevádzka nie je nastavená pre Spojené kráľovstvo a GBP. Upravíme skúšobné nastavenie.','The Sandbox location is not configured for the United Kingdom and GBP. We need to adjust the test setup.'],
    server_configuration: ['Chýba nastavenie servera. Kontrolu dokončíme po jeho doplnení.','Server configuration is missing. Complete it before running the check again.'],
    connection_failed: ['Spojenie sa nepodarilo. Skúste kontrolu znova.','The connection failed. Please try the check again.'],
    invalid_jwt: ['Server odmietol overenie prihlásenia. Pošlite screenshot tejto hlášky, nastavenie spolu preveríme.','The server rejected sign-in verification. Send a screenshot of this message so we can check the configuration.'],
    unknown: ['Kontrola sa nepodarila. Pošlite screenshot tejto hlášky.','The check failed. Please send a screenshot of this message.'],
  };
  function render() {
    title.textContent = tr('Kontrola prepojenia Square','Square connection check');
    note.textContent = tr('Iba skúšobné prostredie. Kontrola nevykonáva platbu.','Sandbox only. This check does not create a payment.');
    button.textContent = running ? tr('Overujem…','Checking…') : tr('Overiť spojenie Square','Check Square connection');
    button.disabled = running;
    status.className = statusCode ? 'message '+statusType : 'message';
    status.textContent = statusCode ? tr(...(messages[statusCode] || messages.unknown)) : '';
    status.setAttribute('role',statusType==='error'?'alert':'status');
  }
  async function refresh() {
    const own = ++generation, user = currentUser?.id;
    allowedUser = null; section.hidden = true; running = false; statusCode = ''; render();
    if (!user) return;
    try {
      const result = await supabaseClient.rpc('cfa_is_owner');
      if (own !== generation || currentUser?.id !== user) return;
      if (!result.error && result.data === true) { allowedUser = user; section.hidden = false; }
    } catch { /* Keep controls hidden if authorization cannot be verified. */ }
  }
  button.onclick = async () => {
    if (running || !allowedUser || currentUser?.id !== allowedUser) return;
    const own = generation, user = allowedUser;
    running = true; statusCode = 'checking'; statusType = 'info'; render();
    try {
      const result = await supabaseClient.functions.invoke('cfa-square-check',{body:{}});
      if (own !== generation || currentUser?.id !== user) return;
      let data = result.data;
      if (result.error) {
        try { data = await result.error.context?.json(); } catch { data = null; }
        if (data?.message === 'Invalid JWT' || data?.msg === 'Invalid JWT') statusCode = 'invalid_jwt';
        else statusCode = messages[data?.error] ? data.error : 'unknown';
        statusType = 'error';
      } else if (data?.ok === true && data.environment === 'sandbox' && data.currency === 'GBP' && data.payment_created === false) {
        statusCode = 'success'; statusType = 'success';
      } else { statusCode = 'unknown'; statusType = 'error'; }
    } catch {
      if (own !== generation || currentUser?.id !== user) return;
      statusCode = 'connection_failed'; statusType = 'error';
    } finally {
      if (own === generation && currentUser?.id === user) { running = false; render(); }
    }
  };
  supabaseClient.auth.onAuthStateChange(() => { generation++; allowedUser=null; section.hidden=true; setTimeout(refresh,0); });
  const previousLanguage = window.setLanguage;
  if (typeof previousLanguage === 'function') window.setLanguage = function() { const value=previousLanguage.apply(this,arguments);render();return value; };
  document.addEventListener('visibilitychange',() => { if (!document.hidden && !running) refresh(); });
  render(); refresh();
  window.CFASquareCheck = { refresh };
})();
