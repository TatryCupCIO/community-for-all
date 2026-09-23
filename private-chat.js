// ============================================================
// COMMUNITY FOR ALL
// PRIVATE-CHAT.JS – CLEAN VERSION
// Private conversations, members, photos and realtime
// ============================================================


// ============================================================
// STATE
// ============================================================

let privateChatOpen = false;
let privateChatConversationId = null;
let privateChatSelectedUser = null;

let privateChatMessagesChannel = null;
let privateChatEventsChannel = null;
let privateInboxChannel = null;
let pendingPrivateChatPhoto = null;
let pendingPrivateChatPreviewUrl = null;

let privateMemberCandidates = [];


// ============================================================
// CREATE PRIVATE CHAT PAGE
// ============================================================

function createPrivateChatPage() {
  if (
    document.getElementById(
      'privateChatPage'
    )
  ) {
    return;
  }

  const page =
    document.createElement(
      'div'
    );

  page.id =
    'privateChatPage';

  page.className =
    'page';

  page.style.display =
    'none';

  page.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      gap:12px;
      margin-bottom:14px;
    ">
      <button
        type="button"
        id="privateChatBackBtn"
        style="
          border:0;
          background:transparent;
          color:#ff7417;
          font-size:28px;
          cursor:pointer;
          padding:4px;
        "
      >←</button>

      <div
        id="privateChatAvatar"
        style="
          width:46px;
          height:46px;
          min-width:46px;
          border-radius:50%;
          overflow:hidden;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#334155;
          font-size:24px;
        "
      >👤</div>

      <div
        style="
          min-width:0;
          flex:1;
        "
      >
        <div
          id="privateChatTitle"
          style="
            font-weight:800;
            font-size:17px;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
          "
        ></div>

        <div
          id="privateChatStatus"
          style="
            font-size:12px;
            margin-top:2px;
          "
        ></div>
      </div>

      <button
        type="button"
        id="privateChatMembersBtn"
        style="
          border:0;
          background:transparent;
          font-size:25px;
          cursor:pointer;
          padding:5px;
        "
      >👥</button>
    </div>

    <div
      id="privateChatMessages"
      style="
        min-height:300px;
        max-height:58vh;
        overflow-y:auto;
        padding:8px 2px 14px;
      "
    ></div>

    <div
      id="privateChatPendingPhoto"
      style="
        display:none;
        position:relative;
        width:max-content;
        max-width:120px;
        margin:4px 0 8px;
      "
    >
      <img
        id="privateChatPendingPhotoImage"
        alt=""
        style="
          display:block;
          max-width:120px;
          max-height:100px;
          border-radius:10px;
        "
      >

      <button
        type="button"
        id="privateChatPendingPhotoRemove"
        style="
          position:absolute;
          right:-7px;
          top:-7px;
          width:25px;
          height:25px;
          border:0;
          border-radius:50%;
          background:#ff7417;
          color:white;
          font-size:18px;
          line-height:23px;
          padding:0;
          cursor:pointer;
        "
      >×</button>
    </div>

    <div
      style="
        display:flex;
        align-items:center;
        gap:8px;
      "
    >
      <input
        id="privateChatPhotoInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
      >

      <button
        type="button"
        id="privateChatPhotoBtn"
        style="
          border:0;
          background:transparent;
          font-size:25px;
          cursor:pointer;
          padding:5px;
        "
      >📷</button>

      <input
        id="privateChatMessageInput"
        type="text"
        autocomplete="off"
        style="
          flex:1;
          min-width:0;
          padding:12px;
          border-radius:12px;
        "
      >

      <button
        type="button"
        id="privateChatSendBtn"
        style="
          border:0;
          border-radius:50%;
          width:43px;
          height:43px;
          background:#ff7417;
          color:white;
          font-size:22px;
          cursor:pointer;
        "
      >➤</button>
    </div>
  `;

  document.body.appendChild(
    page
  );

  const backButton =
    document.getElementById(
      'privateChatBackBtn'
    );

  const sendButton =
    document.getElementById(
      'privateChatSendBtn'
    );

  const messageInput =
    document.getElementById(
      'privateChatMessageInput'
    );

  const photoButton =
    document.getElementById(
      'privateChatPhotoBtn'
    );

  const photoInput =
    document.getElementById(
      'privateChatPhotoInput'
    );

  const photoRemove =
    document.getElementById(
      'privateChatPendingPhotoRemove'
    );

  const membersButton =
    document.getElementById(
      'privateChatMembersBtn'
    );


  if (backButton) {
    backButton.addEventListener(
      'click',
      closePrivateChat
    );
  }


  if (sendButton) {
    sendButton.addEventListener(
      'click',
      sendPrivateChatContent
    );
  }


  if (messageInput) {
    messageInput.addEventListener(
      'keydown',
      event => {
        if (
          event.key === 'Enter' &&
          !event.shiftKey
        ) {
          event.preventDefault();

          sendPrivateChatContent();
        }
      }
    );
  }


  if (
    photoButton &&
    photoInput
  ) {
    photoButton.addEventListener(
      'click',
      () => {
        photoInput.click();
      }
    );
  }


  if (photoInput) {
    photoInput.addEventListener(
      'change',
      event => {
        const file =
          event.target.files?.[0];

        if (file) {
          showPrivateChatPendingPhoto(
            file
          );
        }
      }
    );
  }


  if (photoRemove) {
    photoRemove.addEventListener(
      'click',
      clearPrivateChatPendingPhoto
    );
  }


  if (membersButton) {
    membersButton.addEventListener(
      'click',
      openPrivateChatMembers
    );

    initialisePrivateMembersLongPress(
      membersButton
    );
  }

  setPrivateChatLanguage();
}


// ============================================================
// OPEN PRIVATE CHAT
// ============================================================

async function openPrivateChatWithUser(
  user
) {
  if (
    !currentUser ||
    !user?.user_id
  ) {
    return;
  }

  createPrivateChatPage();

  const {
    data,
    error
  } =
    await supabaseClient.rpc(
      'create_private_conversation',
      {
        p_other_user_id:
          user.user_id
      }
    );

  if (
    error ||
    !data
  ) {
    alert(
      T(
        'Súkromný chat sa nepodarilo otvoriť.',
        'The private chat could not be opened.'
      )
    );

    return;
  }

  privateChatConversationId =
    Number(data);

  privateChatSelectedUser =
    user;

  privateChatOpen =
  true;

await supabaseClient
  .from('user_profiles')
  .update({
    presence_status: 'online',
    last_active_at: new Date().toISOString()
  })
  .eq('user_id', currentUser.id);

  if (
    typeof hidePages ===
    'function'
  ) {
    hidePages();
  }

  const usersPage =
    document.getElementById(
      'privateUsersPage'
    );

  if (usersPage) {
    usersPage.style.display =
      'none';
  }

  const page =
    document.getElementById(
      'privateChatPage'
    );

  if (page) {
    page.style.display =
      'block';
  }

  setPrivateChatHeader(
    user
  );

  setPrivateChatLanguage();

  await loadPrivateChatMessages();

  await markPrivateChatRead();

  subscribePrivateChat();
  subscribePrivateConversationEvents();

  window.scrollTo(
    0,
    0
  );
}


window.openPrivateChatWithUser =
  openPrivateChatWithUser;


// ============================================================
// HEADER
// ============================================================

function setPrivateChatHeader(
  user
) {
  const title =
    document.getElementById(
      'privateChatTitle'
    );

  const avatar =
    document.getElementById(
      'privateChatAvatar'
    );

  if (title) {
    title.textContent =
      user?.display_name ||
      T(
        'Používateľ',
        'User'
      );
  }

  if (avatar) {
    avatar.innerHTML =
      '';

    if (user?.avatar_url) {
      const image =
        document.createElement(
          'img'
        );

      image.src =
        user.avatar_url;

      image.alt =
        '';

      image.style.cssText =
        'width:100%;' +
        'height:100%;' +
        'object-fit:cover;';

      avatar.appendChild(
        image
      );

    } else {
      avatar.textContent =
        '👤';
    }
  }

  updatePrivateChatStatus();
}


// ============================================================
// PRIVATE CHAT – USER STATUS
// ============================================================

function updatePrivateChatStatus() {
  const status =
    document.getElementById(
      'privateChatStatus'
    );

  if (
    !status ||
    !privateChatSelectedUser
  ) {
    return;
  }

  const presence =
    privateChatSelectedUser.presence_status ||
    'offline';

  if (presence === 'online') {
    status.textContent = 'Online';
    status.style.color = '#22c55e';
    return;
  }

  if (presence === 'logged_in') {
    status.textContent =
      currentLanguage === 'en'
        ? 'Logged in'
        : 'Prihlásený';

    status.style.color = '#f59e0b';
    return;
  }

  status.textContent = 'Offline';
  status.style.color = '#ef4444';
}

let privateChatPresenceChannel = null;

function startPrivateChatPresenceRealtime() {

  if (privateChatPresenceChannel) {
    supabaseClient.removeChannel(
      privateChatPresenceChannel
    );
  }

  privateChatPresenceChannel =
    supabaseClient
      .channel('private-chat-presence')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_profiles'
        },
        payload => {

          if (
            !privateChatSelectedUser ||
            payload.new.user_id !==
              privateChatSelectedUser.user_id
          ) {
            return;
          }

          privateChatSelectedUser.presence_status =
            payload.new.presence_status;

          privateChatSelectedUser.last_active_at =
            payload.new.last_active_at;

          updatePrivateChatStatus();
        }
      )
      .subscribe();
}

startPrivateChatPresenceRealtime();
// ============================================================
// LOAD MESSAGES
// ============================================================

async function loadPrivateChatMessages() {
  const box =
    document.getElementById(
      'privateChatMessages'
    );

  if (
    !box ||
    !privateChatConversationId
  ) {
    return;
  }

  box.innerHTML =
    '<div class="loading">' +
    T(
      'Načítavam správy...',
      'Loading messages...'
    ) +
    '</div>';

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        'private_messages'
      )
      .select('*')
      .eq(
        'conversation_id',
        privateChatConversationId
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      );

  box.innerHTML =
    '';

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
    await renderPrivateChatMessage(
      message
    );
  }

  await loadPrivateConversationEvents();

  scrollPrivateChatToBottom();
}


// ============================================================
// RENDER MESSAGE
// ============================================================

async function renderPrivateChatMessage(
  message
) {
  const box =
    document.getElementById(
      'privateChatMessages'
    );

  if (
    !box ||
    !message?.id
  ) {
    return;
  }

  if (
    document.getElementById(
      'private-message-' +
      message.id
    )
  ) {
    return;
  }

  const mine =
    message.sender_id ===
    currentUser?.id;

  const item =
    document.createElement(
      'div'
    );

  item.id =
    'private-message-' +
    message.id;

  item.dataset.createdAt =
    message.created_at || '';

  item.dataset.mine =
    mine
      ? 'true'
      : 'false';

  item.style.cssText = `
    position:relative;
    max-width:82%;
    margin:8px 0;
    padding:10px 12px;
    border-radius:14px;
    background:${mine ? '#ff7417' : '#172033'};
    color:white;
    margin-left:${mine ? 'auto' : '0'};
    margin-right:${mine ? '0' : 'auto'};
    overflow-wrap:anywhere;
  `;


  if (message.message_text) {
    const text =
      document.createElement(
        'div'
      );

    text.className =
      'private-message-text';

    text.textContent =
      message.message_text;

    item.appendChild(
      text
    );
  }


  if (message.image_url) {
    const holder =
      document.createElement(
        'div'
      );

    holder.className =
      'private-photo-holder';

    holder.style.marginTop =
      message.message_text
        ? '8px'
        : '0';

    item.appendChild(
      holder
    );

    await loadPrivateChatPhoto(
      message.image_url,
      holder
    );
  }


  const meta =
    document.createElement(
      'div'
    );

  meta.className =
    'private-message-time';

  meta.style.cssText = `
    margin-top:5px;
    font-size:10px;
    opacity:.8;
    text-align:right;
  `;

  meta.textContent =
    formatCommunityChatDate(
      message.created_at
    );

  item.appendChild(
    meta
  );


  if (mine) {
    const receipt =
      document.createElement(
        'div'
      );

    receipt.className =
      'private-read-receipt';

    receipt.style.cssText = `
      margin-top:2px;
      font-size:10px;
      text-align:right;
      opacity:.9;
    `;

    receipt.textContent =
      message.read_at
        ? T(
            'Prečítané',
            'Read'
          )
        : T(
            'Odoslané',
            'Sent'
          );

    item.appendChild(
      receipt
    );


    const deleteButton =
      document.createElement(
        'button'
      );

    deleteButton.type =
      'button';

    deleteButton.className =
      'private-delete-btn';

    deleteButton.textContent =
      '🗑️';

    deleteButton.style.cssText = `
      border:0;
      background:transparent;
      cursor:pointer;
      font-size:15px;
      padding:3px;
      margin-top:3px;
    `;

    deleteButton.title =
      T(
        'Vymazať',
        'Delete'
      );

    deleteButton.addEventListener(
      'click',
      event => {
        event.stopPropagation();

        deleteOwnPrivateChatMessage(
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
// SEND TEXT
// Conversation based – one final implementation
// ============================================================

async function sendPrivateChatText(
  text
) {
  if (
    !currentUser ||
    !privateChatConversationId ||
    !text
  ) {
    return false;
  }

  const {
    error
  } =
    await supabaseClient
      .from(
        'private_messages'
      )
      .insert({
        conversation_id:
          privateChatConversationId,

        sender_id:
          currentUser.id,

        receiver_id:
          null,

        message_text:
          text,

        image_url:
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
// PHOTO PREVIEW
// ============================================================

function showPrivateChatPendingPhoto(
  file
) {
  if (
    !file?.type?.startsWith(
      'image/'
    )
  ) {
    alert(
      T(
        'Môžete odosielať iba fotografie.',
        'You can only send photos.'
      )
    );

    return;
  }

  pendingPrivateChatPhoto =
    file;

  if (
    pendingPrivateChatPreviewUrl
  ) {
    URL.revokeObjectURL(
      pendingPrivateChatPreviewUrl
    );
  }

  pendingPrivateChatPreviewUrl =
    URL.createObjectURL(
      file
    );

  const preview =
    document.getElementById(
      'privateChatPendingPhoto'
    );

  const image =
    document.getElementById(
      'privateChatPendingPhotoImage'
    );

  if (image) {
    image.src =
      pendingPrivateChatPreviewUrl;
  }

  if (preview) {
    preview.style.display =
      'block';
  }
}


function clearPrivateChatPendingPhoto() {
  pendingPrivateChatPhoto =
    null;

  if (
    pendingPrivateChatPreviewUrl
  ) {
    URL.revokeObjectURL(
      pendingPrivateChatPreviewUrl
    );

    pendingPrivateChatPreviewUrl =
      null;
  }

  const preview =
    document.getElementById(
      'privateChatPendingPhoto'
    );

  if (preview) {
    preview.style.display =
      'none';
  }

  const image =
    document.getElementById(
      'privateChatPendingPhotoImage'
    );

  if (image) {
    image.removeAttribute(
      'src'
    );
  }

  const input =
    document.getElementById(
      'privateChatPhotoInput'
    );

  if (input) {
    input.value =
      '';
  }
}


// ============================================================
// COMPRESS PHOTO
// ============================================================

async function compressPrivateChatPhoto(
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
      quality -=
        0.05;

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

async function sendPrivateChatPhoto(
  file
) {
  if (
    !currentUser ||
    !privateChatConversationId ||
    !file
  ) {
    return false;
  }

  let photo;

  try {
    photo =
      await compressPrivateChatPhoto(
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
    privateChatConversationId +
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
    await supabaseClient.storage
      .from(
        'private-chat-media'
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
        'private_messages'
      )
      .insert({
        conversation_id:
          privateChatConversationId,

        sender_id:
          currentUser.id,

        receiver_id:
          null,

        message_text:
          null,

        image_url:
          path
      });

  if (messageError) {
    await supabaseClient.storage
      .from(
        'private-chat-media'
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
// LOAD PRIVATE PHOTO
// ============================================================

async function loadPrivateChatPhoto(
  path,
  container
) {
  if (
    !path ||
    !container
  ) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient.storage
      .from(
        'private-chat-media'
      )
      .createSignedUrl(
        path,
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
      'Fotografia v súkromnom chate',
      'Private chat photo'
    );

  image.loading =
    'lazy';

  image.style.cssText = `
    display:block;
    max-width:100%;
    max-height:360px;
    border-radius:10px;
    cursor:pointer;
  `;

  image.addEventListener(
    'click',
    () => {
      if (
        typeof openCommunityChatPhoto ===
        'function'
      ) {
        openCommunityChatPhoto(
          data.signedUrl
        );
      }
    }
  );

  container.appendChild(
    image
  );
}


// ============================================================
// SEND TEXT + PHOTO
// ============================================================

async function sendPrivateChatContent() {
  const input =
    document.getElementById(
      'privateChatMessageInput'
    );

  const button =
    document.getElementById(
      'privateChatSendBtn'
    );

  const text =
    input?.value.trim() ||
    '';

  const photo =
    pendingPrivateChatPhoto;

  if (
    !text &&
    !photo
  ) {
    return;
  }

  if (button) {
    button.disabled =
      true;
  }

  try {
    if (text) {
      const sent =
        await sendPrivateChatText(
          text
        );

      if (
        sent &&
        input
      ) {
        input.value =
          '';
      }
    }

    if (photo) {
      const sent =
        await sendPrivateChatPhoto(
          photo
        );

      if (sent) {
        clearPrivateChatPendingPhoto();
      }
    }

  } finally {
    if (button) {
      button.disabled =
        false;
    }
  }
}


// ============================================================
// MARK MESSAGES AS READ
// ============================================================

async function markPrivateChatRead() {
  if (
    !currentUser ||
    !privateChatConversationId
  ) {
    return;
  }

  await supabaseClient
    .from(
      'private_messages'
    )
    .update({
      read_at:
        new Date().toISOString()
    })
    .eq(
      'conversation_id',
      privateChatConversationId
    )
    .neq(
      'sender_id',
      currentUser.id
    )
    .is(
      'read_at',
      null
    );
}


// ============================================================
// DELETE OWN MESSAGE / PHOTO
// ============================================================

async function deleteOwnPrivateChatMessage(
  message
) {
  if (
    !currentUser ||
    message?.sender_id !==
      currentUser.id
  ) {
    return;
  }

  const question =
    message.image_url
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

  if (message.image_url) {
    const {
      error: storageError
    } =
      await supabaseClient.storage
        .from(
          'private-chat-media'
        )
        .remove([
          message.image_url
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
        'private_messages'
      )
      .delete()
      .eq(
        'id',
        message.id
      )
      .eq(
        'sender_id',
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

  document
    .getElementById(
      'private-message-' +
      message.id
    )
    ?.remove();
}


// ============================================================
// UPDATE READ RECEIPT
// ============================================================

function updatePrivateChatReadReceipt(
  message
) {
  if (
    message?.sender_id !==
      currentUser?.id
  ) {
    return;
  }

  const item =
    document.getElementById(
      'private-message-' +
      message.id
    );

  const receipt =
    item?.querySelector(
      '.private-read-receipt'
    );

  if (!receipt) {
    return;
  }

  receipt.textContent =
    message.read_at
      ? T(
          'Prečítané',
          'Read'
        )
      : T(
          'Odoslané',
          'Sent'
        );
}


// ============================================================
// REALTIME PRIVATE MESSAGES
// ============================================================

function subscribePrivateChat() {
  if (
    !privateChatConversationId
  ) {
    return;
  }

  if (
    privateChatMessagesChannel
  ) {
    supabaseClient.removeChannel(
      privateChatMessagesChannel
    );

    privateChatMessagesChannel =
      null;
  }

  const conversationId =
    privateChatConversationId;

  privateChatMessagesChannel =
    supabaseClient
      .channel(
        'private-chat-' +
        conversationId
      )
      .on(
        'postgres_changes',
        {
          event:
            '*',

          schema:
            'public',

          table:
            'private_messages',

          filter:
            'conversation_id=eq.' +
            conversationId
        },

        async payload => {
          if (
            conversationId !==
            privateChatConversationId
          ) {
            return;
          }

          if (
            payload.eventType ===
            'INSERT'
          ) {
            await renderPrivateChatMessage(
              payload.new
            );

            scrollPrivateChatToBottom();

            if (
              payload.new.sender_id !==
              currentUser?.id
            ) {
              await markPrivateChatRead();

              if (
                chatNotificationsEnabled &&
                typeof playCommunityChatSound ===
                  'function'
              ) {
                playCommunityChatSound();
              }
            }
          }

          if (
            payload.eventType ===
            'UPDATE'
          ) {
            updatePrivateChatReadReceipt(
              payload.new
            );
          }

          if (
            payload.eventType ===
            'DELETE'
          ) {
            const messageId =
              payload.old?.id;

            if (messageId) {
              document
                .getElementById(
                  'private-message-' +
                  messageId
                )
                ?.remove();
            }
          }
        }
      )
      .subscribe();
}


// ============================================================
// SYSTEM EVENTS
// ============================================================

async function loadPrivateConversationEvents() {
  if (
    !privateChatConversationId
  ) {
    return;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        'private_conversation_events'
      )
      .select('*')
      .eq(
        'conversation_id',
        privateChatConversationId
      )
      .order(
        'created_at',
        {
          ascending: true
        }
      );

  if (error) {
    return;
  }

  for (
    const event
    of data || []
  ) {
    await renderPrivateConversationEvent(
      event
    );
  }
}


// ============================================================
// RENDER SYSTEM EVENT
// ============================================================

async function renderPrivateConversationEvent(
  event
) {
  if (
    !event?.id ||
    event.event_type !==
      'members_removed'
  ) {
    return;
  }

  if (
    document.getElementById(
      'private-event-' +
      event.id
    )
  ) {
    return;
  }

  const ids =
    Array.isArray(
      event.affected_user_ids
    )
      ? event.affected_user_ids
      : [];

  let names =
    [];

  if (ids.length) {
    const {
      data
    } =
      await supabaseClient
        .from(
          'user_profiles'
        )
        .select(
          'user_id,display_name'
        )
        .in(
          'user_id',
          ids
        );

    names =
      (data || []).map(
        user =>
          user.display_name ||
          T(
            'Používateľ',
            'User'
          )
      );
  }

  const box =
    document.getElementById(
      'privateChatMessages'
    );

  if (!box) {
    return;
  }

  const item =
    document.createElement(
      'div'
    );

  item.id =
    'private-event-' +
    event.id;

  item.style.cssText = `
    margin:14px auto;
    padding:10px 12px;
    max-width:92%;
    text-align:center;
    border-radius:12px;
    background:#334155;
    color:white;
    font-size:13px;
    white-space:pre-line;
  `;

  const removedText =
    names.length === 1
      ? T(
          'Z chatu bol odstránený: ',
          'Removed from the chat: '
        )
      : T(
          'Z chatu boli odstránení: ',
          'Removed from the chat: '
        );

  item.textContent =
    T(
      '😄 Tak, dohodnuté! Ďakujeme za pokec, pááá 👋 Vidíme sa!',
      '😄 All agreed! Thanks for the chat, byeee 👋 See you!'
    ) +
    (
      names.length
        ? '\n' +
          removedText +
          names.join(', ')
        : ''
    );

  box.appendChild(
    item
  );
}


// ============================================================
// REALTIME SYSTEM EVENTS
// ============================================================

function subscribePrivateConversationEvents() {
  if (
    !privateChatConversationId
  ) {
    return;
  }

  if (
    privateChatEventsChannel
  ) {
    supabaseClient.removeChannel(
      privateChatEventsChannel
    );

    privateChatEventsChannel =
      null;
  }

  const conversationId =
    privateChatConversationId;

  privateChatEventsChannel =
    supabaseClient
      .channel(
        'private-events-' +
        conversationId
      )
      .on(
        'postgres_changes',
        {
          event:
            'INSERT',

          schema:
            'public',

          table:
            'private_conversation_events',

          filter:
            'conversation_id=eq.' +
            conversationId
        },

        async payload => {
          if (
            conversationId !==
            privateChatConversationId
          ) {
            return;
          }

          await renderPrivateConversationEvent(
            payload.new
          );

          scrollPrivateChatToBottom();
        }
      )
      .subscribe();
}


// ============================================================
// CREATE ADD MEMBERS PANEL
// ============================================================

function createPrivateMembersPanel() {
  if (
    document.getElementById(
      'privateMembersPanel'
    )
  ) {
    return;
  }

  const panel =
    document.createElement(
      'div'
    );

  panel.id =
    'privateMembersPanel';

  panel.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    z-index:9999;
    background:rgba(0,0,0,.72);
    padding:20px;
    overflow:auto;
  `;

  panel.innerHTML = `
    <div style="
      max-width:520px;
      margin:40px auto;
      background:#172033;
      color:white;
      border-radius:16px;
      padding:18px;
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        margin-bottom:15px;
      ">
        <h3
          id="privateMembersTitle"
          style="margin:0;"
        ></h3>

        <button
          type="button"
          id="privateMembersClose"
          style="
            border:0;
            background:transparent;
            color:white;
            font-size:26px;
            cursor:pointer;
          "
        >×</button>
      </div>

      <input
        id="privateMembersSearch"
        type="search"
        autocomplete="off"
        style="
          width:100%;
          margin-bottom:14px;
          padding:11px;
          border-radius:10px;
        "
      >

      <div
        id="privateMembersList"
      ></div>

      <button
        type="button"
        id="privateMembersAddBtn"
        class="submit-btn"
        style="
          width:100%;
          margin-top:15px;
        "
      ></button>

    </div>
  `;

  document.body.appendChild(
    panel
  );

  document
    .getElementById(
      'privateMembersClose'
    )
    ?.addEventListener(
      'click',
      closePrivateMembersPanel
    );

  document
    .getElementById(
      'privateMembersSearch'
    )
    ?.addEventListener(
      'input',
      renderPrivateMembersCandidates
    );

  document
    .getElementById(
      'privateMembersAddBtn'
    )
    ?.addEventListener(
      'click',
      addSelectedPrivateMembers
    );
}


