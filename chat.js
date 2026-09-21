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
/* ===== CHAT SCROLL + SMALL SCREEN FIX ===== */

#chatPage {
    height: 100dvh !important;
    max-height: 100dvh !important;
    overflow: hidden !important;
}

#chatPage .chat-header {
    flex: 0 0 auto !important;
}

#chatPage .chat-messages {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    height: auto !important;

    overflow-y: auto !important;
    overflow-x: hidden !important;

    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior-y: contain !important;
    touch-action: pan-y !important;

    padding-bottom: 190px !important;
}

#chatPage .chat-compose {
    flex: 0 0 auto !important;
    z-index: 10 !important;
}

@media (max-height: 700px) {
    #chatPage .chat-messages {
        padding-bottom: 175px !important;
    }

    #chatPage .chat-compose textarea {
        max-height: 110px !important;
    }
}
