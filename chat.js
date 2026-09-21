// ===== COMMUNITY FOR ALL - CHAT =====

let communityChatChannel = null;
let communityChatOpen = false;
let chatNotificationsEnabled = true;

async function openCommunityChat() {
  if (!currentUser) {
    showLogin();
    showMessage(
      'loginMessage',
      T(
        'Pre vstup do chatu sa musíte prihlásiť.',
        'Please sign in to access the chat.'
      ),
      'info'
    );
    return;
  }

  communityChatOpen = true;

  document.querySelector('.container').style.display = 'none';
  document.getElementById('chatPage').style.display = 'flex';

  document.getElementById('communityChatUnreadDot').style.display = 'none';

  await ensureChatSettings();
  await loadCommunityChat();
  await markCommunityChatSeen();
  subscribeCommunityChat();

  setChatLanguage();
}

function closeCommunityChat() {
  communityChatOpen = false;

  document.getElementById('chatPage').style.display = 'none';
  document.querySelector('.container').style.display = '';

  showHome();
}

async function ensureChatSettings() {
  if (!currentUser) return;

  const { data } = await supabaseClient
    .from('chat_user_settings')
    .select('*')
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (!data) {
    await supabaseClient
      .from('chat_user_settings')
      .insert({
        user_id: currentUser.id,
        notifications_enabled: true
      });

    chatNotificationsEnabled = true;
  } else {
    chatNotificationsEnabled = data.notifications_enabled !== false;
  }

  updateChatNotificationToggle();
}

async function loadCommunityChat() {
  const box = document.getElementById('chatMessages');

  box.innerHTML =
    '<div class="loading">' +
    T('Načítavam správy...', 'Loading messages...') +
    '</div>';

  const since = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabaseClient
    .from('chat_messages')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  box.innerHTML = '';

  if (error) {
    box.innerHTML =
      '<div class="loading">' +
      T('Správy sa nepodarilo načítať.', 'Messages could not be loaded.') +
      '</div>';
    return;
  }

  (data || []).forEach(renderCommunityChatMessage);

  scrollCommunityChatToBottom();
}

function renderCommunityChatMessage(message) {
  if (document.getElementById('chat-message-' + message.id)) return;

  const box = document.getElementById('chatMessages');
  const item = document.createElement('div');

  item.id = 'chat-message-' + message.id;
  item.className =
    'chat-message' +
    (message.user_id === currentUser?.id ? ' mine' : '');

  const name = document.createElement('div');
  name.className = 'chat-message-name';
  name.textContent =
    message.user_id === currentUser?.id
      ? T('Ja', 'Me')
      : (message.user_name || T('Používateľ', 'User'));

  item.appendChild(name);

  if (message.message) {
    const text = document.createElement('div');
    text.textContent = message.message;
    item.appendChild(text);
  }

  const time = document.createElement('div');
  time.className = 'chat-message-time';
  time.textContent = formatCommunityChatDate(message.created_at);
  item.appendChild(time);

  box.appendChild(item);
}

function formatCommunityChatDate(value) {
  const d = new Date(value);

  const skDays = ['NE', 'PO', 'UT', 'ST', 'ŠT', 'PI', 'SO'];
  const enDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const day =
    currentLanguage === 'sk'
      ? skDays[d.getDay()]
      : enDays[d.getDay()];

  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (currentLanguage === 'sk') {
    return (
      day +
      ' • ' +
      d.getDate() +
      '.' +
      (d.getMonth() + 1) +
      '.' +
      d.getFullYear() +
      ' • ' +
      hours +
      ':' +
      minutes
    );
  }

  return (
    day +
    ' • ' +
    String(d.getDate()).padStart(2, '0') +
    '/' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '/' +
    d.getFullYear() +
    ' • ' +
    hours +
    ':' +
    minutes
  );
}

async function sendCommunityChatMessage() {
  if (!currentUser) return;

  const input = document.getElementById('chatMessageInput');
  const message = input.value.trim();

  if (!message) return;

  const button = document.getElementById('chatSendBtn');
  button.disabled = true;

  const { error } = await supabaseClient
    .from('chat_messages')
    .insert({
      user_id: currentUser.id,
      user_name: getUsername(currentUser) || 'User',
      message: message,
      media_type: null,
      media_url: null
    });

  button.disabled = false;

  if (error) {
    alert(
      T(
        'Správu sa nepodarilo odoslať.',
        'The message could not be sent.'
      )
    );
    return;
  }

  input.value = '';
}

