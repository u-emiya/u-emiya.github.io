const form = document.getElementById('bookmark-form');
const urlInput = document.getElementById('bookmark-url');
const titleInput = document.getElementById('bookmark-title');
const tagsInput = document.getElementById('bookmark-tags');
const listContainer = document.getElementById('bookmark-list');
const tagButtonsContainer = document.getElementById('tag-buttons');
const filterInput = document.getElementById('tag-filter-input');
const clearFilterButton = document.getElementById('clear-filter');

const state = {
  items: [],
  filterTags: [],
  canWrite: false,
  userEmail: '',
  editingId: null
};

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

function normalizeTag(tag) {
  return tag.trim();
}

function parseTags(value) {
  return value
    .split(',')
    .map(normalizeTag)
    .filter(Boolean)
    .reduce((unique, tag) => {
      const normalized = tag.toLowerCase();
      if (!unique.some((item) => item.toLowerCase() === normalized)) {
        unique.push(tag);
      }
      return unique;
    }, []);
}

function updateFilterTags(value) {
  state.filterTags = value
    .split(',')
    .map(normalizeTag)
    .filter(Boolean)
    .map((tag) => tag.toLowerCase());
  render();
}

function getFilteredItems() {
  if (!state.filterTags.length) {
    return state.items;
  }
  return state.items.filter((item) => {
    const itemTags = item.tags.map((tag) => tag.toLowerCase());
    return state.filterTags.every((filter) => itemTags.includes(filter));
  });
}

function getUniqueTags() {
  const tags = state.items.flatMap((item) => item.tags);
  const unique = [];
  tags.forEach((tag) => {
    const normalized = tag.toLowerCase();
    if (!unique.some((item) => item.toLowerCase() === normalized)) {
      unique.push(tag);
    }
  });
  return unique.sort((a, b) => a.localeCompare(b, 'ja'));
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
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

function renderTagButtons() {
  const uniqueTags = getUniqueTags();
  tagButtonsContainer.innerHTML = '';
  if (!uniqueTags.length) {
    tagButtonsContainer.textContent = 'まだタグがありません。';
    return;
  }
  uniqueTags.forEach((tag) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tag-button';
    button.textContent = tag;
    button.addEventListener('click', () => setFilterTags([tag]));
    tagButtonsContainer.appendChild(button);
  });
}

function setFilterTags(tags) {
  filterInput.value = tags.join(', ');
  updateFilterTags(filterInput.value);
}

