// Supabase connection for the shift tracker.
// Both values are public by design (Supabase > Project Settings > API).
// The database rules in supabase/tracker-setup.sql are what keep the history private.
// "Keep me signed in" was turned off (app/app.js): once the browser has been closed (its talents-alive
// cookie is gone), forget the saved sign-in before any page on the site reads it.
(function(){
  try {
    if (localStorage.getItem('talents-keep') === '0' && !/(^|;\s*)talents-alive=1/.test(document.cookie))
      Object.keys(localStorage).forEach(k => { if (/^sb-.+-auth-token/.test(k)) localStorage.removeItem(k); });
  } catch(e) {}
})();
window.TRACKER_CONFIG = {
  supabaseUrl: 'https://vepqjjophogryvbkfgcu.supabase.co',
  supabaseKey: 'sb_publishable_mYIQ65Im6_0A8MVTZZevLQ_sxbCJH4u',
  // Backup names for /tracker, used only until the agents list (Team > Agents) has loaded once on a device.
  // Add and number agents on Team > Agents instead of here.
  teamNames: ['Abdullah Mega', 'Youssef Khfaga']
};
