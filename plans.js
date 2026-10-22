// "Book a Call" on the Working Together cards and the team band: notes the choice in the booking form's topic box
(function(){
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('[data-plan]'); if (!a) return;
    var topic = document.querySelector('[data-booking-form] textarea[name="topic"]');
    if (topic && !topic.value.trim()) topic.value = 'Interested in: ' + a.getAttribute('data-plan');
  });
})();

// Back from "Pick another time" in a booking email: the old call is already freed
(function(){
  if (!/[?&]rebook=1/.test(location.search)) return;
  var card = document.querySelector('#lets-talk .booking-card'); if (!card) return;
  var n = document.createElement('p'); n.className = 'rebook-note';
  n.textContent = 'Your previous time is freed. Pick a new time below.';
  card.parentNode.insertBefore(n, card);
})();