function subscribeCommunityChat() {
  if (communityChatChannel) return;

  communityChatChannel = supabaseClient
    .channel('community-chat-live')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages'
      },
      payload => {
        renderCommunityChatMessage(payload.new);

        if (communityChatOpen) {
          scrollCommunityChatToBottom();
          markCommunityChatSeen();
        } else if (payload.new.user_id !== currentUser?.id) {
          document.getElementById(
            'communityChatUnreadDot'
          ).style.display = 'block';

          if (chatNotificationsEnabled) {
            playCommunityChatSound();
          }
        }
      }
    )
    .subscribe();
}

async function markCommunityChatSeen() {
  if (!currentUser) return;

  await supabaseClient
    .from('chat_user_settings')
    .update({
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('user_id', currentUser.id);
}

async function toggleChatNotifications() {
  if (!currentUser) return;

  chatNotificationsEnabled = !chatNotificationsEnabled;

  await supabaseClient
    .from('chat_user_settings')
    .update({
      notifications_enabled: chatNotificationsEnabled,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', currentUser.id);

  updateChatNotificationToggle();
}

function updateChatNotificationToggle() {
  const button = document.getElementById('chatNotificationToggle');

  if (!button) return;

  button.classList.toggle('on', chatNotificationsEnabled);
}

function setChatLanguage() {
  const label = document.getElementById('chatNotificationLabel');
  const input = document.getElementById('chatMessageInput');

  if (label) {
    label.textContent = T('Upozornenia', 'Notifications');
  }

  if (input) {
    input.placeholder = T('Napíšte správu...', 'Write a message...');
  }
}

function scrollCommunityChatToBottom() {
  const box = document.getElementById('chatMessages');

  requestAnimationFrame(() => {
    box.scrollTop = box.scrollHeight;
  });
}

function playCommunityChatSound() {
  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.35
    );

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.35);
  } catch (e) {}
    }
// ===== CHAT AUTH DIAGNOSTIC =====
async function chatAuthDiagnostic() {
  const { data, error } = await supabaseClient.auth.getSession();

  alert(
    'CHAT AUTH\n\n' +
    'currentUser: ' + (currentUser?.id || 'NONE') + '\n' +
    'Supabase session: ' + (data?.session?.user?.id || 'NONE') + '\n' +
    'Error: ' + (error?.message || 'NONE')
  );
}

// chatAuthDiagnostic();
// ===== CHAT DATABASE ERROR DIAGNOSTIC =====
async function chatDatabaseDiagnostic() {
  if (!currentUser) return;

  const readTest = await supabaseClient
    .from('chat_messages')
    .select('*')
    .limit(1);

  if (readTest.error) {
    alert(
      'CHAT DATABASE ERROR\n\n' +
      'Code: ' + (readTest.error.code || 'NONE') + '\n' +
      'Message: ' + (readTest.error.message || 'NONE') + '\n' +
      'Details: ' + (readTest.error.details || 'NONE') + '\n' +
      'Hint: ' + (readTest.error.hint || 'NONE')
    );
  } else {
    alert('CHAT DATABASE READ: OK');
  }
}
// chatDatabaseDiagnostic();
/* ===== COMMUNITY CHAT – PHOTOS ===== */

async function compressCommunityChatPhoto(file) {
  const image = await createImageBitmap(file);

  const maxSide = 1600;
  let width = image.width;
  let height = image.height;

  if (width > maxSide || height > maxSide) {
    const scale = maxSide / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, width, height);
  image.close();

  let quality = 0.85;
  let blob = await new Promise(resolve =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );

  while (blob && blob.size > 500 * 1024 && quality > 0.65) {
    quality -= 0.05;

    blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
  }

  return blob;
}


async function sendCommunityChatPhoto(file) {
  if (!currentUser || !file) return;

  if (!file.type.startsWith('image/')) {
    alert(T(
      'Môžete odosielať iba fotografie.',
      'You can only send photos.'
    ));
    return;
  }

  const { data: allowed, error: limitError } =
    await supabaseClient.rpc('can_upload_chat_photo');

  if (limitError || allowed !== true) {
    alert(T(
      'Dosiahli ste limit fotografií: maximálne 20 za 24 hodín a 50 za 30 dní.',
      'You have reached the photo limit: maximum 20 per 24 hours and 50 per 30 days.'
    ));
    return;
  }

  let photo;

  try {
    photo = await compressCommunityChatPhoto(file);
  } catch (error) {
    alert(T(
      'Fotografiu sa nepodarilo spracovať.',
      'The photo could not be processed.'
    ));
    return;
  }

  if (!photo) return;

  const path =
    currentUser.id +
    '/' +
    Date.now() +
    '-' +
    Math.random().toString(36).slice(2) +
    '.jpg';

  const { error: uploadError } =
    await supabaseClient.storage
      .from('chat-media')
      .upload(path, photo, {
        contentType: 'image/jpeg',
        upsert: false
      });

  if (uploadError) {
    alert(T(
      'Fotografiu sa nepodarilo nahrať.',
      'The photo could not be uploaded.'
    ));
    return;
  }

  const { error: messageError } =
    await supabaseClient
      .from('chat_messages')
      .insert({
        user_id: currentUser.id,
        user_name: getUsername(currentUser) || 'User',
        message: null,
        media_type: 'image',
        media_url: path
      });

  if (messageError) {
    await supabaseClient.storage
      .from('chat-media')
      .remove([path]);

    alert(T(
      'Fotografiu sa nepodarilo odoslať.',
      'The photo could not be sent.'
    ));
  }
}


async function loadCommunityChatPhoto(message, container) {
  if (!message.media_url || message.media_type !== 'image') return;

  const { data, error } =
    await supabaseClient.storage
      .from('chat-media')
      .createSignedUrl(message.media_url, 3600);

  if (error || !data?.signedUrl) return;

  const img = document.createElement('img');
  img.src = data.signedUrl;
  img.alt = T('Fotografia v chate', 'Chat photo');
  img.loading = 'lazy';
  img.className = 'chat-photo';

  img.addEventListener('click', () => {
    openCommunityChatPhoto(data.signedUrl);
  });

  container.appendChild(img);
}


function openCommunityChatPhoto(url) {
  let viewer = document.getElementById('chatPhotoViewer');

  if (!viewer) {
    viewer = document.createElement('div');
    viewer.id = 'chatPhotoViewer';

    viewer.innerHTML =
      '<button type="button" id="chatPhotoViewerClose">×</button>' +
      '<img id="chatPhotoViewerImage" alt="">';

    document.body.appendChild(viewer);

    document
      .getElementById('chatPhotoViewerClose')
      .addEventListener('click', closeCommunityChatPhoto);

    viewer.addEventListener('click', event => {
      if (event.target === viewer) {
        closeCommunityChatPhoto();
      }
    });
  }

  document.getElementById('chatPhotoViewerImage').src = url;
  viewer.style.display = 'flex';
}


function closeCommunityChatPhoto() {
  const viewer = document.getElementById('chatPhotoViewer');

  if (viewer) {
    viewer.style.display = 'none';
  }
}


/* Rozšírenie existujúceho vykresľovania správ o fotografie */

const communityChatOriginalRender = renderCommunityChatMessage;

renderCommunityChatMessage = function(message) {
  if (document.getElementById('chat-message-' + message.id)) return;

  communityChatOriginalRender(message);

  if (message.media_type === 'image' && message.media_url) {
    const item =
      document.getElementById('chat-message-' + message.id);

    if (!item) return;

    const time = item.querySelector('.chat-message-time');

    const photoHolder = document.createElement('div');
    photoHolder.className = 'chat-photo-holder';

    if (time) {
      item.insertBefore(photoHolder, time);
    } else {
      item.appendChild(photoHolder);
    }

    loadCommunityChatPhoto(message, photoHolder);
  }
};


/* Napojenie tlačidla/výberu fotografie */

const communityChatPhotoInput =
  document.getElementById('chatPhotoInput');

if (communityChatPhotoInput) {
  communityChatPhotoInput.addEventListener('change', async event => {
    const file = event.target.files?.[0];

    if (file) {
      await sendCommunityChatPhoto(file);
    }

    event.target.value = '';
  });
}
/* ===== COMMUNITY CHAT – DELETE OWN MESSAGE / PHOTO ===== */

async function deleteOwnCommunityChatMessage(message) {
  if (!currentUser || message.user_id !== currentUser.id) return;

  const question =
    message.media_type === 'image'
      ? T(
          'Naozaj chcete vymazať túto fotografiu?',
          'Do you really want to delete this photo?'
        )
      : T(
          'Naozaj chcete vymazať túto správu?',
          'Do you really want to delete this message?'
        );

  if (!confirm(question)) return;

  /* Ak je to fotografia, najprv odstráň súbor zo Storage */
  if (message.media_type === 'image' && message.media_url) {
    const { error: storageError } =
      await supabaseClient.storage
        .from('chat-media')
        .remove([message.media_url]);

    if (storageError) {
      alert(
        T(
          'Fotografiu sa nepodarilo vymazať.',
          'The photo could not be deleted.'
        )
      );
      return;
    }
  }

  /* Odstráň správu z databázy */
  const { error } =
    await supabaseClient
      .from('chat_messages')
      .delete()
      .eq('id', message.id)
      .eq('user_id', currentUser.id);

  if (error) {
    alert(
      T(
        'Správu sa nepodarilo vymazať.',
        'The message could not be deleted.'
      )
    );
    return;
  }

  const item =
    document.getElementById('chat-message-' + message.id);

  if (item) item.remove();
}


/* Pridá kôš iba k vlastným správam a fotografiám */

const communityChatRenderWithPhotos = renderCommunityChatMessage;

renderCommunityChatMessage = function(message) {
  communityChatRenderWithPhotos(message);

  if (!currentUser || message.user_id !== currentUser.id) return;

  const item =
    document.getElementById('chat-message-' + message.id);

  if (!item || item.querySelector('.chat-delete-btn')) return;

  const deleteButton = document.createElement('button');

  deleteButton.type = 'button';
  deleteButton.className = 'chat-delete-btn';
  deleteButton.innerHTML = '🗑️';
  deleteButton.title = T('Vymazať', 'Delete');

  deleteButton.addEventListener('click', event => {
    event.stopPropagation();
    deleteOwnCommunityChatMessage(message);
  });

  item.appendChild(deleteButton);
};
/* ===== CHAT – 30 DAY INFORMATION ===== */

function addCommunityChatRetentionInfo() {
  const compose = document.querySelector('#chatPage .chat-compose');
  if (!compose || document.getElementById('chatRetentionInfo')) return;

  const info = document.createElement('button');
  info.id = 'chatRetentionInfo';
  info.type = 'button';
  info.className = 'chat-retention-info';
  info.textContent = 'ⓘ';

  info.addEventListener('click', () => {
    alert(
      T(
        'Správy a fotografie v chate sa automaticky vymažú po 30 dňoch.',
        'Chat messages and photos are automatically deleted after 30 days.'
      )
    );
  });

  compose.appendChild(info);
}

addCommunityChatRetentionInfo();
/* ===== CHAT PHOTO – CONFIRM BEFORE SEND ===== */

let pendingCommunityChatPhoto = null;
let pendingCommunityChatPreviewUrl = null;

function showPendingCommunityChatPhoto(file) {
  pendingCommunityChatPhoto = file;

  if (pendingCommunityChatPreviewUrl) {
    URL.revokeObjectURL(pendingCommunityChatPreviewUrl);
  }

  pendingCommunityChatPreviewUrl = URL.createObjectURL(file);

  let preview = document.getElementById('chatPendingPhoto');

  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'chatPendingPhoto';
    preview.style.cssText =
      'position:relative;max-width:120px;margin:0 0 6px 0;';

    preview.innerHTML =
      '<img id="chatPendingPhotoImage" style="display:block;max-width:120px;max-height:100px;border-radius:10px;">' +
      '<button type="button" id="chatPendingPhotoRemove" ' +
      'style="position:absolute;right:-7px;top:-7px;width:25px;height:25px;' +
      'border:0;border-radius:50%;background:#ff7417;color:white;font-size:18px;' +
      'line-height:23px;padding:0;">×</button>';

    const compose = document.querySelector('#chatPage .chat-compose');
    const input = document.getElementById('chatMessageInput');

    if (compose && input) {
      compose.insertBefore(preview, input);
    }

    document
      .getElementById('chatPendingPhotoRemove')
      .addEventListener('click', clearPendingCommunityChatPhoto);
  }

  document.getElementById('chatPendingPhotoImage').src =
    pendingCommunityChatPreviewUrl;

  preview.style.display = 'block';
}

