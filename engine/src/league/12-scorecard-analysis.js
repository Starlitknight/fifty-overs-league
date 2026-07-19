  // ===========================================================================
  //  CRICINFO-STYLE SCORECARD + FANTASY POINTS + ANALYSIS CHARTS
  //  window.foScorecardCards is the engine's overridable scorecard builder
  //  (used by both the live tab and saved results). Fantasy points decide the
  //  player of the match, computed purely from the innings data.
  // ===========================================================================
  try { (function () {
    var C1 = "#2d6a8f", C2 = "#F59E0B";
    window.foFantasyPoints = function (innings) {
      var P = {};
      var get = function (n, team) { return P[n] || (P[n] = { n: n, team: team, bat: 0, bowl: 0, field: 0 }); };
      (innings || []).filter(Boolean).forEach(function (inn) {
        (inn.bat || []).forEach(function (b) {
          if (!b || (!b.b && !b.out)) return;
          var e = get(b.p.name, inn.batTeam);
          e.bat += (b.r || 0) + (b.f4 || 0) + 2 * (b.f6 || 0);
          if (b.r >= 100) e.bat += 12; else if (b.r >= 50) e.bat += 4;
          if (b.out && !b.r) e.bat -= 3;
          if (b.b >= 20) { var sr = 100 * b.r / b.b; e.bat += sr >= 120 ? 6 : sr >= 100 ? 4 : sr >= 80 ? 2 : sr < 40 ? -6 : sr < 50 ? -4 : sr < 60 ? -2 : 0; }
          var o = String(b.out || ""), mB = o.match(/^(?:lbw )?b ([^,]+)$/);
          if (mB) get(mB[1].trim(), inn.bowlTeam).bowl += 8;
        });
        for (var k in (inn.bowlers || {})) { var r = inn.bowlers[k], e2 = get(k, inn.bowlTeam);
          e2.bowl += 25 * (r.w || 0);
          if (r.w >= 5) e2.bowl += 12; else if (r.w >= 4) e2.bowl += 6;
          if (r.b >= 30) { var ec = r.r / (r.b / 6); e2.bowl += ec <= 3 ? 6 : ec <= 4 ? 4 : ec <= 5 ? 2 : ec > 8 ? -6 : ec > 7 ? -4 : ec > 6 ? -2 : 0; } }
        for (var f in (inn.fielding || {})) { var fd = inn.fielding[f], e3 = get(f, inn.bowlTeam);
          e3.field += 8 * (fd.ct || 0) + 12 * (fd.st || 0) + 8 * (fd.ro || 0);
          if ((fd.ct || 0) >= 3) e3.field += 4; }
      });
      var arr = []; for (var n in P) { var x = P[n]; x.pts = x.bat + x.bowl + x.field; arr.push(x); }
      arr.sort(function (a, b) { return b.pts - a.pts; });
      return arr;
    };
    // player of the match = top fantasy points, stamped as the match is saved
    if (typeof window.saveMatch === "function" && !window.saveMatch.__foFp) {
      var _smF = window.saveMatch;
      window.saveMatch = function (m) {
        try {
          if (m && m.result && m.innings && m.innings[1]) {
            var fp = foFantasyPoints(m.innings);
            if (fp.length) m.result.mom = fp[0].n + " (" + fp[0].pts + " pts)";
          }
        } catch (e) {}
        return _smF.apply(this, arguments);
      };
      window.saveMatch.__foFp = 1;
    }
    // ---- per-over samples from the engine's per-ball worm ----
    function foOverSeries(worm) {
      var out = []; if (!worm || !worm.length) return out;
      var maxO = Math.ceil(worm[worm.length - 1][0]);
      var j = 0, last = [0, 0, 0];
      for (var o = 1; o <= maxO; o++) {
        while (j < worm.length && worm[j][0] <= o + 1e-9) { last = worm[j]; j++; }
        out.push({ o: o, runs: last[1], wkts: last[2] || 0 });
      }
      return out;
    }
    function foChartFrame(maxY, yStep, maxX, ytitle, xtitle) {
      var W = 640, H = 300, L = 46, B = 36, T = 20, R = 16;
      var gx = function (x) { return L + (W - L - R) * x / Math.max(1, maxX); };
      var gy = function (y) { return H - B - (H - B - T) * y / Math.max(1, maxY); };
      var g = "";
      for (var y = 0; y <= maxY; y += yStep) g += "<line x1='" + L + "' y1='" + gy(y) + "' x2='" + (W - R) + "' y2='" + gy(y) + "' stroke='#e8e3d4' stroke-dasharray='3 5'/><text x='" + (L - 8) + "' y='" + (gy(y) + 3.5) + "' text-anchor='end' font-size='10.5' fill='#a09a8a' font-family='Inter,sans-serif'>" + y + "</text>";
      for (var x = 0; x <= maxX; x += (maxX > 25 ? 10 : 5)) g += "<text x='" + gx(x) + "' y='" + (H - 14) + "' text-anchor='middle' font-size='10.5' fill='#a09a8a' font-family='Inter,sans-serif'>" + x + "</text>";
      g += "<text x='" + L + "' y='11' font-size='9.5' fill='#667085' font-family='Inter,sans-serif' font-weight='800' letter-spacing='1.5' style='text-transform:uppercase'>" + ytitle + "</text>";
      g += "<text x='" + ((L + W - R) / 2) + "' y='" + (H - 2) + "' text-anchor='middle' font-size='9.5' fill='#667085' font-family='Inter,sans-serif' font-weight='800' letter-spacing='1.5'>" + (xtitle || "OVERS") + "</text>";
      g += "<line x1='" + L + "' y1='" + gy(0) + "' x2='" + (W - R) + "' y2='" + gy(0) + "' stroke='#c9c2b2'/>";
      var bands = "";
      if (maxX >= 30) {
        bands = "<rect x='" + gx(0) + "' y='" + T + "' width='" + (gx(10) - gx(0)) + "' height='" + (gy(0) - T) + "' fill='#2d6a8f' opacity='.05'/>" +
          "<rect x='" + gx(40) + "' y='" + T + "' width='" + (gx(Math.min(50, maxX)) - gx(40)) + "' height='" + (gy(0) - T) + "' fill='#DC2626' opacity='.05'/>" +
          "<text x='" + gx(5) + "' y='" + (T + 11) + "' text-anchor='middle' font-size='8.5' fill='#7f95a5' font-family='Inter,sans-serif' font-weight='800' letter-spacing='1.2'>POWERPLAY</text>" +
          "<text x='" + ((gx(40) + gx(Math.min(50, maxX))) / 2) + "' y='" + (T + 11) + "' text-anchor='middle' font-size='8.5' fill='#b08a85' font-family='Inter,sans-serif' font-weight='800' letter-spacing='1.2'>DEATH</text>";
      }
      return { W: W, H: H, L: L, R: R, gx: gx, gy: gy,
        open: "<svg viewBox='0 0 " + W + " " + H + "' style='width:100%;height:auto'><defs>" +
          "<linearGradient id='foga' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='" + C1 + "' stop-opacity='.20'/><stop offset='1' stop-color='" + C1 + "' stop-opacity='0'/></linearGradient>" +
          "<linearGradient id='fogb' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='" + C2 + "' stop-opacity='.22'/><stop offset='1' stop-color='" + C2 + "' stop-opacity='0'/></linearGradient>" +
          "</defs>" + bands + g };
    }
    function foSmooth(pts) {
      if (pts.length < 3) return pts.map(function (q, i) { return (i ? "L" : "M") + q[0] + " " + q[1]; }).join("");
      var d = "M" + pts[0][0] + " " + pts[0][1];
      for (var i = 0; i < pts.length - 1; i++) {
        var p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
        d += "C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + " " + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + "," +
          (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + " " + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + "," + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
      }
      return d;
    }
    function foLegend(all) {
      return "<div class='fo-an-leg'>" + all.map(function (inn, i) { return "<span><i style='background:" + (i ? C2 : C1) + "'></i>" + E(inn.batTeam) + "</span>"; }).join("") + "</div>";
    }
    window.foMatchCharts = function (all, worms) {
      if (!worms || !worms[0] || !worms[0].length) return "";
      var series = all.map(function (inn, i) { return foOverSeries(worms[i] || []); });
      var maxO = Math.max.apply(null, series.map(function (sr) { return sr.length; }).concat([1]));
      // ---- Manhattan ----
      var maxR = 1; series.forEach(function (sr) { sr.forEach(function (pt, i) { maxR = Math.max(maxR, pt.runs - (i ? sr[i - 1].runs : 0)); }); });
      var f1 = foChartFrame(Math.ceil((maxR + 3) / 5) * 5, 5, maxO + 1, "RUNS PER OVER");
      var bw = Math.max(2.6, (f1.W - f1.L - f1.R) / (maxO + 1) / 2.5);
      var man = f1.open;
      series.forEach(function (sr, si) {
        sr.forEach(function (pt, i) {
          var rv = pt.runs - (i ? sr[i - 1].runs : 0), wv = pt.wkts - (i ? sr[i - 1].wkts : 0);
          var x = f1.gx(pt.o) + (si ? 0.6 : -0.6 - bw);
          man += "<rect x='" + x.toFixed(1) + "' y='" + f1.gy(rv).toFixed(1) + "' width='" + bw.toFixed(1) + "' height='" + Math.max(0, f1.gy(0) - f1.gy(rv)).toFixed(1) + "' rx='" + Math.min(2, bw / 2) + "' fill='" + (si ? C2 : C1) + "'><title>" + E(all[si].batTeam) + " over " + pt.o + ": " + rv + " run" + (rv === 1 ? "" : "s") + (wv ? ", " + wv + " wkt" : "") + "</title></rect>";
          for (var wI = 0; wI < wv; wI++) man += "<circle cx='" + (x + bw / 2).toFixed(1) + "' cy='" + (f1.gy(rv) - 6 - wI * 8).toFixed(1) + "' r='2.8' fill='#fff' stroke='#DC2626' stroke-width='1.8'/>";
        });
      });
      man += "</svg>";
      // phase split table (powerplay / middle / death) when the data exists
      var phase = "";
      if (all[0] && all[0].ph_r) {
        phase = "<table class='fo-sct fo-ph'><thead><tr><th>Phase</th>" + all.map(function (inn) { return "<th class='n'>" + E(inn.batTeam) + "</th>"; }).join("") + "</tr></thead><tbody>" +
          [["pp", "Powerplay (1&ndash;10)"], ["mid", "Middle (11&ndash;40)"], ["death", "Death (41&ndash;50)"]].map(function (ph) {
            return "<tr><td>" + ph[1] + "</td>" + all.map(function (inn) {
              var r = (inn.ph_r || {})[ph[0]] || 0, b = (inn.ph_b || {})[ph[0]] || 0;
              return "<td class='n'><b>" + r + "</b> <span class='small'>(" + (b ? (6 * r / b).toFixed(1) : "-") + " rpo)</span></td>";
            }).join("") + "</tr>";
          }).join("") + "</tbody></table>";
      }
      // ---- Run rate + Worm ----
      var lineArea = function (fr, sr, val, si, endLbl) {
        var pts = [[fr.gx(0), fr.gy(0)]];
        sr.forEach(function (pt) { pts.push([fr.gx(pt.o), fr.gy(val(pt))]); });
        var d = foSmooth(pts);
        var last = pts[pts.length - 1];
        return "<path d='" + d + " L" + last[0].toFixed(1) + " " + fr.gy(0) + " L" + fr.gx(0) + " " + fr.gy(0) + " Z' fill='url(#" + (si ? "fogb" : "foga") + ")' stroke='none'/>" +
          "<path d='" + d + "' fill='none' stroke='" + (si ? C2 : C1) + "' stroke-width='2.4' stroke-linejoin='round' stroke-linecap='round'/>" +
          "<circle cx='" + last[0].toFixed(1) + "' cy='" + last[1].toFixed(1) + "' r='3.4' fill='" + (si ? C2 : C1) + "' stroke='#fff' stroke-width='1.6'/>" +
          (endLbl ? "<text x='" + Math.min(last[0] + 6, fr.W - 44) + "' y='" + (last[1] - 7 + si * 15) + "' font-size='10.5' font-weight='800' fill='" + (si ? C2 : C1) + "' font-family='Inter,sans-serif'>" + endLbl + "</text>" : "");
      };
      var maxRR = 1; series.forEach(function (sr) { sr.forEach(function (pt) { maxRR = Math.max(maxRR, pt.runs / pt.o); }); });
      var f2 = foChartFrame(Math.ceil(maxRR + 1), 2, maxO + 1, "RUN RATE");
      var rr = f2.open;
      series.forEach(function (sr, si) { if (sr.length) rr += lineArea(f2, sr, function (pt) { return pt.runs / pt.o; }, si, (sr[sr.length - 1].runs / sr[sr.length - 1].o).toFixed(2)); });
      rr += "</svg>";
      var maxRuns = Math.max.apply(null, series.map(function (sr) { return sr.length ? sr[sr.length - 1].runs : 0; }).concat([10]));
      var f3 = foChartFrame(Math.ceil((maxRuns + 20) / 40) * 40, 40, maxO + 1, "RUNS");
      var wm = f3.open;
      series.forEach(function (sr, si) {
        if (!sr.length) return;
        wm += lineArea(f3, sr, function (pt) { return pt.runs; }, si, sr[sr.length - 1].runs + "/" + sr[sr.length - 1].wkts);
        sr.forEach(function (pt, i) { if (pt.wkts > (i ? sr[i - 1].wkts : 0)) wm += "<circle cx='" + f3.gx(pt.o).toFixed(1) + "' cy='" + f3.gy(pt.runs).toFixed(1) + "' r='3' fill='#DC2626' stroke='#fff' stroke-width='1.4'><title>Wicket, over " + pt.o + " (" + pt.runs + "/" + pt.wkts + ")</title></circle>"; });
      });
      wm += "</svg>";
      // ---- Partnerships ----
      var ORD = function (w) { return w === 1 ? "1st" : w === 2 ? "2nd" : w === 3 ? "3rd" : w + "th"; };
      var pships = all.map(function (inn) {
        var ps = (inn.pships || []).slice();
        if (inn.pshipB > 0) ps.push({ w: "unbroken", runs: inn.pshipR, balls: inn.pshipB, pair: (inn.bat[inn.striker] ? inn.bat[inn.striker].p.name : "") + " / " + (inn.bat[inn.nonstriker] ? inn.bat[inn.nonstriker].p.name : "") });
        if (!ps.length) return "";
        var mx = Math.max.apply(null, ps.map(function (q) { return q.runs; }).concat([1]));
        return "<div class='fo-an-psh'><div class='fo-an-psht'>" + E(inn.batTeam) + " &middot; " + inn.runs + "/" + inn.wkts + "</div>" + ps.map(function (q) {
          var pr = (q.pair || " / ").split(" / ");
          return "<div class='fo-psh-row'><span class='fo-psh-l'>" + E(pr[0] || "") + "</span>" +
            "<span class='fo-psh-m'><b>" + q.runs + " <em>(" + q.balls + ")</em></b><i style='width:" + Math.max(3, Math.round(100 * q.runs / mx)) + "%'></i><u>" + (q.w === "unbroken" ? "unbroken" : ORD(q.w) + " wicket") + "</u></span>" +
            "<span class='fo-psh-r'>" + E(pr[1] || "") + "</span></div>";
        }).join("") + "</div>";
      }).join("");
      var sec = function (t, cap, b) { return "<div class='panel'><h4>" + t + "</h4><div class='pad'>" + (cap ? "<div class='fo-an-cap'>" + cap + "</div>" : "") + b + "</div></div>"; };
      return sec("Partnerships", "Every stand, in order &middot; the bar is the size of the partnership", pships) +
        sec("Manhattan", "Runs scored in each over &middot; rings mark wickets", foLegend(all) + man + phase) +
        sec("Run rate", "How the scoring rate travelled through the innings", foLegend(all) + rr) +
        sec("Worm", "The chase in one picture &middot; dots mark wickets", foLegend(all) + wm);
    };
    // ---- the scorecard ----
    function foKeeperFromDis(inn) {
      var counts = {}; if (!inn || !inn.bat) return null;
      inn.bat.forEach(function (b) {
        var o = b.out || "", m = o.match(/†\s*([A-Za-z][A-Za-z.'\- ]+?)\s+b\s/) || o.match(/^st\s+†?\s*([A-Za-z][A-Za-z.'\- ]+?)\s+b\s/);
        if (m) { var nm = m[1].trim(); counts[nm] = (counts[nm] || 0) + 1; }
      });
      var best = null, bv = 0; for (var k in counts) if (counts[k] > bv) { bv = counts[k]; best = k; }
      return best;
    }
    window.foScorecardCards = function (innings) {
      var norm = function (inn) {
        if (!inn || !inn.batting) return inn;   // engine innings pass through
        var bl = {};
        (inn.bowling || []).forEach(function (bw) {
          bl[bw.name] = { p: { name: bw.name }, r: bw.r || 0, w: bw.w || 0, b: bw.balls != null ? bw.balls : Math.round(parseFloat(bw.overs || 0) * 6), mdn: bw.mdn };
        });
        return {
          batTeam: inn.batTeam, bowlTeam: inn.bowlTeam, runs: inn.runs, wkts: inn.wkts,
          legal: inn.legal != null ? inn.legal : Math.round(parseFloat(inn.overs || 0) * 6),
          extras: inn.extras, captBatName: inn.captBatName, fow: inn.fow || null,
          xi: (inn.batting || []).map(function (b) { return { name: b.name }; }),
          bat: (inn.batting || []).map(function (b) { return { p: { name: b.name }, r: b.r || 0, b: b.b || 0, f4: b.f4 || 0, f6: b.f6 || 0, out: (b.out && b.out !== "not out") ? b.out : null }; }),
          bowlers: bl
        };
      };
      var all = (innings || []).filter(Boolean).map(norm);
      if (!all.length) return "";
      var out = "";
      out += all.map(function (inn, idx) {
        var other = all.length === 2 ? all[1 - idx] : null;
        var keeperNm = other ? (foKeeperFromDis(other) || (((other.bxi || []).find(function (p) { return p.keeper; }) || {}).name)) :
          ((((inn.xi || []).find(function (p) { return p.keeper; })) || {}).name);
        var capNm = inn.captBatName || null;
        var mark = function (pl) {
          var m2 = "";
          if (capNm && pl.name === capNm) m2 += " <span class='fo-sci-cap'>(c)</span>";
          if (keeperNm && pl.name === keeperNm) m2 += " <span class='fo-sci-cap'>†</span>";
          return m2;
        };
        var played = {};
        var rows = (inn.bat || []).filter(function (b) { return b.b > 0 || b.out; }).map(function (b) {
          played[b.p.name] = 1;
          var sr = b.b ? (100 * b.r / b.b).toFixed(1) : "-";
          var dis = E(b.out || "not out");
          return "<tr class='" + (b.out ? "" : "fo-sci-no") + "'><td class='fo-sci-nm'>" + playerLink(b.p) + mark(b.p) +
            "<span class='fo-sci-dis'>" + dis + "</span></td>" +
            "<td class='fo-sci-disc'>" + dis + "</td>" +
            "<td class='n'><b>" + b.r + (b.out ? "" : "*") + "</b></td><td class='n'>" + b.b + "</td><td class='n'>" + (b.f4 || 0) + "</td><td class='n'>" + (b.f6 || 0) + "</td><td class='n'>" + sr + "</td></tr>";
        }).join("");
        var ex = inn.extras || { wd: 0, nb: 0, b: 0, lb: 0 };
        var exN = ex.wd + ex.nb + ex.b + ex.lb;
        var dnb = (inn.xi || []).filter(function (p) { return !played[p.name]; }).map(function (p) { return playerLink(p); }).join(", ");
        var fow = (inn.fow || []).map(function (f2) { return "<b>" + f2.w + "-" + f2.sc + "</b> (" + E(f2.who) + ", " + (f2.ov != null ? (+f2.ov).toFixed(1) : "-") + " ov)"; }).join(" &nbsp; ");
        var bowl = Object.values(inn.bowlers || {}).sort(function (a, b) { return b.w - a.w || a.r - b.r; }).map(function (rr2) {
          return "<tr><td class='fo-sci-nm'>" + playerLink(rr2.p) + "</td><td class='n'>" + Math.floor(rr2.b / 6) + (rr2.b % 6 ? "." + rr2.b % 6 : "") + "</td><td class='n'>" + (rr2.mdn != null ? rr2.mdn : "&ndash;") + "</td><td class='n'>" + rr2.r + "</td><td class='n'><b>" + rr2.w + "</b></td><td class='n'>" + (rr2.b ? (rr2.r / (rr2.b / 6)).toFixed(2) : "-") + "</td></tr>";
        }).join("");
        var ovTxt = Math.floor(inn.legal / 6) + (inn.legal % 6 ? "." + inn.legal % 6 : "");
        var tgt = "";
        return "<div class='panel fo-sci'><div class='fo-sci-head' onclick=\"this.parentNode.classList.toggle('fo-sci-closed')\" title='Tap to collapse'><b>" + E(inn.batTeam) + " innings</b><span><n>" + inn.runs + "/" + inn.wkts + "</n> <em>(" + ovTxt + " ov)</em><u class='fo-sci-tgl'>&#9662;</u></span></div>" + tgt + "<div class='pad'>" +
          "<table class='fo-sct'><thead><tr><th>Batter</th><th class='fo-sci-disc'>Dismissal</th><th class='n'>R</th><th class='n'>B</th><th class='n'>4s</th><th class='n'>6s</th><th class='n'>SR</th></tr></thead><tbody>" + rows +
          "<tr class='fo-sci-ex'><td>Extras <span>(b " + ex.b + ", lb " + ex.lb + ", w " + ex.wd + ", nb " + ex.nb + ")</span></td><td class='fo-sci-disc'></td><td class='n'><b>" + exN + "</b></td><td colspan='4'></td></tr>" +
          "<tr class='fo-sci-tot'><td>Total <span class='fo-sci-totsub'>(" + inn.wkts + " wicket" + (inn.wkts === 1 ? "" : "s") + ", " + ovTxt + " overs)</span></td><td class='fo-sci-disc'></td><td class='n'><b>" + inn.runs + "</b></td><td colspan='4' class='fo-sci-rr'>RR " + (inn.legal ? (inn.runs / (inn.legal / 6)).toFixed(2) : "0") + "</td></tr></tbody></table>" +
          ((dnb || fow) ? "<div class='fo-sci-two'>" +
            (dnb ? "<div class='fo-sci-box'><b>Did not bat</b><span>" + dnb + "</span></div>" : "") +
            (fow ? "<div class='fo-sci-box'><b>Fall of wickets</b><span>" + fow + "</span></div>" : "") + "</div>" : "") +
          "<table class='fo-sct fo-sct-bowl'><thead><tr><th>Bowling (" + E(inn.bowlTeam || "") + ")</th><th class='n'>O</th><th class='n'>M</th><th class='n'>R</th><th class='n'>W</th><th class='n'>Econ</th></tr></thead><tbody>" + bowl + "</tbody></table>" +
          "</div></div>";
      }).join("");
      return out;
    };
    window.foFantasyPanel = function (innings) {
      var fp = [];
      try { fp = foFantasyPoints((innings || []).filter(Boolean)); } catch (e) {}
      if (!fp.length) return "<div class='panel'><div class='pad small'>No fantasy data for this match.</div></div>";
      return "<div class='panel'><h4>Fantasy points</h4><div class='pad'>" +
        "<table class='fo-sct fo-fp'><thead><tr><th class='n'>#</th><th>Player</th><th>Club</th><th class='n'>Bat</th><th class='n'>Bowl</th><th class='n'>Field</th><th class='n'>Pts</th></tr></thead><tbody>" +
        fp.map(function (x, i) {
          return "<tr" + (i === 0 ? " class='fo-fp-top'" : "") + "><td class='n'>" + (i + 1) + "</td><td>" + E(x.n) + "</td><td class='small'>" + E(x.team || "") + "</td><td class='n'>" + x.bat + "</td><td class='n'>" + x.bowl + "</td><td class='n'>" + x.field + "</td><td class='n'><b>" + x.pts + "</b></td></tr>";
        }).join("") + "</tbody></table>" +
        "<div class='small' style='margin-top:7px;color:#667085'>Runs, boundary bonuses and strike rate with the bat &middot; 25 a wicket, bowled/lbw bonus, hauls and economy with the ball &middot; catches, stumpings and run-outs in the field. The top score is named player of the match.</div>" +
        "</div></div>";
    };
    // Fantasy points live in their own sub-tab on the scorecard page
    if (typeof window.pgScorecard === "function" && !window.pgScorecard.__foFp) {
      var _psc = window.pgScorecard;
      window.pgScorecard = function (q) {
        _psc.apply(this, arguments);
        try {
          var bar = document.querySelector("#page .fo-sctabs"); if (!bar) return;
          // the same broadsheet result header friendlies carry, above the tabs
          try {
            if (!document.querySelector("#page .fo-mhead")) {
              var recH = (q && q.i !== undefined && App.results[+q.i]) || null;
              if (recH && recH.result && recH.result.text) {
                var cardsH = (recH.innings || []).filter(Boolean).map(foInnCard);
                var fpH = []; try { fpH = foFantasyPoints((recH.innings || []).filter(Boolean)); } catch (eFp) {}
                var compH = recH.comp === "league" ? "LEAGUE" : recH.comp === "cup" ? "CUP" : recH.comp === "friendly" ? "PRACTICE" : E(String(recH.comp || "").toUpperCase());
                var dateL = "";
                try {
                  if (recH.comp === "league" && recH.round != null) dateL = foDailyDate(recH.round, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                  else if (recH.date) dateL = String(recH.date);
                } catch (eDl) {}
                var hH = foMheadHTML(cardsH, recH.result.text,
                  { kind: compH, seasonNo: recH.comp === "league" ? (App.seasonNo || 1) : null,
                    roundNo: recH.comp === "league" && recH.round != null ? recH.round + 1 : null,
                    dateStr: dateL, pitch: recH.pitch, weather: recH.weather, ground: recH.ground, toss: foTossFromLog(recH.log) },
                  fpH[0] ? { n: fpH[0].n, team: fpH[0].team, sub: (fpH[0].pts || 0) + " fantasy pts" } : null);
                if (hH) { var dvH = document.createElement("div"); dvH.innerHTML = hH; bar.parentNode.insertBefore(dvH.firstChild, bar); }
              }
            }
            // the header says it all: the engine's result/conditions/toss line
            // above it would repeat every word (with the wrong date, no less)
            if (document.querySelector("#page .fo-mhead")) {
              var nsH = document.querySelector("#page .navsub"); if (nsH) nsH.style.display = "none";
            }
          } catch (eMh2) {}
          // the match date belongs on the card
          try {
            var recD = (q && q.i !== undefined && App.results[+q.i]) || null;
            var nav = document.querySelector("#page .navsub");
            var stampDate = function () {
              var nav2 = document.querySelector("#page .navsub");
              if (recD && recD.date && nav2 && nav2.textContent.indexOf(recD.date) < 0)
                nav2.insertAdjacentHTML("beforeend", " &middot; <span class='small'>" + E(recD.date) + "</span>");
            };
            stampDate(); setTimeout(stampDate, 260); setTimeout(stampDate, 900);
          } catch (eD) {}
          // commentary filters: what kind of cricket do you want to re-live?
          try {
            if (App._scTab === "comm") {
              var feedC = document.querySelector("#page #ftpcomm");
              if (feedC && !document.querySelector("#page .fo-cfilters")) {
                var recC = (q && q.i !== undefined && App.results[+q.i]) || null;
                // finished match: the story reads top to bottom (first ball
                // first), ending on the FULL TIME banner
                var chron = function (flt) {
                  if (!(recC && recC.log)) return null;
                  var h2 = ftpCommHTML(recC.log.slice().reverse(), flt, 100000);
                  if (flt === "all" && recC.result && recC.result.text) h2 += "<div class='fo-c-mile'><div class='text'>FULL TIME - " + E(recC.result.text) + ".</div><div class='clear'></div></div>";
                  return h2;
                };
                var h0 = chron(App._scCommF || "all"); if (h0 != null) feedC.innerHTML = h0;
                var fb2 = document.createElement("div"); fb2.className = "fo-cfilters";
                [["all", "All"], ["wickets", "Wickets"], ["boundaries", "Boundaries"], ["fielding", "Fielding"], ["talents", "Talents"], ["highlights", "Highlights"]].forEach(function (ff) {
                  var b3 = document.createElement("button");
                  b3.className = "fo-sctab fo-cf" + ((App._scCommF || "all") === ff[0] ? " on" : "");
                  b3.textContent = ff[1];
                  b3.addEventListener("click", function () {
                    App._scCommF = ff[0];
                    var hF = chron(ff[0]); if (hF != null) feedC.innerHTML = hF;
                    document.querySelectorAll("#page .fo-cf").forEach(function (x) { x.classList.toggle("on", x === b3); });
                  });
                  fb2.appendChild(b3);
                });
                feedC.parentNode.insertBefore(fb2, feedC);

              }
            }
          } catch (eF) {}
          // Worm lives with the rest of the charts now
          Array.prototype.slice.call(bar.querySelectorAll(".fo-sctab")).forEach(function (b0) {
            if (/^Worm$/i.test((b0.textContent || "").trim())) b0.remove();
          });
          var mkTab = function (cls, label, key, after) {
            var b2 = bar.querySelector("." + cls);
            if (!b2) {
              b2 = document.createElement("button");
              b2.className = "fo-sctab " + cls; b2.textContent = label;
              b2.addEventListener("click", function () { App._scTab = key; window.pgScorecard(q || {}); });
              var ref = after ? Array.prototype.slice.call(bar.children).filter(function (x) { return new RegExp("^" + after + "$", "i").test((x.textContent || "").trim()); })[0] : null;
              if (ref && ref.nextSibling) bar.insertBefore(b2, ref.nextSibling); else bar.appendChild(b2);
            }
            b2.classList.toggle("on", App._scTab === key);
            return b2;
          };
          mkTab("fo-sctab-ch", "Charts", "charts", "Commentary");
          mkTab("fo-sctab-fp", "Fantasy points", "fantasy");
          if (App._scTab === "fantasy" || App._scTab === "charts") {
            var host = document.querySelector("#page .ftpskin");
            var rec0 = (q && q.i !== undefined && App.results[+q.i]) ? App.results[+q.i] : ((typeof M !== "undefined" && M) ? { innings: M.innings, worm: M.worm } : null);
            if (host && rec0 && rec0.innings) {
              host.innerHTML = App._scTab === "fantasy" ? foFantasyPanel(rec0.innings)
                : foMatchCharts(rec0.innings.filter(Boolean), rec0.worm);
            }
          }
        } catch (e) {}
      };
      window.pgScorecard.__foFp = 1;
    }
    // live match viewer: a Charts tab beside Commentary/Scorecard
    if (typeof window.renderMatch === "function" && !window.renderMatch.__foCharts) {
      var _rmC = window.renderMatch;
      window.renderMatch = function () {
        _rmC.apply(this, arguments);
        try {
          if (typeof M === "undefined" || !M || !M.innings) return;
          var links = document.querySelector(".ftp-match-links");
          if (links) {
            Array.prototype.slice.call(links.querySelectorAll("a")).forEach(function (a0) {
              if (/^Worm( chart)?$/i.test((a0.textContent || "").trim())) a0.remove();
            });
            if (!links.querySelector("[data-fo-charts]")) {
              var a1 = document.createElement("a"); a1.textContent = "Charts"; a1.dataset.foCharts = "1";
              a1.onclick = function () { UI.matchTab = "Charts"; renderMatch(); };
              var sc = Array.prototype.slice.call(links.querySelectorAll("a")).filter(function (x) { return /^Scorecard$/i.test(x.textContent.trim()); })[0];
              if (sc && sc.nextSibling) links.insertBefore(a1, sc.nextSibling); else links.appendChild(a1);
            }
            links.querySelectorAll("a").forEach(function (x) { x.classList.toggle("on", x.textContent.trim() === ((typeof UI !== "undefined" && UI.matchTab) || "Commentary")); });
          }
          try {
            document.querySelectorAll("#page select").forEach(function (sel2) {
              var opts = Array.prototype.map.call(sel2.options || [], function (o2) { return o2.value; });
              if (opts.indexOf("wickets") >= 0 && opts.indexOf("fielding") < 0) {
                var o3 = document.createElement("option"); o3.value = "fielding"; o3.textContent = "fielding";
                sel2.appendChild(o3);
              }
            });
          } catch (eS) {}
          if (typeof UI !== "undefined" && UI.matchTab === "Charts") {
            var body = document.querySelector(".ftp-match-body");
            if (body) body.innerHTML = "<div class='match-subpanel'>" + foMatchCharts(M.innings.filter(Boolean), M.worm) + "</div>";
          }
        } catch (e) {}
      };
      window.renderMatch.__foCharts = 1;
    }
    var cs = document.createElement("style");
    cs.textContent =
      "html body .fo-sci-head{display:flex;justify-content:space-between;align-items:baseline;background:#07162E !important;color:#FFFEFC !important;padding:11px 14px;font-size:14.5px}" +
      "html body .fo-sci-head b{font-size:14.5px;color:#fff !important;text-transform:uppercase;letter-spacing:.04em}html body .fo-sci-head em{font-style:normal;color:#9aa3b2;font-size:12px}html body .fo-sci-head span{color:#FFFEFC !important}html body .fo-sci-head n{font-size:17px;font-weight:800}" +
      "html body .fo-sci-tgt{background:#0E233F !important;color:#FFFEFC !important;padding:0 14px 10px;font-size:12.5px;font-weight:700}" +
      "html body .fo-sci-tgt::first-letter{color:#FFFEFC}" +
      "html body .fo-sci-head{cursor:pointer;user-select:none}" +
      ".fo-sci-tgl{font-style:normal;text-decoration:none;margin-left:9px;color:#9aa3b2;display:inline-block;transition:transform .15s}" +
      ".fo-sci-closed .fo-sci-tgl{transform:rotate(-90deg)}" +
      ".fo-sci-closed .pad{display:none}" +
      ".fo-sci .pad{padding:0 0 8px}" +
      ".fo-sct{width:100%;border-collapse:collapse;font-size:13px}" +
      ".fo-sct th{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#667085;text-align:left;padding:8px 10px 5px;border-bottom:1px solid #e8e3d6}" +
      ".fo-sct th.n,.fo-sct td.n{text-align:right;font-variant-numeric:tabular-nums}" +
      ".fo-sct td{padding:7px 10px;border-bottom:1px solid #f0ece1;vertical-align:top}" +
      ".fo-sci-nm a{font-weight:700;text-decoration:none}" +
      ".fo-sci-dis{display:block;font-size:11.5px;color:#667085;margin-top:1px}" +
      "html body #page .fo-sct .fo-sci-nm a{color:#0E233F !important}" +
      ".fo-sci-no td{background:#FCF4E7}" +
      "html body #page .fo-sci-no .fo-sci-nm a{color:#B04A2C !important}" +
      ".fo-sci-no .fo-sci-dis,.fo-sci-no .fo-sci-disc{color:#B04A2C;font-weight:600}" +
      "td.fo-sci-disc,th.fo-sci-disc{display:none}" +
      "@media(min-width:680px){td.fo-sci-disc,th.fo-sci-disc{display:table-cell;font-size:12px;color:#5a6472}.fo-sci-nm .fo-sci-dis{display:none}}" +
      ".fo-sci-totsub{font-weight:400;color:#667085;font-size:12px}" +
      ".fo-sci-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.7fr);gap:8px;padding:9px 10px;border-bottom:1px solid #f0ece1}" +
      "@media(max-width:640px){.fo-sci-two{grid-template-columns:1fr}}" +
      ".fo-sci-two>.fo-sci-box:only-child{grid-column:1/-1}" +
      ".fo-sci-box{background:#FBFAF7;border:1px solid rgba(28,36,51,.08);border-radius:9px;padding:8px 11px;font-size:12px;color:#3a4353;line-height:1.65}" +
      ".fo-sci-box>b{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#41577a;margin-bottom:2px}" +
      ".fo-sci-box span b{color:#0E233F}" +
      "td.fo-rx{opacity:.45}" +
      ".fo-sci-cap{color:#667085;font-size:11px}" +
      ".fo-sci-ex td{color:#667085}.fo-sci-ex span{color:#667085;font-size:11.5px}" +
      ".fo-sci-tot td{background:#EEEAE1;font-size:13.5px;padding:8px 10px}.fo-sci-rr{color:#667085;font-size:12px !important}" +
      ".fo-sci-sec{padding:9px 12px;font-size:12px;color:#667085;line-height:1.65;border-bottom:1px solid #f0ece1}" +
      ".fo-sci-sec b{display:block;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#667085;margin-bottom:2px}" +
      ".fo-sct-bowl{margin-top:2px}" +
      ".fo-fp-top td{background:#fdf6e5}" +
      ".fo-pom{background:linear-gradient(135deg,#07162E,#0E233F);border-radius:13px;padding:15px 17px;margin:0 0 12px;color:#e9eef2}" +
      ".fo-pom-k{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#F59E0B;font-weight:800}" +
      ".fo-pom-n{font-size:21px;font-weight:800;color:#fff;letter-spacing:-.3px;margin:2px 0}" +
      ".fo-pom-s{font-size:12.5px;color:#9aa3b2}.fo-pom-s b{color:#FFFEFC}" +
      ".fo-an-leg{display:flex;gap:14px;font-size:12px;color:#667085;margin:2px 0 8px}" +
      ".fo-an-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}" +
      ".fo-an-psht{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:#667085;font-weight:800;margin:6px 0 7px}" +
      ".fo-psh-row{display:grid;grid-template-columns:1fr 1.15fr 1fr;gap:8px;align-items:center;margin:7px 0;font-size:12.5px}" +
      ".fo-psh-l{color:#111827;font-weight:600}.fo-psh-r{text-align:right;color:#111827;font-weight:600}" +
      ".fo-psh-m{text-align:center}.fo-psh-m b{display:block;font-size:12px;color:#111827}" +
      ".fo-psh-m i{display:block;height:8px;border-radius:99px;background:linear-gradient(90deg,#2d6a8f,#4DA6A2);margin:3px auto 2px;box-shadow:0 1px 3px rgba(45,106,143,.25)}" +
      ".fo-psh-m em{font-style:normal;color:#667085;font-weight:600;font-size:11px}" +
      ".fo-psh-m u{display:block;text-decoration:none;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;color:#a09a8a;font-weight:700}" +
      ".fo-psh-row:nth-child(odd){background:#fbfaf6}" +
      ".fo-an-cap{font-size:12px;color:#667085;margin:2px 0 10px;font-style:italic}" +
      ".fo-ph{margin-top:10px}.fo-ph .small{color:#667085}" +
      ".fo-an-leg span{background:#EEEAE1;border:1px solid #e8e3d6;border-radius:999px;padding:4px 12px;font-weight:600}" +
      "@media(max-width:640px){.fo-sct td,.fo-sct th{padding:6px 6px}.fo-sci-dis{font-size:10.5px}.fo-psh-row{font-size:11px}" +
      // fantasy points: the NAME stays put while the numbers scroll
      ".fo-fp th:first-child,.fo-fp td:first-child{display:none}" +
      ".fo-fp th:nth-child(2),.fo-fp td:nth-child(2){position:sticky;left:0;background:#FFFEFC;z-index:2;box-shadow:2px 0 4px rgba(18,32,58,.06);min-width:110px}" +
      ".fo-fp thead th:nth-child(2){background:#FFFEFC}" +
      ".fo-fp .fo-fp-top td:nth-child(2){background:#fdf6e5}" +
      // match ratings: three columns (category, team A, team B) fill the width
      ".fo-ratingswrap{overflow:visible}" +
      ".fo-ratingswrap table{width:100% !important;min-width:0 !important;table-layout:fixed}" +
      ".fo-ratingswrap th,.fo-ratingswrap td{padding:9px 6px !important;font-size:13px !important;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-ratingswrap th:first-child,.fo-ratingswrap td:first-child{width:38%;white-space:nowrap}" +
      ".fo-ratingswrap td.n{font-variant-numeric:tabular-nums}" +
      ".fo-ratingswrap .small{font-size:10px !important}" +
      "}" +
      // scorecard sub-tabs: one scrolling row of pills, matching the app nav
      "html body .fo-sctabs{display:flex;flex-wrap:nowrap;gap:2px;margin:12px 0 12px;overflow-x:auto;padding:0;border-bottom:2px solid #DDD8CF;scrollbar-width:none;-webkit-overflow-scrolling:touch}" +
      "html body .fo-sctabs::-webkit-scrollbar{display:none}" +
      "html body #page .fo-sctab{flex:0 0 auto;font-size:13px !important;font-weight:700;padding:9px 15px !important;border:none !important;border-bottom:3px solid transparent !important;background:transparent !important;color:#5a6472 !important;border-radius:0 !important;cursor:pointer;white-space:nowrap;line-height:1.1;margin-bottom:-2px;transition:color .12s ease;box-shadow:none !important}" +
      "html body #page .fo-sctab:hover{color:#0E233F !important}" +
      "html body #page .fo-sctab.on{background:transparent !important;border-bottom-color:#C95532 !important;color:#0E233F !important;font-weight:800;box-shadow:none !important}" +
      "html body .fo-sctabs + .ftpskin{border-top:none;padding-top:0}";
    document.head.appendChild(cs);
  })(); } catch (e) { console.warn("scorecard+fantasy", e); }

  // ---- modern skin layer: one visual system for every engine page ----
  try {
    var foSkin = document.createElement("style");
    foSkin.textContent =
      // panels: one radius, one shadow, one border everywhere
      "html body #page .panel{border:1px solid #e7e2d5 !important;border-radius:14px !important;overflow:hidden;box-shadow:0 3px 14px rgba(18,32,58,.05) !important;background:#FFFEFC}" +
      "html body #page .panel h4{background:#07162E !important;color:#FFFEFC !important;font-size:12.5px !important;letter-spacing:.06em;text-transform:none;padding:11px 15px !important;border:0 !important;margin:0 !important}" +
      // tables: editorial headers, quiet rules, hover rows
      "html body #page table th{font-size:10.5px !important;letter-spacing:.07em;text-transform:uppercase;color:#667085 !important;background:#FFFEFC !important;border-bottom:1px solid #eae5d8 !important;padding:8px 10px !important}" +
      "html body #page table td{border-bottom:1px solid #f2eee3 !important;padding:8px 10px !important}" +
      "html body #page table tr:hover td{background:#fbf9f4}" +
      // controls: soft rounded, calm focus ring
      "html body #page select,html body #page input[type=text],html body #page input[type=number],html body #page input:not([type]){border:1px solid #ddd7c8 !important;border-radius:10px !important;background:#FFFEFC !important;padding:8px 11px !important;color:#0E233F}" +
      "html body #page select:focus,html body #page input:focus,html body #page button:focus-visible{outline:none !important;border-color:#C95532 !important;box-shadow:0 0 0 3px rgba(201,85,50,.18) !important}" +
      "html body #page button{border-radius:10px;border:1px solid #ddd7c8;background:#FFFEFC;color:#0E233F;padding:8px 14px;font-weight:600;cursor:pointer;transition:border-color .12s ease,transform .06s ease}" +
      "html body #page button:hover{border-color:#c9c2b2}" +
      // chips stay pills; primary CTAs keep their own classes untouched
      "html body #page .chip{border-radius:999px !important}" +
      // links: house terracotta, underline only on hover
      "html body #page a,html body #page table a,html body.ftpskin #page a{color:#B24E2B;text-decoration:none !important}html body #page a:hover{text-decoration:underline !important}" +
      // quiet the old hard rules
      "html body #page hr{border:none;border-top:1px solid #eae5d8;margin:14px 0}" +
      // thin, tinted scrollbars
      "*{scrollbar-width:thin;scrollbar-color:#d8d2c2 transparent}" +
      "::-webkit-scrollbar{width:9px;height:9px}::-webkit-scrollbar-thumb{background:#d8d2c2;border-radius:99px;border:2px solid #FFFEFC}::-webkit-scrollbar-track{background:transparent}" +
      // selection + smoothing niceties
      "::selection{background:rgba(201,85,50,.22)}" +
      "html body #page .small{color:#7d8695}";
    document.head.appendChild(foSkin);
  } catch (e) {}

  // ===========================================================================
  //  THE BROADER WORLD - international caps, named umpires, venue records,
  //  a press corps. All derived from data the game already keeps.
  // ===========================================================================
  try { (function () {
    var FO_UMP = ["Gerrit Vermeulen", "Howard Blackwood", "S. Ranatunga", "Clive Mortimer", "Ahmed Baig", "Piet van Rooyen", "Doug Prentice", "R. Subramaniam", "Neville Hart", "Marcus Delaney", "Imran Chaudhry", "Trevor Lyle", "K. Wickramasinghe", "Bram de Groot", "Owen Fitzgerald", "Harold Njoku"];
    function foUmpiresOf(seed) {
      var h = foHash32("ump-" + (seed || 0));
      var a = h % FO_UMP.length, b = (a + 1 + ((h >>> 4) % (FO_UMP.length - 1))) % FO_UMP.length;
      return [FO_UMP[a], FO_UMP[b]];
    }
    window.foFmtDate = function (d) {
      try { var dt = new Date(d); if (!isNaN(dt)) return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) {}
      return String(d || "");
    };
    // a club's establishment date: stamped once, backfilled from the earliest
    // saved result (i.e. founding day) for clubs created before this shipped
    window.foClubEst = function (t) {
      if (!t) return "";
      try {
        var meta = window.__foClubMeta && window.__foClubMeta[t.name];
        if (meta && meta.est) return foFmtDate(meta.est);
      } catch (eM) {}
      if (!t._est) {
        var earliest = null;
        (App.results || []).forEach(function (r) { if (r.date && (!earliest || new Date(r.date) < new Date(earliest))) earliest = r.date; });
        try { t._est = earliest || (typeof simDate === "function" ? simDate() : new Date().toDateString()); } catch (e) { t._est = earliest || new Date().toDateString(); }
      }
      return foFmtDate(t._est);
    };
    // the date a given season/round was played. League rounds run one per
    // real day, so current-season rounds map straight to the calendar (the
    // same arithmetic the fixture list uses); older seasons fall back to the
    // dates carried by tagged history entries.
    window.foRoundDate = function (sn, rn) {
      var c = (window.foRoundDate.__c = window.foRoundDate.__c || {}), k = sn + "-" + rn;
      if (c[k]) return c[k];
      try {
        if (App.season && sn === (App.seasonNo || 1) && rn >= 1) {
          var curR = App.season.round || 0;
          var d = new Date(); d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() + ((rn - 1) - curR) + (foCurAdvanced() ? 1 : 0));
          if (d <= new Date()) return (c[k] = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }));
        }
      } catch (e2) {}
      for (var nm in (App.playerHist || {})) {
        var hh = App.playerHist[nm];
        for (var i = 0; i < hh.length; i++) if (hh[i].s === sn && hh[i].r === rn && hh[i].date) return (c[k] = foFmtDate(hh[i].date));
      }
      return "S" + sn + " R" + rn;
    };
    window.foBeatWriter = function () {
      var t = null; try { t = userTeam(); } catch (e) {}
      var pool = ["Margot Ellison", "D. K. Ramachandran", "Frank Otten", "Beatrice Kolisi", "Sunil Menon", "Harriet Vane", "Joris Kamp", "Colin McArdle"];
      return pool[foHash32("press-" + ((t && t.name) || "") + "-" + (App.seasonNo || 1)) % pool.length] + ", cricket correspondent";
    };
    // named umpires surface inside the living commentary
    if (typeof window.comm === "function" && !window.comm.__foWorld) {
      var _cm = window.comm;
      window.comm = function (inn, out, rb, sb, bowler, intent, field) {
        var txt = _cm.apply(this, arguments);
        try {
          if (/the umpire/i.test(txt) && typeof M !== "undefined" && M && (inn.legal + (sb.b || 0)) % 2 === 0) {
            var u = foUmpiresOf(M.seed)[inn.legal % 2];
            txt = txt.replace(/[Tt]he umpire/, "Umpire " + u.split(" ").slice(-1)[0]);
          }
        } catch (e) {}
        // every delivery names the matchup, broadcast style
        try {
          if (bowler && bowler.name && sb && sb.p && sb.p.name) {
            var sn = function (n) { return String(n).split(" ").slice(-1)[0]; };
            txt = sn(bowler.name) + " to " + sn(sb.p.name) + ": " + txt;
          }
        } catch (e2) {}
        return txt;
      };
      window.comm.__foWorld = 1;
    }
    // ---- international call-ups: after rounds 6, 12 and 18, the national
    // selectors pick the two best in-form players of each nationality ----
    var FO_INTL_R = [6, 12, 18];
    function foIntlPick(w) {
      var byNat = {};
      for (var nm in (App.playerHist || {})) {
        var runs = 0, wk = 0, seen = 0;
        (App.playerHist[nm] || []).forEach(function (e) {
          if (e.fr || e.s !== (App.seasonNo || 1)) return;
          if (e.r == null || e.r <= w - 6 || e.r > w) return;
          runs += +e.rr || 0; wk += +e.w || 0; seen++;
        });
        if (!seen) continue;
        var pl = null; try { pl = findPlayer(nm); } catch (e2) {}
        if (!pl || !pl.p || !pl.p.nat) continue;
        (byNat[pl.p.nat] = byNat[pl.p.nat] || []).push({ n: nm, sc: runs + 22 * wk, t: pl.team, p: pl.p });
      }
      var picks = [];
      for (var nat in byNat) {
        byNat[nat].sort(function (a, b) { return b.sc - a.sc; });
        byNat[nat].slice(0, 2).forEach(function (x) { if (x.sc >= 60) picks.push({ nat: nat, n: x.n, t: x.t, p: x.p }); });
      }
      return picks;
    }
    if (typeof window.completeRound === "function" && !window.completeRound.__foWorld) {
      var _cr = window.completeRound;
      window.completeRound = function () {
        var out = _cr.apply(this, arguments);
        try {
          var rd = (App.season && App.season.round) || 0;   // round already advanced
          if (FO_INTL_R.indexOf(rd) >= 0) {
            var mark = "S" + (App.seasonNo || 1) + "R" + rd;
            foIntlPick(rd).forEach(function (pk) {
              if (pk.p._capsR === mark) return;
              pk.p._capsR = mark;
              pk.p._caps = (pk.p._caps || 0) + 1;
              var natN = pk.nat;
              try { if (typeof natName === "function" && natName(pk.nat)) natN = natName(pk.nat); } catch (e4) {}
              try { foCareerPush(pk.p, { s: App.seasonNo || 1, r: rd, ev: "cap", txt: "Called up by " + natN + " (cap " + pk.p._caps + ")" }); } catch (e2) {}
              var tm = (typeof pk.t === "string") ? (GD.teams || []).find(function (x) { return x.name === pk.t; }) : pk.t;
              if (tm) {
                tm._chron = tm._chron || { r: rd, items: [] };
                (tm._chron.items = tm._chron.items || []).push({ ev: "cap", name: pk.n, nat: natN, n: pk.p._caps });
              }
            });
            try { if (typeof window.saveGame === "function") window.saveGame(false); } catch (e3) {}
          }
        } catch (e) {}
        return out;
      };
      window.completeRound.__foWorld = 1;
    }
    // ---- venue records: every ground keeps its own book ----
    window.foVenueRecords = function () {
      var G = {};
      (App.results || []).forEach(function (r) {
        if (r.comp !== "league" || !r.ground || !r.innings) return;
        var g = G[r.ground] = G[r.ground] || { n: 0, hi: null, bat: null, bowl: null };
        g.n++;
        r.innings.filter(Boolean).forEach(function (inn) {
          if (!g.hi || inn.runs > g.hi.r) g.hi = { r: inn.runs, w: inn.wkts, t: inn.batTeam };
          (inn.bat || []).forEach(function (b) { if (b && (!g.bat || b.r > g.bat.r)) g.bat = { r: b.r, b: b.b, n: b.p.name }; });
          for (var k in (inn.bowlers || {})) { var br = inn.bowlers[k]; if (!g.bowl || br.w > g.bowl.w || (br.w === g.bowl.w && br.r < g.bowl.r)) g.bowl = { w: br.w, r: br.r, n: k }; }
        });
      });
      var rows = Object.keys(G).sort().map(function (gr) {
        var g = G[gr]; if (!g.hi) return "";
        return "<tr><td><b>" + E(gr) + "</b><span class='small' style='display:block'>" + g.n + " league match" + (g.n === 1 ? "" : "es") + "</span></td>" +
          "<td>" + g.hi.r + "/" + g.hi.w + " <span class='small'>" + E(g.hi.t) + "</span></td>" +
          "<td>" + (g.bat ? g.bat.r + " <span class='small'>" + E(g.bat.n) + "</span>" : "-") + "</td>" +
          "<td>" + (g.bowl && g.bowl.w ? g.bowl.w + "/" + g.bowl.r + " <span class='small'>" + E(g.bowl.n) + "</span>" : "-") + "</td></tr>";
      }).join("");
      if (!rows) return "";
      return "<div class='panel'><h4>Ground records</h4><div class='pad'><table><thead><tr><th>Ground</th><th>Highest total</th><th>Best innings</th><th>Best bowling</th></tr></thead><tbody>" + rows + "</tbody></table>" +
        "<div class='small' style='margin-top:7px;color:#667085'>Every venue keeps its own book. League matches only.</div></div></div>";
    };
    if (typeof window.pgStats === "function" && !window.pgStats.__foWorld) {
      var _ps = window.pgStats;
      window.pgStats = function () {
        var out = _ps.apply(this, arguments);
        try {
          var pg2 = document.getElementById("page");
          if (pg2 && !pg2.querySelector(".fo-venuerec")) {
            var vh = foVenueRecords();
            if (vh) { var d = document.createElement("div"); d.className = "fo-venuerec"; d.innerHTML = vh; pg2.appendChild(d); }
          }
        } catch (e) {}
        return out;
      };
      window.pgStats.__foWorld = 1;
    }
    var wcs = document.createElement("style");
    wcs.textContent = ".fo-news-by{margin-top:9px;padding-top:7px;border-top:1px dashed #e8e3d6;font-size:11px;color:#a09a8a;font-style:italic}";
    document.head.appendChild(wcs);
    window.foDestiny = function (nm) {
      var d = ["moves into the commentary box", "takes a coaching badge back home", "signs one last deal in the Northern Premier", "joins the umpiring panel", "opens a batting academy", "will run the family farm and watch from the hill"];
      return d[foHash32("dest-" + nm) % d.length];
    };
    // real towns, ~22 per cricket nation, alias-normalized (p.nat carries a
    // mix of codes and full names depending on how the player was generated)
    // real towns, ~100 per cricket nation (alias-normalized below)
    var FO_TOWNS = {
      Netherlands: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Nijmegen", "Apeldoorn", "Haarlem", "Arnhem", "Enschede", "Amersfoort", "Zaandam", "Den Bosch", "Zwolle", "Leiden", "Maastricht", "Dordrecht", "Ede", "Alphen aan den Rijn", "Leeuwarden", "Alkmaar", "Emmen", "Delft", "Venlo", "Deventer", "Sittard", "Helmond", "Heerlen", "Hilversum", "Oss", "Amstelveen", "Purmerend", "Roosendaal", "Schiedam", "Spijkenisse", "Vlaardingen", "Almelo", "Gouda", "Hoorn", "Assen", "Bergen op Zoom", "Capelle aan den IJssel", "Veenendaal", "Katwijk", "Zeist", "Nieuwegein", "Lelystad", "Roermond", "Doetinchem", "Hoogeveen", "Terneuzen", "Kampen", "Woerden", "Houten", "Weert", "Middelburg", "Waalwijk", "Harderwijk", "Soest", "Barneveld", "Heerhugowaard", "Rijswijk", "Kerkrade", "Oosterhout", "Den Helder", "Hardenberg", "Zutphen", "Vlissingen", "Etten-Leur", "Nijkerk", "Wageningen", "Zevenaar", "Meppel", "Gorinchem", "Voorburg", "Wassenaar", "Sneek", "Tiel", "Uden", "Beverwijk", "Hellevoetsluis", "Maassluis", "Ridderkerk", "Zwijndrecht", "Vught", "Baarn", "Bussum", "Heemstede", "Castricum", "Winterswijk", "Dronten", "IJmuiden", "Emmeloord", "Volendam", "Naarden", "Edam"],
      England: ["York", "Harrogate", "Halifax", "Huddersfield", "Wakefield", "Barnsley", "Doncaster", "Rotherham", "Scarborough", "Whitby", "Skipton", "Keighley", "Pudsey", "Otley", "Ilkley", "Ripon", "Northallerton", "Middlesbrough", "Darlington", "Durham", "Sunderland", "Gateshead", "Hexham", "Ashington", "Morpeth", "Carlisle", "Kendal", "Lancaster", "Preston", "Blackburn", "Burnley", "Bolton", "Wigan", "Southport", "Ormskirk", "Chester", "Crewe", "Stoke-on-Trent", "Stafford", "Shrewsbury", "Telford", "Wolverhampton", "Walsall", "Dudley", "Coventry", "Leamington Spa", "Rugby", "Nuneaton", "Worcester", "Kidderminster", "Hereford", "Gloucester", "Cheltenham", "Bristol", "Bath", "Taunton", "Yeovil", "Exeter", "Plymouth", "Truro", "Bournemouth", "Poole", "Salisbury", "Southampton", "Portsmouth", "Winchester", "Basingstoke", "Reading", "Slough", "Oxford", "Banbury", "Aylesbury", "Luton", "Watford", "St Albans", "Stevenage", "Cambridge", "Peterborough", "Norwich", "Ipswich", "Colchester", "Chelmsford", "Southend-on-Sea", "Maidstone", "Canterbury", "Ashford", "Dover", "Hastings", "Eastbourne", "Brighton", "Hove", "Worthing", "Crawley", "Guildford", "Woking", "Hull", "Grimsby", "Lincoln", "Nottingham", "Derby", "Leicester", "Northampton", "Bedford", "Chesterfield", "Mansfield", "Leeds", "Chester-le-Street"],
      Australia: ["Ballarat", "Bendigo", "Geelong", "Shepparton", "Mildura", "Wodonga", "Warrnambool", "Traralgon", "Horsham", "Sale", "Bairnsdale", "Colac", "Echuca", "Swan Hill", "Wangaratta", "Ararat", "Portland", "Newcastle", "Wollongong", "Wagga Wagga", "Albury", "Dubbo", "Tamworth", "Orange", "Bathurst", "Lismore", "Coffs Harbour", "Port Macquarie", "Armidale", "Goulburn", "Griffith", "Broken Hill", "Nowra", "Taree", "Cessnock", "Maitland", "Singleton", "Mudgee", "Parkes", "Forbes", "Cowra", "Young", "Queanbeyan", "Grafton", "Ballina", "Byron Bay", "Inverell", "Moree", "Gunnedah", "Toowoomba", "Cairns", "Townsville", "Mackay", "Rockhampton", "Bundaberg", "Hervey Bay", "Gladstone", "Maryborough", "Gympie", "Warwick", "Roma", "Emerald", "Mount Isa", "Charters Towers", "Ayr", "Innisfail", "Mareeba", "Kingaroy", "Dalby", "Launceston", "Devonport", "Burnie", "Ulverstone", "Bunbury", "Geraldton", "Albany", "Kalgoorlie", "Broome", "Port Hedland", "Karratha", "Busselton", "Mandurah", "Northam", "Esperance", "Mount Gambier", "Whyalla", "Port Augusta", "Port Pirie", "Port Lincoln", "Murray Bridge", "Gawler", "Victor Harbor", "Renmark", "Alice Springs", "Katherine", "Palmerston", "Penrith", "Fremantle"],
      India: ["Pune", "Nagpur", "Nashik", "Aurangabad", "Solapur", "Kolhapur", "Amravati", "Akola", "Latur", "Sangli", "Jalgaon", "Nanded", "Satara", "Ratnagiri", "Thane", "Rajkot", "Surat", "Vadodara", "Bhavnagar", "Jamnagar", "Junagadh", "Gandhinagar", "Anand", "Bharuch", "Porbandar", "Indore", "Bhopal", "Gwalior", "Jabalpur", "Ujjain", "Sagar", "Ratlam", "Rewa", "Satna", "Kanpur", "Lucknow", "Varanasi", "Agra", "Meerut", "Prayagraj", "Bareilly", "Aligarh", "Moradabad", "Gorakhpur", "Jhansi", "Saharanpur", "Mathura", "Ayodhya", "Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Darbhanga", "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Raipur", "Bilaspur", "Bhilai", "Amritsar", "Ludhiana", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Chandigarh", "Ambala", "Karnal", "Panipat", "Rohtak", "Hisar", "Gurugram", "Faridabad", "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner", "Alwar", "Dehradun", "Haridwar", "Haldwani", "Shimla", "Jammu", "Srinagar", "Mysuru", "Mangaluru", "Hubballi", "Belagavi", "Shivamogga", "Davangere", "Tumakuru", "Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kollam", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Vellore", "Erode", "Tirunelveli", "Vijayawada", "Visakhapatnam", "Guntur", "Nellore", "Tirupati", "Warangal", "Nizamabad", "Karimnagar", "Guwahati", "Silchar", "Dibrugarh", "Shillong", "Imphal", "Agartala", "Cuttack", "Bhubaneswar", "Rourkela", "Sambalpur", "Puri", "Asansol", "Durgapur", "Siliguri", "Howrah", "Kharagpur"],
      Pakistan: ["Multan", "Sialkot", "Peshawar", "Quetta", "Gujranwala", "Faisalabad", "Rawalpindi", "Hyderabad", "Sargodha", "Bahawalpur", "Sheikhupura", "Abbottabad", "Larkana", "Sahiwal", "Mardan", "Sukkur", "Okara", "Jhelum", "Mianwali", "Gujrat", "Kasur", "Attock", "Chiniot", "Kamoke", "Hafizabad", "Jhang", "Toba Tek Singh", "Burewala", "Vehari", "Khanewal", "Muzaffargarh", "Dera Ghazi Khan", "Rahim Yar Khan", "Sadiqabad", "Bahawalnagar", "Pakpattan", "Chishtian", "Arifwala", "Mian Channu", "Kabirwala", "Lodhran", "Layyah", "Bhakkar", "Khushab", "Chakwal", "Talagang", "Gojra", "Samundri", "Jaranwala", "Sangla Hill", "Nankana Sahib", "Muridke", "Kamalia", "Daska", "Narowal", "Pasrur", "Sambrial", "Wazirabad", "Mandi Bahauddin", "Phalia", "Kharian", "Dina", "Gujar Khan", "Taxila", "Wah Cantt", "Haripur", "Mansehra", "Batkhela", "Swabi", "Charsadda", "Nowshera", "Kohat", "Bannu", "Dera Ismail Khan", "Tank", "Hangu", "Timergara", "Mingora", "Chitral", "Gilgit", "Skardu", "Muzaffarabad", "Mirpur", "Kotli", "Bhimber", "Jacobabad", "Shikarpur", "Khairpur", "Nawabshah", "Mirpur Khas", "Umerkot", "Badin", "Thatta", "Kotri", "Dadu", "Sehwan", "Tando Adam", "Tando Allahyar", "Ghotki", "Turbat", "Gwadar", "Khuzdar", "Hub", "Zhob", "Loralai", "Sibi", "Chaman"],
      "South Africa": ["Paarl", "Stellenbosch", "Worcester", "George", "Knysna", "Mossel Bay", "Oudtshoorn", "Beaufort West", "Swellendam", "Hermanus", "Caledon", "Malmesbury", "Vredenburg", "Saldanha", "Ceres", "Robertson", "Montagu", "Wellington", "Franschhoek", "Somerset West", "Strand", "Bloemfontein", "Welkom", "Kroonstad", "Bethlehem", "Sasolburg", "Parys", "Harrismith", "Ficksburg", "Ladybrand", "Virginia", "Odendaalsrus", "Kimberley", "Upington", "Kuruman", "De Aar", "Springbok", "Colesberg", "Kathu", "Postmasburg", "Gqeberha", "East London", "Uitenhage", "Makhanda", "Graaff-Reinet", "Cradock", "Komani", "King William's Town", "Mthatha", "Port Alfred", "Jeffreys Bay", "Humansdorp", "Aliwal North", "Butterworth", "Pietermaritzburg", "Ladysmith", "Richards Bay", "Empangeni", "Ballito", "Howick", "Estcourt", "Vryheid", "Eshowe", "Kokstad", "Port Shepstone", "Margate", "Ulundi", "Benoni", "Boksburg", "Brakpan", "Springs", "Germiston", "Kempton Park", "Edenvale", "Alberton", "Vereeniging", "Vanderbijlpark", "Krugersdorp", "Randfontein", "Roodepoort", "Soweto", "Midrand", "Centurion", "Potchefstroom", "Klerksdorp", "Rustenburg", "Mahikeng", "Brits", "Lichtenburg", "Vryburg", "Zeerust", "Polokwane", "Tzaneen", "Mokopane", "Musina", "Thohoyandou", "Mbombela", "White River", "Barberton", "Middelburg", "Emalahleni", "Secunda", "Standerton", "Ermelo", "Bethal", "Volksrust", "Piet Retief"],
      "New Zealand": ["Whangarei", "Kerikeri", "Kaitaia", "Dargaville", "Warkworth", "Pukekohe", "Waiuku", "Thames", "Paeroa", "Waihi", "Morrinsville", "Matamata", "Te Awamutu", "Cambridge", "Te Kuiti", "Otorohanga", "Taumarunui", "Tokoroa", "Putaruru", "Rotorua", "Tauranga", "Mount Maunganui", "Te Puke", "Whakatane", "Opotiki", "Kawerau", "Gisborne", "Wairoa", "Napier", "Hastings", "Havelock North", "Waipukurau", "Dannevirke", "Palmerston North", "Feilding", "Levin", "Otaki", "Paraparaumu", "Porirua", "Upper Hutt", "Lower Hutt", "Masterton", "Carterton", "Greytown", "Featherston", "Martinborough", "New Plymouth", "Inglewood", "Stratford", "Hawera", "Whanganui", "Marton", "Taihape", "Ohakune", "Taupo", "Turangi", "Nelson", "Richmond", "Motueka", "Takaka", "Blenheim", "Picton", "Kaikoura", "Westport", "Greymouth", "Hokitika", "Rangiora", "Kaiapoi", "Lincoln", "Rolleston", "Darfield", "Akaroa", "Ashburton", "Methven", "Geraldine", "Temuka", "Timaru", "Waimate", "Oamaru", "Dunedin", "Mosgiel", "Balclutha", "Milton", "Lawrence", "Roxburgh", "Alexandra", "Clyde", "Cromwell", "Wanaka", "Queenstown", "Arrowtown", "Te Anau", "Gore", "Mataura", "Winton", "Invercargill", "Bluff", "Riverton"],
      "Sri Lanka": ["Galle", "Kandy", "Matara", "Kurunegala", "Moratuwa", "Negombo", "Jaffna", "Ratnapura", "Badulla", "Anuradhapura", "Batticaloa", "Trincomalee", "Panadura", "Kalutara", "Gampaha", "Ambalangoda", "Nuwara Eliya", "Hambantota", "Chilaw", "Kegalle", "Dambulla", "Matale", "Dehiwala", "Mount Lavinia", "Kotte", "Maharagama", "Kelaniya", "Ja-Ela", "Wattala", "Minuwangoda", "Divulapitiya", "Katunayake", "Seeduwa", "Kadawatha", "Ragama", "Kiribathgoda", "Homagama", "Piliyandala", "Kesbewa", "Horana", "Bandaragama", "Beruwala", "Aluthgama", "Bentota", "Hikkaduwa", "Weligama", "Mirissa", "Tangalle", "Tissamaharama", "Kataragama", "Monaragala", "Wellawaya", "Bandarawela", "Haputale", "Ella", "Hatton", "Talawakele", "Gampola", "Nawalapitiya", "Peradeniya", "Katugastota", "Akurana", "Wattegama", "Kundasale", "Mawanella", "Rambukkana", "Warakapola", "Ruwanwella", "Avissawella", "Hanwella", "Padukka", "Ingiriya", "Bulathsinhala", "Agalawatta", "Baddegama", "Elpitiya", "Udugama", "Akuressa", "Deniyaya", "Embilipitiya", "Balangoda", "Pelmadulla", "Eheliyagoda", "Kuruwita", "Godakawela", "Kalawana", "Ampara", "Kalmunai", "Akkaraipattu", "Sammanthurai", "Pottuvil", "Valachchenai", "Eravur", "Kattankudy", "Muttur", "Kinniya", "Kantale", "Polonnaruwa", "Kaduruwela", "Hingurakgoda", "Medirigiriya", "Kekirawa", "Mihintale", "Puttalam", "Wennappuwa", "Marawila", "Nattandiya", "Madampe", "Kuliyapitiya", "Narammala", "Pannala", "Polgahawela", "Alawwa", "Mawathagama", "Ibbagamuwa", "Vavuniya", "Mannar", "Kilinochchi", "Point Pedro", "Chavakachcheri"],
      "West Indies": ["Port of Spain", "San Fernando", "Chaguanas", "Arima", "Point Fortin", "Couva", "Tunapuna", "Sangre Grande", "Princes Town", "Rio Claro", "Siparia", "Penal", "Debe", "Marabella", "Gasparillo", "Fyzabad", "Diego Martin", "Arouca", "Tacarigua", "Curepe", "St Joseph", "San Juan", "Barataria", "Carenage", "Toco", "Mayaro", "Scarborough", "Roxborough", "Plymouth", "Kingston", "Spanish Town", "Portmore", "Montego Bay", "May Pen", "Mandeville", "Old Harbour", "Savanna-la-Mar", "Ocho Rios", "Port Antonio", "Linstead", "Half Way Tree", "Ewarton", "Bog Walk", "Falmouth", "Lucea", "Black River", "Santa Cruz", "Brown's Town", "Morant Bay", "Port Maria", "Chapelton", "Yallahs", "Bridgetown", "Speightstown", "Oistins", "Holetown", "Bathsheba", "Warrens", "Georgetown", "New Amsterdam", "Linden", "Anna Regina", "Bartica", "Skeldon", "Rose Hall", "Corriverton", "Mahaica", "Parika", "St John's", "All Saints", "Liberta", "Bolans", "Basseterre", "Sandy Point Town", "Charlestown", "Castries", "Gros Islet", "Vieux Fort", "Soufriere", "Micoud", "Dennery", "Anse La Raye", "Choiseul", "Kingstown", "Layou", "Barrouallie", "Chateaubelair", "Calliaqua", "Mesopotamia", "St George's", "Gouyave", "Grenville", "Sauteurs", "Victoria", "Roseau", "Portsmouth", "Marigot", "La Plaine"],
      Afghanistan: ["Kandahar", "Herat", "Mazar-i-Sharif", "Jalalabad", "Kunduz", "Ghazni", "Khost", "Lashkar Gah", "Taloqan", "Puli Khumri", "Charikar", "Sheberghan", "Sar-e Pol", "Aybak", "Faizabad", "Farah", "Zaranj", "Gardez", "Mehtar Lam", "Asadabad", "Bamyan", "Nili", "Firozkoh", "Qalat", "Tarinkot", "Maimana", "Mahmud-i-Raqi", "Parun", "Sharana", "Maidan Shar", "Pul-i-Alam", "Bazarak", "Baghlan", "Khulm", "Balkh", "Aqcha", "Andkhoy", "Istalif", "Paghman", "Char Asiab", "Bagram", "Jabal Saraj", "Gulbahar", "Doshi", "Khinjan", "Nahrin", "Baghlan-e-Jadid", "Imam Sahib", "Khanabad", "Dasht-e-Archi", "Ali Abad", "Chahar Dara", "Rustaq", "Farkhar", "Ishkashim", "Jurm", "Baharak", "Kishim", "Shahr-e-Buzurg", "Zebak", "Spin Boldak", "Panjwai", "Arghandab", "Daman", "Maiwand", "Musa Qala", "Sangin", "Gereshk", "Nad Ali", "Garmsir", "Nawa", "Kajaki", "Shindand", "Ghurian", "Obe", "Karukh", "Gulran", "Islam Qala", "Torkham", "Achin", "Rodat", "Batikot", "Momand Dara", "Surkh Rod", "Behsud", "Kama", "Goshta", "Kuz Kunar", "Dara-e-Nur", "Alingar", "Alishang", "Dawlat Shah", "Qarghayi", "Watapur", "Manogai", "Khas Kunar", "Marawara", "Dangam", "Narang", "Chapa Dara"],
      Ireland: ["Cork", "Galway", "Limerick", "Waterford", "Kilkenny", "Sligo", "Tralee", "Athlone", "Navan", "Carlow", "Ennis", "Dundalk", "Bray", "Mullingar", "Wexford", "Letterkenny", "Portlaoise", "Clonmel", "Bangor", "Coleraine", "Armagh", "Omagh", "Ballymena", "Lisburn", "Drogheda", "Newry", "Derry", "Enniskillen", "Antrim", "Carrickfergus", "Larne", "Newtownards", "Downpatrick", "Banbridge", "Portadown", "Lurgan", "Dungannon", "Cookstown", "Magherafelt", "Strabane", "Limavady", "Ballymoney", "Holywood", "Comber", "Donaghadee", "Whitehead", "Ballyclare", "Randalstown", "Kilrea", "Maghera", "Dungiven", "Naas", "Newbridge", "Kildare", "Maynooth", "Celbridge", "Leixlip", "Athy", "Tullamore", "Birr", "Edenderry", "Portarlington", "Mountmellick", "Abbeyleix", "Roscrea", "Nenagh", "Thurles", "Templemore", "Cashel", "Tipperary", "Carrick-on-Suir", "Cahir", "Fermoy", "Mallow", "Midleton", "Youghal", "Cobh", "Kinsale", "Bandon", "Clonakilty", "Skibbereen", "Bantry", "Macroom", "Killarney", "Kenmare", "Dingle", "Listowel", "Castleisland", "Newcastle West", "Kilrush", "Kilkee", "Shannon", "Sixmilebridge", "Gort", "Tuam", "Ballinasloe", "Loughrea", "Clifden", "Westport", "Castlebar", "Ballina", "Ballinrobe", "Claremorris", "Boyle", "Carrick-on-Shannon", "Longford", "Granard", "Cavan", "Monaghan", "Carrickmacross", "Castleblayney", "Clones", "Trim", "Kells", "Ashbourne", "Dunboyne", "Balbriggan", "Skerries", "Malahide", "Swords", "Greystones", "Arklow", "Wicklow", "Gorey", "Enniscorthy", "New Ross", "Tramore", "Dungarvan", "Lismore", "Bundoran", "Ballyshannon", "Donegal Town", "Buncrana", "Carndonagh"],
      Zimbabwe: ["Bulawayo", "Mutare", "Gweru", "Kwekwe", "Masvingo", "Chinhoyi", "Marondera", "Kadoma", "Chegutu", "Bindura", "Zvishavane", "Victoria Falls", "Hwange", "Rusape", "Chiredzi", "Kariba", "Gwanda", "Shurugwi", "Norton", "Beitbridge", "Chitungwiza", "Epworth", "Ruwa", "Chivhu", "Mvurwi", "Shamva", "Mount Darwin", "Guruve", "Karoi", "Chirundu", "Makuti", "Banket", "Mhangura", "Raffingora", "Murewa", "Mutoko", "Hwedza", "Macheke", "Headlands", "Nyazura", "Odzi", "Penhalonga", "Nyanga", "Juliasdale", "Chimanimani", "Chipinge", "Birchenough Bridge", "Checheche", "Triangle", "Ngundu", "Jerera", "Gutu", "Mupandawana", "Mashava", "Renco", "Rutenga", "Mwenezi", "West Nicholson", "Colleen Bawn", "Filabusi", "Esigodini", "Plumtree", "Figtree", "Nyamandlovu", "Tsholotsho", "Lupane", "Binga", "Dete", "Gokwe", "Nembudziya", "Sanyati", "Munyati", "Redcliff", "Lalapanzi", "Mvuma", "Featherstone", "Beatrice", "Selous", "Darwendale", "Murombedzi", "Domboshava", "Goromonzi", "Arcturus", "Glendale", "Concession", "Centenary", "Muzarabani", "Rushinga", "Nyamapanda", "Kotwa", "Maphisa", "Kezi", "Insiza", "Shangani", "Somabhula", "Zhombe"],
      Bangladesh: ["Chattogram", "Khulna", "Rajshahi", "Sylhet", "Barisal", "Rangpur", "Mymensingh", "Cumilla", "Narayanganj", "Gazipur", "Jashore", "Bogura", "Dinajpur", "Tangail", "Narsingdi", "Kushtia", "Brahmanbaria", "Feni", "Pabna", "Magura", "Cox's Bazar", "Savar", "Tongi", "Jamalpur", "Naogaon", "Sirajganj", "Natore", "Joypurhat", "Chapainawabganj", "Meherpur", "Chuadanga", "Jhenaidah", "Narail", "Satkhira", "Bagerhat", "Pirojpur", "Jhalokati", "Patuakhali", "Barguna", "Bhola", "Lakshmipur", "Noakhali", "Chandpur", "Shariatpur", "Madaripur", "Gopalganj", "Faridpur", "Rajbari", "Manikganj", "Munshiganj", "Kishoreganj", "Netrokona", "Sherpur", "Sunamganj", "Habiganj", "Moulvibazar", "Panchagarh", "Thakurgaon", "Nilphamari", "Lalmonirhat", "Kurigram", "Gaibandha", "Khagrachari", "Rangamati", "Bandarban", "Saidpur", "Parbatipur", "Fulbari", "Birampur", "Ishwardi", "Bheramara", "Kumarkhali", "Alamdanga", "Kotchandpur", "Kaliganj", "Benapole", "Jhikargachha", "Monirampur", "Keshabpur", "Chowgachha", "Kalaroa", "Tala", "Paikgachha", "Dumuria", "Phultala", "Rampal", "Mongla", "Morrelganj", "Mathbaria", "Nesarabad", "Banaripara", "Wazirpur", "Gournadi", "Muladi", "Mehendiganj", "Kalapara", "Kuakata", "Amtali", "Betagi", "Bauphal", "Galachipa", "Dashmina"]
    };
    var FO_NATAL = { AUS: "Australia", IND: "India", PAK: "Pakistan", SRI: "Sri Lanka", SL: "Sri Lanka", NZL: "New Zealand", NZ: "New Zealand", SAF: "South Africa", RSA: "South Africa", ENG: "England", NED: "Netherlands", HOL: "Netherlands", WIN: "West Indies", WI: "West Indies", AFG: "Afghanistan", IRE: "Ireland", ZIM: "Zimbabwe", BAN: "Bangladesh" };
    window.foHometown = function (pl) {
      var nat = String((pl && pl.nat) || "");
      var key = FO_TOWNS[nat] ? nat : FO_NATAL[nat.toUpperCase()] || null;
      var towns = key ? FO_TOWNS[key] : null;
      if (!towns) { // unknown nation: still a real place, hash-picked globally
        var allT = []; for (var k2 in FO_TOWNS) allT = allT.concat(FO_TOWNS[k2]);
        towns = allT;
      }
      return towns[foHash32("home-" + (pl && pl.name)) % towns.length];
    };
    // ---- the league almanac (#/almanac): the whole world's record book ----
    window.foAlmanacHTML = function () {
      var champs = [];
      (GD.teams || []).forEach(function (t) {
        (((t._museum || {}).trophies) || []).forEach(function (tr) {
          if (/champion|title|league/i.test(tr.kind || "")) champs.push({ s: tr.s, t: t.name, k: tr.kind });
        });
      });
      champs.sort(function (a, b) { return (a.s || 0) - (b.s || 0); });
      var runsAll = [], wktsAll = [], capsAll = [];
      for (var nm in (App.playerHist || {})) {
        var r = 0, w = 0;
        (App.playerHist[nm] || []).forEach(function (e) { if (!e.fr) { r += +e.rr || 0; w += +e.w || 0; } });
        if (r) runsAll.push({ n: nm, v: r });
        if (w) wktsAll.push({ n: nm, v: w });
      }
      (GD.teams || []).forEach(function (t) { (t.players || []).forEach(function (pp) { if (pp._caps) capsAll.push({ n: pp.name, v: pp._caps, nat: pp.nat }); }); });
      runsAll.sort(function (a, b) { return b.v - a.v; }); wktsAll.sort(function (a, b) { return b.v - a.v; }); capsAll.sort(function (a, b) { return b.v - a.v; });
      var hi = null, bb = null, big = null;
      (App.results || []).forEach(function (rr2) {
        if (rr2.comp !== "league" || !rr2.innings) return;
        rr2.innings.filter(Boolean).forEach(function (inn) {
          if (!hi || inn.runs > hi.r) hi = { r: inn.runs, w: inn.wkts, t: inn.batTeam, g: rr2.ground };
          (inn.bat || []).forEach(function (b2) { if (b2 && (!big || b2.r > big.r)) big = { r: b2.r, b: b2.b, n: b2.p.name }; });
          for (var k in (inn.bowlers || {})) { var br2 = inn.bowlers[k]; if (!bb || br2.w > bb.w || (br2.w === bb.w && br2.r < bb.r)) bb = { w: br2.w, r: br2.r, n: k }; }
        });
      });
      var list = function (arr, unit) {
        return arr.slice(0, 8).map(function (x, i) { return "<div class='fo-ms-row'><span>" + (i + 1) + ".</span><b>" + E(x.n) + "</b>" + (x.nat ? " <span class='small'>" + E(x.nat) + "</span>" : "") + "<i>" + x.v.toLocaleString() + " " + unit + "</i></div>"; }).join("") || "<div class='small'>Nothing yet - the history is still being written.</div>";
      };
      var pn = function (t2, b2) { return "<div class='panel'><h4>" + t2 + "</h4><div class='pad'>" + b2 + "</div></div>"; };
      return "<div class='crumb'>League &raquo; Almanac</div>" +
        "<div class='page-head'><div><div class='eyebrow'>The record book</div><h1>The Fifty Overs Almanac</h1><p>Everything that has ever happened in this league, kept for good.</p></div></div>" +
        pn("Roll of honour", champs.map(function (c) { return "<div class='fo-ms-row'><span>Season " + c.s + "</span><b>" + E(c.t) + "</b><i>" + E(c.k) + "</i></div>"; }).join("") || "<div class='small'>No champions yet. Someone will be first.</div>") +
        pn("All-time run scorers", list(runsAll, "runs")) +
        pn("All-time wicket takers", list(wktsAll, "wkts")) +
        pn("Most international caps", list(capsAll, "caps")) +
        pn("Record book", (hi ? "<div class='fo-ms-row'><span>Highest total</span><b>" + hi.r + "/" + hi.w + " " + E(hi.t) + "</b><i>" + E(hi.g || "") + "</i></div>" : "") +
          (big ? "<div class='fo-ms-row'><span>Best innings</span><b>" + big.r + " (" + big.b + ") " + E(big.n) + "</b><i></i></div>" : "") +
          (bb && bb.w ? "<div class='fo-ms-row'><span>Best bowling</span><b>" + bb.w + "/" + bb.r + " " + E(bb.n) + "</b><i></i></div>" : "") || "<div class='small'>No league matches yet.</div>") +
        (typeof foVenueRecords === "function" ? foVenueRecords() : "");
    };
    function foRenderAlmanac() {
      try {
        if (!/^#\/almanac/.test(location.hash || "")) return;
        var page = document.getElementById("page"); if (!page) return;
        if (page.querySelector(".fo-alm-flag")) return;
        page.innerHTML = "<div class='fo-alm-flag'></div>" + foAlmanacHTML();
      } catch (e) {}
    }
    window.addEventListener("hashchange", function () { setTimeout(foRenderAlmanac, 25); });
    if (typeof window.route === "function" && !window.route.__foAlm) {
      var _rt2 = window.route;
      window.route = function () { var r = _rt2.apply(this, arguments); try { foRenderAlmanac(); } catch (e) {} return r; };
      window.route.__foAlm = 1;
    }
    // stats page links to the almanac
    if (typeof window.pgStats === "function" && !window.pgStats.__foAlm) {
      var _ps2 = window.pgStats;
      window.pgStats = function () {
        var out = _ps2.apply(this, arguments);
        try {
          var pg3 = document.getElementById("page");
          if (pg3 && !pg3.querySelector(".fo-alm-link")) {
            var d2 = document.createElement("div"); d2.className = "fo-alm-link";
            d2.innerHTML = "<div class='panel'><div class='pad' style='text-align:center'><a href='#/almanac' style='font-weight:800'>&#128214; Open the Fifty Overs Almanac - the league's all-time record book &rsaquo;</a></div></div>";
            pg3.appendChild(d2);
          }
        } catch (e) {}
        return out;
      };
      window.pgStats.__foAlm = 1;
    }
    window.__foWorld = { umpires: foUmpiresOf, intlPick: foIntlPick };
  })(); } catch (e) { console.warn("broader world", e); }

  // ---- late polish: light scout report, bottom tap-tips, phone toasts ----
  try {
    var foLate = document.createElement("style");
    foLate.textContent =
      "#fo-taptip{position:fixed;left:12px;right:12px;bottom:14px;z-index:100002;background:#0E233F;color:#FFFEFC;border-radius:11px;padding:10px 14px;font-size:12.5px;line-height:1.5;box-shadow:0 8px 24px rgba(6,12,24,.35);opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease}" +
      "#fo-taptip.on{opacity:1;transform:none}" +
      "@media(max-width:820px){#fo-toasts{top:auto !important;bottom:64px !important}}" +
      // the scout report stays DARK - refined, with everything inside it
      // recut to belong on navy (glass tiles, amber-on-dark fixture pill)
      "html body #page .fo-scout-hero,html body.ftpskin #page .fo-scout-hero{background:linear-gradient(135deg,#0E233F,#07162E 62%) !important;border:1px solid rgba(246,244,238,.08) !important;box-shadow:0 10px 30px rgba(7,22,46,.3) !important;color:#c7cfda !important;border-radius:16px !important}" +
      "html body .fo-scout-hero::before,html body .fo-scout-hero::after{display:none !important}" +
      "html body .fo-scout-hero .fo-scout-name{color:#fff !important}" +
      "html body .fo-scout-hero .fo-scout-eyebrow{color:#E8825A !important}" +
      "html body .fo-scout-hero .small,html body .fo-scout-hero span{color:#9aa3b2}" +
      "html body .fo-scout-hero .fo-scout-meta{color:#9aa3b2 !important}" +
      "html body .fo-scout-kpis>*{background:rgba(246,244,238,.06) !important;border:1px solid rgba(246,244,238,.13) !important;border-radius:13px}" +
      "html body .fo-scout-kpis b{color:#fff !important}" +
      "html body .fo-scout-kpis span{color:#93a0b4}" +
      "html body .fo-scout-hero .fo-scout-actions button{background:#C95532 !important;border:1px solid #C95532 !important;color:#fff !important;border-radius:10px;font-weight:800;box-shadow:0 3px 10px rgba(201,85,50,.35)}" +
      "html body .fo-scout-hero .fo-scout-actions button.fo-scout-back,html body .fo-scout-hero .fo-scout-actions .fo-scout-back{background:transparent !important;border:1px solid rgba(246,244,238,.25) !important;color:#dfe5ec !important;font-weight:600;box-shadow:none}" +
      "html body .fo-scout-hero .fo-face-chip{background:rgba(217,164,65,.13) !important;border:1px solid rgba(217,164,65,.42) !important;color:#E8C77A !important;border-radius:999px;padding:9px 16px;font-weight:700;text-align:center}" +
      "html body .fo-scout-links{background:transparent !important}" +
      "html body .fo-scout-links a{background:#FFFEFC !important;border:1px solid #DDD8CF !important;color:#3c4658 !important;border-radius:999px;margin:0 3px}" +
      "html body #page .fo-scout-links a.on,html body .fo-scout-links a.on{background:#C95532 !important;border-color:#C95532 !important;color:#fff !important}";
    document.head.appendChild(foLate);
  } catch (e) {}

  // ===========================================================================
  //  MATCHDAY THEATRE - results are computed at 9:00 AM, but the BROADCAST
  //  takes an hour. Everything below is presentation: a wall-clock replay of
  //  the already-saved matches, identical on every device, with every result
  //  surface embargoed until stumps.
  // ===========================================================================
  try { (function () {
    var FO_BCAST_MIN = 60;
    function foBcastKey() { return "fol_bcast_" + (LG ? LG.id : "solo"); }
    function foParse9am(s) {
      // iOS Safari rejects "Sat, 4 Jul 2026 09:00:00 GMT-0400"; rebuild the
      // date as strict ISO-8601 (spec-guaranteed everywhere) before falling
      // back to the loose form for anything the regex misses
      try {
        var m = String(s || "").match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
        if (m) {
          var MM = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" }[m[2].slice(0, 3).toLowerCase()];
          var t = Date.parse(m[3] + "-" + MM + "-" + ("0" + m[1]).slice(-2) + "T09:00:00-04:00");
          if (!isNaN(t)) return t;
        }
      } catch (e) {}
      var t2 = Date.parse(String(s || "") + " 09:00:00 GMT-0400");
      return isNaN(t2) ? NaN : t2;
    }
    function foBcastT0(rd) {
      // solo (and any locally-resolved round): the moment it resolved
      try { var st = JSON.parse(lsGet(foBcastKey()) || "null"); if (st && st.round === rd && st.t0) return st.t0; } catch (e) {}
      // multiplayer, best case: the resolver's own advance stamp says which
      // day this round belongs to - 9:00 AM ET that day, same for everyone
      try {
        var adv = window.__foAdvDate;
        if (adv && rd === foLastRoundIx()) {
          var tA = Date.parse(String(adv) + "T09:00:00-04:00");
          if (!isNaN(tA) && Math.abs(tA - Date.now()) < 2 * 86400000) return tA;
        }
      } catch (eA) {}
      // multiplayer: the scheduled 9:00 AM ET of that round, same for everyone.
      // Anchor on the round's own saved result date (always a full date) -
      // foDailyDate can return a yearless string that Date.parse rejects,
      // which silently killed the embargo and let the old fast replay run.
      try {
        var rows0 = foLeagueRounds()[rd] || [];
        var cand = [(rows0[0] && rows0[0].date) || "", foDailyDate(rd), foDailyDate(rd) + " " + new Date().getFullYear()];
        for (var ci = 0; ci < cand.length; ci++) {
          if (!cand[ci]) continue;
          var t = foParse9am(cand[ci]);
          if (!isNaN(t) && Math.abs(t - Date.now()) < 26 * 3600000) return t;
        }
      } catch (e2) {}
      // last resort - but ONLY inside the genuine 8-10 AM ET matchday window.
      // The old "hour starts when this device first sees the round" replayed a
      // phantom broadcast (and slept the league table) on every fresh device
      // at any hour of the day. Outside the window, no anchor means no embargo.
      try {
        var hE = foETHour(new Date());
        if (hE != null && hE >= 8 && hE < 10) {
          var isoD = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
          var tE = Date.parse(isoD + "T09:00:00-04:00");
          if (!isNaN(tE)) { lsSet(foBcastKey(), JSON.stringify({ round: rd, t0: tE })); return tE; }
        }
      } catch (e3) {}
      return 0;
    }
    window.foEmbargo = function () {
      try {
        var rd = foLastRoundIx(); if (rd < 0) return { active: false };
        var t0 = foBcastT0(rd); if (!t0) return { active: false };
        var p = (Date.now() - t0) / (FO_BCAST_MIN * 60000);
        if (p >= 1) return { active: false, round: rd };
        // banked early by the resolver: hold every spoiler until 9:00 AM -
        // but only in the genuine pre-hour, never off a far-future anchor
        if (p < 0) {
          if (t0 - Date.now() > 90 * 60000) return { active: false, round: rd };
          return { active: true, round: rd, p: 0, endsAt: t0 + FO_BCAST_MIN * 60000, pre: true };
        }
        return { active: true, round: rd, p: p, endsAt: t0 + FO_BCAST_MIN * 60000 };
      } catch (e) { return { active: false }; }
    };
    // live position inside one saved match at broadcast fraction p
    function foLiveState(r, p) {
      var w0 = (r.worm && r.worm[0]) || [], w1 = (r.worm && r.worm[1]) || [];
      var tot = w0.length + w1.length; if (!tot) return null;
      var k = Math.max(1, Math.floor(p * tot));
      var innIx = k <= w0.length ? 0 : 1;
      var w = innIx ? w1 : w0;
      var j = Math.min(w.length - 1, (innIx ? k - w0.length : k) - 1);
      var pt = w[Math.max(0, j)] || [0, 0, 0];
      var inn = (r.innings || [])[innIx] || {};
      var overs = Math.floor(pt[0]) + "." + Math.round((pt[0] % 1) * 6);
      var first = (r.innings || [])[0] || {};
      return {
        innIx: innIx, ballK: k, totalBalls: tot,
        line: E(inn.batTeam || "") + " " + pt[1] + "/" + (pt[2] || 0) + " (" + overs + " ov)",
        chase: innIx === 1 ? "target " + (first.runs + 1) : null
      };
    }
    window.__foLive = { state: foLiveState, mask: function () { foMaskSpoilers(); } };
    // masked text for a result while its broadcast runs
    function foMaskLine(r, p) {
      var st = foLiveState(r, p);
      return st ? "LIVE &middot; " + st.line + (st.chase ? " &middot; " + st.chase : "") : "LIVE";
    }
    // ---- league live "so far" tabs: everything below is rebuilt ONLY from ----
    // what the broadcast has already shown - end-of-over summaries, the fall-
    // of-wicket stamps up to the current ball, and the worm to the same point.
    function foLgAbbr(full) {
      var ps = String(full || "").trim().split(/\s+/);
      return ps.length < 2 ? (full || "") : ps[0].charAt(0) + ". " + ps[ps.length - 1];
    }
    // oversum entries visible so far: [{inn, over, txt, pairs:[[name,fig]..]}]
    function foLgSums(chron, upto) {
      var out = [];
      for (var i = 0; i < Math.min(upto, chron.length); i++) {
        var L = chron[i];
        if (!L || !L.mile || !L.oversumTop) continue;
        var ovm = /End of over (\d+)/.exec(L.txt || "");
        var pairs = [], re = /<strong>([^<]+)<\/strong>\s*([^,<]+)/g, m2;
        while ((m2 = re.exec(L.oversumTop))) pairs.push([m2[1].trim(), m2[2].trim()]);
        out.push({ inn: L.inn || 0, over: ovm ? +ovm[1] : 0, txt: L.txt || "", pairs: pairs });
      }
      return out;
    }
    // over.ball of the last delivery the feed has shown (current innings)
    function foLgCurNo(chron, upto) {
      for (var i = Math.min(upto, chron.length) - 1; i >= 0; i--) {
        var L = chron[i];
        if (L && !L.mile && L.no) { var m2 = /^(\d+)\.(\d+)$/.exec(L.no); if (m2) return +m2[1] + (+m2[2]) / 10; }
      }
      return 0;
    }
    function foLgFowShown(r, innIx, curInnIx, curNo) {
      var fow = ((r.innings || [])[innIx] || {}).fow || [];
      if (innIx < curInnIx) return fow;                       // innings is done - all public
      return fow.filter(function (f) { return f && f.ov <= curNo + 0.001; });
    }
    // batters at the crease + bowler, from the latest end-of-over summary
    function foLgCrease(r, chron, upto, innIx, curNo) {
      try {
        var sums = foLgSums(chron, upto).filter(function (s) { return s.inn === innIx; });
        var last = sums[sums.length - 1]; if (!last) return "";
        var outNms = {};
        foLgFowShown(r, innIx, innIx, curNo).forEach(function (f) { if (f.ov > last.over) outNms[foLgAbbr(f.who)] = 1; });
        var cards = "";
        last.pairs.forEach(function (pr) {
          var bw = /^(\d+)-(\d+)-(\d+)$/.exec(pr[1]);
          if (bw) {
            cards += "<div class='fo-lv-pc'><span class='fo-lv-tag'>Bowling</span><b>" + E(pr[0].replace(/\s*\([^)]*\)\s*$/, "")) + "</b><span class='fo-lv-fig'><b>" + bw[3] + "/" + bw[2] + "</b> (" + bw[1] + " ov)</span></div>";
          } else {
            var bt = /^(\d+)\*?\s*\((\d+)b\)/.exec(pr[1]); if (!bt || outNms[pr[0]]) return;
            cards += "<div class='fo-lv-pc'><span class='fo-lv-tag'>At the crease</span><b>" + E(pr[0]) + "</b><span class='fo-lv-fig'><b>" + bt[1] + "*</b> (" + bt[2] + "b)</span></div>";
          }
        });
        return cards ? "<div class='fo-lv-cards'>" + cards + "</div>" : "";
      } catch (e) { return ""; }
    }
    // live scorecard: last-known figures per batter and bowler, innings by innings
    function foLgLiveScore(r, chron, upto, curInnIx, curNo) {
      try {
        var sums = foLgSums(chron, upto); if (!sums.length) return "";
        var html = "";
        for (var ii = 0; ii <= curInnIx; ii++) {
          var mine = sums.filter(function (s) { return s.inn === ii; });
          if (!mine.length) continue;
          var bat = {}, batOrd = [], bowl = {}, bowlOrd = [];
          mine.forEach(function (s) {
            s.pairs.forEach(function (pr) {
              var bw = /^(\d+)-(\d+)-(\d+)$/.exec(pr[1]);
              if (bw) { var bn = pr[0].replace(/\s*\([^)]*\)\s*$/, ""); if (!bowl[bn]) bowlOrd.push(bn); bowl[bn] = { o: bw[1], r: bw[2], w: bw[3] }; return; }
              var bt = /^(\d+)\*?\s*\((\d+)b\)/.exec(pr[1]);
              if (bt) { if (!bat[pr[0]]) batOrd.push(pr[0]); bat[pr[0]] = { r: bt[1], b: bt[2] }; }
            });
          });
          var inn = (r.innings || [])[ii] || {};
          var fowShown = foLgFowShown(r, ii, curInnIx, curNo);
          var outNms = {}; fowShown.forEach(function (f) { outNms[foLgAbbr(f.who)] = 1; });
          var atCrease = {};
          if (ii === curInnIx) {
            var lastS = mine[mine.length - 1];
            lastS.pairs.forEach(function (pr) { if (!/^\d+-\d+-\d+$/.test(pr[1]) && !outNms[pr[0]]) atCrease[pr[0]] = 1; });
          }
          var batRows = batOrd.map(function (n) {
            var x = bat[n];
            var st3 = atCrease[n] ? "<span style='color:#15803D;font-weight:700'>batting</span>" : (outNms[n] ? "out" : (ii < curInnIx ? "" : "out"));
            return "<tr><td><b>" + E(n) + "</b><div class='small'>" + st3 + "</div></td><td class='n'><b>" + x.r + (atCrease[n] ? "*" : "") + "</b></td><td class='n'>" + x.b + "</td><td class='n'>" + (x.b > 0 ? (100 * x.r / x.b).toFixed(1) : 0) + "</td></tr>";
          }).join("");
          var bowlRows = bowlOrd.map(function (n) {
            var x = bowl[n];
            return "<tr><td><b>" + E(n) + "</b></td><td class='n'>" + x.o + "</td><td class='n'>" + x.r + "</td><td class='n'>" + x.w + "</td><td class='n'>" + (x.o > 0 ? (x.r / x.o).toFixed(2) : 0) + "</td></tr>";
          }).join("");
          var fowLine = fowShown.length ? "<div class='small' style='margin-top:8px;color:#667085'>Fall of wickets: " + fowShown.map(function (f, k) {
            return (k + 1) + "-" + f.sc + " (" + E(f.who) + ", " + f.ov + ")";
          }).join(", ") + "</div>" : "";
          var head = ii < curInnIx
            ? (inn.runs != null ? inn.runs + (inn.wkts >= 10 ? " all out" : "/" + (inn.wkts || 0)) : "") + " <em>(innings closed)</em>"
            : "<em>after " + mine[mine.length - 1].over + " ov</em>";
          html += "<div class='panel fo-sci'><div class='fo-sci-head'><b>" + E(inn.batTeam || "") + "</b><span>" + head + "</span></div><div class='pad'>" +
            "<table class='fo-sct'><thead><tr><th>Batting</th><th class='n'>R</th><th class='n'>B</th><th class='n'>SR</th></tr></thead><tbody>" + batRows + "</tbody></table>" +
            "<table class='fo-sct' style='margin-top:12px'><thead><tr><th>Bowling</th><th class='n'>O</th><th class='n'>R</th><th class='n'>W</th><th class='n'>Econ</th></tr></thead><tbody>" + bowlRows + "</tbody></table>" +
            fowLine + "</div></div>";
        }
        return html ? html + "<div class='small' style='color:#667085;margin:2px 2px 10px'>Figures refresh at the end of each over &middot; the full card lands at stumps.</div>" : "";
      } catch (e) { return ""; }
    }
    // worm + manhattan clipped to the ball the broadcast has reached
    function foLgLiveCharts(r, st) {
      try {
        if (!st || typeof foMatchCharts !== "function") return "";
        var w = r.worm || [];
        var worms = w.map(function (arr, i) {
          if (!arr || i > st.innIx) return [];
          if (i < st.innIx) return arr;
          var k = st.ballK - (st.innIx ? (w[0] || []).length : 0);
          return arr.slice(0, Math.max(1, k));
        }).slice(0, st.innIx + 1);
        if (!worms[0] || !worms[0].length) return "";
        var all = (r.innings || []).slice(0, st.innIx + 1).map(function (inn) { return { batTeam: (inn && inn.batTeam) || "" }; });
        return foMatchCharts(all, worms);
      } catch (e) { return ""; }
    }
    // hide every spoiler on the page: result strings swap for live scores,
    // standings close until stumps
    function foMaskSpoilers() {
      try {
        var em = foEmbargo(); if (!em.active) return;
        var page = document.getElementById("page"); if (!page) return;
        var rows = foLeagueRounds()[em.round] || [];
        var swap = function (needle, maskHtml) {
          if (!needle) return;
          // deepest elements that contain the text; children allowed (links etc.)
          var cands = Array.prototype.slice.call(page.querySelectorAll("td, span, b, div, li, a")).filter(function (el) {
            if ((el.textContent || "").indexOf(needle) < 0) return false;
            return !Array.prototype.some.call(el.children, function (c) { return (c.textContent || "").indexOf(needle) >= 0; });
          });
          cands.forEach(function (el) {
            if (el.__foMasked === needle) return;
            el.innerHTML = el.innerHTML.split(E(needle)).join(maskHtml).split(needle).join(maskHtml);
            el.__foMasked = needle;
          });
        };
        rows.forEach(function (r) {
          swap((r.result && r.result.text) || "", "<span class='fo-live-mask'>" + (em.pre ? "Play begins 9:00 AM ET" : foMaskLine(r, em.p)) + "</span>");
          swap((r.result && r.result.mom) || "", "to be named at stumps");
        });
        // fixtures & results: the round on air keeps its secret until stumps
        try {
          var embTexts = [];
          (App.results || []).forEach(function (r0) {
            if (r0 && r0.comp === "league" && r0.round === em.round && r0.result && r0.result.text) embTexts.push(r0.result.text);
          });
          if (embTexts.length) page.querySelectorAll("td").forEach(function (td) {
            if (td.__foEmbMask) return;
            var tx = (td.textContent || "").trim(); if (!tx) return;
            for (var i2 = 0; i2 < embTexts.length; i2++) {
              if (tx.indexOf(embTexts[i2]) >= 0 && tx.length <= embTexts[i2].length + 40) {
                td.__foEmbMask = 1;
                td.innerHTML = "<span class='fo-emb-cell'>&#128308; " + (em.pre ? "plays at 9:00 AM ET" : "in play &middot; live now") + "</span>";
                break;
              }
            }
          });
        } catch (eMk) {}
        // the table stays READABLE during the hour: rewind it to how it stood
        // before the round on air (the banked round's points come off, NRR
        // waits for stumps), instead of hiding the whole thing
        var adj = {};
        rows.forEach(function (r0) {
          if (!r0 || !r0.result || !r0.result.text) return;
          var tx0 = r0.result.text;
          var mk = function (nm, w2, l2, t2, pts2) { adj[nm] = { p: 1, w: w2, l: l2, t: t2, pts: pts2 }; };
          if (tx0.indexOf(r0.home) === 0) { mk(r0.home, 1, 0, 0, 2); mk(r0.away, 0, 1, 0, 0); }
          else if (tx0.indexOf(r0.away) === 0) { mk(r0.away, 1, 0, 0, 2); mk(r0.home, 0, 1, 0, 0); }
          else { mk(r0.home, 0, 0, 1, 1); mk(r0.away, 0, 0, 1, 1); }
        });
        var namesT = (typeof GD !== "undefined" && GD.teams ? GD.teams : []).map(function (t2) { return t2 && t2.name; }).filter(Boolean);
        page.querySelectorAll(".panel, .fo-card").forEach(function (pn) {
          var h = pn.querySelector("h4, .fo-card-h2"); if (!h) return;
          if (!/league table|league standings/i.test(h.textContent || "")) return;
          var tbl = pn.querySelector("table"); if (!tbl || tbl.__foRewind) return;
          var ths = Array.prototype.slice.call(tbl.querySelectorAll("th")).map(function (x) { return (x.textContent || "").trim().toUpperCase(); });
          var ci = { P: ths.indexOf("P"), W: ths.indexOf("W"), L: ths.indexOf("L"), T: ths.indexOf("T"), NRR: ths.indexOf("NRR"), PTS: ths.indexOf("PTS") };
          if (ci.P < 0 || ci.PTS < 0) return;   // unknown shape: leave it alone
          tbl.__foRewind = 1;
          var tbody = tbl.tBodies[0] || tbl;
          var trs = Array.prototype.slice.call(tbody.querySelectorAll("tr")).filter(function (tr) { return tr.querySelector("td"); });
          trs.forEach(function (tr) {
            var tds = tr.querySelectorAll("td");
            var rowTx = tr.textContent || "", nm = null;
            for (var j = 0; j < namesT.length; j++) if (rowTx.indexOf(namesT[j]) >= 0 && (!nm || namesT[j].length > nm.length)) nm = namesT[j];
            var a2 = nm && adj[nm]; if (!a2) return;
            var dec = function (ix2, d2) {
              if (ix2 < 0 || !tds[ix2] || !d2) return;
              var v = parseInt(tds[ix2].textContent, 10);
              if (!isNaN(v)) tds[ix2].textContent = String(Math.max(0, v - d2));
            };
            dec(ci.P, a2.p); dec(ci.W, a2.w); dec(ci.L, a2.l); dec(ci.T, a2.t); dec(ci.PTS, a2.pts);
            if (ci.NRR >= 0 && tds[ci.NRR]) tds[ci.NRR].innerHTML = "<span style='color:#98a2b3'>&ndash;</span>";
          });
          // order by the rewound points (stable), then renumber plain position cells
          trs.map(function (tr, i2) {
            var v = parseInt(((tr.querySelectorAll("td")[ci.PTS]) || {}).textContent, 10);
            return { tr: tr, pts: isNaN(v) ? -1 : v, i: i2 };
          }).sort(function (a3, b3) { return (b3.pts - a3.pts) || (a3.i - b3.i); })
            .forEach(function (x2, k2) {
              tbody.appendChild(x2.tr);
              var c0 = x2.tr.querySelector("td");
              if (c0 && /^\d*$/.test((c0.textContent || "").trim())) c0.textContent = String(k2 + 1);
            });
          if (!pn.querySelector(".fo-live-sleep")) {
            var note2 = document.createElement("div");
            note2.className = "fo-live-sleep";
            note2.innerHTML = "&#128308; Round on air &middot; the table shows the standings before today's round. Final positions and NRR land at stumps &middot; " +
              new Date(em.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".";
            tbl.parentNode.insertBefore(note2, tbl);
          }
        });
      } catch (e) {}
    }
    // scorecard of an embargoed match becomes the live broadcast view
    if (typeof window.pgScorecard === "function" && !window.pgScorecard.__foBcast) {
      var _pscB = window.pgScorecard;
      window.pgScorecard = function (q) {
        try {
          var em = foEmbargo();
          if (em.active && q && q.i !== undefined && App.results[+q.i] && App.results[+q.i].comp === "league" && App.results[+q.i].round === em.round) {
            var r = App.results[+q.i];
            if (em.pre) {
              var pv = ""; try { pv = foMatchPreviewHTML(r, em.round); } catch (ePv) {}
              document.getElementById("page").innerHTML =
                "<div class='crumb'>" + foClubLink(r.home) + " v " + foClubLink(r.away) + " &raquo; Matchday</div>" +
                "<div class='fo-live-hero'><div class='fo-live-tag'>MATCHDAY &middot; LEAGUE &middot; ROUND " + (em.round + 1) + " &middot; 9:00 AM ET</div>" +
                "<div class='fo-live-score fo-live-vs'>" + E(r.home) + " v " + E(r.away) + "</div>" +
                "<div class='fo-live-sub'>" + E(r.ground || "") + (r.pitch ? " &middot; " + foPitchName(r.pitch) + " pitch" : "") + (r.weather ? " &middot; " + E(r.weather) : "") + " &middot; play begins on the hour, ball by ball</div></div>" + pv;
              return;
            }
            var st = foLiveState(r, em.p);
            var log = (r.log || []).slice().reverse();   // chronological
            var upto = Math.max(2, Math.floor(em.p * log.length));
            var vis = log.slice(0, upto).reverse();      // newest first again
            var l6 = ""; try { l6 = foLast6HTML(log, upto); } catch (eL6) {}
            var innIxL = st ? st.innIx : 0;
            var curNoL = 0; try { curNoL = foLgCurNo(log, upto); } catch (eNo) {}
            var creaseL = ""; try { creaseL = foLgCrease(r, log, upto, innIxL, curNoL); } catch (eCr) {}
            var tabL = window.__foLgLTab || "feed";
            var cfL = window.__foLgLCF || "all";
            var barL = "<div class='fo-sctabs'>" + [["feed", "Live feed"], ["score", "Scorecard"], ["charts", "Charts"], ["ratings", "Match ratings"]].map(function (t2) {
              return "<button class='fo-sctab fo-lgltab" + (tabL === t2[0] ? " on" : "") + "' data-t='" + t2[0] + "'>" + t2[1] + "</button>";
            }).join("") + "</div>";
            var bodyL = "";
            if (tabL === "score") {
              try { bodyL = foLgLiveScore(r, log, upto, innIxL, curNoL); } catch (eSc) {}
              if (!bodyL) bodyL = "<div class='panel'><div class='pad small'>The live scorecard builds as play unfolds &middot; the full card lands at stumps.</div></div>";
            } else if (tabL === "charts") {
              var chL = ""; try { chL = foLgLiveCharts(r, st); } catch (eCh) {}
              bodyL = chL ? "<div class='panel'><h4>Charts &middot; so far</h4><div class='pad'>" + chL + "</div></div>" : "<div class='panel'><div class='pad small'>Charts build as play unfolds &middot; the full set lands at stumps.</div></div>";
            } else if (tabL === "ratings") {
              bodyL = "<div class='panel'><div class='pad small'>Match ratings are compiled at stumps &middot; they land with the final scorecard.</div></div>";
            } else {
              var cfBarL = "<div class='fo-cfilters'>" + [["all", "All"], ["wickets", "Wickets"], ["boundaries", "Boundaries"], ["fielding", "Fielding"], ["talents", "Talents"], ["highlights", "Highlights"]].map(function (ff) {
                return "<button class='fo-sctab fo-lglcf" + (cfL === ff[0] ? " on" : "") + "' data-f='" + ff[0] + "'>" + ff[1] + "</button>";
              }).join("") + "</div>";
              bodyL = "<div class='panel'><h4>Ball-by-ball</h4><div class='pad'>" + cfBarL + "<div id='ftpcomm' class='ftpskin'>" +
                (typeof ftpCommHTML === "function" ? ftpCommHTML(vis, cfL, 5000) : "") + "</div></div></div>";
            }
            document.getElementById("page").innerHTML =
              "<div class='crumb'>" + foClubLink(r.home) + " v " + foClubLink(r.away) + " &raquo; Live</div>" +
              "<div class='fo-live-hero'><div class='fo-live-tag'><span class='live-dot'></span> LIVE &middot; LEAGUE &middot; ROUND " + (em.round + 1) + "</div>" +
              "<div class='fo-live-score'>" + (st ? st.line : "") + (st && st.chase ? " <span class='fo-live-chase'>" + st.chase + "</span>" : "") + "</div>" +
              "<div class='fo-live-sub'>" + E(r.ground || "") + (r.pitch ? " &middot; " + foPitchName(r.pitch) + " pitch" : "") + (r.weather ? " &middot; " + E(r.weather) : "") + " &middot; full card and ratings at stumps</div>" + l6 +
              "<div class='fo-live-watch' id='fo-watchers'></div></div>" +
              creaseL + barL + bodyL;
            try { foWatchPing("lg-s" + (App.seasonNo || 1) + "-r" + em.round + "-" + q.i); } catch (eWp) {}
            return;
          }
        } catch (e) {}
        return _pscB.apply(this, arguments);
      };
      window.pgScorecard.__foBcast = 1;
    }
    // league live tabs + commentary filters redraw the broadcast in place
    document.addEventListener("click", function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest(".fo-lgltab,.fo-lglcf") : null;
      if (!b) return;
      ev.preventDefault();
      if (b.classList.contains("fo-lglcf")) window.__foLgLCF = b.getAttribute("data-f");
      else window.__foLgLTab = b.getAttribute("data-t");
      if (/^#\/scorecard/.test(location.hash || "") && typeof window.route === "function") window.route();
    });
    // the matchday page leads with the live scoreboard during the hour
    window.foLiveBoardHTML = function () {
      var em = foEmbargo(); if (!em.active) return "";
      var rows = foLeagueRounds()[em.round] || [];
      var mins = Math.max(1, Math.round((em.endsAt - Date.now()) / 60000));
      return "<div class='panel fo-keep'><h4><span class='live-dot'></span> " + (em.pre ? "Matchday &middot; play begins 9:00 AM ET" : "Matchday live &middot; stumps in ~" + mins + " min") + "</h4><div class='pad'>" +
        rows.map(function (r) {
          return "<div class='fo-live-row'><b>" + E(r.home) + " v " + E(r.away) + "</b>" +
            "<span>" + (em.pre ? "at the toss" : foMaskLine(r, em.p)) + "</span>" +
            "<a href='#/scorecard?i=" + r.ix + "'>Watch &rsaquo;</a></div>";
        }).join("") +
        "<div class='small' style='margin-top:8px;color:#667085'>Every ground plays at once. Results, tables and awards land at stumps.</div></div></div>";
    };
    // stamp broadcast start when a round resolves locally (solo path)
    if (typeof window.completeRound === "function" && !window.completeRound.__foBcast) {
      var _crB = window.completeRound;
      window.completeRound = function () {
        var out = _crB.apply(this, arguments);
        try { lsSet(foBcastKey(), JSON.stringify({ round: foLastRoundIx(), t0: Date.now() })); } catch (e) {}
        return out;
      };
      window.completeRound.__foBcast = 1;
    }
    // live pill in the nav: pinned first, added the moment a broadcast is on
    function foBcastPill() {
      var em = foEmbargo();
      // a live challenge friendly lights the pill too
      var frLive = null;
      try {
        (((typeof FO_BELL !== "undefined" && FO_BELL.rows && FO_BELL.rows.length) ? FO_BELL.rows : window.__foFrRows) || []).forEach(function (c) {
          if (frLive || !c) return;
          if ((c.status === "accepted" || c.status === "played") && typeof foFrBcastState === "function" && foFrBcastState(c).phase === "live") frLive = c;
        });
        if (!frLive) { var pc2 = foPracBc(); if (pc2 && foFrBcastState(pc2).phase === "live") frLive = pc2; }
      } catch (eF) {}
      var go = null;
      if (em.active) {
        // deep-link MY game in the live round; the board is never the target
        go = "#/matchday";
        try {
          var meP = userTeam().name;
          var rowsP = foLeagueRounds()[em.round] || [];
          var mineP = null;
          rowsP.forEach(function (r0) { if (!mineP && r0 && (r0.home === meP || r0.away === meP)) mineP = r0; });
          if (!mineP) mineP = rowsP[0];
          if (mineP && mineP.ix != null) go = "#/scorecard?i=" + mineP.ix;
        } catch (eMe) {}
      } else if (frLive) go = "#/friendly?id=" + frLive.id;
      // remember the broadcast window: end times are fixed, so on the next
      // page load the pill can paint instantly instead of waiting for the
      // first data fetch. Sanity-capped: a cache entry can never outlive a
      // real broadcast, and a stale matchday target is discarded.
      try {
        if (go) {
          var until = em.active ? em.endsAt : foFrBcastState(frLive).endsAt;
          if (until > Date.now() + 2 * 3600000) until = Date.now() + 2 * 3600000;
          lsSet("fol_livepill", JSON.stringify({ go: go, until: until }));
        } else {
          var cch = JSON.parse(lsGet("fol_livepill") || "null");
          var okC = cch && cch.until > Date.now() && cch.until - Date.now() < 2 * 3600000 && cch.go && cch.go !== "#/matchday";
          if (okC) go = cch.go;
          else if (cch) lsSet("fol_livepill", "null");
        }
      } catch (eC) {}
      var tb = document.getElementById("topbar");
      var wrap = tb && tb.querySelector(".fo-nav-scroll");
      var pill = wrap && wrap.querySelector("a.fo-bcast");
      if (go && wrap && !pill) {
        var a = document.createElement("a"); a.className = "fo-bcast"; a.innerHTML = "<span class='fo-bcast-dot'></span>Live";
        a.href = "#";
        a.addEventListener("click", function (ev) { ev.preventDefault(); location.hash = a.getAttribute("data-go") || "#/matchday"; if (typeof window.route === "function") window.route(); });
        wrap.insertBefore(a, wrap.firstChild);
        pill = a;
      } else if (!go && pill) pill.remove();
      if (pill && go) pill.setAttribute("data-go", go);
      return em;
    }
    [120, 400, 700, 1500].forEach(function (ms) { setTimeout(function () { try { foBcastPill(); } catch (e) {} }, ms); });
    // a slow tick keeps live surfaces fresh
    setInterval(function () {
      try {
        var em = foBcastPill();
        if (em.active) {
          foMaskSpoilers();
          var h = location.hash || "";
          if (/^#\/(scorecard|matchday)/.test(h) && typeof window.route === "function") {
            if (!window.__foBcastLast || Date.now() - window.__foBcastLast > 20000) { window.__foBcastLast = Date.now(); window.route(); }
          }
        }
      } catch (e) {}
    }, 6000);
    if (typeof window.route === "function" && !window.route.__foBcast) {
      var _rtB = window.route;
      window.route = function () {
        var r2 = _rtB.apply(this, arguments);
        try { foMaskSpoilers(); foBcastPill(); } catch (e) {}
        setTimeout(function () { foMaskSpoilers(); try { foBcastPill(); } catch (e) {} }, 220); setTimeout(foMaskSpoilers, 900);   // pages paint async
        return r2;
      };
      window.route.__foBcast = 1;
    }
    var bcs = document.createElement("style");
    bcs.textContent =
      ".fo-live-mask{color:#DC2626;font-weight:800}" +
      ".fo-cfilters{display:flex;gap:6px;overflow-x:auto;margin:0 0 10px;padding-bottom:4px;scrollbar-width:none}.fo-cfilters::-webkit-scrollbar{display:none}" +
      ".fo-live-sleep{padding:14px 4px;font-size:13px;color:#667085}" +
      ".fo-live-hero{background:linear-gradient(135deg,#0E233F,#07162E 62%);border-radius:16px;padding:20px 22px;margin:8px 0 14px;color:#c7cfda}" +
      ".fo-live-tag{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#ff8a7a;display:flex;align-items:center;gap:7px}" +
      ".fo-live-score{font-size:26px;font-weight:800;color:#fff;margin:8px 0 4px;letter-spacing:-.3px}" +
      ".fo-live-chase{font-size:14px;color:#E8C77A;font-weight:700}" +
      ".fo-live-sub{font-size:12px;color:#93a0b4}" +
      ".fo-live-watch{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:#93a0b4;flex-wrap:wrap}" +
      ".fo-live-watch:empty{display:none}.fo-live-watch b{color:#fff}" +
      ".fo-watch-past{color:#69758a}" +
      "#page .crumb a.fo-crumb-club{color:inherit;text-decoration:underline;text-decoration-color:rgba(28,36,51,.25);text-underline-offset:3px}" +
      "#page .crumb a.fo-crumb-club:hover{color:#C95532}" +
      ".fo-live-row{display:flex;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px solid #f0ece1;font-size:13px}" +
      ".fo-live-row b{flex:1;color:#111827}.fo-live-row span{color:#DC2626;font-weight:700}" +
      "html body #topbar a.fo-bcast{display:inline-flex;align-items:center;gap:7px;background:#FF0000 !important;border:1px solid #FF0000 !important;color:#fff !important;border-radius:999px !important;padding:5px 13px !important;margin:0 12px 0 2px !important;align-self:center;font-weight:700;font-size:12.5px;letter-spacing:.02em;animation:none;box-shadow:none !important;text-decoration:none !important}" +
      "html body #topbar a.fo-bcast:hover{background:#D90000 !important;border-color:#D90000 !important;color:#fff !important}" +
      ".fo-bcast-dot{width:7px;height:7px;border-radius:99px;background:#fff;flex:0 0 auto;animation:foBcastBlink 1.6s ease-in-out infinite}" +
      "@keyframes foBcastBlink{0%,100%{opacity:1}50%{opacity:.35}}" +
      "@media(max-width:820px){html body #topbar a.fo-bcast{position:sticky;left:0;z-index:6}}" +
      ".fo-live-row a{font-weight:700;padding:4px 0 4px 8px;white-space:nowrap}" +
      "@media(max-width:640px){.fo-live-row{display:grid;grid-template-columns:1fr auto;align-items:baseline;gap:1px 10px}.fo-live-row b{grid-column:1/-1}}";
    document.head.appendChild(bcs);
    window.__foBcastTest = function (minsAgo) { lsSet(foBcastKey(), JSON.stringify({ round: foLastRoundIx(), t0: Date.now() - minsAgo * 60000 })); };
  })(); } catch (e) { console.warn("matchday theatre", e); }

  // ==========================================================================
  //  THE CIRCUIT - the solo world tour. Six cricketing nations, each a master
  //  of one real-life skill; 2 minor clubs + a boss per nation, one 50-over
  //  match each on THEIR conditions via the friendly plumbing. Beat the boss
  //  to conquer the nation: trophy to the museum, prize money to the bank,
  //  and that nation's youth academy opens for good (better scout odds).
  //  Strict linear ladder. Progress is per-manager, on device.
  // ==========================================================================
  var FO_CX_REGIONS = [
    { id: "eng", nm: "England", cty: "England", arch: "rock", type: "Swing & Graft", ac: "#2E7A3C", arrive: "England, boss. Old pavilions, older opinions. They'll call our cricket reckless until it works - and improper after it does.",
      pitch: "green", wx: "Overcast",
      cond: "Green, overcast seamers. The ball talks all day; patient, correct cricket wins.",
      gaffer: "Cloud cover and a green top. Leave well, bat time, and let their grafters die of boredom before you cash in.",
      academy: "technically-correct batsmen and swing bowlers",
      trophy: "The Ashes Urn", nats: ["England", "Ireland"],
      clubs: [
        { mx: 61, my: 55, nm: "Tyke County CC", city: "Leeds", note: "dour opening pair", gq: "Tyke County? Dour Yorkshiremen who bat till you beg. Bore 'em out — patience, not fireworks.", taunt: "Come up to Leeds if you fancy it. We'll still be batting come Thursday.", nug: "Leeds: cloud rolls off the moors and the ball talks all morning. Their openers bat until tea and nothing is given away. But they only have one gear - keep wickets in hand and they run out of tricks.", mult: 0.84 },
        { mx: 72, my: 79.5, nm: "The Southern Shires", city: "Canterbury", note: "gritty county pros", gq: "Southern Shires nick your singles all day. Run hard, or they squeeze the life out of you.", taunt: "We don't give away singles, and we don't give away home games.", nug: "Canterbury: old trees, older pros. Deep, stubborn batting and nagging medium pace that never misses its line. Quick singles rattle them - they set fields for maidens, not for hustle.", mult: 0.90 },
        { boss: 1, mx: 64.5, my: 74.5, nm: "Marylebone Old Guard", city: "London", capt: "master",
          leader: "Sir Giles Pemberley", note: "bats time and never, ever gives it away", gq: "Pemberley bats time, not runs. Strand him — starve the other end and he cracks.", taunt: "I've batted through better sides than yours, lad. Twice.", nug: "London: the long room hushes when Pemberley walks out - he bats TIME, not runs. Force the pace at the other end; his partners panic long before he does.", mult: 0.97 }
      ] },
    { id: "win", nm: "West Indies", cty: "West Indies", arch: "finisher", type: "Power & Flair", ac: "#B5892F", arrive: "Smell that? Salt and woodsmoke. Out here they play like the game owes them a good time. Don't blink in the field.",
      pitch: "flat", wx: "Hot",
      cond: "True, sun-baked deck and a lightning outfield. Big hitting, big grins, big totals.",
      gaffer: "They swing hard and field harder. Choke the boundaries, take pace off, and make the showmen play the boring ball.",
      academy: "power-hitters and big-hitting all-rounders",
      trophy: "The Caribbean Crown", nats: ["West Indies"],
      clubs: [
        { mx: 89.5, my: 56.5, nm: "Windward Kings", city: "Bridgetown", note: "clean ball-strikers", gq: "Windward Kings swing from ball one. Two early wickets and the party's over.", taunt: "First over, first six. Sit back and enjoy the show.", nug: "Bridgetown: sea breeze, lightning outfield, and openers who hit through the line from ball one. When it swings early they fall over - two quick wickets turn the party quiet.", mult: 0.88 },
        { mx: 26.5, my: 46.5, nm: "Sugar City CC", city: "Kingston", note: "carnival hitters", gq: "Sugar City live for the death. Choke the first fifteen and the drums go quiet.", taunt: "We finish strong. Hope you've a total worth defending.", nug: "Kingston: the drums start when the sixes do, and late in the innings nobody clears a rope like them. Strangle the first fifteen overs and the carnival never gets going.", mult: 0.94 },
        { boss: 1, mx: 87, my: 79.5, nm: "The Calypso Titans", city: "Port of Spain", capt: "talisman",
          leader: "King Emmanuel", note: "can win a match in ten overs flat", gq: "King Emmanuel wins games in ten overs, laughing. Get ahead early — that's when kings gamble.", taunt: "Ten overs is all I need. Ask anyone who's tried to stop me.", nug: "Port of Spain: King Emmanuel can win a match in ten overs - he's done it, twice, laughing. Get ahead of the rate early and he gambles; that's when kings fall.", mult: 1.01 }
      ] },
    { id: "rsa", nm: "South Africa", cty: "South Africa", arch: "express", type: "Express Pace", ac: "#B23A2E", arrive: "Thin air, hard light, harder cricket. Everything here comes at you a yard quicker than you'd like. Chin up. Literally.",
      pitch: "green", wx: "Windy",
      cond: "Green, bouncy and quick. Survive the new ball or perish - and their cordon drops nothing.",
      gaffer: "Raw pace, short stuff, catchers everywhere. See off the first ten, protect the tail, and cash in when the quicks tire.",
      academy: "express fast bowlers and gun fielders",
      trophy: "The Protea Shield", nats: ["South Africa", "Zimbabwe"],
      clubs: [
        { mx: 45, my: 46, nm: "Highveld Reef", city: "Johannesburg", note: "hostile quicks", gq: "Highveld quicks fly in the thin air. Their spin's an afterthought — cash in the middle.", taunt: "Thin air, quick deck. Keep your eyes on the ball, or your teeth.", nug: "Johannesburg: thin air on the Highveld - the ball flies, and so do their quicks. Their spin is an afterthought: see the shine off and the middle overs are yours.", mult: 0.92 },
        { mx: 36, my: 67, nm: "Cape Storm CC", city: "Cape Town", note: "gully-cordon hawks", gq: "Cape Storm catch everything that moves. Make 'em chase, then dig in.", taunt: "Edge it and it sticks. We don't put those down.", nug: "Cape Town: the wind howls in from the sea and their cordon catches everything that moves. Their batting is thinner than their bowling - make them chase, and dig in.", mult: 0.98 },
        { boss: 1, mx: 53, my: 57, nm: "The Veldt Fire", city: "Durban", capt: "ironman",
          leader: "Morné Steenkamp", note: "bowls thunderbolts and sets attacking fields", gq: "Steenkamp under lights is the quickest out here. Ride two spells — then he's mortal.", taunt: "Two spells under lights and you'll be walking back before you've settled in.", nug: "Durban: Steenkamp with a new ball under lights is the fastest thing on the Circuit. Survive his first two spells and the sting fades - the support cast is mortal.", mult: 1.05 }
      ] },
    { id: "aus", nm: "Australia", cty: "Australia", arch: "blade", type: "Flat-Track Runs", ac: "#D08A12", arrive: "Australia. The grounds are bigger, the crowds are louder, and the papers already hate us. Perfect. Let's ruin their week.",
      pitch: "flat", wx: "Scorching",
      cond: "Flat, hard and true. Run-mountains on a road - you'll chase or defend a monster.",
      gaffer: "Roads, son. Nothing in the pitch for anyone - it's your bat against theirs. Pack the top order and don't lose the toss.",
      academy: "aggressive, high-strike-rate top-order batsmen",
      trophy: "The Golden Bat", nats: ["Australia"],
      clubs: [
        { mx: 14.5, my: 49, nm: "Goldfields CC", city: "Perth", note: "hard-running openers", gq: "Goldfields run everything twice. Short and straight — make 'em earn it.", taunt: "We run everything twice. You'll be blowing by the tenth over.", nug: "Perth: real bounce and openers who run everything twice. They live on the front foot - short, straight and disciplined seam makes them sweat.", mult: 0.96 },
        { mx: 32, my: 42, nm: "Outback Rovers", city: "Alice Springs", note: "relentless run-scorers", gq: "Rovers pile it on in the heat. Dry up the rope, let the desert do the work.", taunt: "Forty degrees and we bat all day. Your move.", nug: "Alice Springs: a road in the red centre - they grind out mountains of runs in the heat. Patience beats them: dry up the boundaries and the desert does the rest.", mult: 1.02 },
        { boss: 1, mx: 45.5, my: 61.5, nm: "The Sunburnt XI", city: "Melbourne", capt: "general",
          leader: "Doug Cazaly", note: "a merciless run-machine who bats you out of the game", gq: "Cazaly bats like he owns the 'G. His bowlers are ordinary — out-bat him, if you've the nerve.", taunt: "I'll bat you clean out of the contest. Bring a bigger total than that.", nug: "Melbourne: ninety thousand seats and Cazaly bats like he owns every one of them. His bowlers are ordinary once the shine goes - out-bat him, if you dare.", mult: 1.09 }
      ] },
    { id: "nzl", nm: "New Zealand", cty: "New Zealand", arch: "gloveman", type: "Safe Hands", ac: "#0E9E97", arrive: "Wind off the strait and not a superstar in sight. Don't let that fool you - these sides beat you eleven-on-one. Team against team.",
      pitch: "balanced", wx: "Chilly",
      cond: "Fair, breezy, even bounce. Nothing lavish - ruthless discipline and nothing hits the grass.",
      gaffer: "No freebies here. They squeeze every run and drop nothing. Run hard, rotate strike, and out-hit a modest attack.",
      academy: "keeper-batsmen and disciplined seam bowlers",
      trophy: "The Safe Hands Cup", nats: ["New Zealand"],
      clubs: [
        { mx: 33, my: 53, nm: "Kauri Coast CC", city: "Christchurch", note: "tidy medium-pacers", gq: "Kauri Coast: straight lines, no drops. No mystery — just outscore the discipline.", taunt: "No tricks here. Just better than you, over after over.", nug: "Christchurch: tidy seamers, straight lines, and not a single dropped catch all season. There's no mystery to solve - just more discipline than you. Outscore it.", mult: 1.00 },
        { mx: 48, my: 38, nm: "Southern Cross XI", city: "Wellington", note: "canny keeper-bats", gq: "Southern Cross read the gale like sailors. Genuine pace hurries them — bend your backs.", taunt: "The wind belongs to us. Good luck reading it.", nug: "Wellington: they read the gale like sailors and their keeper-bats steal runs you didn't know existed. Genuine pace hurries them - bend your backs.", mult: 1.06 },
        { boss: 1, mx: 48, my: 19.5, nm: "The Longwhite XI", city: "Auckland", capt: "clutch",
          leader: "Kane Whitcombe", note: "never drops a chance, never gives an inch", gq: "Whitcombe hasn't shelled a catch in four years. Post a real total and squeeze — they won't crack first.", taunt: "We don't crack first. We never have.", nug: "Auckland: Whitcombe hasn't dropped a chance in four seasons. Nothing loose, nothing scary - set a real total and squeeze, because they will not crack first.", mult: 1.12 }
      ] },
    { id: "sub", nm: "The Subcontinent", cty: "India", arch: "wizard", type: "Spin Web", ac: "#7B45C4", arrive: "Feel the crowd before you see the ground. A hundred thousand opinions, all about us. Spin, dust and expectation, boss - the final exam.",
      pitch: "dry", wx: "Humid",
      cond: "Dry, dusty, sharp turn from over one. The ball grips, rips, and reads your footwork.",
      gaffer: "The final exam. Sweep hard, use your feet, and pick the wrong'un early - because out here the pitch is on their side.",
      academy: "spinners and wristy, spin-savvy batsmen",
      trophy: "The Spin Web Trophy", nats: ["India", "Pakistan", "Sri Lanka", "Afghanistan"],
      clubs: [
        { mx: 46, my: 88, nm: "Monsoon CC", city: "Colombo", note: "flighted off-spin", gq: "Monsoon flight it and let it dip. Bowl full, attack before it grips.", taunt: "Flight, dip, a puff of dust. Watch your feet, friend.", nug: "Colombo: heat, flight and off-spin that dips late. They're a different side when the ball seams - pray for cloud, bowl full, and attack before it grips.", mult: 1.04 },
        { mx: 26, my: 55, nm: "The Maidan Kings", city: "Mumbai", note: "wristy mystery-spin", gq: "Maidan wristmen spin webs from dust. Sweep hard, use your feet — early.", taunt: "You can't sweep what you can't pick.", nug: "Mumbai: wristy magicians raised on maidan dust bowls. Sweep hard and use your feet early - once the pitch bites, the web is spun.", mult: 1.10 },
        { boss: 1, mx: 27, my: 19, nm: "The Dust Devils", city: "Lahore", capt: "talisman",
          leader: "Vikram Anand", note: "bowls six different balls an over", gq: "Anand bowls six different balls an over and reads your feet. Duel him on your terms; cash in at the other.", taunt: "Six different balls an over. Guess which one has your name on it.", nug: "Lahore: Anand bowls six different balls an over and reads your feet like a newspaper. His quicks are ordinary - cash in at the other end and duel him on YOUR terms.", mult: 1.18 }
      ] }
  ];
  function foCxRegionByIx(ri) { return FO_CX_REGIONS[ri] || null; }
  // nations whose youth academies you've unlocked by conquering their region
  function foCxAcademyNats() {
    var st = foCxState(), out = [];
    FO_CX_REGIONS.forEach(function (r) { if ((st.conq || []).indexOf(r.id) >= 0) out = out.concat(r.nats || []); });
    return out;
  }
  function foCxKey() { return "fo_cx_" + ((SYNC && SYNC.myMid) || "solo"); }
  function foCxState() {
    try { var st = JSON.parse(lsGet(foCxKey()) || "null"); if (st && st.beat) return st; } catch (e) {}
    return { beat: {}, conq: [] };
  }
  function foCxSave(st) { try { lsSet(foCxKey(), JSON.stringify(st)); } catch (e) {} }
  function foCxConquered(st, id) { return (st.conq || []).indexOf(id) >= 0; }
  // strict linear ladder: the first unconquered region is the live one
  function foCxCurrent(st) {
    for (var i = 0; i < FO_CX_REGIONS.length; i++) if (!foCxConquered(st, FO_CX_REGIONS[i].id)) return i;
    return FO_CX_REGIONS.length;   // world tour complete
  }
  function foCxBeaten(st, rid, ci) { return !!((st.beat[rid] || [])[ci]); }
  // within a region the clubs unlock in order; the boss needs both minors
  function foCxClubOpen(st, ri, ci) {
    if (foCxConquered(st, FO_CX_REGIONS[ri].id)) return false;   // nothing left to play there
    var rid = FO_CX_REGIONS[ri].id;
    for (var i = 0; i < ci; i++) if (!foCxBeaten(st, rid, i)) return false;
    return true;
  }
  function foCxPrize(ri, boss) { return boss ? (35000 + ri * 10000) : (12000 + ri * 4000); }
  // Build the club's squad: the archetype generator on THEIR nation's names,
  // then one honest difficulty dial - every skill scaled by the club's mult.
  function foCxTeam(ri, ci) {
    var r = FO_CX_REGIONS[ri], c = r.clubs[ci];
    var gen = foGenArchetypeSquad("cx|" + r.id + "|" + c.nm, r.cty, r.arch, c.capt || "talisman");
    var players = (gen.players || []).map(function (p0) {
      var p = JSON.parse(JSON.stringify(p0)); delete p.fee;
      for (var k in (p.skills || {})) {
        if (typeof p.skills[k] === "number") p.skills[k] = Math.max(4, Math.min(96, Math.round(p.skills[k] * c.mult)));
      }
      p.fatigue = "rested"; p.formIx = 3;
      try { jsDerive(p); } catch (e) {}
      return p;
    });
    // ---- England, a living chapter: the world reads your scorecards --------
    try {
      var stE = foCxState();
      if (r.id === "eng" && ci === 1) {
        // Southern Shires saw the Tyke scorecard - they pick for what beat it
        var t0 = (stE.hist || []).filter(function (h) { return h.rid === "eng" && h.ci === 0 && h.win; })[0];
        if (t0 && (t0.paceW || t0.spinW)) {
          var vsK = t0.paceW >= t0.spinW ? "vsPace" : "vsSpin";
          players.forEach(function (p8) {
            if (p8.skills && typeof p8.skills[vsK] === "number") { p8.skills[vsK] = Math.min(96, Math.round(p8.skills[vsK] * 1.07)); try { jsDerive(p8); } catch (e8) {} }
          });
          window.__foCxIntel = "Southern Shires read the Tyke scorecard - they've picked batters for " + (vsK === "vsPace" ? "seam" : "spin") + ". Someone is paying attention.";
        }
      }
      if (r.id === "eng" && ci === 2 && !(stE.flags && stE.flags.valeSigned)) {
        // Arthur Vale - the batter everyone remembers. Yours, if you'd moved.
        var best = null;
        players.forEach(function (p7) { if (!p7.bowlType && !p7.keeper && (!best || (aggBat(p7) || 0) > (aggBat(best) || 0))) best = p7; });
        if (best) {
          best.name = "Arthur Vale"; best.age = 21;
          if (best.skills) {
            best.skills.temperament = Math.min(96, (best.skills.temperament || 40) + 10);
            best.skills.vsPace = Math.min(96, (best.skills.vsPace || 40) + 6);
          }
          best.origin_tag = "Marylebone's jewel - bats until the lights come on";
          try { jsDerive(best); } catch (e7) {}
        }
      }
    } catch (eEng) {}
    return { name: c.nm, ground: c.city + (c.boss ? " Colosseum" : " Oval"), players: players, youth: [],
      founded: false, homePitch: r.pitch, bank: 300000, seats: c.boss ? 24000 : 9000,
      supporters: 2600, mood: 3, acadY: 2, acadS: 2, __cx: 1 };
  }
  // place (or refresh) the circuit club in the world and hand over to the
  // friendly flow - lineup, toss, live match centre, the lot
  function foCxChallenge(ri, ci) {
    try {
      if (typeof M !== "undefined" && M && !M.done) { say("A match is already live - finish it first."); return; }
      var st = foCxState();
      if (!foCxClubOpen(st, ri, ci)) { say("That door isn't open yet - beat the clubs before it."); return; }
      foCxVs(ri, ci, function () { foCxStart(ri, ci); });
    } catch (e) { say(e); }
  }
  // the walk-out: both crests, a clash, the conditions, then Set your XI. Pure
  // theatre in the region's colour before the lineup.
  function foCxVs(ri, ci, onGo) {
    try {
      var r = FO_CX_REGIONS[ri], c = r.clubs[ci], me = userTeam();
      var myNm = (me && me.name) || "Your club", myInit = foJInitials(myNm);
      var opp = c.boss
        ? "<div class='vs-crest boss'><img class='vs-boss' src='" + FO_ART + "circuit/boss-" + r.id + ".webp' alt=''></div>"
        : "<div class='vs-crest'><img class='vs-soul' src='" + FO_ART + "crests/" + r.arch + ".png' alt=''></div>";
      var att = c.boss ? c.leader : c.nm;
      var quote = c.taunt ? "<div class='vs-quote'><span class='qm'>&ldquo;</span>" + E(c.taunt) + "<span class='qm'>&rdquo;</span><span class='att'>&mdash; " + E(att) + "</span></div>" : "";
      var ex = document.getElementById("fo-cx-vs"); if (ex) ex.remove();
      var m = document.createElement("div"); m.id = "fo-cx-vs"; m.className = "fo-cx-vs"; m.style.setProperty("--cxc", r.ac);
      m.innerHTML = "<div class='vs-bg' style='background-image:url(" + FO_ART + "circuit/" + r.id + ".webp)'></div><div class='vs-veil'></div>" +
        "<div class='vs-stage'>" +
        "<div class='vs-eyebrow'>The Circuit &middot; " + E(r.nm) + "</div>" +
        "<div class='vs-row'>" +
        "<div class='vs-side vs-you'><div class='vs-crest'>" + foJCrest("#14213D", 120, myInit) + "</div>" +
        "<div class='vs-nm'>" + E(myNm) + "</div><div class='vs-tag'>Your club</div></div>" +
        "<div class='vs-mid'><span class='vs-clash'></span><span class='vs-emblem'>VS</span></div>" +
        "<div class='vs-side vs-them'>" + opp +
        "<div class='vs-nm'>" + E(c.nm) + "</div><div class='vs-tag'>" + (c.boss ? "Boss &middot; " + E(c.leader) : E(c.city)) + "</div></div>" +
        "</div>" + quote +
        "<div class='vs-cond'>" + E(foPitchName(r.pitch)) + " pitch &middot; " + E(r.wx) + " &middot; " + E(c.city) + "</div>" +
        "<button type='button' class='vs-go' id='fo-cx-vs-go'>Set your XI &#9654;</button>" +
        "</div>";
      document.body.appendChild(m);
      requestAnimationFrame(function () { m.classList.add("in"); });
      var go = function () { m.classList.add("out"); setTimeout(function () { if (m.parentNode) m.remove(); onGo(); }, 260); };
      m.querySelector("#fo-cx-vs-go").addEventListener("click", go);
      m.addEventListener("click", function (ev) { if (ev.target === m) go(); });
    } catch (e) { onGo(); }
  }
  function foCxStart(ri, ci) {
    try {
      if (typeof M !== "undefined" && M && !M.done) { say("A match is already live - finish it first."); return; }
      var r = FO_CX_REGIONS[ri], c = r.clubs[ci];
      var T = foCxTeam(ri, ci);
      var ix = -1;
      (GD.teams || []).forEach(function (t, i) { if (t && t.name === T.name) ix = i; });
      if (ix < 0) { GD.teams.push(T); ix = GD.teams.length - 1; } else GD.teams[ix] = T;
      // in a live league, snapshot the manager's real league plan before the
      // Circuit overwrites App.orders, so it can be put back untouched afterward
      try { if (SYNC && SYNC.started && !SYNC.practice && App.orders) window.__foCxOrdStash = JSON.stringify(App.orders); } catch (eSt) {}
      foChallenge(ix, r.pitch, r.wx);
      // played on THEIR ground, under their locked conditions
      if (App.pending) {
        App.pending.ground = T.ground;
        App.pending.__circuit = { r: ri, c: ci };
      }
      say("The Circuit: " + T.name + " at " + T.ground + " · " + foPitchName(r.pitch) + " pitch, " + r.wx + ". Set your XI, then Save.");
    } catch (e) { say(e); }
  }
  // the conquest ceremony / the debrief after a loss - journey styled
  function foCxModal(win, r, c, conquered, prize) {
    try {
      var ex = document.getElementById("fo-cx-end"); if (ex) ex.remove();
      var m = document.createElement("div"); m.id = "fo-cx-end"; m.className = "fo-modal";
      var head = win ? (conquered ? r.nm + " conquered!" : c.nm + " beaten!") : "They hold the door";
      var gline = win
        ? (conquered ? "That's the whole nation, boss. " + r.trophy + " is ours, and their academy will take our calls now. On to the next flight."
          : "Good cricket. " + (r.clubs[r.clubs.indexOf(c) + 1] ? "Next door: " + r.clubs[r.clubs.indexOf(c) + 1].nm + "." : "The boss is waiting."))
        : "No shame in it - their ground, their rules. Patch the hole they found and we go again. The door stays open.";
      m.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>The Circuit · " + E(r.nm) + "</div>" +
        "<h3>" + E(head) + "</h3>" +
        (win && conquered ? "<img class='fo-cx-troph' src='" + FO_ART + "circuit/trophy-" + r.id + ".webp' alt='" + E(r.trophy) + "'>" : "") +
        (win && prize ? "<div class='small' style='margin:2px 0 8px'>Prize money: <b>" + FO$(prize) + "</b>" +
          (conquered ? " · <b>" + E(r.trophy) + "</b> → museum · " + E(r.nm) + "'s youth academy unlocked" : "") + "</div>" : "") +
        "<div class='fo-j-gbox' style='max-width:none;margin:8px 0'><img class='gf' src='" + FO_ART + "gaffer" + (win ? "-laugh" : "-serious") + ".png' alt=''>" +
        "<span class='bx'><span class='sp'>The Gaffer</span><span class='tx'>&ldquo;" + E(gline) + "&rdquo;</span></span></div>" +
        "<div class='fo-modal-act'><button class='fo-su-go primary' id='fo-cx-back'>" + (win && conquered ? "See the map ▸" : "Back to the Circuit ▸") + "</button></div></div>";
      document.body.appendChild(m);
      m.querySelector("#fo-cx-back").addEventListener("click", function () {
        m.remove(); location.hash = "#/circuit"; if (typeof window.route === "function") window.route();
      });
    } catch (e) {}
  }
  function foCxRecord(tag, win) {
    try {
      var r = FO_CX_REGIONS[tag.r], c = r.clubs[tag.c]; if (!r || !c) return;
      var st = foCxState(), conquered = false, prize = 0;
      // the passport remembers: score, hero, best figures, and HOW you won
      try {
        var me9 = userTeam();
        if (typeof M !== "undefined" && M && M.done && M.innings && me9) {
          var h = { rid: r.id, ci: tag.c, win: !!win, opp: c.nm, my: 0, op: 0, topNm: null, topR: -1, bbNm: null, bbW: -1, bbR: 0, paceW: 0, spinW: 0 };
          var byName = {}; (me9.players || []).forEach(function (p9) { if (p9) byName[p9.name] = p9; });
          [M.innings[0], M.innings[1]].forEach(function (inn) {
            if (!inn) return;
            if (inn.batTeam === me9.name) {
              h.my = inn.runs || 0;
              (inn.bat || []).forEach(function (b9) {
                if (b9 && b9.p && b9.r > h.topR) { h.topR = b9.r; h.topNm = b9.p.name; }
              });
            } else {
              h.op = inn.runs || 0;
              Object.keys(inn.bowlers || {}).forEach(function (k9) {
                var bw = inn.bowlers[k9]; if (!bw) return;
                if ((bw.w || 0) > h.bbW || ((bw.w || 0) === h.bbW && (bw.r || 0) < h.bbR)) { h.bbW = bw.w || 0; h.bbR = bw.r || 0; h.bbNm = k9; }
                var pl9 = byName[k9];
                if (pl9 && pl9.bowlType) { if (/spin/i.test(pl9.bowlType)) h.spinW += (bw.w || 0); else h.paceW += (bw.w || 0); }
              });
            }
          });
          st.hist = (st.hist || []).concat([h]).slice(-60);
        }
      } catch (eH9) {}
      if (win && !foCxBeaten(st, r.id, tag.c)) {
        (st.beat[r.id] = st.beat[r.id] || [])[tag.c] = true;
        prize = foCxPrize(tag.r, !!c.boss);
        if (c.boss) {
          conquered = true;
          st.conq = st.conq || []; st.conq.push(r.id);
          try {
            var me = userTeam();
            var mus = (me._museum = me._museum || { trophies: [], awards: [], legends: [] });
            mus.trophies.push({ s: App.seasonNo || 1, kind: r.trophy + " · The Circuit: conquered " + r.nm });
          } catch (eM) {}
        }
        try { if (App.fin) App.fin.bank = (App.fin.bank || 0) + prize; } catch (eB) {}
        if (conquered) {
          // Thorne watches every conquest - and England leaves a loose thread
          try {
            var stT = foStState();
            stT.queue.push({ id: "thorneCx", data: { first: (st.conq || []).length <= 1, region: r.nm } });
            if (r.id === "eng") {
              stT.queue.push({ id: "gtReveal1", data: {} });
              foStLog(stT, "mystery", "The scorebook question lingers: the Gaffer's name, beside Thorne's, in a Marylebone ledger dated twenty years back.");
            }
            foStVar(stT, "thorne", 2);
            foStSave(stT);
          } catch (eTq) {}
        }
        foCxSave(st);
        try { if (typeof window.saveGame === "function") window.saveGame(false); } catch (eS) {}
      }
      // between the Shires and Pemberley: the scout has found Arthur Vale
      try {
        if (r.id === "eng" && win) {
          var engBeat = (st.beat.eng || []).filter(Boolean).length;
          st.flags = st.flags || {};
          if (engBeat === 2 && !foCxBeaten(st, "eng", 2) && !st.flags.valeAsked) {
            st.flags.valeAsked = 1;
            var stV = foStState(); stV.queue.push({ id: "valeOffer", data: {} }); foStSave(stV);
          }
        }
      } catch (eVo) {}
      // the visitors fly home: their club leaves the world once the tie is done
      try {
        for (var i = (GD.teams || []).length - 1; i >= 0; i--) {
          if (GD.teams[i] && GD.teams[i].__cx && (!App.pending || App.pending.away !== GD.teams[i].name)) GD.teams.splice(i, 1);
        }
      } catch (eR) {}
      // restore the league plan the Circuit borrowed App.orders from
      try { if (window.__foCxOrdStash) { App.orders = JSON.parse(window.__foCxOrdStash); window.__foCxOrdStash = null; } } catch (eOr) {}
      foCxModal(win, r, c, conquered, prize);
    } catch (e) {}
  }
  // keeper: records finished circuit matches, and re-seats the circuit club if
  // a league snapshot refresh rebuilt GD.teams under a live tie
  setInterval(function () {
    try {
      if (App && App.pending && App.pending.__circuit && typeof GD !== "undefined" && GD.teams) {
        var nm = App.pending.away, found = -1;
        GD.teams.forEach(function (t, i) { if (t && t.name === nm) found = i; });
        if (found < 0) {
          var T2 = foCxTeam(App.pending.__circuit.r, App.pending.__circuit.c);
          GD.teams.push(T2); App.pending.oppIx = GD.teams.length - 1;
        } else App.pending.oppIx = found;
        // lineup saved -> walk out: circuit ties play LIVE in the match centre
        if (App.orders && App.orders.saved && !App.pending.__cxGo && !(typeof M !== "undefined" && M && !M.done)) {
          App.pending.__cxGo = 1;
          location.hash = "#/match"; if (typeof window.route === "function") window.route();
        }
      }
      if (typeof M !== "undefined" && M && M.done && M.meta && M.meta.__circuit && !M.__cxSeen) {
        M.__cxSeen = 1;
        var win = false;
        try { win = !!(M.result && M.result.winner === userTeam().name); } catch (e2) {}
        foCxRecord(M.meta.__circuit, win);
      }
    } catch (e) {}
  }, 2500);
  // ---- the Circuit page (#/circuit): the approved region-screen layout ------
  (function foCxCss() {
    if (document.getElementById("fo-cx-css")) return;
    var st = document.createElement("style"); st.id = "fo-cx-css";
    st.textContent =
      ".fo-cx{max-width:760px;margin:0 auto;padding:6px 2px 30px}" +
      ".fo-cx-chap{display:flex;gap:10px;justify-content:center;margin:4px 0 16px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:500;flex-wrap:wrap}" +
      ".fo-cx-chap span{color:#b9b29a;cursor:pointer}.fo-cx-chap span.on{color:#C8674A;border-bottom:2px solid #C8674A;padding-bottom:2px}" +
      ".fo-cx-chap span.done{color:#2E7A3C}.fo-cx-chap i{font-style:normal;color:#d5cdb2}" +
      ".fo-cx-head{text-align:center;margin-bottom:12px}" +
      ".fo-cx-rule{display:flex;align-items:center;gap:12px;justify-content:center;color:#C9A24B;margin:4px 0}" +
      ".fo-cx-rule i{flex:0 0 70px;height:2px;background:linear-gradient(90deg,transparent,#C9A24B);border-radius:2px}" +
      ".fo-cx-rule i:last-child{background:linear-gradient(270deg,transparent,#C9A24B)}" +
      ".fo-cx-rule b{font-family:Oswald,sans-serif;font-size:11px;letter-spacing:2.6px;color:#C9A24B;font-weight:500}" +
      ".fo-cx-h1{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:2.5px;font-size:clamp(28px,6vw,40px);color:#101B2D;line-height:1.05}" +
      ".fo-cx-type{display:inline-block;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:1.8px;font-weight:500;font-size:12px;color:#fff;border-radius:99px;padding:4px 14px;margin-top:7px}" +
      ".fo-cx-cond{color:#5b6472;font-size:14px;margin:9px auto 0;max-width:56ch}" +
      ".fo-cx-cond b{color:#101B2D}" +
      ".fo-cx-prog{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:10px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#8a90a0}" +
      ".fo-cx-prog i{width:10px;height:10px;border-radius:50%;border:2px solid var(--cxc,#C9A24B);display:inline-block}" +
      ".fo-cx-prog i.f{background:var(--cxc,#C9A24B)}" +
      ".fo-cx-brief{max-width:680px;margin:15px auto 0;background:#FFFEFC;border:1.5px solid #D9B75A;border-radius:13px;padding:13px 17px;display:flex;gap:13px;align-items:flex-start;text-align:left;box-shadow:0 4px 0 rgba(16,27,45,.16)}" +
      ".fo-cx-brief.flash{animation:foCxBriefFlash .5s ease-out}" +
      "@keyframes foCxBriefFlash{0%{box-shadow:0 4px 0 rgba(16,27,45,.16),0 0 0 3px var(--cxc,#C9A24B)}100%{box-shadow:0 4px 0 rgba(16,27,45,.16),0 0 0 0 rgba(201,162,75,0)}}" +
      ".fo-cx-brief img.gf{width:54px;height:54px;border-radius:50%;object-fit:cover;object-position:top;border:1.5px solid #D9B75A;background:#FFFEFC;flex:0 0 54px}" +
      ".fo-cx-brief .bx{flex:1;min-width:0}" +
      ".fo-cx-brief .sp{display:block;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:1.4px;font-weight:600;text-transform:uppercase;margin-bottom:3px;color:#C8674A}" +
      ".fo-cx-brief .tx{font-size:15.5px;color:#101B2D;line-height:1.5;font-style:italic}" +
      ".fo-cx-brief .act{margin-top:11px;min-height:20px}" +
      ".fo-cx-brief .hint{font-size:12.5px;color:#8a90a0;font-style:italic}" +
      // the VS walk-out - light theme, the region map behind, a rival taunt
      ".fo-cx-vs{position:fixed;inset:0;z-index:2147482000;display:grid;place-items:center;padding:22px;opacity:0;transition:opacity .3s;background:#F1EADA;overflow:hidden}" +
      ".fo-cx-vs.in{opacity:1}.fo-cx-vs.out{opacity:0}" +
      ".fo-cx-vs .vs-bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.5;transform:scale(1.06);filter:saturate(1.05)}" +
      ".fo-cx-vs .vs-veil{position:absolute;inset:0;background:radial-gradient(120% 92% at 50% 34%,rgba(247,242,229,.62),rgba(244,239,226,.9) 74%,rgba(240,233,215,.97))}" +
      ".fo-cx-vs .vs-stage{position:relative;width:100%;max-width:640px;text-align:center;color:#101B2D}" +
      ".fo-cx-vs .vs-eyebrow{font-family:Oswald,sans-serif;letter-spacing:4px;text-transform:uppercase;font-size:12px;color:var(--cxc,#C8674A);font-weight:600;margin-bottom:20px}" +
      ".fo-cx-vs .vs-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px}" +
      ".fo-cx-vs .vs-side{display:flex;flex-direction:column;align-items:center;gap:7px}" +
      ".fo-cx-vs .vs-you{transform:translateX(-46px);opacity:0;transition:transform .55s cubic-bezier(.2,.7,.3,1),opacity .55s}" +
      ".fo-cx-vs .vs-them{transform:translateX(46px);opacity:0;transition:transform .55s cubic-bezier(.2,.7,.3,1),opacity .55s}" +
      ".fo-cx-vs.in .vs-you,.fo-cx-vs.in .vs-them{transform:none;opacity:1}" +
      ".fo-cx-vs .vs-crest{width:130px;height:130px;display:grid;place-items:center;filter:drop-shadow(0 8px 18px rgba(16,27,45,.28))}" +
      ".fo-cx-vs .vs-crest svg{width:100%;height:100%;display:block}" +
      ".fo-cx-vs .vs-nm{margin-top:4px}" +
      ".fo-cx-vs .vs-crest img.vs-soul{width:116px;height:116px;object-fit:contain}" +
      ".fo-cx-vs .vs-crest.boss{border-radius:50%;overflow:hidden;border:3px solid var(--cxc,#C8674A);background:#FFFEFC;box-shadow:0 6px 18px rgba(16,27,45,.28)}" +
      ".fo-cx-vs .vs-crest img.vs-boss{width:100%;height:100%;object-fit:cover;object-position:50% 7%}" +
      ".fo-cx-vs .vs-nm{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.6px;font-size:19px;line-height:1.08;color:#101B2D;max-width:15ch}" +
      ".fo-cx-vs .vs-tag{font-family:Oswald,sans-serif;font-weight:500;text-transform:uppercase;letter-spacing:1.3px;font-size:11px;color:var(--cxc,#C8674A)}" +
      ".fo-cx-vs .vs-mid{position:relative;width:72px;height:72px;display:grid;place-items:center}" +
      ".fo-cx-vs .vs-emblem{width:60px;height:60px;border-radius:50%;display:grid;place-items:center;background:var(--cxc,#C8674A);color:#FFFEFC;font-family:Oswald,sans-serif;font-weight:700;font-size:24px;box-shadow:0 5px 14px rgba(16,27,45,.3),0 0 0 4px rgba(255,254,252,.8);transform:scale(.3);opacity:0;transition:transform .45s .4s cubic-bezier(.2,1.7,.4,1),opacity .3s .4s}" +
      ".fo-cx-vs.in .vs-emblem{transform:none;opacity:1}" +
      ".fo-cx-vs .vs-clash{position:absolute;inset:6px;border-radius:50%}" +
      ".fo-cx-vs.in .vs-clash{animation:foVsClash .7s .5s ease-out}" +
      "@keyframes foVsClash{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--cxc,#C8674A) 55%,transparent)}100%{box-shadow:0 0 0 90px rgba(201,162,75,0)}}" +
      ".fo-cx-vs .vs-quote{max-width:46ch;margin:22px auto 0;font-style:italic;font-size:16.5px;color:#33405c;line-height:1.5}" +
      ".fo-cx-vs .vs-quote .qm{color:var(--cxc,#C8674A);font-weight:700;font-family:Georgia,serif}" +
      ".fo-cx-vs .vs-quote .att{display:block;margin-top:7px;font-style:normal;font-family:Oswald,sans-serif;letter-spacing:1.6px;text-transform:uppercase;font-size:11px;color:var(--cxc,#C8674A)}" +
      ".fo-cx-vs .vs-cond{margin:18px 0 2px;font-size:13px;color:#6b7280;letter-spacing:.3px;text-transform:uppercase;font-family:Oswald,sans-serif;letter-spacing:1.4px}" +
      "html body .fo-cx-vs .vs-go,html body.ftpskin .fo-cx-vs .vs-go{display:inline-block;font-family:Oswald,sans-serif !important;letter-spacing:2.5px;text-transform:uppercase;font-weight:600 !important;font-size:15px;color:#FDFAF1 !important;background:#C8674A !important;border:none !important;border-radius:11px;padding:12px 30px;cursor:pointer;box-shadow:inset 0 -3px 0 rgba(0,0,0,.2),0 6px 16px rgba(16,27,45,.28);margin-top:16px}" +
      "html body .fo-cx-vs .vs-go:hover,html body.ftpskin .fo-cx-vs .vs-go:hover{background:#B5563B !important}" +
      "@media(prefers-reduced-motion:reduce){.fo-cx-vs .vs-you,.fo-cx-vs .vs-them,.fo-cx-vs .vs-emblem{transition:none;transform:none;opacity:1}.fo-cx-vs.in .vs-clash{animation:none}}" +
      "@media(max-width:480px){.fo-cx-vs .vs-crest{width:102px;height:102px}.fo-cx-vs .vs-crest img.vs-soul{width:90px;height:90px}.fo-cx-vs .vs-nm{font-size:16px}.fo-cx-vs .vs-quote{font-size:15px}}" +
      ".fo-cx-sec{display:flex;align-items:center;gap:10px;margin:18px auto 9px;max-width:680px;letter-spacing:2px;text-transform:uppercase;color:#101B2D;font-size:12.5px;font-weight:500;font-family:Oswald,sans-serif}" +
      ".fo-cx-sec i{flex:1;height:1px;background:rgba(16,27,45,.18);font-style:normal}" +
      ".fo-cx-rows{display:flex;flex-direction:column;gap:9px;max-width:680px;margin:0 auto}" +
      ".fo-cx-row{background:#FFFEFC;border:1.5px solid rgba(16,27,45,.14);border-radius:12px;padding:11px 15px;display:flex;align-items:center;gap:13px;text-align:left}" +
      ".fo-cx-row .no{font-family:Oswald,sans-serif;font-weight:600;font-size:15px;color:var(--cxc,#B06E08);width:30px;height:30px;border:2px solid var(--cxc,#D08A12);border-radius:50%;display:grid;place-items:center;flex:0 0 30px}" +
      ".fo-cx-row.done{opacity:.75}.fo-cx-row.done .no{background:#69B578;border-color:#69B578;color:#fff}" +
      ".fo-cx-row.bossr{border:2px solid #C8674A;box-shadow:0 3px 0 rgba(16,27,45,.16)}" +
      ".fo-cx-row.bossr .no{border-color:#C8674A;color:#C8674A}" +
      ".fo-cx-row .m{flex:1;min-width:0}" +
      ".fo-cx-nm{font-weight:700;color:#101B2D;font-size:15.5px}" +
      ".fo-cx-sub{display:block;font-size:12px;color:#6b7280;margin-top:1px}" +
      ".fo-cx-why{display:block;font-size:12.5px;color:#C8674A;font-weight:600;margin-top:2px}" +
      "html body .fo-cx-ch,html body.ftpskin .fo-cx-ch{font-family:Oswald,sans-serif !important;letter-spacing:2.2px;text-transform:uppercase;font-weight:600 !important;font-size:13px;background:#C8674A !important;color:#FDFAF1 !important;border:none !important;border-radius:10px;padding:9px 17px;cursor:pointer;box-shadow:inset 0 -3px 0 rgba(0,0,0,.18);white-space:nowrap}" +
      "html body .fo-cx-ch:hover,html body.ftpskin .fo-cx-ch:hover{background:#B5563B !important}" +
      ".fo-cx-lock{font-family:Oswald,sans-serif;letter-spacing:2px;text-transform:uppercase;font-weight:500;font-size:12px;color:#a9a291;border:1.5px dashed #c5bda6;border-radius:10px;padding:8px 15px;white-space:nowrap}" +
      ".fo-cx-won{font-family:Oswald,sans-serif;letter-spacing:1.4px;text-transform:uppercase;font-weight:600;font-size:12.5px;color:#2E7A3C;white-space:nowrap}" +
      ".fo-cx-ledger{background:#FBF7EA;border:1px solid #d8d0b8;border-radius:8px;max-width:680px;margin:16px auto 0;padding:13px 17px;box-shadow:0 3px 10px rgba(16,27,45,.08);text-align:left}" +
      ".fo-cx-ledger .lh{font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:2px;text-transform:uppercase;color:#8a7b4f;border-bottom:2px solid #101B2D;padding-bottom:6px;margin-bottom:8px;font-weight:500}" +
      ".fo-cx-ledger p{font-size:14px;color:#4a5568;margin:0}" +
      ".fo-cx-ledger b{color:#101B2D}.fo-cx-ledger .pos{color:#2E7A3C;font-weight:600}" +
      ".fo-cx-map{max-width:520px;margin:14px auto 2px;background:#FFFEFC;border:2px solid #C9A24B;border-radius:14px;padding:8px;box-shadow:0 4px 0 rgba(16,27,45,.28)}" +
      ".fo-cx-map .mapin{position:relative;border-radius:9px;overflow:hidden;background:#0a1220}" +
      ".fo-cx-map img{display:block;width:100%;height:auto}" +
      "html body #page .fo-cx-node,html body.ftpskin #page .fo-cx-node{cursor:pointer;appearance:none;-webkit-appearance:none;font:inherit;padding:0 !important;margin:0;position:absolute;transform:translate(-50%,-50%);width:32px !important;height:32px;border-radius:50% !important;display:grid;place-items:center;font-family:Oswald,sans-serif !important;font-weight:600;font-size:14px !important;color:#fff !important;background:rgba(10,18,32,.62) !important;border:2.5px solid #fff !important;box-shadow:0 0 0 3px rgba(6,12,22,.35),0 3px 10px rgba(0,0,0,.5) !important;line-height:1;min-width:0}" +
      "html body #page .fo-cx-node.done,html body.ftpskin #page .fo-cx-node.done{background:#3E9455 !important;color:#fff !important}" +
      "html body #page .fo-cx-node.nxt,html body.ftpskin #page .fo-cx-node.nxt{background:var(--cxc,#C8674A) !important;color:#fff !important}" +
      "@media (prefers-reduced-motion:no-preference){.fo-cx-node.nxt{animation:foCxPulse 1.8s ease-out infinite}}" +
      "@keyframes foCxPulse{0%{box-shadow:0 0 0 3px rgba(6,12,22,.35),0 0 0 0 rgba(255,255,255,.55)}70%{box-shadow:0 0 0 3px rgba(6,12,22,.35),0 0 0 13px rgba(255,255,255,0)}100%{box-shadow:0 0 0 3px rgba(6,12,22,.35),0 0 0 0 rgba(255,255,255,0)}}" +
      "html body #page .fo-cx-node.lock,html body.ftpskin #page .fo-cx-node.lock{background:rgba(10,18,32,.62) !important;color:#aeb6c6 !important;border-color:rgba(255,255,255,.45) !important}" +
      "html body #page .fo-cx-node.bossn,html body.ftpskin #page .fo-cx-node.bossn{width:38px !important;height:38px;font-size:17px !important;border-color:#F3D37A !important}" +
      ".fo-cx-node .cl{position:absolute;top:104%;left:50%;transform:translateX(-50%);font-size:9.5px;letter-spacing:1.2px;text-transform:uppercase;color:#F3EEDF;white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 6px rgba(0,0,0,.7)}" +
      ".fo-cx-stage{display:flex;gap:13px;max-width:720px;margin:14px auto 2px;align-items:stretch}" +
      ".fo-cx-stage .fo-cx-map{flex:2.3;min-width:0;margin:0;display:flex;flex-direction:column}" +
      ".fo-cx-rail{flex:1;min-width:0;display:flex;flex-direction:column;gap:13px}" +
      ".fo-cx-trophycard{flex:1;min-height:0;background:#FFFEFC;border:2px solid #C9A24B;border-radius:14px;padding:8px 8px 6px;box-shadow:0 4px 0 rgba(16,27,45,.28);display:flex;flex-direction:column;align-items:center;position:relative;overflow:hidden}" +
      ".fo-cx-trophycard::before{content:\"\";position:absolute;inset:8px 8px 26px;border-radius:9px;background:radial-gradient(circle at 50% 38%,#FFFDF6 0%,#EFE7D3 80%);box-shadow:inset 0 0 0 1px rgba(201,162,75,.28)}" +
      ".fo-cx-trophycard img{position:absolute;left:0;right:0;top:12px;bottom:34px;margin:auto;max-width:72%;max-height:calc(100% - 52px);width:auto;height:auto;filter:drop-shadow(0 5px 10px rgba(16,27,45,.28))}" +
      ".fo-cx-trophycard .tnm{position:absolute;left:8px;right:8px;bottom:7px}" +
      ".fo-cx-trophycard .tnm{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;font-size:10.5px;color:#8a7b4f;text-align:center}" +
      ".fo-cx-stage .fo-cx-map .mapin{aspect-ratio:1/1;flex:0 0 auto}" +
      ".fo-cx-stage .fo-cx-map .mapin img{width:100%;height:100%;object-fit:cover}" +
      ".fo-cx-bosscard{flex:1.5;min-height:0;background:#FFFEFC;border:2px solid #C9A24B;border-radius:14px;padding:8px;box-shadow:0 4px 0 rgba(16,27,45,.28);display:flex;flex-direction:column}" +
      ".fo-cx-bosscard .bimg{position:relative;flex:1;min-height:0;border-radius:9px;overflow:hidden;background:#0a1220}" +
      ".fo-cx-bosscard .bimg img{position:absolute;left:0;top:0;right:0;bottom:0;width:100%;height:100%;object-fit:cover;object-position:50% 6%;display:block}" +
      ".fo-cx-bosscard.conq .bimg img{filter:saturate(.85)}" +
      ".fo-cx-bosscard .bwon{position:absolute;top:8px;left:8px;font-family:Oswald,sans-serif;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;font-size:11px;color:#fff;background:#3E9455;border-radius:99px;padding:3px 11px;box-shadow:0 2px 6px rgba(0,0,0,.4)}" +
      ".fo-cx-bosscard .bmeta{padding:8px 6px 3px;text-align:center}" +
      ".fo-cx-bosscard .btag{font-family:Oswald,sans-serif;font-weight:500;letter-spacing:2.2px;text-transform:uppercase;font-size:9.5px}" +
      ".fo-cx-bosscard .bnm{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:.6px;text-transform:uppercase;font-size:15.5px;color:#101B2D;line-height:1.15;margin-top:1px}" +
      ".fo-cx-bosscard .bcl{font-size:11px;color:#6b7280;margin-top:1px}" +
      "@media(max-width:600px){.fo-cx-stage{flex-direction:column}.fo-cx-bosscard .bimg{min-height:230px}.fo-cx-bosscard .bimg img{object-position:50% 14%}}" +
      ".fo-cx-bossav{position:relative;width:46px;height:46px;flex:0 0 46px}" +
      ".fo-cx-bossav img{width:46px;height:46px;border-radius:50%;object-fit:cover;object-position:50% 6%;border:2px solid #C8674A;background:#FFFEFC;display:block}" +
      ".fo-cx-row.done .fo-cx-bossav img{border-color:#69B578}" +
      ".fo-cx-bossav i{position:absolute;right:-4px;bottom:-4px;width:18px;height:18px;border-radius:50%;background:#69B578;color:#fff;font-style:normal;font-size:11px;display:grid;place-items:center;border:2px solid #FFFEFC}" +
      ".fo-cx-ledtr{float:right;height:86px;margin:-4px 0 6px 12px;filter:drop-shadow(0 3px 6px rgba(16,27,45,.3))}" +
      ".fo-cx-troph{display:block;height:130px;margin:6px auto 2px;filter:drop-shadow(0 5px 12px rgba(16,27,45,.35))}" +
      ".fo-cx-info{position:absolute;left:10px;right:10px;bottom:10px;background:rgba(255,254,252,.97);border:1.5px solid #C9A24B;border-radius:11px;padding:10px 34px 11px 14px;text-align:left;box-shadow:0 8px 22px rgba(0,0,0,.45)}" +
      ".fo-cx-info .x{position:absolute;top:4px;right:6px;border:none;background:none;font:600 20px/1 Oswald,sans-serif;color:#8a90a0;cursor:pointer;padding:4px}" +
      ".fo-cx-info .inm{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:.8px;text-transform:uppercase;font-size:13px;color:#101B2D}" +
      ".fo-cx-info .itx{font-size:12.5px;color:#4a5568;line-height:1.5;margin-top:2px}" +
      "@media(max-width:600px){.fo-cx-rail{flex-direction:row}.fo-cx-bosscard{flex:1.15}.fo-cx-trophycard{flex:1;min-height:225px}.fo-cx-bosscard .bimg{min-height:170px}}" +
      ".fo-cx-done{text-align:center;padding:30px 10px}" +
      ".fo-cx .fo-j-gbox{margin:14px auto}" +
      "@media(max-width:640px){.fo-cx-row{flex-wrap:wrap}.fo-cx-row .m{flex:1 1 100%;order:2}.fo-cx-row .no{order:1}.fo-cx-row .fo-cx-ch,.fo-cx-row .fo-cx-lock,.fo-cx-row .fo-cx-won{order:3;margin-left:auto}}";
    document.head.appendChild(st);
  })();
  function foCxNav() {
    try {
      var tb = document.getElementById("topbar"); if (!tb) return;
      var wrap = tb.querySelector(".fo-nav-scroll"); if (!wrap) return;
      if (wrap.querySelector("a.fo-circuit")) return;
      var a = document.createElement("a"); a.className = "fo-circuit"; a.href = "#"; a.textContent = "Circuit";
      a.addEventListener("click", function (e) { e.preventDefault(); location.hash = "#/circuit"; if (typeof window.route === "function") window.route(); });
      var guide = wrap.querySelector("a.fo-guide");
      if (guide) wrap.insertBefore(a, guide); else wrap.appendChild(a);
    } catch (e) {}
  }
  var foCxView = null;   // region the chapter strip is looking at (defaults to live one)
  function foRenderCircuit() {
    try {
      foCxNav();
      if (location.hash.indexOf("#/circuit") !== 0) return;
      var page = document.getElementById("page"); if (!page) return;
      var st = foCxState();
      var cur = foCxCurrent(st);
      var ri = (foCxView == null) ? Math.min(cur, FO_CX_REGIONS.length - 1) : Math.min(foCxView, FO_CX_REGIONS.length - 1);
      var sig = "cx|" + ri + "|" + cur + "|" + JSON.stringify(st.beat) + "|" + (st.conq || []).join(",");
      if (page.__foCxSig === sig && page.querySelector(".fo-cx")) return;
      page.__foCxSig = sig;
      var chap = FO_CX_REGIONS.map(function (r2, i) {
        var cls = foCxConquered(st, r2.id) ? "done" : (i === ri ? "on" : "");
        return "<span class='" + cls + "' data-ri='" + i + "'>" + E(r2.nm) + "</span>";
      }).join("<i>›</i>") + "<i>›</i><span>★ Thorne</span>";
      var html;
      if (cur >= FO_CX_REGIONS.length && foCxView == null) {
        html = "<div class='fo-cx'><div class='fo-cx-chap'>" + chap + "</div>" +
          "<div class='fo-cx-done'><div class='fo-cx-rule'><i></i><b>THE CIRCUIT</b><i></i></div>" +
          "<div class='fo-cx-h1'>World tour complete</div>" +
          "<p class='fo-cx-cond'>Six nations, six trophies. Reggie Thorne's World Final is being built - the summit match arrives in the next update. Your trophies live in the club museum.</p></div></div>";
      } else {
        var r = FO_CX_REGIONS[ri];
        var beatN = (st.beat[r.id] || []).filter(Boolean).length;
        var dots = r.clubs.map(function (c2, i2) { return "<i class='" + (foCxBeaten(st, r.id, i2) ? "f" : "") + "'></i>"; }).join("");
        var live = !foCxConquered(st, r.id);
        var nextCi = -1;
        if (live) for (var i3 = 0; i3 < r.clubs.length; i3++) if (!foCxBeaten(st, r.id, i3)) { nextCi = i3; break; }
        html = "<div class='fo-cx' style='--cxc:" + r.ac + "'>" +
          "<div class='fo-cx-chap'>" + chap + "</div>" +
          "<div class='fo-cx-head'>" +
          "<div class='fo-cx-rule'><i></i><b>THE CIRCUIT · " + (st.conq || []).length + " OF " + FO_CX_REGIONS.length + " REGIONS CONQUERED</b><i></i></div>" +
          "<div class='fo-cx-h1'>" + E(r.nm) + "</div>" +
          "<div class='fo-cx-prog'>Progress · " + beatN + " / " + r.clubs.length + " beaten <span style='display:inline-flex;gap:5px;margin-left:4px'>" + dots + "</span></div>" +
          "</div>" +
          (function () {
            var bc = r.clubs.filter(function (x) { return x.boss; })[0];
            var bossDone = foCxBeaten(st, r.id, r.clubs.indexOf(bc));
            return "<div class='fo-cx-stage'>" +
              "<div class='fo-cx-map'><div class='mapin'>" +
              "<img src='" + FO_ART + "circuit/" + r.id + ".webp' alt=''>" +
              r.clubs.map(function (c5, i5) {
                var done5 = foCxBeaten(st, r.id, i5);
                var cls5 = "fo-cx-node" + (c5.boss ? " bossn" : "") + (done5 ? " done" : (live && i5 === nextCi ? " nxt" : " lock"));
                return "<button type='button' class='" + cls5 + "' data-ci='" + i5 + "' style='left:" + c5.mx + "%;top:" + c5.my + "%'>" +
                  (done5 ? "✓" : (c5.boss ? "★" : (i5 + 1))) + "<span class='cl'>" + E(c5.city) + "</span></button>";
              }).join("") +
              "</div></div>" +
              "<div class='fo-cx-rail'>" +
              "<div class='fo-cx-bosscard" + (bossDone ? " conq" : "") + "'>" +
              "<div class='bimg'><img src='" + FO_ART + "circuit/boss-" + r.id + ".webp' alt='" + E(bc.leader) + "'>" +
              (bossDone ? "<span class='bwon'>✓ Beaten</span>" : "") + "</div>" +
              "<div class='bmeta'><span class='btag' style='color:" + r.ac + "'>Region Boss</span>" +
              "<div class='bnm'>" + E(bc.leader) + "</div>" +
              "<div class='bcl'>" + E(bc.nm) + " · " + E(bc.city) + "</div></div>" +
              "</div>" +
              "<div class='fo-cx-trophycard'>" +
              "<img src='" + FO_ART + "circuit/trophy-" + r.id + ".webp' alt='" + E(r.trophy) + "'>" +
              "<div class='tnm'>" + E(r.trophy) + "</div>" +
              "</div>" +
              "</div></div>";
          })() +
          "<div class='fo-cx-brief' id='fo-cx-brief'>" +
          "<img class='gf' src='" + FO_ART + "gaffer.png' alt=''>" +
          "<div class='bx'>" +
          "<span class='sp' id='fo-cx-brief-sp'>The Gaffer</span>" +
          "<span class='tx' id='fo-cx-brief-tx'>&ldquo;" + E(r.gaffer) + "&rdquo;</span>" +
          "<div class='act' id='fo-cx-brief-act'><span class='hint'>Tap a city on the map to scout its club" + (live ? " &mdash; then challenge it." : ".") + "</span></div>" +
          "</div></div>" +
          "</div>";
      }
      page.innerHTML = html;
      page.querySelectorAll(".fo-cx-chap span[data-ri]").forEach(function (s2) {
        s2.addEventListener("click", function () {
          foCxView = +s2.getAttribute("data-ri"); page.__foCxSig = null; foRenderCircuit();
        });
      });
      page.querySelectorAll(".fo-cx-ch[data-ci]").forEach(function (b2) {
        b2.addEventListener("click", function () { foCxChallenge(ri, +b2.getAttribute("data-ci")); });
      });
      // tap a city: the Gaffer scouts that club in the briefing box, and offers
      // the challenge right there. The map + the Gaffer ARE the interface now.
      (function () {
        var rr = FO_CX_REGIONS[ri], stt = foCxState();
        var liveR = !foCxConquered(stt, rr.id);
        var nCi = -1; if (liveR) for (var q = 0; q < rr.clubs.length; q++) if (!foCxBeaten(stt, rr.id, q)) { nCi = q; break; }
        var sp = page.querySelector("#fo-cx-brief-sp"), tx = page.querySelector("#fo-cx-brief-tx"), act = page.querySelector("#fo-cx-brief-act");
        var brief = page.querySelector("#fo-cx-brief");
        var show = function (ci2) {
          var c6 = rr.clubs[ci2], done6 = foCxBeaten(stt, rr.id, ci2), open6 = liveR && ci2 === nCi;
          if (sp) { sp.textContent = c6.nm + (c6.boss ? " · Boss" : ""); sp.style.color = rr.ac; }
          if (tx) tx.innerHTML = "&ldquo;" + E(c6.gq || (c6.city + " · " + c6.note)) + "&rdquo;";
          if (act) {
            if (done6) act.innerHTML = "<span class='fo-cx-won'>&#10003; " + E(c6.city) + " conquered</span>";
            else if (open6) act.innerHTML = "<button type='button' class='fo-cx-ch' data-ci='" + ci2 + "'>Challenge " + E(c6.nm) + " &#9654;</button>";
            else { var prev = rr.clubs[ci2 - 1]; act.innerHTML = "<span class='fo-cx-lock'>&#128274; Beat " + E(prev ? prev.city : "the others") + " first</span>"; }
            var cb = act.querySelector(".fo-cx-ch[data-ci]");
            if (cb) cb.addEventListener("click", function () { foCxChallenge(ri, +cb.getAttribute("data-ci")); });
          }
          if (brief) { brief.classList.remove("flash"); void brief.offsetWidth; brief.classList.add("flash"); }
        };
        page.querySelectorAll(".fo-cx-node[data-ci]").forEach(function (nd2) {
          nd2.addEventListener("click", function () { show(+nd2.getAttribute("data-ci")); });
        });
        // open on the next club to play, so the challenge is one tap away
        if (liveR && nCi >= 0) show(nCi);
      })();
      try { if (window.__foLive) window.__foLive.mask(); } catch (eM2) {}
    } catch (e) {}
  }
  setInterval(foRenderCircuit, 900);
  window.addEventListener("hashchange", function () { if (location.hash.indexOf("#/circuit") === 0) { foCxView = null; setTimeout(foRenderCircuit, 40); } });
  try { window.__foTest.cx = { state: foCxState, team: foCxTeam, challenge: foCxChallenge, record: foCxRecord, key: foCxKey }; } catch (eCx) {}

  // ==========================================================================
  //  THE CLUB STORY - narrative engine v1. The simulation writes the story:
  //  real results generate moments, promises are remembered and visibly kept
  //  or broken, the captain and the youngest pro get arcs, and Thorne needles
  //  you about things that ACTUALLY happened. Everything here is client-side
  //  colour - story variables gate scenes and copy, never match numbers.
  // ==========================================================================
  function foStKey() { return "fo_story_" + ((SYNC && SYNC.myMid) || "solo"); }
  function foStState() {
    try { var st = JSON.parse(lsGet(foStKey()) || "null"); if (st && st.vars) return st; } catch (e) {}
    return { vars: { board: 55, fans: 40, unity: 60, thorne: 8 }, promises: [], log: [], flags: {}, done: {}, queue: [], hook: null };
  }
  function foStSave(st) { try { lsSet(foStKey(), JSON.stringify(st)); } catch (e) {} }
  function foStRound() { return (App.season && App.season.round != null) ? App.season.round : 0; }
  function foStVar(st, k, d) { st.vars[k] = Math.max(0, Math.min(100, Math.round((st.vars[k] || 0) + d))); }
  function foStLog(st, kind, txt) {
    st.log.unshift({ s: App.seasonNo || 1, r: foStRound(), kind: kind, txt: txt });
    if (st.log.length > 60) st.log = st.log.slice(0, 60);
  }
  function foStPromise(st, id, txt, due) {
    if (st.promises.some(function (p) { return p.id === id; })) return;
    st.promises.push({ id: id, txt: txt, due: due, status: "active", made: foStRound() });
  }
  function foStProm(st, id) { return st.promises.filter(function (p) { return p.id === id; })[0]; }
  // the recurring cast: who is speaking, and with whose face
  function foStFace(who) {
    if (who === "thorne") return { nm: "Reggie Thorne", img: FO_ART + "thorne.png" };
    if (who === "capt") { var c = foStCaptain(); return { nm: (c ? c.name : "Your captain"), img: FO_ART + "bat.png" }; }
    if (who === "kid") { var k = foStProspect(); return { nm: (k ? k.name : "The prospect"), img: FO_ART + "ar.png" }; }
    return { nm: "The Gaffer", img: FO_ART + "gaffer.png" };
  }
  function foStCaptain() {
    try {
      var me = userTeam(), best = null;
      (me.players || []).forEach(function (p) {
        if (p && p.origin_tag && /Franchise captain/.test(p.origin_tag)) best = best || p;
      });
      if (!best) (me.players || []).forEach(function (p) { if (p && (!best || (p.capt || 0) > (best.capt || 0))) best = p; });
      return best;
    } catch (e) { return null; }
  }
  function foStProspect() {
    try {
      var me = userTeam(), kid = null;
      (me.players || []).forEach(function (p) { if (p && (!kid || (p.age || 99) < (kid.age || 99))) kid = p; });
      return kid;
    } catch (e) { return null; }
  }
  // scene builders: the queue persists ids+data (functions don't survive
  // storage), and the builder recreates the live choices at display time
  var FO_ST_SCENES = {
    kidAsk: function (d) {
      return { who: "kid", txt: "Boss - " + d.age + " isn't too young. Give me one league match before Round 5. I'll do the rest.", choices: [
        { t: "You'll get your game", d: "A promise, on the record", fx: function (s2) { foStPromise(s2, "prospect", d.nm + " expects a league debut before Round 5", 4); foStVar(s2, "unity", 3); }, line: "Promise made: " + d.nm + " debuts before Round 5." },
        { t: "No promises", d: "Honest. Colder", fx: function (s2) { foStVar(s2, "unity", -2); foStVar(s2, "board", 2); }, line: "You promised the prospect nothing. He went back to the nets." }] };
    },
    kidThanks: function (d) {
      return { who: "kid", txt: "You kept your word, boss. Whatever happens now - I won't forget the day you gave me.", choices: [
        { t: "You earned it", d: "The dressing room notices", fx: function (s2) { foStVar(s2, "unity", 2); } }] };
    },
    kidSulk: function (d) {
      return { who: "kid", txt: "Round " + d.dueR + " came and went, boss. I kept my head down, like you asked. My agent's stopped keeping his.", choices: [
        { t: "I owe you one", d: "Promise him the very next match", fx: function (s2) { foStPromise(s2, "prospect2", d.nm + " expects the very next league XI", foStRound() + 1); }, line: "You promised the kid the next match." },
        { t: "Form picks the team", d: "Unity falls further", fx: function (s2) { foStVar(s2, "unity", -3); }, line: "You told the prospect form picks the team." }] };
    },
    capTalk: function (d) {
      return { who: "capt", txt: d.runs + " in my last three. I know the numbers, boss - and I'm still the best man to walk out first when it hardens.", choices: [
        { t: "Back him", d: "Publicly. The room is watching", fx: function (s2) { s2.flags.capBacked = foStRound(); foStVar(s2, "unity", 4); }, line: "You backed the captain in public." },
        { t: "The hard talk", d: "Form rules, even for him", fx: function (s2) { foStVar(s2, "board", 3); foStVar(s2, "unity", -3); }, line: "You told the captain nobody outranks form." }] };
    },
    thorne3w: function (d) {
      return { who: "thorne", txt: "Three on the bounce. " + (d.topNm ? d.topNm + " carrying the bat for you - " + d.topR + " last time out. " : "") + "Yes, " + d.club + ", I watch the small leagues too. Enjoy the weather down there.", choices: [
        { t: "Fire back", d: "Supporters roar. Boards frown", fx: function (s2) { foStVar(s2, "fans", 5); foStVar(s2, "board", -2); foStVar(s2, "thorne", 3); }, line: "You answered Thorne in the Wire: \"Keep watching.\"" },
        { t: "Say nothing", d: "Let the table talk", fx: function (s2) { foStVar(s2, "thorne", 1); }, line: "Thorne needled the club. You let the table answer." }] };
    },
    valeOffer: function (d) {
      var mp = !!(SYNC && SYNC.started && !SYNC.practice);
      var ch;
      if (mp) ch = [{ t: "Note the name", d: "League rules bar mid-tour registrations", fx: function (s2) { foStVar(s2, "board", 1); }, line: "Arthur Vale, 21, of Marylebone. The board couldn't register him mid-tour. Remember the name." }];
      else ch = [
        { t: "Sign him - $45,000", d: "21. No promises. Judge him yourself", fx: function (s2) {
            try {
              var me3 = userTeam();
              if ((me3.players || []).length >= 18) { toast("Squad is full (18) - Vale stays in county cricket.", "error"); return; }
              if (App.fin && (App.fin.bank || 0) < 45000) { toast("The bank won't cover his fee.", "error"); return; }
              var rnd3 = window.rng(foHash32("vale|" + me3.name));
              var v = foQsPlayer({ role: "topOrderBat", age: 21, q: 0.52 }, "England", rnd3, {}, {});
              v.name = "Arthur Vale";
              if (v.skills) { v.skills.temperament = Math.min(96, (v.skills.temperament || 40) + 10); v.skills.vsPace = Math.min(96, (v.skills.vsPace || 40) + 6); }
              v.fatigue = "rested"; v.formIx = 3; delete v.fee;
              v._prov = { how: "scout", nat: "England" }; v.origin_tag = "Found in county cricket, signed on the England tour";
              try { jsDerive(v); } catch (e3) {}
              me3.players.push(v);
              if (App.fin) App.fin.bank = (App.fin.bank || 0) - 45000;
              try { var cxV = foCxState(); cxV.flags = cxV.flags || {}; cxV.flags.valeSigned = 1; foCxSave(cxV); } catch (e4) {}
              try { if (typeof window.saveGame === "function") window.saveGame(false); } catch (e5) {}
              toast("Arthur Vale joins the squad. Pemberley will not be pleased.");
            } catch (e6) {}
          }, line: "Signed: Arthur Vale, 21, from under Pemberley's nose. $45,000." },
        { t: "Let him be", d: "If he's real, he'll play for the boss", fx: function (s2) {}, line: "You passed on Arthur Vale. If he's the real thing, Pemberley has him now." }];
      return { who: "gaffer", txt: "Scout's note, boss. Arthur Vale, twenty-one, bats top three for a village side - 137 not out against the county attack last month. Wants $45,000 and a real shirt. That's what I know. The judging is yours.", choices: ch };
    },
    scorebook: function (d) {
      return { who: "gaffer", txt: "Where'd you find that? ...An old scorebook, that's all. Marylebone seconds, twenty years back. Yes, that's my name in the bowling column. Yes, that's Thorne's beside it. Another time, boss. Pemberley first.", choices: [
        { t: "Another time, then", d: "The story goes in the club record", fx: function (s2) { foStLog(s2, "mystery", "An old scorebook, found near Leeds: the Gaffer and Thorne, on the same Marylebone card, twenty years ago."); }, line: null }] };
    },
    gtReveal1: function (d) {
      return { who: "gaffer", txt: "Alright. You've earned one answer. Thorne and I came up together - same club, same season, same dressing room. He batted, I bowled, and for one summer nobody in England could touch us. What broke it... that's a longer innings. Five more regions, boss.", choices: [
        { t: "Five more regions", d: "Revelation one of six", fx: function (s2) { foStLog(s2, "mystery", "Revelation I: the Gaffer and Thorne were teammates - one golden summer at Marylebone before it all went wrong."); foStVar(s2, "unity", 2); } }] };
    },
    thorneCx: function (d) {
      var t = d.first ? "One trophy. Try not to mistake arrival for importance." : ("So " + d.region + " falls too. The collection grows - and so does the file I keep on you.");
      return { who: "thorne", txt: t, choices: [
        { t: "Frame it", d: "Supporters love the feud", fx: function (s2) { foStVar(s2, "fans", 3); foStVar(s2, "thorne", 1); }, line: "Thorne wired his congratulations, of a kind. The Wire printed it." },
        { t: "No reply", d: "Let the cabinet speak", fx: function (s2) { foStVar(s2, "thorne", 1); }, line: "Thorne noticed the conquest. You let the trophy answer." }] };
    },
    thorneJab: function (d) {
      return { who: "thorne", txt: d.club + ", " + d.my + " chasing " + d.opp + "? A word of advice, free of charge: identity is what you do when it's hard. Yours folded by the twentieth over.", choices: [
        { t: "We go again", d: "Calm. Unity holds", fx: function (s2) { foStVar(s2, "unity", 2); }, line: "Thorne mocked the defeat. You kept the room calm." },
        { t: "Fire back", d: "Fans up, pressure up", fx: function (s2) { foStVar(s2, "fans", 4); foStVar(s2, "thorne", 2); foStVar(s2, "board", -2); }, line: "You bit back at Thorne. The Wire loved it." }] };
    }
  };
  // one scene at a time, journey-styled: a speaker, a line, and real choices
  function foStScene(ref) {
    try {
      if (document.getElementById("fo-st-scene")) return false;
      var mkr = FO_ST_SCENES[ref.id]; if (!mkr) return true;   // unknown: drop it
      var sc = mkr(ref.data || {}); if (!sc) return true;
      var f = foStFace(sc.who);
      var m = document.createElement("div"); m.id = "fo-st-scene"; m.className = "fo-modal";
      m.innerHTML = "<div class='fo-modal-card'><div class='fo-modal-eyebrow'>Club story</div>" +
        "<div class='fo-j-gbox' style='max-width:none;margin:4px 0 10px'><img class='gf' src='" + f.img + "' alt=''>" +
        "<span class='bx'><span class='sp'>" + E(f.nm) + "</span><span class='tx'>&ldquo;" + E(sc.txt) + "&rdquo;</span></span></div>" +
        (sc.choices || []).map(function (c, i) {
          return "<button type='button' class='fo-st-ch' data-i='" + i + "'><b>" + E(c.t) + "</b>" + (c.d ? "<span>" + E(c.d) + "</span>" : "") + "</button>";
        }).join("") + "</div>";
      document.body.appendChild(m);
      m.querySelectorAll(".fo-st-ch").forEach(function (b) {
        b.addEventListener("click", function () {
          try {
            var ch = sc.choices[+b.getAttribute("data-i")];
            var st = foStState();
            if (ch.fx) ch.fx(st);
            if (ch.line) foStLog(st, "choice", ch.line);
            foStSave(st);
          } catch (e2) {}
          m.remove();
        });
      });
      return true;
    } catch (e) { return false; }
  }
  // -------- the fact miner: real league results -> story moments ------------
  function foStScan() {
    try {
      var me = userTeam(); if (!me || !me.name) return;
      var st = foStState(), changed = false;
      var mine = (App.results || []).filter(function (r) {
        return r && r.comp === "league" && r.result && (r.home === me.name || r.away === me.name);
      });
      var kid = foStProspect(), cap = foStCaptain();
      mine.forEach(function (r, ix) {
        var sig = (r.round != null ? r.round : ix) + "|" + ((r.result && r.result.text) || "");
        if (st.done[sig]) return;
        st.done[sig] = 1; changed = true;
        var win = r.result.winner === me.name;
        var myCards = [], opCards = [];
        (r.scorecard || []).forEach(function (inn) {
          if (!inn) return;
          if (inn.batTeam === me.name) myCards.push(inn); else opCards.push(inn);
        });
        // centuries and five-fors, named and remembered
        myCards.forEach(function (inn) {
          (inn.batting || []).forEach(function (b) {
            if (b.r >= 100) { foStLog(st, "moment", b.name + " " + b.r + " (" + b.b + ") vs " + (r.home === me.name ? r.away : r.home) + " - a century for the museum wall."); foStVar(st, "fans", 4); }
          });
        });
        opCards.forEach(function (inn) {
          (inn.bowling || []).forEach(function (bw) {
            if (bw.w >= 5) { foStLog(st, "moment", bw.name + " " + bw.w + "-" + bw.r + " vs " + (r.home === me.name ? r.away : r.home) + " - a five-for."); foStVar(st, "fans", 3); }
          });
        });
        // a defended total under 220: the kind of win supporters retell
        if (win && myCards[0] && opCards[0] && myCards[0].runs < 220 && (r.scorecard || [])[0] === myCards[0]) {
          foStLog(st, "moment", "Defended " + myCards[0].runs + " - the Wire calls it the wall of " + me.name + ".");
          foStVar(st, "board", 3);
        }
        // prospect promise: a debut before the deadline?
        var pr = foStProm(st, "prospect");
        if (pr && pr.status === "active" && kid) {
          var played = myCards.concat(opCards).some(function (inn) {
            return (inn.batting || []).some(function (b) { return b.name === kid.name; }) ||
                   (inn.bowling || []).some(function (b2) { return b2.name === kid.name; });
          });
          if (played) {
            pr.status = "fulfilled"; foStVar(st, "unity", 6); foStVar(st, "fans", 3);
            foStLog(st, "promise", "Promise kept: " + kid.name + " got his debut, as you said he would.");
            st.queue.push({ id: "kidThanks", data: {} });
          } else if ((r.round || 0) + 1 >= (pr.due || 5) && pr.status === "active") {
            pr.status = "broken"; foStVar(st, "unity", -7);
            foStLog(st, "promise", "Promise broken: " + kid.name + " never saw the field before Round " + ((pr.due || 5) + 1) + ".");
            st.queue.push({ id: "kidSulk", data: { nm: kid.name, dueR: (pr.due || 5) + 1 } });
          }
        }
        // captain watch: three lean league innings in a row
        if (cap) {
          var capKnock = null;
          myCards.forEach(function (inn) { (inn.batting || []).forEach(function (b) { if (b.name === cap.name) capKnock = b; }); });
          if (capKnock) {
            st.flags.capRuns = (st.flags.capRuns || []).concat([capKnock.r]).slice(-3);
            if (st.flags.capBacked != null) {
              // the callback: you backed him publicly - what did he do next?
              if (capKnock.r >= 40) { foStLog(st, "arc", cap.name + " answered with " + capKnock.r + ". Backing him looks like leadership now."); foStVar(st, "unity", 4); foStVar(st, "fans", 3); }
              else if (capKnock.r < 15) { foStLog(st, "arc", cap.name + " fell for " + capKnock.r + " after you backed him. The Wire sharpens its knives."); foStVar(st, "board", -4); }
              delete st.flags.capBacked;
            }
            if (!st.flags.capTalk && st.flags.capRuns.length === 3 && st.flags.capRuns.every(function (x) { return x < 20; })) {
              st.flags.capTalk = 1;
              st.queue.push({ id: "capTalk", data: { nm: cap.name, runs: st.flags.capRuns.join(", ") } });
            }
          }
        }
        // streaks - and Thorne, who was watching the whole time
        st.flags.form = ((st.flags.form || "") + (win ? "W" : "L")).slice(-5);
        if (/WWW$/.test(st.flags.form) && !st.flags.thorne3w) {
          st.flags.thorne3w = 1;
          var top = null;
          myCards.forEach(function (inn) { (inn.batting || []).forEach(function (b) { if (!top || b.r > top.r) top = b; }); });
          st.queue.push({ id: "thorne3w", data: { club: me.name, topNm: top && top.name, topR: top && top.r } });
        }
        if (!win && myCards[0] && opCards[0]) {
          var margin = (opCards[0].runs || 0) - (myCards[0].runs || 0);
          var sigL = "thorneJab" + (r.round != null ? r.round : ix);
          if (margin >= 60 && !st.flags[sigL] && !st.flags.thorneJabbed) {
            st.flags[sigL] = 1; st.flags.thorneJabbed = 1;
            st.queue.push({ id: "thorneJab", data: { club: me.name, my: myCards[0].runs, opp: opCards[0].runs } });
          }
        }
      });
      // the prospect asks - once, early in the season
      if (!st.flags.kidAsked && kid && mine.length >= 1 && (kid.age || 99) <= 25) {
        st.flags.kidAsked = 1; changed = true;
        st.queue.push({ id: "kidAsk", data: { nm: kid.name, age: kid.age } });
      }
      // the session hook: the next unresolved thing, always visible
      var act = st.promises.filter(function (p) { return p.status === "active"; })[0];
      st.hook = act ? ("Next: " + act.txt + " (Round " + ((act.due || 0) + 1) + " deadline).")
        : (st.queue.length ? "Next: someone wants a word - see the club story." : null);
      if (changed || st.queue.length) foStSave(st);
    } catch (e) {}
  }
  // scenes fire on the club pages, one at a time, never over a live match
  setInterval(function () {
    try {
      foStScan();
      if (!/^#\/(club|story)/.test(location.hash || "#/club")) return;
      if (typeof M !== "undefined" && M && !M.done) return;
      if (document.querySelector(".fo-modal") || document.getElementById("fo-onb")) return;
      var st = foStState();
      if (!st.queue.length) return;
      var sc = st.queue[0];
      if (foStScene(sc)) { st.queue.shift(); foStSave(st); }
    } catch (e) {}
  }, 3000);
  // -------- the Club Story page (#/story) -----------------------------------
  function foRenderStory() {
    try {
      if (location.hash.indexOf("#/story") !== 0) return;
      var page = document.getElementById("page"); if (!page) return;
      var st = foStState();
      var sig = "st|" + JSON.stringify(st.vars) + "|" + st.promises.length + "|" + st.log.length + "|" + (st.hook || "");
      if (page.__foStSig === sig && page.querySelector(".fo-story")) return;
      page.__foStSig = sig;
      var meter = function (lbl, v, col) {
        return "<div class='fo-st-m'><span>" + lbl + "</span><i><b style='width:" + Math.max(3, Math.min(100, v)) + "%;background:" + col + "'></b></i><em>" + v + "</em></div>";
      };
      var proms = st.promises.length ? st.promises.map(function (p) {
        var cls = p.status === "fulfilled" ? "ok" : p.status === "broken" ? "bad" : "on";
        var word = p.status === "active" ? "ACTIVE" : p.status.toUpperCase();
        return "<div class='fo-st-p " + cls + "'><i>" + word + "</i><span>" + E(p.txt) + "</span></div>";
      }).join("") : "<div class='small' style='color:#8a90a0'>No promises on the books. They start the moment you make one.</div>";
      var logs = st.log.length ? st.log.map(function (L) {
        return "<div class='fo-st-l'><i>R" + ((L.r || 0) + 1) + "</i><span>" + E(L.txt) + "</span></div>";
      }).join("") : "<div class='small' style='color:#8a90a0'>The story writes itself from real matches - play one.</div>";
      page.innerHTML = "<div class='fo-story'>" +
        "<div class='fo-cx-rule'><i></i><b>THE CLUB STORY</b><i></i></div>" +
        "<h1 class='fo-cx-h1' style='text-align:center'>" + E((userTeam() || {}).name || "Your club") + "</h1>" +
        (st.hook ? "<div class='fo-st-hook'>" + E(st.hook) + "</div>" : "") +
        "<div class='fo-st-vars'>" +
        meter("Board confidence", st.vars.board, "#2F6FBF") + meter("Supporters", st.vars.fans, "#C8674A") +
        meter("Dressing room", st.vars.unity, "#2E7A3C") + meter("Thorne's respect", st.vars.thorne, "#7B45C4") +
        "</div>" +
        "<div class='fo-cx-sec'><i></i>Promises<i></i></div><div class='fo-st-proms'>" + proms + "</div>" +
        "<div class='fo-cx-sec'><i></i>The story so far<i></i></div><div class='fo-st-logs'>" + logs + "</div>" +
        "</div>";
    } catch (e) {}
  }
  setInterval(foRenderStory, 900);
  (function foStCss() {
    if (document.getElementById("fo-st-css")) return;
    var el = document.createElement("style"); el.id = "fo-st-css";
    el.textContent =
      ".fo-story{max-width:680px;margin:0 auto;padding:8px 2px 30px}" +
      ".fo-st-hook{max-width:560px;margin:10px auto 4px;text-align:center;background:#FBF7EA;border:1px dashed #C9A24B;border-radius:10px;padding:9px 14px;font-size:13.5px;color:#6b5d33;font-weight:600}" +
      ".fo-st-vars{display:grid;grid-template-columns:1fr 1fr;gap:9px 22px;max-width:620px;margin:16px auto 0}" +
      "@media(max-width:560px){.fo-st-vars{grid-template-columns:1fr}}" +
      ".fo-st-m{display:flex;align-items:center;gap:10px;font-family:Oswald,sans-serif;font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#5b6472}" +
      ".fo-st-m span{flex:0 0 128px;text-align:left}" +
      ".fo-st-m i{flex:1;height:9px;border-radius:99px;background:rgba(16,27,45,.1);overflow:hidden;font-style:normal}" +
      ".fo-st-m i b{display:block;height:100%;border-radius:99px}" +
      ".fo-st-m em{font-style:normal;flex:0 0 26px;text-align:right;font-size:13px;color:#101B2D}" +
      ".fo-st-proms,.fo-st-logs{display:flex;flex-direction:column;gap:8px}" +
      ".fo-st-p{display:flex;gap:11px;align-items:center;background:#FFFEFC;border:1.5px solid rgba(16,27,45,.14);border-radius:11px;padding:9px 13px;font-size:14px;color:#101B2D;text-align:left}" +
      ".fo-st-p i{font-style:normal;font-family:Oswald,sans-serif;font-size:9.5px;letter-spacing:1.6px;font-weight:600;border-radius:20px;padding:2.5px 9px;flex:0 0 auto}" +
      ".fo-st-p.on i{color:#8a7b4f;border:1.5px solid #C9A24B}" +
      ".fo-st-p.ok i{color:#fff;background:#3E9455}" +
      ".fo-st-p.bad i{color:#fff;background:#B23A2E}" +
      ".fo-st-l{display:flex;gap:11px;align-items:flex-start;font-size:13.5px;color:#4a5568;text-align:left;padding:3px 2px}" +
      ".fo-st-l i{font-style:normal;font-family:Oswald,sans-serif;font-size:10.5px;letter-spacing:1px;color:#C8674A;flex:0 0 30px;margin-top:2px}" +
      "html body .fo-st-ch,html body.ftpskin .fo-st-ch{display:block;width:100%;text-align:left;background:#FFFEFC !important;border:1.5px solid rgba(16,27,45,.18) !important;border-radius:11px;padding:10px 14px;margin-top:8px;cursor:pointer;font:inherit;color:#101B2D !important}" +
      "html body .fo-st-ch:hover,html body.ftpskin .fo-st-ch:hover{border-color:#C8674A !important;background:#FFFEFC !important}" +
      ".fo-st-ch b{display:block;font-size:14.5px}.fo-st-ch span{display:block;font-size:12px;color:#8a90a0;margin-top:1px}" +
      ".fo-st-chip{display:inline-block;margin-top:7px;font-size:12.5px;color:#C8674A;text-decoration:underline dotted;cursor:pointer}";
    document.head.appendChild(el);
  })();
  try { window.__foTest.story = { state: foStState, scan: foStScan, key: foStKey, save: foStSave }; } catch (eSt2) {}

  // Intentional export surface for the campaign bundle (client/src/**): a
  // thin, read-mostly bridge so modular code can reuse overlay plumbing
  // without reaching into this IIFE. Everything here already exists above.
  try {
    window.__foGame = {
      art: FO_ART,
      gen: foQsPlayer,
      squad: foGenArchetypeSquad,
      mini: foPkMini,
      ovr: foPkOvr,
      crest: foJCrest,
      hash: foHash32,
      challenge: foChallenge,
      pitchName: foPitchName,
      pushPacket: foPushCurrentPacket,
      story: { state: foStState, save: foStSave, log: foStLog, varAdj: foStVar },
      // headless full match between two arbitrary team objects through the
      // REAL engine (newMatch + autoPick/stepBall — the same logic every
      // match uses). isUserMatch stays false so App.orders never applies;
      // onMatchEnd is suppressed so nothing leaks into App.results,
      // player history or fatigue. Same pattern as the engine's own
      // simBackground and the overlay's practice broadcast.
      simWorld: function (tA, tB, pitch, weather, seed, ordersMap) {
        var prevM = null, prevToss = null, prevOME = null, ok = false;
        try { prevM = M; } catch (e0) {}
        try { prevToss = App.tossState; } catch (e1) {}
        try {
          prevOME = window.onMatchEnd; window.onMatchEnd = function () {};
          M = newMatch(tA, tB, pitch, (seed >>> 0) || 1);
          M.meta = { home: tA.name, away: tB.name, pitch: pitch, weather: weather || "Sunny", comp: "world", isUser: false };
          M.isUserMatch = false;
          // per-team orders (captain, keeper, batting order, phase intent):
          // this is how NPC managers' decisions reach actual deliveries —
          // ordersFor(teamName) consults M.ordersMap before anything else
          M.ordersMap = ordersMap || {};
          App.tossState = { stage: "x" };
          var aiBats = aiTossDecision();
          applyToss(aiBats);
          var g = 0;
          while (M && !M.done && g++ < 3000) { autoPick(); stepBall(); }
          ok = !!(M && M.done && M.result);
          return ok ? { innings: M.innings, result: M.result, batFirstTeam: M.batFirstTeam } : null;
        } catch (eSim) { return null; }
        finally {
          try { window.onMatchEnd = prevOME; } catch (e2) {}
          try { M = prevM; } catch (e3) {}
          try { App.tossState = prevToss; } catch (e4) {}
        }
      }
    };
  } catch (eXp) {}

  console.info("Fifty Overs League overlay ready.");
})();
