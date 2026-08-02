const MEMO_STORAGE_KEY = 'memoItems';
const GITHUB_REPO = 'u-emiya/TestProject';
const GITHUB_BRANCH = 'main';
const GITHUB_DATA_PATH = 'HomePage/u-emiya.github.io/shared/memos.json';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_DATA_PATH}`;
const GITHUB_DISPATCH_URL = `https://api.github.com/repos/${GITHUB_REPO}/dispatches`;
const MYSITE_SYNC_TOKEN = window.MYSITE_SYNC_TOKEN || localStorage.getItem('mysiteSyncToken') || '';
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
const syncSharedButton = document.getElementById('sync-memo-shared');

const memoState = {
  items: [],
  filterTags: []
};

let pendingImageDataUrl = '';

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
  if (!MYSITE_SYNC_TOKEN) {
    console.warn('GitHub Actions 用のトークンが未設定です。window.MYSITE_SYNC_TOKEN に設定してください。');
    return;
  }

  try {
    const response = await fetch(GITHUB_DISPATCH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${MYSITE_SYNC_TOKEN}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28'
      },
      body: JSON.stringify({
        event_type: 'sync-shared-data',
        client_payload: {
          kind: 'memos',
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

function buildMemoDetailUrl(id) {
  return `memo-detail.html?id=${encodeURIComponent(id)}`;
}

async function loadMemoItems() {
  const sharedItems = await loadSharedItems();
  if (sharedItems) {
    memoState.items = sharedItems;
    localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memoState.items));
    return;
  }

  const raw = localStorage.getItem(MEMO_STORAGE_KEY);
  try {
    memoState.items = raw ? JSON.parse(raw) : [];
  } catch (error) {
    memoState.items = [];
  }
  memoState.items = memoState.items.map((item) => ({
    ...item,
    tags: Array.isArray(item.tags) ? item.tags : [],
    imageDataUrl: item.imageDataUrl || ''
  }));
}

async function saveMemoItems() {
  localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memoState.items));
  await saveSharedItems(memoState.items);
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
      : 'まだメモがありません。タイトルと内容を書いて保存してください。';
    memoListContainer.appendChild(emptyMessage);
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
          <button class="memo-delete" data-id="${item.id}" type="button">削除</button>
        </div>
      </div>
      <p class="memo-meta">保存日: ${formatDate(item.created)}</p>
    `;

    itemEl.querySelector('.memo-open').addEventListener('click', () => {
      window.location.href = buildMemoDetailUrl(item.id);
    });
    itemEl.querySelector('.memo-delete').addEventListener('click', () => deleteMemoItem(item.id));
    memoListContainer.appendChild(itemEl);
  });

  renderTagButtons();
}

function deleteMemoItem(id) {
  memoState.items = memoState.items.filter((item) => item.id !== id);
  void saveMemoItems();
  renderMemoItems();
}

async function addMemoItem(event) {
  event.preventDefault();

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

  memoState.items.unshift({
    id: String(Date.now()),
    title,
    content,
    tags,
    link,
    imageDataUrl,
    created: Date.now(),
  });

  await saveMemoItems();
  memoForm.reset();
  clearMemoImagePreview();
  renderMemoItems();
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

if (syncSharedButton) {
  syncSharedButton.addEventListener('click', async () => {
    await saveMemoItems();
    window.alert('共有データに同期しました。');
  });
}

async function init() {
  await loadMemoItems();
  renderMemoItems();
}

init();