// ============================================================
// OPEN ADD MEMBERS
// ============================================================

async function openPrivateChatMembers() {
  if (
    !currentUser ||
    !privateChatConversationId
  ) {
    return;
  }

  createPrivateMembersPanel();

  setPrivateMembersLanguage();

  const panel =
    document.getElementById(
      'privateMembersPanel'
    );

  if (panel) {
    panel.style.display =
      'block';
  }

  const search =
    document.getElementById(
      'privateMembersSearch'
    );

  if (search) {
    search.value =
      '';
  }

  await loadPrivateMembersCandidates();
}


// ============================================================
// CLOSE ADD MEMBERS
// ============================================================

function closePrivateMembersPanel() {
  const panel =
    document.getElementById(
      'privateMembersPanel'
    );

  if (panel) {
    panel.style.display =
      'none';
  }
}


// ============================================================
// LOAD USERS AVAILABLE TO ADD
// ============================================================

async function loadPrivateMembersCandidates() {
  const list =
    document.getElementById(
      'privateMembersList'
    );

  if (!list) {
    return;
  }

  list.innerHTML =
    '<div class="loading">' +
    T(
      'Načítavam používateľov...',
      'Loading users...'
    ) +
    '</div>';

  const {
    data: memberships,
    error: membershipError
  } =
    await supabaseClient
      .from(
        'private_conversation_memberships'
      )
      .select(
        'user_id'
      )
      .eq(
        'conversation_id',
        privateChatConversationId
      )
      .is(
        'left_at',
        null
      );

  if (membershipError) {
    list.textContent =
      T(
        'Používateľov sa nepodarilo načítať.',
        'Users could not be loaded.'
      );

    return;
  }

  const activeIds =
    new Set(
      (memberships || []).map(
        member =>
          member.user_id
      )
    );

  const {
    data: users,
    error
  } =
    await supabaseClient
      .from(
        'user_profiles'
      )
      .select(
        'user_id,display_name,avatar_url'
      )
      .neq(
        'user_id',
        currentUser.id
      )
      .order(
        'display_name',
        {
          ascending: true
        }
      );

  if (error) {
    list.textContent =
      T(
        'Používateľov sa nepodarilo načítať.',
        'Users could not be loaded.'
      );

    return;
  }

  privateMemberCandidates =
    (users || []).filter(
      user =>
        !activeIds.has(
          user.user_id
        )
    );

  renderPrivateMembersCandidates();
}
// ============================================================
// RENDER USERS AVAILABLE TO ADD
// ============================================================

