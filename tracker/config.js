// Supabase connection for the shift tracker.
// Both values are public by design (Supabase > Project Settings > API).
// The database rules in supabase/tracker-setup.sql are what keep the history private.
window.TRACKER_CONFIG = {
  supabaseUrl: 'https://ztlpgyomjuzmjmuifbbd.supabase.co',
  supabaseKey: 'sb_publishable_vxm-0NApjcfUkPhJ0XE8CQ_5hr3x9M-',
  // Backup names for /tracker, used only until the agents list (Team > Agents) has loaded once on a device.
  // Add and number agents on Team > Agents instead of here.
  teamNames: ['Abdullah Mega', 'Youssef Khfaga']
};
