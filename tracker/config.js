// Supabase connection for the shift tracker.
// Both values are public by design (Supabase > Project Settings > API).
// The database rules in supabase/tracker-setup.sql are what keep the history private.
window.TRACKER_CONFIG = {
  supabaseUrl: 'https://ztlpgyomjuzmjmuifbbd.supabase.co',
  supabaseKey: 'sb_publishable_vxm-0NApjcfUkPhJ0XE8CQ_5hr3x9M-',
  // Names offered on /tracker. Spell them exactly as on past shifts so the hours add up under one name.
  // Anyone not listed picks "Someone else" and types their name.
  teamNames: ['Abdullah Mega', 'Youssef Khfaga']
};
