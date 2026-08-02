const STORAGE_KEY = 'bookmarkItems';
const GITHUB_REPO = 'u-emiya/TestProject';
const GITHUB_BRANCH = 'main';
const GITHUB_DATA_PATH = 'HomePage/u-emiya.github.io/shared/bookmarks.json';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_DATA_PATH}`;
const GITHUB_DISPATCH_URL = `https://api.github.com/repos/${GITHUB_REPO}/dispatches`;
const GITHUB_SYNC_TOKEN = window.GITHUB_SYNC_TOKEN || localStorage.getItem('githubSyncToken') || '';
const form = document.getElementById('bookmark-form');
const urlInput = document.getElementById('bookmark-url');
const titleInput = document.getElementById('bookmark-title');
const tagsInput = document.getElementById('bookmark-tags');
const listContainer = document.getElementById('bookmark-list');
const tagButtonsContainer = document.getElementById('tag-buttons');
const filterInput = document.getElementById('tag-filter-input');
const clearFilterButton = document.getElementById('clear-filter');
const syncSharedButton = document.getElementById('sync-bookmark-shared');

const state = {
  items: [],
  filterTags: []
};

async function loadSharedItems() {
  try {
    const response = await fetch(GITHUB_RAW_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('共有データの読み込みに失敗しました。');
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      return data;
    }
  } catch (error) {
    // 共有データが取得できない場合はローカル保存にフォールバックする
  }
  return null;
}

async function saveSharedItems(items) {
  if (!GITHUB_SYNC_TOKEN) {
    console.warn('GitHub Actions 用のトークンが未設定です。window.GITHUB_SYNC_TOKEN に設定してください。');
    return;
  }

  try {
    const response = await fetch(GITHUB_DISPATCH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${GITHUB_SYNC_TOKEN}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        event_type: 'sync-shared-data',
        client_payload: {
          kind: 'bookmarks',
          payload: JSON.stringify(items)
        }
      }),
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error('共有データの送信に失敗しました。');
    }
  } catch (error) {
    // 共有データの保存に失敗してもローカル保存は残す
  }
}

async function loadItems() {
  const sharedItems = await loadSharedItems();
  if (sharedItems) {
    state.items = sharedItems;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    return;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  try {
    state.items = raw ? JSON.parse(raw) : [];
  } catch (error) {
    state.items = [];
  }
}

async function saveItems(items = state.items) {
  state.items = items;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  await saveSharedItems(state.items);
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

function render() {
  const visibleItems = getFilteredItems();
  listContainer.innerHTML = '';

  if (!visibleItems.length) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'bookmark-empty';
    emptyMessage.textContent = state.filterTags.length
      ? '絞り込み条件に一致するリンクはありません。'
      : 'まだリンクが登録されていません。URL とタグを保存してください。';
    listContainer.appendChild(emptyMessage);
  } else {
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
          <button class="bookmark-delete" data-id="${item.id}" type="button">削除</button>
        </div>
        <p class="bookmark-description">${escapeHtml(item.description)}</p>
        <div class="bookmark-meta">
          <span class="bookmark-date">保存日: ${formatDate(item.created)}</span>
          <div class="bookmark-tags">${item.tags.map((tag) => `<button class="tag-badge" type="button" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join('')}</div>
        </div>
      `;

      itemEl.querySelector('.bookmark-delete').addEventListener('click', () => deleteItem(item.id));
      itemEl.querySelectorAll('.tag-badge').forEach((button) => {
        button.addEventListener('click', () => setFilterTags([button.dataset.tag]));
      });
      listContainer.appendChild(itemEl);
    });
  }

  renderTagButtons();
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

function deleteItem(id) {
  state.items = state.items.filter((item) => item.id !== id);
  saveItems();
  render();
}

async function addItem(event) {
  event.preventDefault();

  const url = urlInput.value.trim();
  const title = titleInput.value.trim();
  const description = title;
  const tags = parseTags(tagsInput.value);

  if (!url) {
    return;
  }

  state.items.unshift({
    id: String(Date.now()),
    url,
    title,
    description,
    tags,
    created: Date.now(),
  });

  await saveItems();
  form.reset();
  filterInput.value = '';
  state.filterTags = [];
  render();
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

if (syncSharedButton) {
  syncSharedButton.addEventListener('click', async () => {
    await saveItems(state.items);
    window.alert('共有データに同期しました。');
  });
}

async function init() {
  await loadItems();
  render();
}

init();