function clearPendingCommunityChatPhoto() {
  pendingCommunityChatPhoto = null;

  if (pendingCommunityChatPreviewUrl) {
    URL.revokeObjectURL(pendingCommunityChatPreviewUrl);
    pendingCommunityChatPreviewUrl = null;
  }

  const preview = document.getElementById('chatPendingPhoto');

  if (preview) {
    preview.style.display = 'none';
  }

  const input = document.getElementById('chatPhotoInput');

  if (input) {
    input.value = '';
  }
}


/* Zastaví pôvodné okamžité odoslanie fotografie */

if (communityChatPhotoInput) {
  const replacementInput = communityChatPhotoInput.cloneNode(true);

  communityChatPhotoInput.parentNode.replaceChild(
    replacementInput,
    communityChatPhotoInput
  );

  replacementInput.addEventListener('change', event => {
    const file = event.target.files?.[0];

    if (file) {
      showPendingCommunityChatPhoto(file);
    }
  });

  const photoButton = document.querySelector(
    '#chatPage .chat-photo-btn'
  );

  if (photoButton) {
    const newPhotoButton = photoButton.cloneNode(true);

    photoButton.parentNode.replaceChild(
      newPhotoButton,
      photoButton
    );

    newPhotoButton.addEventListener('click', () => {
      replacementInput.click();
    });
  }
}


