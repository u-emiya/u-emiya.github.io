const MEMO_STORAGE_KEY = 'memoItems';
const memoForm = document.getElementById('memo-form');
const memoTitleInput = document.getElementById('memo-title');
const memoContentInput = document.getElementById('memo-content');
const memoLinkInput = document.getElementById('memo-link');
const memoImageInput = document.getElementById('memo-image');
const memoImagePreview = document.getElementById('memo-image-preview');
const memoListContainer = document.getElementById('memo-list');
const memoDetailContainer = document.getElementById('memo-detail');

const memoState = {
  items: []
};

function loadMemoItems() {
  const raw = localStorage.getItem(MEMO_STORAGE_KEY);
  try {
    memoState.items = raw ? JSON.parse(raw) : [];
  } catch (error) {
    memoState.items = [];
  }
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
}

function updateMemoImagePreview() {
  const file = memoImageInput.files && memoImageInput.files[0];
  if (!file) {
    clearMemoImagePreview();
    return;
  }

  const previewImage = document.createElement('img');
  previewImage.src = URL.createObjectURL(file);
  previewImage.alt = '選択した画像';
  memoImagePreview.innerHTML = '';
  memoImagePreview.appendChild(previewImage);
}

function renderMemoItems() {
  memoListContainer.innerHTML = '';

  if (!memoState.items.length) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'bookmark-empty';
    emptyMessage.textContent = 'まだメモがありません。タイトルと内容を書いて保存してください。';
    memoListContainer.appendChild(emptyMessage);
    return;
  }

  memoState.items.forEach((item) => {
    const itemEl = document.createElement('article');
    itemEl.className = 'memo-item';
    itemEl.innerHTML = `
      <div class="memo-item-header">
        <div>
          <h4>${escapeHtml(item.title || '無題のメモ')}</h4>
          <p class="memo-content">${escapeHtml(item.content || '本文はありません。')}</p>
        </div>
        <div class="memo-actions">
          <button class="memo-open" data-id="${item.id}" type="button">ページとして開く</button>
          <button class="memo-delete" data-id="${item.id}" type="button">削除</button>
        </div>
      </div>
      ${item.link ? `<p class="memo-link"><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.link)}</a></p>` : ''}
      ${item.imageDataUrl ? `<img class="memo-image" src="${escapeHtml(item.imageDataUrl)}" alt="${escapeHtml(item.title || '添付画像')}" />` : ''}
      <p class="memo-meta">保存日: ${formatDate(item.created)}</p>
    `;

    itemEl.querySelector('.memo-open').addEventListener('click', () => showMemoDetail(item.id));
    itemEl.querySelector('.memo-delete').addEventListener('click', () => deleteMemoItem(item.id));
    memoListContainer.appendChild(itemEl);
  });
}

function showMemoDetail(id) {
  const item = memoState.items.find((memo) => memo.id === id);
  if (!item) {
    memoDetailContainer.innerHTML = '';
    if (window.location.hash.startsWith('#memo-')) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    return;
  }

  memoDetailContainer.innerHTML = `
    <div class="memo-detail-card">
      <h4>${escapeHtml(item.title || '無題のメモ')}</h4>
      <p class="memo-content">${escapeHtml(item.content || '本文はありません。')}</p>
      ${item.link ? `<p class="memo-link"><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.link)}</a></p>` : ''}
      ${item.imageDataUrl ? `<img class="memo-image" src="${escapeHtml(item.imageDataUrl)}" alt="${escapeHtml(item.title || '添付画像')}" />` : ''}
      <p class="memo-meta">保存日: ${formatDate(item.created)}</p>
    </div>
  `;

  const nextHash = `#memo-${id}`;
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${nextHash}`);
  }
  memoDetailContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteMemoItem(id) {
  memoState.items = memoState.items.filter((item) => item.id !== id);
  saveMemoItems();
  renderMemoItems();
  if (window.location.hash === `#memo-${id}`) {
    memoDetailContainer.innerHTML = '';
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
}

async function addMemoItem(event) {
  event.preventDefault();

  const title = memoTitleInput.value.trim();
  const content = memoContentInput.value.trim();
  const link = memoLinkInput.value.trim();
  const imageFile = memoImageInput.files && memoImageInput.files[0] ? memoImageInput.files[0] : null;

  if (!title && !content) {
    return;
  }

  let imageDataUrl = '';
  if (imageFile) {
    imageDataUrl = await readFileAsDataUrl(imageFile);
  }

  memoState.items.unshift({
    id: String(Date.now()),
    title,
    content,
    link,
    imageDataUrl,
    created: Date.now(),
  });

  saveMemoItems();
  memoForm.reset();
  clearMemoImagePreview();
  renderMemoItems();
  showMemoDetail(memoState.items[0].id);
}

memoForm.addEventListener('submit', addMemoItem);
memoImageInput.addEventListener('change', updateMemoImagePreview);

window.addEventListener('hashchange', () => {
  const memoId = window.location.hash.replace('#memo-', '');
  if (memoId) {
    showMemoDetail(memoId);
  } else {
    memoDetailContainer.innerHTML = '';
  }
});

loadMemoItems();
renderMemoItems();

const initialMemoId = window.location.hash.replace('#memo-', '');
if (initialMemoId) {
  showMemoDetail(initialMemoId);
}
