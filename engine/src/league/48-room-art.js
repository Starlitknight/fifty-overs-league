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
  // [phone cut, desktop cut] — the room's own weather
  var ROOM = {
    whatif:     ["hgm-nostalgic", "hgd-clubroom"],
    academy:    ["hgm-nets-day", "hgd-nets-day"],
    training:   ["hgm-nets-day", "hgd-nets-day"],
    finance:    ["hgm-office", "hgd-office"],
    ledger:     ["hgm-office", "hgd-office"],
    comps:      ["hgm-blue-hour", "hgd-heart-of-club"],
    nations:    ["hgm-arch-dawn", "hgd-veranda-rain"],
    natteams:   ["hgm-arch-dawn", "hgd-veranda-rain"],
    worldclub:  ["hgm-clubroom", "hgd-clubroom"],
    market:     ["hgm-late-afternoon", "hgd-workshop"],
    rankings:   ["hgm-late-afternoon", "hgd-heart-of-club"],
    records:    ["hgm-clubroom", "hgd-clubroom"],
    milestones: ["hgm-clubroom", "hgd-heart-of-club"],
    fixtures:   ["hgm-sunlit-day", "hgd-veranda-rain"],
    team:       ["hgm-late-afternoon", "hgd-heart-of-club"],
    guide:      ["hgm-clubroom", "hgd-workshop"]
  };

  function css() {
    if (document.getElementById("fo-roomart-css")) return;
    var s = document.createElement("style"); s.id = "fo-roomart-css";
    s.textContent = [
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
      // The Almanack's screens are paper, not rooms. They state their artwork
      // as a plate at full brightness; a veiled painting behind the text is
      // the language they replaced, and it showed through their backgrounds.
      try {
        if (window.__foAlOwns && window.__foAlOwns()) {
          var off = document.getElementById("fo-roomart");
          if (off) { off.classList.remove("on"); off.__k = ""; }
          document.body.classList.remove("fo-roomart-on");
          return;
        }
      } catch (eAl) {}
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
