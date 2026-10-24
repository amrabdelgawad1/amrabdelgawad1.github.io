// Gold line art behind the black top band in /app (the same drawing as the Deal Tools page).
(function(){
  function draw(cv){
    var r = cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    if (!r.width) return;
    cv.width = r.width * d; cv.height = r.height * d;
    var c = cv.getContext('2d'); c.scale(d, d);
    c.strokeStyle = 'rgba(201,169,110,.5)'; c.lineWidth = .6;
    // rings centred off the right edge, so only their curves cross the band
    var cx = r.width - Math.min(150, r.width * .18), cy = r.height * .5, R = Math.max(150, r.height * 2.4);
    for (var k = 0; k < 16; k++){
      c.beginPath();
      var base = R * (.45 + k * .55 / 16), amp = R * .08, ph = k * .35;
      for (var t = 0; t <= Math.PI * 2 + .01; t += .01){
        var rr = base + amp * Math.sin(7 * t + ph) + amp * .18 * Math.sin(22 * t);
        var x = cx + rr * Math.cos(t), y = cy + rr * Math.sin(t) * .8;
        t ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
  }
  function all(){ document.querySelectorAll('.top .hub-art').forEach(draw); }
  document.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.top').forEach(function(top){
      var cv = document.createElement('canvas'); cv.className = 'hub-art'; cv.setAttribute('aria-hidden', 'true');
      top.prepend(cv);
    });
    all();
    // the band is hidden until sign-in, so draw again once it has a size
    if (window.ResizeObserver) { var ro = new ResizeObserver(all); document.querySelectorAll('.top').forEach(function(t){ ro.observe(t); }); }
    else { var tm; window.addEventListener('resize', function(){ clearTimeout(tm); tm = setTimeout(all, 150); }); }
  });
})();
