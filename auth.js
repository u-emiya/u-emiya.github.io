const loginBtn = document.getElementById('supabase-login');
const logoutBtn = document.getElementById('supabase-logout');
const emailInput = document.getElementById('supabase-email');
const statusEl = document.getElementById('supabase-status');

const authState = {
  userEmail: '',
  canWrite: false
};

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

      const { error } = await window.supabaseHelpers.signInWithEmail(email);
      if (error) {
        window.alert('マジックリンク送信失敗: ' + error.message);
        return;
      }

      window.alert('マジックリンクを送信しました。メール内リンクを開いてください。');
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
  setupAuthPage();
  await refreshAuthContext();
}

void init();