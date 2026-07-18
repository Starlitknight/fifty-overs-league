/* core/calendar — the season's shape: 15 weeks of league rounds, Founders
 * Cup rounds and the Crown Cup finale. Pure data; no HTML, no engine.
 * League defeats stand, cup defeats eliminate — the calendar never waits
 * for anybody.
 */
FOC.calendar = (function () {
  // kind: 'league' (round r), 'founders' (stage), 'crown' (stage)
  var WEEKS = [
    { w: 1, kind: "league", round: 1, label: "League · Round 1" },
    { w: 2, kind: "league", round: 2, label: "League · Round 2" },
    { w: 3, kind: "founders", stage: "playin", label: "Founders Cup · Play-in" },
    { w: 4, kind: "league", round: 3, label: "League · Round 3" },
    { w: 5, kind: "league", round: 4, label: "League · Round 4" },
    { w: 6, kind: "founders", stage: "qf", label: "Founders Cup · Quarter-finals" },
    { w: 7, kind: "league", round: 5, label: "League · Round 5" },
    { w: 8, kind: "league", round: 6, label: "League · Round 6" },
    { w: 9, kind: "founders", stage: "sf", label: "Founders Cup · Semi-finals" },
    { w: 10, kind: "league", round: 7, label: "League · Round 7" },
    { w: 11, kind: "league", round: 8, label: "League · Round 8" },
    { w: 12, kind: "founders", stage: "final", label: "Founders Cup · Final" },
    { w: 13, kind: "league", round: 9, label: "League · Round 9" },
    { w: 14, kind: "crown", stage: "sf", label: "Crown Cup · Semi-finals" },
    { w: 15, kind: "crown", stage: "final", label: "Crown Cup · Final" }
  ];
  var MONTHS = ["April", "April", "May", "May", "May", "June", "June", "June",
    "July", "July", "July", "August", "August", "September", "September"];

  function week(w) { return WEEKS[w - 1] || null; }
  function label(w) {
    var wk = week(w);
    return wk ? ("Week " + w + " · " + MONTHS[w - 1] + " · " + wk.label) : "Season over";
  }
  function total() { return WEEKS.length; }

  return { WEEKS: WEEKS, week: week, label: label, total: total };
})();