/* Oranžová šípka odošle text aj pripravenú fotografiu */

const originalSendCommunityChatMessage =
  sendCommunityChatMessage;

sendCommunityChatMessage = async function() {
  const text =
    document.getElementById('chatMessageInput')?.value.trim();

  const photo = pendingCommunityChatPhoto;

  if (!text && !photo) return;

  if (text) {
    await originalSendCommunityChatMessage();
  }

  if (photo) {
    await sendCommunityChatPhoto(photo);
    clearPendingCommunityChatPhoto();
  }
};
/* ===== CHAT PHOTO – MOBILE COMPATIBILITY FIX ===== */

compressCommunityChatPhoto = async function(file) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('IMAGE_LOAD_FAILED'));

      img.src = objectUrl;
    });

    const maxSide = 1600;
    let width = image.naturalWidth || image.width;
    let height = image.naturalHeight || image.height;

    if (!width || !height) {
      throw new Error('INVALID_IMAGE_SIZE');
    }

    if (width > maxSide || height > maxSide) {
      const scale = maxSide / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('CANVAS_NOT_AVAILABLE');
    }

    ctx.drawImage(image, 0, 0, width, height);

    let quality = 0.85;

    let blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });

    while (blob && blob.size > 500 * 1024 && quality > 0.50) {
      quality -= 0.05;

      blob = await new Promise(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', quality);
      });
    }

    if (!blob) {
      throw new Error('PHOTO_COMPRESSION_FAILED');
    }

    return blob;

  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
