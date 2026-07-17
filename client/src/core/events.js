/* core/events — the canonical, append-only game event log.
 *
 * Every meaningful thing that happens is recorded as one event; the story
 * layer only ever REACTS to events (a lineup that was confirmed, a match
 * that finished) — it never invents facts. The log lives inside the
 * campaign save, capped so the save can't grow without bound.
 */
FOC.events = (function () {
  var CAP = 500;
  // canonical types (the story layer switches on these strings)
  var TYPES = ["ClubFounded", "CaptainAppointed", "LineupConfirmed", "PlayerSelected",
    "PlayerDropped", "PromiseMade", "PromiseFulfilled", "PromiseBroken",
    "MatchCompleted", "TransferOfferReceived", "RegionEntered", "RegionalBossDefeated",
    "PhilosophyChosen", "NoteWritten", "ChapterCompleted"];

  function emit(save, type, data) {
    save.events = save.events || [];
    var ev = { t: type, ch: save.ch, n: (save.evSeq = (save.evSeq || 0) + 1), data: data || {} };
    save.events.push(ev);
    if (save.events.length > CAP) save.events = save.events.slice(-CAP);
    return ev;
  }
  function ofType(save, type) {
    return (save.events || []).filter(function (e) { return e.t === type; });
  }
  return { TYPES: TYPES, emit: emit, ofType: ofType };
})();
