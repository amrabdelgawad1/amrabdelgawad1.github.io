// Back from Polar checkout with ?checkout_id=…: show the thank-you note at the top
(function(){
  if (!/[?&]checkout_id=/.test(location.search)) return;
  var box = document.getElementById('pbThanks'); if (!box) return;
  box.hidden = false;
  box.focus();
})();