function renderPrivateMembersCandidates() {
  const list =
    document.getElementById(
      'privateMembersList'
    );

  if (!list) {
    return;
  }

  const query =
    (
      document.getElementById(
        'privateMembersSearch'
      )?.value || ''
    )
      .trim()
      .toLowerCase();

  const users =
    privateMemberCandidates.filter(
      user =>
        (
          user.display_name ||
          ''
        )
          .toLowerCase()
          .includes(
            query
          )
    );

  list.innerHTML =
    '';

  if (!users.length) {
    list.textContent =
      T(
        'Žiadni ďalší používatelia.',
        'No other users.'
      );

    return;
  }

  for (
    const user
    of users
  ) {
    const label =
      document.createElement(
        'label'
      );

    label.style.cssText = `
      display:flex;
      align-items:center;
      gap:12px;
      padding:10px;
      margin:7px 0;
      border:1px solid #334155;
      border-radius:12px;
      cursor:pointer;
    `;


    const checkbox =
      document.createElement(
        'input'
      );

    checkbox.type =
      'checkbox';

    checkbox.value =
      user.user_id;

    checkbox.className =
      'private-member-add-checkbox';


    const avatar =
      document.createElement(
        'div'
      );

    avatar.style.cssText = `
      width:42px;
      height:42px;
      min-width:42px;
      border-radius:50%;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#334155;
      font-size:22px;
    `;


    if (user.avatar_url) {
      const image =
        document.createElement(
          'img'
        );

      image.src =
        user.avatar_url;

      image.alt =
        '';

      image.style.cssText =
        'width:100%;' +
        'height:100%;' +
        'object-fit:cover;';

      avatar.appendChild(
        image
      );

    } else {
      avatar.textContent =
        '👤';
    }


    const name =
      document.createElement(
        'div'
      );

    name.textContent =
      user.display_name ||
      T(
        'Používateľ',
        'User'
      );

    name.style.fontWeight =
      '700';


    label.append(
      checkbox,
      avatar,
      name
    );

    list.appendChild(
      label
    );
  }
}


