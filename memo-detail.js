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

function normalizeRelatedLinks(rawValue) {
  if (!rawValue) {
    return [];
  }

  const list = Array.isArray(rawValue) ? rawValue : [rawValue];
  return list
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const url = typeof entry.url === 'string' ? entry.url.trim() : '';
      const description = typeof entry.description === 'string' ? entry.description.trim() : '';
      if (!url) {
        return null;
      }

      return { url, description };
    })
    .filter(Boolean);
}

function buildRelatedLinkEntry(url = '', description = '') {
  return { url, description };
}

function getPrimaryMemoLink(links) {
  if (!Array.isArray(links) || !links.length) {
    return '';
  }

  const first = links.find((entry) => entry && typeof entry.url === 'string' && entry.url.trim());
  return first ? first.url.trim() : '';
}

function getRelatedLinkInputs(container) {
  const rows = container.querySelectorAll('.memo-related-link-row');
  return Array.from(rows)
    .map((row) => {
      const urlInput = row.querySelector('.memo-related-link-url');
      const descriptionInput = row.querySelector('.memo-related-link-description');
      return {
        url: urlInput ? urlInput.value.trim() : '',
        description: descriptionInput ? descriptionInput.value.trim() : ''
      };
    })
    .filter((entry) => entry.url || entry.description);
}

function renderRelatedLinkEditor(container, entries = []) {
  const normalizedEntries = entries.length ? entries : [buildRelatedLinkEntry()];
  container.innerHTML = '';

  normalizedEntries.forEach((entry, index) => {
    const row = document.createElement('div');
    row.className = 'memo-related-link-row';
    row.innerHTML = `
      <div class="memo-related-link-fields">
        <input type="url" class="memo-related-link-url" value="${escapeHtml(entry.url || '')}" placeholder="https://example.com">
        <input type="text" class="memo-related-link-description" value="${escapeHtml(entry.description || '')}" placeholder="説明文（例: 参考記事）">
      </div>
      <button type="button" class="memo-related-link-remove" data-index="${index}">削除</button>
    `;

    const removeButton = row.querySelector('.memo-related-link-remove');
    removeButton.addEventListener('click', () => {
      const currentEntries = getRelatedLinkInputs(container);
      const nextEntries = currentEntries.filter((_, i) => i !== index);
      if (!nextEntries.length) {
        nextEntries.push(buildRelatedLinkEntry());
      }
      renderRelatedLinkEditor(container, nextEntries);
    });

    container.appendChild(row);
  });
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
    link: data.link || (Array.isArray(data.related_links) && data.related_links[0] ? data.related_links[0].url : ''),
    relatedLinks: normalizeRelatedLinks(Array.isArray(data.related_links) ? data.related_links : (data.link ? [{ url: data.link, description: '' }] : [])),
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

  const relatedLinks = item.relatedLinks && item.relatedLinks.length
    ? item.relatedLinks
    : (item.link ? [{ url: item.link, description: '' }] : []);
  const relatedLinkMarkup = relatedLinks.length
    ? `<div class="memo-link-list">${relatedLinks.map((entry) => `
        <span class="memo-related-link-item">
          <a href="${escapeHtml(entry.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.description || entry.url)}</a>
        </span>
      `).join('')}</div>`
    : '';

  detailContainer.innerHTML = `
    <div class="memo-detail-card">
      <h3>${escapeHtml(item.title || '無題のメモ')}</h3>
      <p class="memo-detail-meta">保存日: ${formatDate(item.created)}</p>
      <div class="memo-tag-list">${(item.tags || []).map((tag) => `<span class="memo-tag-pill">${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="memo-content">${escapeHtml(item.content || '本文はありません。').replace(/\n/g, '<br>')}</div>
      ${relatedLinkMarkup}
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
    editFormWrapper.innerHTML = '<p class="memo-helper">閲覧モード</p>';
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
        <div class="memo-related-links">
          <div class="memo-related-links-header">
            <span>関連リンク（任意）</span>
            <button type="button" id="add-edit-memo-link-entry" class="secondary-button">追加</button>
          </div>
          <div id="memo-edit-related-links-container" class="memo-related-links-container"></div>
        </div>
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
  const editImageInput = document.getElementById('edit-image');
  const editImagePreview = document.getElementById('edit-image-preview');
  const editRelatedLinksContainer = document.getElementById('memo-edit-related-links-container');
  const addEditLinkButton = document.getElementById('add-edit-memo-link-entry');
  const deleteButton = document.getElementById('delete-memo-button');

  renderRelatedLinkEditor(editRelatedLinksContainer, item.relatedLinks && item.relatedLinks.length ? item.relatedLinks : (item.link ? [{ url: item.link, description: '' }] : []));
  addEditLinkButton.addEventListener('click', () => {
    const currentEntries = getRelatedLinkInputs(editRelatedLinksContainer);
    currentEntries.push(buildRelatedLinkEntry());
    renderRelatedLinkEditor(editRelatedLinksContainer, currentEntries);
  });

  if (item.imageDataUrl) {
    const previewImage = document.createElement('img');
    previewImage.src = item.imageDataUrl;
    previewImage.alt = '現在の画像';
    editImagePreview.appendChild(previewImage);
  }

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const relatedLinks = getRelatedLinkInputs(editRelatedLinksContainer);
    const { error } = await window.supabaseClient.from('memos').upsert(
      {
        id: memoId,
        title: editTitleInput.value.trim(),
        content: editContentInput.value.trim(),
        tags: parseTags(editTagsInput.value),
        link: getPrimaryMemoLink(relatedLinks),
        related_links: relatedLinks,
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

async function init() {
  const callbackResult = await window.supabaseHelpers.completeAuthFromUrl();
  if (callbackResult.error) {
    window.alert('ログイン処理に失敗しました: ' + callbackResult.error.message);
  }

  await renderMemoDetail();
}

void init();
