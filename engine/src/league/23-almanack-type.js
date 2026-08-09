// ---- 23-almanack-type.js — the almanack voice --------------------------------
// The design pass that gives the game one typographic identity. Cricket's
// visual soul is the almanack: a literary serif speaking the headlines, small
// capitals working the labels, paper and ink underneath. Fraunces (variable,
// optical-size, self-hosted) becomes the display voice everywhere a page
// speaks its title; Oswald retreats to what it is actually good at - the
// scoreboard's letterspaced data labels; Inter keeps the interface; Georgia
// keeps the prose. One terracotta tick under every kicker signs the system.
(function () {
  "use strict";
  var D = "Fraunces,Georgia,serif";
  var CSS = [
    // == the wordmark: an italic serif signature in the navy masthead ==========
    "#topbar#topbar .brand{font:600 16px/1 " + D + " !important;letter-spacing:.01em}",
    // == page titles: serif, title case, ink ===================================
    // (each was Oswald all-caps; the serif speaks in sentence case)
    "html body #page .fo-mc-hero h1,html body #page .fo-sd-hero h1,html body #page .fo-hb-mast h1,html body #page .fo-tm-mast h1{font-family:" + D + " !important;font-weight:600;font-style:normal;text-transform:none !important;letter-spacing:-.015em !important;line-height:1.02;font-variation-settings:'opsz' 84}",
    "html body #page .fo-mc-hero h1{font-size:38px}",
    "html body #page .fo-sd-hero h1{font-size:40px}",
    "html body #page .fo-hb-mast h1{font-size:42px}",
    "html body #page .fo-tm-mast h1{font-size:36px}",
    "@media(max-width:640px){html body #page .fo-mc-hero h1{font-size:29px}html body #page .fo-sd-hero h1{font-size:30px}html body #page .fo-hb-mast h1{font-size:31px}html body #page .fo-tm-mast h1{font-size:28px}}",
    // titles that live on paintings keep white ink but take the serif voice
    "html body #page .fo-ns-h1{font-family:" + D + " !important;font-weight:600;font-style:normal;text-transform:none !important;letter-spacing:-.01em !important;line-height:1;font-variation-settings:'opsz' 110}",
    "html body #page .fo-desk-h1{font-family:" + D + " !important;font-weight:600;font-style:normal;text-transform:none !important;letter-spacing:-.01em !important;line-height:1;font-variation-settings:'opsz' 110}",
    // the club's name over its ground: an art-print signature
    "html body #page .fo-hg2 .hg-id b{font-family:" + D + " !important;font-style:normal;font-weight:620;text-transform:none !important;letter-spacing:-.015em !important;line-height:.98;font-variation-settings:'opsz' 120}",
    // the squad room's title over the park
    "html body #page .fo-sqx-hd h1{font-family:" + D + " !important;font-weight:600;font-style:normal;text-transform:none !important;letter-spacing:-.01em !important;font-variation-settings:'opsz' 110}",
    // the nation, city and cup heroes over their painted maps
    "html body #page .fo-nt-title,html body #page .fo-lx-title,html body #page .fo-ct-h1{font-family:" + D + " !important;font-weight:600;font-style:normal;text-transform:none !important;letter-spacing:-.015em !important;line-height:.95;font-variation-settings:'opsz' 120}",
    // the journal's front-page headline
    "html body #page .fo-mr-head{font-family:" + D + " !important;font-weight:560;text-transform:none !important;letter-spacing:-.02em !important;line-height:1.0;font-size:clamp(32px,5.6vw,72px);font-variation-settings:'opsz' 100}",
    // ceremony keeps its floodlit stage but the title turns serif
    "html body #page .fo-cer-h1{font-family:" + D + " !important;font-weight:600;font-style:normal;text-transform:none !important;letter-spacing:-.01em !important;font-variation-settings:'opsz' 110}",
    // == the signature tick: terracotta under every kicker =====================
    "html body #page .fo-mc-kick:after,html body #page .fo-sd-kick:after,html body #page .fo-hb-kick:after,html body #page .fo-tm-kick:after{content:'';display:block;width:34px;border-top:2px solid #C9571F;margin-top:7px}",
    // == numerals with a face: the money and the tallies =======================
    "html body #page .fo-led-stat b{font-family:" + D + " !important;font-weight:600;font-variation-settings:'opsz' 60;letter-spacing:-.01em}",
    "html body #page .fo-hb-tally b{font-family:" + D + ";font-weight:650}",
    "html body #page .fo-sd-tale span{font-variant-numeric:tabular-nums}",
    // == prose italics upgrade: the scout's and machine's voices ===============
    "html body #page .fo-sd-hero p,html body #page .fo-tm-mast p,html body #page .fo-mc-hero p,html body #page .fo-hb-mast p{font-family:" + D + " !important;font-style:normal;font-weight:420;font-size:13.5px;line-height:1.6;font-variation-settings:'opsz' 24}",
    "html body #page .fo-sd-say,html body #page .fo-hb-say,html body #page .fo-tm-fine{font-family:" + D + " !important;font-weight:420;font-variation-settings:'opsz' 20}"
  ].join("\n");

  function mount() {
    try {
      var s = document.getElementById("fo-alm-css");
      if (!s) { s = document.createElement("style"); s.id = "fo-alm-css"; s.textContent = CSS; }
      document.body.appendChild(s);
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);
  // stay last in the cascade even when other modules re-append their sheets
  window.addEventListener("hashchange", function () { setTimeout(mount, 200); });
  window.__foAlmanack = 1;
})();
