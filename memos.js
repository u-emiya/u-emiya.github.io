const memoForm = document.getElementById('memo-form');
const memoTitleInput = document.getElementById('memo-title');
const memoContentInput = document.getElementById('memo-content');
const memoTagsInput = document.getElementById('memo-tags');
const memoLinkInput = document.getElementById('memo-link');
const memoImageInput = document.getElementById('memo-image');
const memoImagePreview = document.getElementById('memo-image-preview');
const memoListContainer = document.getElementById('memo-list');
const memoTagFilterInput = document.getElementById('memo-tag-filter');
const memoTagButtonsContainer = document.getElementById('memo-tag-buttons');
const clearMemoFilterButton = document.getElementById('clear-memo-filter');

const memoState = {
  items: [],
  filterTags: [],
  canWrite: false,
  userEmail: ''
};

let pendingImageDataUrl = '';

function createItemId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);

    // RFC4122 v4 compatible bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildMemoDetailUrl(id) {
  return `memo-detail.html?id=${encodeURIComponent(id)}`;
}

function escapeHtml(value) {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSupabaseError(error) {
  if (!error) {
    return '不明なエラーです。';
  }

  const parts = [error.message || 'エラーメッセージなし'];
  if (error.code) parts.push(`code=${error.code}`);
  if (error.details) parts.push(`details=${error.details}`);
  if (error.hint) parts.push(`hint=${error.hint}`);
  return parts.join(' | ');
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

function parseTags(value) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .reduce((unique, tag) => {
      const normalized = tag.toLowerCase();
      if (!unique.some((item) => item.toLowerCase() === normalized)) {
        unique.push(tag);
      }
      return unique;
    }, []);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
}

function clearMemoImagePreview() {
  memoImagePreview.innerHTML = '';
  pendingImageDataUrl = '';
}

function updateMemoImagePreview() {
  const file = memoImageInput.files && memoImageInput.files[0];
  if (!file) {
    clearMemoImagePreview();
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    pendingImageDataUrl = reader.result;
    const previewImage = document.createElement('img');
    previewImage.src = pendingImageDataUrl;
    previewImage.alt = '選択した画像';
    memoImagePreview.innerHTML = '';
    memoImagePreview.appendChild(previewImage);
  };
  reader.readAsDataURL(file);
}

function getFilteredMemoItems() {
  if (!memoState.filterTags.length) {
    return memoState.items;
  }
  return memoState.items.filter((item) => {
    const itemTags = item.tags.map((tag) => tag.toLowerCase());
    return memoState.filterTags.every((filter) => itemTags.includes(filter));
  });
}

function getUniqueMemoTags() {
  const tags = memoState.items.flatMap((item) => item.tags);
  const unique = [];
  tags.forEach((tag) => {
    const normalized = tag.toLowerCase();
    if (!unique.some((item) => item.toLowerCase() === normalized)) {
      unique.push(tag);
    }
  });
  return unique.sort((a, b) => a.localeCompare(b, 'ja'));
}

function renderTagButtons() {
  memoTagButtonsContainer.innerHTML = '';
  const uniqueTags = getUniqueMemoTags();
  if (!uniqueTags.length) {
    memoTagButtonsContainer.textContent = 'まだタグがありません。';
    return;
  }
  uniqueTags.forEach((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag-button';
    button.textContent = tag;
    button.addEventListener('click', () => setMemoFilterTags([tag]));
    memoTagButtonsContainer.appendChild(button);
  });
}

function setMemoFilterTags(tags) {
  memoTagFilterInput.value = tags.join(', ');
  memoState.filterTags = tags.map((tag) => tag.toLowerCase());
  renderMemoItems();
}

function renderMemoItems() {
  memoListContainer.innerHTML = '';
  const visibleItems = getFilteredMemoItems();

  if (!visibleItems.length) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'bookmark-empty';
    emptyMessage.textContent = memoState.filterTags.length
      ? '絞り込み条件に一致するメモはありません。'
      : 'まだメモがありません。';
    memoListContainer.appendChild(emptyMessage);
    renderTagButtons();
    return;
  }

  visibleItems.forEach((item) => {
    const itemEl = document.createElement('article');
    itemEl.className = 'memo-item';
    itemEl.innerHTML = `
      <div class="memo-link-card">
        <div>
          <a href="${buildMemoDetailUrl(item.id)}">${escapeHtml(item.title || '無題のメモ')}</a>
          <div class="memo-tags">${item.tags.map((tag) => `<span class="memo-tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>
        </div>
        <div class="memo-actions">
          <button class="memo-open" data-id="${item.id}" type="button">開く</button>
          ${memoState.canWrite ? `<button class="memo-delete" data-id="${item.id}" type="button">削除</button>` : ''}
        </div>
      </div>
      <p class="memo-meta">保存日: ${formatDate(item.created)}</p>
    `;

    itemEl.querySelector('.memo-open').addEventListener('click', () => {
      window.location.href = buildMemoDetailUrl(item.id);
    });

    const deleteButton = itemEl.querySelector('.memo-delete');
    if (deleteButton) {
      deleteButton.addEventListener('click', () => {
        void deleteMemoItem(item.id);
      });
    }

    memoListContainer.appendChild(itemEl);
  });

  renderTagButtons();
}

function setWriteUiState(canWrite) {
  memoForm.querySelectorAll('input, textarea, button').forEach((el) => {
    el.disabled = !canWrite;
  });

  const existingNote = document.getElementById('memo-readonly-note');

  if (!canWrite && !existingNote) {
    memoForm.insertAdjacentHTML(
      'beforeend',
      '<p id="memo-readonly-note" class="memo-helper">閲覧モード。ログインは <a href="auth.html">認証ページ</a> から行ってください。</p>'
    );
  }

  if (canWrite && existingNote) {
    existingNote.remove();
  }
}

async function fetchMemosFromSupabase() {
  if (!window.supabaseClient) {
    window.alert('Supabase client が初期化されていません。');
    return;
  }

  const { data, error } = await window.supabaseClient
    .from('memos')
    .select('*')
    .order('created', { ascending: false });

  if (error) {
    const summary = formatSupabaseError(error);
    console.error('[memos] fetch failed:', error);
    window.alert('メモ取得に失敗しました: ' + summary);
    return;
  }

  memoState.items = (data || []).map((row) => ({
    id: String(row.id),
    title: row.title || '',
    content: row.content || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    link: row.link || '',
    imageDataUrl: row.image_data_url || '',
    created: row.created || Date.now()
  }));

  renderMemoItems();
}

async function upsertMemoToSupabase(item) {
  const { data, error } = await window.supabaseClient.from('memos').upsert(
    {
      id: item.id,
      title: item.title,
      content: item.content,
      tags: item.tags,
      link: item.link,
      image_data_url: item.imageDataUrl,
      created: item.created
    },
    { onConflict: 'id' }
  ).select('id').maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error('保存応答が空でした。RLS またはテーブル設定を確認してください。');
  }
}

async function deleteMemoItem(id) {
  if (!memoState.canWrite) {
    window.alert('削除権限がありません。');
    return;
  }

  const { error } = await window.supabaseClient.from('memos').delete().eq('id', id);
  if (error) {
    const summary = formatSupabaseError(error);
    console.error('[memos] delete failed:', error);
    window.alert('削除に失敗しました: ' + summary);
    return;
  }

  memoState.items = memoState.items.filter((item) => item.id !== id);
  renderMemoItems();
}

async function addMemoItem(event) {
  event.preventDefault();

  if (!memoState.canWrite) {
    window.alert('保存権限がありません。');
    return;
  }

  const title = memoTitleInput.value.trim();
  const content = memoContentInput.value.trim();
  const tags = parseTags(memoTagsInput.value);
  const link = memoLinkInput.value.trim();
  const imageFile = memoImageInput.files && memoImageInput.files[0] ? memoImageInput.files[0] : null;

  if (!title && !content) {
    return;
  }

  let imageDataUrl = pendingImageDataUrl;
  if (!imageDataUrl && imageFile) {
    imageDataUrl = await readFileAsDataUrl(imageFile);
  }

  const newItem = {
    id: createItemId(),
    title,
    content,
    tags,
    link,
    imageDataUrl,
    created: Date.now()
  };

  try {
    await upsertMemoToSupabase(newItem);
    memoState.items.unshift(newItem);
    memoForm.reset();
    clearMemoImagePreview();
    renderMemoItems();
  } catch (error) {
    console.error('[memos] save failed:', error);
    const summary = formatSupabaseError(error);
    window.alert('保存に失敗しました: ' + summary);
  }
}

function updateAuthUi() {
  const statusEl = document.getElementById('supabase-status');
  const loginBtn = document.getElementById('supabase-login');
  const logoutBtn = document.getElementById('supabase-logout');

  if (statusEl) {
    if (memoState.userEmail) {
      statusEl.textContent = memoState.canWrite
        ? `管理者ログイン中: ${memoState.userEmail}`
        : `閲覧ログイン中: ${memoState.userEmail}`;
    } else {
      statusEl.textContent = '未ログイン（閲覧は可能）';
    }
  }

  if (loginBtn && logoutBtn) {
    if (memoState.userEmail) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = '';
    } else {
      loginBtn.style.display = '';
      logoutBtn.style.display = 'none';
    }
  }

  setWriteUiState(memoState.canWrite);
}

async function refreshAuthContext() {
  const authContext = await window.supabaseHelpers.getAuthContext();
  memoState.userEmail = authContext.user?.email || '';
  memoState.canWrite = authContext.canWrite;
  updateAuthUi();
}

function setupSupabaseUiMemos() {
  window.supabaseHelpers.onAuthChange(async () => {
    await refreshAuthContext();
    await fetchMemosFromSupabase();
  });
}

function handlePaste(event) {
  const clipboardItems = event.clipboardData && event.clipboardData.items;
  if (!clipboardItems) {
    return;
  }

  for (const item of clipboardItems) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      event.preventDefault();
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          pendingImageDataUrl = reader.result;
          memoImagePreview.innerHTML = '';
          const previewImage = document.createElement('img');
          previewImage.src = pendingImageDataUrl;
          previewImage.alt = '貼り付けた画像';
          memoImagePreview.appendChild(previewImage);
        };
        reader.readAsDataURL(file);
      }
      return;
    }
  }
}

memoForm.addEventListener('submit', (event) => {
  void addMemoItem(event);
});
memoForm.addEventListener('paste', handlePaste);
memoImageInput.addEventListener('change', updateMemoImagePreview);
memoTagFilterInput.addEventListener('input', () => {
  memoState.filterTags = memoTagFilterInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.toLowerCase());
  renderMemoItems();
});
clearMemoFilterButton.addEventListener('click', () => {
  memoTagFilterInput.value = '';
  memoState.filterTags = [];
  renderMemoItems();
});

async function init() {
  const callbackResult = await window.supabaseHelpers.completeAuthFromUrl();
  if (callbackResult.error) {
    window.alert('ログイン処理に失敗しました: ' + callbackResult.error.message);
  }

  setupSupabaseUiMemos();
  await refreshAuthContext();
  await fetchMemosFromSupabase();
}

void init();
