  // =========================================================================
  // Office rebuild (phases 2-3) + admin split (phase 5). The Office is now a
  // finances-and-infrastructure page whose every number comes from FoFinance;
  // save/commissioner/sync/reset live on #/settings behind a typed confirm.
  // =========================================================================
  try {
    var foOfCss = document.createElement("style");
    foOfCss.textContent =
      ".fo-of-head{display:flex;align-items:center;gap:10px;margin:8px 0 12px;flex-wrap:wrap}" +
      ".fo-of-head h2{margin:0;font-size:22px;color:#0E233F}" +
      ".fo-of-head .small{color:#8a93a3}" +
      ".fo-of-head a.fo-of-admin{margin-left:auto;font-size:12.5px;font-weight:700}" +
      ".fo-of-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:10px 0}" +
      ".fo-of-kpi{background:#FFFEFC;border:1px solid rgba(28,36,51,.08);border-radius:12px;padding:12px 16px;box-shadow:0 2px 10px rgba(7,22,46,.05)}" +
      ".fo-of-kpi span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#8a93a3;font-weight:700;margin-bottom:4px}" +
      ".fo-of-kpi b{font-size:21px;color:#0E233F}.fo-of-kpi b.fo-pos{color:#15803D}.fo-of-kpi b.fo-neg{color:#b3402a}" +
      ".fo-of-kpi i{display:block;font-style:normal;font-size:12px;color:#5a6472;margin-top:3px}" +
      ".fo-of-warn div{display:flex;gap:8px;align-items:baseline;font-size:12.5px;margin:5px 0;color:#3a4353}" +
      ".fo-keep .pad{font-size:12.5px}.fo-keep .pad .small{font-size:12px}.fo-keep table.kv td{font-size:12.5px;padding:4px 6px}" +
      ".fo-of-acadrow{display:flex;align-items:center;gap:10px;font-size:12.5px;color:#3a4353}" +
      ".fo-tr-tbl td,.fo-tr-tbl th{font-size:12.5px}.fo-tr-tbl select{font-size:12.5px}" +
      ".fo-of-fill{height:9px;border-radius:5px;background:#E8EAEE;overflow:hidden;margin:7px 0 4px}.fo-of-fill i{display:block;height:100%;border-radius:5px;background:#4DA6A2}" +
      ".fo-of-pills{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 4px}" +
      ".fo-of-pill{border:1px solid rgba(28,36,51,.18);background:#FFFEFC;color:#0E233F;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer}" +
      ".fo-of-pill.on{background:#0E233F;color:#fff;border-color:#0E233F}" +
      "html body.ftpskin button.fo-of-pill{background:#FFFEFC !important;color:#0E233F !important;border-color:rgba(28,36,51,.18) !important}" +
      "html body.ftpskin button.fo-of-pill.on{background:#0E233F !important;color:#fff !important;border-color:#0E233F !important}" +
      ".fo-of-expwarn{background:#F6E3B4;border:1px solid #e8cf8c;border-radius:9px;padding:9px 12px;font-size:12.5px;color:#5a4310;font-weight:600;margin:8px 0}" +
      ".fo-of-lvl{display:inline-block;background:#0E233F;color:#FFFEFC;border-radius:7px;padding:2px 9px;font-size:11px;font-weight:800;margin-right:7px}" +
      ".fo-of-ledger td,.fo-of-ledger th{font-size:12px}" +
      ".fo-of-foot{font-size:11.5px;color:#8a93a3;margin:6px 2px}" +
      ".fo-pot{display:inline-block;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:700}" +
      ".fo-pot-star{background:#EEE8FA;color:#5b4a91}.fo-pot-high{background:#D8EADF;color:#1c5537}.fo-pot-useful{background:#E8EAEE;color:#5a6472}.fo-pot-limited{background:#F3EBE0;color:#8a6b3a}" +
      ".fo-set-danger{border:1px solid rgba(179,64,42,.4);border-radius:12px;background:#FBF0EE;padding:14px 16px;margin:12px 0}" +
      ".fo-set-danger input{padding:8px 10px;border:1px solid rgba(28,36,51,.2);border-radius:8px;font-size:13px;min-width:220px}" +
      ".fo-set-danger button[disabled]{opacity:.45;cursor:not-allowed}" +
      "@media(max-width:820px){.fo-of-kpis{grid-template-columns:1fr}}" +
      // ---- Office v2: financial command centre ----
      "html body:has(.fo-of2){background:#f4f1e9 !important}" +
      ".fo-of2{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#13233a}" +
      ".fo-of2 .fo-t-green{color:#178347}.fo-of2 .fo-t-amber{color:#bd7a14}.fo-of2 .fo-t-red{color:#c73932}.fo-of2 .fo-t-mut{color:#687386;font-weight:600}" +
      ".fo-of2-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:6px 0 14px;flex-wrap:wrap}" +
      ".fo-of2-head h1{margin:0;font-size:26px;letter-spacing:-.3px;color:#13233a}" +
      ".fo-of2-head span{font-size:13px;color:#687386}" +
      ".fo-of2-headl{display:flex;gap:16px;align-items:center}" +
      ".fo-of2-dl{font-size:12.5px;font-weight:700;color:#c94726 !important;text-decoration:none;white-space:nowrap}" +
      ".fo-of2-mchips{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}" +
    ".fo-of2-mchip{display:inline-flex;gap:6px;align-items:baseline;background:rgba(28,36,51,.05);border-radius:8px;padding:5px 10px;font-size:12px}" +
    ".fo-of2-mchip i{font-style:normal;color:#6b7280;text-transform:uppercase;font-size:9.5px;letter-spacing:.06em;font-weight:800}" +
    ".fo-of2-one .fo-of2-kpi{width:100%}" +
    ".fo-of2-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:0 0 14px}" +
      ".fo-of2-kpi{background:#fff;border:1px solid rgba(15,35,60,.11);border-radius:12px;padding:14px 16px;box-shadow:0 5px 14px rgba(15,35,60,.055)}" +
      ".fo-of2-l{display:block;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#687386}" +
      ".fo-of2-kpi b{display:block;font-size:23px;color:#13233a;margin:3px 0 1px;font-variant-numeric:tabular-nums;white-space:nowrap}" +
      ".fo-of2-kpi i{display:block;font-style:normal;font-size:12px;color:#687386}" +
      ".fo-of2-health{background:#fff;border:1px solid rgba(15,35,60,.11);border-radius:12px;box-shadow:0 5px 14px rgba(15,35,60,.055);padding:12px 16px;margin:0 0 16px;display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}" +
      ".fo-of2-hbadge{flex:0 0 auto;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:6px 12px;border-radius:8px;background:#faf8f3;border:1px solid rgba(15,35,60,.11)}" +
      ".fo-of2-hbadge b{letter-spacing:.09em}" +
      ".fo-of2-hrows{flex:1;min-width:260px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 22px}" +
      "@media(max-width:900px){.fo-of2-hrows{grid-template-columns:1fr}}" +
      ".fo-of2-hrow{display:flex;gap:8px;align-items:baseline;font-size:12.5px;color:#13233a}" +
      ".fo-of2-hrow span:last-child{color:#13233a}.fo-of2-hrow span:first-child{font-weight:800}" +
      ".fo-of2-card{background:#fff;border:1px solid rgba(15,35,60,.11);border-radius:12px;box-shadow:0 5px 14px rgba(15,35,60,.055);margin:0 0 16px;overflow:hidden}" +
      "html body .fo-of2-ch{display:flex;align-items:center;gap:10px;background:#071c37 !important;color:#fff;padding:11px 16px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}" +
      ".fo-of2-cb{padding:14px 16px}" +
      ".fo-of2-badge{margin-left:auto;background:rgba(23,131,71,.25);border:1px solid rgba(120,220,160,.5);color:#9fe0b8;border-radius:999px;padding:2px 10px;font-size:10px;letter-spacing:.08em}" +
      "html body .fo-of2-hbtn,html body.ftpskin #page .fo-of2-hbtn{margin-left:auto;background:transparent !important;border:1px solid rgba(255,255,255,.35) !important;color:#fff !important;border-radius:8px;padding:4px 10px !important;font:700 11px Inter,ui-sans-serif,sans-serif !important;cursor:pointer;text-transform:none;letter-spacing:0}" +
      ".fo-of2-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:18px;align-items:start}" +
      ".fo-of2-grid2{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(280px,.65fr);gap:18px;align-items:start}" +
      "@media(max-width:1000px){.fo-of2-grid,.fo-of2-grid2{grid-template-columns:1fr}}" +
      "@media(max-width:900px){.fo-of2-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      "@media(max-width:520px){.fo-of2-kpis{grid-template-columns:1fr}}" +
      ".fo-of2-frow{display:flex;justify-content:space-between;gap:12px;padding:5px 0;font-size:13px;color:#13233a;border-bottom:1px dashed rgba(15,35,60,.08)}" +
      ".fo-of2-frow:last-child{border-bottom:none}" +
      ".fo-of2-frow b{font-variant-numeric:tabular-nums}" +
      ".fo-of2-fstart{border-bottom:1px solid rgba(15,35,60,.14);font-weight:600}" +
      ".fo-of2-fgrp{font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#687386;margin:10px 0 2px}" +
      ".fo-of2-ftotal{display:flex;justify-content:space-between;gap:12px;margin-top:10px;padding:10px 12px;background:#faf8f3;border:1px solid rgba(15,35,60,.11);border-radius:10px;font-weight:700}" +
      ".fo-of2-ftotal b{font-size:19px;font-variant-numeric:tabular-nums}" +
      ".fo-of2-note{font-size:11.5px;color:#687386;margin-top:8px;line-height:1.5}" +
      ".fo-of2-dlist .fo-of2-d{padding:10px 0;border-bottom:1px solid rgba(15,35,60,.08)}" +
      ".fo-of2-dlist .fo-of2-d:first-child{padding-top:2px}.fo-of2-dlist .fo-of2-d:last-child{border-bottom:none;padding-bottom:2px}" +
      ".fo-of2-d b{font-size:13.5px;color:#13233a}" +
      ".fo-of2-d p{margin:3px 0 6px;font-size:12.5px;color:#42506a;line-height:1.5}" +
      ".fo-of2-drow{display:flex;align-items:center;justify-content:space-between;gap:10px}" +
      ".fo-of2-dst{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}" +
      ".fo-of2-spgrid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(240px,.9fr);gap:22px}" +
      "@media(max-width:820px){.fo-of2-spgrid{grid-template-columns:1fr}}" +
      ".fo-of2-spd .fo-of2-dl{display:inline-block;margin-top:8px}" +
      ".fo-of2-scen{margin:12px 0 2px}" +
      ".fo-of2-scenbar{position:relative;height:8px;border-radius:4px;background:linear-gradient(90deg,#e9c9a4,#cfe4d3);}" +
      ".fo-of2-scenbar i{position:absolute;top:-3px;width:14px;height:14px;border-radius:50%;background:#071c37;border:3px solid #fff;box-shadow:0 1px 4px rgba(15,35,60,.4);transform:translateX(-50%)}" +
      ".fo-of2-scenlbl{display:flex;justify-content:space-between;font-size:10.5px;color:#687386;margin-top:6px;font-variant-numeric:tabular-nums;text-align:center}" +
      ".fo-of2-scenlbl span:first-child{text-align:left}.fo-of2-scenlbl span:last-child{text-align:right}" +
      ".fo-of2-gstats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:2px 0 10px}" +
      "@media(max-width:700px){.fo-of2-gstats{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
      ".fo-of2-gstat span{display:block;font-size:10.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#687386}" +
      ".fo-of2-gstat b{font-size:16px;color:#13233a;font-variant-numeric:tabular-nums}" +
      ".fo-of2-exp{margin-top:14px;padding:12px 14px;background:#faf8f3;border:1px solid rgba(15,35,60,.11);border-radius:10px;max-width:560px}" +
      "html body .fo-of2-expwarnbtn,html body.ftpskin #page .fo-of2-expwarnbtn{display:inline-block;margin-top:10px;background:#fff !important;border:1px solid #bd7a14 !important;color:#8a5a0e !important;border-radius:9px;padding:9px 16px !important;font:700 12.5px Inter,ui-sans-serif,sans-serif !important;cursor:pointer}" +
      "html body .fo-of2-expwarnbtn:hover{background:#faf3e4 !important}" +
      ".fo-of2-pitch{margin-top:16px;padding-top:14px;border-top:1px solid rgba(15,35,60,.11)}" +
      ".fo-of2 .fo-of-ledger{width:100%}.fo-of2 .fo-of-ledger td.n,.fo-of2 .fo-of-ledger th.n{text-align:right;font-variant-numeric:tabular-nums}" +
      ".fo-of2 .fo-of-ledger td,.fo-of2 .fo-of-ledger th{padding:5px 6px}" +
      ".fo-of2 button:focus-visible,.fo-of2 a:focus-visible{outline:2px solid #e8562f;outline-offset:2px}" +
      "@media(prefers-reduced-motion:reduce){.fo-of2 *{transition:none !important;animation:none !important}}" +
      // ---- Manual v2: searchable knowledge base ----
      "html body:has(.fo-mn2){background:#f4f1e9 !important}" +
      ".fo-mn2{display:grid;grid-template-columns:260px minmax(0,1fr);gap:22px;align-items:start;max-width:1180px;margin:0 auto;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#13233a}" +
      ".fo-mn2-side{position:sticky;top:64px;background:#fff;border:1px solid rgba(15,35,60,.11);border-radius:12px;box-shadow:0 5px 14px rgba(15,35,60,.055);padding:14px;max-height:calc(100vh - 84px);overflow-y:auto}" +
      ".fo-mn2-sh a{font-weight:800;font-size:15px;color:#13233a !important;text-decoration:none}" +
      ".fo-mn2-sh span{display:block;font-size:11.5px;color:#687386;margin:3px 0 10px;line-height:1.4}" +
      "html body #page #fo-mn2-q{width:100%;box-sizing:border-box;padding:9px 11px;border:1px solid rgba(15,35,60,.18);border-radius:9px;font-size:13px;margin-bottom:10px;background:#faf8f3}" +
      "html body .fo-mn2-cbtn,html body.ftpskin #page .fo-mn2-cbtn{display:flex;width:100%;align-items:center;justify-content:space-between;background:none !important;border:0 !important;padding:9px 4px !important;font:700 11px/1 Inter,ui-sans-serif,sans-serif !important;letter-spacing:.07em;text-transform:uppercase;color:#687386 !important;cursor:pointer;box-shadow:none !important}" +
      ".fo-mn2-cbtn i{font-style:normal;font-size:13px}" +
      ".fo-mn2-arts a{display:flex;align-items:center;min-height:34px;padding:2px 10px;border-radius:8px;color:#13233a !important;font-size:13px;font-weight:600;text-decoration:none;line-height:1.3}" +
      ".fo-mn2-arts a:hover{background:#faf8f3}" +
      ".fo-mn2-arts a.on{background:rgba(232,86,47,.12);color:#c94726 !important;box-shadow:inset 3px 0 0 #e8562f}" +
      ".fo-mn2-main{min-width:0}" +
      ".fo-mn2-intro h1{margin:4px 0 8px;font-size:28px;letter-spacing:-.4px}" +
      ".fo-mn2-intro p{margin:0 0 16px;font-size:14px;color:#42506a;max-width:560px;line-height:1.6}" +
      ".fo-mn2-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}" +
      "@media(max-width:640px){.fo-mn2-cards{grid-template-columns:1fr}}" +
      ".fo-mn2-cc{display:block;background:#fff;border:1px solid rgba(15,35,60,.11);border-radius:12px;box-shadow:0 5px 14px rgba(15,35,60,.055);padding:16px 18px;text-decoration:none !important;color:#13233a !important;transition:transform .12s ease,box-shadow .12s ease}" +
      ".fo-mn2-cc:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(15,35,60,.1)}" +
      ".fo-mn2-cc b{font-size:15.5px}" +
      ".fo-mn2-cc p{margin:4px 0 8px;font-size:12.5px;color:#687386;line-height:1.5}" +
      ".fo-mn2-cc span{font-size:12px;font-weight:700;color:#c94726}" +
      ".fo-mn2-art{background:#fff;border:1px solid rgba(15,35,60,.11);border-radius:12px;box-shadow:0 5px 14px rgba(15,35,60,.055);padding:20px 26px}" +
      ".fo-mn2-crumb{font-size:12px;color:#687386;margin:0 0 6px}.fo-mn2-crumb a{color:#687386 !important;text-decoration:none}.fo-mn2-crumb b{color:#13233a}" +
      ".fo-mn2-art h1{margin:0 0 12px;font-size:24px;letter-spacing:-.3px}" +
      ".fo-mn2 .fo-man-b{font-size:13.5px;line-height:1.65;color:#3c4658}" +
      ".fo-mn2 .fo-man-b p{margin:0 0 10px}" +
      ".fo-mn2 .fo-man-b ul{margin:0 0 10px;padding-left:20px}.fo-mn2 .fo-man-b li{margin:4px 0}" +
      ".fo-mn2 .fo-man-b table{width:100%;border-collapse:collapse;margin:6px 0 14px;font-size:12.5px}" +
      ".fo-mn2 .fo-man-b th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#687386;padding:6px 8px;border-bottom:1px solid rgba(15,35,60,.14)}" +
      ".fo-mn2 .fo-man-b td{padding:6px 8px;border-bottom:1px solid rgba(15,35,60,.07);vertical-align:top}" +
      ".fo-mn2-pn{display:flex;justify-content:space-between;gap:12px;margin-top:20px}" +
      ".fo-mn2-pn a{flex:1;max-width:48%;display:block;background:#faf8f3;border:1px solid rgba(15,35,60,.11);border-radius:10px;padding:10px 14px;text-decoration:none !important;color:#13233a !important;min-height:44px;box-sizing:border-box}" +
      ".fo-mn2-pn a span{display:block;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#687386}" +
      ".fo-mn2-pn a b{font-size:13px}" +
      ".fo-mn2-pn .fo-mn2-next{text-align:right;margin-left:auto}" +
      ".fo-mn2-hits{background:#fff;border:1px solid rgba(15,35,60,.14);border-radius:12px;box-shadow:0 10px 26px rgba(15,35,60,.12);padding:6px;margin:0 0 16px}" +
      ".fo-mn2-hits a{display:block;padding:9px 12px;border-radius:9px;text-decoration:none !important;color:#13233a !important}" +
      ".fo-mn2-hits a:hover,.fo-mn2-hits a:focus{background:#faf8f3}" +
      ".fo-mn2-hits a b{font-size:13.5px}" +
      ".fo-mn2-hits a span{margin-left:8px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#687386}" +
      ".fo-mn2-hits a i{display:block;font-style:normal;font-size:12px;color:#5a6472;margin-top:2px;line-height:1.5}" +
      ".fo-mn2-hits mark{background:rgba(232,86,47,.22);color:inherit;border-radius:2px}" +
      ".fo-mn2-none{padding:10px 12px;font-size:13px;color:#687386}" +
      ".fo-mn2-mbar{display:none}" +
      ".fo-mn2-dcat{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8a93a3;margin:12px 4px 4px}" +
      ".fo-mn2 a:focus-visible,.fo-mn2 button:focus-visible,.fo-mn2 input:focus-visible{outline:2px solid #e8562f;outline-offset:2px}" +
      "@media(max-width:768px){" +
      ".fo-mn2{grid-template-columns:1fr;gap:12px}" +
      ".fo-mn2-side{display:none}" +
      ".fo-mn2-mbar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 4px}" +
      ".fo-mn2-mbar a{flex:0 0 auto;font-size:13.5px;font-weight:700;color:#c94726 !important;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}" +
      ".fo-mn2-mbar b{flex:0 0 auto;font-size:16px;color:#13233a}" +
      "html body .fo-mn2-mbar button,html body.ftpskin #page .fo-mn2-mbar button{flex:0 0 auto;min-height:38px;min-width:44px;background:#fff !important;border:1px solid rgba(15,35,60,.16) !important;border-radius:9px;padding:0 14px !important;font:700 12.5px Inter,ui-sans-serif,sans-serif !important;color:#13233a !important;cursor:pointer;box-shadow:0 2px 6px rgba(15,35,60,.06)}" +
      ".fo-mn2-art{padding:16px 14px}" +
      ".fo-mn2 .fo-man-b{font-size:14px}" +
      ".fo-mn2 .fo-man-b table{display:block;overflow-x:auto}" +
      ".fo-mn2-pn{flex-direction:column}.fo-mn2-pn a{max-width:none}" +
      "}" +
      "@media(min-width:769px){.fo-mn2-mbar{display:none !important}}";
    document.head.appendChild(foOfCss);
  } catch (e) {}

  function foOfMoney(n) { return "$" + Math.round(Math.abs(+n || 0)).toLocaleString(); }
  function foOfSigned(n) { return "<b class='" + (n >= 0 ? "fo-pos" : "fo-neg") + "'>" + (n >= 0 ? "+" : "&minus;") + foOfMoney(n) + "</b>"; }
  function foIsFounderish() { return (typeof SYNC !== "undefined" && SYNC && SYNC.started && !SYNC.practice) ? !!SYNC.isFounder : true; }

  // ---- sponsor card (moved from the old foOfficeExtras injection) ----
  function foSponsorCardHtml(t) {
    var res0 = foDealResolve(t);
    var fr = t._finRow, frHtml = "";
    if (fr && fr.round != null) {
      var m2 = function (v) { return (v < 0 ? "&minus;" : "+") + foOfMoney(v); };
      frHtml = "<div class='small' style='color:#667085;text-transform:uppercase;letter-spacing:.08em;font-size:10px;margin:8px 0 4px'>Matchday " + fr.round + " settlement</div>" +
        "<table class='kv'>" +
        "<tr><td>Sponsor base</td><td>" + m2(fr.base || 0) + "</td></tr>" +
        (fr.win ? "<tr><td>Win bonus</td><td>" + m2(fr.win) + "</td></tr>" : "") +
        (fr.gate ? "<tr><td>Home gate</td><td>" + m2(fr.gate) + "</td></tr>" : "") +
        "<tr><td>Wages</td><td>" + m2(-(fr.wages || 0)) + "</td></tr>" +
        "<tr><td>Stadium upkeep</td><td>" + m2(-(fr.seats || 0)) + "</td></tr>" +
        (fr.acad ? "<tr><td>Academies</td><td>" + m2(-fr.acad) + "</td></tr>" : "") +
        "<tr><td><b>Net</b></td><td><b>" + m2(fr.net || 0) + "</b></td></tr></table>";
    } else frHtml = "<div class='small'>Your first settlement lands when the next round resolves.</div>";
    var pickerHtml = "";
    if (!res0.known) {
      var stSp = foTrainState();
      if (stSp.sponsorPending) {
        pickerHtml = "<div class='fo-yc-note'>You chose <b>" + E((FO_DEAL_INFO[stSp.sponsorPending] || {}).name || stSp.sponsorPending) + "</b> - the deal is signed when the next round resolves. Until then the books run on Prudential terms.</div>";
      } else {
        pickerHtml = "<div class='fo-yc-note'>Your club was founded before sponsor deals were recorded, so the books have been running on Prudential's terms. Pick your sponsor once - it takes effect when the next round resolves.</div>" +
          "<div class='fo-sp-pick'>" + Object.keys(FO_DEAL_INFO).map(function (k) {
            var d2 = FO_DEAL_INFO[k];
            return "<button class='fo-sp-choose' data-sp='" + k + "'><b>" + d2.name + "</b><span>" + d2.line + "</span></button>";
          }).join("") + "</div>";
      }
    }
    var base0 = 0; try { base0 = window.FoFinance.sponsorBase(t); } catch (eB0) {}
    var details = res0.known
      ? "<div class='fo-of2-spd'><div class='fo-of2-l'>Contract details</div>" +
        "<div class='fo-of2-frow'><span>Sponsor</span><b>" + E(res0.d.name) + "</b></div>" +
        "<div class='fo-of2-frow'><span>Type</span><b>Main sponsor</b></div>" +
        "<div class='fo-of2-frow'><span>Base payment</span><b>" + foOfMoney(base0) + " / round</b></div>" +
        "<div class='fo-of2-frow'><span>Win bonus</span><b>" + (res0.d.win ? foOfMoney(res0.d.win) + " / win" : "None") + "</b></div>" +
        "<div class='fo-of2-frow'><span>Paid</span><b>When the round resolves</b></div>" +
        "<div class='fo-of2-note'>" + res0.d.line + "</div>" +
        "<a class='fo-of2-dl' href='#/guide?a=sponsors'>How sponsor deals work &rsaquo;</a></div>"
      : "";
    return "<div class='fo-of2-card' id='fo-sponsor'><div class='fo-of2-ch'>" +
      (res0.known ? "Main sponsor &middot; " + E(res0.d.name) + "<span class='fo-of2-badge'>Active</span>" : "Sponsor") +
      "</div><div class='fo-of2-cb'>" + pickerHtml +
      "<div class='fo-of2-spgrid'><div>" + frHtml + "</div>" + details + "</div></div></div>";
  }
  function foWireSponsor(page) {
    page.querySelectorAll(".fo-sp-choose").forEach(function (b) {
      b.addEventListener("click", function () {
        var id2 = b.getAttribute("data-sp"), d3 = FO_DEAL_INFO[id2];
        foConfirm({
          title: "Sign with " + d3.name + "?",
          body: d3.line + " This is a one-time choice for the season.",
          confirm: "Sign the deal", cancel: "Not yet"
        }).then(function (ok) {
          if (!ok) return;
          var st3 = foTrainState(); st3.sponsorPending = id2; foTrainSave(st3);
          try { SYNC.lastOrderSig = null; } catch (e) {}
          toast(d3.name + " it is - the deal is signed when the next round resolves.");
          pgOffice();
        });
      });
    });
  }

  window.pgOffice = function () {
    try {
      if (typeof econInit === "function") econInit();
      var t = foMyClub() || userTeam();
      var F = window.FoFinance;
      // keep the engine's dashboard base honest with the club's actual deal
      try { if (App.fin && App.fin.sponsorBase !== F.sponsorBase(t)) App.fin.sponsorBase = F.sponsorBase(t); } catch (e) {}
      var fx = F.fixtures(), nxt = fx[0] || null;
      var split = F.homeAwaySplit(), avg = F.avgNet(), proj = F.seasonEndProjection();
      var wages = F.wages(t), seats = t.seats || 9000, acadUp = F.acadUpkeep(t);
      var base = F.sponsorBase(t), gateN = F.gate(t), att = F.gateAttendance(t), tc = F.trainIntensityCost(t);
      var bank = F.bank();

      // ---- shared facts the cards below reason from ----
      var isHome = !!(nxt && nxt.isHome);
      var projBank = nxt ? bank + F.roundNet(nxt.round) : bank;
      var avgIncome = fx.length ? fx.reduce(function (s2, f) { return s2 + F.roundIncome(f.round); }, 0) / fx.length : base + gateN / 2;
      var wagePct = Math.round(100 * wages / Math.max(1, avgIncome));
      var dip = F.firstNegativeRound();
      var fill = Math.round(100 * att / Math.max(1, seats));
      var deal = foDealResolve(t);
      var insolvent = !!dip || proj < 0;
      var overallHealth = insolvent ? ["URGENT", "red"] : (F.chargesWages() && wagePct > 60 ? ["CAUTION", "amber"] : ["SAFE", "green"]);

      // ---- KPI row (4 cards) ----
      var kpi = function (label, big, sub, tone) {
        return "<div class='fo-of2-kpi'><span class='fo-of2-l'>" + label + "</span><b" + (tone ? " class='fo-t-" + tone + "'" : "") + ">" + big + "</b><i>" + sub + "</i></div>";
      };
      // ONE money card: the bank is the number that matters - everything else
      // is a small chip pointing forward. (Four stacked hero tiles repeated
      // figures the forecast card below already breaks down.)
      var mChip = function (label, val, tone) {
        return "<span class='fo-of2-mchip'><i>" + label + "</i><b class='fo-t-" + tone + "'>" + val + "</b></span>";
      };
      var kpis = "<div class='fo-of2-kpis fo-of2-one'>" +
        "<div class='fo-of2-kpi'><span class='fo-of2-l'>Bank</span><b" + (bank >= 0 ? "" : " class='fo-t-red'") + ">" + foOfMoney(bank) + "</b>" +
        "<span class='fo-of2-mchips'>" +
        mChip("per round", (avg >= 0 ? "+" : "&minus;") + foOfMoney(Math.abs(avg)), avg >= 0 ? "green" : "red") +
        mChip("season end", foOfMoney(proj), proj >= 0 ? "green" : "red") +
        "</span></div></div>";

      // ---- financial health strip: honest statuses, no green for a 33% gate ----
      var hRow = function (tone, txt) {
        var mark = tone === "green" ? "&#10003;" : tone === "amber" ? "&#9651;" : "&#10007;";
        return "<div class='fo-of2-hrow fo-t-" + tone + "'><span>" + mark + "</span><span>" + txt + "</span></div>";
      };
      var health = "<div class='fo-of2-health'>" +
        "<div class='fo-of2-hbadge fo-t-" + overallHealth[1] + "'>Financial health: <b>" + overallHealth[0] + "</b></div>" +
        "<div class='fo-of2-hrows'>" +
        (insolvent
          ? hRow("red", dip ? "Books go negative around <b>R" + dip + "</b>" : "Season ends <b>" + foOfMoney(proj) + "</b> in the red")
          : hRow("green", "Solvent to season end &middot; <b>+" + foOfMoney(proj) + "</b>")) +
        (F.chargesWages()
          ? hRow(wagePct > 60 ? "amber" : "green", "Wages &middot; <b>" + wagePct + "%</b> of round income" + (wagePct > 60 ? " &middot; high" : ""))
          : hRow("green", "Wages <b>" + foOfMoney(wages) + "</b>/matchday &middot; not charged in practice")) +
        hRow(fill < 60 ? "amber" : "green", "Ground <b>" + fill + "%</b> full on matchdays") +
        (F.paysSponsor()
          ? hRow("green", E(deal.d.name) + " &middot; <b>" + foOfMoney(base) + "</b>/matchday" + (deal.d.win ? " + " + foOfMoney(deal.d.win) + "/win" : ""))
          : hRow("green", "Sponsor pays in league play.")) +
        "</div></div>";

      // ---- next-round forecast: income and expenses grouped, balance dominant ----
      var projTitle = nxt ? "Next round &middot; R" + (nxt.round + 1) + " " + (isHome ? "vs " : "at ") + E(nxt.opp.name) + " &middot; " + (isHome ? "Home" : "Away") : "Next round";
      var fRow = function (label, val, neg) {
        return "<div class='fo-of2-frow'><span>" + label + "</span><b class='" + (neg ? "fo-t-red" : "fo-t-green") + "'>" + (neg ? "&minus;" : "+") + foOfMoney(Math.abs(val)) + "</b></div>";
      };
      var waterfall = "<div class='fo-of2-card'><div class='fo-of2-ch'>" + projTitle + "</div><div class='fo-of2-cb'>" +
        "<div class='fo-of2-frow fo-of2-fstart'><span>Starting bank</span><b>" + foOfMoney(bank) + "</b></div>" +
        "<div class='fo-of2-fgrp'>Income</div>" +
        (F.paysSponsor() ? fRow("Sponsor", base) : "") +
        (isHome ? fRow("Expected gate", gateN) : "<div class='fo-of2-frow'><span>Gate (away &middot; no gate)</span><b class='fo-t-mut'>$0</b></div>") +
        "<div class='fo-of2-frow'><span>Possible win bonus</span><b class='fo-t-mut'>Not included</b></div>" +
        "<div class='fo-of2-fgrp'>Expenses</div>" +
        (F.chargesWages() ? fRow("Wages", wages, true) : "") +
        fRow("Ground maintenance", seats, true) +
        fRow("Academy upkeep", acadUp, true) +
        (tc > 0 ? fRow("Training intensity", tc, true) : "") +
        "<div class='fo-of2-ftotal'><span>Projected balance</span><b class='" + (projBank >= 0 ? "fo-t-green" : "fo-t-red") + "'>" + foOfMoney(projBank) + "</b></div>" +
        "</div></div>";

      // ---- decision centre: only things a manager can act on ----
      var dItem = function (title, body, status, tone, link) {
        return "<div class='fo-of2-d'><b>" + title + "</b><p>" + body + "</p>" +
          "<div class='fo-of2-drow'><span class='fo-of2-dst fo-t-" + tone + "'>" + status + "</span>" + (link || "") + "</div></div>";
      };
      var lowFillD = fill < 60;
      var decisions = "<div class='fo-of2-card'><div class='fo-of2-ch'>Decision centre</div><div class='fo-of2-cb fo-of2-dlist'>" +
        dItem("Ground expansion",
          "Fill <b>" + fill + "%</b>" + (lowFillD ? " &middot; poor payback below 85%" : (fill >= 85 ? " &middot; sells out, seats earn from day one" : " &middot; judgement call")),
          lowFillD ? "Wait" : (fill >= 85 ? "Expand" : "Consider"), lowFillD ? "amber" : (fill >= 85 ? "green" : "amber"),
          "<a href='#fo-stadium' class='fo-of2-dl' data-scroll='fo-stadium'>Review ground &rsaquo;</a>") +
        dItem("Wage pressure",
          F.chargesWages() ? "Wages &middot; <b>" + wagePct + "%</b> of round income." : "Not charged in practice books.",
          F.chargesWages() ? (wagePct > 60 ? "Over the comfort line" : "Sustainable") : "Informational",
          F.chargesWages() && wagePct > 60 ? "amber" : "green",
          "<a href='#/squad' class='fo-of2-dl'>Review squad wages &rsaquo;</a>") +
        dItem("Sponsor",
          F.paysSponsor() ? E(deal.d.name) + " pays <b>" + foOfMoney(base) + "</b> every round" + (deal.d.win ? " plus " + foOfMoney(deal.d.win) + " per win" : " regardless of result") + "." : "Sponsor deals pay out in league play.",
          "Secure", "green",
          "<a href='#fo-sponsor' class='fo-of2-dl' data-scroll='fo-sponsor'>View sponsor &rsaquo;</a>") +
        (insolvent ? dItem("Cash runway",
          dip ? "At the current run rate the bank goes negative around <b>R" + dip + "</b>." : "The season projects to end in the red.",
          "Act now", "red", "<a href='#/transfers' class='fo-of2-dl'>Review spending &rsaquo;</a>") : "") +
        "</div></div>";

      // ---- ledger, oldest first, running balance AFTER each entry ----
      // League play: the shared App.fin ledger only knows one club, so each
      // club renders from its own settlement history (sponsor money included).
      var entries;
      if (F.isMP() && (t._finHist || t._finRow)) {
        var hist = t._finHist || (t._finRow ? [t._finRow] : []);
        entries = [];
        hist.forEach(function (frh) {
          var wk2 = "S" + (App.seasonNo || 1) + " R" + frh.round;
          entries.push({ wk: wk2, item: "Sponsor base", amt: frh.base || 0 });
          if (frh.win) entries.push({ wk: wk2, item: "Win bonus", amt: frh.win });
          if (frh.gate) entries.push({ wk: wk2, item: "Gate receipts", amt: frh.gate });
          entries.push({ wk: wk2, item: "Wages", amt: -(frh.wages || 0) });
          entries.push({ wk: wk2, item: "Ground maintenance", amt: -(frh.seats || 0) });
          if (frh.acad) entries.push({ wk: wk2, item: "Academy upkeep", amt: -frh.acad });
        });
      } else {
        entries = ((App.fin && App.fin.ledger) || []).slice().reverse();
      }
      if (entries.length && /founder operating bank/i.test(String(entries[0].item || entries[0].label || "")) && !+entries[0].amt) entries.shift();
      var ledFull = !!window.__foLedFull;
      var LIMIT = ledFull ? 500 : 5, shown = entries.slice(-LIMIT);
      var opening = bank; entries.forEach(function (e2) { opening -= (+e2.amt || 0); });
      var bf = opening; entries.slice(0, entries.length - shown.length).forEach(function (e2) { bf += (+e2.amt || 0); });
      var run = bf;
      var ledRows = "<tr><td>" + E((shown[0] && shown[0].wk) || "S" + (App.seasonNo || 1) + " R1") + "</td><td>" +
        (entries.length > shown.length ? "Balance brought forward" : "Opening balance") + "</td><td class='n'>&ndash;</td><td class='n'><b>" + foOfMoney(bf) + "</b></td></tr>" +
        shown.map(function (l) {
          run += (+l.amt || 0);
          return "<tr><td>" + E(l.wk || "") + "</td><td>" + E(l.item || l.label || "") + "</td><td class='n' style='color:" + (l.amt < 0 ? "#c73932" : "#178347") + "'>" + (l.amt < 0 ? "&minus;" : "+") + foOfMoney(l.amt) + "</td><td class='n'>" + foOfMoney(run) + "</td></tr>";
        }).join("");
      var ledgerCard = "<div class='fo-of2-card'><div class='fo-of2-ch'>Ledger" +
        (entries.length > 5 ? "<button class='fo-of2-hbtn' id='fo-led-full'>" + (ledFull ? "Recent entries" : "View full ledger &rsaquo;") + "</button>" : "") + "</div><div class='fo-of2-cb'>" +
        "<table class='fo-of-ledger'><tr><th>Round</th><th>Item</th><th class='n'>Amount</th><th class='n'>Balance</th></tr>" + ledRows + "</table>" +
        "<div class='fo-of2-note'>Oldest first &middot; balance shown after each entry.</div></div></div>";

      // ---- season forecast: expected, plus honest best / worst gate scenarios ----
      var homeLeft = fx.filter(function (f) { return f.isHome; }).length;
      var ticket = (FO_FIN && FO_FIN.ticketPrice) || 9;
      var bestC = proj + homeLeft * Math.max(0, seats * ticket - gateN);
      var worstC = proj - homeLeft * Math.round(gateN * 0.6);
      var mkPos = bestC > worstC ? Math.round(100 * (proj - worstC) / (bestC - worstC)) : 50;
      var seasonCard = "<div class='fo-of2-card'><div class='fo-of2-ch'>Season forecast</div><div class='fo-of2-cb'>" +
        "<div class='fo-of2-frow'><span>Projected season-end</span><b class='" + (proj >= 0 ? "fo-t-green" : "fo-t-red") + "'>" + foOfMoney(proj) + "</b></div>" +
        "<div class='fo-of2-frow'><span>Rounds remaining</span><b>" + fx.length + "</b></div>" +
        "<div class='fo-of2-frow'><span>Best case (sell-out gates)</span><b class='fo-t-green'>" + foOfMoney(bestC) + "</b></div>" +
        "<div class='fo-of2-frow'><span>Worst case (low gates)</span><b class='" + (worstC >= 0 ? "" : "fo-t-red") + "'>" + foOfMoney(worstC) + "</b></div>" +
        "<div class='fo-of2-scen'><div class='fo-of2-scenbar'><i style='left:" + Math.max(2, Math.min(98, mkPos)) + "%'></i></div>" +
        "<div class='fo-of2-scenlbl'><span>Worst<br>" + foOfMoney(worstC) + "</span><span>Expected</span><span>Best<br>" + foOfMoney(bestC) + "</span></div></div>" +
        "<div class='fo-of2-note'>Scenarios vary home-gate income only; wages, upkeep and sponsor terms are contracted. Projections are estimates, not guarantees.</div>" +
        "</div></div>";

      // ---- merged stadium card ----
      var st = foTrainState();
      if (st.sponsorPending && t.sponsorDeal && t.sponsorDeal.id) { delete st.sponsorPending; foTrainSave(st); }
      var pendingSeats = st.seatsPending && st.seatsPending.target > seats;
      if (st.seatsPending && st.seatsPending.target <= seats) { delete st.seatsPending; foTrainSave(st); pendingSeats = false; }
      var seatCost = FO_SEAT_STEP * FO_SEAT_RATE;
      var atCap = seats >= FO_SEAT_CAP;
      var lowFill = fill < 60;
      var expBtn = atCap ? "<div class='fo-mk-gone'>The council won't approve anything bigger.</div>"
        : pendingSeats ? "<div class='fo-mk-gone'>Builders on site &middot; new stand opens after the next matchday.</div>"
        : "<button class='" + (lowFill ? "fo-of2-expwarnbtn" : "fo-yc-sign") + "' id='fo-seat-buy'>" + (lowFill ? "Expand anyway" : "Extend the stand") + " &middot; +" + FO_SEAT_STEP.toLocaleString() + " seats for " + FO$(seatCost) + "</button>";
      // pitch pills + one context line from the real squad and schedule
      var frontline = (t.players || []).filter(function (p) { return p.bowlType && !isPT(p); });
      var nPace = frontline.filter(function (p) { return foIsPace(p); }).length, nSpin = frontline.length - nPace;
      var recTrack = nPace > nSpin ? "green" : nSpin > nPace ? "dry" : "balanced";
      var nextHome = fx.filter(function (f) { return f.isHome; })[0] || null;
      var pitchLine = "Your attack: <b>" + nPace + " pace &middot; " + nSpin + " spin</b> &middot; a " + foPitchName(recTrack).toLowerCase() + " track plays to it." +
        (nextHome ? " Next home match: R" + (nextHome.round + 1) + " vs " + E(nextHome.opp.name) + "." : " No home fixtures left this season.");
      var pitchPills = "<div class='fo-of-pills'>" + ["balanced", "flat", "green", "dry", "slow", "cracked", "twoPaced"].map(function (p2) {
        return "<button class='fo-of-pill" + ((t.homePitch || "balanced") === p2 ? " on" : "") + "' data-p='" + p2 + "' aria-pressed='" + ((t.homePitch || "balanced") === p2) + "'>" + foPitchName(p2) + "</button>";
      }).join("") + "</div>";
      var gStat = function (l2, v2) { return "<div class='fo-of2-gstat'><span>" + l2 + "</span><b>" + v2 + "</b></div>"; };
      var stadium = "<div class='fo-of2-card' id='fo-stadium'><div class='fo-of2-ch'>Home ground &middot; " + E(t.ground || "-") + "</div><div class='fo-of2-cb'>" +
        "<div class='fo-of2-gstats'>" +
        gStat("Current attendance", att.toLocaleString()) + gStat("Capacity", seats.toLocaleString()) +
        gStat("Fill rate", fill + "%") + gStat("Upkeep", FO$(seats) + " / matchday") + "</div>" +
        "<div class='fo-of-fill'><i style='width:" + Math.min(100, fill) + "%" + (lowFill ? ";background:#bd7a14" : ";background:#178347") + "'></i></div>" +
        "<div class='fo-of2-note'>Gate income is attendance &times; $" + ticket + " at home matches. Bigger stands mean bigger gates when the town is behind you &middot; and a bigger upkeep bill when it isn't.</div>" +
        "<div class='fo-of2-exp'><div class='fo-of2-l'>Expansion analysis</div>" +
        "<div class='fo-of2-frow'><span>Expansion size</span><b>+" + FO_SEAT_STEP.toLocaleString() + " seats</b></div>" +
        "<div class='fo-of2-frow'><span>Expansion cost</span><b>" + FO$(seatCost) + "</b></div>" +
        "<div class='fo-of2-frow'><span>Completion</span><b>After next matchday</b></div>" +
        "<div class='fo-of2-frow'><span>Recommendation</span><b class='" + (lowFill ? "fo-t-amber" : "fo-t-green") + "'>" + (atCap ? "AT CAPACITY" : lowFill ? "WAIT" : fill >= 85 ? "EXPAND" : "CONSIDER") + "</b></div>" +
        (lowFill && !atCap && !pendingSeats ? "<div class='fo-of2-note'>At " + fill + "% fill, additional seats are unlikely to generate additional gate income. Reconsider when typical attendance approaches 85% of capacity.</div>" : "") +
        expBtn + "</div>" +
        "<div class='fo-of2-pitch'><div class='fo-of2-l'>Pitch preparation</div>" +
        "<div class='fo-of2-note' style='margin:4px 0 2px'>Selected: <b>" + foPitchName(t.homePitch || "balanced") + "</b> &middot; free to change &middot; applies from your next home fixture. Away grounds keep their own identities.</div>" +
        pitchPills +
        "<div class='fo-of2-note'>" + pitchLine + "</div>" +
        "<a class='fo-of2-dl' href='#/guide?a=conditions'>How pitches and weather work &rsaquo;</a></div>" +
        "</div></div>";

      // ---- the academy (senior; there is no youth league, so no youth academy) ----
      var foAcadUp = (typeof acadUpCost === "function") ? acadUpCost
        : function (l) { return [50000, 90000, 150000, 240000, 360000][Math.max(0, Math.min(4, +(l || 0)))] || 0; };
      var aLvl = t.acadS || 0, aMax = aLvl >= 5, upS = foAcadUp(aLvl);
      var acadRow = "<div class='fo-of2-card'><div class='fo-of2-ch'>Academy</div><div class='fo-of2-cb'>" +
        "<div class='fo-of-acadrow'><span class='fo-of-lvl'>Level " + aLvl + "</span><span>Every level adds <b>+8%</b> to all training gains. This is applied by the resolver each matchday, not cosmetic.</span></div>" +
        "<div class='fo-of2-note' style='margin:8px 0'>" + (aMax ? "Fully developed; the council is jealous." : "Next: L" + (aLvl + 1) + " &middot; +8% training speed &middot; upkeep " + FO$(F.acadUpkeepAt(aLvl + 1)) + "/matchday") + "</div>" +
        (aMax ? "<span class='small'>MAX</span>" : "<button class='fo-yc-sign fo-acad-up' data-k='Senior'>Upgrade for " + FO$(upS) + "</button>") +
        "<div class='fo-of2-note' style='margin-top:10px'>Upkeep " + FO$(acadUp) + "/matchday &middot; manage training on the <a href='#/training'>Training page</a></div>" +
        "</div></div>";

      // ---- season history ----
      var hist = "<div class='fo-of2-card'><div class='fo-of2-ch'>Season history</div><div class='fo-of2-cb'>" +
        ((App.history || []).map(function (h) { return "<div class='bl'>S" + h.season + ": <b>" + E(h.champion) + "</b> champions &middot; you: " + h.pos + (["st", "nd", "rd"][h.pos - 1] || "th") + " (" + FO$(h.prize || 0) + ")</div>"; }).join("") || "<span class='small'>First season in progress.</span>") +
        "</div></div>";

      var page = document.getElementById("page"); if (!page) return;
      page.innerHTML = "<div class='fo-of2'>" +
        (typeof crumb === "function" ? crumb(t.name, "Office") : "") +
        "<div class='fo-of2-head'><div><h1>Office</h1><span>The business end of your club</span></div>" +
        "<span class='fo-of2-headl'><a href='#/guide?a=money' class='fo-of2-dl'>How finances work &rsaquo;</a>" +
        "<a href='#/settings' class='fo-of2-dl'>Admin &amp; settings &rsaquo;</a></span></div>" +
        kpis + health +
        "<div class='fo-of2-grid'>" + waterfall + decisions + "</div>" +
        foSponsorCardHtml(t) +
        "<div class='fo-of2-grid2'>" + ledgerCard + seasonCard + "</div>" +
        stadium + acadRow + hist + "</div>";

      foWireSponsor(page);
      // ledger expand/collapse re-renders with the flag flipped
      var ledBtn = page.querySelector("#fo-led-full");
      if (ledBtn) ledBtn.addEventListener("click", function () { window.__foLedFull = !window.__foLedFull; pgOffice(); });
      // decision-centre in-page links scroll to their card
      page.querySelectorAll("[data-scroll]").forEach(function (a) {
        a.addEventListener("click", function (ev) {
          ev.preventDefault();
          var el = page.querySelector("#" + a.getAttribute("data-scroll"));
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
      // stadium expansion (same purchase flow as before: packet in MP, direct in solo)
      var buy = page.querySelector("#fo-seat-buy");
      if (buy) buy.addEventListener("click", function () {
        if (bank < seatCost) { say("Not enough in the bank · the builders want " + FO$(seatCost) + " up front."); return; }
        foConfirm({
          title: "Extend the stand?",
          body: "Current bank " + FO$(bank) + " · expansion cost " + FO$(seatCost) + " · remaining after build " + FO$(bank - seatCost) + ". " +
            "+" + FO_SEAT_STEP.toLocaleString() + " seats; upkeep rises " + FO$(FO_SEAT_STEP) + " per matchday. Current fill: " + fill + "%." +
            (lowFill ? " Warning: at this fill rate the expected payback is poor - the new seats start empty." : ""),
          confirm: "Confirm expansion · " + FO$(seatCost), cancel: "Cancel"
        }).then(function (ok) {
          if (!ok) return;
          if (F.isMP() && typeof LG !== "undefined" && LG) {
            var st2 = foTrainState();
            st2.seatsPending = { add: FO_SEAT_STEP, cost: seatCost, target: seats + FO_SEAT_STEP };
            foTrainSave(st2);
            toast("Builders booked · the new stand opens after the next matchday.");
          } else {
            t.seats = seats + FO_SEAT_STEP;
            if (typeof window.ledger === "function" && window.ledger.length >= 3) window.ledger("Stadium", "Stand extension", -seatCost);
            else if (App.fin) App.fin.bank -= seatCost;
            if (typeof window.saveGame === "function") window.saveGame(false);
            toast("New stand open: " + t.seats.toLocaleString() + " seats.");
          }
          pgOffice();
        });
      });
      // pitch preparation pills
      page.querySelectorAll(".fo-of-pill").forEach(function (b) {
        b.addEventListener("click", function () {
          t.homePitch = b.getAttribute("data-p");
          if (typeof window.saveGame === "function") window.saveGame(false);
          toast("Groundsman briefed: " + foPitchName(t.homePitch) + " surfaces at home.");
          pgOffice();
        });
      });
      // academy upgrades (engine values: acadUpCost by level, upkeep from the table)
      page.querySelectorAll(".fo-acad-up").forEach(function (b) {
        b.addEventListener("click", function () {
          var isY = b.getAttribute("data-k") === "Youth";
          var lvl = isY ? (t.acadY || 0) : (t.acadS || 0);
          var cost2 = [50000, 90000, 150000, 240000, 360000][Math.max(0, Math.min(4, lvl))] || 0;
          try { if (typeof acadUpCost === "function") cost2 = acadUpCost(lvl); } catch (e) {}
          if (bank < cost2) { say("Not enough in the bank · the upgrade costs " + FO$(cost2) + "."); return; }
          foConfirm({
            title: "Upgrade the " + (isY ? "youth" : "senior") + " academy?",
            body: "Level " + lvl + " → " + (lvl + 1) + " for " + FO$(cost2) + ". Upkeep rises to " + FO$(F.acadUpkeepAt(lvl + 1)) + "/matchday.",
            confirm: "Upgrade · " + FO$(cost2), cancel: "Not yet"
          }).then(function (ok) {
            if (!ok) return;
            if (isY) t.acadY = lvl + 1; else t.acadS = lvl + 1;
            if (typeof window.ledger === "function" && window.ledger.length >= 3) window.ledger("Academy", (isY ? "Youth" : "Senior") + " academy upgrade", -cost2);
            else if (App.fin) App.fin.bank -= cost2;
            if (typeof window.saveGame === "function") window.saveGame(false);
            toast((isY ? "Youth" : "Senior") + " academy at level " + (lvl + 1) + ".");
            pgOffice();
          });
        });
      });
      if (typeof updateTopbarStatus === "function") try { updateTopbarStatus(); } catch (e) {}
    } catch (e) { console.warn("pgOffice overlay", e); }
  };

  // =========================================================================
  // Phase 5: #/settings · saves, commissioner tools, sync diagnostics and the
  // danger zone, off the money page. Reset requires typing the club name.
  // =========================================================================
  function foSettingsHTML() {
    var t = foMyClub() || userTeam();
    var isMP = !!(typeof SYNC !== "undefined" && SYNC && SYNC.started && !SYNC.practice);
    var admin = foIsFounderish();
    var save = "<div class='panel fo-keep'><h4>Saves</h4><div class='pad small'>" +
      (isMP ? "The cloud league is the save: every round is stored on the server and the game autosaves locally as you play. Nothing to manage here."
        : "The game autosaves to this browser after every completed round. Nothing to manage here.") +
      "</div></div>";
    var sync = "";
    if (isMP) {
      var rounds = Object.keys(SYNC.submitted || {}).map(function (k) { return "R" + (+k + 1); }).join(", ") || "none yet";
      sync = "<div class='panel fo-keep'><h4>Sync status</h4><div class='pad small'>" +
        "<table class='kv'>" +
        "<tr><td>Build</td><td>" + E(FO_BUILD) + "</td></tr>" +
        "<tr><td>Manager id</td><td>" + E(String(SYNC.myMid || "not resolved")) + "</td></tr>" +
        "<tr><td>Orders on server</td><td>" + E(rounds) + "</td></tr>" +
        "<tr><td>Orders load</td><td>" + E(SYNC.__pktInfo || (SYNC.submittedLoaded ? "ok" : "pending…")) + "</td></tr>" +
        "<tr><td>Last upload</td><td>" + E(SYNC.__pushInfo || "nothing uploaded this session") + "</td></tr>" +
        "</table>" +
        "<button class='fo-yc-sign' id='fo-set-resend' style='margin-top:8px'>Send my orders again</button>" +
        "</div></div>";
    }
    var comm = "";
    if (admin && !isMP) {
      var q = App.mergeQueue || [];
      comm = "<div class='panel fo-keep'><h4>Founder league (commissioner)</h4><div class='pad'>" +
        "<div class='small' style='margin-bottom:5px'>Collect each founder's exported club file, import them here, then start the season. Your own club (<b>" + E(t.name) + "</b>) is included automatically; empty slots fill with bots.</div>" +
        "<div style='margin-bottom:4px'><b>In the league:</b> <span class='phasechip' style='background:#e2f0e2'>" + E(t.name) + " (you)</span> " +
        (q.map(function (c) { return "<span class='phasechip'>" + E(c.name) + "</span>"; }).join(" ") || "<span class='small'>no founder clubs imported yet</span>") + "</div>" +
        "<div class='ctlrow'>" +
        "<label style='display:inline-block'><input type='file' accept='.json' style='display:none' id='fo-set-founder'><button class='primary' id='fo-set-founderbtn'>Import a founder club file</button></label>" +
        "<button id='fo-set-start' " + (q.length ? "" : "disabled") + ">Start the season &#9656;</button>" +
        "<button id='fo-set-exppkt'>Export my orders packet</button>" +
        "<label style='display:inline-block'><input type='file' accept='.json' style='display:none' id='fo-set-imppkt'><button id='fo-set-imppktbtn'>Import orders packet</button></label>" +
        "</div>" +
        "<div class='small'>" + (q.length + 1) + " founder club" + (q.length ? "s" : "") + " ready &middot; " + Math.max(0, 10 - (q.length + 1)) + " bot slots.</div>" +
        "</div></div>";
    }
    var danger = "";
    if (admin) {
      danger = "<div class='fo-set-danger fo-keep'><h4 style='margin:0 0 6px;color:#8a2f1d'>Danger zone</h4>" +
        "<div class='small' style='margin-bottom:8px'>Reset wipes the save, your club and all results from this browser. Type your club name (<b>" + E(t.name) + "</b>) to arm the button.</div>" +
        "<div style='display:flex;gap:8px;flex-wrap:wrap;align-items:center'>" +
        "<input id='fo-set-confirm' placeholder='Type your club name' autocomplete='off'>" +
        "<button class='warn' id='fo-set-reset' disabled>Reset game (wipe save &amp; start over)</button></div></div>";
    }
    return "<div class='fo-of-head'><h2>Admin &amp; settings</h2><span class='small'>&middot; saves, sync and commissioner tools</span>" +
      "<a href='#/office' class='fo-of-admin fo-morelink'>&lsaquo; Back to the Office</a></div>" +
      save + sync + comm + danger;
  }
  function foRenderSettings() {
    try {
      if (!/^#\/settings/.test(location.hash || "")) return;
      var page = document.getElementById("page"); if (!page) return;
      if (page.querySelector(".fo-set-danger, #fo-set-resend") && page.__foSetSig === (location.hash + "|" + ((SYNC && SYNC.__pushInfo) || ""))) return;
      page.__foSetSig = location.hash + "|" + ((SYNC && SYNC.__pushInfo) || "");
      page.innerHTML = foSettingsHTML();
      var t = foMyClub() || userTeam();
      var on = function (id, fn) { var el = page.querySelector("#" + id); if (el) el.addEventListener("click", fn); };
      on("fo-set-founderbtn", function () { page.querySelector("#fo-set-founder").click(); });
      var fimp = page.querySelector("#fo-set-founder");
      if (fimp) fimp.addEventListener("change", function () { try { importFounderClub(fimp.files[0]); fimp.value = ""; foRenderSettings(); } catch (e) { say(e); } });
      on("fo-set-start", function () { if (confirm("Start the season with " + ((App.mergeQueue || []).length + 1) + " founder clubs? This resets the current standings.")) try { startLeagueFromMerge(); } catch (e) { say(e); } });
      on("fo-set-exppkt", function () { try { exportOrdersPacket(); } catch (e) { say(e); } });
      on("fo-set-imppktbtn", function () { page.querySelector("#fo-set-imppkt").click(); });
      var pimp = page.querySelector("#fo-set-imppkt");
      if (pimp) pimp.addEventListener("change", function () { try { importOrdersPacket(pimp.files[0]); pimp.value = ""; } catch (e) { say(e); } });
      on("fo-set-resend", function () {
        try {
          SYNC.pushedSig = {};
          var sent = 0;
          if (App.orders && App.orders.saved && App.season) { foPushRound(App.season.round, App.orders); sent++; }
          var po = SYNC.plannedOrders || {};
          for (var k in po) { if (App.season && +k !== App.season.round) { foPushRound(+k, po[k]); sent++; } }
          toast(sent ? "Re-sending " + sent + " lineup(s) · watch Last upload above." : "No saved lineups to send. Save one on the Orders page first.");
          setTimeout(function () { page.__foSetSig = null; foRenderSettings(); }, 2500);
        } catch (e) { say(e); }
      });
      var conf = page.querySelector("#fo-set-confirm"), rbtn = page.querySelector("#fo-set-reset");
      if (conf && rbtn) {
        conf.addEventListener("input", function () { rbtn.disabled = conf.value.trim() !== t.name; });
        rbtn.addEventListener("click", function () {
          if (conf.value.trim() !== t.name) return;
          try { if (typeof foResetGame === "function") { foResetGame(); return; } } catch (e) {}
          try { localStorage.clear(); } catch (e) {}
          location.hash = ""; location.reload();
        });
      }
    } catch (e) { console.warn("foRenderSettings", e); }
  }
  window.addEventListener("hashchange", function () { setTimeout(foRenderSettings, 20); });

  // Hover tooltips must not leak opponent skill words or ratings: full read
  // for your own players, a business card for everyone else.
  try {
    if (typeof window.playerTip === "function" && !window.playerTip.__fo) {
      var _foTip = window.playerTip;
      window.playerTip = function (p) {
        try {
          if (!p) return "";
          var me = userTeam();
          var mine = !!(me && (me.players || []).concat(me.youth || []).some(function (x) { return x.name === p.name; }));
          if (mine) return _foTip(p);
          var hit = (typeof findPlayer === "function") ? findPlayer(p.name) : null;
          var team = hit && hit.team ? hit.team.name : (p.team || "-");
          return p.name + "\nTeam: " + team + "\n" + (p.hand === "L" ? "Left" : "Right") + " hand bat · " + (p.btLabel || "does not bowl") + "\nAge: " + (p.age || "?") + " · Nat: " + (p.nat || "-") + "\nScout the club for the full report.";
        } catch (e) { return (p && p.name) || ""; }
      };
      window.playerTip.__fo = 1;
    }
  } catch (e) {}

