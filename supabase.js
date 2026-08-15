// Supabase client initializer and helper functions
// Configure these constants with your Supabase project values
const SUPABASE_URL = 'https://vwwsrdblwjccijorqwip.supabase.co/rest/v1/';
const SUPABASE_ANON_KEY = 'sb_publishable_qxGC8zSyLSpVAbZpamv4Cw_goFvZ9xF';

// create client after the Supabase CDN script is loaded
function initSupabaseClient() {
  if (!window.supabase || window.supabaseClient) return;
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function signInWithEmail(email) {
  if (!window.supabaseClient) return { error: new Error('Supabase client not initialized') };
  return window.supabaseClient.auth.signInWithOtp({ email });
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

// Export simple helpers to window for easy use in pages
window.initSupabaseClient = initSupabaseClient;
window.supabaseHelpers = { signInWithEmail, signOut, onAuthChange, getCurrentUser };
