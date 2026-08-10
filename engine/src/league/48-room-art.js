/* ============================================================================
   THE ROOMS GET THEIR LIGHT BACK (art pass).

   The painted rooms of this game - the desk, the honours board, the club home
   - all sit on a photograph of somewhere real: a clubroom, an office, the
   nets at dusk. The rooms built later were laid out on bare cream. On a full
   page nobody notices; on a short one - the time machine before you have
   played a match, the academy before you have signed in - you get a single
   card floating in an empty field, which reads as unfinished rather than
   quiet.

   This hangs the same paintings behind those rooms. One fixed backdrop per
   room, chosen to suit it, washed back under a cream veil so every word on
   top keeps its contrast, and swapped for the phone-cut art on a phone. It
   changes no room's markup: the backdrop is a sibling of #page and the rooms
   never know it is there.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foRoomArt) return; window.__foRoomArt = 1;

  function ART() { return (typeof FO_ART !== "undefined") ? FO_ART : "client/art/"; }
  // [phone cut, desktop cut] — the room's own weather.
  // EMPTY BY DECREE: every reading room now sits on the theme's plain cream -
  // the paintings live on at the club home and in the match theatre, where
  // they are the content rather than the wallpaper. The machinery stays so a
  // room can be given its light back with one line.
  var ROOM = {};

  // ---- the navy masthead ----------------------------------------------------
  // The rooms lost their paintings; this is what they wear instead. One shared
  // band in the broadcast language the cup boards and the fixture list set:
  // navy gradient, gold Oswald eyebrow, Fraunces headline, a breath of warm
  // light in the corner. Any page can put one on:
  //   <header class='fo-nvmast'><div class='k'>eyebrow</div><h1>Title</h1>
  //     <p>optional standfirst</p></header>
  var MAST_CSS = [
    "html body #page .fo-nvmast{position:relative;overflow:hidden;background:linear-gradient(132deg,#0B1D33,#122C4B 55%,#1B3A5F);border-radius:20px;padding:24px 26px 22px;margin:0 0 18px;box-shadow:0 18px 44px rgba(11,29,51,.3)}",
    "html body #page .fo-nvmast:before{content:'';position:absolute;inset:0;background:radial-gradient(120% 90% at 85% -10%,rgba(235,194,113,.14),transparent 55%);pointer-events:none}",
    "html body #page .fo-nvmast .k{position:relative;font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.26em;text-transform:uppercase;color:#E8B96A}",
    "html body #page .fo-nvmast h1{position:relative;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:clamp(28px,4.4vw,38px);letter-spacing:-.015em;margin:7px 0 0;color:#FFFEFC;line-height:1.04}",
    "html body #page .fo-nvmast p{position:relative;margin:9px 0 0;font:400 13px/1.55 Oswald,sans-serif;color:rgba(244,239,228,.72);max-width:58ch}",
    "html body #page .fo-nvmast p a{color:#E8B96A}"
  ].join("\n");
  function css() {
    if (document.getElementById("fo-roomart-css")) return;
    var s = document.createElement("style"); s.id = "fo-roomart-css";
    s.textContent = MAST_CSS + "\n" + [
      "#fo-roomart{position:fixed;inset:0;z-index:0;pointer-events:none;opacity:0;transition:opacity .5s ease}",
      "#fo-roomart.on{opacity:1}",
      "#fo-roomart i{position:absolute;inset:0;background-position:center;background-size:cover;filter:saturate(.82)}",
      // the veil: enough cream to keep body text at full contrast, thinner at
      // the foot so the painting is genuinely visible where the page runs out
      "#fo-roomart u{position:absolute;inset:0;background:linear-gradient(180deg,rgba(238,234,225,.93) 0%,rgba(238,234,225,.9) 42%,rgba(238,234,225,.78) 78%,rgba(238,234,225,.66) 100%)}",
      "body.fo-roomart-on #page{position:relative;z-index:1}",
      "@media(prefers-reduced-motion:reduce){#fo-roomart{transition:none}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function room() { return ((location.hash || "#/club").split("?")[0] || "").replace("#/", "") || "club"; }

  function paint() {
    try {
      css();
      var r = room(), art = ROOM[r];
      var el = document.getElementById("fo-roomart");
      if (!art) {
        if (el) { el.classList.remove("on"); el.__k = ""; }
        document.body.classList.remove("fo-roomart-on");
        return;
      }
      if (!el) {
        el = document.createElement("div"); el.id = "fo-roomart";
        el.innerHTML = "<i></i><u></u>";
        // behind the page, never over it
        document.body.insertBefore(el, document.body.firstChild);
      }
      var file = (window.innerWidth < 760 ? art[0] : art[1]);
      if (el.__k !== file) {
        el.__k = file;
        var src = ART() + "home/" + file + ".webp";
        // only reveal a painting that actually loaded: a missing file leaves
        // the room exactly as it was rather than flashing an empty box
        var probe = new Image();
        probe.onload = function () {
          try {
            el.querySelector("i").style.backgroundImage = "url('" + src + "')";
            el.classList.add("on");
            document.body.classList.add("fo-roomart-on");
          } catch (e) {}
        };
        probe.onerror = function () { el.classList.remove("on"); document.body.classList.remove("fo-roomart-on"); };
        probe.src = src;
      } else {
        el.classList.add("on");
        document.body.classList.add("fo-roomart-on");
      }
    } catch (e) {}
  }

  window.addEventListener("hashchange", function () { setTimeout(paint, 30); });
  window.addEventListener("resize", function () { setTimeout(paint, 200); });
  setTimeout(paint, 500);
  setTimeout(paint, 1600);
  try { setInterval(paint, 2500); } catch (e) {}
})();
