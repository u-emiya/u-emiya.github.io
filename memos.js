const MEMO_STORAGE_KEY = 'memoItems';
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
  filterTags: []
};

let pendingImageDataUrl = '';

function loadMemoItems() {
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

function saveMemoItems() {
  localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(memoState.items));
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
          <a href="memo-detail.html?id=${item.id}">${escapeHtml(item.title || '無題のメモ')}</a>
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
      window.location.href = `memo-detail.html?id=${item.id}`;
    });
    itemEl.querySelector('.memo-delete').addEventListener('click', () => deleteMemoItem(item.id));
    memoListContainer.appendChild(itemEl);
  });

  renderTagButtons();
}

function deleteMemoItem(id) {
  memoState.items = memoState.items.filter((item) => item.id !== id);
  saveMemoItems();
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

  saveMemoItems();
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

memoForm.addEventListener('submit', addMemoItem);
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

loadMemoItems();
renderMemoItems();