function render() {
  const visibleItems = getFilteredItems();
  listContainer.innerHTML = '';

  if (!visibleItems.length) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'bookmark-empty';
    emptyMessage.textContent = state.filterTags.length
      ? '絞り込み条件に一致するリンクはありません。'
      : 'まだリンクが登録されていません。';
    listContainer.appendChild(emptyMessage);
    renderTagButtons();
    return;
  }

  visibleItems.forEach((item) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'bookmark-item';

    const titleText = item.title || item.url;
    itemEl.innerHTML = `
      <div class="bookmark-item-header">
        <div>
          <h4>${escapeHtml(titleText)}</h4>
          <p class="bookmark-url"><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.url)}</a></p>
        </div>
        ${state.canWrite ? `<button class="bookmark-edit" data-id="${item.id}" type="button">編集</button><button class="bookmark-delete" data-id="${item.id}" type="button">削除</button>` : ''}
      </div>
      <p class="bookmark-description">${escapeHtml(item.description)}</p>
      <div class="bookmark-meta">
        <span class="bookmark-date">保存日: ${formatDate(item.created)}</span>
        <div class="bookmark-tags">${item.tags.map((tag) => `<button class="tag-badge" type="button" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>
      </div>
    `;

    const editButton = itemEl.querySelector('.bookmark-edit');
    if (editButton) {
      editButton.addEventListener('click', () => {
        startEditItem(item.id);
      });
    }

    const deleteButton = itemEl.querySelector('.bookmark-delete');
    if (deleteButton) {
      deleteButton.addEventListener('click', () => {
        void deleteItem(item.id);
      });
    }

    itemEl.querySelectorAll('.tag-badge').forEach((button) => {
      button.addEventListener('click', () => setFilterTags([button.dataset.tag]));
    });

    listContainer.appendChild(itemEl);
  });

  renderTagButtons();
}

function setWriteUiState(canWrite) {
  form.querySelectorAll('input, button').forEach((el) => {
    el.disabled = !canWrite;
  });

  const existingNote = document.getElementById('bookmark-readonly-note');
  if (!canWrite && !existingNote) {
    form.insertAdjacentHTML(
      'beforeend',
      '<p id="bookmark-readonly-note" class="memo-helper">閲覧モード。ログインは <a href="auth.html">認証ページ</a> から行ってください。</p>'
    );
  }

  if (canWrite && existingNote) {
    existingNote.remove();
  }
}

async function fetchBookmarksFromSupabase() {
  if (!window.supabaseClient) {
    window.alert('Supabase client が初期化されていません。');
    return;
  }

  const { data, error } = await window.supabaseClient
    .from('bookmarks')
    .select('*')
    .order('created', { ascending: false });

  if (error) {
    const summary = formatSupabaseError(error);
    console.error('[bookmarks] fetch failed:', error);
    window.alert('ブックマーク取得に失敗しました: ' + summary);
    return;
  }

  state.items = (data || []).map((row) => ({
    id: String(row.id),
    url: row.url || '',
    title: row.title || '',
    description: row.description || row.title || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    created: row.created || Date.now()
  }));

  render();
}

async function upsertBookmarkToSupabase(item) {
  const { data, error } = await window.supabaseClient.from('bookmarks').upsert(
    {
      id: item.id,
      url: item.url,
      title: item.title,
      description: item.description,
      tags: item.tags,
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

async function deleteItem(id) {
  if (!state.canWrite) {
    window.alert('削除権限がありません。');
    return;
  }

  const { error } = await window.supabaseClient.from('bookmarks').delete().eq('id', id);
  if (error) {
    const summary = formatSupabaseError(error);
    console.error('[bookmarks] delete failed:', error);
    window.alert('削除に失敗しました: ' + summary);
    return;
  }

  state.items = state.items.filter((item) => item.id !== id);
  render();
}

function startEditItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;

  urlInput.value = item.url;
  titleInput.value = item.title;
  tagsInput.value = item.tags.join(', ');
  state.editingId = id;

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.textContent = '更新する';

  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEdit() {
  state.editingId = null;
  form.reset();
  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.textContent = '保存する';
}

async function addItem(event) {
  event.preventDefault();

  if (!state.canWrite) {
    window.alert('保存権限がありません。');
    return;
  }

  const url = urlInput.value.trim();
  const title = titleInput.value.trim();
  const description = title;
  const tags = parseTags(tagsInput.value);

  if (!url) {
    return;
  }

  const isEditing = state.editingId !== null;
  const existingItem = isEditing ? state.items.find((i) => i.id === state.editingId) : null;

  const item = {
    id: isEditing ? state.editingId : createItemId(),
    url,
    title,
    description,
    tags,
    created: existingItem ? existingItem.created : Date.now()
  };

  try {
    await upsertBookmarkToSupabase(item);
    if (isEditing) {
      const index = state.items.findIndex((i) => i.id === state.editingId);
      if (index !== -1) state.items[index] = item;
    } else {
      state.items.unshift(item);
    }
    cancelEdit();
    filterInput.value = '';
    state.filterTags = [];
    render();
  } catch (error) {
    console.error('[bookmarks] save failed:', error);
    const summary = formatSupabaseError(error);
    window.alert('保存に失敗しました: ' + summary);
  }
}

function updateAuthUi() {
  const statusEl = document.getElementById('supabase-status');
  const loginBtn = document.getElementById('supabase-login');
  const logoutBtn = document.getElementById('supabase-logout');

  if (statusEl) {
    if (state.userEmail) {
      statusEl.textContent = state.canWrite
        ? `管理者ログイン中: ${state.userEmail}`
        : `閲覧ログイン中: ${state.userEmail}`;
    } else {
      statusEl.textContent = '未ログイン（閲覧は可能）';
    }
  }

  if (loginBtn && logoutBtn) {
    if (state.userEmail) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = '';
    } else {
      loginBtn.style.display = '';
      logoutBtn.style.display = 'none';
    }
  }

  setWriteUiState(state.canWrite);
}

async function refreshAuthContext() {
  const authContext = await window.supabaseHelpers.getAuthContext();
  state.userEmail = authContext.user?.email || '';
  state.canWrite = authContext.canWrite;
  updateAuthUi();
}

function setupSupabaseUi() {
  window.supabaseHelpers.onAuthChange(async () => {
    await refreshAuthContext();
    await fetchBookmarksFromSupabase();
  });
}

form.addEventListener('submit', (event) => {
  void addItem(event);
});
filterInput.addEventListener('input', () => updateFilterTags(filterInput.value));
clearFilterButton.addEventListener('click', () => {
  filterInput.value = '';
  state.filterTags = [];
  render();
});

async function init() {
  const callbackResult = await window.supabaseHelpers.completeAuthFromUrl();
  if (callbackResult.error) {
    window.alert('ログイン処理に失敗しました: ' + callbackResult.error.message);
  }

  setupSupabaseUi();
  await refreshAuthContext();
  await fetchBookmarksFromSupabase();
}

void init();