/* ===== CHAT – NAVIGATION, UNREAD & READ RECEIPTS ===== */

let communityChatReadsChannel = null;

/* SYSTEM / BROWSER BACK */

const chatBaseOpen = openCommunityChat;
const chatBaseClose = closeCommunityChat;

openCommunityChat = async function () {
  if (!currentUser) {
    return chatBaseOpen();
  }

  if (!communityChatOpen) {
    history.pushState(
      { communityChat: true },
      '',
      location.href
    );
  }

  await chatBaseOpen();

  if (!communityChatOpen) return;

  await markAllCommunityChatMessagesRead();
  await markCommunityChatSeen();
  await refreshCommunityChatUnreadDot();
  await refreshCommunityChatReadReceipts();
};

closeCommunityChat = function () {
  if (communityChatOpen && history.state?.communityChat) {
    history.back();
  } else {
    chatBaseClose();
  }
};

window.addEventListener('popstate', () => {
  if (communityChatOpen) {
    chatBaseClose();
  }
});


/* INDIVIDUAL UNREAD DOT */

async function refreshCommunityChatUnreadDot() {
  const dot = document.getElementById('communityChatUnreadDot');

  if (!dot) return;

  if (!currentUser) {
    dot.style.display = 'none';
    return;
  }

  const { data: settings, error: settingsError } =
    await supabaseClient
      .from('chat_user_settings')
      .select('last_seen_at')
      .eq('user_id', currentUser.id)
      .maybeSingle();

  if (settingsError) return;

  const lastSeen =
    settings?.last_seen_at ||
    '1970-01-01T00:00:00.000Z';

  const { count, error } =
    await supabaseClient
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .neq('user_id', currentUser.id)
      .gt('created_at', lastSeen);

  if (error) return;

  dot.style.display = count > 0 ? 'block' : 'none';
}