// ============================================================
// ADD SELECTED MEMBERS
// ============================================================

async function addSelectedPrivateMembers() {
  if (
    !currentUser ||
    !privateChatConversationId
  ) {
    return;
  }

  const selected = [
    ...document.querySelectorAll(
      '.private-member-add-checkbox:checked'
    )
  ].map(
    checkbox =>
      checkbox.value
  );

  if (!selected.length) {
    alert(
      T(
        'Vyberte aspoň jedného používateľa.',
        'Select at least one user.'
      )
    );

    return;
  }

  const button =
    document.getElementById(
      'privateMembersAddBtn'
    );

  if (button) {
    button.disabled =
      true;
  }

  try {
    for (
      const userId
      of selected
    ) {
      const {
        error
      } =
        await supabaseClient.rpc(
          'add_private_conversation_member',
          {
            p_conversation_id:
              privateChatConversationId,

            p_user_id:
              userId
          }
        );

      if (error) {
        alert(
          T(
            'Niektorého používateľa sa nepodarilo pridať.',
            'One of the users could not be added.'
          )
        );

        return;
      }
    }

    closePrivateMembersPanel();

    alert(
      T(
        'Používatelia boli pridaní do diskusie. 😊',
        'Users were added to the conversation. 😊'
      )
    );

  } finally {
    if (button) {
      button.disabled =
        false;
    }
  }
}


