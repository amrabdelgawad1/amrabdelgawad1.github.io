// Newsletter sign-up on the homepage: posts the email to the Zoho Campaigns form in the background,
// so the visitor stays on the page. Zoho then emails them a link to confirm (double opt-in).
(function () {
  "use strict";
  var form = document.querySelector("[data-newsletter]");
  if (!form) return;
  var status = form.querySelector("[data-newsletter-status]");
  var button = form.querySelector("button[type=submit]");
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function say(text, kind) {
    status.textContent = text;
    status.className = "newsletter-status" + (kind ? " is-" + kind : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = form.elements.CONTACT_EMAIL.value.trim();
    if (!EMAIL_RE.test(email)) { say("Please enter a valid email address.", "error"); return; }
    button.disabled = true;
    say("Signing you up...");
    // Zoho doesn't allow reading its reply from another site, so a sent request counts as done
    fetch(form.action, { method: "POST", mode: "no-cors", body: new URLSearchParams(new FormData(form)) })
      .then(function () {
        say("Almost done. Check your inbox and click the link to confirm.", "done");
        form.elements.CONTACT_EMAIL.value = "";
        if (window.countEvent) window.countEvent("newsletter-signup", "Newsletter sign-up");
      })
      .catch(function () { say("That didn't go through. Please try again in a moment.", "error"); })
      .then(function () { button.disabled = false; });
  });
})();
