const MEMO_STORAGE_KEY = 'memoItems';
const GITHUB_REPO = 'u-emiya/TestProject';
const GITHUB_BRANCH = 'main';
const GITHUB_DATA_PATH = 'HomePage/u-emiya.github.io/shared/memos.json';
const GITHUB_RAW_URL = `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${GITHUB_DATA_PATH}`;
const GITHUB_DISPATCH_URL = `https://api.github.com/repos/${GITHUB_REPO}/dispatches`;
const MYSITE_SYNC_TOKEN = window.MYSITE_SYNC_TOKEN || localStorage.getItem('mysiteSyncToken') || '';
const detailContainer = document.getElementById('memo-detail-view');
const editFormWrapper = document.getElementById('memo-edit-form-wrapper');

function getMemoIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

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

function buildMemoListUrl() {
  return 'memos.html';
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

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
}

async function loadMemoItems() {
  const sharedItems = await loadSharedItems();
  if (sharedItems) {
    return sharedItems.map((item) => ({
      ...item,
      tags: Array.isArray(item.tags) ? item.tags : [],
      imageDataUrl: item.imageDataUrl || ''
    }));
  }

  const raw = localStorage.getItem(MEMO_STORAGE_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

async function saveMemoItems(items) {
  localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(items));
  await saveSharedItems(items);
}

async function renderMemoDetail() {
  const items = await loadMemoItems();
  const memoId = getMemoIdFromQuery();
  const item = items.find((memo) => memo.id === memoId);
  let pendingEditImageDataUrl = item && item.imageDataUrl ? item.imageDataUrl : '';
  let isEditing = false;

  if (!item) {
    detailContainer.innerHTML = '<div class="bookmark-empty">指定されたメモは見つかりませんでした。</div>';
    editFormWrapper.innerHTML = '';
    return;
  }

  detailContainer.innerHTML = `
    <div class="memo-detail-card">
      <h3>${escapeHtml(item.title || '無題のメモ')}</h3>
      <p class="memo-detail-meta">保存日: ${formatDate(item.created)}</p>
      <div class="memo-tag-list">${(item.tags || []).map((tag) => `<span class="memo-tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="memo-content">${escapeHtml(item.content || '本文はありません。').replace(/\n/g, '<br>')}</div>
      ${item.link ? `<p class="memo-link"><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.link)}</a></p>` : ''}
      ${item.imageDataUrl ? `<img class="memo-image" src="${escapeHtml(item.imageDataUrl)}" alt="${escapeHtml(item.title || '添付画像')}" />` : ''}
    </div>
  `;

  detailContainer.insertAdjacentHTML('beforeend', `
    <div class="memo-detail-actions">
      <button type="button" id="toggle-edit-button">編集する</button>
    </div>
    <div class="memo-detail-actions memo-detail-footer-actions">
      <a href="${buildMemoListUrl()}" class="memo-open">一覧へ戻る</a>
    </div>
  `);

  editFormWrapper.innerHTML = '';

  const toggleEditButton = document.getElementById('toggle-edit-button');
  toggleEditButton.addEventListener('click', () => {
    isEditing = true;
    renderEditor();
  });

  function renderEditor() {
    if (!isEditing) {
      editFormWrapper.innerHTML = '';
      return;
    }

    editFormWrapper.innerHTML = `
      <div class="bookmark-box">
        <h3>メモを編集</h3>
        <form id="memo-edit-form" class="bookmark-form memo-form">
        <label>
          タイトル
          <input type="text" id="edit-title" value="${escapeHtml(item.title || '')}" required>
        </label>
        <label>
          内容
          <textarea id="edit-content" rows="8">${escapeHtml(item.content || '')}</textarea>
        </label>
        <label>
          タグ（任意）
          <input type="text" id="edit-tags" value="${escapeHtml((item.tags || []).join(', '))}">
        </label>
        <label>
          関連リンク（任意）
          <input type="url" id="edit-link" value="${escapeHtml(item.link || '')}">
        </label>
        <label>
          画像（任意・ファイルまたは貼り付け可）
          <input type="file" id="edit-image" accept="image/*">
        </label>
        <div id="edit-image-preview" class="memo-image-preview"></div>
        <p class="memo-helper">画像は Ctrl+V でも貼り付けできます。</p>
        <div class="memo-detail-actions">
          <button type="submit">保存する</button>
          <button class="memo-detail-delete" type="button" id="delete-memo-button">削除する</button>
          <button type="button" id="cancel-edit-button">キャンセル</button>
        </div>
      </form>
    </div>
  `;

  const editForm = document.getElementById('memo-edit-form');
  const editTitleInput = document.getElementById('edit-title');
  const editContentInput = document.getElementById('edit-content');
  const editTagsInput = document.getElementById('edit-tags');
  const editLinkInput = document.getElementById('edit-link');
  const editImageInput = document.getElementById('edit-image');
  const editImagePreview = document.getElementById('edit-image-preview');
  const deleteButton = document.getElementById('delete-memo-button');
  const cancelButton = document.getElementById('cancel-edit-button');

  if (item.imageDataUrl) {
    const previewImage = document.createElement('img');
    previewImage.src = item.imageDataUrl;
    previewImage.alt = '現在の画像';
    editImagePreview.appendChild(previewImage);
  }

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const updatedItems = (await loadMemoItems()).map((memo) => {
      if (memo.id !== memoId) return memo;
      return {
        ...memo,
        title: editTitleInput.value.trim(),
        content: editContentInput.value.trim(),
        tags: editTagsInput.value.split(',').map((tag) => tag.trim()).filter(Boolean),
        link: editLinkInput.value.trim(),
        imageDataUrl: pendingEditImageDataUrl || memo.imageDataUrl || ''
      };
    });
    await saveMemoItems(updatedItems);
    window.location.href = buildMemoDetailUrl(memoId);
  });

  deleteButton.addEventListener('click', async () => {
    const updatedItems = (await loadMemoItems()).filter((memo) => memo.id !== memoId);
    await saveMemoItems(updatedItems);
    window.location.href = buildMemoListUrl();
  });

  cancelButton.addEventListener('click', () => {
    isEditing = false;
    renderEditor();
  });

  editForm.addEventListener('paste', (event) => {
    const clipboardItems = event.clipboardData && event.clipboardData.items;
    if (!clipboardItems) return;
    for (const item of clipboardItems) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        event.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          pendingEditImageDataUrl = reader.result;
          editImagePreview.innerHTML = '';
          const previewImage = document.createElement('img');
          previewImage.src = pendingEditImageDataUrl;
          previewImage.alt = '貼り付けた画像';
          editImagePreview.appendChild(previewImage);
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  });

  editImageInput.addEventListener('change', () => {
    const file = editImageInput.files && editImageInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingEditImageDataUrl = reader.result;
      editImagePreview.innerHTML = '';
      const previewImage = document.createElement('img');
      previewImage.src = pendingEditImageDataUrl;
      previewImage.alt = '選択した画像';
      editImagePreview.appendChild(previewImage);
    };
    reader.readAsDataURL(file);
  });
  }

  renderEditor();
}

void renderMemoDetail();
