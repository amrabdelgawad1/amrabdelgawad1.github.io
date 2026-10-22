// Hero availability line: adds "Online now" and a green dot during Amr's hours (8 AM to 9 PM New York time)
(function(){
  var box = document.querySelector('[data-work-clock]'); if (!box) return;
  var now = box.querySelector('[data-wc-now]'), START = 8, END = 21;
  function draw(){
    var h = Number(new Intl.DateTimeFormat('en-US', { timeZone:'America/New_York', hour:'numeric', hourCycle:'h23' }).format(new Date())) % 24;
    var on = h >= START && h < END;
    box.classList.toggle('is-off', !on);
    if (now) now.hidden = !on;
  }
  try { draw(); setInterval(draw, 60000); } catch (e) {}
})();
