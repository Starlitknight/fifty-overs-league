/* ============================================================================
   THE TRANSFER MARKET (#/market) — the biggest thing in a manager's day.

   THE SEALED BID. You never see anybody else's offer and nobody ever sees
   yours, so there is no reason on earth to sit refreshing this page. A
   listing stands three world days; when the window shuts the umpire opens the
   envelopes and the highest offer at or above the seller's reserve takes him.
   The money moves, the man moves, and neither club had to be awake.

   THE SCOUT. Your own numbers are yours. A man you do not own is a first
   impression - his trade, his age, roughly his class - until you pay somebody
   to go and watch him, and then he is bands and words. Nobody ever gets a
   rival's skill values, on this page or anywhere else.

   PHASE 3 OF THE ALMANACK. The room wears the shell now: the four views are
   the section's own tabs, a lot on the board is a lot and not a Card, and the
   bank sits in the decision strip where it belongs - an offer you cannot
   cover is refused, so the figure that governs every control on the page
   should be stated before the controls, not under them.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foMkt) return; window.__foMkt = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
  var EPOCH = Date.UTC(2026, 6, 28), DAY = 86400000;
  function E(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function jwt() { try { return (window.__foJWT && window.__foJWT()) || ""; } catch (e) { return ""; } }
  function today() { return Math.floor((Date.now() - EPOCH) / DAY); }
  function money(v) {
    var n = Number(v) || 0, neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 0 : 2).replace(/\.?0+$/, "") + "m"
      : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "-$" : "$") + s;
  }
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
  function sel(path) {
    return fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_ANON } })
      .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  function snapshot(key) {
    return sel("world_snapshots?key=eq." + encodeURIComponent(key) + "&select=body")
      .then(function (rows) { return rows && rows[0] && rows[0].body; });
  }

  var ST = { tab: "board", busy: 0 };

  function A() { return window.AL || null; }
  function on() { return (location.hash || "").split("?")[0] === "#/market"; }

  window.foRenderMarketPage = function () {
    if (!on()) return;
    var page = document.getElementById("page"); if (!page) return;
    var al = A(); if (!al) return;
    try { window.__foAlApply && window.__foAlApply(); } catch (e) {}
    page.innerHTML = al.page({ body: mast(al) + al.empty("Walking down to the market", "Reading the board.") });
    Promise.all([
      snapshot("market"),
      jwt() ? rpc("world_market_mine").catch(function () { return null; }) : Promise.resolve(null),
      jwt() ? rpc("world_my_status").catch(function () { return null; }) : Promise.resolve(null)
    ]).then(function (d) {
      if (!on()) return;
      render(page, d[0] || { listings: [], deals: [] }, d[1], d[2]);
    }).catch(function (e) {
      if (!on()) return;
      page.innerHTML = al.page({ body: mast(al) + al.empty("The market could not be reached",
        String((e && e.message) || e).slice(0, 120) + ". The envelopes stay sealed either way - try again in a minute.") });
    });
  };

  function mast(al) {
    return al.mast("The transfer market", "Buying & Selling",
      "Offers are sealed and windows last three days. Nobody can outbid you by being awake at the right minute.");
  }

  function closesIn(d) {
    var left = (d | 0) - today();
    return left <= 0 ? { txt: "shuts today", soon: true }
      : { txt: left + " day" + (left === 1 ? "" : "s") + " left", soon: left <= 1 };
  }

  function render(page, snap, mine, st) {
    var al = A(); if (!al || !on()) return;
    var claim = (st && st.claim) || (mine && mine.claim) || null;
    var myKey = claim ? claim.country + ":" + claim.slot : null;
    var bank = st ? Number(st.bank || 0) : null;
    var bidBy = {}; ((mine && mine.bids) || []).forEach(function (b) { bidBy[b.id] = b; });
    var repBy = {}; ((mine && mine.reports) || []).forEach(function (r) { repBy[r.id] = r.player; });
    var listings = (snap.listings || []).filter(function (L) { return !myKey || (L.country + ":" + L.slot) !== myKey; });
    var bids = (mine && mine.bids) || [];

    var body = mast(al);

    if (!claim) {
      body += al.empty("You need a club",
        "The market is between clubs in the served world. Claim one and you can buy, sell and send a scout out.") +
        '<p style="margin-top:16px"><a class="al-btn al-btn--primary" href="#/worldclub">Claim a club</a></p>' +
        howItWorks(al);
      page.innerHTML = al.page({ body: body });
      return;
    }

    body += al.tabs([
      { id: "board", label: "The board", count: listings.length || "" },
      { id: "bids", label: "Your offers", count: bids.length || "" },
      { id: "sell", label: "Selling" },
      { id: "deals", label: "Done deals" },
    ], ST.tab);

    // THE BANK GOVERNS EVERY CONTROL ON THE PAGE, so it is stated before them.
    if (bank != null) {
      body += al.decide({
        kind: bank > 0 ? "done" : "act",
        title: "In the bank: " + money(bank),
        note: bids.length
          ? bids.length + " sealed offer" + (bids.length === 1 ? "" : "s") + " on the table · nothing is bought on credit"
          : "Nothing is bought on credit — an offer you cannot cover is refused before it is filed.",
      });
    }

    if (ST.tab === "deals") {
      var deals = snap.deals || [];
      body += al.sec("Done deals · the last forty", deals.length
        ? al.ledger(deals.map(function (d) {
            return [d.player + " · " + (d.from || "?") + " → " + (d.to || "?"), money(d.fee), "pos"];
          }))
        : al.empty("Nothing has changed hands", "No cricketer has moved yet. The first one will be remembered."));
    } else if (ST.tab === "sell") {
      body += sellSec(al, st, mine);
    } else if (ST.tab === "bids") {
      body += al.sec("Your offers · sealed until the window shuts", bids.length
        ? al.ledger(bids.map(function (b) {
            return [b.player + " · " + closesIn(b.closes).txt, money(b.amount)];
          }))
        : al.empty("Nothing on the table", "You have made no offers. Nobody can see that either."));
    } else {
      body += al.sec("On the board · " + listings.length, listings.length
        ? '<div class="al-lots">' + listings.map(function (L) { return lot(al, L, bidBy[L.id], repBy[L.id]); }).join("") + "</div>"
        : al.empty("Nothing on the board this minute",
            "Clubs put men up as their shape changes. Look in tomorrow."));
    }

    body += howItWorks(al);
    page.innerHTML = al.page({ body: body });
    wire(page, snap, mine, st);
  }

  function lot(al, L, myBid, report) {
    var s = L.scout || {}, c = closesIn(L.closes);
    var floor = Math.ceil(L.asking * 0.55);
    var out = '<div class="al-lot' + (myBid ? " al-lot--mine" : "") + '">' +
      '<div class="al-lot__h"><b>' + E(s.name || L.player || "A cricketer") + "</b>" +
      (s.impression ? "<i>" + E(s.impression) + "</i>" : "") +
      '<span class="al-lot__clock' + (c.soon ? " al-lot__clock--soon" : "") + '">' + c.txt + "</span></div>" +
      '<p class="al-lot__line">' + E(s.role || "cricketer") + " · age " + (s.age || "?") +
      (s.hand ? " · " + E(s.hand) : "") + (s.bowl ? " · " + E(s.bowl) : "") + "<br>" +
      "From <b>" + E(L.club || "a club") + "</b> · asking <b>" + money(L.asking) + "</b> · " +
      L.bids + " offer" + (L.bids === 1 ? "" : "s") + " in</p>";

    // A MAN YOU DO NOT OWN IS A FIRST IMPRESSION until you pay for a report;
    // then he is bands and words, never a rival's numbers.
    if (report) {
      var r = window.foMktReport ? window.foMktReport(report) : null;
      if (r) {
        var rows = [["Batting", r.batting]];
        if (r.bowling) rows.push(["Bowling", r.bowling]);
        rows.push(["Fielding", r.fielding], ["Form", r.form], ["Legs", r.legs], ["Wage", money(r.wage)]);
        if (r.talentNames && r.talentNames.length) rows.push(["Talents", r.talentNames.join(", ")]);
        out += al.ledger(rows);
      }
    }

    out += '<div class="al-lot__act">' +
      (report ? "" : '<button type="button" class="al-btn" data-mk-scout="' + L.id + '">Scout · ' + money(L.fee) + "</button>") +
      '<input class="al-field al-field--grow" type="number" inputmode="numeric" id="fo-mk-bid-' + L.id +
        '" placeholder="' + floor + '+" value="' + (myBid ? myBid.amount : "") + '" aria-label="Your sealed offer">' +
      '<button type="button" class="al-btn al-btn--primary" data-mk-bid="' + L.id + '">' +
        (myBid ? "Change offer" : "Offer") + "</button>" +
      (myBid ? '<button type="button" class="al-btn" data-mk-unbid="' + L.id + '">Withdraw</button>' : "") +
      "</div>" +
      (myBid ? '<p class="al-lot__line">Your sealed offer: <b>' + money(myBid.amount) + "</b>. Nobody else can see it.</p>" : "") +
      al.msg("fo-mk-m-" + L.id) + "</div>";
    return out;
  }

  function sellSec(al, st, mine) {
    var squad = (st && st.squad) || [];
    var sales = (mine && mine.sales) || [];
    var put = squad.length
      ? '<select class="al-field al-field--block" id="fo-mk-who" aria-label="Player">' +
          squad.map(function (p) {
            return '<option value="' + E(p.name) + '">' + E(p.name) + " · " + (p.age || "?") + " · " + money(p.fee || 0) + "</option>";
          }).join("") + "</select>" +
        '<div class="al-lot__act">' +
          '<input class="al-field al-field--grow" type="number" inputmode="numeric" id="fo-mk-res" placeholder="Your reserve" aria-label="Reserve">' +
          '<button type="button" class="al-btn al-btn--primary" id="fo-mk-list">Put him up</button></div>' +
        al.msg("fo-mk-mlist") +
        '<p class="al-read">Three on the board at once, and never below a squad of fourteen.</p>'
      : al.empty("Your squad is not down from the world yet", "Look in again in a minute.");

    return al.sec("Put a man up",
      "<p>Name a reserve and walk away. The window runs three days; if the best sealed offer reaches your reserve he goes, " +
      "and if it does not he stays. You never have to be here for any of it.</p>" + put) +
      al.sec("Your sales", sales.length
        ? '<div class="al-lots">' + sales.map(function (s2) {
            var c = closesIn(s2.closes);
            var state = s2.status === "sold" ? "sold" : s2.status === "unsold" ? "nobody met the reserve"
              : s2.bids + " offer" + (s2.bids === 1 ? "" : "s") + " · " + c.txt;
            return '<div class="al-lot"><div class="al-lot__h"><b>' + E(s2.player) + "</b>" +
              '<span class="al-lot__clock">' + money(s2.status === "sold" ? s2.fee : s2.reserve) + "</span></div>" +
              '<p class="al-lot__line">' + E(state) + "</p>" +
              (s2.status === "open" && !s2.bids
                ? '<div class="al-lot__act"><button type="button" class="al-btn" data-mk-pull="' + s2.id + '">Take him back</button></div>'
                : "") + "</div>";
          }).join("") + "</div>"
        : al.empty("Nobody of yours is on the board", "Your squad is intact."));
  }

  function howItWorks(al) {
    return al.sec("How the market works",
      "<p>Every offer is <b>sealed</b>. You cannot see anybody else's and nobody can see yours — not the seller, not the " +
      "other bidders — until the umpire opens them all at once. There is nothing to be gained by watching this page, which " +
      "is the entire point.</p>" +
      "<p>A listing stands <b>three world days</b>. When it shuts, the highest offer at or above the seller's reserve takes " +
      "him: the fee leaves one bank and lands in the other, the man walks into his new dressing room with his record intact, " +
      "and neither club had to be awake.</p>" +
      "<p>You read <b>your own</b> men exactly. Somebody else's is a first impression until you pay a scout, and then he is " +
      "bands and words — his form, his legs, what he earns. Nobody, ever, gets a rival's numbers.</p>" +
      "<p>Nothing is bought on credit. A club is never stripped below fourteen men, and eighteen is a full staff — sell " +
      "before you buy.</p>");
  }

  // the paid report, rendered from the man's own card - the same arithmetic
  // the service uses, kept here so a report a manager has already bought
  // renders without another round trip
  window.foMktReport = function (p) {
    if (!p) return null;
    var S = p.skills || {};
    var band = function (v, w) { var lo = Math.max(0, Math.round((v - w / 2) / 5) * 5); return lo + "-" + (lo + w); };
    var FORMW = ["abysmal", "poor", "shaky", "steady", "good", "strong", "excellent"];
    var bat = Math.round(0.25 * (S.vsPace || 0) + 0.25 * (S.vsSpin || 0) + 0.2 * (S.rotation || 0)
      + 0.15 * (S.temperament || 0) + 0.15 * (S.power || 0));
    var bowl = (p.bowlType && p.bowlType !== "none")
      ? Math.round(((S.wicket || 0) + (S.economy || 0) + (S.discipline || 0) + (S.moveTurn || 0)
        + (S.variation || 0) + (S.stamina || 0)) / 6) : 0;
    var fld = Math.round(((S.fielding || 0) + (S.catching || 0)) / 2);
    return { batting: band(bat, 10), bowling: bowl ? band(bowl, 10) : null, fielding: band(fld, 12),
      form: FORMW[p.formIx == null ? 3 : p.formIx], legs: p.fatWord || p.fatigue || "rested",
      wage: p.wage || 0, talentNames: (p.talents || []).slice(0, 3) };
  };

  function wire(page, snap, mine, st) {
    page.querySelectorAll("[data-al-tab]").forEach(function (b) {
      b.addEventListener("click", function () { ST.tab = b.getAttribute("data-al-tab"); render(page, snap, mine, st); });
    });
    var say = function (id, txt, ok) {
      var el = document.getElementById(id); if (!el) return;
      el.textContent = txt; el.className = "al-msg" + (ok ? " al-msg--ok" : "");
    };
    var go = function (attr, fn, args, msgId) {
      page.querySelectorAll("[" + attr + "]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (ST.busy) return;
          var id = +b.getAttribute(attr);
          var a = args(id); if (a === null) return;
          ST.busy = 1; b.disabled = true;
          rpc(fn, a).then(function () { ST.busy = 0; window.foRenderMarketPage(); })
            .catch(function (e) {
              ST.busy = 0; b.disabled = false;
              say(msgId(id), String(e.message).slice(0, 140));
            });
        });
      });
    };
    go("data-mk-scout", "world_market_scout", function (id) { return { p_id: id }; },
      function (id) { return "fo-mk-m-" + id; });
    go("data-mk-unbid", "world_market_unbid", function (id) { return { p_id: id }; },
      function (id) { return "fo-mk-m-" + id; });
    go("data-mk-pull", "world_market_withdraw", function (id) { return { p_id: id }; },
      function () { return "fo-mk-mlist"; });
    go("data-mk-bid", "world_market_bid", function (id) {
      var el = document.getElementById("fo-mk-bid-" + id);
      var v = el ? Math.round(+el.value || 0) : 0;
      if (!v) { say("fo-mk-m-" + id, "Name a figure first."); return null; }
      return { p_id: id, p_amount: v };
    }, function (id) { return "fo-mk-m-" + id; });

    var list = page.querySelector("#fo-mk-list");
    if (list) list.addEventListener("click", function () {
      if (ST.busy) return;
      var who = document.getElementById("fo-mk-who"), res = document.getElementById("fo-mk-res");
      var v = res ? Math.round(+res.value || 0) : 0;
      if (!who || !who.value) { say("fo-mk-mlist", "Pick a man."); return; }
      if (!v) { say("fo-mk-mlist", "Name a reserve - the least you will let him go for."); return; }
      ST.busy = 1; list.disabled = true;
      rpc("world_market_list", { p_player: who.value, p_reserve: v })
        .then(function () { ST.busy = 0; window.foRenderMarketPage(); })
        .catch(function (e) { ST.busy = 0; list.disabled = false; say("fo-mk-mlist", String(e.message).slice(0, 140)); });
    });
  }
})();
