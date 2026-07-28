/* ============================================================================
   THE BOOKS (#/finance) — the crowd, the gate, the sponsor and the ground.

   A club's money is a ledger the umpire walks from the founding, not a
   balance anyone increments: a following that grows on winning, a mood that
   reads the last five results and the table, a gate split two thirds to the
   home club and one third to the visitors, a sponsor who checks the standings
   before he signs, wages and academy upkeep by the round, and interest on an
   overdraft. This room reads what the world settled and offers the one
   decision the manager actually has - how big a ground to build.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foFin) return; window.__foFin = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var MAX_SEATS = 45000;
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  function rpc(fn, args) {
    return fetch(SB_URL + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { apikey: SB_ANON, Authorization: "Bearer " + (jwt() || SB_ANON), "content-type": "application/json" },
      body: JSON.stringify(args || {})
    }).then(function (r) { return r.text().then(function (t) {
      var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) {}
      if (!r.ok) throw new Error((d && (d.message || d.hint)) || t || ("HTTP " + r.status));
      return d;
    }); });
  }
  function money(v) {
    var n = Number(v);
    if (!isFinite(n)) return "&mdash;";
    var neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 2) + "m"
          : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "&minus;$" : "$") + s;
  }
  function num(v) { return String(Math.round(+v || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function css() {
    try { if (window.__foRoomCss) window.__foRoomCss(); } catch (e) {}
    if (document.getElementById("fo-fin-css")) return;
    var s = document.createElement("style"); s.id = "fo-fin-css";
    s.textContent = [
      "html body #page .fo-fin-bank{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}",
      "html body #page .fo-fin-bank b{font:700 34px/1 Oswald,sans-serif;color:#177A57;font-variant-numeric:tabular-nums;letter-spacing:-.01em}",
      "html body #page .fo-fin-bank.red b{color:#B23230}",
      "html body #page .fo-fin-bank i{font-style:normal;font:500 12px/1.4 Inter,sans-serif;color:rgba(20,28,40,.55)}",
      "html body #page .fo-fin-crowd{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin-bottom:9px}",
      "html body #page .fo-fin-crowd b{font:700 22px/1 Oswald,sans-serif;color:#141C28;font-variant-numeric:tabular-nums}",
      "html body #page .fo-fin-crowd em{font-style:normal;font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#FFFEFC;background:#8A6A1F;border-radius:999px;padding:5px 9px}",
      "html body #page .fo-fin-fill{height:10px;border-radius:999px;background:rgba(20,28,40,.09);overflow:hidden;margin:4px 0 5px}",
      "html body #page .fo-fin-fill s{display:block;height:100%;text-decoration:none;background:linear-gradient(90deg,#2E8B5E,#177A57)}",
      "html body #page .fo-fin-led{width:100%;border-collapse:collapse;font:500 12.5px/1.4 Inter,sans-serif;font-variant-numeric:tabular-nums}",
      "html body #page .fo-fin-led td{padding:7px 0;border-top:1px solid rgba(20,28,40,.07);color:rgba(20,28,40,.72)}",
      "html body #page .fo-fin-led td.v{text-align:right;white-space:nowrap;color:#141C28;font-weight:600;padding-left:12px}",
      "html body #page .fo-fin-led td.v.in{color:#177A57}",
      "html body #page .fo-fin-led td.v.out{color:#B23230}",
      "html body #page .fo-fin-led tr.tot td{border-top:2px solid rgba(20,28,40,.18);font-weight:700;color:#141C28;font-size:13.5px}",
      "html body #page .fo-fin-led tr:first-child td{border-top:0}",
      "html body #page .fo-fin-led td small{display:block;font-size:10.5px;color:rgba(20,28,40,.45);font-weight:400}",
      "html body #page .fo-fin-warn{margin-top:12px;padding:11px 13px;background:rgba(178,50,48,.08);border:1px solid rgba(178,50,48,.3);border-radius:12px;font:500 12.5px/1.5 Inter,sans-serif;color:#8E2724}"
    ].join("\n");
    document.head.appendChild(s);
  }

  window.foRenderFinancePage = function () {
    var page = document.getElementById("page"); if (!page) return;
    css();
    page.innerHTML = shell("<div class='fo-ac-note'>Opening the books&hellip;</div>");
    if (!jwt()) {
      page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>The books belong to your club in the served world. Sign in to the account that holds it.</p>" +
        "<a class='fo-ac-btn' href='#/worldclub'>Your world club &rsaquo;</a></div>");
      return;
    }
    rpc("world_my_status").then(function (st) {
      if (!st || st.signedIn === false) {
        page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>Sign in first &mdash; the books are your club's, and the world keeps them.</p></div>");
        return;
      }
      if (!st.claim) {
        page.innerHTML = shell("<div class='fo-ac-card'><p class='fo-ac-p'>You don't hold a club in the served world yet. Claim one and it comes with a ground, a following and a set of books.</p>" +
          "<a class='fo-ac-btn' href='#/worldclub'>Claim a club &rsaquo;</a></div>");
        return;
      }
      render(page, st);
    }).catch(function (e) {
      page.innerHTML = shell("<div class='fo-ac-note'>The world could not be reached (" + E(String(e.message).slice(0, 90)) +
        "). The turnstiles keep turning regardless &mdash; try again in a minute.</div>");
    });
  };

  function shell(body) {
    return "<div class='fo-ac' data-fo-owntable><div class='fo-ac-in'>" +
      "<div class='fo-ac-hero'><div class='fo-ac-k'>The books</div>" +
      "<h1>Gate &amp; Ground</h1>" +
      "<p>Nobody credits your account. The umpire walks every round you have ever played and works out what the crowd was, what they paid, what the sponsor thought and what your men cost &mdash; and that is your money.</p></div>" +
      body +
      "<div class='fo-ac-foot'><a href='#/worldclub'>&lsaquo; Your world club</a><a href='#/academy'>The academy &rsaquo;</a></div>" +
      "</div></div>";
  }

  function render(page, st) {
    var f = st.finance || {}, bank = Number(st.bank || 0);
    var seats = +st.seats || +f.seats || 15000;
    var att = +f.lastAttendance || 0, avg = +f.avgAttendance || 0;
    var full = seats ? Math.max(2, Math.min(100, Math.round(att / seats * 100))) : 0;
    var inTotal = (+f.gate || 0) + (+f.awayCut || 0) + (+f.sponsor || 0);
    var outTotal = (+f.wages || 0) + (+f.upkeep || 0) + (+f.interest || 0) + (+f.academyPaid || 0) + (+f.seatsPaid || 0);

    var build = seats >= MAX_SEATS
      ? "<div class='fo-ac-note'>Forty-five thousand. There is nowhere left to put a stand.</div>"
      : (function () {
          var cost = +f.nextSeatsCost || 0, can = bank >= cost;
          return "<div class='fo-ac-uprow'>" +
            "<div><b>" + num(f.nextSeats || seats + 1000) + " seats</b><i>The next thousand. Building gets dearer the bigger the ground &mdash; and empty seats earn nothing, so build into a crowd you already have.</i></div>" +
            "<button type='button' class='fo-ac-btn" + (can ? "" : " off") + "' data-fo-seats='" + (f.nextSeats || seats + 1000) + "'" + (can ? "" : " disabled") + ">" +
              (can ? "Build it &middot; " + money(cost) : "Needs " + money(cost)) + "</button></div>";
        })();

    var row = function (label, sub, v, cls) {
      return "<tr><td>" + label + (sub ? "<small>" + sub + "</small>" : "") + "</td><td class='v " + (cls || "") + "'>" + money(v) + "</td></tr>";
    };

    page.innerHTML = shell(
      "<div class='fo-ac-card'><h3>" + E(st.claim.club || "Your club") + "<span>" + E(st.claim.ground || "") + "</span></h3>" +
        "<div class='fo-fin-bank" + (bank < 0 ? " red" : "") + "'><b>" + money(bank) + "</b>" +
          "<i>in the bank after " + (f.rounds || 0) + " round" + (f.rounds === 1 ? "" : "s") + " of cricket</i></div>" +
        (bank < 0
          ? "<div class='fo-fin-warn'><b>You are overdrawn.</b> The bank takes three per cent of what you owe every round until you are level. Winning brings a crowd, and a crowd is the way out.</div>"
          : "") +
      "</div>" +

      "<div class='fo-ac-card'><h3>The crowd<span>" + E(f.moodWord || "") + "</span></h3>" +
        "<div class='fo-fin-crowd'><b>" + num(f.supporters || 0) + "</b><i class='fo-ac-cm'>following the club</i>" +
          (f.moodWord ? "<em>" + E(f.moodWord) + "</em>" : "") + "</div>" +
        "<div class='fo-fin-fill'><s style='width:" + full + "%'></s></div>" +
        "<div class='fo-ac-cm'><b>" + num(att) + "</b> through the gate last time" +
          (f.lastWeather ? " on a " + E(f.lastWeather) + " day" : "") +
          " &middot; " + full + "% of " + num(seats) + " seats &middot; " + num(avg) + " on average</div>" +
        "<div class='fo-ac-note'>Support follows the table and the last five results. It moves slowly in both directions, which is the point: a good season builds you a following, and a bad one costs you one before you have noticed.</div>" +
      "</div>" +

      "<div class='fo-ac-card'><h3>The ground<span>" + num(seats) + " seats</span></h3>" + build +
        "<div class='fo-ac-note'>Tickets are " + money(f.ticket || 26) + ". The home club keeps two thirds of the gate and the visitors take one third, so a full house pays you twice &mdash; once at your ground and again at theirs.</div>" +
      "</div>" +

      "<div class='fo-ac-card'><h3>The ledger<span>since the founding</span></h3>" +
        "<table class='fo-fin-led'><tbody>" +
          row("Founded with", null, f.founded || 0, "in") +
          row("Gate, at home", "two thirds of the house, every match at your ground", f.gate || 0, "in") +
          row("Gate, away", "one third of theirs", f.awayCut || 0, "in") +
          row("Sponsor", "by the round, and he reads the table", f.sponsor || 0, "in") +
          row("Wages", "the bill as it stands, every round played", -(f.wages || 0), "out") +
          row("Academy upkeep", "by the level, by the round", -(f.upkeep || 0), "out") +
          (f.academyPaid ? row("The academy", "what you built", -(f.academyPaid || 0), "out") : "") +
          (f.seatsPaid ? row("The ground", "what the stands cost", -(f.seatsPaid || 0), "out") : "") +
          (f.interest ? row("Interest", "the price of an overdraft", -(f.interest || 0), "out") : "") +
          "<tr class='tot'><td>In the bank</td><td class='v'>" + money(bank) + "</td></tr>" +
        "</tbody></table>" +
        "<div class='fo-ac-note'>Every line is derived from the record, not from a running total &mdash; which is why the same figure comes back however many times the umpire settles it, and why nobody can quietly credit anybody.</div>" +
      "</div>" +
      "<div class='fo-ac-note'>In: " + money(inTotal) + " &middot; Out: " + money(outTotal) + "</div>");

    var b = page.querySelector("[data-fo-seats]");
    if (b) b.addEventListener("click", function () {
      if (b.disabled) return;
      b.disabled = true; b.textContent = "Building…";
      rpc("world_set_stadium", { p_seats: +b.getAttribute("data-fo-seats") })
        .then(function () { window.foRenderFinancePage(); })
        .catch(function (e) { b.disabled = false; b.textContent = "Try again"; alert(String(e.message).slice(0, 160)); });
    });
  }
})();