// ============================================================
// ADD MEMBERS LANGUAGE
// ============================================================

function setPrivateMembersLanguage() {
  const title =
    document.getElementById(
      'privateMembersTitle'
    );

  const search =
    document.getElementById(
      'privateMembersSearch'
    );

  const addButton =
    document.getElementById(
      'privateMembersAddBtn'
    );

  if (title) {
    title.textContent =
      T(
        'Pridať do diskusie',
        'Add to conversation'
      );
  }

  if (search) {
    search.placeholder =
      T(
        'Vyhľadať používateľa...',
        'Search users...'
      );
  }

  if (addButton) {
    addButton.textContent =
      T(
        'Pridať vybraných',
        'Add selected'
      );
  }
}


// ============================================================
// CREATE REMOVE MEMBERS PANEL
// ============================================================

function createPrivateRemoveMembersPanel() {
  if (
    document.getElementById(
      'privateRemoveMembersPanel'
    )
  ) {
    return;
  }

  const panel =
    document.createElement(
      'div'
    );

  panel.id =
    'privateRemoveMembersPanel';

  panel.style.cssText = `
    display:none;
    position:fixed;
    inset:0;
    z-index:10000;
    background:rgba(0,0,0,.72);
    padding:20px;
    overflow:auto;
  `;

  panel.innerHTML = `
    <div style="
      max-width:520px;
      margin:40px auto;
      background:#172033;
      color:white;
      border-radius:16px;
      padding:18px;
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
        margin-bottom:15px;
      ">
        <h3
          id="privateRemoveMembersTitle"
          style="margin:0;"
        ></h3>

        <button
          type="button"
          id="privateRemoveMembersClose"
          style="
            border:0;
            background:transparent;
            color:white;
            font-size:26px;
            cursor:pointer;
          "
        >×</button>
      </div>

      <div
        id="privateRemoveMembersList"
      ></div>

      <button
        type="button"
        id="privateRemoveMembersBtn"
        class="submit-btn"
        style="
          width:100%;
          margin-top:15px;
        "
      ></button>

    </div>
  `;

  document.body.appendChild(
    panel
  );

  document
    .getElementById(
      'privateRemoveMembersClose'
    )
    ?.addEventListener(
      'click',
      closePrivateRemoveMembersPanel
    );

  document
    .getElementById(
      'privateRemoveMembersBtn'
    )
    ?.addEventListener(
      'click',
      removeSelectedPrivateMembers
    );
}


