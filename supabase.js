// Supabase client initializer and helper functions
// Configure these constants with your Supabase project values
const SUPABASE_URL = 'https://vwwsrdblwjccijorqwip.supabase.co/rest/v1/';
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
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function signInWithEmail(email) {
  if (!window.supabaseClient) return { error: new Error('Supabase client not initialized') };
  return window.supabaseClient.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href }
  });
}

async function signOut() {
  if (!window.supabaseClient) return;
  return window.supabaseClient.auth.signOut();
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
  onAuthChange,
  getCurrentUser,
  getAuthContext,
  isAdminEmail,
  ADMIN_EMAIL_ALLOWLIST
};
