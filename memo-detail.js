const detailContainer = document.getElementById('memo-detail-view');
const editFormWrapper = document.getElementById('memo-edit-form-wrapper');

function getMemoIdFromQuery() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
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

async function fetchMemoById(memoId) {
  const { data, error } = await window.supabaseClient
    .from('memos')
    .select('*')
    .eq('id', memoId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: String(data.id),
    title: data.title || '',
    content: data.content || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    link: data.link || '',
    imageDataUrl: data.image_data_url || '',
    created: data.created || Date.now()
  };
}

async function renderMemoDetail() {
  const memoId = getMemoIdFromQuery();
  if (!memoId) {
    detailContainer.innerHTML = '<div class="bookmark-empty">メモIDが指定されていません。</div>';
    editFormWrapper.innerHTML = '';
    return;
  }

  let item;
  try {
    item = await fetchMemoById(memoId);
  } catch (error) {
    detailContainer.innerHTML = `<div class="bookmark-empty">読み込みに失敗しました: ${escapeHtml(error.message)}</div>`;
    editFormWrapper.innerHTML = '';
    return;
  }

  const auth = await window.supabaseHelpers.getAuthContext();
  const canWrite = auth.canWrite;

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

  detailContainer.insertAdjacentHTML(
    'beforeend',
    `
    <div class="memo-detail-actions memo-detail-footer-actions">
      <a href="${buildMemoListUrl()}" class="memo-open">一覧へ戻る</a>
    </div>
  `
  );

  if (!canWrite) {
    editFormWrapper.innerHTML = '<p class="memo-helper">このメモは閲覧モードです。編集は管理者のみ可能です。</p>';
    return;
  }

  let pendingEditImageDataUrl = item.imageDataUrl || '';

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

  if (item.imageDataUrl) {
    const previewImage = document.createElement('img');
    previewImage.src = item.imageDataUrl;
    previewImage.alt = '現在の画像';
    editImagePreview.appendChild(previewImage);
  }

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const { error } = await window.supabaseClient.from('memos').upsert(
      {
        id: memoId,
        title: editTitleInput.value.trim(),
        content: editContentInput.value.trim(),
        tags: parseTags(editTagsInput.value),
        link: editLinkInput.value.trim(),
        image_data_url: pendingEditImageDataUrl || '',
        created: item.created
      },
      { onConflict: 'id' }
    );

    if (error) {
      window.alert('更新に失敗しました: ' + error.message);
      return;
    }

    window.location.href = buildMemoDetailUrl(memoId);
  });

  deleteButton.addEventListener('click', async () => {
    const { error } = await window.supabaseClient.from('memos').delete().eq('id', memoId);
    if (error) {
      window.alert('削除に失敗しました: ' + error.message);
      return;
    }

    window.location.href = buildMemoListUrl();
  });

  editForm.addEventListener('paste', (event) => {
    const clipboardItems = event.clipboardData && event.clipboardData.items;
    if (!clipboardItems) return;

    for (const entry of clipboardItems) {
      if (entry.kind === 'file' && entry.type.startsWith('image/')) {
        event.preventDefault();
        const file = entry.getAsFile();
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

void renderMemoDetail();
