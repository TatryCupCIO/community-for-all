// ============================================================
// COMMUNITY FOR ALL
// CHAT.JS – CLEAN VERSION
// Public community chat
// ============================================================


// ============================================================
// STATE
// ============================================================

let communityChatChannel = null;
let communityChatReadsChannel = null;

let communityChatOpen = false;
let chatNotificationsEnabled = true;

let pendingCommunityChatPhoto = null;
let pendingCommunityChatPreviewUrl = null;


// ============================================================
// OPEN / CLOSE CHAT
// ============================================================

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

  if (!communityChatOpen) {
    history.pushState(
      { communityChat: true },
      '',
      location.href
    );
  }

  communityChatOpen = true;

  const container =
    document.querySelector('.container');

  const chatPage =
    document.getElementById('chatPage');

  const unreadDot =
    document.getElementById(
      'communityChatUnreadDot'
    );

  if (container) {
    container.style.display = 'none';
  }

  if (chatPage) {
    chatPage.style.display = 'flex';
  }

  if (unreadDot) {
    unreadDot.style.display = 'none';
  }

  setChatLanguage();

  await ensureChatSettings();
  await loadCommunityChat();

  await markAllCommunityChatMessagesRead();
  await markCommunityChatSeen();

  subscribeCommunityChat();
  subscribeCommunityChatReads();

  await refreshCommunityChatUnreadDot();
  await refreshCommunityChatReadReceipts();

  setTimeout(
    refreshCommunityChatReadReceipts,
    300
  );
}


function closeCommunityChat() {
  if (
    communityChatOpen &&
    history.state?.communityChat
  ) {
    history.back();
    return;
  }

  closeCommunityChatView();
}


function closeCommunityChatView() {
  communityChatOpen = false;

  clearPendingCommunityChatPhoto();

  const chatPage =
    document.getElementById('chatPage');

  const container =
    document.querySelector('.container');

  if (chatPage) {
    chatPage.style.display = 'none';
  }

  if (container) {
    container.style.display = '';
  }

  showHome();
}


window.addEventListener(
  'popstate',
  () => {
    if (communityChatOpen) {
      closeCommunityChatView();
    }
  }
);


// ============================================================
// CHAT SETTINGS
// ============================================================

async function ensureChatSettings() {
  if (!currentUser) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from('chat_user_settings')
      .select('*')
      .eq(
        'user_id',
        currentUser.id
      )
      .maybeSingle();

  if (error) {
    return;
  }

  if (!data) {
    const {
      error: insertError
    } =
      await supabaseClient
        .from('chat_user_settings')
        .insert({
          user_id:
            currentUser.id,

          notifications_enabled:
            true
        });

    if (!insertError) {
      chatNotificationsEnabled = true;
    }

  } else {
    chatNotificationsEnabled =
      data.notifications_enabled !== false;
  }

  updateChatNotificationToggle();
}


async function toggleChatNotifications() {
  if (!currentUser) {
    return;
  }

  const nextValue =
    !chatNotificationsEnabled;

  const {
    error
  } =
    await supabaseClient
      .from('chat_user_settings')
      .update({
        notifications_enabled:
          nextValue,

        updated_at:
          new Date().toISOString()
      })
      .eq(
        'user_id',
        currentUser.id
      );

  if (error) {
    return;
  }

  chatNotificationsEnabled =
    nextValue;

  updateChatNotificationToggle();
}


function updateChatNotificationToggle() {
  const button =
    document.getElementById(
      'chatNotificationToggle'
    );

  if (!button) {
    return;
  }

  button.classList.toggle(
    'on',
    chatNotificationsEnabled
  );
}


// ============================================================
// LANGUAGE
// ============================================================

function setChatLanguage() {
  const label =
    document.getElementById(
      'chatNotificationLabel'
    );

  const input =
    document.getElementById(
      'chatMessageInput'
    );

  const deleteButtons =
    document.querySelectorAll(
      '#chatMessages .chat-delete-btn'
    );

  const photo =
    document.querySelector(
      '#chatPage .chat-photo-btn'
    );

  if (label) {
    label.textContent =
      T(
        'Upozornenia',
        'Notifications'
      );
  }

  if (input) {
    input.placeholder =
      T(
        'Napíšte správu...',
        'Write a message...'
      );
  }

  if (photo) {
    photo.title =
      T(
        'Pridať fotografiu',
        'Add photo'
      );
  }

  deleteButtons.forEach(
    button => {
      button.title =
        T(
          'Vymazať',
          'Delete'
        );
    }
  );

  refreshCommunityChatDisplayedLanguage();
}


