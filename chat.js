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
