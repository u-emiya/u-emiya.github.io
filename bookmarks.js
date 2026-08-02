const STORAGE_KEY = 'bookmarkItems';
const form = document.getElementById('bookmark-form');
const urlInput = document.getElementById('bookmark-url');
const titleInput = document.getElementById('bookmark-title');
const tagsInput = document.getElementById('bookmark-tags');
const listContainer = document.getElementById('bookmark-list');
const tagButtonsContainer = document.getElementById('tag-buttons');
const filterInput = document.getElementById('tag-filter-input');
const clearFilterButton = document.getElementById('clear-filter');
const exportButton = document.getElementById('export-bookmarks');
const importButton = document.getElementById('import-bookmarks');
const clearButton = document.getElementById('clear-bookmarks');
const importFileInput = document.getElementById('bookmark-import-file');

const state = {
  items: [],
  filterTags: []
};

function saveItems(items = state.items) {
  state.items = items;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function exportItems() {
  downloadJson('bookmarks.json', state.items);
}

async function importItemsFromFile(file) {
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      throw new Error('JSON の内容が配列形式ではありません。');
    }

    state.items = parsed.map((item) => ({
      id: item.id || String(Date.now()),
      url: item.url || '',
      title: item.title || '',
      description: item.description || item.title || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      created: item.created || Date.now(),
    }));

    saveItems(state.items);
    render();
    window.alert('データを読み込みました。');
  } catch (error) {
    window.alert(`読み込みに失敗しました: ${error.message}`);
  }
}

function clearStoredItems() {
  if (!window.confirm('ローカルデータを削除しますか？')) {
    return;
  }
  state.items = [];
  saveItems(state.items);
  render();
}

async function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY);
  try {
    state.items = raw ? JSON.parse(raw) : [];
  } catch (error) {
    state.items = [];
  }
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

if (exportButton) {
  exportButton.addEventListener('click', () => {
    void exportItems();
  });
}

if (importButton) {
  importButton.addEventListener('click', () => {
    if (importFileInput) {
      importFileInput.click();
    }
  });
}

if (importFileInput) {
  importFileInput.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      void importItemsFromFile(file);
    }
    event.target.value = '';
  });
}

if (clearButton) {
  clearButton.addEventListener('click', () => {
    clearStoredItems();
  });
}

async function init() {
  await loadItems();
  render();
}

init();