// ============================================================
// OPEN REMOVE MEMBERS PANEL
// ============================================================

async function openPrivateRemoveMembersPanel() {
  if (
    !currentUser ||
    !privateChatConversationId
  ) {
    return;
  }

  createPrivateRemoveMembersPanel();

  setPrivateRemoveMembersLanguage();

  const panel =
    document.getElementById(
      'privateRemoveMembersPanel'
    );

  if (panel) {
    panel.style.display =
      'block';
  }

  await loadPrivateMembersForRemoval();
}


// ============================================================
// CLOSE REMOVE MEMBERS PANEL
// ============================================================

function closePrivateRemoveMembersPanel() {
  const panel =
    document.getElementById(
      'privateRemoveMembersPanel'
    );

  if (panel) {
    panel.style.display =
      'none';
  }
}


// ============================================================
// LOAD MEMBERS AVAILABLE TO REMOVE
// ============================================================

async function loadPrivateMembersForRemoval() {
  const list =
    document.getElementById(
      'privateRemoveMembersList'
    );

  if (
    !list ||
    !currentUser ||
    !privateChatConversationId
  ) {
    return;
  }

  list.innerHTML =
    '<div class="loading">' +
    T(
      'Načítavam členov...',
      'Loading members...'
    ) +
    '</div>';

  const {
    data: memberships,
    error
  } =
    await supabaseClient
      .from(
        'private_conversation_memberships'
      )
      .select(
        'user_id'
      )
      .eq(
        'conversation_id',
        privateChatConversationId
      )
      .is(
        'left_at',
        null
      )
      .neq(
        'user_id',
        currentUser.id
      );

  if (error) {
    list.textContent =
      T(
        'Členov sa nepodarilo načítať.',
        'Members could not be loaded.'
      );

    return;
  }

  const ids =
    (memberships || []).map(
      member =>
        member.user_id
    );

  if (!ids.length) {
    list.textContent =
      T(
        'V diskusii nie je nikto ďalší.',
        'There is nobody else in this conversation.'
      );

    return;
  }

  const {
    data: users,
    error: usersError
  } =
    await supabaseClient
      .from(
        'user_profiles'
      )
      .select(
        'user_id,display_name,avatar_url'
      )
      .in(
        'user_id',
        ids
      )
      .order(
        'display_name',
        {
          ascending: true
        }
      );

  if (usersError) {
    list.textContent =
      T(
        'Členov sa nepodarilo načítať.',
        'Members could not be loaded.'
      );

    return;
  }

  list.innerHTML =
    '';

  for (
    const user
    of users || []
  ) {
    const label =
      document.createElement(
        'label'
      );

    label.style.cssText = `
      display:flex;
      align-items:center;
      gap:12px;
      padding:10px;
      margin:7px 0;
      border:1px solid #334155;
      border-radius:12px;
      cursor:pointer;
    `;


    const checkbox =
      document.createElement(
        'input'
      );

    checkbox.type =
      'checkbox';

    checkbox.value =
      user.user_id;

    checkbox.className =
      'private-member-remove-checkbox';


    const avatar =
      document.createElement(
        'div'
      );

    avatar.style.cssText = `
      width:42px;
      height:42px;
      min-width:42px;
      border-radius:50%;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#334155;
      font-size:22px;
    `;


    if (user.avatar_url) {
      const image =
        document.createElement(
          'img'
        );

      image.src =
        user.avatar_url;

      image.alt =
        '';

      image.style.cssText =
        'width:100%;' +
        'height:100%;' +
        'object-fit:cover;';

      avatar.appendChild(
        image
      );

    } else {
      avatar.textContent =
        '👤';
    }


    const name =
      document.createElement(
        'div'
      );

    name.textContent =
      user.display_name ||
      T(
        'Používateľ',
        'User'
      );

    name.style.fontWeight =
      '700';


    label.append(
      checkbox,
      avatar,
      name
    );

    list.appendChild(
      label
    );
  }
}