function refreshCommunityChatDisplayedLanguage() {
  const items =
    document.querySelectorAll(
      '#chatMessages .chat-message'
    );

  items.forEach(
    item => {
      const rawDate =
        item.dataset.createdAt;

      const time =
        item.querySelector(
          '.chat-message-time'
        );

      if (
        rawDate &&
        time
      ) {
        time.textContent =
          formatCommunityChatDate(
            rawDate
          );
      }

      const name =
        item.querySelector(
          '.chat-message-name'
        );

      if (
        name &&
        item.dataset.own === 'true'
      ) {
        name.textContent =
          T(
            'Ja',
            'Me'
          );
      }
    }
  );

  refreshCommunityChatReadReceipts();
}


// ============================================================
// DATE / TIME
// ============================================================

function formatCommunityChatDate(value) {
  const date =
    new Date(value);

  const skDays = [
    'NE',
    'PO',
    'UT',
    'ST',
    'ŠT',
    'PI',
    'SO'
  ];

  const enDays = [
    'SUN',
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT'
  ];

  const day =
    currentLanguage === 'sk'
      ? skDays[
          date.getDay()
        ]
      : enDays[
          date.getDay()
        ];

  const hours =
    String(
      date.getHours()
    ).padStart(
      2,
      '0'
    );

  const minutes =
    String(
      date.getMinutes()
    ).padStart(
      2,
      '0'
    );

  if (
    currentLanguage === 'sk'
  ) {
    return (
      day +
      ' • ' +
      date.getDate() +
      '.' +
      (
        date.getMonth() + 1
      ) +
      '.' +
      date.getFullYear() +
      ' • ' +
      hours +
      ':' +
      minutes
    );
  }

  return (
    day +
    ' • ' +
    String(
      date.getDate()
    ).padStart(
      2,
      '0'
    ) +
    '/' +
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    ) +
    '/' +
    date.getFullYear() +
    ' • ' +
    hours +
    ':' +
    minutes
  );
}


// ============================================================
// LOAD PUBLIC CHAT
// ============================================================

async function loadCommunityChat() {
  const box =
    document.getElementById(
      'chatMessages'
    );

  if (!box) {
    return;
  }

  box.innerHTML =
    '<div class="loading">' +
    T(
      'Načítavam správy...',
      'Loading messages...'
    ) +
    '</div>';

  const since =
    new Date(
      Date.now() -
      30 *
      24 *
      60 *
      60 *
      1000
    ).toISOString();

  const {
    data,
    error
  } =
    await supabaseClient
      .from('chat_messages')
      .select('*')
      .gte(
        'created_at',
        since
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      );

  box.innerHTML = '';

  if (error) {
    box.innerHTML =
      '<div class="loading">' +
      T(
        'Správy sa nepodarilo načítať.',
        'Messages could not be loaded.'
      ) +
      '</div>';

    return;
  }

  for (
    const message
    of data || []
  ) {
    renderCommunityChatMessage(
      message
    );
  }

  scrollCommunityChatToBottom();
}


// ============================================================
// RENDER ONE MESSAGE
// Single renderer for text, photo, delete and read receipt
// ============================================================

