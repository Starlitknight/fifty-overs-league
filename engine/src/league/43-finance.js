/* ============================================================================
   THE BOOKS (#/finance) — where every pound came from, and where it went.

   The umpire keeps a real ledger. He walks it from the day the club was founded
   - with whatever capital a club of that standing was founded on, which is not
   the same figure for a nation's flagship as for the bottom of the second
   division - round by round, and every line of it is DERIVED from
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
  // MFull: the one sanctioned exception - the page's largest numeral may
  // print in full (the Sheet's bank figure). Everything else follows the rule.
  function MFull(v) {
    var n = Math.round(Number(v) || 0), neg = n < 0;
    n = Math.abs(n);
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-$" : "$") + s;
  }
  function M(v) {
    if (window.foMoney) return window.foMoney(v);
    var n = Math.round(Number(v) || 0), neg = n < 0;
    n = Math.abs(n);
    var s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-$" : "$") + s;
  }
  function Mk(v) {
    if (window.foMoney) return window.foMoney(v);
    var n = Number(v) || 0, neg = n < 0; n = Math.abs(n);
    var s = n >= 1000000 ? (n / 1000000).toFixed(n >= 10000000 ? 1 : 2) + "m"
          : n >= 1000 ? Math.round(n / 1000) + "k" : String(Math.round(n));
    return (neg ? "-$" : "$") + s;
  }
  function pct(a, b) { return b > 0 ? Math.max(0, Math.min(100, Math.round(100 * a / b))) : 0; }

  function foFinCss() {
    if (document.getElementById("fo-fin-css")) return;
    var s = document.createElement("style"); s.id = "fo-fin-css";
    s.textContent = [
      "html body.fo-fin-on{background:#F3F0E7 !important}",
      "html body.fo-fin-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body #page .fo-fin{--ink:#1B2432;--paper:#FFFEFC;--band:#F4EFE3;--brand:#C9571F;--gold:#C89A2E;--navy:#14243A;",
      "  max-width:1500px;margin:0 auto;padding:24px 28px 44px;color:var(--ink);font-family:Manrope,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
      "#page .fo-fin *{box-sizing:border-box}",
      // masthead
      ".fo-fin h1{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:clamp(30px,4vw,46px);letter-spacing:-.02em;line-height:1.02;margin:11px 0 6px}",
      // the bank
      ".fo-fin-bank{background:linear-gradient(160deg,#14243A,#0A1A34 72%);border-radius:18px;padding:22px 24px;color:#EAF0FB;box-shadow:0 18px 44px rgba(10,26,52,.28);border-bottom:3px solid var(--brand)}",
      ".fo-fin-bank .lb{font-family:Manrope,sans-serif;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#9FB0C6}",
      // the skin colours bare b and i, so the treasury card has to out-rank it
      // or the biggest number on the page is navy ink on a navy card
      "html body #page .fo-fin-bank b,html body.ftpskin #page .fo-fin-bank b{display:block;font-family:Manrope,sans-serif;font-weight:700;font-size:clamp(34px,5vw,54px);line-height:1;margin:6px 0 2px;font-variant-numeric:tabular-nums;color:#FFFEFC !important}",
      ".fo-fin-walk{display:flex;flex-wrap:wrap;gap:8px 22px;margin-top:14px;padding-top:13px;border-top:1px solid rgba(143,168,204,.22)}",
      ".fo-fin-walk div{display:flex;flex-direction:column;gap:3px}",
      ".fo-fin-walk span{font-family:Manrope,sans-serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#9FB0C6}",
      "html body #page .fo-fin-walk i{font-style:normal;font-family:Manrope,sans-serif;font-size:15px;font-variant-numeric:tabular-nums;color:#FFFEFC !important}",
      "html body #page .fo-fin-walk i.fo-fin-up{color:#7BD3A6 !important}html body #page .fo-fin-walk i.fo-fin-dn{color:#F0A090 !important}",
      // the administration banner
      ".fo-fin-admin{margin-top:14px;background:#FBE9E4;border:1px solid rgba(201,85,50,.4);border-left:4px solid var(--brand);border-radius:12px;padding:14px 16px}",
      ".fo-fin-admin b{display:block;font-family:Manrope,sans-serif;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#9E3520;margin-bottom:5px}",
      ".fo-fin-admin p{margin:0;font:400 13px/1.6 Manrope,sans-serif;color:rgba(20,28,40,.8)}",
      // the two ledgers
      // the crowd + the ground
      // the levers
      "html body #page button.fo-fin-btn[disabled]{background:rgba(20,28,40,.14) !important;color:rgba(20,28,40,.42) !important;cursor:not-allowed}",
      ".fo-fin-msg{margin-top:10px;font:600 12.5px/1.5 Manrope,sans-serif;color:#1E7A55}",
      ".fo-fin-msg.bad{color:#B23B2C}",
      // the wage bill
      // THE STATEMENT: a bank's own furniture - a day rule, a row per entry,
      // the amount and the balance in tabular figures so columns of money
      // line up on the decimal the way a treasurer expects
      "html body #page .fo-fin-stlink{display:block;margin-top:18px;padding:14px 16px;background:var(--paper) !important;border:1px solid rgba(20,28,40,.14);border-left:3px solid var(--brand);border-radius:12px;font:600 13px/1.4 Manrope,sans-serif;color:#14243A !important;text-decoration:none !important}",
      // the statement's filter is a line of words, not a toolbar - see .fo-seg
      ".fo-st-head{display:grid;grid-template-columns:46px minmax(0,1fr) 96px 96px;gap:10px;padding:0 12px 7px;font:600 11px/1 Manrope,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      ".fo-st-head span:nth-child(3),.fo-st-head span:nth-child(4){text-align:right}",
      ".fo-st-list{background:var(--paper);border:1px solid rgba(20,28,40,.12);border-radius:14px;overflow:hidden}",
      ".fo-st-day{padding:9px 13px;background:rgba(14,34,70,.055);font:700 11px/1 Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#14243A;border-top:1px solid rgba(20,28,40,.09)}",
      ".fo-st-list .fo-st-day:first-child{border-top:0}",
      ".fo-st-row{display:grid;grid-template-columns:46px minmax(0,1fr) 96px 96px;gap:10px;align-items:center;padding:10px 13px;border-top:1px solid rgba(20,28,40,.07)}",
      ".fo-st-row .t{font:600 13px/1 Manrope,sans-serif;color:rgba(20,28,40,.45);font-variant-numeric:tabular-nums}",
      ".fo-st-row .w{min-width:0}",
      ".fo-st-row .w b{display:block;font:600 13px/1.3 Manrope,sans-serif;color:#1B2432}",
      ".fo-st-row .w i{display:block;font-style:normal;font:400 13px/1.4 Manrope,sans-serif;color:rgba(20,28,40,.55)}",
      ".fo-st-row .a,.fo-st-row .b{text-align:right;font:700 13px/1.2 Manrope,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-st-row.in .a{color:#1E7A55}.fo-st-row.out .a{color:#B23B2C}",
      ".fo-st-row .b{color:rgba(20,28,40,.5);font-weight:400}",
      ".fo-st-none{padding:22px 14px;text-align:center;font:400 13px/1.6 Manrope,sans-serif;color:rgba(20,28,40,.55)}",
      "html body #page .fo-st-more{display:block;width:100%;margin-top:12px;font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#14243A !important;background:var(--paper) !important;border:1px solid rgba(20,28,40,.18) !important;border-radius:12px !important;padding:0 !important;min-height:46px;cursor:pointer}",
      "html body #page .fo-st-more:disabled{opacity:.55;cursor:default}",
      "@media(max-width:560px){.fo-st-head{grid-template-columns:40px minmax(0,1fr) 84px;gap:8px}",
      ".fo-st-head span:nth-child(4){display:none}",
      ".fo-st-row{grid-template-columns:40px minmax(0,1fr) 84px;gap:8px;padding:10px}",
      ".fo-st-row .b{grid-column:2/4;text-align:right;margin-top:-4px;font-size:11px}}",
      ".fo-fin-foot{display:flex;gap:10px;justify-content:space-between;margin-top:20px;flex-wrap:wrap}",
      ".fo-fin-foot a{display:inline-flex;align-items:center;min-height:44px;font:600 13px Manrope,sans-serif;color:rgba(20,28,40,.65);background:var(--paper);border:1px solid rgba(20,28,40,.12);border-radius:999px;padding:0 17px;text-decoration:none}",
      ".fo-fin-foot a:hover{color:#B44A22;border-color:rgba(217,85,42,.5)}",
      "@media(max-width:560px){.fo-fin{padding:18px 12px 40px}.fo-fin-bank{padding:18px}}",
      // ---- THE SHEET: the finance room as one daylight page of type --------
      // No cards. A giant scoreboard numeral, the bank's own line drawn from
      // the statement, then flat ledger rows on hairlines. One accent (the
      // brand orange) does the structural work - eyebrows, section labels,
      // the sparkline, the chevrons; green and red are reserved for money.
      "html body.fo-sheet-on,html body.ftpskin.fo-sheet-on{background:#FFFEFC !important}",
      ".fo-tre{--ink:#1B2432;--mut:#8a8578;--edge:#EEE9DC;--brand:#C9571F;--grn:#177A57;--red:#B23230;",
      "  max-width:1240px;margin:0 auto;color:var(--ink)}",
      ".fo-tre .num{font-variant-numeric:tabular-nums}",
      ".fo-tre-lbl{font:700 11px/1.2 Manrope,sans-serif;letter-spacing:.18em;text-transform:uppercase}",
      ".fo-tre-top{display:flex;justify-content:space-between;align-items:baseline;gap:14px;margin-bottom:22px}",
      ".fo-tre-top .ey{color:var(--brand);font:700 11px/1.2 Manrope,sans-serif;letter-spacing:.22em;text-transform:uppercase}",
      ".fo-tre-top .rt{color:var(--mut);font:700 11px/1.2 Manrope,sans-serif;letter-spacing:.16em;text-transform:uppercase;text-align:right}",
      ".fo-tre-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,420px);gap:24px 60px;align-items:end}",
      ".fo-tre-bank{font:800 clamp(46px,7.8vw,108px)/0.95 Manrope,sans-serif;letter-spacing:-.015em;color:var(--ink);white-space:nowrap}",
      ".fo-tre-bank em{font-style:normal;font-weight:700;font-size:.48em;vertical-align:.34em;color:#9a958a}",
      ".fo-tre-under{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin-top:10px}",
      ".fo-tre-under .fo-tre-lbl{color:var(--mut)}",
      ".fo-tre-delta{font:700 15px/1.2 Manrope,sans-serif;color:var(--grn)}.fo-tre-delta.dn{color:var(--red)}",
      ".fo-tre-spark .g{position:relative}",
      ".fo-tre-spark svg{display:block;width:100%;height:64px}",
      ".fo-tre-spark .dot{position:absolute;right:-1px;width:9px;height:9px;border-radius:50%;background:var(--brand);transform:translateY(-4px)}",
      ".fo-tre-cap{display:flex;justify-content:space-between;gap:10px;margin-top:7px}",
      ".fo-tre-cap span{font:700 11px/1.3 Manrope,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#a09a8d}",
      ".fo-tre-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:20px 0;border-top:1px solid var(--edge);border-bottom:1px solid var(--edge);margin:26px 0 28px}",
      ".fo-tre-strip b{display:block;font:700 21px/1.15 Manrope,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums}",
      ".fo-tre-strip b.up{color:var(--grn)}.fo-tre-strip b.dn{color:var(--red)}",
      ".fo-tre-strip .fo-tre-lbl{color:var(--mut);margin-top:6px;display:block}",
      ".fo-tre-cols{display:grid;grid-template-columns:1fr 1fr;gap:8px 60px;align-items:start;margin-top:30px}",
      ".fo-tre-sec{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding-bottom:4px}",
      ".fo-tre-sec .fo-tre-lbl{color:var(--brand)}",
      "html body #page .fo-tre-sec b{font:700 15px/1.2 Manrope,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums}",
      ".fo-tre-row{display:flex;align-items:baseline;gap:12px;padding:11px 0;border-bottom:1px solid var(--edge)}",
      ".fo-tre-row u{text-decoration:none;flex:1;min-width:0;font:600 14px/1.35 Manrope,sans-serif;color:#4A4438}",
      "html body #page .fo-tre-row b{font:700 15px/1.2 Manrope,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums}",
      ".fo-tre-row s{text-decoration:none;font:600 11px/1 Manrope,sans-serif;color:#a09a8d;min-width:38px;text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-tre-tot{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 0 2px;margin-top:4px;border-top:2px solid var(--ink)}",
      ".fo-tre-tot u{text-decoration:none;font:700 13px/1.2 Manrope,sans-serif;color:var(--ink)}",
      "html body #page .fo-tre-tot b{font:700 16px/1.2 Manrope,sans-serif;color:var(--ink);font-variant-numeric:tabular-nums}",
      ".fo-tre-drift{margin-top:10px;font:600 12px/1.5 Manrope,sans-serif;color:var(--red)}",
      ".fo-tre-desk{display:grid;grid-template-columns:1fr 1fr;gap:8px 60px;align-items:start;margin-top:26px}",
      ".fo-tre-line{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;border-bottom:1px solid var(--edge)}",
      ".fo-tre-line u{text-decoration:none;flex:1;min-width:0;font:600 13px/1.45 Manrope,sans-serif;color:#4A4438}",
      ".fo-tre-line u b{color:var(--ink)}",
      "html body #page .fo-tre-line .pj{font:800 20px/1 Manrope,Manrope,sans-serif;color:var(--grn);font-variant-numeric:tabular-nums;white-space:nowrap}",
      "html body #page a.fo-tre-door{display:flex;justify-content:space-between;align-items:center;gap:12px;min-height:50px;padding:8px 0;border-bottom:1px solid var(--edge);text-decoration:none !important;cursor:pointer}",
      "a.fo-tre-door .fo-tre-lbl{color:var(--ink);text-transform:none;font:700 13px/1.2 Manrope,sans-serif;letter-spacing:.01em}",
      "a.fo-tre-door i{font-style:normal;font:400 12.5px/1.3 Manrope,sans-serif;color:var(--mut);text-align:right}",
      "a.fo-tre-door .ch{font:400 19px/1 Georgia,serif;color:var(--brand)}",
      "html body #page button.fo-tre-act{font:700 11px/1 Manrope,sans-serif !important;letter-spacing:.13em;color:var(--brand) !important;background:transparent !important;border:0 !important;border-radius:0 !important;box-shadow:none !important;padding:0 0 0 14px !important;min-height:44px;cursor:pointer}",
      "html body #page button.fo-tre-act[disabled]{color:#a09a8d !important;cursor:not-allowed}",
      ".fo-tre-word{font:italic 500 14px/1.6 Fraunces,Georgia,serif;color:#5a5344;margin:20px 0 0}",
      ".fo-tre-word b{font-style:normal;color:var(--ink)}",
      "@media(max-width:900px){",
      ".fo-tre-head{grid-template-columns:minmax(0,1fr)}",
      ".fo-tre-cap span:nth-child(2){display:none}",
      ".fo-tre-cap span{white-space:nowrap}",
      ".fo-tre-strip{grid-template-columns:1fr 1fr;gap:16px 10px}",
      ".fo-tre-cols,.fo-tre-desk{grid-template-columns:minmax(0,1fr)}",
      ".fo-tre-cols>div+div{margin-top:22px}",
      ".fo-tre-row{padding:8px 0}",
      ".fo-tre-bank{font-size:clamp(40px,11.5vw,64px)}",
      "}",
      // ---- MATCHDAY ECONOMY: premium club-commercial dashboard ----
      ".fo-me{--navy:#0E2745;--navy2:#173B61;--ink:#13253C;--orange:#DB4A16;--gold:#D2A53A;--green:#0F845E;--paper:#FFFEFA;--edge:#D8D1C3;--mut:#667387;display:flex;flex-direction:column;gap:15px;color:var(--ink);font-synthesis:none;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}",
      ".fo-me *{box-sizing:border-box}",
      ".fo-me-head{display:flex;align-items:flex-end;gap:24px;padding:3px 2px 6px}",
      ".fo-me-ey{color:var(--orange);font:700 11px/1.1 Manrope,sans-serif;letter-spacing:.17em;text-transform:uppercase;margin-bottom:9px}",
      ".fo-me-head h1{margin:0;color:var(--ink);font:600 clamp(38px,4.2vw,58px)/1 Fraunces,Georgia,serif;letter-spacing:-.032em}",
      ".fo-me-head p{margin:9px 0 0;color:#526074;font:450 13px/1.5 Manrope,sans-serif}",
      ".fo-me-actions{display:flex;align-items:center;gap:9px;margin-left:auto;padding-bottom:1px}",
      "html body #page .fo-me-btn,html body #page button.fo-me-btn{display:inline-flex;align-items:center;justify-content:center;height:45px;min-width:142px;padding:1px 18px 0 !important;border:1px solid #CFC6B6 !important;border-radius:10px !important;background:#FFFEFA !important;color:var(--ink) !important;font:700 11px/1 Manrope,sans-serif !important;letter-spacing:.12em;text-decoration:none !important;box-shadow:0 1px 0 rgba(19,37,60,.04) !important}",
      "html body #page .fo-me-btn.primary,html body #page button.fo-me-btn.primary{border-color:var(--orange) !important;background:linear-gradient(180deg,#E85720,#D94313) !important;color:#fff !important;box-shadow:0 5px 13px rgba(217,67,19,.16) !important}",
      "html body #page button.fo-me-btn[disabled]{background:#D7D2C7 !important;border-color:#D7D2C7 !important;color:#8D877C !important;box-shadow:none !important;cursor:not-allowed}",
      ".fo-me-top{display:grid;grid-template-columns:minmax(360px,1.02fr) minmax(620px,1.98fr);gap:15px;align-items:stretch}",
      ".fo-me-card{background:var(--paper);border:1px solid var(--edge);border-radius:15px;box-shadow:0 5px 18px rgba(18,35,54,.055);overflow:hidden}",
      ".fo-me-stadium{padding:0;display:flex;flex-direction:column;min-height:424px;border-color:#BFC4C5}",
      ".fo-me-cardtitle{display:flex;align-items:center;gap:12px;margin:0;padding:16px 18px 14px;background:var(--navy);color:#F8F3E8;font:700 12px/1 Manrope,sans-serif;letter-spacing:.13em;text-transform:uppercase}",
      ".fo-me-cardtitle:before,.fo-me-cardtitle:after{content:'';height:1px;flex:1;background:#D7A837}.fo-me-cardtitle:before{max-width:40px}",
      ".fo-me-groundwrap{position:relative;background:var(--navy);padding:0 10px 8px;overflow:hidden}",
      ".fo-me-ground{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:10px;filter:drop-shadow(0 12px 17px rgba(3,15,29,.24))}",
      ".fo-me-stadfoot{display:grid;grid-template-columns:92px minmax(0,1fr);gap:18px;align-items:center;margin-top:auto;padding:14px 18px 16px;background:var(--paper)}",
      ".fo-me-occ{text-align:center}.fo-me-occ>span{display:block;margin-top:6px;color:var(--mut);font:700 11px/1 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase}",
      ".fo-me-ring{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(var(--green) var(--fill),#E6E2DA 0);margin:auto}",
      ".fo-me-ring:after{content:'';position:absolute;inset:8px;border-radius:50%;background:var(--paper)}",
      ".fo-me-ring b{position:relative;z-index:2;color:var(--ink);font:750 16px/1 Manrope,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.04em}",
      ".fo-me-cap b{display:block;color:var(--ink);font:750 25px/1.08 Manrope,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.035em;white-space:nowrap}.fo-me-cap span{display:block;margin-top:9px;padding-top:9px;border-top:1px solid #D6CDBB;color:var(--mut);font:700 11px/1.3 Manrope,sans-serif;letter-spacing:.13em;text-transform:uppercase}.fo-me-cap em{color:var(--orange);font-style:normal}",
      ".fo-me-right{display:grid;grid-template-rows:auto 1fr;gap:15px;min-width:0}",
      ".fo-me-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px}",
      ".fo-me-kpi{min-height:104px;padding:15px 13px;display:grid;grid-template-columns:42px minmax(0,1fr);gap:11px;align-items:center}",
      ".fo-me-kpi .ico{width:42px;height:42px;border:1.5px solid currentColor;border-radius:13px;display:grid;place-items:center;color:var(--orange);background:#FFF8F3}.fo-me-kpi.green .ico,.fo-me-kpi.green b{color:var(--green)}.fo-me-kpi.green .ico{background:#F2FAF6}.fo-me-kpi.gold .ico,.fo-me-kpi.gold b{color:#B98716}.fo-me-kpi.gold .ico{background:#FFF9E9}",
      ".fo-me-svgico{display:block;width:21px;height:21px;overflow:visible}",
      ".fo-me-kpi span{display:block;color:#667286;font:700 11px/1.3 Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase}.fo-me-kpi b{display:block;margin-top:6px;color:var(--ink);font:750 19px/1.05 Manrope,sans-serif;font-variant-numeric:tabular-nums;letter-spacing:-.025em;white-space:nowrap}",
      ".fo-me-data{display:grid;grid-template-columns:minmax(0,1.48fr) minmax(270px,.92fr);gap:15px;min-height:303px}",
      ".fo-me-panelhead{min-height:46px;display:flex;align-items:center;gap:10px;padding:1px 16px 0;border-bottom:1px solid #E2DDD4;color:var(--ink);font:700 11px/1 Manrope,sans-serif;letter-spacing:.13em;text-transform:uppercase}.fo-me-panelhead em{margin-left:auto;color:#7D8795;font:500 10px/1 Manrope,sans-serif;letter-spacing:.03em;text-transform:none;font-style:normal}",
      ".fo-me-chart{display:flex;flex-direction:column}",
      ".fo-me-matchlist{display:flex;flex-direction:column;gap:11px;padding:16px 16px 13px}",
      ".fo-me-matchrow{display:grid;grid-template-columns:58px minmax(0,1fr) 56px;gap:11px;align-items:center}.fo-me-matchrow .date{color:#657286;font:700 11px/1 Manrope,sans-serif;letter-spacing:.08em;text-transform:uppercase}.fo-me-matchrow .track{height:10px;border-radius:99px;background:#EEEAE1;overflow:hidden}.fo-me-matchrow .track i{display:block;width:var(--w);height:100%;border-radius:99px;background:linear-gradient(90deg,#F16A31,#D94414);box-shadow:inset 0 -1px 0 rgba(121,31,4,.12)}.fo-me-matchrow b{text-align:right;color:var(--orange);font:750 13px/1 Manrope,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-me-chartfoot{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-top:auto;padding:12px 16px 13px;border-top:1px solid #E8E3DA;background:#FAF8F3}.fo-me-chartfoot span{color:#697587;font:650 10px/1.2 Manrope,sans-serif}.fo-me-chartfoot b{color:var(--ink);font:750 15px/1 Manrope,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-me-empty{display:flex;align-items:center;justify-content:center;min-height:150px;padding:20px;color:var(--mut);font:500 13px/1.55 Manrope,sans-serif;text-align:center}",
      ".fo-me-mix{padding-bottom:12px}",
      ".fo-me-mixbody{display:grid;grid-template-columns:126px minmax(0,1fr);gap:15px;align-items:center;padding:19px 16px 7px}",
      ".fo-me-donut{width:124px;height:124px;border-radius:50%;position:relative;display:grid;place-items:center;background:var(--mix);box-shadow:inset 0 0 0 1px rgba(19,38,64,.08)}.fo-me-donut:after{content:'';position:absolute;inset:31px;border-radius:50%;background:var(--paper);box-shadow:0 0 0 1px rgba(19,38,64,.04)}.fo-me-donutin{position:relative;z-index:2;text-align:center}.fo-me-donutin span{display:block;color:#778192;font:700 11px/1 Manrope,sans-serif;letter-spacing:.13em;text-transform:uppercase}.fo-me-donutin b{display:block;margin-top:4px;color:var(--ink);font:750 13px/1 Manrope,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-me-mixrow{display:grid;grid-template-columns:9px minmax(0,1fr) auto;gap:9px;align-items:center;padding:8px 0;border-bottom:1px solid #ECE7DE;color:#526073;font:500 12px/1 Manrope,sans-serif}.fo-me-mixrow:last-child{border-bottom:0}.fo-me-mixrow i{width:8px;height:8px;border-radius:3px}.fo-me-mixrow b{color:var(--ink);font-size:11px;font-variant-numeric:tabular-nums}",
      ".fo-me-bottom{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(410px,1fr);gap:15px}",
      ".fo-me-levers{padding:0 13px 13px}",
      ".fo-me-levers.flat{background:transparent;border:0;box-shadow:none;border-radius:0;padding:0}",
      ".fo-me-levers.flat .fo-me-panelhead{border-bottom:0;padding-left:2px}",
      ".fo-me-levergrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}",
      ".fo-me-lever{min-height:145px;border:1px solid #E1D8C8;border-radius:11px;padding:12px;background:#FFFEFA;display:flex;flex-direction:column}",
      ".fo-me-lever .top{display:flex;align-items:center;gap:9px}.fo-me-lever .ic{width:32px;height:32px;border:1px solid #D7C49B;border-radius:10px;display:grid;place-items:center;color:var(--orange);background:#FFF8F0;font:700 13px/1 Manrope,sans-serif}.fo-me-lever span{color:#536074;font:700 11px/1.25 Manrope,sans-serif;letter-spacing:.11em;text-transform:uppercase}",
      ".fo-me-lever b{display:block;margin-top:8px;color:var(--ink);font:750 15px/1.12 Manrope,sans-serif;letter-spacing:-.015em}.fo-me-lever em{display:block;margin:8px 0;color:var(--mut);font:450 12px/1.42 Manrope,sans-serif;font-style:normal}",
      "html body #page .fo-me-lever button{margin-top:auto;width:100%;border:0 !important;border-top:1px solid #E2D9C7 !important;border-radius:0 !important;background:transparent !important;color:var(--orange) !important;text-align:left;font:700 11px/1 Manrope,sans-serif !important;letter-spacing:.1em;text-transform:uppercase;padding:10px 0 0 !important;box-shadow:none !important}.fo-me-lever button[disabled]{color:#9E978A !important}",
      // the ticket dial
      ".fo-me-lever.fo-tk b{display:flex;align-items:baseline;gap:8px}",
      ".fo-me-lever.fo-tk b s{text-decoration:none;font:750 22px/1 Manrope,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-me-lever.fo-tk b s:before{content:'$';font-size:14px;font-weight:600;color:#778192;margin-right:1px}",
      ".fo-me-lever.fo-tk b i{font:500 11px/1 Manrope,sans-serif;font-style:normal;color:#9E978A}",
      ".fo-tk-dial{display:flex;gap:7px;margin-top:9px}",
      "html body #page .fo-tk-dial button{margin:0;width:38px;min-height:34px;flex:0 0 auto;border:1px solid #CFC6B6 !important;border-radius:9px !important;background:#FFFEFA !important;color:#1B2432 !important;font:700 16px/1 Manrope,sans-serif !important;text-align:center;padding:0 !important;letter-spacing:0;text-transform:none}",
      "html body #page .fo-tk-dial button:active{background:#F4EFE3 !important}",
      // the gate board
      ".fo-gb{margin-top:15px;padding:0 15px 6px}",
      ".fo-gb .fo-me-panelhead em{font:450 11.5px/1.3 Manrope,sans-serif;color:var(--mut);font-style:normal;letter-spacing:0;text-transform:none}",
      ".fo-gb-row{display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px 0;border-bottom:1px solid #EFE9DC}",
      ".fo-gb-row:last-child{border-bottom:0}",
      ".fo-gb-row .rd{font:700 12px/1.2 Manrope,sans-serif;color:#14243A}",
      ".fo-gb-row .rd u{display:block;margin-top:3px;text-decoration:none;font:500 10.5px/1.2 Manrope,sans-serif;color:#8a8272;white-space:nowrap}",
      ".fo-gb-row .op{min-width:0}",
      ".fo-gb-row .op b{display:block;font:650 13px/1.2 Manrope,sans-serif;color:#1B2432;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".fo-gb-row .op u{display:block;height:7px;border-radius:999px;background:#EBE6DA;margin:6px 0 4px;text-decoration:none;overflow:hidden}",
      ".fo-gb-row .op u i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#136A4B,#177A57)}",
      ".fo-gb-row .op s{text-decoration:none;font:500 11px/1.2 Manrope,sans-serif;color:#6A6354;font-variant-numeric:tabular-nums}",
      ".fo-gb-row .op s b.hot{font:700 10px/1.2 Manrope,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#B4441C}",
      ".fo-gb-row .op .pr{display:flex;align-items:center;gap:7px;margin-top:7px}",
      ".fo-gb-row .op .pr b{font:700 13px/1 Manrope,sans-serif;color:#14243A;min-width:36px;text-align:center;font-variant-numeric:tabular-nums}",
      ".fo-gb-row .op .pr.lk{font:600 11px/1 Manrope,sans-serif;color:#8a8272}",
      "html body #page .fo-gb-row .pr button{width:28px;min-height:28px;padding:0 !important;margin:0;flex:0 0 auto;border:1px solid #CFC6B6 !important;border-radius:8px !important;background:#FFFEFA !important;color:#1B2432 !important;font:700 14px/1 Manrope,sans-serif !important;text-align:center;letter-spacing:0;text-transform:none;box-shadow:none !important}",
      "html body #page .fo-gb-row .pr button.ok{width:auto;padding:0 12px !important;border-color:var(--orange) !important;color:#fff !important;background:linear-gradient(180deg,#E85720,#D94313) !important;font-size:10px !important;letter-spacing:.08em;text-transform:uppercase}",
      ".fo-gb-row .tk{text-align:right;white-space:nowrap}",
      ".fo-gb-row .tk b{display:block;font:700 13px/1.2 Manrope,sans-serif;color:#14243A;font-variant-numeric:tabular-nums}",
      ".fo-gb-row .tk u{display:block;margin-top:2px;text-decoration:none;font:600 9.5px/1.2 Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#9E978A}",
      ".fo-gb-row .tk em{display:block;margin-top:3px;font:600 10.5px/1.2 Manrope,sans-serif;font-style:normal;color:#C08A2E}",
      ".fo-gb-row .tk em.lk{color:#177A57}",
      ".fo-me-forecast{padding-bottom:13px}.fo-me-forecastbody{display:grid;grid-template-columns:138px minmax(0,1fr);gap:14px;padding:13px 16px 0;align-items:stretch}.fo-me-opp{display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:1px solid #E5DFD4;text-align:center}.fo-me-shield{width:55px;height:61px;clip-path:polygon(8% 0,92% 0,88% 70%,50% 100%,12% 70%);display:grid;place-items:center;background:linear-gradient(150deg,#E0B53E,#C8951F);color:#102641;font:700 16px/1 Fraunces,serif}.fo-me-shield.arms,.fo-me-shield.crest{clip-path:none;background:none;width:auto;min-width:52px;height:61px;display:flex;align-items:center;justify-content:center}.fo-me-shield.crest{object-fit:contain;max-width:64px}.fo-me-shield.arms svg{display:block}.fo-me-opp b{margin-top:8px;font:650 16px/1.1 Fraunces,Georgia,serif}.fo-me-opp span{margin-top:6px;color:var(--mut);font:700 11px/1 Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase}",
      ".fo-me-fgrid{display:grid;grid-template-columns:1fr 1fr}.fo-me-fstat{padding:11px;border-bottom:1px solid #E9E4DB}.fo-me-fstat:nth-child(odd){border-right:1px solid #E9E4DB}.fo-me-fstat span{display:block;color:#778294;font:700 11px/1.25 Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase}.fo-me-fstat b{display:block;margin-top:6px;color:var(--ink);font:750 14px/1.1 Manrope,sans-serif;font-variant-numeric:tabular-nums}.fo-me-fstat.green b{color:var(--green)}",
      ".fo-me-recon{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 16px;padding:13px 16px;border:1px solid var(--edge);border-radius:13px;background:#FAF8F3;color:#667387;font:500 13px/1.5 Manrope,sans-serif}",
      "html body #page .fo-me-recon b{color:var(--ink);font-weight:750;font-variant-numeric:tabular-nums}",
      "html body #page .fo-me-recon b.up{color:var(--green)}html body #page .fo-me-recon b.dn{color:#B23230}",
      ".fo-me-recon .eq{margin-left:auto;color:var(--ink);font-weight:650}",
      ".fo-me-recon .warn{flex:1 1 100%;color:#B23230;font-weight:650}",
      "@media(max-width:820px){.fo-me-recon{gap:5px 12px;padding:12px 13px;font-size:11px}.fo-me-recon .eq{margin-left:0;flex:1 1 100%;padding-top:7px;border-top:1px solid #E6E0D5}}",
      ".fo-me-account{display:grid;grid-template-columns:1fr 1fr 1.05fr;gap:15px}.fo-me-account .fo-f2-card{min-width:0;border-radius:15px;box-shadow:0 5px 18px rgba(18,35,54,.045)}",
      // THE SPLIT'S OWN SHAPES. The three-column account assumed a Financial
      // health card standing beside the two ledgers; without it the two run
      // half the page each. The ground took the stadium card with it, so
      // Finances' top row is the KPIs alone, and its lever row has no forecast
      // panel beside it.
      ".fo-me-account.two{grid-template-columns:1fr 1fr}",
      ".fo-me-top:has(.fo-me-solo){grid-template-columns:minmax(0,1fr)}",
      ".fo-me-right.fo-me-solo{grid-template-rows:auto auto}",
      ".fo-me-bottom.one{grid-template-columns:minmax(0,1fr)}",
      ".fo-me-lever a.fo-me-btn{margin-top:auto;width:100%}",
      // THE ROWS SIZE TO WHAT IS IN THEM. Both grids were pinned at four
      // columns because both rooms used to have four things to put in them.
      // Split between two pages they have two and three, and a fixed four
      // left a third of each row as empty paper. Auto-fit means a row is as
      // wide as its contents wherever a card is added or taken away.
      ".fo-me-kpis{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}",
      ".fo-me-levergrid{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}",
      // the ground leads with the stand, so its top row gives the picture the
      // room the revenue chart takes on the other page
      ".fo-me-top:has(.fo-me-stadium){grid-template-columns:minmax(360px,1.15fr) minmax(0,1.85fr)}",
      "@media(max-width:1180px){.fo-me-account.two{grid-template-columns:1fr}}",
      ".fo-me-health{background:linear-gradient(145deg,var(--navy),#173C63);color:#fff;padding:16px}.fo-me-health h3{margin:0 0 12px;color:#E0B54C;font:700 11px/1.2 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase}.fo-me-health .grade{display:flex;align-items:center;gap:14px;padding:5px 0 13px;border-bottom:1px solid rgba(255,255,255,.14)}.fo-me-health .grade b{font:600 48px/1 Fraunces,serif;color:#E0B54C}.fo-me-health .grade span{font:700 14px/1 Manrope,sans-serif;letter-spacing:.11em;color:#6FD3A7}.fo-me-health .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:13px;text-align:center}.fo-me-health .stats span{display:block;color:#9BAEC6;font:700 11px/1.2 Manrope,sans-serif;letter-spacing:.1em;text-transform:uppercase}.fo-me-health .stats b{display:block;margin-top:5px;color:#fff;font:700 13px/1.25 Manrope,sans-serif}.fo-me-health p{margin:14px 0 0;color:#C2CDDB;font:450 12px/1.5 Manrope,sans-serif}",
      "@media(max-width:1180px){.fo-me-top{grid-template-columns:340px 1fr}.fo-me-kpis{grid-template-columns:1fr 1fr}.fo-me-levergrid{grid-template-columns:1fr 1fr}.fo-me-bottom{grid-template-columns:1fr}.fo-me-account{grid-template-columns:1fr 1fr}.fo-me-account .fo-me-health{grid-column:1/-1}}",
      "@media(max-width:820px){html body.fo-fin-on{background:radial-gradient(circle at 50% 0,#FAF8F1 0,#F1EEE6 42%,#EEEAE1 100%) !important}.fo-fin{padding:17px 12px max(96px,calc(env(safe-area-inset-bottom) + 72px))}.fo-me{gap:12px}.fo-me-head{display:block;padding:2px 4px 5px}.fo-me-ey{font-size:10px;line-height:1.25;letter-spacing:.14em;margin-bottom:8px}html body #page .fo-me-head h1{font-size:clamp(34px,9.4vw,40px) !important;line-height:1.02 !important;letter-spacing:-.03em !important}.fo-me-head p{margin-top:8px;font-size:13.5px;line-height:1.48}.fo-me-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0 0;padding:0}.fo-me-actions .fo-me-btn{min-width:0;width:100%;height:46px;padding:1px 9px 0 !important;font-size:10px !important;letter-spacing:.1em}.fo-me-top,.fo-me-data,.fo-me-bottom,.fo-me-account{display:flex;flex-direction:column;gap:12px}.fo-me-card{border-radius:15px;box-shadow:0 5px 18px rgba(18,35,54,.06)}.fo-me-stadium{min-height:0;border-color:#B9C0C2}.fo-me-cardtitle{padding:15px 15px 13px;font-size:10.5px;letter-spacing:.11em}.fo-me-groundwrap{padding:0 5px 5px}.fo-me-ground{width:100%}.fo-me-stadfoot{grid-template-columns:74px minmax(0,1fr);gap:13px;padding:13px 14px 15px}.fo-me-ring{width:66px;height:66px}.fo-me-ring:after{inset:7px}.fo-me-ring b{font-size:18px}.fo-me-occ>span{margin-top:5px;font-size:10px;letter-spacing:.12em}.fo-me-cap b{font-size:20px;line-height:1.08}.fo-me-cap span{margin-top:8px;padding-top:8px;font-size:10px;line-height:1.3;letter-spacing:.1em}.fo-me-right{gap:12px}.fo-me-kpis{grid-template-columns:1fr 1fr;gap:8px}.fo-me-kpi{min-height:88px;padding:12px 10px;grid-template-columns:35px minmax(0,1fr);gap:9px}.fo-me-kpi .ico{width:35px;height:35px;border-radius:11px}.fo-me-svgico{width:18px;height:18px}.fo-me-kpi span{font-size:10px;line-height:1.25;letter-spacing:.09em}.fo-me-kpi b{margin-top:5px;font-size:clamp(15px,4.25vw,17px);line-height:1.05}.fo-me-panelhead{min-height:44px;padding:1px 14px 0;font-size:10px;letter-spacing:.11em}.fo-me-panelhead em{font-size:10px}.fo-me-matchlist{gap:10px;padding:14px 14px 12px}.fo-me-matchrow{grid-template-columns:52px minmax(0,1fr) 54px;gap:9px}.fo-me-matchrow .date{font-size:10px}.fo-me-matchrow .track{height:9px}.fo-me-matchrow b{font-size:10.5px}.fo-me-chartfoot{padding:11px 14px 12px}.fo-me-chartfoot span{font-size:10px}.fo-me-chartfoot b{font-size:14px}.fo-me-mixbody{grid-template-columns:112px minmax(0,1fr);gap:14px;padding:16px 14px 6px}.fo-me-donut{width:110px;height:110px}.fo-me-donut:after{inset:28px}.fo-me-donutin span{font-size:10px}.fo-me-donutin b{font-size:11px}.fo-me-mixrow{padding:7px 0;font-size:10.5px}.fo-me-mixrow b{font-size:11px}.fo-me-bottom .fo-me-forecast{order:-1}.fo-me-forecastbody{grid-template-columns:92px minmax(0,1fr);gap:10px;padding:12px 12px 0}.fo-me-shield{width:47px;height:53px;font-size:14px}.fo-me-opp b{margin-top:7px;font-size:14px}.fo-me-opp span{font-size:10px;letter-spacing:.1em}.fo-me-fstat{padding:10px 8px}.fo-me-fstat span{font-size:10px;letter-spacing:.08em}.fo-me-fstat b{margin-top:5px;font-size:13.5px}.fo-me-levers{padding:0 10px 10px}.fo-me-levergrid{grid-template-columns:1fr 1fr;gap:8px}.fo-me-lever{min-height:150px;padding:11px}.fo-me-lever .top{gap:7px}.fo-me-lever .ic{width:29px;height:29px;border-radius:9px;font-size:11px}.fo-me-lever span{font-size:10px;letter-spacing:.085em}.fo-me-lever b{margin-top:7px;font-size:14px}.fo-me-lever em{margin:7px 0;font-size:10.5px;line-height:1.38}.fo-me-lever button{font-size:10px !important;letter-spacing:.08em;padding-top:9px !important}.fo-me-account{grid-template-columns:1fr}.fo-me-account .fo-f2-card{padding:15px 14px}.fo-me-account .fo-f2-sh{margin:-15px -14px 11px;padding:12px 14px 11px;font-size:10.5px}.fo-me-account .fo-f2-r{padding:9px 0;font-size:12px}.fo-me-health{padding:15px}.fo-me-health h3{font-size:10px;line-height:1.3}.fo-me-health .grade b{font-size:42px}.fo-me-health .grade span{font-size:13px}.fo-me-health .stats span{font-size:10px;line-height:1.25}.fo-me-health .stats b{font-size:11.5px;line-height:1.3}.fo-me-health p{font-size:10.5px;line-height:1.55}.fo-fin-stlink{margin-top:2px !important;padding:15px !important;font-size:12px !important;line-height:1.45 !important}.fo-fin-foot{margin-top:0}.fo-fin-foot a{min-height:44px;font-size:11.5px;padding:0 14px}}",
      "@media(max-width:360px){.fo-fin{padding-left:9px;padding-right:9px}.fo-me-head h1{font-size:32px}.fo-me-actions{grid-template-columns:1fr}.fo-me-kpis{grid-template-columns:1fr}.fo-me-kpi{min-height:76px}.fo-me-levergrid{grid-template-columns:1fr}.fo-me-forecastbody{grid-template-columns:82px 1fr}.fo-me-mixbody{grid-template-columns:94px minmax(0,1fr);padding-left:10px;padding-right:10px}.fo-me-donut{width:92px;height:92px}.fo-me-donut:after{inset:23px}.fo-me-stadfoot{grid-template-columns:64px minmax(0,1fr);gap:10px;padding-left:10px;padding-right:10px}.fo-me-ring{width:59px;height:59px}.fo-me-cap b{font-size:18px}.fo-me-matchrow{grid-template-columns:46px minmax(0,1fr) 50px;gap:7px}}"
    ].join("\n");
    document.head.appendChild(s);
  }

  function shell(body) {
    return "<div class='fo-fin'>" + body + "</div>";
  }
  // ==========================================================================
  // THE TURNSTILE IS YOURS (073) - client half. The same sale the umpire
  // banks, mirrored constant for constant, so the board a manager watches
  // cannot disagree with the gate the walk settles. Six daily tranches, the
  // last 24 hours before the first ball; each sells at the price in force
  // on its day; a dearer ticket thins every remaining tranche by
  // (26/price)^1.15.
  // ==========================================================================
  var TK = { BASE: 26, MIN: 10, MAX: 100, EL: 1.4, KNEE: 62, KW: 9, BCAST: 7.5, LOCK: 24 * 3600000,
             WBASE: 6, WMAX: 14 };
  function tkWindow(heat) {
    var h = Math.max(0, Math.min(1, heat || 0));
    var days = TK.WBASE + Math.round((TK.WMAX - TK.WBASE) * h);
    var g = 0.8 - 1.3 * h, w = [], sum = 0, j;
    for (j = 0; j < days; j++) { var v = Math.pow((j + 1) / days, g); w.push(v); sum += v; }
    for (j = 0; j < days; j++) w[j] /= sum;
    return { days: days, fr: w };
  }
  function tkHeat(big, mood, round) {
    return Math.min(1, 0.45 * (big || 0) + 0.35 * ((mood || 0) / 8) + 0.2 * (round >= 13 ? 1 : 0));
  }
  function tkCliff(p) { return 1 / (1 + Math.exp((p - TK.KNEE) / TK.KW)); }
  function tkMult(p) {
    p = Math.max(1, p);
    return Math.pow(TK.BASE / p, TK.EL) * (tkCliff(p) / tkCliff(TK.BASE));
  }
  function tkPriceAt(hist, ms) {
    var p = TK.BASE;
    for (var i = 0; i < (hist || []).length; i++) { if (hist[i].at <= ms) p = hist[i].price; else break; }
    return p;
  }
  // the standing series and this match's own, one resolver - the match's
  // dated prices beat the club's from the moment each is set
  function tkFnFor(rows, seasonNo, round) {
    var club = [], mk = null;
    for (var i = 0; i < (rows || []).length; i++) {
      var r = rows[i];
      if ((r.season | 0) === 0) club.push({ at: r.at, price: r.price });
      else if ((r.season | 0) === (seasonNo | 0) && (r.round | 0) === (round | 0)) (mk = mk || []).push({ at: r.at, price: r.price });
    }
    return function (ms) {
      if (mk) { var p9 = null; for (var j = 0; j < mk.length; j++) { if (mk[j].at <= ms) p9 = mk[j].price; else break; } if (p9 != null) return p9; }
      return tkPriceAt(club, ms);
    };
  }
  function tkSale(demand, seats, matchMs, hist, nowMs, heat) {
    var pAt = typeof hist === "function" ? hist : function (ms9) { return tkPriceAt(hist, ms9); };
    var lockAt = matchMs - TK.LOCK, sold = 0, take = 0;
    var win = tkWindow(heat);
    for (var k = 0; k < win.days; k++) {
      var at = lockAt - (win.days - 1 - k) * 86400000;
      if (nowMs != null && at > nowMs) break;
      var pr = pAt(at);
      var n = demand * win.fr[k] * tkMult(pr);
      if (sold + n > seats) n = seats - sold;
      if (n <= 0) continue;
      sold += n; take += n * pr;
    }
    return { sold: Math.round(sold), take: Math.round(take), lockAt: lockAt,
             opensAt: lockAt - (win.days - 1) * 86400000 };
  }
  // the club's dated prices, fetched once a minute; the room repaints on land
  var TKH = { rows: null, at: 0, busy: false };
  function tkHist() {
    try {
      var cl = window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null");
      if (!cl || !cl.country) return TKH.rows || [];
      if (TKH.busy || (TKH.rows && Date.now() - TKH.at < 60000)) return TKH.rows || [];
      TKH.busy = true;
      rpc("world_ticket_prices", { p_country: cl.country, p_slot: cl.slot | 0 })
        .then(function (rows) {
          TKH.rows = Array.isArray(rows) ? rows : []; TKH.at = Date.now(); TKH.busy = false;
          try { if ((location.hash || "").split("?")[0] === "#/ground") window.foRenderGroundPage(); } catch (e9) {}
        })
        .catch(function () { TKH.busy = false; TKH.rows = TKH.rows || []; });
      return TKH.rows || [];
    } catch (e) { return TKH.rows || []; }
  }
  // who is visiting moves the crowd: the flagship pulls hardest, a top-three
  // side after that - the same multipliers the umpire's walk applies
  function tkDraw(cl, oppSlot) {
    var boss = (oppSlot | 0) === 0;
    var out = { mult: boss ? 1.22 : 1, big: boss ? 1 : 0 };
    try {
      var lg = window.__foWorldLg && window.__foWorldLg.get(cl.country);
      var tbls = [(lg && lg.table) || [], (lg && lg.table2) || []];
      for (var d = 0; d < tbls.length; d++)
        for (var i = 0; i < tbls[d].length; i++)
          if ((tbls[d][i].slot | 0) === (oppSlot | 0)) {
            if (i < 3) { out.mult *= 1.09; if (!boss) out.big = 0.6; }
            return out;
          }
    } catch (e) {}
    return out;
  }
  var TK_PEND = null;   // the dial's unset choice, kept across repaints

  function foSheetGround(on) {
    document.body.classList.toggle("fo-sheet-on", !!on);
    try {
      if (on) document.body.style.setProperty("background", "#FFFEFC", "important");
      else document.body.style.removeProperty("background");
    } catch (e) {}
  }
  // The eyebrow says which room you are standing in, so it cannot be the word
  // "books" any more: three rooms share this masthead - Finances, the ground
  // and the statement - and two of them are not the books. It takes the title
  // it is given, which is the only thing that knows.
  function head(clubNm, sub) {
    return "<header class='fo-nvmast'><div class='k'>Fifty Overs</div>" +
      "<h1>" + E(clubNm || "Your club") + "</h1>" +
      (sub ? "<p>" + sub + "</p>" : "") + "</header>";
  }

  // the statement's first page powers the balance line and the latest entries;
  // it lands once, after the books, and the page repaints with it
  var FTX = { at: 0, lines: null, busy: false };
  // the last status the books were drawn from. Without it the statement
  // landing re-entered foRenderFinancePage, which blanked the page back to
  // "walking down to the treasurer's office", asked the world for the status a
  // second time, and repainted - a visible flash and a wasted round trip every
  // time, and again every sixty seconds for as long as the page was open.
  var FST = { at: 0, st: null };
  function wantTx() {
    if (FTX.busy || (FTX.lines && Date.now() - FTX.at < 300000)) return;
    FTX.busy = true;
    rpc("world_my_statement", { p_limit: 40 })
      .then(function (r) {
        FTX.busy = false; FTX.at = Date.now();
        FTX.lines = (r && r.lines) || [];
        var page = document.getElementById("page");
        if (page && FST.st && (location.hash || "").indexOf("#/finance") === 0) render(page, FST.st);
      })
      .catch(function () { FTX.busy = false; FTX.at = Date.now(); FTX.lines = []; });
  }
  // Vector marks replace the placeholder currency / division / triangle
  // characters the first pass used. They share one stroke language, align to
  // the same optical box and stay crisp at every phone pixel density.
  function foMeIcon(kind) {
    var p = {
      revenue: "<ellipse cx='12' cy='7' rx='6.5' ry='3.1'/><path d='M5.5 7v4c0 1.7 2.9 3.1 6.5 3.1s6.5-1.4 6.5-3.1V7M5.5 11v4c0 1.7 2.9 3.1 6.5 3.1s6.5-1.4 6.5-3.1v-4'/>",
      crowd: "<circle cx='9' cy='8' r='3'/><circle cx='16.5' cy='9.5' r='2.3'/><path d='M3.7 19c.5-3.5 2.3-5.3 5.3-5.3s4.9 1.8 5.3 5.3M14.2 14.4c2.9-.6 5 .9 5.8 3.7'/>",
      seat: "<path d='M5 5.5h14v6.3a2 2 0 0 0 0 4v2.7H5v-2.7a2 2 0 0 0 0-4V5.5Z'/><path d='M9 8.5h6M9 12h6M9 15.5h4'/>",
      mood: "<path d='M3.5 12h3l1.6-4.2 3.2 8.5 2.4-6 1.5 3.1h5.3'/><path d='M12 21C5.8 17.7 3.5 14.6 3.5 10a4.6 4.6 0 0 1 8.5-2.5A4.6 4.6 0 0 1 20.5 10c0 4.6-2.3 7.7-8.5 11Z' opacity='.24'/>",
      ground: "<path d='M3 17.5h18M5 17.5v-5l3-3 4-3 4 3 3 3v5M8 17.5v-4h8v4M4.5 8.5h15'/>",
      sponsor: "<path d='m12 3 2.2 4.5 5 .7-3.6 3.5.8 5-4.4-2.3-4.4 2.3.8-5-3.6-3.5 5-.7L12 3Z'/><path d='M8.5 20h7'/>",
      academy: "<path d='m3 9 9-4 9 4-9 4-9-4Z'/><path d='M7 11v4.3c2.8 2.2 7.2 2.2 10 0V11M21 9v6'/>",
      price: "<path d='M5 5.5h14v6.3a2 2 0 0 0 0 4v2.7H5v-2.7a2 2 0 0 0 0-4V5.5Z'/><path d='M12 8v8M14.4 9.4c-.5-.7-1.3-1-2.2-1-1.2 0-2 .6-2 1.5 0 2.4 4.2 1.1 4.2 3.6 0 1-.9 1.7-2.2 1.7-.9 0-1.8-.3-2.5-1'/>"
    };
    return "<svg class='fo-me-svgico' viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' stroke-width='1.65' stroke-linecap='round' stroke-linejoin='round'>" + (p[kind] || p.revenue) + "</svg>";
  }

  // Matchday Economy gets a purpose-built editorial ground painting rather
  // than a diagram. Keep the venue name as real UI text above it so the same
  // artwork can frame every club without baking a fictional label into it.
  function foMeGroundArt(name) {
    var base = (typeof FO_ART !== "undefined") ? FO_ART :
      ((location.pathname.indexOf("/client/") !== -1) ? "art/" : "client/art/");
    return "<img class='fo-me-ground' src='" + base + "home/matchday-economy-ground.webp' " +
      "width='1440' height='810' alt='" + E(name) + " cricket ground at golden hour' decoding='async'>";
  }

  // THE BANK'S OWN LINE. The statement already carries the balance the club
  // was left holding after every entry, so the sparkline is not a model - it
  // is the last forty entries of the real ledger, oldest to newest, drawn as
  // one stroke. The endpoint dot is HTML, not SVG: the chart is stretched to
  // fit its box, and a stretched circle is an ellipse.
  function foShSpark(bank) {
    var lines = (FTX.lines || []).slice().reverse();
    var vals = lines.map(function (l) { return Number(l.balance) || 0; });
    if (vals.length < 2) return "";
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var span = (max - min) || 1;
    var pts = vals.map(function (v, i) {
      var x = (i / (vals.length - 1)) * 360;
      var y = 58 - ((v - min) / span) * 50;
      return (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    var lastY = 58 - ((vals[vals.length - 1] - min) / span) * 50;
    var from = "";
    try { from = stDate(lines[0].at).day.replace(/^\w+\s+/, "").replace(/\s+\d{4}$/, ""); } catch (e) {}
    return "<div class='fo-tre-spark'><div class='g'>" +
      "<svg viewBox='0 0 360 64' preserveAspectRatio='none' aria-hidden='true'>" +
      "<path d='" + pts + "' fill='none' stroke='#C9571F' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' vector-effect='non-scaling-stroke'/></svg>" +
      "<span class='dot' style='top:" + Math.round(100 * lastY / 64) + "%'></span></div>" +
      "<div class='fo-tre-cap'><span class='num'>" + (from ? E(from) + " &middot; " : "") + Mk(vals[0]) + "</span>" +
      "<span>The bank, entry by entry</span>" +
      "<span class='num'>Today &middot; " + Mk(bank) + "</span></div></div>";
  }

  function render(page, st, room) {
    var f = (st && st.finance) || {}, bank = Number(st && st.bank) || 0;
    var clubNm = (st.claim && st.claim.club) || "Your club";
    var founded = Number(f.founded) || 2500000, rounds = Number(f.rounds) || 0;
    // EVERY LINE THE UMPIRE KEEPS, or the two columns do not add up to the
    // bank. The Colts Cup purse, what the academy spent on trips and senior
    // contracts, and anything written off at the floor were all missing, so
    // "Net this season" was a number that reconciled with nothing. (A head
    // coach was among them until 056 withdrew him and refunded every club.)
    var inGate = Number(f.gate) || 0, inAway = Number(f.awayCut) || 0, inBcast = Number(f.broadcast) || 0;
    var inSpon = Number(f.sponsor) || 0, inComp = Number(f.compensation) || 0, inFees = Number(f.feesIn) || 0;
    var inPurse = Number(f.coltsPurse) || 0, inWriteOff = Number(f.writtenOff) || 0;
    var totIn = inGate + inAway + inBcast + inSpon + inComp + inFees + inPurse + inWriteOff;
    var outWage = Number(f.wages) || 0, outUp = Number(f.upkeep) || 0, outInt = Number(f.interest) || 0;
    var outFees = Number(f.feesOut) || 0, outScout = Number(f.scouting) || 0;
    var outAcadSpend = Number(f.academySpend) || 0;
    var outAcad = Number(f.academyPaid) || 0, outSeats = Number(f.seatsPaid) || 0;
    var totOut = outWage + outUp + outInt + outFees + outScout + outAcadSpend + outAcad + outSeats;
    var net = totIn - totOut;
    // and the proof: the bank the world holds is the founding money plus that
    // net, to the pound. A drift means a line has gone missing again.
    var drift = bank - (founded + net);

    // The trend used to divide a total that INCLUDED transfer fees in by the
    // rounds played while excluding the fees out - one-off money inflating a
    // rate. This is the operating result only: what the club earns by playing,
    // less what it costs to field and run.
    var opIn = inGate + inAway + inBcast + inSpon + inComp;
    var opOut = outWage + outUp + outInt;
    var perRound = rounds ? (opIn - opOut) / rounds : 0;

    var squad = (st.squad || []).slice().filter(function (p) { return p && p.name; });
    var youth = (st.youth || []).filter(function (p) { return p && p.name; });
    // the umpire's own bill: seniors AND colts, because a boy is paid every
    // round from the day he signs. Counting the squad alone understated it.
    var billNow = Number(f.wageBill) ||
      squad.concat(youth).reduce(function (s2, p) { return s2 + (Number(p.wage) || 0); }, 0);
    var wageShare = opIn > 0 ? pct(outWage, opIn) : 0;

    var sup = Number(f.supporters) || 0, seats = Number(f.seats) || 0;
    var lastAtt = Number(f.lastAttendance) || 0, avgAtt = Number(f.avgAttendance) || 0;
    var mood = Math.max(0, Math.min(8, Number(f.mood) || 0));
    var moodWord = String(f.moodWord || "patient");
    var ticket = Number(f.ticket) || 26;
    var homeCut = Number(f.homeCut) || 2 / 3;
    var homeMatches = Number(f.homeMatches) || 0;
    var full = pct(lastAtt || avgAtt, seats);
    // "Revenue / seat" divided a season's gate by the capacity, so it grew for
    // ever and meant nothing. What a treasurer wants is the average gate a
    // home match brings in.
    var avgGate = homeMatches > 0 ? Math.round(inGate / homeMatches)
      : avgAtt ? Math.round(avgAtt * ticket * homeCut) : 0;
    // the ground is on the claim, not on the status root: reading st.ground
    // gave every club in the world the same made-up name
    var groundNm = String((st.claim && st.claim.ground) || "the ground");

    if (jwt()) wantTx();

    var nf = null;
    try {
      var sv9 = window.__foServed;
      if (sv9 && sv9.on()) nf = (sv9.fixtures(1) || [])[0] || null;
    } catch (e) {}
    try { if (!nf && typeof nextFixture === "function") nf = nextFixture(); } catch (e) {}
    // the draw is never awaited: the schedule derives it from the planet
    // itself, so when the snapshots are behind, ask the same source it does
    try {
      if ((!nf || !nf.opp || !nf.opp.name) && window.foMyNextLeagueFixture) {
        var kf9 = window.foMyNextLeagueFixture();
        if (kf9) nf = { opp: { name: kf9.opp.name, slot: kf9.opp.slot }, isHome: kf9.home, round: kf9.round };
      }
    } catch (eKf) {}
    var oppNm = String((nf && nf.opp && nf.opp.name) || "Season played out");
    var atHome = !nf || nf.isHome !== false;
    // the crowd the umpire's own arithmetic would expect: his mood curve, not
    // an invented one, and never more than there are seats
    var moodCrowd = Math.round(sup * (0.55 + mood * (0.39 / 8)));
    var basis = lastAtt ? "Last home crowd" : avgAtt ? "Season average" : "Support and mood";
    var projectedCrowd = Math.max(0, Math.min(seats || moodCrowd, lastAtt || avgAtt || moodCrowd));
    // and only the home club's share of it. The full gate was being quoted as
    // if the visitors took nothing.
    var projectedGate = Math.round(projectedCrowd * ticket * homeCut);

    var acad = Number(f.academyLevel) || Number(st.academy) || 1;
    var nextSeats = Number(f.nextSeats) || 0, nextSeatsCost = Number(f.nextSeatsCost) || 0;
    var atCap = !nextSeats || !nextSeatsCost;
    var seatStep = Math.max(0, nextSeats - seats) || Number(f.seatBlock) || 1000;
    // THE PRICE OF A LEVEL, from the side that charges it. The page used to
    // quote acad * 60000 - a ladder retired by migration 040 - so a manager was
    // told level two cost $60,000, offered a button he could not afford, and
    // refused by the server for the real $400,000.
    var ACAD_LADDER = [0, 400000, 900000, 1800000, 3200000];
    var nextAcadCost = Number(f.nextAcademyCost) || (acad < 5 ? ACAD_LADDER[acad] : 0);
    var canSeats = !atCap && bank >= nextSeatsCost && bank >= 0 && !f.administration;
    var canAcad = acad < 5 && nextAcadCost > 0 && bank >= nextAcadCost && bank >= 0 && !f.administration;

    // ==== TWO ROOMS OFF ONE SET OF FIGURES ==================================
    //
    // This page was doing two jobs at once. Half of it was the ground - the
    // stand, how full it gets, what a seat costs, how many will come on
    // Saturday - and half was the ledger. They are not the same question and
    // they are not asked at the same time: a manager reads the ledger to see
    // whether he can afford something, and the ground to decide whether to
    // build it.
    //
    // So the figures are computed once, above, and hung in whichever room
    // they belong to. Finances is money and transactions. The ground is the
    // asset and every decision about it.
    var ROOM = (room === "ground") ? "ground" : "finance";
    var html = "<div class='fo-me'>";

    if (ROOM === "ground") {
      html +=
        "<header class='fo-me-head'><div><div class='fo-me-ey'>" + E(clubNm) + " &middot; Ground operations</div>" +
        "<h1>The ground</h1><p>The stand, the gate, and what it costs to make it bigger.</p></div>" +
        "<div class='fo-me-actions'>" +
        "<button type='button' class='fo-me-btn primary' id='fo-fin-seats'" + (canSeats ? "" : " disabled") + ">" +
        (atCap ? "Ground at capacity" : "Expand the ground") + "</button></div></header>";

      html += "<div class='fo-me-top'><section class='fo-me-card fo-me-stadium'><div class='fo-me-cardtitle'>" + E(groundNm) + "</div>" +
        "<div class='fo-me-groundwrap'>" + foMeGroundArt(groundNm) + "</div><div class='fo-me-stadfoot'>" +
        "<div class='fo-me-occ'><div class='fo-me-ring' style='--fill:" + full + "%'><b>" + full + "%</b></div><span>Occupancy</span></div>" +
        "<div class='fo-me-cap'><b>" + (lastAtt || avgAtt || 0).toLocaleString() + " / " + seats.toLocaleString() + "</b>" +
        "<span>Next fixture: <em>" + E(oppNm) + "</em></span></div></div></section>" +
        "<div class='fo-me-right'><div class='fo-me-kpis'>" +
        "<div class='fo-me-card fo-me-kpi'><div class='ico'>" + foMeIcon("crowd") + "</div><div><span>Avg attendance</span><b>" + (avgAtt || lastAtt || 0).toLocaleString() + "</b></div></div>" +
        "<div class='fo-me-card fo-me-kpi green'><div class='ico'>" + foMeIcon("mood") + "</div><div><span>Supporter mood</span><b>" + E(moodWord.toUpperCase()) + "</b></div></div>" +
        "</div></div></div>";

      html += "<div class='fo-me-bottom'><section class='fo-me-levers flat'><div class='fo-me-panelhead'>Ground decisions</div>" +
        "<div class='fo-me-levergrid'>" +
        "<div class='fo-me-lever fo-tk'><div class='top'><div class='ic'>" + foMeIcon("price") + "</div><span>Ticket price</span></div>" +
        "<b class='num'><s id='fo-tk-val'>" + (TK_PEND != null ? TK_PEND : ticket) + "</s><i id='fo-tk-now'>" + (TK_PEND != null && TK_PEND !== ticket ? "now $" + ticket : "") + "</i></b>" +
        "<div class='fo-tk-dial'><button type='button' id='fo-tk-dn'>&minus;</button><button type='button' id='fo-tk-up'>+</button></div>" +
        "<em>Your gate, your price. Dearer thins the crowd; cheaper fills the ground early. Each match locks 24 hours before the first ball.</em>" +
        "<button type='button' id='fo-tk-set'" + (TK_PEND == null || TK_PEND === ticket ? " disabled" : "") + ">Set the price</button></div>" +
        "<div class='fo-me-lever'><div class='top'><div class='ic'>" + foMeIcon("ground") + "</div><span>Stadium capacity</span></div><b>" + seats.toLocaleString() + " &middot; " + full + "% full</b><em>" +
        (atCap ? "The ground is at the " + (Number(f.maxSeats) || 45000).toLocaleString() + "-seat ceiling."
               : "+" + seatStep.toLocaleString() + " seats costs " + M(nextSeatsCost) + ".") +
        "</em><button type='button' id='fo-fin-seats2'" + (canSeats ? "" : " disabled") + ">Explore expansion</button></div>" +
        "</div><div class='fo-fin-msg' id='fo-fin-msg'></div></section>" +
        "<section class='fo-me-card fo-me-forecast'><div class='fo-me-panelhead'><span>Next match</span><em>" + E(basis.toLowerCase()) + "</em></div><div class='fo-me-forecastbody'>" +
        "<div class='fo-me-opp'>" + (function () {
          // the visitor wears his own crest, not a monogram: the flagship its
          // painted arms, everybody else the drawn coat the whole game uses
          var oS = nf && nf.opp && nf.opp.slot != null ? (nf.opp.slot | 0) : null;
          var nat9 = (st.claim && st.claim.country) || "";
          if (oS === 0 && nat9) {
            try { var c9 = window.__foCxAPI.crest(nat9);
              if (c9) return "<img class='fo-me-shield crest' src='" + c9 + "' alt='' onerror=\"this.style.display='none'\">"; } catch (e9) {}
          }
          if (nf && nf.opp && nf.opp.name && window.foClubCrest) {
            try { return "<span class='fo-me-shield arms'>" + foClubCrest(oppNm, 52) + "</span>"; } catch (e8) {}
          }
          return "<div class='fo-me-shield'>" + E(oppNm.slice(0, 2).toUpperCase()) + "</div>";
        })() + "<b>" + E(oppNm) + "</b><span>" + (atHome ? "At home" : "Away fixture") + "</span></div>" +
        "<div class='fo-me-fgrid'>" +
        (atHome
          ? "<div class='fo-me-fstat'><span>Projected crowd</span><b>" + projectedCrowd.toLocaleString() + "</b></div>" +
            "<div class='fo-me-fstat'><span>Your share of the gate</span><b>" + M(projectedGate) + "</b></div>" +
            "<div class='fo-me-fstat'><span>Ticket</span><b>" + M(ticket) + "</b></div>" +
            "<div class='fo-me-fstat green'><span>Occupancy</span><b>" + pct(projectedCrowd, seats) + "%</b></div>"
          : "<div class='fo-me-fstat'><span>Gate at your ground</span><b>None</b></div>" +
            "<div class='fo-me-fstat'><span>You take</span><b>A third of theirs</b></div>" +
            "<div class='fo-me-fstat'><span>Away share so far</span><b>" + M(inAway) + "</b></div>" +
            "<div class='fo-me-fstat'><span>Crowd last time out</span><b>" + (lastAtt || avgAtt || 0).toLocaleString() + "</b></div>") +
        "</div></div></section></div>";

      // ---- THE GATE BOARD: every home Sunday still selling ------------------
      (function () {
        var cl = st.claim || null;
        try { cl = cl || window.__foWorldClaim || JSON.parse(localStorage.getItem("fo_world_claim") || "null"); } catch (eC0) {}
        var fxs = [];
        try { fxs = (window.foMyLeagueFixtures ? window.foMyLeagueFixtures(20) : []).filter(function (x) { return x.home; }).slice(0, 5); } catch (eFx) {}
        if (!cl || !fxs.length) return;
        var hist = tkHist();
        var now = Date.now();
        var mm = 0.55 + Math.max(0, Math.min(8, mood)) * (0.39 / 8);
        // division two plays to thinner stands - the same rule the walk banks
        var dv = 1;
        try {
          var lg9 = window.__foWorldLg && window.__foWorldLg.get(cl.country);
          if (lg9 && lg9.divisions && (lg9.divisions["2"] || []).indexOf(cl.slot | 0) >= 0) dv = 0.8;
        } catch (eDv) {}
        var rows9 = fxs.map(function (x) {
          var dr = tkDraw(cl, x.opp.slot);
          var demand = sup * mm * dv * dr.mult;
          var heat = tkHeat(dr.big, mood, x.round);
          var pf = tkFnFor(hist, x.season, x.round);
          var pNow = pf(now);
          var cur = tkSale(demand, seats, x.t0, pf, now, heat);
          var fin = tkSale(demand, seats, x.t0, pf, null, heat);
          var locked = now >= x.t0 - TK.LOCK;
          var pctS = seats ? Math.min(100, Math.round(100 * (locked ? fin.sold : cur.sold) / seats)) : 0;
          var dt9 = "";
          try { dt9 = new Date(x.t0).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); } catch (eD9) {}
          var left = x.t0 - TK.LOCK - now;
          var lockTxt = locked ? "Locked" : left < 86400000 ? "locks in " + Math.max(1, Math.round(left / 3600000)) + "h" : "locks in " + Math.round(left / 86400000) + "d";
          return "<div class='fo-gb-row num'>" +
            "<span class='rd'>R" + x.round + "<u>" + E(dt9) + "</u></span>" +
            "<span class='op'><b>v " + E(x.opp.name) + "</b>" +
            "<u><i style='width:" + pctS + "%'></i></u>" +
            "<s>" + (!locked && now < cur.opensAt
              ? "sales open in " + Math.max(1, Math.round((cur.opensAt - now) / 86400000)) + "d"
              : (locked ? fin.sold : cur.sold).toLocaleString() + " / " + seats.toLocaleString() + " sold" + (locked ? "" : " so far")) +
            (heat >= 0.6 && !locked ? " &middot; <b class='hot'>big draw</b>" : "") + "</s>" +
            (locked
              ? "<span class='pr lk num'>at $" + pNow + "</span>"
              : "<span class='pr num' data-sr='" + x.season + ":" + x.round + "' data-p='" + pNow + "'>" +
                "<button type='button' class='d'>&minus;</button><b>$" + pNow + "</b>" +
                "<button type='button' class='u'>+</button><button type='button' class='ok'>Set</button></span>") +
            "</span>" +
            "<span class='tk'><b>~" + M(Math.round(fin.take * (Number(f.homeCut) || 2 / 3) + fin.sold * TK.BCAST)) + "</b><u>your matchday</u>" +
            "<em class='" + (locked ? "lk" : "") + "'>" + lockTxt + "</em></span></div>";
        }).join("");
        html += "<section class='fo-me-card fo-gb'><div class='fo-me-panelhead'><span>The gate board</span>" +
          "<em>advance sales at today's mood &middot; the crowd locks 24h out</em></div>" + rows9 + "</section>";
      })();

      html += "<div class='fo-fin-foot'><a href='#/finance'>&lsaquo; Finances</a><a href='#/home'>The club &rsaquo;</a></div></div>";
      page.innerHTML = shell(html);
      wire(page, f, bank, st);
      wireGate(page);
      return;
    }

    // ---- FINANCES: THE SHEET - one daylight page of type -------------------
    // The totals the umpire keeps run from the founding, and the page says so:
    // bank = founding capital + net, to the pound, and the drift line below
    // shouts if that ever stops being true.
    var seasonN = Number(window.foSeasonN) || 0;
    var row = function (name, val, total, showZero) {
      if (!val && !showZero) return "";
      return "<div class='fo-tre-row num'><u>" + E(name) + "</u>" +
        "<s>" + (total > 0 && val ? pct(Math.abs(val), total) + "%" : "&mdash;") + "</s>" +
        "<b>" + M(val) + "</b></div>";
    };
    var html2 = "<div class='fo-tre'>" +
      "<div class='fo-tre-top'><span class='ey'>" + E(clubNm) + " &middot; Finances</span>" +
      "<span class='rt'>" + (rounds ? "Round " + rounds : "Pre-season") + (seasonN ? " &middot; Season " + seasonN : "") + "</span></div>";

    html2 += "<div class='fo-tre-head'><div>" +
      "<div class='fo-tre-bank num'>" + MFull(bank) + "</div>" +

      "</div>" + foShSpark(bank) + "</div>";

    html2 += "";

    html2 += "<div class='fo-tre-cols'><div>" +
      "<div class='fo-tre-sec'><span class='fo-tre-lbl'>In</span></div>" +
      row("Gate receipts", inGate, totIn, true) + row("Away gate share", inAway, totIn, true) +
      row("Broadcast fees", inBcast, totIn) +
      row("Sponsorship", inSpon, totIn, true) + row("International fees", inComp, totIn) +
      row("Transfer fees in", inFees, totIn) + row("Colts Cup purse", inPurse, totIn) +
      row("Written off at the floor", inWriteOff, totIn) +
      "<div class='fo-tre-tot num'><u>Total</u><b>" + M(totIn) + "</b></div>" +
      "</div><div>" +
      "<div class='fo-tre-sec'><span class='fo-tre-lbl'>Out</span></div>" +
      row("Player wages", outWage, totOut, true) + row("Ground & academy upkeep", outUp, totOut, true) +
      row("Transfer fees out", outFees, totOut) + row("Scouting", outScout, totOut) +
      row("Academy trips & contracts", outAcadSpend, totOut) +
      row("Building", outAcad + outSeats, totOut) + row("Overdraft interest", outInt, totOut) +
      "<div class='fo-tre-tot num'><u>Total</u><b>" + M(totOut) + "</b></div>" +
      "</div></div>";

    if (Math.abs(drift) >= 1) html2 += "<div class='fo-tre-drift'>The bank and the ledger disagree by " + M(drift) + " &mdash; a line has gone missing from the books.</div>";

    if (f.administration) html2 += "<div class='fo-fin-admin'><b>The club is in administration</b><p>The bank has reached the floor of " +
      M(-(Number(f.debtLimit) || 2500000)) + ", so " + M(inWriteOff) + " of losses below the line has been written off. " +
      "The sponsor pays half while the club is under and nothing gets built" +
      (f.adminRounds ? "; that has been the case for " + f.adminRounds + " round" + (f.adminRounds === 1 ? "" : "s") : "") +
      ". Gate income and a smaller wage bill are the route out.</p></div>";

    // the desk: what is coming, the one lever this room owns, and the doors
    var gateLine = !nf
      ? "<div class='fo-tre-line num'><u>Next gate &middot; <b>the season is played out</b></u><span class='pj'>&mdash;</span></div>"
      : atHome
      ? "<div class='fo-tre-line num'><u>Next gate &middot; <b>v " + E(oppNm) + "</b></u><span class='pj'>~" + Mk(projectedGate) + "</span></div>"
      : "<div class='fo-tre-line num'><u>Next match &middot; <b>at " + E(oppNm) + "</b></u><span class='pj'>a third of theirs</span></div>";
    html2 += "<div class='fo-tre-desk'><div>" + gateLine +
      "<div class='fo-tre-line num'><u>The academy &middot; <b>level " + acad + " of 5</b>" +
      (acad >= 5 ? " &middot; fully built" : " &middot; level " + (acad + 1) + " costs " + M(nextAcadCost)) + "</u>" +
      (acad < 5 ? "<button type='button' class='fo-tre-act' id='fo-fin-acad'" + (canAcad ? "" : " disabled") + ">Invest &rsaquo;</button>" : "") + "</div>" +
      "<div class='fo-fin-msg' id='fo-fin-msg'></div>" +
      "</div><div>" +
      "<a class='fo-tre-door' href='#/statement'><span class='fo-tre-lbl'>The statement</span><i>every entry, dated</i><span class='ch'>&rsaquo;</span></a>" +
      "<a class='fo-tre-door' href='#/ground'><span class='fo-tre-lbl'>The ground</span><i class='num'>" + seats.toLocaleString() + " seats &middot; " + full + "% full &middot; " + M(ticket) + "</i><span class='ch'>&rsaquo;</span></a>" +
      "<a class='fo-tre-door' href='#/squad'><span class='fo-tre-lbl'>The squad</span><i class='num'>" + squad.length + " seniors on " + M(billNow) + " a round</i><span class='ch'>&rsaquo;</span></a>" +
      "</div></div></div>";

    page.innerHTML = shell(html2);
    wire(page, f, bank, st);
  }



  // each home Sunday's own dial: nudge, then Set - one dated decision for
  // that match alone, beating the standing price from the moment it lands
  function wireGate(page) {
    page.querySelectorAll(".fo-gb .pr[data-sr]").forEach(function (pr) {
      var b9 = pr.querySelector("b"), ok = pr.querySelector(".ok");
      var sr = String(pr.getAttribute("data-sr")).split(":");
      var cur = parseInt(pr.getAttribute("data-p"), 10) || 26;
      var pend = cur;
      var show = function () {
        b9.textContent = "$" + pend;
        if (ok) ok.style.display = pend === cur ? "none" : "";
      };
      show();
      var dn = pr.querySelector(".d"), up = pr.querySelector(".u");
      if (dn) dn.addEventListener("click", function () { pend = Math.max(TK.MIN, pend - 2); show(); });
      if (up) up.addEventListener("click", function () { pend = Math.min(TK.MAX, pend + 2); show(); });
      if (ok) ok.addEventListener("click", function () {
        ok.disabled = true;
        rpc("world_set_ticket", { p_price: pend, p_season: +sr[0], p_round: +sr[1] })
          .then(function () { TKH.rows = null; TKH.at = 0; reload(page); })
          .catch(function (e9) {
            ok.disabled = false;
            try { window.foSayAt && foSayAt(ok, String(e9.message).slice(0, 120), "error"); } catch (e8) {}
          });
      });
    });
  }

  function wire(page, f, bank, st) {
    var msg = page.querySelector("#fo-fin-msg");
    var say = function (t, bad) { if (!msg) return; msg.textContent = t; msg.className = "fo-fin-msg" + (bad ? " bad" : ""); };
    // the masthead button and the lever tile are one decision with two doors:
    // the tile used to reach across and .click() the other one through an
    // inline onclick, which broke silently the moment either id moved
    // A STAND IS NOT BOUGHT IN A BROWSER DIALOG. The question opens where the
    // button stood - what it builds, what it costs, and what it means - so the
    // page being decided about is still on the screen while it is decided.
    var buy = function (btns, ask, go) {
      var all = btns.filter(Boolean);
      all.forEach(function (b) {
        b.addEventListener("click", function () {
          var a = ask();
          var commit = function () {
            all.forEach(function (x) { x.disabled = true; });
            go(function (t, bad) { if (bad) all.forEach(function (x) { x.disabled = false; }); say(t, bad); });
          };
          if (!window.foDecide) { commit(); return; }
          window.foDecide(b, { q: a.q, note: a.note, ok: a.ok || "Build it", onYes: commit });
        });
      });
    };
    var want = Number(f.nextSeats) || 0, cost = Number(f.nextSeatsCost) || 0;
    buy([page.querySelector("#fo-fin-seats"), page.querySelector("#fo-fin-seats2")],
      function () {
        return { q: "Build to " + want.toLocaleString() + " seats for " + M(cost) + "?",
                 note: "A stand is never taken down again.",
                 ok: "Build the stand" };
      },
      function (done) {
        done("Laying the concrete…");
        rpc("world_set_stadium", { p_seats: want })
          .then(function (r) {
            done("Built. The ground holds " + (r && r.seats ? Number(r.seats).toLocaleString() : want.toLocaleString()) + " now.");
            reload(page);
          })
          .catch(function (e) { done(String(e.message).slice(0, 160), true); });
      });

    // ---- the ticket dial: choose, then set - one dated decision ------------
    (function () {
      var vEl = page.querySelector("#fo-tk-val"), nowEl = page.querySelector("#fo-tk-now");
      var setB = page.querySelector("#fo-tk-set");
      var cur = Number(f.ticket) || 26;
      var show = function () {
        var v = TK_PEND != null ? TK_PEND : cur;
        if (vEl) vEl.textContent = v;
        if (nowEl) nowEl.textContent = TK_PEND != null && TK_PEND !== cur ? "now $" + cur : "";
        if (setB) setB.disabled = TK_PEND == null || TK_PEND === cur;
      };
      var nudge = function (d) {
        var v = (TK_PEND != null ? TK_PEND : cur) + d;
        TK_PEND = Math.max(TK.MIN, Math.min(TK.MAX, v));
        show();
      };
      var dn = page.querySelector("#fo-tk-dn"), up = page.querySelector("#fo-tk-up");
      if (dn) dn.addEventListener("click", function () { nudge(-2); });
      if (up) up.addEventListener("click", function () { nudge(2); });
      if (setB) setB.addEventListener("click", function () {
        var v = TK_PEND != null ? TK_PEND : cur;
        if (v === cur) return;
        var go9 = function () {
          say("Reprinting the tickets…");
          rpc("world_set_ticket", { p_price: v })
            .then(function () {
              TK_PEND = null; TKH.rows = null; TKH.at = 0;
              say("Done. A seat sells at $" + v + " from the next sales day.");
              reload(page);
            })
            .catch(function (e9) { say(String(e9.message).slice(0, 160), true); });
        };
        if (!window.foDecide) { go9(); return; }
        window.foDecide(setB, {
          q: "Sell tickets at $" + v + "?",
          note: v > cur ? "Dearer thins every crowd still to buy" + (v > 55 ? " - and past $60 they start staying home altogether" : "") + ". Matches inside 24 hours are already locked."
                        : "Cheaper fills the ground earlier and gives up the top of the gate.",
          ok: "Set $" + v, onYes: go9 });
      });
    })();

    var lv = (Number(f.academyLevel) || Number(st.academy) || 1) + 1;
    var acost = Number(f.nextAcademyCost) || [0, 400000, 900000, 1800000, 3200000][lv - 1] || 0;
    buy([page.querySelector("#fo-fin-acad")],
      function () {
        return { q: "Take the academy to level " + lv + " for " + M(acost) + "?",
                 note: "A level is never given back.",
                 ok: "Build it" };
      },
      function (done) {
        done("Signing the builders…");
        rpc("world_set_academy", { p_level: lv })
          .then(function (r) {
            done("The academy is level " + lv + ", and it cost " + M((r && r.cost) || acost) + ". The scout will bring back better men for it.");
            reload(page);
          })
          .catch(function (e) { done(String(e.message).slice(0, 160), true); });
      });
  }
  // money has moved, so every cached read of it is stale: the statement's
  // first page, the full statement, and the status the books were drawn from
  function reload(page) {
    FTX.lines = null; FTX.at = 0;
    SM.loaded = false; SM.lines = []; SM.more = false;
    FST.at = 0;
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
    "gate-away": "Away share", broadcast: "Broadcast fee", sponsor: "Sponsor",
    compensation: "International compensation", wages: "Player wages",
    upkeep: "Academy upkeep", interest: "Overdraft interest",
    "player-sale": "Player sales", "player-buy": "Player purchases",
    scouting: "Scouting reports", "written-off": "Written off",
    // the umpire writes these three too; without a heading each the statement
    // printed the raw slug - "coach", "contract", "colts-purse"
    contract: "Academy contracts", "colts-purse": "Colts Cup purse"
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
        "<span class='b'>" + MFull(l.balance) + "</span>" +
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
      "<header class='fo-nvmast'><div class='k'>The statement</div><h1>" + E(SM.club || "Your club") + "</h1></header>" +
      "<div class='fo-fin-bank'><div class='lb'>In the treasury</div><b>" + MFull(SM.bank) + "</b>" +
      "<div class='fo-fin-walk'><div><span>Entries on file</span><i>" + SM.entries + "</i></div>" +
      "<div><span>Showing</span><i>" + shown + "</i></div></div></div>" +
      "<div class='fo-seg fo-st-tabs'>" + tabs + "</div>" +
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
    foSheetGround(false);
    if (!jwt()) {
      page.innerHTML = shell(head("The statement",
        window.__foAuthPending
          ? "Reaching your club&hellip; the treasurer is fetching the book."
          : "Sign in to your Fifty Overs account and the treasurer will open the book." +
            "<br><button type='button' class='fo-door-btn' data-fo-door>Sign in</button>"));
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

  // ONE LOADER, TWO DOORS. Finances and the ground read the same world status
  // and the same figures; only the room differs, so the fetching, the signed-out
  // copy and the error path are written once and told which room they are for.
  function financeRoom(room) {
    var page = document.getElementById("page"); if (!page) return;
    var TITLE = room === "ground" ? "The ground" : "Finances";
    foFinCss();
    document.body.classList.add("fo-fin-on");
    // the Sheet stands on paper; the ground and the statement keep the cream.
    // The ground is painted inline: three generations of skin already fight
    // over the body with !important, and an inline important is the one move
    // none of them can answer.
    foSheetGround(room !== "ground");
    // a fresh status repaints straight away: the placeholder is for a cold
    // open, not for every return to a page whose figures have not moved
    if (FST.st && Date.now() - FST.at < 30000) { render(page, FST.st, room); return; }
    page.innerHTML = shell(head(TITLE, "Walking down to the treasurer&rsquo;s office&hellip;"));
    if (!jwt()) {
      // each room says what IT is - the ground page borrowed the treasurer's
      // line about ledgers, which read like a copy-paste because it was one
      page.innerHTML = shell(head(TITLE,
        (window.__foAuthPending
          ? (room === "ground" ? "Reaching your club&hellip; the ground staff are opening the gates." : "Reaching your club&hellip; the ledger is on its way.")
          : (room === "ground"
              ? "Sign in and your ground is here."
              : "Sign in and the ledger is here.") +
            "<br><button type='button' class='fo-door-btn' data-fo-door>Sign in</button>")));
      return;
    }
    rpc("world_my_status").then(function (st) {
      if (!st || st.signedIn === false) {
        page.innerHTML = shell(head(TITLE, "Sign in first &mdash; these books belong to a club, and the world keeps them." +
          "<br><button type='button' class='fo-door-btn' data-fo-door>Sign in</button>"));
        return;
      }
      if (!st.claim) {
        page.innerHTML = shell(head(TITLE,
          "You don&rsquo;t hold a club yet &mdash; one is claimed for you on the next load."));
        return;
      }
      FST.st = st; FST.at = Date.now();
      render(page, st, room);
    }).catch(function (e) {
      page.innerHTML = shell(head(TITLE,
        "The world could not be reached (" + E(String(e.message).slice(0, 90)) + "). The books are safe where they are &mdash; try again in a minute."));
    });
  }
  window.foRenderFinancePage = function () { financeRoom("finance"); };
  window.foRenderGroundPage = function () { financeRoom("ground"); };
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
        a = document.createElement("a"); a.className = "fo-books-nav"; a.href = "#/finance"; a.textContent = "Finances";
        a.addEventListener("click", function (ev) { ev.preventDefault(); location.hash = "#/finance"; if (typeof window.route === "function") window.route(); });
      }
      // beside the squad, after Fixtures if that pill has already landed
      if (a.parentNode !== wrap) {
        var anchor = wrap.querySelector("a.fo-fixtures") || wrap.querySelector("a[data-nav='squad']");
        if (anchor && anchor.nextSibling) wrap.insertBefore(a, anchor.nextSibling);
        else wrap.appendChild(a);
      }
      var h9 = (location.hash || "").split("?")[0];
      a.classList.toggle("on", h9 === "#/finance" || h9 === "#/statement" || h9 === "#/ground");
      // Log out is furniture and belongs last, however late a pill arrives
      var out = wrap.querySelector("a.fo-logout");
      if (out && wrap.lastElementChild !== out) wrap.appendChild(out);
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () {
    var h8 = (location.hash || "").split("?")[0];
    if (h8 !== "#/finance" && h8 !== "#/statement" && h8 !== "#/ground") document.body.classList.remove("fo-fin-on");
    if (h8 !== "#/finance") foSheetGround(false);
    setTimeout(ensureNavLink, 90);
  });
  [200, 600, 1400].forEach(function (ms) { setTimeout(ensureNavLink, ms); });
})();