/* STORE READ RECEIPTS */

async function markAllCommunityChatMessagesRead() {
  if (!currentUser || !communityChatOpen) return;

  const since = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: messages, error } =
    await supabaseClient
      .from('chat_messages')
      .select('id,user_id')
      .neq('user_id', currentUser.id)
      .gte('created_at', since);

  if (error || !messages?.length) return;

  const readAt = new Date().toISOString();

  const rows = messages.map(message => ({
    message_id: message.id,
    user_id: currentUser.id,
    user_name: getUsername(currentUser) || 'User',
    read_at: readAt
  }));

  await supabaseClient
    .from('chat_message_reads')
    .upsert(rows, {
      onConflict: 'message_id,user_id'
    });
}


/* DISPLAY SEEN BY */

async function refreshCommunityChatReadReceipts() {
  if (!currentUser || !communityChatOpen) return;

  const ownItems = document.querySelectorAll(
    '#chatMessages .chat-message.mine'
  );

  for (const item of ownItems) {
    const messageId =
      Number(item.id.replace('chat-message-', ''));

    if (!messageId) continue;

    const { data, error } =
      await supabaseClient
        .from('chat_message_reads')
        .select('user_name')
        .eq('message_id', messageId);

    if (error) continue;

    let receipt =
      item.querySelector('.chat-read-receipt');

    if (!receipt) {
      receipt = document.createElement('div');
      receipt.className = 'chat-read-receipt';
      item.appendChild(receipt);
    }

    const names = [...new Set(
      (data || [])
        .map(row => row.user_name)
        .filter(Boolean)
    )];

    if (names.length) {
      receipt.textContent =
        T('Videné: ', 'Seen: ') + names.join(', ');
      receipt.style.display = '';
    } else {
      receipt.textContent = '';
      receipt.style.display = 'none';
    }
  }
}


/* REALTIME READ RECEIPTS */

function subscribeCommunityChatReads() {
  if (communityChatReadsChannel) return;

  communityChatReadsChannel = supabaseClient
    .channel('community-chat-reads-live')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'chat_message_reads'
      },
      () => {
        if (communityChatOpen) {
          refreshCommunityChatReadReceipts();
        }
      }
    )
    .subscribe();
}


/* REALTIME CHAT AVAILABLE BEFORE FIRST OPEN */

async function startCommunityChatForLoggedUser() {
  if (!currentUser) return;

  await ensureChatSettings();

  subscribeCommunityChat();
  subscribeCommunityChatReads();

  await refreshCommunityChatUnreadDot();
}


/* NEW MESSAGE WHILE CHAT IS OPEN */

const chatRenderBeforeReadReceipts =
  renderCommunityChatMessage;

