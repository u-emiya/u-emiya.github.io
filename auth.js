const loginBtn = document.getElementById('supabase-login');
const logoutBtn = document.getElementById('supabase-logout');
const emailInput = document.getElementById('supabase-email');
const statusEl = document.getElementById('supabase-status');

const authState = {
  userEmail: '',
  canWrite: false,
  isSubmittingMagicLink: false,
  magicLinkCooldownUntil: 0
};

function setMagicLinkButtonState() {
  if (!loginBtn) return;

  const remainingMs = Math.max(0, authState.magicLinkCooldownUntil - Date.now());
  const isCoolingDown = remainingMs > 0;

  loginBtn.disabled = authState.isSubmittingMagicLink || isCoolingDown;
  if (isCoolingDown) {
    const remainingSeconds = Math.ceil(remainingMs / 1000);
    loginBtn.textContent = `送信中です (${remainingSeconds}秒待ち)`;
    return;
  }

  loginBtn.textContent = 'ログイン';
}

function updateAuthUi() {
  if (statusEl) {
    if (authState.userEmail) {
      statusEl.textContent = authState.canWrite
        ? `管理者ログイン中: ${authState.userEmail}`
        : `閲覧ログイン中: ${authState.userEmail}`;
    } else {
      statusEl.textContent = '未ログイン（閲覧は可能）';
    }
  }

  if (loginBtn && logoutBtn) {
    if (authState.userEmail) {
      loginBtn.style.display = 'none';
      logoutBtn.style.display = '';
    } else {
      loginBtn.style.display = '';
      logoutBtn.style.display = 'none';
    }
  }
}

async function refreshAuthContext() {
  const authContext = await window.supabaseHelpers.getAuthContext();
  authState.userEmail = authContext.user?.email || '';
  authState.canWrite = authContext.canWrite;
  updateAuthUi();
}

function setupAuthPage() {
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      if (!email) {
        window.alert('メールアドレスを入力してください。');
        return;
      }

      if (authState.isSubmittingMagicLink) {
        return;
      }

      const remainingMs = Math.max(0, authState.magicLinkCooldownUntil - Date.now());
      if (remainingMs > 0) {
        const remainingSeconds = Math.ceil(remainingMs / 1000);
        window.alert(`メール送信は制限中です。${remainingSeconds}秒後に再試行してください。`);
        return;
      }

      authState.isSubmittingMagicLink = true;
      setMagicLinkButtonState();

      try {
        const { error } = await window.supabaseHelpers.signInWithEmail(email);
        if (error) {
          const message = error.message || '不明なエラー';
          if (message.includes('rate limit exceeded') || message.toLowerCase().includes('rate limit')) {
            authState.magicLinkCooldownUntil = Date.now() + 5 * 60 * 1000;
            window.alert('短時間にメール送信が多すぎたため、5分間は再送できません。少し待ってから再度お試しください。');
          } else {
            window.alert('マジックリンク送信失敗: ' + message);
          }
          return;
        }

        authState.magicLinkCooldownUntil = Date.now() + 60 * 1000;
        window.alert('マジックリンクを送信しました。メール内リンクを開いてください。');
      } finally {
        authState.isSubmittingMagicLink = false;
        setMagicLinkButtonState();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await window.supabaseHelpers.signOut();
      await refreshAuthContext();
    });
  }

  window.supabaseHelpers.onAuthChange(async () => {
    await refreshAuthContext();
  });
}

async function init() {
  const callbackResult = await window.supabaseHelpers.completeAuthFromUrl();
  if (callbackResult.error) {
    window.alert('ログイン処理に失敗しました: ' + callbackResult.error.message);
  }

  setupAuthPage();
  await refreshAuthContext();
}

void init();