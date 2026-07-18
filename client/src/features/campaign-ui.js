/* features/campaign-ui — THE FIRST SUMMER hub (#/summer).
 *
 * One screen: the episode rail across the top, and below it exactly one
 * thing to do — the current scene (with its choices), the next tie, or the
 * walk-out. A returning manager always lands on a short "where we are"
 * strip with a direct Continue; no re-reading, no hunting.
 */
FOC.campaignUI = (function () {
  var U = FOC.util, G = FOC.game, A = FOC.adapter;
  function esc(s) { return U.esc(s); }
  function art() { try { return (window.__foGame && window.__foGame.art) || "client/art/"; } catch (e) { return "client/art/"; } }

  function faceImg(face, sp) {
    if (!face) face = "gaffer";
    if (face.indexOf("npc:") === 0) {
      var mono = face.split(":")[1] || "?";
      return "<span class='sm-mono' aria-hidden='true'>" + esc(mono) + "</span>";
    }
    if (face.indexOf("player:") === 0) return "<img class='sm-face' src='" + art() + (face.split(":")[1] || "bat") + ".png' alt=''>";
    return "<img class='sm-face' src='" + art() + face + ".png' alt=''>";
  }

  function sceneHTML(b, isInter) {
    var h = "<div class='sm-scene'>" + faceImg(b.face, b.sp) +
      "<div class='sm-bx'><div class='sm-sp'>" + esc(b.sp) + "</div><div class='sm-tx'>" + esc(b.tx) + "</div>";
    if (b.choices) {
      h += "<div class='sm-choices'>" + b.choices.map(function (c, i) {
        return "<button class='sm-ch' data-i='" + i + "' data-inter='" + (isInter ? 1 : 0) + "'>" + esc(c.t) + "</button>";
      }).join("") + "</div>";
    } else {
      h += "<div class='sm-choices'><button class='sm-ch sm-cont' data-inter='" + (isInter ? 1 : 0) + "'>Continue ▸</button></div>";
    }
    return h + "</div></div>";
  }

  function matchHTML(s) {
    var c = G.chapter(s), o = c.opp;
    var live = false, saved = false;
    try {
      live = !!(App.pending && App.pending.__camp);
      saved = !!(App.orders && App.orders.saved);
    } catch (e) {}
    var rem = s.losses[c.key] ? "<div class='sm-rem'>Attempt " + (s.losses[c.key] + 1) + " — the fixture stands.</div>" : "";
    var h = "<div class='sm-tie'><div class='sm-tie-k'>The tie</div>" +
      "<div class='sm-tie-nm'>" + esc(o.nm) + "</div>" +
      "<div class='sm-tie-c'>" + esc(o.ground) + " · " + esc(o.pitch) + " pitch · " + esc(o.wx) + "</div>" + rem;
    if (live && saved) h += "<button class='sm-go' id='sm-walk'>Walk out ▸</button>";
    else if (live) h += "<button class='sm-go' id='sm-lineup'>Pick your XI ▸</button>";
    else h += "<button class='sm-go' id='sm-play'>Take the fixture ▸</button>";
    return h + "</div>";
  }

  function railHTML(s) {
    return "<div class='sm-rail' role='list'>" + G.list(s).map(function (c) {
      var cls = "sm-ep " + c.state;
      var res = c.result ? "<span class='r " + (c.result.win ? "w" : "l") + "'>" + (c.result.win ? "W" : "L") + " " + c.result.my + "–" + c.result.op + "</span>" : "";
      return "<div role='listitem' class='" + cls + "' title='" + esc(c.title) + "'><span class='n'>" + (c.i === 0 ? "P" : c.i) + "</span><span class='t'>" + esc(c.tag) + "</span>" + res + "</div>";
    }).join("") + "</div>";
  }

  function statusHTML(s) {
    var ph = s.philosophy ? "<span class='sm-chip'>" + esc(s.philosophy.label) + "</span>" : "";
    var proms = s.promises.filter(function (p) { return p.status === "active"; }).length;
    var pc = proms ? "<span class='sm-chip gold'>" + proms + " live promise" + (proms > 1 ? "s" : "") + "</span>" : "";
    return "<div class='sm-status'>" + ph + pc +
      "<span class='sm-chip dim'>" + s.matches.length + " match" + (s.matches.length === 1 ? "" : "es") + " played</span>" +
      "<button class='sm-reset' id='sm-reset'>Reset campaign</button></div>";
  }

  function doneHTML(s) {
    var h = "<div class='sm-done'><div class='sm-tie-k'>The record — permanent</div>";
    h += "<div class='sm-tie-nm'>" + (s.flags.crownWon ? "The Crown Ground, taken." : "The First Summer") + "</div>";
    if (s.epilogue) h += "<div class='sm-tie-c'>First final: " + esc(s.epilogue.first) + " · attempts: " + s.epilogue.attempts + "</div>";
    h += "<div class='sm-hist'>" + s.matches.map(function (m) {
      return "<div class='sm-hrow'><span class='" + (m.win ? "w" : "l") + "'>" + (m.win ? "W" : "L") + "</span> " +
        esc(m.opp) + " " + m.my + "–" + m.op +
        (m.facts.topNm ? " · " + esc(m.facts.topNm) + " " + m.facts.topR : "") + "</div>";
    }).join("") + "</div>";
    h += "<a class='sm-go' href='#/circuit' style='text-decoration:none;display:inline-block'>The Circuit map ▸</a></div>";
    return h;
  }

  var lastSig = null;
  function render(force) {
    try {
      if (location.hash.indexOf("#/summer") !== 0) return;
      if (!A.engineReady()) return;
      // once the prologue hands over, the persistent career owns this screen
      try { if (FOC.career && FOC.career.active()) return; } catch (eCr) {}
      var page = document.getElementById("page"); if (!page) return;
      var s = G.save();
      var inter = G.interstitial(s);
      var beat = inter || G.currentBeat(s);
      var sig = JSON.stringify([s.ch, s.beat, s.status, (s.flags.inter || []).length, !!inter, !!s.flags.trialPending,
        s.matches.length, (function () { try { return !!(App.pending && App.pending.__camp) && !!(App.orders && App.orders.saved); } catch (e) { return 0; } })()]);
      if (!force && page.__smSig === sig && page.querySelector(".fo-sm")) return;
      page.__smSig = sig;

      var h = "<div class='fo-sm'>";
      h += "<div class='sm-head'><div class='sm-kick'>England · Solo Campaign</div><h2 class='sm-h1'>The First Summer</h2></div>";
      h += railHTML(s);
      h += statusHTML(s);
      if (s.status === "complete" && !beat) h += doneHTML(s);
      else if (inter) h += sceneHTML(inter, true);
      else if (s.flags.trialPending) {
        var liveT = false, savedT = false;
        try { liveT = !!(App.pending && App.pending.__camp); savedT = !!(App.orders && App.orders.saved); } catch (eT) {}
        h += "<div class='sm-where'>Prologue · The Trial</div>" +
          "<div class='sm-tie'><div class='sm-tie-k'>Optional trial</div>" +
          "<div class='sm-tie-nm'>Club Trial XI</div>" +
          "<div class='sm-tie-c'>Your ground · a real match, a real scorecard — evidence before Saturday</div>" +
          (liveT && savedT ? "<button class='sm-go' id='sm-walk'>Walk out ▸</button>"
            : liveT ? "<button class='sm-go' id='sm-lineup'>Pick your XI ▸</button>"
            : "<button class='sm-go' id='sm-trial'>Raise the Trial XI ▸</button>" +
              "<div><button class='sm-skip' id='sm-trial-skip'>Skip the trial — on to Willowmere</button></div>") +
          "</div>";
      }
      else if (beat && beat.kind === "scene") {
        var c0 = G.chapter(s);
        h += "<div class='sm-where'>" + esc(s.ch >= 11 ? "Epilogue" : (c0 ? c0.title : "")) + (c0 && c0.tag && s.ch < 11 ? " · " + esc(c0.tag) : "") + "</div>";
        h += sceneHTML(beat, false);
      } else if (beat && beat.kind === "match") {
        var c1 = G.chapter(s);
        h += "<div class='sm-where'>" + esc(c1.title) + " · " + esc(c1.tag) + "</div>";
        h += matchHTML(s);
      } else h += doneHTML(s);
      h += "</div>";
      page.innerHTML = h;
      wire(page, s);
    } catch (e) {}
  }

  function wire(page, s) {
    page.querySelectorAll(".sm-ch").forEach(function (b) {
      b.addEventListener("click", function () {
        var isInter = b.getAttribute("data-inter") === "1";
        if (isInter) {
          var inter = G.interstitial(s);
          var i = +(b.getAttribute("data-i") || -1);
          if (inter && inter.choices && inter.choices[i]) { try { inter.choices[i].fx(G.makeCtx(s)); } catch (e) {} }
          G.popInterstitial(s);
        } else {
          var i2 = +(b.getAttribute("data-i") || -1);
          if (i2 >= 0) G.choose(s, i2); else G.advance(s);
        }
        render(true);
      });
    });
    var pl = page.querySelector("#sm-play");
    if (pl) pl.addEventListener("click", function () {
      if (!G.playMatch(s)) { /* a live match blocks the fixture */ }
    });
    var tr = page.querySelector("#sm-trial");
    if (tr) tr.addEventListener("click", function () { G.playTrial(s); });
    var trs = page.querySelector("#sm-trial-skip");
    if (trs) trs.addEventListener("click", function () { delete s.flags.trialPending; G.persist(); render(true); });
    var lu = page.querySelector("#sm-lineup");
    if (lu) lu.addEventListener("click", function () { location.hash = "#/lineup"; if (typeof window.route === "function") window.route(); });
    var wk = page.querySelector("#sm-walk");
    if (wk) wk.addEventListener("click", function () { location.hash = "#/match"; if (typeof window.route === "function") window.route(); });
    var rs = page.querySelector("#sm-reset");
    if (rs) rs.addEventListener("click", function () {
      if (!window.confirm("Reset The First Summer? Your current campaign is archived (not deleted) and a fresh one begins.")) return;
      FOC.save.reset(s.scope);
      G._resetForTest();
      render(true);
    });
  }

  function injectNav() {
    try {
      var ex = document.querySelector("a.fo-summer"); if (ex) return;
      var cx = document.querySelector("a.fo-circuit"); if (!cx || !cx.parentNode) return;
      var a = document.createElement("a");
      a.className = cx.className.replace("fo-circuit", "fo-summer");
      a.href = "#/summer"; a.textContent = "The First Summer";
      a.addEventListener("click", function (e) { e.preventDefault(); location.hash = "#/summer"; if (typeof window.route === "function") window.route(); });
      cx.parentNode.insertBefore(a, cx);
    } catch (e) {}
  }

  function css() {
    if (document.getElementById("fo-sm-css")) return;
    var st = document.createElement("style"); st.id = "fo-sm-css";
    st.textContent =
      ".fo-sm{max-width:760px;margin:0 auto;padding:4px 2px 40px}" +
      ".sm-kick{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#C9A24B}" +
      ".sm-h1{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:2.2px;font-size:clamp(24px,5vw,34px);color:#101B2D;margin:2px 0 8px}" +
      ".sm-rail{display:flex;gap:5px;overflow-x:auto;padding:4px 0 8px;-webkit-overflow-scrolling:touch}" +
      ".sm-ep{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:52px;border:1px solid #e3dcc6;border-radius:9px;padding:5px 6px;background:#FDFBF4}" +
      ".sm-ep.done{border-color:#4E7A4E;background:#EFF5EC}.sm-ep.now{border-color:#C8674A;box-shadow:0 0 0 1px #C8674A}" +
      ".sm-ep.locked{opacity:.45}" +
      ".sm-ep .n{font-family:Oswald,sans-serif;font-size:13px;color:#101B2D}" +
      ".sm-ep .t{font-size:8.5px;letter-spacing:.4px;text-transform:uppercase;color:#8a90a0;white-space:nowrap}" +
      ".sm-ep .r{font-size:9px;font-weight:700}.sm-ep .r.w{color:#2E7A3C}.sm-ep .r.l{color:#9c2f18}" +
      ".sm-status{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:4px 0 12px}" +
      ".sm-chip{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:1.2px;text-transform:uppercase;background:#14213D;color:#F1EADA;border-radius:99px;padding:4px 10px}" +
      ".sm-chip.gold{background:#B08D2E}.sm-chip.dim{background:#EDE6D2;color:#5b6472}" +
      "html body #page .sm-reset{margin-left:auto;border:1px solid #d8d0b8;background:transparent;border-radius:99px;padding:4px 10px;font-size:10px;color:#8a90a0}" +
      ".sm-where{font-family:Oswald,sans-serif;font-size:12px;letter-spacing:1.8px;text-transform:uppercase;color:#8a90a0;margin:8px 0 6px}" +
      ".sm-scene{display:flex;gap:10px;align-items:flex-start;background:#FDFBF4;border:1px solid #e3dcc6;border-radius:14px;padding:12px}" +
      ".sm-face{width:64px;height:64px;border-radius:12px;object-fit:cover;object-position:50% 8%;flex:0 0 64px;background:#14213D}" +
      ".sm-mono{width:64px;height:64px;border-radius:12px;flex:0 0 64px;background:#14213D;color:#C9A24B;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;font-size:20px;letter-spacing:1px}" +
      ".sm-bx{flex:1;min-width:0}" +
      ".sm-sp{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#C8674A;margin-bottom:3px}" +
      ".sm-tx{color:#2a3140;font-size:14.5px;line-height:1.5}" +
      ".sm-choices{display:flex;flex-direction:column;gap:6px;margin-top:10px}" +
      "html body #page .sm-ch{text-align:left;border:1px solid #d8d0b8;background:#fff;border-radius:9px;padding:10px 12px;font-size:13.5px;color:#101B2D;min-height:44px;line-height:1.35}" +
      "html body #page .sm-ch:hover{border-color:#C8674A}" +
      "html body #page .sm-cont{background:#14213D;color:#F1EADA;border-color:#14213D;font-family:Oswald,sans-serif;letter-spacing:1.2px;text-transform:uppercase;font-size:12px;text-align:center}" +
      ".sm-tie,.sm-done{background:#FDFBF4;border:1px solid #e3dcc6;border-radius:14px;padding:16px;text-align:center}" +
      ".sm-tie-k{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:2.2px;text-transform:uppercase;color:#C9A24B}" +
      ".sm-tie-nm{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:1.6px;font-size:22px;color:#101B2D;margin:3px 0}" +
      ".sm-tie-c{color:#5b6472;font-size:13px}" +
      ".sm-rem{color:#9c2f18;font-size:12px;margin-top:4px}" +
      "html body #page .sm-go{margin-top:12px;background:#C8674A!important;border:none!important;color:#fff!important;border-radius:9px;padding:12px 22px;font-family:Oswald,sans-serif;letter-spacing:1.4px;text-transform:uppercase;font-size:13px;min-height:44px}" +
      "html body #page .sm-skip{margin-top:9px;border:none;background:transparent;color:#8a90a0;font-size:12px;text-decoration:underline dotted}" +
      ".sm-hist{margin:10px 0;text-align:left;max-width:420px;margin-left:auto;margin-right:auto}" +
      ".sm-hrow{font-size:13px;color:#2a3140;padding:3px 0;border-bottom:1px dashed #e3dcc6}" +
      ".sm-hrow .w{color:#2E7A3C;font-weight:700}.sm-hrow .l{color:#9c2f18;font-weight:700}" +
      ".fo-sm button:focus-visible,.fo-sm a:focus-visible{outline:3px solid #C9A24B;outline-offset:1px}";
    document.head.appendChild(st);
  }

  function init() {
    if (typeof window === "undefined") return;
    css();
    window.addEventListener("hashchange", function () {
      if (location.hash.indexOf("#/summer") === 0) setTimeout(function () { render(true); }, 30);
    });
    setInterval(function () { render(false); injectNav(); }, 1000);
  }

  return { init: init, render: render };
})();