function renderCommunityChatMessage(
  message
) {
  if (!message?.id) {
    return;
  }

  if (
    document.getElementById(
      'chat-message-' +
      message.id
    )
  ) {
    return;
  }

  const box =
    document.getElementById(
      'chatMessages'
    );

  if (!box) {
    return;
  }

  const ownMessage =
    message.user_id ===
    currentUser?.id;

  const item =
    document.createElement(
      'div'
    );

  item.id =
    'chat-message-' +
    message.id;

  item.className =
    'chat-message' +
    (
      ownMessage
        ? ' mine'
        : ''
    );

  item.dataset.createdAt =
    message.created_at || '';

  item.dataset.own =
    ownMessage
      ? 'true'
      : 'false';


  // ----------------------------------------------------------
  // USER NAME
  // ----------------------------------------------------------

  const name =
    document.createElement(
      'div'
    );

  name.className =
    'chat-message-name';

  name.textContent =
    ownMessage
      ? T(
          'Ja',
          'Me'
        )
      : (
          message.user_name ||
          T(
            'Používateľ',
            'User'
          )
        );

  item.appendChild(
    name
  );


  // ----------------------------------------------------------
  // TEXT
  // ----------------------------------------------------------

  if (message.message) {
    const text =
      document.createElement(
        'div'
      );

    text.className =
      'chat-message-text';

    text.textContent =
      message.message;

    item.appendChild(
      text
    );
  }


  // ----------------------------------------------------------
  // PHOTO
  // ----------------------------------------------------------

  if (
    message.media_type ===
      'image' &&
    message.media_url
  ) {
    const photoHolder =
      document.createElement(
        'div'
      );

    photoHolder.className =
      'chat-photo-holder';

    item.appendChild(
      photoHolder
    );

    loadCommunityChatPhoto(
      message,
      photoHolder
    );
  }


  // ----------------------------------------------------------
  // TIME
  // ----------------------------------------------------------

  const time =
    document.createElement(
      'div'
    );

  time.className =
    'chat-message-time';

  time.textContent =
    formatCommunityChatDate(
      message.created_at
    );

  item.appendChild(
    time
  );


  // ----------------------------------------------------------
  // READ RECEIPT HOLDER
  // ----------------------------------------------------------

  if (ownMessage) {
    const receipt =
      document.createElement(
        'div'
      );

    receipt.className =
      'chat-read-receipt';

    receipt.style.display =
      'none';

    item.appendChild(
      receipt
    );
  }


  // ----------------------------------------------------------
  // DELETE OWN MESSAGE / PHOTO
  // ----------------------------------------------------------

  if (ownMessage) {
    const deleteButton =
      document.createElement(
        'button'
      );

    deleteButton.type =
      'button';

    deleteButton.className =
      'chat-delete-btn';

    deleteButton.textContent =
      '🗑️';

    deleteButton.title =
      T(
        'Vymazať',
        'Delete'
      );

    deleteButton.addEventListener(
      'click',
      event => {
        event.stopPropagation();

        deleteOwnCommunityChatMessage(
          message
        );
      }
    );

    item.appendChild(
      deleteButton
    );
  }

  box.appendChild(
    item
  );
}


// ============================================================
// SCROLL
// ============================================================

function scrollCommunityChatToBottom() {
  const box =
    document.getElementById(
      'chatMessages'
    );

  if (!box) {
    return;
  }

  requestAnimationFrame(
    () => {
      box.scrollTop =
        box.scrollHeight;
    }
  );
}


// ============================================================
// SEND TEXT MESSAGE
// ============================================================

async function sendCommunityChatText(
  text
) {
  if (
    !currentUser ||
    !text
  ) {
    return false;
  }

  const {
    error
  } =
    await supabaseClient
      .from('chat_messages')
      .insert({
        user_id:
          currentUser.id,

        user_name:
          getUsername(
            currentUser
          ) || 'User',

        message:
          text,

        media_type:
          null,

        media_url:
          null
      });

  if (error) {
    alert(
      T(
        'Správu sa nepodarilo odoslať.',
        'The message could not be sent.'
      )
    );

    return false;
  }

  return true;
}


// ============================================================
// MAIN SEND BUTTON
// Text + prepared photo
// ============================================================

