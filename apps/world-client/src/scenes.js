/* world-client/scenes — data-driven scene definitions. A scene is a place:
 * a painted background, people standing in it, and hotspots the player
 * chooses between. Nothing here renders itself; the renderer reads this.
 * Conditions receive (w = world state, B = bridge facts).
 */
FOW.scenes = (function () {
  var S = {};

  function def(d) { S[d.id] = d; return d; }

  def({
    id: "station", region: "england", location: "home-town",
    bg: "loc.station.home.morning", label: "Harbour Town station",
    characters: [{ id: "gaffer", asset: "portrait.gaffer.serious", x: 66, y: 58,
      when: function (w) { return !w.flags.leftStation; } }],
    hotspots: [
      { id: "hs.station.timetable", x: 18, y: 44, label: "Timetable", kind: "look", dlg: "look.timetable", optional: true },
      { id: "hs.station.gaffer", x: 66, y: 46, label: "The waiting man", kind: "talk", dlg: "arrival.gaffer",
        when: function (w) { return !w.flags.metGaffer; } },
      { id: "hs.station.road", x: 46, y: 78, label: "The road to the ground", kind: "go", go: "home-exterior",
        when: function (w) { return !!w.flags.metGaffer; } }
    ]
  });

  def({
    id: "home-exterior", region: "england", location: "home-club",
    bg: "loc.home.exterior.morning", label: "The home ground",
    variant: function (w, B) {
      if (w.flags.firstMatchDone) return { bg: "loc.home.exterior.dusk", label: "The home ground · evening" };
      return null;
    },
    characters: [
      { id: "captain", asset: "cutout.player.bat", x: 24, y: 60,
        when: function (w) { return !w.flags.firstMatchDone && !w.flags.sawArgument; } },
      { id: "prospect", asset: "cutout.player.ar", x: 84, y: 62,
        when: function (w) { return !w.flags.firstMatchDone; } },
      { id: "gaffer", asset: "portrait.gaffer.neutral", x: 55, y: 58,
        when: function (w) { return !!w.flags.firstMatchDone; } }
    ],
    hotspots: [
      { id: "hs.home.pavdoor", x: 52, y: 40, label: "Pavilion door", kind: "go", go: "pavilion" },
      { id: "hs.home.honours", x: 38, y: 34, label: "Old honours board", kind: "look", dlg: "look.honours", optional: true },
      { id: "hs.home.argument", x: 24, y: 48, label: "Two players, arguing", kind: "talk", dlg: "meet.argument", optional: true,
        when: function (w) { return !w.flags.firstMatchDone && !w.flags.sawArgument; } },
      { id: "hs.home.prospect", x: 84, y: 50, label: "A lad bowling alone", kind: "talk", dlg: "meet.prospect", optional: true,
        when: function (w) { return !w.flags.firstMatchDone; } },
      { id: "hs.home.photo", x: 66, y: 30, label: "Faded photograph", kind: "look", dlg: "look.photo", optional: true },
      { id: "hs.home.volunteers", x: 12, y: 74, label: "Volunteers at the square", kind: "look", dlg: "look.volunteers", optional: true,
        when: function (w) { return !w.flags.firstMatchDone; } },
      { id: "hs.home.newspaper", x: 30, y: 72, label: "Evening paper", kind: "look", dlg: "post.newspaper", optional: true,
        when: function (w) { return !!w.flags.firstMatchDone; } },
      { id: "hs.home.gaffer.post", x: 55, y: 46, label: "The Gaffer", kind: "talk", dlg: "post.gaffer",
        when: function (w) { return !!w.flags.firstMatchDone && !w.flags.postGafferDone; } },
      { id: "hs.home.captain.post", x: 76, y: 66, label: "Your captain", kind: "talk", dlg: "post.captain", optional: true,
        when: function (w) { return !!w.flags.firstMatchDone; } },
      { id: "hs.home.map", x: 90, y: 84, label: "England map", kind: "go", go: "map",
        when: function (w) { return !!w.flags.founded; } }
    ]
  });

  def({
    id: "pavilion", region: "england", location: "home-club",
    bg: "loc.pavilion.interior", label: "The pavilion",
    characters: [{ id: "veteran", asset: "cutout.player.bat", x: 78, y: 60 }],
    hotspots: [
      { id: "hs.pav.veteran", x: 78, y: 48, label: "The senior pro", kind: "talk", dlg: "meet.veteran", optional: true },
      { id: "hs.pav.dressing", x: 24, y: 44, label: "Dressing room", kind: "go", go: "dressing" },
      { id: "hs.pav.office", x: 44, y: 42, label: "Secretary's office", kind: "go", go: "office" },
      { id: "hs.pav.trophy", x: 62, y: 42, label: "Trophy room", kind: "go", go: "trophy" },
      { id: "hs.pav.nets", x: 88, y: 78, label: "Out to the nets", kind: "go", go: "nets" },
      { id: "hs.pav.out", x: 10, y: 80, label: "Back outside", kind: "go", go: "home-exterior" },
      { id: "hs.pav.urn", x: 12, y: 38, label: "The tea urn", kind: "look", dlg: "look.urn", optional: true }
    ]
  });

  def({
    id: "dressing", region: "england", location: "home-club",
    bg: "loc.dressing.room", label: "The dressing room",
    characters: [
      { id: "keeper", asset: "cutout.player.keeper", x: 16, y: 60 },
      { id: "bowler", asset: "cutout.player.pace", x: 86, y: 60 }
    ],
    hotspots: [
      { id: "hs.dr.keeper", x: 16, y: 48, label: "The wicketkeeper", kind: "talk", dlg: "meet.keeper", optional: true },
      { id: "hs.dr.bowler", x: 86, y: 48, label: "The strike bowler", kind: "talk", dlg: "meet.bowler", optional: true },
      { id: "hs.dr.captaincy", x: 50, y: 36, label: "The armband question", kind: "talk", dlg: "choose.captain",
        when: function (w) { return !!w.flags.founded && !w.flags.captainChosen; } },
      { id: "hs.dr.board", x: 50, y: 52, label: "The lineup board", kind: "action", act: "lineup",
        when: function (w) { return !!w.flags.captainChosen; } },
      { id: "hs.dr.out", x: 8, y: 80, label: "Back to the pavilion", kind: "go", go: "pavilion" }
    ]
  });

  def({
    id: "nets", region: "england", location: "home-club",
    bg: "loc.nets", label: "The practice nets",
    characters: [{ id: "prospect", asset: "cutout.player.ar", x: 70, y: 58 }],
    hotspots: [
      { id: "hs.nets.prospect", x: 70, y: 46, label: "The prospect, still here", kind: "talk", dlg: "nets.prospect", optional: true },
      { id: "hs.nets.trial", x: 30, y: 46, label: "Raise a Trial XI", kind: "action", act: "trial",
        when: function (w) { return !!w.flags.captainChosen && !w.flags.firstMatchDone; } },
      { id: "hs.nets.out", x: 8, y: 80, label: "Back to the pavilion", kind: "go", go: "pavilion" }
    ]
  });

  def({
    id: "office", region: "england", location: "home-club",
    bg: "loc.secretary.office", label: "Margaret's office",
    characters: [{ id: "margaret", mono: "MH", x: 60, y: 56 }],
    hotspots: [
      { id: "hs.of.founding", x: 60, y: 42, label: "Margaret Hobb", kind: "talk", dlg: "founding.margaret",
        when: function (w) { return !w.flags.founded; } },
      { id: "hs.of.margaret", x: 60, y: 42, label: "Margaret Hobb", kind: "talk", dlg: "office.margaret", optional: true,
        when: function (w) { return !!w.flags.founded; } },
      { id: "hs.of.papers", x: 24, y: 40, label: "Committee papers", kind: "look", dlg: "look.papers", optional: true },
      { id: "hs.of.out", x: 8, y: 80, label: "Back to the pavilion", kind: "go", go: "pavilion" }
    ]
  });

  def({
    id: "trophy", region: "england", location: "home-club",
    bg: "loc.trophy.room", label: "The trophy room",
    characters: [{ id: "star", asset: "cutout.player.bat", x: 30, y: 60 }],
    hotspots: [
      { id: "hs.tr.star", x: 30, y: 48, label: "A batter, studying the shelf", kind: "talk", dlg: "meet.star", optional: true },
      { id: "hs.tr.shelf", x: 62, y: 38, label: "The empty shelf", kind: "look", dlg: "look.shelf", optional: true },
      { id: "hs.tr.out", x: 8, y: 80, label: "Back to the pavilion", kind: "go", go: "pavilion" }
    ]
  });

  def({
    id: "map", region: "england", location: "england",
    bg: "map.england.day", label: "England", isMap: true,
    hotspots: [
      { id: "hs.map.willowmere", x: 48, y: 46, label: "Willowmere · The Meadow", kind: "go", go: "wm-town",
        when: function (w, B) { return B.nextOpponentKey() === "willowmere" && !w.flags.firstMatchDone; } },
      { id: "hs.map.home", x: 58, y: 70, label: "Home", kind: "go", go: "home-exterior" },
      { id: "hs.map.career", x: 90, y: 88, label: "Season ledger", kind: "action", act: "career", optional: true }
    ]
  });

  def({
    id: "wm-town", region: "england", location: "willowmere",
    bg: "loc.willowmere.town", label: "Willowmere village",
    hotspots: [
      { id: "hs.wm.sign", x: 20, y: 40, label: "Village sign", kind: "look", dlg: "wm.sign", optional: true },
      { id: "hs.wm.ground", x: 62, y: 56, label: "The Meadow", kind: "go", go: "wm-ground" },
      { id: "hs.wm.home", x: 8, y: 82, label: "The train home", kind: "go", go: "map" }
    ]
  });

  def({
    id: "wm-ground", region: "england", location: "willowmere",
    bg: "loc.willowmere.ground", label: "The Meadow",
    characters: [{ id: "wm-manager", mono: "TM", x: 74, y: 58 }],
    hotspots: [
      { id: "hs.wmg.manager", x: 74, y: 46, label: "Ted Marsh, their manager", kind: "talk", dlg: "wm.manager", optional: true },
      { id: "hs.wmg.dressing", x: 30, y: 44, label: "Away dressing room", kind: "go", go: "wm-dressing" },
      { id: "hs.wmg.back", x: 8, y: 82, label: "Back to the village", kind: "go", go: "wm-town" }
    ]
  });

  def({
    id: "wm-dressing", region: "england", location: "willowmere",
    bg: "loc.willowmere.dressing", label: "Away dressing room",
    hotspots: [
      { id: "hs.wmd.board", x: 50, y: 44, label: "Pin up the XI", kind: "action", act: "lineup" },
      { id: "hs.wmd.entry", x: 84, y: 70, label: "To the field", kind: "go", go: "wm-entry",
        when: function (w, B) { return B.xiConfirmed(); } },
      { id: "hs.wmd.back", x: 8, y: 82, label: "Back outside", kind: "go", go: "wm-ground" }
    ]
  });

  def({
    id: "wm-entry", region: "england", location: "willowmere",
    bg: "loc.willowmere.entry", label: "The players' gate",
    hotspots: [
      { id: "hs.wme.walk", x: 50, y: 55, label: "Walk out", kind: "action", act: "walkout" },
      { id: "hs.wme.back", x: 8, y: 82, label: "One more minute", kind: "go", go: "wm-dressing" }
    ]
  });

  function get(id) { return S[id] || null; }
  function all() { return S; }
  return { get: get, all: all };
})();