// ============================================================
// REMOVE SELECTED MEMBERS
// ============================================================

async function removeSelectedPrivateMembers() {
  if (
    !currentUser ||
    !privateChatConversationId
  ) {
    return;
  }

  const selected = [
    ...document.querySelectorAll(
      '.private-member-remove-checkbox:checked'
    )
  ].map(
    checkbox =>
      checkbox.value
  );

  if (!selected.length) {
    alert(
      T(
        'Vyberte aspoň jedného používateľa.',
        'Select at least one user.'
      )
    );

    return;
  }

  const confirmed =
    confirm(
      T(
        'Ukončiť ich účasť v tejto diskusii?',
        'End their participation in this conversation?'
      )
    );

  if (!confirmed) {
    return;
  }

  const button =
    document.getElementById(
      'privateRemoveMembersBtn'
    );

  if (button) {
    button.disabled =
      true;
  }

  try {
    const {
      error
    } =
      await supabaseClient.rpc(
        'remove_private_conversation_members',
        {
          p_conversation_id:
            privateChatConversationId,

          p_user_ids:
            selected
        }
      );

    if (error) {
      alert(
        T(
          'Používateľov sa nepodarilo odobrať.',
          'The users could not be removed.'
        )
      );

      return;
    }

    closePrivateRemoveMembersPanel();

  } finally {
    if (button) {
      button.disabled =
        false;
    }
  }
}


// ============================================================
// REMOVE MEMBERS LANGUAGE
// ============================================================

function setPrivateRemoveMembersLanguage() {
  const title =
    document.getElementById(
      'privateRemoveMembersTitle'
    );

  const button =
    document.getElementById(
      'privateRemoveMembersBtn'
    );

  if (title) {
    title.textContent =
      T(
        'Ukončiť účasť v diskusii',
        'End participation'
      );
  }

  if (button) {
    button.textContent =
      T(
        'Odobrať vybraných',
        'Remove selected'
      );
  }
}


// ============================================================
// LONG PRESS MEMBERS BUTTON
// Tap = add users
// Long press = remove users
// ============================================================

