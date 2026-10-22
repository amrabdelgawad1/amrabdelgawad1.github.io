// "Book a Call" on the Working Together cards and the team band: notes the choice in the booking form's topic box
(function(){
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('[data-plan]'); if (!a) return;
    var topic = document.querySelector('[data-booking-form] textarea[name="topic"]');
    if (topic && !topic.value.trim()) topic.value = 'Interested in: ' + a.getAttribute('data-plan');
  });
})();
