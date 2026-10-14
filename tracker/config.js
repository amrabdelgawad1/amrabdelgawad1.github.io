// Supabase connection for the shift tracker.
// Both values are public by design (Supabase > Project Settings > API).
// The database rules in supabase/tracker-setup.sql are what keep the history private.
window.TRACKER_CONFIG = {
  supabaseUrl: 'PASTE_PROJECT_URL_HERE',
  supabaseKey: 'PASTE_PUBLISHABLE_OR_ANON_KEY_HERE'
};