function initialisePrivateMembersLongPress(
  button
) {
  if (
    !button ||
    button.dataset.privateHoldReady ===
      'true'
  ) {
    return;
  }

  button.dataset.privateHoldReady =
    'true';

  let holdTimer =
    null;

  let longPress =
    false;


  button.addEventListener(
    'touchstart',
    () => {
      longPress =
        false;

      holdTimer =
        setTimeout(
          () => {
            longPress =
              true;

            openPrivateRemoveMembersPanel();
          },
          650
        );
    },
    {
      passive: true
    }
  );


  button.addEventListener(
    'touchend',
    event => {
      clearTimeout(
        holdTimer
      );

      if (longPress) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }
  );


  button.addEventListener(
    'touchcancel',
    () => {
      clearTimeout(
        holdTimer
      );
    }
  );


  button.addEventListener(
    'contextmenu',
    event => {
      event.preventDefault();

      openPrivateRemoveMembersPanel();
    }
  );
}


// ============================================================
// CLOSE PRIVATE CHAT
// ============================================================

async function closePrivateChat() {
  privateChatOpen =
    false;

  if (currentUser) {
    await supabaseClient
      .from('user_profiles')
      .update({
        presence_status: 'logged_in',
        last_active_at: new Date().toISOString()
      })
      .eq('user_id', currentUser.id);
  }

  clearPrivateChatPendingPhoto();

  closePrivateMembersPanel();
  closePrivateRemoveMembersPanel();

  const page =
    document.getElementById(
      'privateChatPage'
    );

  if (page) {
    page.style.display =
      'none';
  }


  if (
    privateChatMessagesChannel
  ) {
    supabaseClient.removeChannel(
      privateChatMessagesChannel
    );

    privateChatMessagesChannel =
      null;
  }


  if (
    privateChatEventsChannel
  ) {
    supabaseClient.removeChannel(
      privateChatEventsChannel
    );

    privateChatEventsChannel =
      null;
  }


  privateChatConversationId =
    null;

  privateChatSelectedUser =
    null;


  if (
    typeof window.openPrivateUsers ===
    'function'
  ) {
    window.openPrivateUsers();
  }
}


// ============================================================
// LANGUAGE
// ============================================================

function setPrivateChatLanguage() {
  const input =
    document.getElementById(
      'privateChatMessageInput'
    );

  if (input) {
    input.placeholder =
      T(
        'Napíšte správu...',
        'Write a message...'
      );
  }


  const members =
    document.getElementById(
      'privateChatMembersBtn'
    );

  if (members) {
    members.title =
      T(
        'Pridať používateľov',
        'Add users'
      );
  }


  const deleteButtons =
    document.querySelectorAll(
      '#privateChatMessages .private-delete-btn'
    );

  deleteButtons.forEach(
    button => {
      button.title =
        T(
          'Vymazať',
          'Delete'
        );
    }
  );


  const messages =
    document.querySelectorAll(
      '#privateChatMessages [id^="private-message-"]'
    );

  messages.forEach(
    item => {
      const receipt =
        item.querySelector(
          '.private-read-receipt'
        );

      if (!receipt) {
        return;
      }

      const text =
        receipt.textContent;

      const wasRead =
        text === 'Prečítané' ||
        text === 'Read';

      receipt.textContent =
        wasRead
          ? T(
              'Prečítané',
              'Read'
            )
          : T(
              'Odoslané',
              'Sent'
            );
    }
  );


  setPrivateMembersLanguage();
  setPrivateRemoveMembersLanguage();

  updatePrivateChatStatus();
}


// ============================================================
// SCROLL TO BOTTOM
// ============================================================

function scrollPrivateChatToBottom() {
  const box =
    document.getElementById(
      'privateChatMessages'
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
// CONNECT EXISTING USERS DIRECTORY
// ============================================================

function connectPrivateUsersDirectory() {

  const list =
    document.getElementById(
      'privateUsersList'
    );

  if (!list) return;

  const rows =
    list.querySelectorAll(
      '[data-user-id]'
    );

  rows.forEach(row => {

    if (row.dataset.privateChatConnected === '1') {
      return;
    }

    row.dataset.privateChatConnected = '1';

    row.addEventListener(
      'click',
      async function () {

        const userId =
          row.dataset.userId;

        if (!userId) return;

        const { data: user, error } =
          await supabaseClient
            .from('user_profiles')
            .select(
              'user_id,display_name,avatar_url,presence_status,last_active_at'
            )
            .eq(
              'user_id',
              userId
            )
            .single();

        if (error || !user) {
          console.error(
            'Private user load:',
            error
          );
          return;
        }

        window.selectedPrivateUser = user;

        await window.openPrivateChatWithUser(
          user
        );
      }
    );
  });
}

// ============================================================
// WATCH USERS DIRECTORY
// ============================================================

let privateDirectoryObserver =
  null;

let privateDirectoryStartTimer =
  null;


function startPrivateDirectoryObserver() {
  const list =
    document.getElementById(
      'privateUsersList'
    );

  if (!list) {
    clearTimeout(
      privateDirectoryStartTimer
    );

    privateDirectoryStartTimer =
      setTimeout(
        startPrivateDirectoryObserver,
        500
      );

    return;
  }

  clearTimeout(
    privateDirectoryStartTimer
  );

  connectPrivateUsersDirectory();

  if (
    privateDirectoryObserver
  ) {
    privateDirectoryObserver.disconnect();
  }

  privateDirectoryObserver =
    new MutationObserver(
      () => {
        connectPrivateUsersDirectory();
      }
    );

  privateDirectoryObserver.observe(
    list,
    {
      childList: true,
      subtree: true
    }
  );
}


// ============================================================
// INITIALISE PRIVATE CHAT
// ============================================================

function initialisePrivateChat() {
  createPrivateChatPage();

  createPrivateMembersPanel();

  createPrivateRemoveMembersPanel();

  startPrivateDirectoryObserver();

  setPrivateChatLanguage();
}


if (
  document.readyState ===
  'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    initialisePrivateChat,
    {
      once: true
    }
  );

} else {
  initialisePrivateChat();
}


// ============================================================
// END COMMUNITY FOR ALL – PRIVATE-CHAT.JS
// ============================================================
