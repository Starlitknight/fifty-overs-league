/* ============================================================================
   THE BOOKS (#/finance) — where every pound came from, and where it went.

   The umpire keeps a real ledger. He walks it from the day the club was founded
   ($2.5m in the treasury), round by round, and every line of it is DERIVED from
   the record: who played whom, who won, where the club stood that morning, how
   many people fancied going, what the weather did, who was sold, who was called
   up by his country. Nothing is incremented and nothing is stored that a re-run
   could not rebuild - settle it twice and it settles the same figure, which is
   what lets a manager who was asleep trust it.

   So this page does not model anything. It READS that ledger (world_my_status
   carries it) and lays it out the way a treasurer would:

     THE BANK       what is there, against what he was founded with
     MONEY IN       gate, away cut, sponsor, international fees, transfers in
     MONEY OUT      wages, the academy, the ground, scouting, transfers out,
                    interest on an overdraft
     THE CROWD      supporters, their mood, the gate they turned into - the
                    reason the biggest line in the ledger is the size it is
     THE GROUND     seats, what the next stand costs, and whether he can afford
                    it - the one place on this page money can be SPENT
     THE WAGE BILL  what the squad costs a round, and who the earners are

   Every figure has a note saying what moves it, because a number a manager
   cannot act on is trivia. The two levers (build a stand, upgrade the academy)
   are the club's real capital decisions, and both go through the server's own
   RPCs, which re-check affordability - the page could lie all it liked.
   ========================================================================== */