renderCommunityChatMessage = function (message) {
  chatRenderBeforeReadReceipts(message);

  if (
    communityChatOpen &&
    currentUser &&
    message.user_id !== currentUser.id
  ) {
    setTimeout(async () => {
      await markAllCommunityChatMessagesRead();
      await markCommunityChatSeen();

      const dot =
        document.getElementById('communityChatUnreadDot');

      if (dot) dot.style.display = 'none';
    }, 100);
  }
};


/* START / REFRESH */

setTimeout(() => {
  if (currentUser) {
    startCommunityChatForLoggedUser();
  }
}, 1000);

window.addEventListener('focus', () => {
  if (currentUser) {
    startCommunityChatForLoggedUser();
  }
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && currentUser) {
    startCommunityChatForLoggedUser();
  }
});
/* ===== CHAT – SEEN DISPLAY FIX ===== */

async function refreshSeenDisplayFix() {
  if (!currentUser || !communityChatOpen) return;

  const ownItems = [
    ...document.querySelectorAll('#chatMessages .chat-message.mine')
  ];

  if (!ownItems.length) return;

  const messageIds = ownItems
    .map(item => Number(item.id.replace('chat-message-', '')))
    .filter(Boolean);

  const { data, error } = await supabaseClient
    .from('chat_message_reads')
    .select('message_id,user_name')
    .in('message_id', messageIds);

  if (error) return;

  const reads = {};

  (data || []).forEach(row => {
    if (!reads[row.message_id]) reads[row.message_id] = [];

    if (
      row.user_name &&
      !reads[row.message_id].includes(row.user_name)
    ) {
      reads[row.message_id].push(row.user_name);
    }
  });

  ownItems.forEach(item => {
    const messageId =
      Number(item.id.replace('chat-message-', ''));

    const names = reads[messageId] || [];

    let receipt =
      item.querySelector('.chat-read-receipt');

    if (!receipt) {
      receipt = document.createElement('div');
      receipt.className = 'chat-read-receipt';
      item.appendChild(receipt);
    }

    if (names.length) {
      receipt.textContent =
        T('Videné: ', 'Seen: ') + names.join(', ');
      receipt.style.display = 'block';
    } else {
      receipt.style.display = 'none';
    }
  });
}

const chatOpenBeforeSeenFix = openCommunityChat;

openCommunityChat = async function () {
  await chatOpenBeforeSeenFix();

  setTimeout(refreshSeenDisplayFix, 300);
};

setInterval(() => {
  if (communityChatOpen) {
    refreshSeenDisplayFix();
  }
}, 2000);
/* ===== CHAT – CLICKABLE SEEN LIST ===== */

const refreshSeenDisplayWithNames = refreshSeenDisplayFix;

refreshSeenDisplayFix = async function () {
  if (!currentUser || !communityChatOpen) return;

  const ownItems = [
    ...document.querySelectorAll('#chatMessages .chat-message.mine')
  ];

  if (!ownItems.length) return;

  const messageIds = ownItems
    .map(item => Number(item.id.replace('chat-message-', '')))
    .filter(Boolean);

  const { data, error } = await supabaseClient
    .from('chat_message_reads')
    .select('message_id,user_name')
    .in('message_id', messageIds);

  if (error) return;

  const reads = {};

  (data || []).forEach(row => {
    if (!reads[row.message_id]) reads[row.message_id] = [];

    if (
      row.user_name &&
      !reads[row.message_id].includes(row.user_name)
    ) {
      reads[row.message_id].push(row.user_name);
    }
  });

  ownItems.forEach(item => {
    const messageId =
      Number(item.id.replace('chat-message-', ''));

    const names = reads[messageId] || [];

    let receipt = item.querySelector('.chat-read-receipt');

    if (!receipt) {
      receipt = document.createElement('div');
      receipt.className = 'chat-read-receipt';
      item.appendChild(receipt);
    }

    if (!names.length) {
      receipt.style.display = 'none';
      return;
    }

    receipt.style.display = 'block';
    receipt.style.cursor = 'pointer';
    receipt.textContent =
      '👁️ ' + T('Videné: ', 'Seen: ') + names.length;

    receipt.onclick = event => {
      event.stopPropagation();

      alert(
        T('Videli:\n', 'Seen by:\n') +
        names.join('\n')
      );
    };
  });
};
