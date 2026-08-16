// Supabase client initializer and helper functions
// Configure these constants with your Supabase project values
const SUPABASE_URL = 'https://vwwsrdblwjccijorqwip.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qxGC8zSyLSpVAbZpamv4Cw_goFvZ9xF';

// Allowlisted emails can write. All other visitors are read-only.
const ADMIN_EMAIL_ALLOWLIST = [
  'jacknocooking@gmail.com'
];

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase();
}

function recordAuthDebug(label, payload) {
  const entry = {
    ts: new Date().toISOString(),
    label,
    payload
  };

  try {
    const existing = JSON.parse(localStorage.getItem('supabase-auth-debug') || '[]');
    existing.push(entry);
    localStorage.setItem('supabase-auth-debug', JSON.stringify(existing.slice(-20)));
  } catch (error) {
    console.warn('[auth-debug] localStorage unavailable', error);
  }

  console.log('[auth-debug]', label, payload);
}

function isAdminEmail(email) {
  const normalized = normalizeEmail(email);
  return ADMIN_EMAIL_ALLOWLIST.map(normalizeEmail).includes(normalized);
}

// create client after the Supabase CDN script is loaded
function initSupabaseClient() {
  if (!window.supabase || window.supabaseClient) return;
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      // Use implicit flow for magic links so mobile mail app -> browser hops are less likely to fail.
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

async function signInWithEmail(email) {
  if (!window.supabaseClient) return { error: new Error('Supabase client not initialized') };
  const redirectTo = new URL('auth.html', window.location.href).toString();
  recordAuthDebug('signInWithEmail', { email, redirectTo, href: window.location.href });
  return window.supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo }
  });
}

async function signOut() {
  if (!window.supabaseClient) return;
  return window.supabaseClient.auth.signOut();
}

function cleanupAuthUrlSearchParams(searchParams) {
  const removableParams = [
    'code',
    'type',
    'token_hash',
    'error',
    'error_code',
    'error_description'
  ];

  removableParams.forEach((key) => {
    searchParams.delete(key);
  });
}

async function completeAuthFromUrl() {
  if (!window.supabaseClient) {
    return { handled: false, source: '', error: null };
  }

  const url = new URL(window.location.href);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : '';
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');

  recordAuthDebug('completeAuthFromUrl:start', {
    href: window.location.href,
    hash: hash || null,
    accessToken: !!accessToken,
    refreshToken: !!refreshToken,
    code: !!code,
    tokenHash: !!tokenHash,
    type: type || null
  });

  if (accessToken && refreshToken) {
    const { error } = await window.supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (!error) {
      const cleaned = `${url.pathname}${url.search}`;
      window.history.replaceState({}, document.title, cleaned);
    }

    recordAuthDebug('completeAuthFromUrl:hash', { error: error ? error.message : null });
    return { handled: true, source: 'hash', error: error || null };
  }

  if (code) {
    const { error } = await window.supabaseClient.auth.exchangeCodeForSession(code);

    if (!error) {
      cleanupAuthUrlSearchParams(url.searchParams);
      const search = url.searchParams.toString();
      const cleaned = `${url.pathname}${search ? `?${search}` : ''}`;
      window.history.replaceState({}, document.title, cleaned);
    }

    recordAuthDebug('completeAuthFromUrl:code', { error: error ? error.message : null });
    return { handled: true, source: 'code', error: error || null };
  }

  if (tokenHash && type) {
    const { error } = await window.supabaseClient.auth.verifyOtp({
      token_hash: tokenHash,
      type
    });

    if (!error) {
      cleanupAuthUrlSearchParams(url.searchParams);
      const search = url.searchParams.toString();
      const cleaned = `${url.pathname}${search ? `?${search}` : ''}`;
      window.history.replaceState({}, document.title, cleaned);
    }

    recordAuthDebug('completeAuthFromUrl:token_hash', { type, error: error ? error.message : null });
    return { handled: true, source: 'token_hash', error: error || null };
  }

  recordAuthDebug('completeAuthFromUrl:none', { href: window.location.href });
  return { handled: false, source: '', error: null };
}

function onAuthChange(handler) {
  if (!window.supabaseClient) return;
  window.supabaseClient.auth.onAuthStateChange((event, session) => handler(event, session));
}

async function getCurrentUser() {
  if (!window.supabaseClient) return null;

  try {
    const { data, error } = await window.supabaseClient.auth.getUser();
    if (error) {
      recordAuthDebug('getCurrentUser:error', { message: error.message, code: error.code });
      return null;
    }

    recordAuthDebug('getCurrentUser:ok', { email: data?.user?.email || null });
    return data?.user || null;
  } catch (error) {
    recordAuthDebug('getCurrentUser:exception', { message: error?.message || String(error) });
    return null;
  }
}

async function getAuthContext() {
  const user = await getCurrentUser();
  const result = {
    user,
    canWrite: isAdminEmail(user?.email)
  };
  recordAuthDebug('getAuthContext', { email: user?.email || null, canWrite: result.canWrite });
  return result;
}

window.initSupabaseClient = initSupabaseClient;
window.supabaseHelpers = {
  signInWithEmail,
  signOut,
  completeAuthFromUrl,
  onAuthChange,
  getCurrentUser,
  getAuthContext,
  isAdminEmail,
  ADMIN_EMAIL_ALLOWLIST
};
