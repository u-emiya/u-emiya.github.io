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

  if (accessToken && refreshToken) {
    const { error } = await window.supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (!error) {
      const cleaned = `${url.pathname}${url.search}`;
      window.history.replaceState({}, document.title, cleaned);
    }

    return { handled: true, source: 'hash', error: error || null };
  }

  const code = url.searchParams.get('code');
  if (code) {
    const { error } = await window.supabaseClient.auth.exchangeCodeForSession(code);

    if (!error) {
      cleanupAuthUrlSearchParams(url.searchParams);
      const search = url.searchParams.toString();
      const cleaned = `${url.pathname}${search ? `?${search}` : ''}`;
      window.history.replaceState({}, document.title, cleaned);
    }

    return { handled: true, source: 'code', error: error || null };
  }

  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
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

    return { handled: true, source: 'token_hash', error: error || null };
  }

  return { handled: false, source: '', error: null };
}

function onAuthChange(handler) {
  if (!window.supabaseClient) return;
  window.supabaseClient.auth.onAuthStateChange((event, session) => handler(event, session));
}

async function getCurrentUser() {
  if (!window.supabaseClient) return null;
  const { data } = await window.supabaseClient.auth.getUser();
  return data?.user || null;
}

async function getAuthContext() {
  const user = await getCurrentUser();
  return {
    user,
    canWrite: isAdminEmail(user?.email)
  };
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
