/* ============================================================================
   THE BOOKS (#/finance) — the crowd, the gate, the sponsor and the ground.

   A club's money is a ledger the umpire walks from the founding, not a
   balance anyone increments: a following that grows on winning, a mood that
   reads the last five results and the table, a gate split two thirds to the
   home club and one third to the visitors, a sponsor who checks the standings
   before he signs, wages and academy upkeep by the round, and interest on an
   overdraft. This room reads what the world settled and offers the one
   decision the manager actually has - how big a ground to build.

   PHASE 3 OF THE ALMANACK. A set of books is a ledger, and the shell already
   has one, so the room is now what it always was on paper: the balance and
   its verdict first, then the crowd, the ground, and every line the umpire
   derived, in a column of label and figure.
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
    // PLAIN TEXT, NOT ENTITIES. Most of these figures now go through the
    // Almanack's ledger, which escapes what it is given, so an &mdash; here
    // would print as five literal characters.
    if (!isFinite(n)) return "\u2014";
    var neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 2) + "m"
          : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "\u2212$" : "$") + s;
  }
  function num(v) { return String(Math.round(+v || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function A() { return window.AL || null; }
  function on() { return (location.hash || "").split("?")[0] === "#/finance"; }
  function mast(al) {
    return al.mast("The books", "Gate & Ground",
      "Nobody credits your account. The umpire walks every round you have played and works out what the crowd was, " +
      "what they paid, what the sponsor thought and what your men cost.");
  }
  function fail(page, al, title, line, href, label) {
    page.innerHTML = al.page({ body: mast(al) + al.empty(title, line) +
      (href ? '<p style="margin-top:16px"><a class="al-btn al-btn--primary" href="' + href + '">' + label + "</a></p>" : "") });
  }

  window.foRenderFinancePage = function () {
    if (!on()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}
    page.innerHTML = al.page({ body: mast(al) + al.empty("Opening the books", "Reading what the world settled.") });
    if (!jwt()) {
      fail(page, al, "The books belong to your club",
        "Sign in to the account that holds it in the served world.", "#/worldclub", "Your world club");
      return;
    }
    rpc("world_my_status").then(function (st) {
      if (!on()) return;
      if (!st || st.signedIn === false) {
        fail(page, al, "Sign in first", "The books are your club's, and the world keeps them."); return;
      }
      if (!st.claim) {
        fail(page, al, "You don't hold a club yet",
          "Claim one and it comes with a ground, a following and a set of books.", "#/worldclub", "Claim a club");
        return;
      }
      render(page, st);
    }).catch(function (e) {
      if (!on()) return;
      fail(page, al, "The world could not be reached",
        String((e && e.message) || e).slice(0, 120) + ". The turnstiles keep turning regardless — try again in a minute.");
    });
  };

  function render(page, st) {
    var al = A(); if (!al || !on()) return;
    var f = st.finance || {}, bank = Number(st.bank || 0);
    var seats = +st.seats || +f.seats || 15000;
    var body = mast(al) + al.subnav("finance");

    // BEFORE A BALL IS BOWLED there is nothing to derive from, and a page of
    // zeroes would read like a bankrupt club rather than a new one
    if (!f.rounds) {
      body += al.decide({ kind: "done", title: money(bank || 2500000) + " to start with",
        note: (st.claim.club || "Your club") + (st.claim.ground ? " · " + st.claim.ground : "") });
      body += al.sec("The ground · " + num(seats) + " seats",
        "<p>Fifteen thousand, and a following waiting to see whether you are worth the walk.</p>" +
        '<p class="al-read">The books open when your first round settles: what the crowd was, what they paid at ' +
        money(26) + " a ticket, what the sponsor made of the table and what your men cost. The home club keeps two " +
        "thirds of a gate and the visitors take one third.</p>");
      page.innerHTML = al.page({ body: body });
      return;
    }

    // ---- the balance, and the verdict on it --------------------------------
    var verdict = f.administration
      ? { kind: "act", note: "The club is in administration. You have hit the floor at " + money(f.debtLimit || 2500000) +
          " and " + money(f.writtenOff || 0) + " has been written off. The sponsor pays half and you build nothing until you climb back over the line." }
      : bank < 0
      ? { kind: "act", note: "You are overdrawn. The bank takes three per cent of what you owe every round, and nothing " +
          "gets built until you are level. The floor is " + money(f.debtLimit || 2500000) + "." }
      : { kind: "done", note: "after " + (f.rounds || 0) + " round" + (f.rounds === 1 ? "" : "s") + " of cricket · " +
          (st.claim.club || "your club") + (st.claim.ground ? " · " + st.claim.ground : "") };
    body += al.decide({ kind: verdict.kind, title: money(bank) + " in the bank", note: verdict.note });

    // ---- the crowd ----------------------------------------------------------
    var att = +f.lastAttendance || 0, avg = +f.avgAttendance || 0;
    var full = seats ? Math.max(2, Math.min(100, Math.round(att / seats * 100))) : 0;
    body += al.sec("The crowd" + (f.moodWord ? " · " + f.moodWord : ""),
      al.ledger([
        ["Following the club", num(f.supporters || 0)],
        ["Through the gate last time", num(att) + (f.lastWeather ? " · " + f.lastWeather + " day" : "")],
        ["On average", num(avg)],
        ["The house", full + "% of " + num(seats)],
      ]) + al.meter(full) +
      '<p class="al-read">Support follows the table and the last five results. It moves slowly in both directions, ' +
      "which is the point: a good season builds you a following, and a bad one costs you one before you have noticed.</p>");

    // ---- the ground, and the only decision in the room ---------------------
    var build;
    if (seats >= MAX_SEATS) {
      build = '<p class="al-read">Forty-five thousand. There is nowhere left to put a stand.</p>';
    } else {
      var cost = +f.nextSeatsCost || 0, can = bank >= cost, next = f.nextSeats || seats + 1000;
      build = "<p>The next thousand seats take the ground to <b>" + num(next) + "</b>. Building gets dearer the bigger " +
        "the ground — and empty seats earn nothing, so build into a crowd you already have.</p>" +
        '<p><button type="button" class="al-btn ' + (can ? "al-btn--primary" : "") + '" data-fo-seats="' + next + '"' +
        (can ? "" : " disabled") + ">" + (can ? "Build it · " + money(cost) : "Needs " + money(cost)) + "</button></p>";
    }
    body += al.sec("The ground · " + num(seats) + " seats", build +
      '<p class="al-read">Tickets are ' + money(f.ticket || 26) + ". The home club keeps two thirds of the gate and the " +
      "visitors take one third, so a full house pays you twice — once at your ground and again at theirs.</p>");

    // ---- every line the umpire derived --------------------------------------
    var lines = [
      ["Founded with", money(f.founded || 0), "pos"],
      ["Gate, at home", money(f.gate || 0), "pos"],
      ["Gate, away", money(f.awayCut || 0), "pos"],
      ["Sponsor", money(f.sponsor || 0), "pos"],
    ];
    if (f.compensation) lines.push(["International windows", money(f.compensation), "pos"]);
    lines.push(["Wages", money(-(f.wages || 0)), "neg"]);
    lines.push(["Academy upkeep", money(-(f.upkeep || 0)), "neg"]);
    if (f.academyPaid) lines.push(["The academy", money(-f.academyPaid), "neg"]);
    if (f.seatsPaid) lines.push(["The ground", money(-f.seatsPaid), "neg"]);
    if (f.interest) lines.push(["Interest", money(-f.interest), "neg"]);
    if (f.writtenOff) lines.push(["Written off", money(f.writtenOff), "pos"]);
    lines.push(["In the bank", money(bank), bank < 0 ? "neg" : "pos"]);

    body += al.sec("The ledger · since the founding", al.ledger(lines) +
      '<p class="al-read">Every line is derived from the record, not from a running total — which is why the same figure ' +
      "comes back however many times the umpire settles it, and why nobody can quietly credit anybody.</p>");

    page.innerHTML = al.page({ body: body });

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
