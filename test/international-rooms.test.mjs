// test/international-rooms.test.mjs — A TOUR IS A MATCH, SO IT GETS THE ROOMS.
//
// Every fixture in the game has three: the build-up before it, the broadcast
// during it, the report after it. A league round has all three. A friendly has
// all three. A tour had exactly one - the broadcast - so the one week of the
// season a manager WATCHES rather than plays was the week with nothing to read
// before the first ball and nothing to read after the last.
//
// It has all three now, and nothing about it is special-cased. There is one
// thing it will never have and must never pretend to: a team sheet. The
// selectors are autonomous - ensureCallups names the fifteen and they stand
// for the series - so the build-up says who they picked rather than asking the
// manager to pick.
//
// This holds both new rooms: the preview's reading of the calendar, and the
// report's dressing of the umpire's card.
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeEngine } from './engine-vm.mjs';

const eng = makeEngine();
const W = eng.ctx.window || eng.ctx;
const src = f => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..',
  'engine', 'src', 'league', f), 'utf8');

// a page the way the room writes to one: it takes an innerHTML and remembers it
const newPage = () => ({ innerHTML: '', querySelector: () => null, querySelectorAll: () => [] });

const man = (name, club, slot, age, caps) => ({ name, club, slot, age, caps });
const PARTY_A = [
  man('Rashid Noor', 'Kabul Kings', 0, 27, 14), man('Wais Achak', 'Herat', 1, 22, 3),
  man('Delawar Sahak', 'Kabul Kings', 0, 31, 40), man('Naveed Amiri', 'Balkh', 2, 19, 0)
];
const PARTY_H = [
  man('Callum Ord', 'Grange', 0, 29, 22), man('Ewan Dunlop', 'Watsonians', 1, 24, 1),
  man('Struan Bell', 'Grange', 0, 33, 51)
];

const BOOK = {
  hourUtc: 18, seriesLen: 3, windows: [3, 5, 7, 9, 11, 13],
  nations: {
    afg: { id: 'afg', name: 'Afghanistan', seasonNo: 1, tourSquad: PARTY_A, squad: PARTY_A,
           tours: [{ a: 'Afghanistan XI', b: 'Scotland XI', winner: 'Scotland XI' }] },
    sco: { id: 'sco', name: 'Scotland', seasonNo: 1, tourSquad: PARTY_H, squad: PARTY_H,
           tours: [{ a: 'Afghanistan XI', b: 'Scotland XI', winner: 'Scotland XI' }] }
  },
  calendar: {
    seasonNo: 1,
    series: [
      { away: 'afg', home: 'sco', host: 'sco', teams: ['afg', 'sco'],
        names: ['Afghanistan', 'Scotland'], title: 'Afghanistan tour of Scotland',
        rounds: [3, 5, 7],
        series: { of: 3, played: 1, verdict: 'Scotland lead the series 1-0',
                  games: [{ id: 'nat:d2:g1', round: 3, winner: 'Scotland XI',
                            text: 'Scotland XI win by 4 wickets (9 balls left)' }] } }
    ]
  }
};

const preview = round => {
  const p = newPage();
  const ok = eng.ctx.foRenderIntlPreview(p, BOOK, 'afg', 'sco', round);
  return { ok, html: String(p.innerHTML || '') };
};

// ---- THE BUILD-UP ---------------------------------------------------------

test('the address names the tie and the window round, and finds it', () => {
  const t = eng.ctx.foPmIntlTie(BOOK, 'afg', 'sco', 5);
  assert.ok(t, 'the fifth round is the second game of this series');
  assert.equal(t.leg, 2);
  assert.equal(t.of, 3);
  assert.equal(t.game, null, 'and it has not been bowled');
  const t1 = eng.ctx.foPmIntlTie(BOOK, 'afg', 'sco', 3);
  assert.ok(t1.game && t1.game.id === 'nat:d2:g1', 'the third round has been');
  assert.equal(eng.ctx.foPmIntlTie(BOOK, 'afg', 'sco', 4), null, 'a round nobody tours in is not a tie');
  assert.equal(eng.ctx.foPmIntlTie(BOOK, 'sco', 'afg', 3), null, 'and the tour is not reversible - Scotland do not host in Kabul');
});