async function sendCommunityChatMessage() {
  if (!currentUser) {
    return;
  }

  const input =
    document.getElementById(
      'chatMessageInput'
    );

  const button =
    document.getElementById(
      'chatSendBtn'
    );

  const text =
    input?.value
      ?.trim() || '';

  const photo =
    pendingCommunityChatPhoto;

  if (
    !text &&
    !photo
  ) {
    return;
  }

  if (button) {
    button.disabled = true;
  }

  try {
    if (text) {
      const sent =
        await sendCommunityChatText(
          text
        );

      if (!sent) {
        return;
      }

      if (input) {
        input.value = '';
      }
    }

    if (photo) {
      const sent =
        await sendCommunityChatPhoto(
          photo
        );

      if (sent) {
        clearPendingCommunityChatPhoto();
      }
    }

  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}


// ============================================================
// PHOTO COMPRESSION
// Mobile-compatible implementation
// ============================================================

async function compressCommunityChatPhoto(
  file
) {
  const objectUrl =
    URL.createObjectURL(
      file
    );

  try {
    const image =
      await new Promise(
        (
          resolve,
          reject
        ) => {
          const img =
            new Image();

          img.onload =
            () =>
              resolve(img);

          img.onerror =
            () =>
              reject(
                new Error(
                  'IMAGE_LOAD_FAILED'
                )
              );

          img.src =
            objectUrl;
        }
      );

    const maxSide =
      1600;

    let width =
      image.naturalWidth ||
      image.width;

    let height =
      image.naturalHeight ||
      image.height;

    if (
      !width ||
      !height
    ) {
      throw new Error(
        'INVALID_IMAGE_SIZE'
      );
    }

    if (
      width > maxSide ||
      height > maxSide
    ) {
      const scale =
        maxSide /
        Math.max(
          width,
          height
        );

      width =
        Math.round(
          width * scale
        );

      height =
        Math.round(
          height * scale
        );
    }

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width =
      width;

    canvas.height =
      height;

    const context =
      canvas.getContext(
        '2d'
      );

    if (!context) {
      throw new Error(
        'CANVAS_NOT_AVAILABLE'
      );
    }

    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    let quality =
      0.85;

    let blob =
      await new Promise(
        resolve => {
          canvas.toBlob(
            resolve,
            'image/jpeg',
            quality
          );
        }
      );

    while (
      blob &&
      blob.size >
        500 * 1024 &&
      quality > 0.50
    ) {
      quality -= 0.05;

      blob =
        await new Promise(
          resolve => {
            canvas.toBlob(
              resolve,
              'image/jpeg',
              quality
            );
          }
        );
    }

    if (!blob) {
      throw new Error(
        'PHOTO_COMPRESSION_FAILED'
      );
    }

    return blob;

  } finally {
    URL.revokeObjectURL(
      objectUrl
    );
  }
}
// ============================================================
// SEND PHOTO
// ============================================================

async function sendCommunityChatPhoto(
  file
) {
  if (
    !currentUser ||
    !file
  ) {
    return false;
  }

  if (
    !file.type ||
    !file.type.startsWith(
      'image/'
    )
  ) {
    alert(
      T(
        'Môžete odosielať iba fotografie.',
        'You can only send photos.'
      )
    );

    return false;
  }

  const {
    data: allowed,
    error: limitError
  } =
    await supabaseClient
      .rpc(
        'can_upload_chat_photo'
      );

  if (
    limitError ||
    allowed !== true
  ) {
    alert(
      T(
        'Dosiahli ste limit fotografií: maximálne 20 za 24 hodín a 50 za 30 dní.',
        'You have reached the photo limit: maximum 20 per 24 hours and 50 per 30 days.'
      )
    );

    return false;
  }

  let photo;

  try {
    photo =
      await compressCommunityChatPhoto(
        file
      );

  } catch (error) {
    alert(
      T(
        'Fotografiu sa nepodarilo spracovať.',
        'The photo could not be processed.'
      )
    );

    return false;
  }

  if (!photo) {
    return false;
  }

  const path =
    currentUser.id +
    '/' +
    Date.now() +
    '-' +
    Math.random()
      .toString(36)
      .slice(2) +
    '.jpg';

  const {
    error: uploadError
  } =
    await supabaseClient
      .storage
      .from(
        'chat-media'
      )
      .upload(
        path,
        photo,
        {
          contentType:
            'image/jpeg',

          upsert:
            false
        }
      );

  if (uploadError) {
    alert(
      T(
        'Fotografiu sa nepodarilo nahrať.',
        'The photo could not be uploaded.'
      )
    );

    return false;
  }

  const {
    error: messageError
  } =
    await supabaseClient
      .from(
        'chat_messages'
      )
      .insert({
        user_id:
          currentUser.id,

        user_name:
          getUsername(
            currentUser
          ) || 'User',

        message:
          null,

        media_type:
          'image',

        media_url:
          path
      });

  if (messageError) {
    await supabaseClient
      .storage
      .from(
        'chat-media'
      )
      .remove([
        path
      ]);

    alert(
      T(
        'Fotografiu sa nepodarilo odoslať.',
        'The photo could not be sent.'
      )
    );

    return false;
  }

  return true;
}


// ============================================================
// LOAD PHOTO FROM STORAGE
// ============================================================

async function loadCommunityChatPhoto(
  message,
  container
) {
  if (
    !message?.media_url ||
    message.media_type !==
      'image' ||
    !container
  ) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from(
        'chat-media'
      )
      .createSignedUrl(
        message.media_url,
        3600
      );

  if (
    error ||
    !data?.signedUrl
  ) {
    return;
  }

  const image =
    document.createElement(
      'img'
    );

  image.src =
    data.signedUrl;

  image.alt =
    T(
      'Fotografia v chate',
      'Chat photo'
    );

  image.loading =
    'lazy';

  image.className =
    'chat-photo';

  image.addEventListener(
    'click',
    () => {
      openCommunityChatPhoto(
        data.signedUrl
      );
    }
  );

  container.appendChild(
    image
  );
}


// ============================================================
// FULLSCREEN PHOTO VIEWER
// ============================================================

function openCommunityChatPhoto(
  url
) {
  if (!url) {
    return;
  }

  let viewer =
    document.getElementById(
      'chatPhotoViewer'
    );

  if (!viewer) {
    viewer =
      document.createElement(
        'div'
      );

    viewer.id =
      'chatPhotoViewer';

    viewer.innerHTML =
      '<button type="button" id="chatPhotoViewerClose">×</button>' +
      '<img id="chatPhotoViewerImage" alt="">';

    document.body.appendChild(
      viewer
    );

    const closeButton =
      document.getElementById(
        'chatPhotoViewerClose'
      );

    if (closeButton) {
      closeButton.addEventListener(
        'click',
        closeCommunityChatPhoto
      );
    }

    viewer.addEventListener(
      'click',
      event => {
        if (
          event.target === viewer
        ) {
          closeCommunityChatPhoto();
        }
      }
    );
  }

  const image =
    document.getElementById(
      'chatPhotoViewerImage'
    );

  if (image) {
    image.src =
      url;
  }

  viewer.style.display =
    'flex';
}


function closeCommunityChatPhoto() {
  const viewer =
    document.getElementById(
      'chatPhotoViewer'
    );

  if (!viewer) {
    return;
  }

  viewer.style.display =
    'none';

  const image =
    document.getElementById(
      'chatPhotoViewerImage'
    );

  if (image) {
    image.removeAttribute(
      'src'
    );
  }
}


// ============================================================
// PHOTO PREVIEW BEFORE SEND
// ============================================================

function showPendingCommunityChatPhoto(
  file
) {
  if (!file) {
    return;
  }

  pendingCommunityChatPhoto =
    file;

  if (
    pendingCommunityChatPreviewUrl
  ) {
    URL.revokeObjectURL(
      pendingCommunityChatPreviewUrl
    );
  }

  pendingCommunityChatPreviewUrl =
    URL.createObjectURL(
      file
    );

  let preview =
    document.getElementById(
      'chatPendingPhoto'
    );

  if (!preview) {
    preview =
      document.createElement(
        'div'
      );

    preview.id =
      'chatPendingPhoto';

    preview.style.cssText =
      'position:relative;' +
      'max-width:120px;' +
      'margin:0 0 6px 0;';

    const image =
      document.createElement(
        'img'
      );

    image.id =
      'chatPendingPhotoImage';

    image.style.cssText =
      'display:block;' +
      'max-width:120px;' +
      'max-height:100px;' +
      'border-radius:10px;';

    const removeButton =
      document.createElement(
        'button'
      );

    removeButton.type =
      'button';

    removeButton.id =
      'chatPendingPhotoRemove';

    removeButton.textContent =
      '×';

    removeButton.style.cssText =
      'position:absolute;' +
      'right:-7px;' +
      'top:-7px;' +
      'width:25px;' +
      'height:25px;' +
      'border:0;' +
      'border-radius:50%;' +
      'background:#ff7417;' +
      'color:white;' +
      'font-size:18px;' +
      'line-height:23px;' +
      'padding:0;';

    removeButton.addEventListener(
      'click',
      clearPendingCommunityChatPhoto
    );

    preview.appendChild(
      image
    );

    preview.appendChild(
      removeButton
    );

    const compose =
      document.querySelector(
        '#chatPage .chat-compose'
      );

    const input =
      document.getElementById(
        'chatMessageInput'
      );

    if (
      compose &&
      input
    ) {
      compose.insertBefore(
        preview,
        input
      );
    }
  }

  const previewImage =
    document.getElementById(
      'chatPendingPhotoImage'
    );

  if (previewImage) {
    previewImage.src =
      pendingCommunityChatPreviewUrl;
  }

  preview.style.display =
    'block';
}


function clearPendingCommunityChatPhoto() {
  pendingCommunityChatPhoto =
    null;

  if (
    pendingCommunityChatPreviewUrl
  ) {
    URL.revokeObjectURL(
      pendingCommunityChatPreviewUrl
    );

    pendingCommunityChatPreviewUrl =
      null;
  }

  const preview =
    document.getElementById(
      'chatPendingPhoto'
    );

  if (preview) {
    preview.style.display =
      'none';
  }

  const photoInput =
    document.getElementById(
      'chatPhotoInput'
    );

  if (photoInput) {
    photoInput.value =
      '';
  }
}


// ============================================================
// PHOTO INPUT
// One listener only
// ============================================================

function initialiseCommunityChatPhotoInput() {
  const photoInput =
    document.getElementById(
      'chatPhotoInput'
    );

  const photoButton =
    document.querySelector(
      '#chatPage .chat-photo-btn'
    );

  if (
    photoInput &&
    photoInput.dataset.chatReady !==
      'true'
  ) {
    photoInput.dataset.chatReady =
      'true';

    photoInput.addEventListener(
      'change',
      event => {
        const file =
          event.target.files?.[0];

        if (file) {
          showPendingCommunityChatPhoto(
            file
          );
        }
      }
    );
  }

  if (
    photoButton &&
    photoButton.dataset.chatReady !==
      'true'
  ) {
    photoButton.dataset.chatReady =
      'true';

    photoButton.addEventListener(
      'click',
      event => {
        event.preventDefault();

        if (photoInput) {
          photoInput.click();
        }
      }
    );
  }
}


// ============================================================
// DELETE OWN MESSAGE / PHOTO
// ============================================================

async function deleteOwnCommunityChatMessage(
  message
) {
  if (
    !currentUser ||
    !message ||
    message.user_id !==
      currentUser.id
  ) {
    return;
  }

  const question =
    message.media_type ===
      'image'
      ? T(
          'Naozaj chcete vymazať túto fotografiu?',
          'Do you really want to delete this photo?'
        )
      : T(
          'Naozaj chcete vymazať túto správu?',
          'Do you really want to delete this message?'
        );

  if (
    !confirm(question)
  ) {
    return;
  }

  if (
    message.media_type ===
      'image' &&
    message.media_url
  ) {
    const {
      error: storageError
    } =
      await supabaseClient
        .storage
        .from(
          'chat-media'
        )
        .remove([
          message.media_url
        ]);

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

  const {
    error
  } =
    await supabaseClient
      .from(
        'chat_messages'
      )
      .delete()
      .eq(
        'id',
        message.id
      )
      .eq(
        'user_id',
        currentUser.id
      );

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
    document.getElementById(
      'chat-message-' +
      message.id
    );

  if (item) {
    item.remove();
  }
}


// ============================================================
// 30-DAY RETENTION INFORMATION
// ============================================================

function addCommunityChatRetentionInfo() {
  const compose =
    document.querySelector(
      '#chatPage .chat-compose'
    );

  if (
    !compose ||
    document.getElementById(
      'chatRetentionInfo'
    )
  ) {
    return;
  }

  const info =
    document.createElement(
      'button'
    );

  info.id =
    'chatRetentionInfo';

  info.type =
    'button';

  info.className =
    'chat-retention-info';

  info.textContent =
    'ⓘ';

  info.title =
    T(
      'Informácie',
      'Information'
    );

  info.addEventListener(
    'click',
    () => {
      alert(
        T(
          'Správy a fotografie v chate sa automaticky vymažú po 30 dňoch.',
          'Chat messages and photos are automatically deleted after 30 days.'
        )
      );
    }
  );

  compose.appendChild(
    info
  );
}


// ============================================================
// MARK CHAT SEEN
// ============================================================

async function markCommunityChatSeen() {
  if (!currentUser) {
    return;
  }

  await supabaseClient
    .from(
      'chat_user_settings'
    )
    .update({
      last_seen_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString()
    })
    .eq(
      'user_id',
      currentUser.id
    );
}


// ============================================================
// UNREAD DOT
// ============================================================

async function refreshCommunityChatUnreadDot() {
  const dot =
    document.getElementById(
      'communityChatUnreadDot'
    );

  if (!dot) {
    return;
  }

  if (!currentUser) {
    dot.style.display =
      'none';

    return;
  }

  const {
    data: settings,
    error: settingsError
  } =
    await supabaseClient
      .from(
        'chat_user_settings'
      )
      .select(
        'last_seen_at'
      )
      .eq(
        'user_id',
        currentUser.id
      )
      .maybeSingle();

  if (settingsError) {
    return;
  }

  const lastSeen =
    settings?.last_seen_at ||
    '1970-01-01T00:00:00.000Z';

  const {
    count,
    error
  } =
    await supabaseClient
      .from(
        'chat_messages'
      )
      .select(
        'id',
        {
          count:
            'exact',

          head:
            true
        }
      )
      .neq(
        'user_id',
        currentUser.id
      )
      .gt(
        'created_at',
        lastSeen
      );

  if (error) {
    return;
  }

  dot.style.display =
    count > 0
      ? 'block'
      : 'none';
}


// ============================================================
// STORE READ RECEIPTS
// ============================================================

async function markAllCommunityChatMessagesRead() {
  if (
    !currentUser ||
    !communityChatOpen
  ) {
    return;
  }

  const since =
    new Date(
      Date.now() -
      30 *
      24 *
      60 *
      60 *
      1000
    ).toISOString();

  const {
    data: messages,
    error
  } =
    await supabaseClient
      .from(
        'chat_messages'
      )
      .select(
        'id,user_id'
      )
      .neq(
        'user_id',
        currentUser.id
      )
      .gte(
        'created_at',
        since
      );

  if (
    error ||
    !messages?.length
  ) {
    return;
  }

  const readAt =
    new Date().toISOString();

  const rows =
    messages.map(
      message => ({
        message_id:
          message.id,

        user_id:
          currentUser.id,

        user_name:
          getUsername(
            currentUser
          ) || 'User',

        read_at:
          readAt
      })
    );

  await supabaseClient
    .from(
      'chat_message_reads'
    )
    .upsert(
      rows,
      {
        onConflict:
          'message_id,user_id'
      }
    );
}
// ============================================================
// DISPLAY READ RECEIPTS
// ============================================================

async function refreshCommunityChatReadReceipts() {
  if (
    !currentUser ||
    !communityChatOpen
  ) {
    return;
  }

  const ownItems = [
    ...document.querySelectorAll(
      '#chatMessages .chat-message.mine'
    )
  ];

  if (!ownItems.length) {
    return;
  }

  const messageIds =
    ownItems
      .map(
        item =>
          Number(
            item.id.replace(
              'chat-message-',
              ''
            )
          )
      )
      .filter(Boolean);

  if (!messageIds.length) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        'chat_message_reads'
      )
      .select(
        'message_id,user_name'
      )
      .in(
        'message_id',
        messageIds
      );

  if (error) {
    return;
  }

  const reads = {};

  for (
    const row
    of data || []
  ) {
    if (
      !reads[row.message_id]
    ) {
      reads[row.message_id] =
        [];
    }

    if (
      row.user_name &&
      !reads[
        row.message_id
      ].includes(
        row.user_name
      )
    ) {
      reads[
        row.message_id
      ].push(
        row.user_name
      );
    }
  }

  for (
    const item
    of ownItems
  ) {
    const messageId =
      Number(
        item.id.replace(
          'chat-message-',
          ''
        )
      );

    const names =
      reads[messageId] ||
      [];

    let receipt =
      item.querySelector(
        '.chat-read-receipt'
      );

    if (!receipt) {
      receipt =
        document.createElement(
          'div'
        );

      receipt.className =
        'chat-read-receipt';

      item.appendChild(
        receipt
      );
    }

    if (!names.length) {
      receipt.textContent =
        '';

      receipt.style.display =
        'none';

      receipt.onclick =
        null;

      continue;
    }

    receipt.style.display =
      'block';

    receipt.style.cursor =
      'pointer';

    receipt.textContent =
      '👁️ ' +
      T(
        'Videné: ',
        'Seen: '
      ) +
      names.length;

    receipt.onclick =
      event => {
        event.stopPropagation();

        alert(
          T(
            'Videli:\n',
            'Seen by:\n'
          ) +
          names.join('\n')
        );
      };
  }
}


// ============================================================
// REALTIME PUBLIC CHAT
// ============================================================

function subscribeCommunityChat() {
  if (
    communityChatChannel
  ) {
    return;
  }

  communityChatChannel =
    supabaseClient
      .channel(
        'community-chat-live'
      )
      .on(
        'postgres_changes',
        {
          event:
            'INSERT',

          schema:
            'public',

          table:
            'chat_messages'
        },

        async payload => {
          const message =
            payload.new;

          renderCommunityChatMessage(
            message
          );

          if (
            communityChatOpen
          ) {
            scrollCommunityChatToBottom();

            if (
              currentUser &&
              message.user_id !==
                currentUser.id
            ) {
              await markAllCommunityChatMessagesRead();
            }

            await markCommunityChatSeen();

            const dot =
              document.getElementById(
                'communityChatUnreadDot'
              );

            if (dot) {
              dot.style.display =
                'none';
            }

            await refreshCommunityChatReadReceipts();

          } else if (
            currentUser &&
            message.user_id !==
              currentUser.id
          ) {
            const dot =
              document.getElementById(
                'communityChatUnreadDot'
              );

            if (dot) {
              dot.style.display =
                'block';
            }

            if (
              chatNotificationsEnabled
            ) {
              playCommunityChatSound();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event:
            'DELETE',

          schema:
            'public',

          table:
            'chat_messages'
        },

        payload => {
          const id =
            payload.old?.id;

          if (!id) {
            return;
          }

          const item =
            document.getElementById(
              'chat-message-' +
              id
            );

          if (item) {
            item.remove();
          }
        }
      )
      .subscribe();
}


// ============================================================
// REALTIME READ RECEIPTS
// ============================================================

function subscribeCommunityChatReads() {
  if (
    communityChatReadsChannel
  ) {
    return;
  }

  communityChatReadsChannel =
    supabaseClient
      .channel(
        'community-chat-reads-live'
      )
      .on(
        'postgres_changes',
        {
          event:
            '*',

          schema:
            'public',

          table:
            'chat_message_reads'
        },

        () => {
          if (
            communityChatOpen
          ) {
            refreshCommunityChatReadReceipts();
          }
        }
      )
      .subscribe();
}


// ============================================================
// CHAT SOUND
// ============================================================

function playCommunityChatSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (
      !AudioContextClass
    ) {
      return;
    }

    const context =
      new AudioContextClass();

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.connect(
      gain
    );

    gain.connect(
      context.destination
    );

    oscillator.frequency.value =
      880;

    gain.gain.setValueAtTime(
      0.08,
      context.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime +
        0.35
    );

    oscillator.start();

    oscillator.stop(
      context.currentTime +
        0.35
    );

    oscillator.addEventListener(
      'ended',
      () => {
        context.close().catch(
          () => {}
        );
      }
    );

  } catch (error) {
    // Sound is optional.
  }
}


// ============================================================
// START CHAT SERVICES FOR LOGGED USER
// ============================================================

async function startCommunityChatForLoggedUser() {
  if (!currentUser) {
    return;
  }

  await ensureChatSettings();

  subscribeCommunityChat();
  subscribeCommunityChatReads();

  await refreshCommunityChatUnreadDot();

  if (
    communityChatOpen
  ) {
    await markAllCommunityChatMessagesRead();
    await markCommunityChatSeen();
    await refreshCommunityChatReadReceipts();
  }
}


// ============================================================
// REFRESH WHEN APP RETURNS TO FOREGROUND
// ============================================================

window.addEventListener(
  'focus',
  () => {
    if (currentUser) {
      startCommunityChatForLoggedUser();
    }
  }
);


document.addEventListener(
  'visibilitychange',
  () => {
    if (
      !document.hidden &&
      currentUser
    ) {
      startCommunityChatForLoggedUser();
    }
  }
);


// ============================================================
// ENTER KEY
// ============================================================

function initialiseCommunityChatKeyboard() {
  const input =
    document.getElementById(
      'chatMessageInput'
    );

  if (
    !input ||
    input.dataset.chatKeyboardReady ===
      'true'
  ) {
    return;
  }

  input.dataset.chatKeyboardReady =
    'true';

  input.addEventListener(
    'keydown',
    event => {
      if (
        event.key ===
          'Enter' &&
        !event.shiftKey
      ) {
        event.preventDefault();

        sendCommunityChatMessage();
      }
    }
  );
}


// ============================================================
// CHAT RETENTION INFO LANGUAGE
// ============================================================

function updateCommunityChatRetentionLanguage() {
  const info =
    document.getElementById(
      'chatRetentionInfo'
    );

  if (!info) {
    return;
  }

  info.title =
    T(
      'Informácie',
      'Information'
    );
}


// ============================================================
// INITIALISE CHAT UI
// ============================================================

function initialiseCommunityChat() {
  initialiseCommunityChatPhotoInput();
  initialiseCommunityChatKeyboard();

  addCommunityChatRetentionInfo();
  updateCommunityChatRetentionLanguage();

  setChatLanguage();
}


// ============================================================
// INITIAL START
// ============================================================

function startCommunityChatWhenReady() {
  initialiseCommunityChat();

  if (currentUser) {
    startCommunityChatForLoggedUser();
  }
}


if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    startCommunityChatWhenReady,
    {
      once: true
    }
  );

} else {
  startCommunityChatWhenReady();
}

// ============================================================
// END COMMUNITY FOR ALL – CHAT.JS
// ============================================================
