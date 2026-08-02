const MEMO_STORAGE_KEY = 'memoItems';
const detailContainer = document.getElementById('memo-detail-view');
const editFormWrapper = document.getElementById('memo-edit-form-wrapper');

function getMemoIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
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

function loadMemoItems() {
  const raw = localStorage.getItem(MEMO_STORAGE_KEY);
  try {
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveMemoItems(items) {
  localStorage.setItem(MEMO_STORAGE_KEY, JSON.stringify(items));
}

function renderMemoDetail() {
  const items = loadMemoItems();
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
      <a href="memos.html" class="memo-open">一覧へ戻る</a>
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

  editForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const updatedItems = loadMemoItems().map((memo) => {
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
    saveMemoItems(updatedItems);
    window.location.href = `memo-detail.html?id=${memoId}`;
  });

  deleteButton.addEventListener('click', () => {
    const updatedItems = loadMemoItems().filter((memo) => memo.id !== memoId);
    saveMemoItems(updatedItems);
    window.location.href = 'memos.html';
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

renderMemoDetail();