test('the room paints the tie, the series and the hour', () => {
  const { ok, html } = preview(5);
  assert.ok(ok, 'the preview renders');
  assert.match(html, /Afghanistan tour of Scotland/, 'the tour is billed by name');
  assert.match(html, />Afghanistan</, 'the tourists are named');
  assert.match(html, />Scotland</, 'and the hosts');
  assert.match(html, /Touring/, 'who is touring');
  assert.match(html, /Hosts/, 'and who is hosting');
  assert.match(html, /Game 2 of 3/, 'which game of the three this is');
  assert.match(html, /Scotland lead the series 1-0/, 'where the series stands');
  assert.match(html, /First ball/, 'and when the first ball is');
  assert.match(html, /UTC/, 'pinned to the world clock as well as the reader\'s');
});

test('no team sheet is offered, because nobody files one', () => {
  const { html } = preview(5);
  assert.ok(!/team sheet/i.test(html), 'the room never asks for a sheet');
  assert.ok(!/#\/orders/.test(html), 'and never sends the reader to file one');
  // the paragraph explaining that the selectors pick came out: a room with no
  // sheet in it does not need a note saying so, and the space is the squads'
  assert.ok(!/Who picks the side/.test(html), 'and does not lecture about it either');
});

test('the series stands at a scoreline, not a sentence', () => {
  const { html } = preview(5);
  // Afghanistan (touring) 0, Scotland (hosts) 1, best of three
  // the fixture carries no win counts, so this also proves the fallback: the
  // figure is walked off the games rather than quietly reading 0-0 above a
  // sentence that says otherwise
  assert.match(html, /class='fo-pm-big'>0&#8211;1 <em>\(Best of 3\)<\/em>/,
    'the touring side leads the figure, because it leads the billing');
  assert.ok(!/Nothing has been bowled/.test(html), 'the old sentence is gone');
  // a series with nothing bowled reads the same way rather than differently
  const fresh = { ...BOOK, calendar: { seasonNo: 1, series: [
    { ...BOOK.calendar.series[0], series: { of: 3, played: 0, verdict: null, games: [] } }] } };
  const p = newPage();
  eng.ctx.foRenderIntlPreview(p, fresh, 'afg', 'sco', 5);
  assert.match(String(p.innerHTML), /class='fo-pm-big'>0&#8211;0 <em>\(Best of 3\)<\/em>/,
    'nought-all before a ball is bowled');
});

test('the conditions are the umpire\'s own, and never invented', () => {
  const { html } = preview(5);
  // runTours passes 'balanced' literally and no weather, so a tour is played
  // on a true pitch under a clear sky - every tour, every window
  assert.match(html, /Pitch report/, 'the pitch is reported');
  assert.match(html, /class='fo-pm-big'>Balanced<\/div>/, 'and it is the one the umpire plays with');
  assert.match(html, /class='fo-pm-big'>Sunny<\/div>/, 'as is the weather');
  assert.match(html, /the same for both sides and the same every window/,
    'and the page says why it never varies rather than pretending it does');
});

test('the bar is offered, and it says who is stronger the same way every time', () => {
  const { html } = preview(5);
  assert.match(html, /id='fo-pm-wp'/, 'the win probability has a home on the page');
  assert.match(html, /Win probability &middot; projected/, 'labelled as a projection');
  const src51 = src('51-prematch.js');
  // forty playings could not tell a four-per-cent gap from noise: the same
  // fixture came out anywhere from 32% to 65% depending on the seeds drawn,
  // so the odds are read off the squads and never move
  assert.ok(!/simWorld/.test(src51), 'the preview no longer plays the fixture out at all');
  // PINNED SO IT CANNOT DRIFT BY ACCIDENT, which is all this line is for. The
  // value moved from 16250 when the curve was re-fitted against the engine's
  // measured win rate. NOTE: that fit was taken BEFORE the standard term went
  // in, so the published bar and the ball loop are not yet known to agree -
  // re-measuring the curve against v3 is outstanding work, and this pin will
  // have to move again when it is done.
  assert.match(src51, /var FO_PM_ODDS_S = 13175;/, 'the curve is the engine\'s own, measured');
  assert.match(src51, /var FO_PM_ODDS_H = 525;/, 'and so is what the ground is worth');
  assert.match(src51, /window\.foPmStrength = function/, 'strength is the eleven that will take the field');
  assert.match(src51, /world_squads\?country_id=eq\./, 'read off the world\'s published cards');
});

test('the touring party is listed, man by man, with his club and his caps', () => {
  const { html } = preview(5);
  PARTY_A.concat(PARTY_H).forEach(m => {
    assert.ok(html.indexOf(m.name) >= 0, m.name + ' is named');
    assert.ok(html.indexOf(m.club) >= 0, 'and the club he was taken from');
  });
  assert.match(html, /14 caps/, 'a capped man carries his tally');
  assert.match(html, /uncapped/, 'and an uncapped one says so');
  assert.match(html, /1 cap</, 'one cap is not "1 caps"');
});

// THE SIDE IS "SCOTLAND XI"; THE NATION IS "SCOTLAND". The umpire banks a tour
// under the side names, so anything reading a nation's form off its own tours
// has to know both spellings - and the nations page, which did not, showed an
// empty form strip for all sixteen nations for as long as it had one.
test('a nation\'s form is read off its tours, which are banked under the side name', () => {
  const { html } = preview(5);
  const beads = html.split("class='fo-pm-beads'")[1].split('</span></span>')[0];
  assert.match(beads, /class='l'/, 'Afghanistan lost that one');
  assert.ok(!/no tours yet/.test(beads), 'and are not reported as having never played');
  const src46 = src('46-nations.js');
  assert.match(src46, /isUs9 = function/, 'the nations page reads both spellings too');
});

test('the series is walked game by game: what is bowled opens its report, what is not says when', () => {
  const { html } = preview(5);
  assert.match(html, /href='#\/report\?nat=nat%3Ad2%3Ag1'/, 'the bowled game opens the tour report');
  // a fixture list says SCHEDULED; "this one" and "to come" are not how a
  // scoreboard writes, and the previewed row is marked by its accent instead
  assert.equal((html.match(/<span>Scheduled<\/span>/g) || []).length, 2,
    'the two unbowled games read as scheduled');
  assert.ok(!/This one|To come/.test(html), 'and neither says "this one" or "to come"');
  assert.match(html, /class='fo-pm-h2h flat now'/, 'the previewed game is marked by its accent');
  assert.ok(!/href='#\/report\?nat='/.test(html), 'an unbowled game is never a door to an empty report');
});

// A ROUND NUMBER IS NOT A DATE. "Round 5" made the reader do calendar
// arithmetic to find out when his cricketers are away from the club.
test('every game of the series carries the day and the hour it is bowled', () => {
  const { html } = preview(5);
  const rows = html.split(/class='fo-pm-h2h[' ]/).slice(1);
  assert.equal(rows.length, 3, 'three games');
  rows.forEach((r, i) => {
    const stamp = (r.match(/<u>([^<]*)<\/u>/) || [])[1] || '';
    assert.match(stamp, /\d/, 'game ' + (i + 1) + ' is dated: ' + JSON.stringify(stamp));
    assert.match(stamp, /&middot;/, 'with an hour beside the day: ' + JSON.stringify(stamp));
  });
});

