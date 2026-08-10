// ---- 63-mobile-triage.js — FEWER SECTIONS ON A PHONE ------------------------
// A phone page that collapses columns but keeps every section is a scroll of
// thirty screens - the Book of the League measured 29.6 of them, the
// Almanack 8.5. On phones the long tails now fold behind one honest row:
// the section's own name and "View all". Nothing is removed and desktop
// never changes; the fold is a reading decision, not an edit.
//
// The rules are per page and deliberate, not generic magic:
//   #/lore      the cover and the first legend stand; the other eleven fold
//               behind one row.
//   #/almanack  the records and the season's leaders stand; each all-time
//               book after them folds behind its own name.
(function () {
  "use strict";
  if (window.__foTriage) return; window.__foTriage = 1;

  function mobile() { return (window.innerWidth || 1024) <= 760; }
  function css() {
    if (document.getElementById("fo-tri-css")) return;
    var s = document.createElement("style"); s.id = "fo-tri-css";
    s.textContent = [
      ".fo-tri-hide{display:none !important}",
      "html body #page button.fo-tri-btn{display:flex;align-items:center;gap:10px;width:100%;min-height:52px;margin:10px 0;padding:12px 16px !important;border-radius:13px !important;background:#FFFEFC !important;border:1px solid rgba(27,36,50,.14) !important;box-shadow:0 1px 3px rgba(14,35,63,.05) !important;cursor:pointer;text-align:left}",
      "html body #page button.fo-tri-btn b{flex:1;min-width:0;font:700 13px/1.3 Oswald,sans-serif;letter-spacing:.01em;color:#14243A;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      "html body #page button.fo-tri-btn span{font:700 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#B44A22}",
      "html body #page button.fo-tri-btn s{text-decoration:none;font:400 19px/1 Fraunces,Georgia,serif;color:#B44A22}",
      "html body #page button.fo-tri-btn.dark{background:rgba(255,253,247,.06) !important;border-color:rgba(232,185,106,.35) !important;box-shadow:none !important}",
      "html body #page button.fo-tri-btn.dark b{color:#F1EEE6}",
      "html body #page button.fo-tri-btn.dark span,html body #page button.fo-tri-btn.dark s{color:#E8B96A}"
    ].join("\n");
    document.head.appendChild(s);
  }
  // fold a run of sections behind one row; opening is remembered on the
  // elements themselves so a repaint cannot slam the book shut mid-read
  function fold(els, label, dark) {
    els = els.filter(function (el) { return el && !el.hasAttribute("data-tri-open") && !el.classList.contains("fo-tri-hide"); });
    if (!els.length) return;
    var prev = els[0].previousElementSibling;
    if (prev && prev.classList && prev.classList.contains("fo-tri-btn")) return;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fo-tri-btn" + (dark ? " dark" : "");
    btn.innerHTML = "<b></b><span>View all</span><s>&rsaquo;</s>";
    btn.querySelector("b").textContent = label;
    els[0].parentNode.insertBefore(btn, els[0]);
    els.forEach(function (el) { el.classList.add("fo-tri-hide"); });
    btn.addEventListener("click", function () {
      els.forEach(function (el) { el.classList.remove("fo-tri-hide"); el.setAttribute("data-tri-open", "1"); });
      btn.remove();
    });
  }
  function run() {
    try {
      var page = document.getElementById("page"); if (!page) return;
      css();
      var h = (location.hash || "").split("?")[0];
      // the Book of the League is 18 screens on a desk without the fold -
      // the reading decision applies at every width; the almanack keeps its
      // fold to phones where the squeeze is real
      if (h === "#/lore") {
        var feats = [].slice.call(page.querySelectorAll(".fo-lx-feat"));
        if (feats.length > 2) {
          var rest = feats.slice(1);
          if (!rest.some(function (el) { return el.hasAttribute("data-tri-open"); }))
            fold(rest, "The other " + rest.length + " legends", true);
        }
      } else if (h === "#/almanack") {
        if (!mobile()) return;
        [].slice.call(page.querySelectorAll(".fo-al-sec")).slice(2).forEach(function (sec) {
          var head = sec.querySelector("h2,h3");
          fold([sec], head ? head.textContent.trim() : "More of the record", false);
        });
      }
    } catch (e) {}
  }
  var t = null;
  function later() { clearTimeout(t); t = setTimeout(run, 140); }
  function boot() {
    var p = document.getElementById("page");
    if (!p) { setTimeout(boot, 400); return; }
    try { new MutationObserver(later).observe(p, { childList: true }); } catch (e) {}
    run();
    // a page that renders after every timer has fired still gets its fold:
    // run() is idempotent, so a slow heartbeat costs nothing and ends the
    // race between the router, the world derivation and the observer
    setInterval(run, 1500);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  window.addEventListener("hashchange", function () { setTimeout(run, 300); });
})();