(function () {
  "use strict";
  if (window.__foFin) return; window.__foFin = 1;

  var SB_URL = "https://egaipdksvztqqgouriyc.supabase.co";
  var SB_ANON = "sb_publishable_x4d37g01BstZDMUiKrGeGA_meQ_Phgc";
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
  // money, three ways: the full figure, the short one, and a signed delta
  function M(v) {
    var n = Math.round(Number(v) || 0), neg = n < 0;
    n = Math.abs(n);
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-$" : "$") + s;
  }
  function Mk(v) {
    var n = Number(v) || 0, neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 1 : 2) + "m"
          : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "-$" : "$") + s;
  }
  function Msign(v) { var n = Math.round(Number(v) || 0); return (n > 0 ? "+" : "") + M(n); }
  function pct(a, b) { return b > 0 ? Math.max(0, Math.min(100, Math.round(100 * a / b))) : 0; }

  var MOOD_COL = ["#B23B2C", "#C0562C", "#B58128", "#8A8272", "#4F8F63", "#2E8C5F", "#1E8C63"];

  function foFinCss() {
    if (document.getElementById("fo-fin-css")) return;
    var s = document.createElement("style"); s.id = "fo-fin-css";
    s.textContent = [
      "html body.fo-fin-on{background:#E9E4D8 !important}",
      "html body.fo-fin-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body #page .fo-fin{--ink:#141C28;--paper:#FFFEFC;--band:#F4EFE3;--brand:#C95532;--gold:#C89A2E;--navy:#0E2246;",
      "  max-width:1120px;margin:0 auto;padding:26px 16px 44px;color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
      "#page .fo-fin *{box-sizing:border-box}",
      // masthead
      ".fo-fin-k{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:var(--brand)}",
      ".fo-fin-k:after{content:'';display:block;width:34px;border-top:2px solid var(--brand);margin-top:7px}",
      ".fo-fin h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:clamp(30px,4vw,46px);letter-spacing:-.02em;line-height:1.02;margin:11px 0 6px}",
      ".fo-fin-sub{font:italic 420 14px/1.55 'Fraunces',Georgia,serif;color:rgba(20,28,40,.62);margin:0 0 20px;max-width:64ch}",
      // the bank
      ".fo-fin-bank{background:linear-gradient(160deg,#0E2246,#0A1A34 72%);border-radius:18px;padding:22px 24px;color:#EAF0FB;box-shadow:0 18px 44px rgba(10,26,52,.28);border-bottom:3px solid var(--brand)}",
      ".fo-fin-bank .lb{font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:.24em;text-transform:uppercase;color:#8FA8CC}",
      // the skin colours bare b and i, so the treasury card has to out-rank it
      // or the biggest number on the page is navy ink on a navy card
      "html body #page .fo-fin-bank b,html body.ftpskin #page .fo-fin-bank b{display:block;font-family:Oswald,sans-serif;font-weight:700;font-size:clamp(34px,5vw,54px);line-height:1;margin:6px 0 2px;font-variant-numeric:tabular-nums;color:#FFFEFC !important}",
      ".fo-fin-walk{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:14px;padding-top:13px;border-top:1px solid rgba(143,168,204,.22)}",
      ".fo-fin-walk div{display:flex;flex-direction:column;gap:3px}",
      ".fo-fin-walk span{font-family:Oswald,sans-serif;font-size:8.5px;letter-spacing:.18em;text-transform:uppercase;color:#8FA8CC}",
      "html body #page .fo-fin-walk i{font-style:normal;font-family:Oswald,sans-serif;font-size:15px;font-variant-numeric:tabular-nums;color:#FFFEFC !important}",
      "html body #page .fo-fin-walk i.fo-fin-up{color:#7BD3A6 !important}html body #page .fo-fin-walk i.fo-fin-dn{color:#F0A090 !important}",
      // the administration banner
      ".fo-fin-admin{margin-top:14px;background:#FBE9E4;border:1px solid rgba(201,85,50,.4);border-left:4px solid var(--brand);border-radius:12px;padding:14px 16px}",
      ".fo-fin-admin b{display:block;font-family:Oswald,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9E3520;margin-bottom:5px}",
      ".fo-fin-admin p{margin:0;font:400 13px/1.6 Inter,sans-serif;color:rgba(20,28,40,.8)}",
      // the two ledgers
      ".fo-fin-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}",
      ".fo-fin-card{background:var(--paper);border:1px solid rgba(20,28,40,.1);border-radius:16px;padding:17px 19px;box-shadow:0 8px 24px rgba(30,38,52,.07)}",
      ".fo-fin-card h2{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--brand);margin:0 0 3px}",
      ".fo-fin-card .cap{font:italic 420 12.5px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.55);margin:0 0 13px}",
      ".fo-fin-l{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;padding:9px 0;border-bottom:1px solid rgba(20,28,40,.07)}",
      ".fo-fin-l:last-of-type{border-bottom:0}",
      "html body #page .fo-fin-l b{font:600 13.5px/1.3 Inter,sans-serif;color:var(--ink)}",
      ".fo-fin-l em{grid-column:1;font:400 11.5px/1.45 Inter,sans-serif;font-style:normal;color:rgba(20,28,40,.52)}",
      ".fo-fin-l u{grid-column:2;grid-row:1;text-decoration:none;font-family:Oswald,sans-serif;font-weight:600;font-size:15px;font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap}",
      ".fo-fin-l.zero u,.fo-fin-l.zero b{color:rgba(20,28,40,.34)}",
      ".fo-fin-tot{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:12px;padding-top:12px;border-top:2px solid rgba(20,28,40,.16)}",
      ".fo-fin-tot span{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:rgba(20,28,40,.55)}",
      "html body #page .fo-fin-tot b{font-family:Oswald,sans-serif;font-weight:700;font-size:22px;font-variant-numeric:tabular-nums}",
      "html body #page .fo-fin-in .fo-fin-tot b{color:#1E7A55 !important}html body #page .fo-fin-out .fo-fin-tot b{color:#B23B2C !important}",
      // the net line
      ".fo-fin-net{margin-top:16px;background:var(--band);border:1px solid rgba(20,28,40,.12);border-radius:14px;padding:15px 19px;display:flex;flex-wrap:wrap;gap:10px 26px;align-items:baseline}",
      ".fo-fin-net .who{font-family:Oswald,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.55)}",
      ".fo-fin-net .big{font-family:Oswald,sans-serif;font-weight:700;font-size:26px;font-variant-numeric:tabular-nums}",
      ".fo-fin-net .note{font:italic 420 12.5px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);flex:1 1 240px;min-width:200px}",
      // the crowd + the ground
      ".fo-fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}",
      ".fo-fin-stat{display:flex;justify-content:space-between;align-items:baseline;gap:10px;padding:8px 0;border-bottom:1px solid rgba(20,28,40,.07);font:400 13px/1.4 Inter,sans-serif}",
      ".fo-fin-stat:last-child{border-bottom:0}",
      ".fo-fin-stat span{color:rgba(20,28,40,.6)}",
      "html body #page .fo-fin-stat b{font-family:Oswald,sans-serif;font-weight:600;font-size:15px;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--ink)}",
      ".fo-fin-bar{margin:12px 0 4px;height:10px;border-radius:6px;background:rgba(20,28,40,.09);overflow:hidden}",
      ".fo-fin-bar i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#C95532,#E0A24A)}",
      ".fo-fin-barlbl{display:flex;justify-content:space-between;font:600 10.5px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:rgba(20,28,40,.5)}",
      ".fo-fin-mood{display:inline-flex;align-items:center;gap:8px;margin-top:11px;padding:6px 13px;border-radius:999px;background:rgba(20,28,40,.05);font-family:Oswald,sans-serif;font-size:11px;letter-spacing:.14em;text-transform:uppercase}",
      ".fo-fin-mood i{width:9px;height:9px;border-radius:50%;display:block}",
      // the levers
      ".fo-fin-buy{margin-top:14px;display:flex;flex-wrap:wrap;gap:9px;align-items:center}",
      "html body #page button.fo-fin-btn{font:700 11px Oswald,sans-serif !important;letter-spacing:.14em;text-transform:uppercase;color:#FFFEFC !important;background:var(--navy) !important;border:0 !important;border-radius:999px !important;padding:11px 18px !important;cursor:pointer;min-height:42px}",
      "html body #page button.fo-fin-btn:hover{background:#16345F !important}",
      "html body #page button.fo-fin-btn[disabled]{background:rgba(20,28,40,.14) !important;color:rgba(20,28,40,.42) !important;cursor:not-allowed}",
      ".fo-fin-why{font:italic 420 12px/1.5 'Fraunces',Georgia,serif;color:rgba(20,28,40,.6);flex:1 1 200px}",
      ".fo-fin-msg{margin-top:10px;font:600 12.5px/1.5 Inter,sans-serif;color:#1E7A55}",
      ".fo-fin-msg.bad{color:#B23B2C}",
      // the wage bill
      ".fo-fin-wg{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px 14px;align-items:baseline;margin-top:11px}",
      ".fo-fin-wg .nm{font:600 13px/1.3 Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-fin-wg .rl{font-family:Oswald,sans-serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:rgba(20,28,40,.45);text-align:right}",
      ".fo-fin-wg .wg{font-family:Oswald,sans-serif;font-weight:600;font-size:14px;font-variant-numeric:tabular-nums;text-align:right}",
      ".fo-fin-note{margin-top:22px;font:italic 420 12.5px/1.65 'Fraunces',Georgia,serif;color:rgba(20,28,40,.55);max-width:74ch}",
      // THE STATEMENT: a bank's own furniture - a day rule, a row per entry,
      // the amount and the balance in tabular figures so columns of money
      // line up on the decimal the way a treasurer expects
      "html body #page .fo-fin-stlink{display:block;margin-top:18px;padding:14px 16px;background:var(--paper) !important;border:1px solid rgba(20,28,40,.14);border-left:3px solid var(--brand);border-radius:12px;font:600 13px/1.4 Inter,sans-serif;color:#0E2246 !important;text-decoration:none !important}",
      ".fo-st-tabs{display:flex;gap:7px;margin:18px 0 12px;flex-wrap:wrap}",
      "html body #page .fo-st-tab{font:700 10.5px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(20,28,40,.6) !important;background:var(--paper) !important;border:1px solid rgba(20,28,40,.16) !important;border-radius:999px !important;padding:0 16px !important;min-height:40px;cursor:pointer}",
      "html body #page .fo-st-tab.on{color:#FFFEFC !important;background:#0E2246 !important;border-color:#0E2246 !important}",
      ".fo-st-head{display:grid;grid-template-columns:46px minmax(0,1fr) 96px 96px;gap:10px;padding:0 12px 7px;font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      ".fo-st-head span:nth-child(3),.fo-st-head span:nth-child(4){text-align:right}",
      ".fo-st-list{background:var(--paper);border:1px solid rgba(20,28,40,.12);border-radius:14px;overflow:hidden}",
      ".fo-st-day{padding:9px 13px;background:rgba(14,34,70,.055);font:700 9.5px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#0E2246;border-top:1px solid rgba(20,28,40,.09)}",
      ".fo-st-list .fo-st-day:first-child{border-top:0}",
      ".fo-st-row{display:grid;grid-template-columns:46px minmax(0,1fr) 96px 96px;gap:10px;align-items:center;padding:10px 13px;border-top:1px solid rgba(20,28,40,.07)}",
      ".fo-st-row .t{font:600 11px/1 Oswald,sans-serif;color:rgba(20,28,40,.45);font-variant-numeric:tabular-nums}",
      ".fo-st-row .w{min-width:0}",
      ".fo-st-row .w b{display:block;font:600 13px/1.3 Inter,sans-serif;color:#141C28}",
      ".fo-st-row .w i{display:block;font-style:normal;font:400 11.5px/1.4 Inter,sans-serif;color:rgba(20,28,40,.55)}",
      ".fo-st-row .a,.fo-st-row .b{text-align:right;font:700 13px/1.2 Oswald,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-st-row.in .a{color:#1E7A55}.fo-st-row.out .a{color:#B23B2C}",
      ".fo-st-row .b{color:rgba(20,28,40,.5);font-weight:400}",
      ".fo-st-none{padding:22px 14px;text-align:center;font:400 13px/1.6 Inter,sans-serif;color:rgba(20,28,40,.55)}",
      "html body #page .fo-st-more{display:block;width:100%;margin-top:12px;font:700 11px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#0E2246 !important;background:var(--paper) !important;border:1px solid rgba(20,28,40,.18) !important;border-radius:12px !important;padding:0 !important;min-height:46px;cursor:pointer}",
      "html body #page .fo-st-more:disabled{opacity:.55;cursor:default}",
      "@media(max-width:560px){.fo-st-head{grid-template-columns:40px minmax(0,1fr) 84px;gap:8px}",
      ".fo-st-head span:nth-child(4){display:none}",
      ".fo-st-row{grid-template-columns:40px minmax(0,1fr) 84px;gap:8px;padding:10px}",
      ".fo-st-row .b{grid-column:2/4;text-align:right;margin-top:-4px;font-size:11px}}",
      ".fo-fin-foot{display:flex;gap:10px;justify-content:space-between;margin-top:20px;flex-wrap:wrap}",
      ".fo-fin-foot a{display:inline-flex;align-items:center;min-height:44px;font:600 12px Inter,sans-serif;color:rgba(20,28,40,.65);background:var(--paper);border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:0 17px;text-decoration:none}",
      ".fo-fin-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5)}",
      "@media(max-width:780px){.fo-fin-cols,.fo-fin-grid{grid-template-columns:1fr}",
      ".fo-fin{padding:18px 12px 40px}.fo-fin-bank{padding:18px}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  // ---- one ledger line: figure, name, and what moves it ----------------------
  function line(nm, v) {
    var zero = !Math.round(Number(v) || 0);
    return "<div class='fo-fin-l" + (zero ? " zero" : "") + "'><b>" + E(nm) + "</b>" +
      "<u>" + M(v) + "</u></div>";
  }
  function stat(nm, val) {
    return "<div class='fo-fin-stat'><span>" + E(nm) + "</span><b>" + val + "</b></div>";
  }

  function shell(body) {
    return "<div class='fo-fin'>" + body + "</div>";
  }
  function head(clubNm, sub) {
    return "<div class='fo-fin-k'>The books</div>" +
      "<h1>" + E(clubNm || "Your club") + "</h1>" +
      (sub ? "<p class='fo-fin-sub'>" + sub + "</p>" : "");
  }

  function render(page, st) {
    var f = (st && st.finance) || {}, bank = Number(st && st.bank) || 0;
    var clubNm = (st.claim && st.claim.club) || "Your club";
    var founded = Number(f.founded) || 2500000;
    var rounds = Number(f.rounds) || 0;
    var swing = bank - founded;

    // ---- money in --------------------------------------------------------
    var inGate = Number(f.gate) || 0, inAway = Number(f.awayCut) || 0;
    var inSpon = Number(f.sponsor) || 0, inComp = Number(f.compensation) || 0;
    var inFees = Number(f.feesIn) || 0;
    var totIn = inGate + inAway + inSpon + inComp + inFees;

    // ---- money out -------------------------------------------------------
    var outWage = Number(f.wages) || 0, outUp = Number(f.upkeep) || 0;
    var outInt = Number(f.interest) || 0, outFees = Number(f.feesOut) || 0;
    var outScout = Number(f.scouting) || 0;
    var outAcad = Number(f.academyPaid) || 0, outSeats = Number(f.seatsPaid) || 0;
    var totOut = outWage + outUp + outInt + outFees + outScout + outAcad + outSeats;

    var perRound = rounds ? (totIn - outWage - outUp - outInt) / rounds : 0;

    var html = head(clubNm, "");

    // ---- the bank --------------------------------------------------------
    html += "<div class='fo-fin-bank'><div class='lb'>In the treasury</div>" +
      "<b>" + M(bank) + "</b>" +
      "<div class='fo-fin-walk'>" +
      "<div><span>Founded with</span><i>" + M(founded) + "</i></div>" +
      "<div><span>Since then</span><i class='" + (swing >= 0 ? "fo-fin-up" : "fo-fin-dn") + "'>" + Msign(swing) + "</i></div>" +
      "<div><span>Rounds settled</span><i>" + rounds + "</i></div>" +
      "<div><span>A round is worth</span><i class='" + (perRound >= 0 ? "fo-fin-up" : "fo-fin-dn") + "'>" + Msign(Math.round(perRound)) + "</i></div>" +
      "</div></div>";

    if (f.administration) {
      html += "<div class='fo-fin-admin'><b>The club is in administration</b>" +
        "<p>The bank has reached the floor of " + M(-(Number(f.debtLimit) || 2500000)) + " - as deep as a hole gets here, so " +
        M(Number(f.writtenOff) || 0) + " of losses below the line has been written off. While the club is under, " +
        "the sponsor pays half his cheque and nothing gets built. " +
        (f.adminRounds ? "That has been the case for " + f.adminRounds + " round" + (f.adminRounds === 1 ? "" : "s") + ". " : "") +
        "Win, fill the ground, and trim the wage bill: those are the ways out.</p></div>";
    }

    // ---- the two ledgers -------------------------------------------------
    html += "<div class='fo-fin-cols'>" +
      "<section class='fo-fin-card fo-fin-in'><h2>Money in</h2>" +
      line("The gate", inGate) +
      line("Away cut", inAway) +
      line("Sponsor", inSpon) +
      line("International fees", inComp) +
      line("Transfers in", inFees) +
      "<div class='fo-fin-tot'><span>Taken</span><b>" + M(totIn) + "</b></div></section>" +

      "<section class='fo-fin-card fo-fin-out'><h2>Money out</h2>" +
      line("Wages", outWage) +
      line("Upkeep", outUp) +
      line("Transfers out", outFees) +
      line("Scouting", outScout) +
      line("Building", outAcad + outSeats) +
      line("Interest", outInt) +
      "<div class='fo-fin-tot'><span>Paid</span><b>" + M(totOut) + "</b></div></section>" +
      "</div>";

    var net = totIn - totOut;
    html += "<div class='fo-fin-net'><span class='who'>Taken less paid</span>" +
      "<span class='big " + (net >= 0 ? "fo-fin-up" : "fo-fin-dn") + "' style='color:" + (net >= 0 ? "#1E7A55" : "#B23B2C") + "'>" + Msign(net) + "</span>" +
      "<span class='note'>" + (net >= 0
        ? "The club is paying for itself. What it earns above the wage bill is what pays for stands and colts."
        : "The club is living on its founding money. That is allowed - it is what the money is for - but the sum above is how fast it is going.") +
      "</span></div>";

    // ---- the crowd + the ground ------------------------------------------
    var sup = Number(f.supporters) || 0, seats = Number(f.seats) || 0;
    var lastAtt = Number(f.lastAttendance) || 0, avgAtt = Number(f.avgAttendance) || 0;
    var mood = Math.max(0, Math.min(6, Number(f.mood) || 0));
    var full = pct(lastAtt, seats);

    html += "<div class='fo-fin-grid'>" +
      "<section class='fo-fin-card'><h2>The crowd</h2>" +
      stat("Supporters on the books", sup.toLocaleString()) +
      stat("Last home crowd", lastAtt ? lastAtt.toLocaleString() + " of " + seats.toLocaleString() : "&mdash;") +
      stat("Average this season", avgAtt ? avgAtt.toLocaleString() : "&mdash;") +
      stat("Ticket", M(f.ticket || 26)) +
      (f.lastWeather ? stat("Weather last time", E(String(f.lastWeather))) : "") +
      (lastAtt ? "<div class='fo-fin-bar'><i style='width:" + full + "%'></i></div>" +
        "<div class='fo-fin-barlbl'><span>" + full + "% full</span><span>" + seats.toLocaleString() + " seats</span></div>" : "") +
      "<div class='fo-fin-mood'><i style='background:" + MOOD_COL[mood] + "'></i>" +
      "The support is " + E(String(f.moodWord || "patient")) + "</div>" +
      "</section>" +

      "<section class='fo-fin-card'><h2>The ground</h2>" +
      stat("Seats", seats.toLocaleString()) +
      stat("Spent on stands", M(outSeats)) +
      stat("Academy level", (Number(st.academy) || 1) + " of 5") +
      stat("Spent on the academy", M(outAcad)) +
      renderBuild(f, bank, st) +
      "<div class='fo-fin-msg' id='fo-fin-msg'></div>" +
      "</section></div>";

    // ---- the wage bill ---------------------------------------------------
    var squad = (st.squad || []).slice().filter(function (p) { return p && p.name; });
    squad.sort(function (a, b) { return (Number(b.wage) || 0) - (Number(a.wage) || 0); });
    var top = squad.slice(0, 6);
    var billNow = squad.reduce(function (s2, p) { return s2 + (Number(p.wage) || 0); }, 0);
    if (top.length) {
      html += "<section class='fo-fin-card' style='margin-top:16px'><h2>The wage bill</h2>" +
        "<p class='cap'>" + M(billNow) + " a round across " + squad.length + " professionals" +
        (rounds ? ", and " + M(outWage) + " paid out so far" : "") + ". The highest earners:</p>" +
        "<div class='fo-fin-wg'>" + top.map(function (p) {
          var role = p.bowlType ? "bowls" : "bats";
          return "<span class='nm'>" + E(p.name) + "</span>" +
            "<span class='rl'>" + (p.age ? (p.age | 0) + " &middot; " : "") + role + "</span>" +
            "<span class='wg'>" + M(p.wage) + "</span>";
        }).join("") + "</div>" +
        "</section>";
    }

    // every total above is a sum of dated entries, and this is where they are
    html += "<a class='fo-fin-stlink' href='#/statement'>&#128220; The statement &mdash; every entry, dated, with the balance after it &rsaquo;</a>";
    html += "<div class='fo-fin-foot'><a href='#/squad'>&lsaquo; The squad</a><a href='#/league'>My league &rsaquo;</a></div>";

    page.innerHTML = shell(html);
    wire(page, f, bank, st);
  }

  // ---- the two capital decisions ---------------------------------------------
  function renderBuild(f, bank, st) {
    var out = "<div class='fo-fin-buy'>";
    var ns = Number(f.nextSeats) || 0, nc = Number(f.nextSeatsCost) || 0;
    if (ns && nc) {
      var can = bank >= nc && !f.administration;
      out += "<button type='button' class='fo-fin-btn' id='fo-fin-seats'" + (can ? "" : " disabled") + ">" +
        "Build to " + ns.toLocaleString() + " &middot; " + Mk(nc) + "</button>" +
        "<span class='fo-fin-why'>" + (f.administration ? "Nothing gets built while the club is in administration."
          : can ? "A thousand more seats, and the crowd has somewhere to sit."
          : "The treasury is " + Mk(nc - bank) + " short of that.") + "</span>";
    } else {
      out += "<span class='fo-fin-why'>Forty-five thousand is as big as a ground gets here, and yours is there.</span>";
    }
    var lv = Number(st.academy) || 1;
    if (lv < 5) {
      var acost = lv * 60000, canA = bank >= acost && !f.administration;
      out += "<button type='button' class='fo-fin-btn' id='fo-fin-acad'" + (canA ? "" : " disabled") + ">" +
        "Academy level " + (lv + 1) + " &middot; " + Mk(acost) + "</button>" +
        "<span class='fo-fin-why'>" + (f.administration ? "Not while the club is under."
          : canA ? "Better nets for the colts: every level is eight per cent on what they learn."
          : "That is " + Mk(acost - bank) + " more than the treasury holds.") + "</span>";
    }
    return out + "</div>";
  }

  function wire(page, f, bank, st) {
    var msg = page.querySelector("#fo-fin-msg");
    var say = function (t, bad) { if (!msg) return; msg.textContent = t; msg.className = "fo-fin-msg" + (bad ? " bad" : ""); };
    var seats = page.querySelector("#fo-fin-seats");
    if (seats) seats.addEventListener("click", function () {
      var want = Number(f.nextSeats) || 0;
      if (!confirm("Build " + want.toLocaleString() + " seats for " + M(f.nextSeatsCost) + "? A stand is never taken down again.")) return;
      seats.disabled = true; say("Laying the concrete…");
      rpc("world_set_stadium", { p_seats: want })
        .then(function (r) { say("Built. The ground holds " + (r && r.seats ? Number(r.seats).toLocaleString() : want.toLocaleString()) + " now."); reload(page); })
        .catch(function (e) { seats.disabled = false; say(String(e.message).slice(0, 160), true); });
    });
    var acad = page.querySelector("#fo-fin-acad");
    if (acad) acad.addEventListener("click", function () {
      var lv = (Number(st.academy) || 1) + 1;
      if (!confirm("Take the academy to level " + lv + " for " + M((lv - 1) * 60000) + "?")) return;
      acad.disabled = true; say("Signing the builders…");
      rpc("world_set_academy", { p_level: lv })
        .then(function () { say("The academy is level " + lv + ". The colts will feel it in the nets."); reload(page); })
        .catch(function (e) { acad.disabled = false; say(String(e.message).slice(0, 160), true); });
    });
  }
  function reload(page) {
    setTimeout(function () { try { window.foRenderFinancePage(); } catch (e) {} }, 700);
  }

  // ==========================================================================
  // THE STATEMENT (#/statement) — the same ledger, entry by entry.
  //
  // The books above tell a manager what his club has taken and spent. They
  // cannot tell him WHEN, or which match, or why a fortnight went wrong -
  // and a total nobody can trace back to a day is a number, not an account.
  // The umpire walks every movement from the founding to settle those totals,
  // so every entry already exists in order; it is now written down as it is
  // counted, and this reads it back the way a bank reads a statement: newest
  // first, dated to the hour, with the balance the club was left holding.
  //
  // It is your own club only. A rival can read your wage bill off your
  // dossier; he does not get your bank.
  // ==========================================================================
  // the type a treasurer would head the column with. The umpire's own label
  // for an entry always OPENS with this type and then says what was
  // particular about it, so the row prints the type in full and only the
  // remainder underneath - never the same words twice.
  var STK = {
    founding: "Founding capital", academy: "Academy building",
    stadium: "Stadium building", gate: "Gate takings",
    "gate-away": "Away share", sponsor: "Sponsor",
    compensation: "International compensation", wages: "Player wages",
    upkeep: "Academy upkeep", interest: "Overdraft interest",
    "player-sale": "Player sales", "player-buy": "Player purchases",
    scouting: "Scouting reports", "written-off": "Written off"
  };
  function stDetail(type, label) {
    label = String(label || "");
    if (label === type) return "";
    if (label.indexOf(type) === 0) return label.slice(type.length).replace(/^[\s,\u00b7\-]+/, "");
    return label;
  }
  var DW3 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MO3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function stDate(ms) {
    var d = new Date(Number(ms) || 0), p2 = function (n) { return (n < 10 ? "0" : "") + n; };
    return { day: DW3[d.getDay()] + " " + d.getDate() + " " + MO3[d.getMonth()] + " " + d.getFullYear(),
      time: p2(d.getHours()) + ":" + p2(d.getMinutes()),
      key: d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()) };
  }

  var SM = { lines: [], more: false, entries: 0, club: "", bank: 0, filter: "all", busy: false, loaded: false };

  function stRows() {
    var rows = SM.lines.filter(function (l) {
      return SM.filter === "all" || (SM.filter === "in" ? l.amount > 0 : l.amount < 0);
    });
    if (!rows.length) {
      return "<div class='fo-st-none'>" + (SM.entries
        ? "Nothing under that heading yet."
        : "The statement opens when the umpire settles your first round.") + "</div>";
    }
    var out = "", lastKey = "";
    rows.forEach(function (l) {
      var d = stDate(l.at), type = STK[l.kind] || l.kind, det = stDetail(type, l.label);
      if (d.key !== lastKey) {
        lastKey = d.key;
        out += "<div class='fo-st-day'>" + E(d.day) + "</div>";
      }
      var income = l.amount > 0;
      out += "<div class='fo-st-row" + (income ? " in" : " out") + "'>" +
        "<span class='t'>" + d.time + "</span>" +
        "<span class='w'><b>" + E(type) + "</b>" + (det ? "<i>" + E(det) + "</i>" : "") + "</span>" +
        "<span class='a'>" + (income ? "+" : "&minus;") + M(Math.abs(l.amount)) + "</span>" +
        "<span class='b'>" + M(l.balance) + "</span>" +
        "</div>";
    });
    return out;
  }

  function stPaint() {
    var page = document.getElementById("page"); if (!page) return;
    var tabs = [["all", "Everything"], ["in", "Money in"], ["out", "Money out"]].map(function (t) {
      return "<button type='button' class='fo-st-tab" + (SM.filter === t[0] ? " on" : "") + "' data-f='" + t[0] + "'>" + t[1] + "</button>";
    }).join("");
    var shown = SM.lines.filter(function (l) {
      return SM.filter === "all" || (SM.filter === "in" ? l.amount > 0 : l.amount < 0);
    }).length;
    page.innerHTML = shell(
      "<div class='fo-fin-k'>The statement</div><h1>" + E(SM.club || "Your club") + "</h1>" +
      "<div class='fo-fin-bank'><div class='lb'>In the treasury</div><b>" + M(SM.bank) + "</b>" +
      "<div class='fo-fin-walk'><div><span>Entries on file</span><i>" + SM.entries + "</i></div>" +
      "<div><span>Showing</span><i>" + shown + "</i></div></div></div>" +
      "<div class='fo-st-tabs'>" + tabs + "</div>" +
      "<div class='fo-st-head'><span>Time</span><span>What</span><span>Amount</span><span>Balance</span></div>" +
      "<div class='fo-st-list'>" + stRows() + "</div>" +
      (SM.more ? "<button type='button' id='fo-st-more' class='fo-st-more'" + (SM.busy ? " disabled" : "") + ">" +
        (SM.busy ? "Turning the page&hellip;" : "Earlier entries") + "</button>" : "") +
      "<div class='fo-fin-foot'><a href='#/finance'>&lsaquo; The books</a><a href='#/squad'>The squad &rsaquo;</a></div>");
    page.querySelectorAll(".fo-st-tab").forEach(function (b) {
      b.addEventListener("click", function () { SM.filter = b.getAttribute("data-f"); stPaint(); });
    });
    var more = document.getElementById("fo-st-more");
    if (more) more.addEventListener("click", function () {
      if (SM.busy) return;
      SM.busy = true; stPaint();
      var before = SM.lines.length ? SM.lines[SM.lines.length - 1].seq : null;
      rpc("world_my_statement", { p_limit: 60, p_before: before })
        .then(function (r) {
          SM.busy = false;
          SM.lines = SM.lines.concat((r && r.lines) || []);
          SM.more = !!(r && r.more);
          stPaint();
        })
        .catch(function () { SM.busy = false; SM.more = false; stPaint(); });
    });
  }

  window.foRenderStatementPage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foFinCss();
    document.body.classList.add("fo-fin-on");
    if (!jwt()) {
      page.innerHTML = shell(head("The statement",
        "Sign in to your Fifty Overs account and the treasurer will open the book."));
      return;
    }
    if (SM.loaded) { stPaint(); return; }
    page.innerHTML = shell(head("The statement", "Fetching the ledger&hellip;"));
    rpc("world_my_statement", { p_limit: 60 })
      .then(function (r) {
        SM.loaded = true;
        SM.club = (r && r.club) || ""; SM.bank = Number(r && r.bank) || 0;
        SM.entries = Number(r && r.entries) || 0;
        SM.lines = (r && r.lines) || []; SM.more = !!(r && r.more);
        stPaint();
      })
      .catch(function (e) {
        page.innerHTML = shell(head("The statement",
          E(String(e.message || "The world could not be reached.").slice(0, 140))) +
          "<div class='fo-fin-foot'><a href='#/finance'>&lsaquo; The books</a></div>");
      });
  };

  window.foRenderFinancePage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foFinCss();
    document.body.classList.add("fo-fin-on");
    page.innerHTML = shell(head("The books", "Walking down to the treasurer&rsquo;s office&hellip;"));
    if (!jwt()) {
      page.innerHTML = shell(head("The books",
        "The club&rsquo;s money is the club&rsquo;s, and the world keeps it. Sign in to the account that holds your club and the ledger is here."));
      return;
    }
    rpc("world_my_status").then(function (st) {
      if (!st || st.signedIn === false) {
        page.innerHTML = shell(head("The books", "Sign in first &mdash; these books belong to a club, and the world keeps them."));
        return;
      }
      if (!st.claim) {
        page.innerHTML = shell(head("The books",
          "You don&rsquo;t hold a club in the served world yet. One is claimed for you on the next load, and it comes with " +
          M(2500000) + " in the treasury."));
        return;
      }
      render(page, st);
    }).catch(function (e) {
      page.innerHTML = shell(head("The books",
        "The world could not be reached (" + E(String(e.message).slice(0, 90)) + "). The books are safe where they are &mdash; try again in a minute."));
    });
  };
  // ---- A DOOR IN THE MASTHEAD ------------------------------------------------
  // The books were reachable only from the hamburger index and the phone dock,
  // which on a desktop meant they were reachable only by someone who already
  // knew they existed. A manager looks for his money along the top of the page,
  // beside his squad, so that is where the pill goes. The phone drawer proxies
  // every pill in this row, so one link serves both.
  function ensureNavLink() {
    try {
      var wrap = document.querySelector("#topbar .fo-nav-scroll"); if (!wrap) return;
      var a = wrap.querySelector("a.fo-books-nav");
      if (!a) {
        a = document.createElement("a"); a.className = "fo-books-nav"; a.href = "#/finance"; a.textContent = "Books";
        a.addEventListener("click", function (ev) { ev.preventDefault(); location.hash = "#/finance"; if (typeof window.route === "function") window.route(); });
      }
      // beside the squad, after Fixtures if that pill has already landed
      if (a.parentNode !== wrap) {
        var anchor = wrap.querySelector("a.fo-fixtures") || wrap.querySelector("a[data-nav='squad']");
        if (anchor && anchor.nextSibling) wrap.insertBefore(a, anchor.nextSibling);
        else wrap.appendChild(a);
      }
      var h9 = (location.hash || "").split("?")[0];
      a.classList.toggle("on", h9 === "#/finance" || h9 === "#/statement");
      // Log out is furniture and belongs last, however late a pill arrives
      var out = wrap.querySelector("a.fo-logout");
      if (out && wrap.lastElementChild !== out) wrap.appendChild(out);
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () {
    var h8 = (location.hash || "").split("?")[0];
    if (h8 !== "#/finance" && h8 !== "#/statement") document.body.classList.remove("fo-fin-on");
    setTimeout(ensureNavLink, 90);
  });
  [200, 600, 1400].forEach(function (ms) { setTimeout(ensureNavLink, ms); });
})();