test('the header names the date as well as the tour', () => {
  const { html } = preview(5);
  const folio = html.split("class='fo-pm-folio'")[1].split('</div>')[0];
  assert.match(folio, /Afghanistan tour of Scotland/, 'the tour is named');
  assert.match(folio, /<em>[^<]*\d[^<]*<\/em>/, 'and dated, at the very top of the page');
});

test('every man in a party wears the flag he plays under', () => {
  const { html } = preview(5);
  const men = html.split("class='fo-pm-cap-man").slice(1);
  assert.equal(men.length, PARTY_A.length + PARTY_H.length, 'every man has a row');
  men.forEach(m => assert.match(m, /class='fo-pm-mfl' src='[^']*flags\//, 'and a flag on it'));
});

test('a side is a squad number, not a table of tallies', () => {
  const { html } = preview(5);
  assert.ok(!/CAPPED/.test(html), 'capped and uncapped counts came off the side rows');
  assert.ok(!/men from \d+ clubs/.test(html), 'and so did the men-from-clubs line');
  assert.match(html, /<u>SQUAD<b>4<\/b><\/u>/, 'the squad number stays');
});

test('the game already bowled sends the reader to its broadcast, not back here', () => {
  const { html } = preview(3);
  assert.match(html, /href='#\/feed\?nat=nat%3Ad2%3Ag1'/, 'the broadcast is offered when there is one');
  const later = preview(7);
  assert.ok(!/#\/feed\?nat=/.test(later.html), 'and never for a game the umpire has not played');
});

test('a tie the calendar does not deal has no room', () => {
  const p = newPage();
  assert.equal(eng.ctx.foRenderIntlPreview(p, BOOK, 'afg', 'sco', 9), false, 'a round outside the series');
  assert.equal(eng.ctx.foRenderIntlPreview(p, BOOK, 'ire', 'pak', 5), false, 'a tie not in the calendar');
  assert.equal(eng.ctx.foRenderIntlPreview(p, null, 'afg', 'sco', 5), false, 'and a book that has not arrived');
});

test('the first ball is the window day at the tour hour, not the round day', () => {
  const PL = eng.ctx.window.__foPlanet;
  const i = PL.WINDOWS.indexOf(5);
  const want = PL.EPOCH + (PL.seasonStart(1) + PL.WINDOW_DAYS[i]) * PL.DAY + 18 * 3600000;
  assert.equal(eng.ctx.foPmIntlStart(1, 5, 18), want, 'the fifth round is bowled on its own window day');
  assert.equal(eng.ctx.foPmIntlStart(1, 4, 18), 0, 'a round with no window has no hour');
});

test('the door is written in one place, so no caller invents the address', () => {
  assert.equal(eng.ctx.foIntlPreviewHref('afg', 'sco', 5), '#/preview?nat=afg-sco&r=5');
});

// ---- THE REPORT -----------------------------------------------------------

const CARD = {
  winner: 'Scotland XI', text: 'Scotland XI win by 4 wickets (9 balls left)',
  mom: { name: 'Callum Ord' },
  innings: [
    { batTeam: 'Afghanistan XI', runs: 214, wkts: 9, legal: 300, bat: [], bowlers: [] },
    { batTeam: 'Scotland XI', runs: 215, wkts: 6, legal: 291, bat: [], bowlers: [] }
  ],
  worm: [[], []]
};
const SERVED = { id: 'nat:d2:g1', day: 12, seasonNo: 1, round: 3,
  a: 'Afghanistan XI', b: 'Scotland XI', aCountry: 'afg', bCountry: 'sco',
  playAtMs: 1770000000000, card: CARD, winner: CARD.winner, text: CARD.text };

test('the umpire\'s card is dressed as the record every view in the room reads', () => {
  const rec = eng.ctx.foMrRecFromNat(SERVED, [{ no: '1.1', txt: 'a ball' }]);
  assert.ok(rec, 'the record is built');
  assert.equal(rec.home, 'Scotland XI', 'the HOST is the home side - the umpire plays them second');
  assert.equal(rec.away, 'Afghanistan XI', 'and the tourists are away');
  assert.equal(rec.intl, true, 'it knows it is an international');
  assert.equal(rec.seasonNo, 1);
  assert.deepEqual(rec.innings, CARD.innings, 'the innings are the umpire\'s own');
  assert.equal(rec.result.text, CARD.text);
  assert.equal(rec.result.winner, 'Scotland XI');
  assert.equal(rec.log.length, 1, 'the ball-by-ball rides along where it was kept');
  assert.equal(rec.__servedCard, 1, 'it is a served card, so no conditions are invented for it');
});

test('a sealed card builds nothing - the broadcast has not finished reading it out', () => {
  assert.equal(eng.ctx.foMrRecFromNat({ ...SERVED, card: null }, []), null);
  assert.equal(eng.ctx.foMrRecFromNat({ ...SERVED, card: { innings: [] } }, []), null);
  assert.equal(eng.ctx.foMrRecFromNat(null, []), null);
});

test('the record carries a ground and a painting, since a tour has no club ground', () => {
  const rec = eng.ctx.foMrRecFromNat(SERVED, []);
  assert.ok(rec.ground, 'somewhere is named');
  assert.ok(!/XI/.test(rec.ground), 'and it is a ground, not a side');
  assert.equal(typeof rec.art, 'string', 'the painting rides on the record');
});

test('the report page routes a tour by the umpire\'s own match id', () => {
  const s = src('14-match-report.js');
  assert.match(s, /\/\[\?&\]nat=\(\[\^&\]\+\)\//, 'the id carries colons, so it is matched loosely');
  assert.match(s, /world_nat_match/, 'and read from the tour RPC');
  assert.match(s, /foMrLogFetch\(j\.bCountry/, 'with the log fetched under the HOST, which is where it is banked');
});

test('the broadcast hands off to the report, and the report hands back', () => {
  const feed = src('44-feed-match.js');
  assert.match(feed, /done && cal\.__nat \? "<a class='fd-enter' href='#\/report\?nat="/,
    'a finished tour offers its full report');
  assert.match(feed, /done && !cal\.__fr && !cal\.__nat/,
    'and never the league report, which is addressed by nation and round');
  const rep = src('14-match-report.js');
  assert.match(rep, /backN = "#\/feed\?nat="/, 'the report goes back to the broadcast it came from');
  assert.match(rep, /rec\.intl \? "<a class='fo-mr-back day' href='#\/nations'/,
    'and offers the international game rather than the league table');
});

test('a tour in the record book is a door to its report', () => {
  const s = src('46-nations.js');
  assert.match(s, /a class='fo-nat-tie go' href='#\/report\?nat="/, 'every banked tie opens its report');
  assert.match(s, /if \(!t\.id\) return "<div class='fo-nat-tie'>"/, 'and one with no id stays plain text');
});
