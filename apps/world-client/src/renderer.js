/* world-client/renderer — DOM scene renderer. Layered full-screen places,
 * positioned hotspots (44px+, keyboard focusable), character cutouts, a
 * dialogue box with typed text (instant under reduced motion), choices,
 * an input row for founding, the notebook drawer, and travel cards.
 * Placeholder backgrounds are painted with layered CSS by stable asset id.
 */
FOW.renderer = (function () {
  var root = null, hidden = false, typeTimer = null;

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function mount() {
    if (root) return root;
    css();
    root = el("div", "fow");
    root.id = "fow-root";
    document.body.appendChild(root);
    document.addEventListener("keydown", function (ev) {
      if (hidden) return;
      if ((ev.key === "Enter" || ev.key === " ") && FOW.dialogue.isOpen()) {
        var box = document.querySelector(".fow-dlg .fow-choices");
        if (!box) { ev.preventDefault(); FOW.dialogue.advance(); }
      }
    });
    return root;
  }

  function sceneDef() {
    var w = FOW.state.load();
    var d = FOW.scenes.get(w.scene) || FOW.scenes.get("station");
    var v = d.variant && d.variant(w, FOW.bridge);
    if (v) d = Object.assign({}, d, v);
    return d;
  }

  function refresh() {
    if (!root || hidden) return;
    var w = FOW.state.load(), B = FOW.bridge;
    var d = sceneDef();
    var bgId = d.bg;
    var isCss = FOW.assets.isCss(bgId);
    var h = "<div class='fow-scene " + (isCss ? FOW.assets.cssClass(bgId) : "") + "' data-scene='" + esc(d.id) + "'>";
    if (!isCss) h += "<img class='fow-bgimg' src='" + esc(FOW.assets.get(bgId)) + "' alt=''>";
    h += "<div class='fow-veil'></div>";
    (d.characters || []).forEach(function (c) {
      if (c.when && !c.when(w, B)) return;
      if (c.asset) h += "<img class='fow-cutout' style='left:" + c.x + "%;top:" + c.y + "%' src='" + esc(FOW.assets.get(c.asset)) + "' alt=''>";
      else if (c.mono) h += "<span class='fow-mono' style='left:" + c.x + "%;top:" + c.y + "%'>" + esc(c.mono) + "</span>";
    });
    (d.hotspots || []).forEach(function (hs) {
      if (hs.when && !hs.when(w, B)) return;
      var seen = hs.dlg && w.seen[hs.dlg];
      h += "<button class='fow-hs" + (hs.optional ? " opt" : "") + (seen ? " seen" : "") + "' style='left:" + hs.x + "%;top:" + hs.y + "%'" +
        " data-hs='" + esc(hs.id) + "' aria-label='" + esc(hs.label) + "'>" +
        "<span class='pip'>" + (hs.kind === "go" ? "➜" : hs.kind === "talk" ? "💬" : hs.kind === "action" ? "✦" : "👁") + "</span>" +
        "<span class='lbl'>" + esc(hs.label) + "</span></button>";
    });
    h += "<div class='fow-title'>" + esc(d.label) + "</div>";
    h += "<button class='fow-nb' aria-label='Manager notebook'>✎ Notebook</button>";
    h += "</div>";
    root.innerHTML = h;
    root.querySelectorAll(".fow-hs").forEach(function (b) {
      b.addEventListener("click", function () { FOW.app.hotspot(b.getAttribute("data-hs")); });
    });
    var nb = root.querySelector(".fow-nb");
    if (nb) nb.addEventListener("click", showNotebook);
  }

  // ---- dialogue -------------------------------------------------------------
  function typeInto(box, txt) {
    clearTimeout(typeTimer);
    var w = FOW.state.load();
    var reduced = w.settings.reduced || (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    if (w.settings.instant || reduced) { box.textContent = txt; return; }
    var i = 0, step = Math.max(1, Math.round(2 * (w.settings.textSpeed || 1)));
    box.textContent = "";
    (function tick() {
      i += step;
      box.textContent = txt.slice(0, i);
      if (i < txt.length) typeTimer = setTimeout(tick, 16);
    })();
  }

  function showDialogue(active) {
    if (!root) return;
    var n = active.node, w = FOW.state.load(), B = FOW.bridge;
    var txt = active.lines[active.lineIx] || "";
    var ex = document.querySelector(".fow-dlg");
    if (ex) ex.remove();
    var exprId = (n.expr2 && n.expr2(w, B)) || n.expr;
    var face = exprId && FOW.assets.get(exprId)
      ? "<img class='face' src='" + esc(FOW.assets.get(exprId)) + "' alt=''>"
      : (n.mono ? "<span class='face mono'>" + esc(n.mono) + "</span>" : "");
    var d = el("div", "fow-dlg",
      "<div class='fow-dlg-in' role='dialog' aria-live='polite'>" + face +
      "<div class='bx'>" + (n.sp ? "<div class='sp'>" + esc(n.sp) + "</div>" : "") +
      "<div class='tx' id='fow-tx'></div>" +
      "<div class='adv' aria-hidden='true'>▾</div></div></div>");
    root.appendChild(d);
    typeInto(d.querySelector("#fow-tx"), txt);
    d.addEventListener("click", function (ev) {
      // choices and inputs handle themselves; the box only advances TEXT
      if (ev.target.closest(".fow-choices") || ev.target.closest(".fow-in")) return;
      if (d.querySelector(".fow-choices")) return;
      FOW.dialogue.advance();
    });
  }

  function showChoices(active) {
    var n = active.node, w = FOW.state.load(), B = FOW.bridge;
    var d = document.querySelector(".fow-dlg .bx");
    if (!d) return;
    var adv = d.querySelector(".adv"); if (adv) adv.remove();
    // idempotent: never stack duplicate choice panels
    var oldc = d.querySelector(".fow-choices"); if (oldc) return;
    var choices = n.dynChoices ? n.dynChoices(w, B) : n.choices;
    active.node = Object.assign({}, n, { choices: choices });
    var h = "";
    if (n.input) {
      h += "<input class='fow-in' id='fow-in' maxlength='26' placeholder='" + esc(n.input.placeholder || "") + "' value='" + esc(w.flags[n.input.flag] || FOW.bridge.clubName()) + "' aria-label='" + esc(n.input.placeholder || "name") + "'>";
    }
    h += "<div class='fow-choices'>" + choices.map(function (c, i) {
      return "<button class='fow-ch' data-i='" + i + "'>" + esc(c.t) + "</button>";
    }).join("") + "</div>";
    d.insertAdjacentHTML("beforeend", h);
    d.querySelectorAll(".fow-ch").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (n.input) {
          var inp = d.querySelector("#fow-in");
          if (inp) { var ww = FOW.state.load(); ww.flags[n.input.flag] = inp.value; FOW.state.save(); }
        }
        FOW.dialogue.choose(+b.getAttribute("data-i"));
      });
    });
    var first = d.querySelector(".fow-ch"); if (first) first.focus();
  }
  function hideDialogue() {
    clearTimeout(typeTimer);
    var ex = document.querySelector(".fow-dlg"); if (ex) ex.remove();
  }

  // ---- notebook, travel, legacy hand-off ------------------------------------
  function showNotebook() {
    var w = FOW.state.load();
    var ex = document.querySelector(".fow-book"); if (ex) { ex.remove(); return; }
    var h = "<div class='fow-book-in'><h3>Manager's notebook</h3>";
    h += "<div class='sec'>People &amp; places</div>";
    h += (w.notebook.length ? w.notebook.map(function (n) { return "<div class='ln'>• " + esc(n.txt) + "</div>"; }).join("") : "<div class='ln dim'>Nothing yet. Talk to people.</div>");
    var visited = Object.keys(w.visited);
    if (visited.length > 1) {
      h += "<div class='sec'>Quick travel</div><div class='fow-qt'>" + visited.map(function (sid) {
        var s = FOW.scenes.get(sid);
        return s ? "<button class='fow-ch qt' data-go='" + esc(sid) + "'>" + esc(s.label) + "</button>" : "";
      }).join("") + "</div>";
    }
    h += "<div class='sec'>Settings</div><div class='fow-qt'>" +
      "<button class='fow-ch' data-set='instant'>" + (w.settings.instant ? "☑" : "☐") + " Instant text</button>" +
      "<button class='fow-ch' data-set='reduced'>" + (w.settings.reduced ? "☑" : "☐") + " Reduce motion</button></div>";
    h += "<div class='sec'>Recent conversation</div>" + w.history.slice(-6).map(function (l) { return "<div class='ln dim'>" + esc(l) + "</div>"; }).join("");
    h += "<button class='fow-ch' data-close='1' style='margin-top:10px'>Close</button></div>";
    var b = el("div", "fow-book", h);
    root.appendChild(b);
    b.addEventListener("click", function (ev) {
      var t = ev.target.closest("button"); if (!t) return;
      if (t.getAttribute("data-close")) { b.remove(); return; }
      var go = t.getAttribute("data-go");
      if (go) { b.remove(); FOW.app.goto(go); return; }
      var st = t.getAttribute("data-set");
      if (st) { var ww = FOW.state.load(); ww.settings[st] = !ww.settings[st]; FOW.state.save(); b.remove(); showNotebook(); }
    });
  }

  function travelCard(label, then) {
    show();
    var c = el("div", "fow-travel", "<div class='in'><span class='tk'>🎫</span><span>" + esc(label) + "</span></div>");
    root.appendChild(c);
    setTimeout(function () { c.remove(); if (then) then(); refresh(); },
      FOW.state.load().settings.reduced ? 60 : 1200);
  }

  // hand the screen to a legacy surface (lineup / match / hub), leave a way home
  function hide(returnLabel) {
    hidden = true;
    if (root) root.style.display = "none";
    var ex = document.getElementById("fow-return"); if (ex) ex.remove();
    if (returnLabel) {
      var chip = el("button", "fow-chip", "◂ " + esc(returnLabel));
      chip.id = "fow-return";
      chip.addEventListener("click", function () { chip.remove(); show(); refresh(); });
      document.body.appendChild(chip);
    }
  }
  function show() {
    hidden = false;
    var ex = document.getElementById("fow-return"); if (ex) ex.remove();
    if (root) root.style.display = "";
  }
  function isHidden() { return hidden; }

  function css() {
    if (document.getElementById("fow-css")) return;
    var st = el("style"); st.id = "fow-css";
    st.textContent =
      ".fow{position:fixed;inset:0;z-index:2147482000;background:#0B1322;font-family:Georgia,serif}" +
      ".fow-scene{position:absolute;inset:0;overflow:hidden}" +
      ".fow-bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92}" +
      ".fow-veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%,transparent 55%,rgba(8,12,24,.35))}" +
      ".fow-cutout{position:absolute;width:120px;height:120px;object-fit:cover;object-position:50% 8%;border-radius:14px;transform:translate(-50%,-50%);box-shadow:0 8px 24px rgba(0,0,0,.4);border:2px solid rgba(255,250,235,.5)}" +
      ".fow-mono{position:absolute;width:96px;height:96px;transform:translate(-50%,-50%);border-radius:14px;background:#14213D;color:#C9A24B;display:flex;align-items:center;justify-content:center;font-size:26px;letter-spacing:2px;border:2px solid rgba(255,250,235,.5)}" +
      ".fow-hs{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:7px;background:rgba(12,19,34,.78);color:#F1EADA;border:1px solid rgba(201,162,75,.65);border-radius:999px;padding:9px 14px;min-height:44px;min-width:44px;cursor:pointer;font-size:14px;backdrop-filter:blur(2px)}" +
      ".fow-hs:hover,.fow-hs:focus-visible{border-color:#C9A24B;background:rgba(20,33,61,.92);outline:none;box-shadow:0 0 0 3px rgba(201,162,75,.45)}" +
      ".fow-hs .pip{font-size:15px}" +
      ".fow-hs.opt .pip{opacity:.85}" +
      ".fow-hs.seen{opacity:.72}" +
      "@media(prefers-reduced-motion:no-preference){.fow-hs .pip{animation:fowPulse 2.4s infinite}}" +
      "@keyframes fowPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}" +
      ".fow-title{position:absolute;top:14px;left:16px;color:#F1EADA;font-size:15px;letter-spacing:2.4px;text-transform:uppercase;background:rgba(11,19,34,.6);padding:7px 14px;border-radius:9px;border:1px solid rgba(201,162,75,.4)}" +
      ".fow-nb{position:absolute;top:14px;right:16px;background:rgba(11,19,34,.7);color:#C9A24B;border:1px solid rgba(201,162,75,.5);border-radius:9px;padding:9px 14px;min-height:44px;cursor:pointer;font-size:13px}" +
      ".fow-nb:focus-visible{outline:3px solid #C9A24B}" +
      // dialogue
      ".fow-dlg{position:absolute;left:0;right:0;bottom:0;padding:14px;display:flex;justify-content:center;background:linear-gradient(transparent,rgba(6,10,20,.72) 40%)}" +
      ".fow-dlg-in{display:flex;gap:12px;align-items:flex-end;max-width:760px;width:100%}" +
      ".fow-dlg .face{width:110px;height:110px;border-radius:14px;object-fit:cover;object-position:50% 8%;border:2px solid #C9A24B;flex:0 0 110px;background:#14213D}" +
      ".fow-dlg .face.mono{display:flex;align-items:center;justify-content:center;color:#C9A24B;font-size:30px;letter-spacing:2px}" +
      ".fow-dlg .bx{flex:1;background:#FDFBF4;border:2px solid #14213D;border-radius:14px;padding:12px 16px;min-height:86px;box-shadow:0 10px 30px rgba(0,0,0,.45)}" +
      ".fow-dlg .sp{font-size:11px;letter-spacing:2.2px;text-transform:uppercase;color:#C8674A;font-weight:700;margin-bottom:4px}" +
      ".fow-dlg .tx{color:#1c2333;font-size:17px;line-height:1.5;min-height:26px}" +
      ".fow-dlg .adv{color:#C8674A;text-align:right;font-size:15px}" +
      "@media(prefers-reduced-motion:no-preference){.fow-dlg .adv{animation:fowPulse 1.6s infinite}}" +
      ".fow-choices{display:flex;flex-direction:column;gap:7px;margin-top:9px}" +
      ".fow-ch{text-align:left;background:#fff;border:1.5px solid #cfc6ac;border-radius:9px;padding:10px 13px;font-size:14.5px;color:#1c2333;cursor:pointer;min-height:44px;font-family:inherit}" +
      ".fow-ch:hover,.fow-ch:focus-visible{border-color:#C8674A;outline:none;box-shadow:0 0 0 3px rgba(200,103,74,.25)}" +
      ".fow-in{width:100%;box-sizing:border-box;border:1.5px solid #cfc6ac;border-radius:9px;padding:10px;font-size:15px;margin-top:9px;font-family:inherit}" +
      // notebook + travel + return chip
      ".fow-book{position:absolute;inset:0;background:rgba(8,12,22,.55);display:flex;align-items:center;justify-content:center;padding:16px}" +
      ".fow-book-in{background:#FDFBF4;border-radius:14px;max-width:520px;width:100%;max-height:80vh;overflow:auto;padding:18px;color:#1c2333}" +
      ".fow-book-in h3{margin:0 0 6px;font-size:18px}" +
      ".fow-book-in .sec{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#B08D2E;margin:12px 0 4px}" +
      ".fow-book-in .ln{font-size:13.5px;padding:2px 0}" +
      ".fow-book-in .dim{color:#7a7f8c}" +
      ".fow-qt{display:flex;flex-wrap:wrap;gap:6px}" +
      ".fow-qt .fow-ch{flex:0 0 auto}" +
      ".fow-travel{position:absolute;inset:0;background:#0B1322;display:flex;align-items:center;justify-content:center;z-index:5}" +
      ".fow-travel .in{color:#F1EADA;font-size:20px;letter-spacing:1px;display:flex;gap:12px;align-items:center;border:1px solid rgba(201,162,75,.5);border-radius:12px;padding:18px 26px}" +
      ".fow-chip{position:fixed;top:64px;right:14px;z-index:2147482500;background:#14213D;color:#F1EADA;border:1px solid #C9A24B;border-radius:999px;padding:11px 18px;min-height:44px;cursor:pointer;font-size:13.5px}" +
      // ---- placeholder scene paints (stable ids in ART_REQUIREMENTS.md) ----
      ".sc-station{background:linear-gradient(#8fa8bf 0 38%,#b7c4b1 38% 62%,#6f7f6a 62% 100%)}" +
      ".sc-station:before{content:'';position:absolute;left:8%;right:8%;top:30%;height:16%;background:#5d4a3a;border-radius:6px 6px 0 0;box-shadow:0 10px 0 #4a3b2e}" +
      ".sc-home-morning{background:linear-gradient(#a9c2d6 0 42%,#8fb383 42% 78%,#5d7a54 78%)}" +
      ".sc-home-morning:before{content:'';position:absolute;left:38%;width:26%;top:26%;height:20%;background:#f0e8d4;border:3px solid #6b5b46;border-radius:8px 8px 0 0}" +
      ".sc-home-dusk{background:linear-gradient(#3d3a5c 0 34%,#c2764a 34% 46%,#4d5f46 46% 80%,#2e3c2b 80%)}" +
      ".sc-home-dusk:before{content:'';position:absolute;left:38%;width:26%;top:26%;height:20%;background:#3a3428;border:3px solid #241f16;border-radius:8px 8px 0 0;box-shadow:inset 0 0 0 100px rgba(255,190,90,.12)}" +
      ".sc-pavilion{background:linear-gradient(#efe6cf 0 70%,#8a6f52 70%)}" +
      ".sc-pavilion:before{content:'';position:absolute;left:6%;right:6%;top:12%;height:8%;background:repeating-linear-gradient(90deg,#5d4a3a 0 40px,#6b5744 40px 80px)}" +
      ".sc-dressing{background:linear-gradient(#dfd7c2 0 68%,#7a6a52 68%)}" +
      ".sc-dressing:before{content:'';position:absolute;left:30%;right:30%;top:24%;height:26%;background:#2e3c2b;border:4px solid #6b5744;border-radius:6px}" +
      ".sc-nets{background:linear-gradient(#bcd0de 0 40%,#7fa06f 40%)}" +
      ".sc-nets:before{content:'';position:absolute;inset:22% 10% 30% 10%;background:repeating-linear-gradient(90deg,transparent 0 26px,rgba(40,50,40,.35) 26px 28px),repeating-linear-gradient(0deg,transparent 0 26px,rgba(40,50,40,.35) 26px 28px)}" +
      ".sc-office{background:linear-gradient(#e9dfc8 0 72%,#6d5a44 72%)}" +
      ".sc-office:before{content:'';position:absolute;left:12%;top:22%;width:20%;height:30%;background:#8a734f;border-radius:4px;box-shadow:34% 0 0 #8a734f}" +
      ".sc-trophy{background:linear-gradient(#efe8d8 0 74%,#5d4a3a 74%)}" +
      ".sc-trophy:before{content:'';position:absolute;left:20%;right:20%;top:26%;height:5%;background:#6b5744;box-shadow:0 60px 0 #6b5744}" +
      ".sc-wm-town{background:linear-gradient(#cfe0ea 0 44%,#a7c290 44% 82%,#6f8a5e 82%)}" +
      ".sc-wm-town:before{content:'';position:absolute;left:14%;width:14%;top:30%;height:14%;background:#e8dcc2;border:2px solid #6b5b46;box-shadow:180% 0 0 #e8dcc2,90% 40% 0 #d8ccb2}" +
      ".sc-wm-ground{background:linear-gradient(#cfe0ea 0 38%,#8fb383 38% 84%,#54704b 84%)}" +
      ".sc-wm-ground:before{content:'';position:absolute;left:34%;right:34%;top:46%;height:12%;background:#d9c9a3;border-radius:50%}" +
      ".sc-wm-dressing{background:linear-gradient(#d8d0bb 0 70%,#6d5f4a 70%)}" +
      ".sc-wm-entry{background:linear-gradient(#bcd0de 0 30%,#8fb383 30%)}" +
      ".sc-wm-entry:before{content:'';position:absolute;left:44%;width:12%;top:20%;bottom:0;background:linear-gradient(rgba(240,232,212,.9),rgba(240,232,212,.2))}" +
      "@media(max-width:700px){.fow-dlg .face{width:84px;height:84px;flex-basis:84px}.fow-dlg .tx{font-size:15.5px}.fow-cutout{width:96px;height:96px}}";
    document.head.appendChild(st);
  }

  return { mount: mount, refresh: refresh, showDialogue: showDialogue, showChoices: showChoices,
    hideDialogue: hideDialogue, showNotebook: showNotebook, travelCard: travelCard,
    hide: hide, show: show, isHidden: isHidden };
})();
