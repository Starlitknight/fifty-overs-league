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
      "html body.fo-fin-on{background:#F3F0E7 !important}",
      "html body.fo-fin-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body #page .fo-fin{--ink:#141C28;--paper:#FFFEFC;--band:#F4EFE3;--brand:#C95532;--gold:#C89A2E;--navy:#0E2246;",
      "  max-width:1500px;margin:0 auto;padding:24px 28px 44px;color:var(--ink);font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
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
      ".fo-fin{padding:18px 12px 40px}.fo-fin-bank{padding:18px}}",
      // ---- THE DASHBOARD SKIN: the books in the club-page card language ----
      ".fo-f2{--acc:#C9571F;--navy:#14243A;--mut:#67748a;--edge:rgba(27,36,50,.09);--grn:#177A57;--red:#B23230;display:flex;flex-direction:column;gap:12px}",
      ".fo-f2 .fo-f2-hd{display:flex;align-items:flex-start;gap:12px}",
      ".fo-f2 .fo-f2-hd h1{font:700 30px/1 Oswald,sans-serif;text-transform:uppercase;color:var(--navy);margin:0;letter-spacing:.01em;font-family:Oswald,sans-serif}",
      ".fo-f2 .fo-f2-hd p{font:400 12.5px/1.4 Inter,sans-serif;color:var(--mut);margin:7px 0 0;font-style:normal;font-family:Inter,sans-serif}",
      ".fo-f2-chip{margin-left:auto;flex:none;background:#FFFEFC;border:1px solid var(--edge);border-radius:11px;padding:10px 13px;text-align:right}",
      ".fo-f2-chip span{font:600 8.5px/1 Oswald,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:#8a93a2;display:block}",
      "html body #page .fo-f2-chip b{display:block;font:700 16px/1.3 Inter,sans-serif;color:var(--navy);font-variant-numeric:tabular-nums}",
      ".fo-f2-card{background:#FFFEFC;border:1px solid var(--edge);border-radius:13px;padding:15px 16px;box-shadow:0 1px 2px rgba(14,35,63,.05);text-align:left}",
      ".fo-f2-sh{display:flex;align-items:center;font:600 11.5px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--navy);margin:-15px -16px 13px;padding:12px 16px 11px;background:linear-gradient(0deg,rgba(14,35,63,.03),rgba(14,35,63,.06));border-bottom:1px solid var(--edge);border-radius:12px 12px 0 0}",
      ".fo-f2-sh:before{content:'';display:inline-block;width:7px;height:7px;background:var(--acc);border-radius:2px;margin-right:9px}",
      "html body #page .fo-f2-sh a{margin-left:auto;font:600 10px/1 Oswald,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--acc) !important;text-decoration:none !important}",
      ".fo-f2-tiles{display:grid;grid-template-columns:1fr 1fr;gap:11px}",
      "@media(min-width:900px){.fo-f2-tiles{grid-template-columns:repeat(4,1fr)}}",
      ".fo-f2-tile{background:#FFFEFC;border:1px solid var(--edge);border-radius:13px;padding:14px;text-align:center}",
      ".fo-f2-tile .ic{width:38px;height:38px;border-radius:50%;background:var(--navy);color:#F1EEE6;display:flex;align-items:center;justify-content:center;font:700 15px/1 Inter,sans-serif;margin:0 auto 9px}",
      ".fo-f2-tile span{font:600 8.5px/1.35 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a93a2;display:block}",
      "html body #page .fo-f2-tile b{display:block;font:700 19px/1.2 Inter,sans-serif;margin-top:5px;font-variant-numeric:tabular-nums}",
      "html body #page .fo-f2-tile b.up{color:var(--grn)}html body #page .fo-f2-tile b.dn{color:#B44A22}html body #page .fo-f2-tile b.nv{color:var(--navy)}",
      "html body #page .fo-f2-tile i{display:block;font:400 10px/1.4 Inter,sans-serif;font-style:normal;color:#8a93a2;margin-top:5px}",
      ".fo-f2-tile .bar{height:6px;border-radius:99px;background:#EBE6DA;margin-top:8px;overflow:hidden}",
      ".fo-f2-tile .bar u{display:block;height:100%;background:var(--acc);border-radius:99px}",
      ".fo-f2-duo{display:grid;grid-template-columns:1fr;gap:12px}",
      "@media(min-width:900px){.fo-f2-duo{grid-template-columns:1fr 1fr}}",
      ".fo-f2-r{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(27,36,50,.05);font:400 12.5px/1.3 Inter,sans-serif;color:#1B2432}",
      ".fo-f2-r:last-of-type{border-bottom:0}",
      "html body #page .fo-f2-r b{margin-left:auto;font-weight:600;font-variant-numeric:tabular-nums;color:#1B2432}",
      "html body #page .fo-f2-r b.up{color:var(--grn)}html body #page .fo-f2-r b.dn{color:#B44A22}",
      ".fo-f2-r em{font-style:normal;width:36px;text-align:right;font:400 10.5px/1 Inter,sans-serif;color:#8a93a2}",
      ".fo-f2-r.tot{border-top:1.5px solid var(--edge);font-weight:700;padding-top:10px}",
      ".fo-f2-chart svg{width:100%;height:auto;display:block}",
      ".fo-f2-leg{display:flex;gap:14px;justify-content:center;margin-top:8px;font:400 10px/1 Inter,sans-serif;color:var(--mut)}",
      ".fo-f2-tx .r{display:flex;align-items:center;gap:10px;padding:8.5px 0;border-bottom:1px solid rgba(27,36,50,.05)}",
      ".fo-f2-tx .r:last-of-type{border-bottom:0}",
      ".fo-f2-tx .r i{flex:none;width:20px;height:20px;border-radius:50%;font-style:normal;display:flex;align-items:center;justify-content:center;font:700 12px/1 Inter,sans-serif;color:#fff}",
      ".fo-f2-tx .r i.up{background:var(--grn)}.fo-f2-tx .r i.dn{background:var(--red)}",
      ".fo-f2-tx .r .w{min-width:0;font:500 12px/1.3 Inter,sans-serif;color:#1B2432}",
      ".fo-f2-tx .r .w u{display:block;text-decoration:none;font:400 10px/1.4 Inter,sans-serif;color:#8a93a2}",
      ".fo-f2-tx .r .d{margin-left:auto;font:400 10px/1 Inter,sans-serif;color:#8a93a2;white-space:nowrap}",
      ".fo-f2-tx .r .a{font:600 12px/1 Inter,sans-serif;white-space:nowrap;min-width:74px;text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-f2-tx .r .a.up{color:var(--grn)}.fo-f2-tx .r .a.dn{color:var(--red)}",
      ".fo-f2-hl .in9{display:flex;gap:14px;align-items:center}",
      ".fo-f2-hl .gr{flex:none;width:64px;height:64px;border-radius:50%;border:3px solid var(--grn);display:flex;flex-direction:column;align-items:center;justify-content:center}",
      ".fo-f2-hl .gr.warn{border-color:#B58128}.fo-f2-hl .gr.bad{border-color:var(--red)}",
      "html body #page .fo-f2-hl .gr b{font:700 26px/1 'Fraunces',Georgia,serif;color:var(--grn)}",
      "html body #page .fo-f2-hl .gr.warn b{color:#B58128}html body #page .fo-f2-hl .gr.bad b{color:var(--red)}",
      ".fo-f2-hl .gr span{font:600 6.5px/1 Oswald,sans-serif;letter-spacing:.14em;color:var(--mut);margin-top:2px;text-transform:uppercase}",
      ".fo-f2-hl p{font:400 12px/1.55 Inter,sans-serif;color:#3c4757;margin:0}",
      ".fo-f2-hs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;border-top:1px solid var(--edge);margin-top:13px;padding-top:12px;text-align:center}",
      ".fo-f2-hs span{font:600 8.5px/1.4 Oswald,sans-serif;letter-spacing:.11em;text-transform:uppercase;color:#8a93a2;display:block}",
      "html body #page .fo-f2-hs b{display:block;font:600 13px/1.3 Inter,sans-serif;color:var(--navy);margin-top:3px}",
      ".fo-f2-hs i{display:block;font-style:normal;font:400 9.5px/1.35 Inter,sans-serif;color:#8a93a2;margin-top:2px}",
      // ---- MATCHDAY ECONOMY: the selected premium commercial dashboard ----
      ".fo-me{--navy:#102641;--ink:#17263B;--orange:#D94716;--gold:#C79A31;--green:#16805A;--paper:#FFFEFB;--edge:#DCD7CB;--mut:#6D7786;display:flex;flex-direction:column;gap:16px;color:var(--ink)}",
      ".fo-me *{box-sizing:border-box}",
      ".fo-me-head{display:flex;align-items:flex-end;gap:24px;padding:2px 2px 5px}",
      ".fo-me-ey{color:var(--orange);font:700 9px/1 Oswald,sans-serif;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px}",
      ".fo-me-head h1{margin:0;color:var(--ink);font:600 clamp(38px,4.2vw,58px)/.95 'Fraunces',Georgia,serif;letter-spacing:-.035em}",
      ".fo-me-head p{margin:10px 0 0;color:#505B69;font:400 13px/1.5 Inter,sans-serif}",
      ".fo-me-actions{display:flex;align-items:center;gap:10px;margin-left:auto;padding-bottom:2px}",
      "html body #page .fo-me-btn,html body #page button.fo-me-btn{display:inline-flex;align-items:center;justify-content:center;height:46px;min-width:142px;padding:0 18px !important;border:1px solid #CFC8B9 !important;border-radius:7px !important;background:#FFFEFB !important;color:var(--ink) !important;font:700 10px/1 Oswald,sans-serif !important;letter-spacing:.13em;text-transform:uppercase;text-decoration:none !important;box-shadow:none !important}",
      "html body #page .fo-me-btn.primary,html body #page button.fo-me-btn.primary{border-color:var(--orange) !important;background:var(--orange) !important;color:#fff !important}",
      "html body #page button.fo-me-btn[disabled]{background:#D7D2C7 !important;border-color:#D7D2C7 !important;color:#8D877C !important;cursor:not-allowed}",
      ".fo-me-top{display:grid;grid-template-columns:minmax(360px,1.02fr) minmax(620px,1.98fr);gap:16px;align-items:stretch}",
      ".fo-me-card{background:var(--paper);border:1px solid var(--edge);border-radius:11px;box-shadow:0 2px 8px rgba(20,35,55,.035);overflow:hidden}",
      ".fo-me-stadium{padding:17px 18px 15px;display:flex;flex-direction:column;min-height:424px}",
      ".fo-me-cardtitle{display:flex;align-items:center;gap:11px;margin:0 0 12px;color:var(--ink);font:700 12px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}",
      ".fo-me-cardtitle:before,.fo-me-cardtitle:after{content:'';height:1px;flex:1;background:#D2A746}.fo-me-cardtitle:before{max-width:36px}",
      ".fo-me-oval{position:relative;width:min(92%,420px);aspect-ratio:1.56;margin:5px auto 12px;border:20px solid #E9E2D2;border-radius:50%;background:repeating-conic-gradient(from 2deg,#15304F 0 7deg,#F7F3E9 7deg 11deg,#D95A2C 11deg 17deg,#F7F3E9 17deg 20deg);box-shadow:inset 0 0 0 3px #BEA25F,0 7px 18px rgba(23,38,59,.1)}",
      ".fo-me-oval:before{content:'';position:absolute;inset:17px;border:8px solid #F5F0E4;border-radius:50%;background:repeating-linear-gradient(90deg,rgba(255,255,255,.045) 0 30px,rgba(8,60,35,.04) 30px 60px),#477C4D;box-shadow:inset 0 0 0 2px rgba(255,255,255,.4)}",
      ".fo-me-pitch{position:absolute;z-index:2;left:50%;top:50%;width:34px;height:118px;transform:translate(-50%,-50%);border:1px solid rgba(255,255,255,.66);background:#CBB889;box-shadow:0 0 0 1px rgba(45,72,42,.2)}",
      ".fo-me-pitch:before,.fo-me-pitch:after{content:'';position:absolute;left:-7px;width:46px;border-top:2px solid rgba(255,255,255,.75)}.fo-me-pitch:before{top:16px}.fo-me-pitch:after{bottom:16px}",
      ".fo-me-stadfoot{display:grid;grid-template-columns:96px 1fr;gap:18px;align-items:center;margin-top:auto}",
      ".fo-me-ring{width:78px;height:78px;border-radius:50%;display:flex;align-items:center;justify-content:center;position:relative;background:conic-gradient(var(--green) var(--fill),#E9E5DC 0);margin:auto}",
      ".fo-me-ring:after{content:'';position:absolute;inset:8px;border-radius:50%;background:var(--paper)}",
      ".fo-me-ring b{position:relative;z-index:2;font:700 22px/1 Inter,sans-serif}.fo-me-ring span{position:absolute;z-index:2;top:13px;font:700 6px/1 Oswald,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--mut)}",
      ".fo-me-cap b{display:block;color:var(--ink);font:700 25px/1.1 Inter,sans-serif;font-variant-numeric:tabular-nums}.fo-me-cap span{display:block;margin-top:8px;padding-top:8px;border-top:1px solid #D6CDBB;color:var(--mut);font:700 8px/1.2 Oswald,sans-serif;letter-spacing:.15em;text-transform:uppercase}.fo-me-cap em{color:var(--orange);font-style:normal}",
      ".fo-me-right{display:grid;grid-template-rows:auto 1fr;gap:16px;min-width:0}",
      ".fo-me-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}",
      ".fo-me-kpi{min-height:105px;padding:16px 14px;display:grid;grid-template-columns:42px 1fr;gap:12px;align-items:center}",
      ".fo-me-kpi .ico{width:42px;height:42px;border:1.5px solid currentColor;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--orange);font:700 17px/1 Inter,sans-serif}.fo-me-kpi.green .ico,.fo-me-kpi.green b{color:var(--green)}.fo-me-kpi.gold .ico,.fo-me-kpi.gold b{color:var(--gold)}",
      ".fo-me-kpi span{display:block;color:#677282;font:700 8px/1.3 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase}.fo-me-kpi b{display:block;margin-top:7px;color:var(--ink);font:700 20px/1 Inter,sans-serif;font-variant-numeric:tabular-nums;white-space:nowrap}",
      ".fo-me-data{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(260px,.9fr);gap:16px;min-height:303px}",
      ".fo-me-panelhead{height:46px;display:flex;align-items:center;padding:0 16px;border-bottom:1px solid #E4DFD5;color:var(--ink);font:700 10px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase}",
      ".fo-me-chart{padding:0 16px 14px;display:flex;flex-direction:column}",
      ".fo-me-bars{position:relative;display:flex;align-items:flex-end;justify-content:space-around;gap:12px;height:205px;margin-top:14px;padding:12px 14px 26px;border-left:1px solid #D8DDE2;border-bottom:1px solid #D8DDE2;background:repeating-linear-gradient(to bottom,#fff 0 39px,#E9ECEF 40px)}",
      ".fo-me-bar{position:relative;flex:1;max-width:42px;height:var(--h);min-height:8px;background:linear-gradient(180deg,#F05B22,#D94716);border-radius:3px 3px 0 0;box-shadow:0 3px 7px rgba(217,71,22,.15)}",
      ".fo-me-bar b{position:absolute;left:50%;bottom:calc(100% + 6px);transform:translateX(-50%);font:700 8px/1 Inter,sans-serif;color:var(--orange);white-space:nowrap}.fo-me-bar span{position:absolute;left:50%;top:calc(100% + 8px);transform:translateX(-50%);font:700 7px/1 Oswald,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);white-space:nowrap}",
      ".fo-me-chartleg{display:flex;justify-content:center;gap:18px;margin-top:10px;color:var(--mut);font:500 8px/1 Inter,sans-serif}.fo-me-chartleg i{width:14px;height:5px;background:var(--orange);display:inline-block;margin-right:5px}.fo-me-chartleg i.nv{height:2px;background:var(--navy)}",
      ".fo-me-empty{display:flex;align-items:center;justify-content:center;height:190px;color:var(--mut);font:500 11px/1.5 Inter,sans-serif;text-align:center}",
      ".fo-me-mix{padding-bottom:14px}",
      ".fo-me-mixbody{display:grid;grid-template-columns:130px 1fr;gap:12px;align-items:center;padding:20px 16px 8px}",
      ".fo-me-donut{width:126px;height:126px;border-radius:50%;position:relative;background:var(--mix);box-shadow:inset 0 0 0 1px rgba(19,38,64,.08)}.fo-me-donut:after{content:'REVENUE';position:absolute;inset:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--paper);color:var(--mut);font:700 7px/1 Oswald,sans-serif;letter-spacing:.12em}",
      ".fo-me-mixrow{display:grid;grid-template-columns:9px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #EEEAE2;color:#4D5968;font:500 9px/1 Inter,sans-serif}.fo-me-mixrow:last-child{border-bottom:0}.fo-me-mixrow i{width:8px;height:8px;border-radius:50%}.fo-me-mixrow b{font-size:10px;color:var(--ink)}",
      ".fo-me-bottom{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(410px,1fr);gap:16px}",
      ".fo-me-levers{padding:0 14px 14px}",
      ".fo-me-levergrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}",
      ".fo-me-lever{min-height:145px;border:1px solid #E2D9C7;border-radius:8px;padding:13px;background:#FFFEFB;display:flex;flex-direction:column}",
      ".fo-me-lever .top{display:flex;align-items:center;gap:9px}.fo-me-lever .ic{width:34px;height:34px;border:1px solid #D7C49B;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--orange);font:700 13px/1 Inter,sans-serif}.fo-me-lever span{color:#4E5968;font:700 8px/1.2 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}",
      ".fo-me-lever b{display:block;margin-top:7px;color:var(--ink);font:700 16px/1.1 Inter,sans-serif}.fo-me-lever em{display:block;margin:8px 0;color:var(--mut);font:400 9px/1.4 Inter,sans-serif;font-style:normal}",
      "html body #page .fo-me-lever button{margin-top:auto;width:100%;border:0 !important;border-top:1px solid #E2D9C7 !important;border-radius:0 !important;background:transparent !important;color:var(--orange) !important;text-align:left;font:700 8px/1 Oswald,sans-serif !important;letter-spacing:.11em;text-transform:uppercase;padding:10px 0 0 !important;box-shadow:none !important}.fo-me-lever button[disabled]{color:#9E978A !important}",
      ".fo-me-forecast{padding-bottom:14px}.fo-me-forecastbody{display:grid;grid-template-columns:138px 1fr;gap:14px;padding:13px 16px 0;align-items:stretch}.fo-me-opp{display:flex;flex-direction:column;align-items:center;justify-content:center;border-right:1px solid #E5DFD4;text-align:center}.fo-me-shield{width:56px;height:62px;clip-path:polygon(8% 0,92% 0,88% 70%,50% 100%,12% 70%);display:flex;align-items:center;justify-content:center;background:#D9A91F;color:#102641;font:700 17px/1 'Fraunces',serif}.fo-me-opp b{margin-top:9px;font:700 16px/1.1 'Fraunces',Georgia,serif}.fo-me-opp span{margin-top:6px;color:var(--mut);font:700 7px/1 Oswald,sans-serif;letter-spacing:.14em;text-transform:uppercase}",
      ".fo-me-fgrid{display:grid;grid-template-columns:1fr 1fr}.fo-me-fstat{padding:11px;border-bottom:1px solid #E9E4DB}.fo-me-fstat:nth-child(odd){border-right:1px solid #E9E4DB}.fo-me-fstat span{display:block;color:#7B8491;font:700 7px/1.2 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}.fo-me-fstat b{display:block;margin-top:6px;color:var(--ink);font:700 15px/1 Inter,sans-serif}.fo-me-fstat.green b{color:var(--green)}",
      ".fo-me-account{display:grid;grid-template-columns:1fr 1fr 1.05fr;gap:16px}",
      ".fo-me-account .fo-f2-card{min-width:0}",
      ".fo-me-health{background:var(--navy);color:#fff;padding:16px}.fo-me-health h3{margin:0 0 12px;color:#D6AA45;font:700 10px/1 Oswald,sans-serif;letter-spacing:.15em;text-transform:uppercase}.fo-me-health .grade{display:flex;align-items:center;gap:14px;padding:5px 0 13px;border-bottom:1px solid rgba(255,255,255,.14)}.fo-me-health .grade b{font:600 48px/1 'Fraunces',serif;color:#D6AA45}.fo-me-health .grade span{font:700 14px/1 Oswald,sans-serif;letter-spacing:.12em;color:#61C697}.fo-me-health .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:13px;text-align:center}.fo-me-health .stats span{display:block;color:#8FA1B8;font:700 7px/1 Oswald,sans-serif;letter-spacing:.12em;text-transform:uppercase}.fo-me-health .stats b{display:block;margin-top:5px;color:#fff;font:700 13px/1 Inter,sans-serif}.fo-me-health p{margin:14px 0 0;color:#AFBED0;font:400 9px/1.5 Inter,sans-serif}",
      "@media(max-width:1180px){.fo-me-top{grid-template-columns:340px 1fr}.fo-me-kpis{grid-template-columns:1fr 1fr}.fo-me-levergrid{grid-template-columns:1fr 1fr}.fo-me-bottom{grid-template-columns:1fr}.fo-me-account{grid-template-columns:1fr 1fr}.fo-me-account .fo-me-health{grid-column:1/-1}}",
      "@media(max-width:820px){.fo-fin{padding:18px 12px 88px}.fo-me-head{display:block}.fo-me-actions{margin:16px 0 0}.fo-me-top,.fo-me-data,.fo-me-bottom,.fo-me-account{display:flex;flex-direction:column}.fo-me-kpis{grid-template-columns:1fr 1fr}.fo-me-stadium{min-height:390px}.fo-me-levergrid{grid-template-columns:1fr 1fr}.fo-me-forecastbody{grid-template-columns:110px 1fr}}",
      "@media(max-width:520px){.fo-me-head h1{font-size:40px}.fo-me-actions{display:grid;grid-template-columns:1fr 1fr}.fo-me-actions .fo-me-btn{min-width:0;width:100%}.fo-me-kpis,.fo-me-levergrid{grid-template-columns:1fr}.fo-me-mixbody,.fo-me-forecastbody{grid-template-columns:1fr}.fo-me-opp{border-right:0;border-bottom:1px solid #E5DFD4;padding-bottom:12px}.fo-me-stadfoot{grid-template-columns:82px 1fr}}"
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
    return "<header class='fo-nvmast'><div class='k'>The books</div>" +
      "<h1>" + E(clubNm || "Your club") + "</h1>" +
      (sub ? "<p>" + sub + "</p>" : "") + "</header>";
  }

  // the statement's first page powers the balance line and the latest entries;
  // it lands once, after the books, and the page repaints with it
  var FTX = { at: 0, lines: null, busy: false };
  function wantTx() {
    if (FTX.busy || (FTX.lines && Date.now() - FTX.at < 60000)) return;
    FTX.busy = true;
    rpc("world_my_statement", { p_limit: 40 })
      .then(function (r) {
        FTX.busy = false; FTX.at = Date.now();
        FTX.lines = (r && r.lines) || [];
        if ((location.hash || "").indexOf("#/finance") === 0) window.foRenderFinancePage();
      })
      .catch(function () { FTX.busy = false; FTX.at = Date.now(); FTX.lines = []; });
  }
  // the balance walked over time, as one honest navy line
  function chartCard() {
    var ls = (FTX.lines || []).slice().reverse();      // oldest first
    if (ls.length < 3) return "";
    var pts = ls.map(function (l) { return Number(l.balance) || 0; });
    var lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts);
    if (hi === lo) { hi += 1; }
    var W = 360, H = 120, PX = 14, PY = 14;
    var xy = pts.map(function (v, i) {
      var x = PX + (W - 2 * PX) * (pts.length === 1 ? 0 : i / (pts.length - 1));
      var y = H - PY - (H - 2 * PY) * ((v - lo) / (hi - lo));
      return x.toFixed(1) + "," + y.toFixed(1);
    }).join(" ");
    return "<div class='fo-f2-card fo-f2-chart'><div class='fo-f2-sh'>The treasury's line</div>" +
      "<svg viewBox='0 0 " + W + " " + H + "' role='img' aria-label='Bank balance over time'>" +
      "<line x1='" + PX + "' y1='" + (H - PY) + "' x2='" + (W - PX) + "' y2='" + (H - PY) + "' stroke='rgba(27,36,50,.12)'/>" +
      "<polyline points='" + xy + "' fill='none' stroke='#14243A' stroke-width='2.5' stroke-linecap='round'/>" +
      "</svg>" +
      "<div class='fo-f2-leg'><span>" + Mk(lo) + " low</span><span>&middot;</span><span>" + Mk(hi) + " high</span><span>&middot;</span><span>last " + ls.length + " entries</span></div></div>";
  }
  function txCard() {
    if (FTX.lines === null) return "<div class='fo-f2-card fo-f2-tx'><div class='fo-f2-sh'>Recent transactions</div>" +
      "<div class='fo-st-none'>Opening the statement&hellip;</div></div>";
    if (!FTX.lines.length) return "";
    var rows = FTX.lines.slice(0, 6).map(function (l) {
      var d = stDate(l.at), type = STK[l.kind] || l.kind, det = stDetail(type, l.label);
      var up = l.amount > 0;
      return "<div class='r'><i class='" + (up ? "up" : "dn") + "'>" + (up ? "+" : "&minus;") + "</i>" +
        "<span class='w'>" + E(type) + (det ? "<u>" + E(det) + "</u>" : "") + "</span>" +
        "<span class='d'>" + E(d.day.replace(/^\w+ /, "").replace(/ \d{4}$/, "")) + "</span>" +
        "<span class='a " + (up ? "up" : "dn") + "'>" + (up ? "+" : "&minus;") + M(Math.abs(l.amount)) + "</span></div>";
    }).join("");
    return "<div class='fo-f2-card fo-f2-tx'><div class='fo-f2-sh'>Recent transactions<a href='#/statement'>View all &rsaquo;</a></div>" + rows + "</div>";
  }

  function foMeGateData(ticket, total) {
    var rows = (FTX.lines || []).filter(function (l) {
      var s = String((l && l.kind) || "") + " " + String((l && l.label) || "");
      return Number(l && l.amount) > 0 && /gate|matchday/i.test(s);
    }).slice(0, 6).reverse();
    if (!rows.length && total > 0) rows = [{ amount: total, label: "Season to date" }];
    return rows.map(function (l, i) {
      var value = Math.round(Number(l.amount) || 0);
      var att = Math.round(value / Math.max(1, ticket));
      var label = "H" + (i + 1);
      try {
        var d = stDate(l.at); if (d && d.day) label = d.day.replace(/^\w+\s+/, "").replace(/\s+\d{4}$/, "");
      } catch (e) {}
      return { value: value, attendance: att, label: label };
    });
  }

  function foMeRevenueChart(ticket, totalGate) {
    var rows = foMeGateData(ticket, totalGate);
    if (!rows.length) return "<section class='fo-me-card fo-me-chart'><div class='fo-me-panelhead'>Revenue by home match</div><div class='fo-me-empty'>The first home gate will appear here once the turnstiles close.</div></section>";
    var max = Math.max.apply(null, rows.map(function (r) { return r.value; }).concat([1]));
    var bars = rows.map(function (r) {
      var h = Math.max(8, Math.round(100 * r.value / max));
      return "<div class='fo-me-bar' style='--h:" + h + "%'><b>" + Mk(r.value) + "</b><span>" + E(r.label) + "</span></div>";
    }).join("");
    return "<section class='fo-me-card fo-me-chart'><div class='fo-me-panelhead'>Revenue by home match</div>" +
      "<div class='fo-me-bars'>" + bars + "</div><div class='fo-me-chartleg'><span><i></i>Gate revenue</span><span><i class='nv'></i>" +
      (rows.length === 1 ? rows[0].attendance.toLocaleString() + " attendance" : "derived from the dated gate") + "</span></div></section>";
  }

  function foMeMix(gate, sponsor, away, fees) {
    var vals = [Math.max(0, gate), Math.max(0, sponsor), Math.max(0, away), Math.max(0, fees)];
    var tot = vals.reduce(function (s, v) { return s + v; }, 0) || 1;
    var ps = vals.map(function (v) { return Math.round(100 * v / tot); });
    ps[0] += 100 - ps.reduce(function (s, v) { return s + v; }, 0);
    var a = ps[0], b = a + ps[1], c = b + ps[2];
    var mix = "conic-gradient(#D94716 0 " + a + "%,#102641 " + a + "% " + b + "%,#16805A " + b + "% " + c + "%,#C79A31 " + c + "% 100%)";
    var row = function (name, p, col) { return "<div class='fo-me-mixrow'><i style='background:" + col + "'></i><span>" + name + "</span><b>" + p + "%</b></div>"; };
    return "<section class='fo-me-card fo-me-mix'><div class='fo-me-panelhead'>Revenue mix</div><div class='fo-me-mixbody'>" +
      "<div class='fo-me-donut' style='--mix:" + mix + "'></div><div>" + row("Gate", ps[0], "#D94716") +
      row("Sponsor", ps[1], "#102641") + row("Away share", ps[2], "#16805A") + row("Fees", ps[3], "#C79A31") + "</div></div></section>";
  }

  function renderLegacy(page, st) {
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
    var net = totIn - totOut;
    var squad = (st.squad || []).slice().filter(function (p) { return p && p.name; });
    var billNow = squad.reduce(function (s2, p) { return s2 + (Number(p.wage) || 0); }, 0);
    var wageShare = totIn > 0 ? pct(outWage, totIn) : 0;

    if (jwt()) wantTx();

    // ---- the masthead ----------------------------------------------------
    var html = "<div class='fo-f2'>" +
      "<div class='fo-f2-hd'><div><h1>Finances</h1><p>The books of " + E(clubNm) + "</p></div>" +
      "<div class='fo-f2-chip'><span>Bank balance</span><b>" + M(bank) + "</b></div></div>";

    // ---- the four tiles --------------------------------------------------
    var brkLine = function (nm, v, tot, dir) {
      var p9 = tot > 0 ? pct(Math.abs(v), tot) : 0;
      return "<div class='fo-f2-r'>" + E(nm) + "<b class='" + dir + "'>" + M(v) + "</b><em>" + (p9 ? p9 + "%" : "&mdash;") + "</em></div>";
    };
    html += "<div class='fo-f2-tiles'>" +
      "<div class='fo-f2-tile'><div class='ic'>+</div><span>Taken this season</span><b class='up'>" + M(totIn) + "</b><i>Gate, sponsor &amp; fees</i></div>" +
      "<div class='fo-f2-tile'><div class='ic'>&minus;</div><span>Spent this season</span><b class='dn'>" + M(totOut) + "</b><i>Wages, upkeep &amp; building</i></div>" +
      "<div class='fo-f2-tile'><div class='ic'>&plusmn;</div><span>Net this season</span><b class='" + (net >= 0 ? "up" : "dn") + "'>" + Msign(net) + "</b><i>" +
        (rounds ? "Worth " + Msign(Math.round(perRound)) + " a round" : "Before the first round") + "</i></div>" +
      "<div class='fo-f2-tile'><div class='ic'>W</div><span>Wage bill a round</span><b class='nv'>" + M(billNow) + "</b>" +
      "<i>" + (wageShare ? wageShare + "% of what the club takes" : "across " + squad.length + " professionals") + "</i>" +
      (wageShare ? "<div class='bar'><u style='width:" + Math.min(100, wageShare) + "%'></u></div>" : "") + "</div>" +
      "</div>";

    if (f.administration) {
      html += "<div class='fo-fin-admin'><b>The club is in administration</b>" +
        "<p>The bank has reached the floor of " + M(-(Number(f.debtLimit) || 2500000)) + " - as deep as a hole gets here, so " +
        M(Number(f.writtenOff) || 0) + " of losses below the line has been written off. While the club is under, " +
        "the sponsor pays half his cheque and nothing gets built. " +
        (f.adminRounds ? "That has been the case for " + f.adminRounds + " round" + (f.adminRounds === 1 ? "" : "s") + ". " : "") +
        "Win, fill the ground, and trim the wage bill: those are the ways out.</p></div>";
    }

    // ---- the two breakdowns ----------------------------------------------
    html += "<div class='fo-f2-duo'>" +
      "<section class='fo-f2-card'><div class='fo-f2-sh'>Income breakdown</div>" +
      brkLine("Gate receipts", inGate, totIn, "up") +
      brkLine("Away gate share", inAway, totIn, "up") +
      brkLine("Sponsorship", inSpon, totIn, "up") +
      brkLine("International fees", inComp, totIn, "up") +
      brkLine("Transfer fees in", inFees, totIn, "up") +
      "<div class='fo-f2-r tot'>Total<b>" + M(totIn) + "</b><em></em></div></section>" +

      "<section class='fo-f2-card'><div class='fo-f2-sh'>Expenditure breakdown</div>" +
      brkLine("Player wages", outWage, totOut, "dn") +
      brkLine("Ground &amp; academy upkeep", outUp, totOut, "dn") +
      brkLine("Transfer fees out", outFees, totOut, "dn") +
      brkLine("Scouting", outScout, totOut, "dn") +
      brkLine("Building", outAcad + outSeats, totOut, "dn") +
      brkLine("Interest", outInt, totOut, "dn") +
      "<div class='fo-f2-r tot'>Total<b>" + M(totOut) + "</b><em></em></div></section>" +
      "</div>";

    // ---- the treasury's line + the latest entries ------------------------
    html += "<div class='fo-f2-duo'>" + chartCard() + txCard() + "</div>";

    // ---- the crowd + the ground (the levers live here) -------------------
    var sup = Number(f.supporters) || 0, seats = Number(f.seats) || 0;
    var lastAtt = Number(f.lastAttendance) || 0, avgAtt = Number(f.avgAttendance) || 0;
    var mood = Math.max(0, Math.min(6, Number(f.mood) || 0));
    var full = pct(lastAtt, seats);

    html += "<div class='fo-f2-duo'>" +
      "<section class='fo-f2-card'><div class='fo-f2-sh'>The crowd</div>" +
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

      "<section class='fo-f2-card'><div class='fo-f2-sh'>The ground</div>" +
      stat("Seats", seats.toLocaleString()) +
      stat("Spent on stands", M(outSeats)) +
      stat("Academy level", (Number(st.academy) || 1) + " of 5") +
      stat("Spent on the academy", M(outAcad)) +
      renderBuild(f, bank, st) +
      "<div class='fo-fin-msg' id='fo-fin-msg'></div>" +
      "</section></div>";

    // ---- the wage bill ---------------------------------------------------
    squad.sort(function (a, b) { return (Number(b.wage) || 0) - (Number(a.wage) || 0); });
    var top = squad.slice(0, 6);
    if (top.length) {
      html += "<section class='fo-f2-card'><div class='fo-f2-sh'>The wage bill</div>" +
        "<p class='cap' style='font:italic 420 12.5px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.55);margin:0 0 10px'>" +
        M(billNow) + " a round across " + squad.length + " professionals" +
        (rounds ? ", and " + M(outWage) + " paid out so far" : "") + ". The highest earners:</p>" +
        "<div class='fo-fin-wg'>" + top.map(function (p) {
          var role = p.bowlType ? "bowls" : "bats";
          return "<span class='nm'>" + E(p.name) + "</span>" +
            "<span class='rl'>" + (p.age ? (p.age | 0) + " &middot; " : "") + role + "</span>" +
            "<span class='wg'>" + M(p.wage) + "</span>";
        }).join("") + "</div>" +
        "</section>";
    }

    // ---- financial health ------------------------------------------------
    var wksHeld = billNow > 0 ? Math.floor(bank / billNow) : 999;
    var grade = f.administration ? ["D", "bad", "In administration"]
      : bank < 0 ? ["C", "bad", "Overdrawn"]
      : net >= 0 ? ["A", "", "Strong"]
      : bank >= founded ? ["B", "", "Sound"]
      : ["B", "warn", "Watchful"];
    var hlNote = f.administration
      ? "The bank has hit the floor and the club is under. Win, fill the ground, and trim the wage bill: those are the ways out."
      : net >= 0
      ? "The club banks more than it spends, and the wage bill sits inside the gate. Keep signing inside your means and the books stay green."
      : "The club is living on its founding money. That is what the money is for &mdash; but the net line above is how fast it is going.";
    html += "<section class='fo-f2-card fo-f2-hl'><div class='fo-f2-sh'>Financial health</div>" +
      "<div class='in9'><div class='gr " + grade[1] + "'><b>" + grade[0] + "</b><span>" + grade[2] + "</span></div>" +
      "<p>" + hlNote + "</p></div>" +
      "<div class='fo-f2-hs'>" +
      "<div><span>Liquidity</span><b>" + (wksHeld > 900 ? "Untested" : wksHeld + " rounds") + "</b><i>of wages in the bank</i></div>" +
      "<div><span>Trend</span><b>" + (rounds ? (perRound >= 0 ? "Positive" : "Negative") : "&mdash;") + "</b><i>" +
        (rounds ? Msign(Math.round(perRound)) + " a round" : "before the first round") + "</i></div>" +
      "<div><span>Risk</span><b>" + (f.administration ? "Administration" : bank < 0 ? "Overdrawn" : "Low") + "</b><i>" +
        (bank < 0 ? "interest is running" : "no debt drawn") + "</i></div>" +
      "</div></section>";

    // every total above is a sum of dated entries, and this is where they are
    html += "<a class='fo-fin-stlink' href='#/statement'>&#128220; The statement &mdash; every entry, dated, with the balance after it &rsaquo;</a>";
    html += "<div class='fo-fin-foot'><a href='#/squad'>&lsaquo; The squad</a><a href='#/league'>My league &rsaquo;</a></div>";
    html += "</div>";

    page.innerHTML = shell(html);
    wire(page, f, bank, st);
  }

  function render(page, st) {
    var f = (st && st.finance) || {}, bank = Number(st && st.bank) || 0;
    var clubNm = (st.claim && st.claim.club) || "Your club";
    var founded = Number(f.founded) || 2500000, rounds = Number(f.rounds) || 0;
    var inGate = Number(f.gate) || 0, inAway = Number(f.awayCut) || 0;
    var inSpon = Number(f.sponsor) || 0, inComp = Number(f.compensation) || 0, inFees = Number(f.feesIn) || 0;
    var totIn = inGate + inAway + inSpon + inComp + inFees;
    var outWage = Number(f.wages) || 0, outUp = Number(f.upkeep) || 0, outInt = Number(f.interest) || 0;
    var outFees = Number(f.feesOut) || 0, outScout = Number(f.scouting) || 0;
    var outAcad = Number(f.academyPaid) || 0, outSeats = Number(f.seatsPaid) || 0;
    var totOut = outWage + outUp + outInt + outFees + outScout + outAcad + outSeats;
    var net = totIn - totOut, perRound = rounds ? (totIn - outWage - outUp - outInt) / rounds : 0;
    var squad = (st.squad || []).slice().filter(function (p) { return p && p.name; });
    var billNow = squad.reduce(function (s2, p) { return s2 + (Number(p.wage) || 0); }, 0);
    var wageShare = totIn > 0 ? pct(outWage, totIn) : 0;

    var sup = Number(f.supporters) || 0, seats = Number(f.seats) || 0;
    var lastAtt = Number(f.lastAttendance) || 0, avgAtt = Number(f.avgAttendance) || 0;
    var mood = Math.max(0, Math.min(6, Number(f.mood) || 0));
    var moodWord = String(f.moodWord || "patient");
    var ticket = Number(f.ticket) || 26;
    var full = pct(lastAtt || avgAtt, seats);
    var gatePerSeat = seats > 0 ? inGate / seats : 0;
    var groundNm = String(st.ground || f.ground || "The Eleven Arches");

    if (jwt()) wantTx();

    var nf = null;
    try { if (typeof nextFixture === "function") nf = nextFixture(); } catch (e) {}
    var oppNm = String((nf && nf.opp && nf.opp.name) || f.nextOpponent || "Awaiting the draw");
    var weather = String((nf && nf.weather) || f.nextWeather || "Clear");
    var projectedCrowd = Math.max(0, Math.min(seats || 999999, lastAtt || avgAtt || Math.round(sup * (.55 + .13 * mood))));
    var projectedGate = projectedCrowd * ticket;
    var confidence = lastAtt || avgAtt ? "High" : "Building";

    var cap = 45000, step = 1000, atCap = seats >= cap;
    var acad = Number(st.academy) || 1;
    var nextSeatsCost = Number(f.nextSeatsCost) || 0, nextAcadCost = Number(f.nextAcademyCost) || acad * 60000;
    var canSeats = !atCap && nextSeatsCost > 0 && bank >= nextSeatsCost && !f.administration;
    var canAcad = acad < 5 && nextAcadCost > 0 && bank >= nextAcadCost && !f.administration;

    var html = "<div class='fo-me'>" +
      "<header class='fo-me-head'><div><div class='fo-me-ey'>" + E(clubNm) + " &middot; Commercial operations</div>" +
      "<h1>Matchday Economy</h1><p>Turn support into sustainable sporting advantage.</p></div>" +
      "<div class='fo-me-actions'><a class='fo-me-btn' href='#/statement'>View statement</a>" +
      "<button type='button' class='fo-me-btn primary' id='fo-fin-seats'" + (canSeats ? "" : " disabled") + ">" +
      (atCap ? "Ground at capacity" : "Expand the ground") + "</button></div></header>";

    html += "<div class='fo-me-top'><section class='fo-me-card fo-me-stadium'><div class='fo-me-cardtitle'>" + E(groundNm) + "</div>" +
      "<div class='fo-me-oval'><i class='fo-me-pitch'></i></div><div class='fo-me-stadfoot'>" +
      "<div class='fo-me-ring' style='--fill:" + full + "%'><span>Occupancy</span><b>" + full + "%</b></div>" +
      "<div class='fo-me-cap'><b>" + (lastAtt || avgAtt || 0).toLocaleString() + " / " + seats.toLocaleString() + "</b>" +
      "<span>Next fixture: <em>" + E(oppNm) + "</em></span></div></div></section>" +
      "<div class='fo-me-right'><div class='fo-me-kpis'>" +
      "<div class='fo-me-card fo-me-kpi'><div class='ico'>$</div><div><span>Matchday revenue</span><b>" + M(inGate) + "</b></div></div>" +
      "<div class='fo-me-card fo-me-kpi'><div class='ico'>&#9673;</div><div><span>Avg attendance</span><b>" + (avgAtt || lastAtt || 0).toLocaleString() + "</b></div></div>" +
      "<div class='fo-me-card fo-me-kpi gold'><div class='ico'>&divide;</div><div><span>Revenue / seat</span><b>$" + gatePerSeat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "</b></div></div>" +
      "<div class='fo-me-card fo-me-kpi green'><div class='ico'>&#9650;</div><div><span>Supporter mood</span><b>" + E(moodWord.toUpperCase()) + "</b></div></div>" +
      "</div><div class='fo-me-data'>" + foMeRevenueChart(ticket, inGate) + foMeMix(inGate, inSpon, inAway, inComp + inFees) + "</div></div></div>";

    html += "<div class='fo-me-bottom'><section class='fo-me-card fo-me-levers'><div class='fo-me-panelhead'>Commercial levers</div>" +
      "<div class='fo-me-levergrid'>" +
      "<div class='fo-me-lever'><div class='top'><div class='ic'>$</div><span>Ticket price</span></div><b>" + M(ticket) + "</b><em>Set by the competition for every turnstile.</em><button type='button' disabled>League controlled</button></div>" +
      "<div class='fo-me-lever'><div class='top'><div class='ic'>O</div><span>Stadium capacity</span></div><b>" + seats.toLocaleString() + " &middot; " + full + "% full</b><em>" +
      (atCap ? "The ground is already at the 45,000-seat ceiling." : nextSeatsCost ? "+" + step.toLocaleString() + " seats costs " + M(nextSeatsCost) + "." : "The board is pricing the next stand.") +
      "</em><button type='button'" + (canSeats ? " onclick=\"document.getElementById('fo-fin-seats').click()\"" : " disabled") + ">Explore expansion</button></div>" +
      "<div class='fo-me-lever'><div class='top'><div class='ic'>S</div><span>Sponsorship</span></div><b>" + M(inSpon) + "</b><em>Commercial income banked this season.</em><button type='button' disabled>Season agreement</button></div>" +
      "<div class='fo-me-lever'><div class='top'><div class='ic'>A</div><span>Academy</span></div><b>Level " + acad + " of 5</b><em>" +
      (acad >= 5 ? "The academy is fully built." : nextAcadCost ? "Next level costs " + M(nextAcadCost) + "." : "The board is pricing the next level.") +
      "</em><button type='button' id='fo-fin-acad'" + (canAcad ? "" : " disabled") + ">Invest in talent</button></div></div>" +
      "<div class='fo-fin-msg' id='fo-fin-msg'></div></section>" +
      "<section class='fo-me-card fo-me-forecast'><div class='fo-me-panelhead'>Next match forecast</div><div class='fo-me-forecastbody'>" +
      "<div class='fo-me-opp'><div class='fo-me-shield'>" + E(oppNm.slice(0, 2).toUpperCase()) + "</div><b>" + E(oppNm) + "</b><span>" + (nf && nf.isHome === false ? "Away fixture" : "Next home") + "</span></div>" +
      "<div class='fo-me-fgrid'><div class='fo-me-fstat'><span>Projected crowd</span><b>" + projectedCrowd.toLocaleString() + "</b></div>" +
      "<div class='fo-me-fstat'><span>Projected gate</span><b>" + M(projectedGate) + "</b></div>" +
      "<div class='fo-me-fstat'><span>Weather</span><b>" + E(weather) + "</b></div>" +
      "<div class='fo-me-fstat green'><span>Confidence</span><b>" + confidence + "</b></div></div></div></section></div>";

    var brk = function (name, val, total, cls) {
      var share = total > 0 ? pct(Math.abs(val), total) : 0;
      return "<div class='fo-f2-r'>" + E(name) + "<b class='" + cls + "'>" + M(val) + "</b><em>" + (share ? share + "%" : "&mdash;") + "</em></div>";
    };
    var wksHeld = billNow > 0 ? Math.floor(bank / billNow) : 999;
    var grade = f.administration ? ["D", "ADMIN"] : bank < 0 ? ["C", "OVERDRAWN"] : net >= 0 ? ["A", "STRONG"] : ["B", "WATCH"];
    html += "<div class='fo-me-account'><section class='fo-f2-card'><div class='fo-f2-sh'>Season income</div>" +
      brk("Gate receipts", inGate, totIn, "up") + brk("Away gate share", inAway, totIn, "up") + brk("Sponsorship", inSpon, totIn, "up") + brk("International fees", inComp, totIn, "up") + brk("Transfer fees in", inFees, totIn, "up") +
      "<div class='fo-f2-r tot'>Total income<b>" + M(totIn) + "</b><em></em></div></section>" +
      "<section class='fo-f2-card'><div class='fo-f2-sh'>Season expenditure</div>" +
      brk("Player wages", outWage, totOut, "dn") + brk("Upkeep", outUp, totOut, "dn") + brk("Transfer fees out", outFees, totOut, "dn") + brk("Scouting", outScout, totOut, "dn") + brk("Building & academy", outAcad + outSeats, totOut, "dn") +
      "<div class='fo-f2-r tot'>Total spent<b>" + M(totOut) + "</b><em></em></div></section>" +
      "<section class='fo-me-card fo-me-health'><h3>Financial health &middot; Bank " + M(bank) + "</h3><div class='grade'><b>" + grade[0] + "</b><span>" + grade[1] + "</span></div>" +
      "<div class='stats'><div><span>Net</span><b>" + Msign(net) + "</b></div><div><span>Liquidity</span><b>" + (wksHeld > 900 ? "Untested" : wksHeld + " rounds") + "</b></div><div><span>Wage ratio</span><b>" + wageShare + "%</b></div></div>" +
      "<p>" + (net >= 0 ? "The club is banking more than it spends. Matchday income is creating room to invest." : "Costs are running ahead of income. Protect the gate and review the wage bill before committing capital.") + "</p></section></div>";

    if (f.administration) html += "<div class='fo-fin-admin'><b>The club is in administration</b><p>Building is suspended until the bank is back above the floor. Gate income and a smaller wage bill are the route out.</p></div>";
    html += "<a class='fo-fin-stlink' href='#/statement'>&#128220; The statement &mdash; every entry, dated, with the balance after it &rsaquo;</a>" +
      "<div class='fo-fin-foot'><a href='#/squad'>&lsaquo; The squad</a><a href='#/league'>My league &rsaquo;</a></div></div>";

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
      "<header class='fo-nvmast'><div class='k'>The statement</div><h1>" + E(SM.club || "Your club") + "</h1></header>" +
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

  window.foRenderFinancePage = function () {
    var page = document.getElementById("page"); if (!page) return;
    foFinCss();
    document.body.classList.add("fo-fin-on");
    page.innerHTML = shell(head("The books", "Walking down to the treasurer&rsquo;s office&hellip;"));
    if (!jwt()) {
      page.innerHTML = shell(head("The books",
        (window.__foAuthPending
          ? "Reaching your club&hellip; the ledger is on its way."
          : "The club&rsquo;s money is the club&rsquo;s, and the world keeps it. Sign in to the account that holds your club and the ledger is here." +
            "<br><button type='button' class='fo-door-btn' data-fo-door>Sign in</button>")));
      return;
    }
    rpc("world_my_status").then(function (st) {
      if (!st || st.signedIn === false) {
        page.innerHTML = shell(head("The books", "Sign in first &mdash; these books belong to a club, and the world keeps them." +
          "<br><button type='button' class='fo-door-btn' data-fo-door>Sign in</button>"));
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
