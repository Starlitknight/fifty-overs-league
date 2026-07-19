  // ===========================================================================
  //  GAME MANUAL · how everything works, in one place (#/guide).
  // ===========================================================================
  function foManualSec(id, title, body) {
    return "<details id='man-" + id + "'" + (id === "basics" ? " open" : "") + "><summary>" + title + "</summary><div class='fo-man-b'>" + body + "</div></details>";
  }
  function foManualPage() {
    var page = document.getElementById("page"); if (!page) return;
    // live example players for "Reading a player": your own best batter and
    // bowler, rendered by the same card the primer and the squad page use
    var exs = [];
    try {
      var mt = null; try { mt = userTeam(); } catch (e0) {}
      if (!mt || !(mt.players || []).length) mt = (GD.teams || [])[0];
      var ps = ((mt && mt.players) || []).slice();
      var byR = function (x, y) { return (y.rating || 0) - (x.rating || 0); };
      var isBw = function (p) { return p.bowlTypeFull ? p.bowlTypeFull !== "none" : !!p.bowlType; };
      var pick = function (f, tag) { var p0 = ps.filter(f).sort(byR)[0]; if (p0) exs.push([p0, tag]); };
      pick(function (p) { return !isBw(p) && !p.keeper && p.role !== "allRounder"; }, "The batsman &middot; your squad");
      pick(function (p) { return isBw(p) && p.role !== "allRounder" && !p.keeper; }, "The bowler &middot; your squad");
      pick(function (p) { return p.keeper; }, "The wicketkeeper &middot; your squad");
      pick(function (p) { return p.role === "allRounder"; }, "The all-rounder &middot; your squad");
    } catch (eEx) {}
    var glossary = ""; try { glossary = "<div class='fo-exp-dh'>What every number actually does</div>" + foTraitGlossary(); } catch (eG) {}
    var cardsHtml = exs.length
      ? "<div class='fo-exp-cols'><div class='fo-exp-cards'>" + exs.map(function (x) { return foExpCard(x[0], x[1], "wage"); }).join("") + "</div><div class='fo-exp-defs'>" + glossary + "</div></div>"
      : "<div class='fo-exp-defs'>" + glossary + "</div>";
    var C = null; try { C = foCondCards(); } catch (eC) {}
    var progCards = ""; try { progCards = foProgExplainHTML(); } catch (eP) {}
    var secs = [
      ["basics", "Welcome to the league", [
        "<p>Fifty Overs is a private cricket management league for ten clubs. You run one; friends run the others, and the computer manages any club that has not been claimed yet. There are no purchases or boosts. Results come from three inputs: the squad you draft, the budget you manage, and the orders you submit each matchday.</p>",
        "<p>The league plays <b>one matchday every day at " + MATCH_TIME + "</b>. Between matchdays, the game is yours: study the next opponent, pick your XI, plan who bowls when, set the week&rsquo;s training, chase a signing. When the clock strikes, every fixture in the round is played by the match engine using exactly what each manager submitted, and the round goes out as a <b>one-hour live broadcast</b> (the next section walks through the day). If you submit nothing, an automatic lineup is used. It is reasonable, but it does not know your plans.</p>",
        "<p>Matches are full 50-over contests simulated ball by ball. Batters score more freely once set, bowlers lose effectiveness through long spells, and a rising required rate increases the chance of wickets in a chase. Every attribute on a player&rsquo;s card affects the simulation, along with form, fatigue, experience and age.</p>",
        "<div class='fo-man-tip'><b>The five-minute day:</b> read the result and your training report, glance at the table, open the next fixture, set your lineup, adjust one or two training programs. That is the whole routine. Doing it daily is the single biggest factor in finishing higher.</div>"
      ].join("")],
      ["day", "A matchday, hour by hour", [
        "<p>One round plays every day. Here is its full rhythm:</p>",
        "<table><tr><th>When</th><th>What happens</th></tr>" +
        "<tr><td><b>Before " + MATCH_TIME + "</b></td><td>Orders are open. Set your XI, batting order, bowling plan and per-phase intent on the next fixture; adjust training programs; browse the market. The fixture page shows the pitch and the forecast before you commit. <b>Lineups lock about an hour before the start</b>, while the engine warms up the round.</td></tr>" +
        "<tr><td><b>" + MATCH_TIME + "</b></td><td>Every fixture in the round is played at once, ball by ball, using exactly what each manager submitted.</td></tr>" +
        "<tr><td><b>The broadcast hour</b></td><td>For the next <b>60 minutes</b> the round is on air. A red <b>&#9679; Live</b> pill appears in the nav, the Matchday page becomes a live board, and each match&rsquo;s commentary plays out slowly in real time. Results, final scorecards and the league table stay under embargo until stumps, so nobody - including you - knows a result before the innings actually reach it.</td></tr>" +
        "<tr><td><b>Full time</b></td><td>Everything unlocks at once: final scorecards with charts and fantasy points, the player of the match, the updated table, your training report with every improvement named, the day&rsquo;s ledger, and the beat writer&rsquo;s morning digest.</td></tr></table>",
        "<div class='fo-man-tip'><b>Missed the hour?</b> Nothing is lost. Every match can be replayed from its card afterwards, and the scorecard, commentary and charts are permanent record.</div>"
      ].join("")],
      ["players", "Reading a player", [
        "<p>Every player in the game is read the same way. The cards below are <b>live</b>: your own best batsman, bowler, wicketkeeper and all-rounder, rendered exactly as the Squad page and every player page show them. Skills are grouped into <b>Batting</b>, <b>Bowling</b> (pure batters show <b>Reserves</b> instead) and <b>In the field</b>, each with a number, a bar and an honest word. Batters carry a headline batting overall; bowlers carry a headline bowling overall as well. Every trait is spelled out beside the cards, and every line is checked against the match engine: what a skill is said to do is exactly what it does.</p>",
        cardsHtml,
        "<p>But the card only starts there. Four quieter things decide whether the skills show up on the day:</p>",
        "<ul><li><b>Form</b> rises and falls with performances. A fifty lifts a batter; three cheap dismissals hollow him out. An in-form 70-rated batter will frequently outscore an out-of-form 85. Check form before every selection; it&rsquo;s the most ignored column in the game.</li>",
        "<li><b>Fatigue</b> is a ladder of words, from <i>rested</i> down through <i>weary</i> and <i>listless</i> to the ominous <i>clinically dead</i>. Tired batters find fielders; tired bowlers serve up half-volleys. Playing a shattered star is usually worse than playing a fresh squad player. Stamina and youth slow the slide; the Rest program reverses it.</li>",
        "<li><b>Experience</b> is invisible until the game gets tense: a big chase, wickets down, the death overs. That&rsquo;s when experienced players keep their heads and rookies play the shot they&rsquo;ll regret. An experienced middle-order batter measurably reduces collapse risk in tight games.</li>",
        "<li><b>Age</b> shapes everything: young players learn fast in training and run all day, but the game&rsquo;s pressure moments expose them. Players past thirty tire faster: older batters decline late in long innings, and older bowlers lose effectiveness late in long spells.</li></ul>",
        "<h3>Technique, explained</h3>",
        "<p>The honest truth about the Technique bar: the match engine never looks at it. It looks at the skills underneath. Technique exists for <i>you</i> - a one-glance read of a player&rsquo;s craft before you put money or overs on him.</p>",
        "<p>For a batter it averages the three things that keep him alive out there: how he plays pace, how he plays spin, and his temperament. Notice what it leaves out - power and rotation, the two skills that actually put runs on the board. That&rsquo;s the whole trick to reading a card. When Batting and Technique sit close together you have an honest cricketer. When they drift apart, the gap tells you exactly who you&rsquo;re dealing with.</p>",
        "<p>A batter whose Batting towers over his Technique is a hitter. The big number is muscle. He&rsquo;ll win you the last ten overs of a chase, and he&rsquo;ll also nick the second ball of the morning straight to the keeper, because the craft that survives good bowling was never there. Every batter is at his most fragile before he gets set, a hitter more than anyone - so don&rsquo;t open with him. Hide him at six, hand him a platform, and let him do the one thing he does better than everyone else.</p>",
        "<p>The opposite case - Technique sitting above Batting - is an anchor. Bowlers can&rsquo;t get him out, and honestly they don&rsquo;t much mind, because he can&rsquo;t hurt them either. He&rsquo;ll bat through a nasty green-pitch morning and you&rsquo;ll be grateful; he&rsquo;ll bat through the last ten overs of a chase and you&rsquo;ll want to throw something. Open with him. Against the new ball, surviving <i>is</i> scoring.</p>",
        "<p>And the two belong together: it&rsquo;s the anchor holding an end that buys the hitter his licence. A lone anchor stalls an innings; a lone hitter collapses one.</p>",
        "<p>Bowlers work the same way with different ingredients. A pure bowler&rsquo;s Technique is his control - economy, discipline, and the movement he puts on the ball - while his Bowling bar stacks raw wicket threat on top. Bowling high and Technique low is a strike bowler: he&rsquo;ll get you three, and he&rsquo;ll bleed sixty getting them, wides included. Bowl him in angry little bursts - the new ball, a partnership that&rsquo;s getting comfortable - and never, ever at the death.</p>",
        "<p>Technique high and Bowling modest is a miser. He may never take the wicket himself; he just bowls dot after dot until the batter does something stupid to the man at the other end. Give him the middle overs and the death, and on a pitch with something in it - green for a seamer, dry and cracked for a spinner - his movement turns that control genuinely nasty.</p>",
        "<p>Build your attack the way the old pros built theirs: threat from one end, a strangle from the other, and let the pressure do the bowling.</p>",
        "<p><b>Talents</b> are permanent traits that apply in specific situations:</p>",
        "<table><tr><th>Talent</th><th>When it bites</th></tr>" +
        "<tr><td><b>Finisher</b></td><td>Finds boundaries at the death that others can&rsquo;t.</td></tr>" +
        "<tr><td><b>Anchor</b></td><td>Hard to dismiss while an innings is being built.</td></tr>" +
        "<tr><td><b>Six Machine</b></td><td>Clears the rope when given licence to swing.</td></tr>" +
        "<tr><td><b>Fast Starter</b></td><td>Skips the nervous new-batter phase.</td></tr>" +
        "<tr><td><b>Spin Killer / Pace Hunter</b></td><td>Feasts on that bowling type.</td></tr>" +
        "<tr><td><b>New-ball Specialist</b></td><td>Significantly more dangerous in the opening spell.</td></tr>" +
        "<tr><td><b>Death Specialist</b></td><td>Keeps his nerve (and his yorker) in the last ten.</td></tr>" +
        "<tr><td><b>Partnership Breaker</b></td><td>Strikes when a stand is getting comfortable.</td></tr>" +
        "<tr><td><b>Mystery Ball</b></td><td>A spinner new batters simply can&rsquo;t read.</td></tr>" +
        "<tr><td><b>Miser</b></td><td>Bowls a higher share of dot balls.</td></tr></table>"
      ].join("")],
      ["conditions", "Bowling styles, pitches &amp; weather", [
        "<p>Skills tell you how good a player is. Conditions decide which skills matter <i>today</i>. Three things set the stage for every fixture: who bowls what, the pitch under their feet, and the sky above it. Every effect on the cards below is real in the match engine; none of it is flavour text.</p>",
        C ? C.sec(1, "Bowling styles", "rarity is value", C.bowlers) : "",
        C ? C.sec(2, "Pitch types", "half your matches are on your home pitch, so draft for it", C.pitches) : "",
        C ? C.sec(3, "Weather", "the forecast is shown before every lineup", C.weathers) : "",
        C ? C.heat : "",
        "<p style='margin-top:12px'>The toss is decided automatically. You do not control it, but pitch choice and weather both shift the balance of the fixture, and both are shown on the order screen before you commit a lineup. If <b>dew</b> is forecast, remember it arrives in the second innings: a wet ball punishes the side defending a total, especially its spinners.</p>"
      ].join("")],
      ["orders", "Matchday orders", [
        "<p>Open <b>Matches</b> and hit <b>Set lineup</b> on your next fixture. This is the heart of the game, and there is real craft in it:</p>",
        "<ul><li><b>The XI.</b> Balance first: a keeper, enough bowling for fifty overs, batting depth for the pitch you&rsquo;re on. Then form and freshness: bench the exhausted, back the in-form.</li>",
        "<li><b>Batting order.</b> Openers face the hardest overs, so send technique and temperament, not just talent. Your best player bats three or four, where he faces enough balls to matter. Save a finisher and some muscle for six and seven. Batting a keeper too high burns him for the fielding innings.</li>",
        "<li><b>Bowling plan.</b> Seamers are at their most dangerous with the new ball; the first ten overs are theirs. Spinners grip harder as the ball roughens; the middle overs are where they squeeze and strike. Death overs favour bowlers with the Death Specialist talent, good economy and the stamina to finish a spell. Schedule your fifth bowler&rsquo;s overs in the quietest phase, usually overs 25 to 40.</li>",
        "<li><b>Intent.</b> Per phase, you choose how hard to push. Aggression buys boundaries and sells wickets; caution does the reverse. Higher aggression suits flat pitches; caution early suits green ones. Because set batters score much faster than new ones, keeping wickets in hand early usually raises the final total.</li>",
        "<li><b>Captain.</b> Give it to experience and captaincy skill, not to your best batter by default. Captaincy skill improves fielding pressure across the whole innings on both sides of the ball.</li>",
        "<li><b>Keeper.</b> Keeping skill reduces byes and increases catches and stumpings. A weak keeper costs several runs and chances per match.</li></ul>",
        "<div class='fo-man-tip'><b>Chasing?</b> The engine models scoreboard pressure honestly: a chase that stays near the rate feels normal, but let the required rate climb past eight and every ball gets heavier, especially against experienced bowlers, and especially for inexperienced batters. Keep chases close to the required rate throughout; plans that rely on late acceleration fail more often than they succeed.</div>"
      ].join("")],
      ["training", "Training: where seasons compound", [
        "<p>Every player carries a weekly assignment: a <b>program</b> (what he works on) and an <b>intensity</b> (how hard he works). You set both on the <b>Training</b> tab, and nothing else in the game grows a squad. Gains land when the matchday resolves, and the training report names every player who improved.</p>",
        "<p><b>How a session becomes a skill point.</b> Each program splits its work across fixed skills in fixed proportions. The cards below are rendered from the live game data, so they are always exact; the amber chip is each program&rsquo;s main focus. Progress builds invisibly between the visible +1s: a young player might bank a point in two or three sessions, a veteran might need ten.</p>",
        progCards,
        "<p style='margin-top:12px'><b>What multiplies the gains:</b></p>",
        "<ul><li><b>Age.</b> The development curve is steep: the same program moves a 19-year-old roughly three times as far as a player in his thirties. A young squad becomes worth more every single week.</li>",
        "<li><b>Potential.</b> Every player is graded <i>Limited, Useful, High</i> or <i>Star</i>. Higher potential means more from every session; a young, high-potential player is the best long-term asset in the game.</li>",
        "<li><b>Intensity.</b> <i>Light</i> trains at 75% speed and goes easy on the legs. <i>Normal</i> is the default. <i>Intense</i> trains about 20% faster but tires players faster: fine in a cool week, reckless through a heatwave. <i>Rest</i> does no skill work at all and recovers fatigue instead.</li>",
        "<li><b>Freshness.</b> Tired players don&rsquo;t learn. Fatigue quietly strangles progress before it ever hurts match output, so rotate Rest through your frontline bowlers especially.</li>",
        "<li><b>Squad size.</b> Beyond 24 players the coaching staff is stretched and everyone trains slower.</li>",
        "<li><b>The last points are the steepest.</b> Lifting a skill from good to great takes far longer than from poor to decent. Sometimes the smart program fixes a weakness instead of polishing a strength.</li></ul>",
        "<p><b>Matching programs to jobs</b> - a reliable default for each role:</p>",
        "<table><tr><th>Who</th><th>Program</th><th>Why</th></tr>" +
        "<tr><td>Opener</td><td><b>New-ball batting</b></td><td>vs pace and temperament: the skills the first ten overs interrogate.</td></tr>" +
        "<tr><td>Middle order</td><td><b>Spin batting</b> or <b>Finishing</b></td><td>The middle overs are spin country; the death wants power with a cool head.</td></tr>" +
        "<tr><td>New-ball seamer</td><td><b>New-ball seam</b></td><td>Movement and wicket threat while the ball is hard.</td></tr>" +
        "<tr><td>Spinner</td><td><b>Spin bowling</b></td><td>Turn, threat and the variations that win the middle overs.</td></tr>" +
        "<tr><td>Death bowler</td><td><b>Death bowling</b></td><td>Economy and discipline under fire; the yorker is a trained skill.</td></tr>" +
        "<tr><td>Fifth bowler</td><td><b>Control bowling</b></td><td>Cheap, disciplined overs are his entire job.</td></tr>" +
        "<tr><td>Keeper</td><td><b>Keeping</b></td><td>Glovework, stumpings and catching in one session.</td></tr>" +
        "<tr><td>Young all-rounder</td><td><b>All-rounder</b></td><td>Slower per skill, but it builds the whole cricketer.</td></tr>" +
        "<tr><td>Anyone shattered</td><td><b>Rest</b></td><td>A week of progress traded for legs that work on matchday.</td></tr></table>",
        "<div class='fo-man-tip'><b>Two honest warnings:</b> skill gains raise wages automatically, so improvement is never free. And academy level, squad age and rest discipline compound: none shows much in a single week; over a season the difference is significant.</div>"
      ].join("")],
      ["youth", "Youth scouting", [
        "<p>Your scout brings <b>three local prospects, aged 18 to 20</b>, to the Training page every matchday, new faces each round. Click a name for the full workup: skills, talents, and the scout&rsquo;s read on potential.</p>",
        "<ul><li>Youth signings are <b>free</b>: the lottery is quality. Most finds are raw local kids; a <b>Promising</b> one appears most trips, a <b>&#9733; Gifted</b> one is genuinely rare, and a <b>&#9670; Once in a generation</b> talent might bless your club once every few seasons. The tier is stamped on the card when the scout reports back.</li>",
        "<li>Their value is future training gains, so judge them on potential and talents as much as current ratings - and sign the jewel even if the seat is tight.</li>",
        "<li>The paperwork limits you to <b>one youth signing every " + FO_SCOUT_COOLDOWN + " matchdays</b>, and the squad caps at 18, so every seat you fill is a seat you can&rsquo;t offer a market star later.</li>",
        "<li>Signings join when the next matchday resolves. Put them straight on a training program; that&rsquo;s what you bought them for.</li></ul>"
      ].join("")],
      ["market", "The transfer market", [
        "<p>The <b>Transfers</b> tab holds a shelf of <b>18 established free agents</b>: proven players, 21 and up, a spread of trades from six cricket nations. Every club sees the same shelf, and it is <b>completely restocked every 3 matchdays</b>: unsigned players move on and 18 new names arrive, so there is always something to look forward to.</p>",
        "<ul><li><b>First come, first served, league-wide.</b> When any club signs a player he is removed for everyone, the card shows who signed him, and the league is notified. If a player fixes a real weakness in your squad, waiting for the next shelf gives rivals the chance to sign him first &ndash; and he may not be there after the restock.</li>",
        "<li>Fees answer to the player: skills, age (young costs more), talents, and <b>bowling-style rarity</b>. Genuine fast bowlers and wrist spinners are the rarest things in the game; when one is listed the card wears a gold <b>&#9670; Rare</b> ribbon, and the fee carries the premium to match.</li>",
        "<li>Fees carry a mid-season premium and wages start the day he arrives. The question is never &ldquo;is he good?&rdquo; It&rsquo;s &ldquo;is he worth more to me than the reserve he empties?&rdquo;</li>",
        "<li>Signings join after the next matchday resolves, squad cap 18.</li></ul>",
        "<div class='fo-man-tip'><b>Suggestion:</b> check the market after every restock. Decide early which weaknesses you would pay to fix and at what bank balance, so the decision is already made when the right name appears.</div>"
      ].join("")],
      ["money", "Money: the honest ledger", [
        "<p>Every matchday your club settles its books, and every line is real. What comes in: your <b>sponsor&rsquo;s payment</b> (see the next section) and, at home games, the <b>gate</b>: your supporters, times ticket money. What goes out: <b>every player&rsquo;s wage</b>, <b>stadium upkeep</b>, and your <b>academy</b>, if you run one.</p>",
        "<p>The gate is where results turn into money, and <b>supporter mood</b> is the mechanism. The mood word on your club home (from mutinous misery up to jubilant) tracks results: wins lift it, defeats sour it, and attendance follows the mood with a little lag. A winning club&rsquo;s home gate can be roughly 50% larger than a struggling club&rsquo;s, up to the ground&rsquo;s capacity - so streaks compound in money as well as points, and a bad run costs you at the turnstiles just when you might want to spend.</p>",
        "<p>At season&rsquo;s end the league pays <b>prize money by final position, $200,000 down to $30,000</b>, with real gaps between places. Every position is worth real money, so late-season places still matter.</p>",
        "<ul><li><b>Wages are the tide.</b> They&rsquo;re your biggest cost and they never pause. Judge every signing by fee <i>plus</i> a season of wages, not the sticker price.</li>",
        "<li><b>The academy is a deliberate money pit.</b> It makes your whole squad train faster and it costs a fortune at higher levels. It accelerates development substantially but is one of the largest costs in the game. Commit to it only with a plan for paying for it.</li>",
        "<li><b>Watch the club page.</b> It shows your bank health and, when things get ugly, a runway estimate in matchdays. If you see a runway number at all, act: trim a wage, skip a signing, downgrade an academy.</li></ul>"
      ].join("")],
      ["sponsors", "Sponsor deals: a bet on yourself", [
        "<p>At founding you signed one of three deals. Each pays every matchday, all season; they differ in how much of your money rides on results:</p>",
        "<table><tr><th>Deal</th><th>Character</th><th>Best for</th></tr>" +
        "<tr><td><b>Prudential</b></td><td>The biggest guaranteed payment in the league, and not a cent more, whatever happens.</td><td>Rebuilds, heavy academy spenders, and honest mid-table sides.</td></tr>" +
        "<tr><td><b>Nike</b></td><td>A slightly smaller base, plus a solid bonus for every win. Comes out ahead of Prudential around a winning season: ten or more wins.</td><td>Good sides that expect a winning record but wouldn&rsquo;t bet the house on a trophy.</td></tr>" +
        "<tr><td><b>Emirates</b></td><td>A small retainer and an enormous bonus for every win. Out-earns everyone across a title-class season; a poor season costs six figures.</td><td>Squads built to win now, and managers who mean it.</td></tr></table>",
        "<p>Choose based on a realistic estimate of your squad&rsquo;s strength: each deal is the best option within a specific band of expected wins.</p>"
      ].join("")],
      ["matchcentre", "Reading a finished match", [
        "<p>Open any completed fixture (or a live one during the broadcast hour) and the match centre offers a full press box:</p>",
        "<ul><li><b>Scorecard.</b> A broadsheet card per innings: every batter with his dismissal, runs, balls, fours, sixes and strike rate; fall of wickets; did-not-bat; the complete bowling analysis. The hero carries the result, the date and the <b>player of the match</b>.</li>",
        "<li><b>Commentary.</b> The full ball-by-ball broadcast: pitch-aware, weather-aware, umpires named, fielding moments tagged (<i>great fielding, dropped catch, direct hit, misfield</i>) and talents celebrated when they fire. Filter pills re-cut the feed to just the <b>Wickets</b>, <b>Boundaries</b>, <b>Fielding</b>, <b>Talents</b>, or a <b>Highlights</b> reel of the whole match.</li>",
        "<li><b>Charts.</b> Broadcast-grade analytics: the <b>Manhattan</b> (runs per over with both innings paired, wickets ringed, powerplay and death shaded, and a phase-by-phase table), <b>run rate and worm</b> lines, and the <b>partnerships</b> ladder.</li>",
        "<li><b>Match ratings.</b> Every player&rsquo;s performance marked, both XIs side by side. The result tells you whether you won; the ratings tell you what needs fixing.</li>",
        "<li><b>Fantasy.</b> Every player&rsquo;s match distilled into points; the top score is named player of the match.</li></ul>",
        "<p><b>How fantasy points are scored:</b></p>",
        "<table><tr><th>Batting</th><td>1 per run, +1 per four, +2 per six. +4 for a fifty, +12 for a hundred, &minus;3 for a duck. From 20 balls faced, a strike-rate adjustment from +6 (SR 120+) down to &minus;6 (SR under 40).</td></tr>" +
        "<tr><th>Bowling</th><td>25 per wicket, +8 more when it is bowled or lbw. +6 for a four-for, +12 for a five-for. From 5 overs bowled, an economy adjustment from +6 (under 3.0 an over) down to &minus;6 (over 8.0).</td></tr>" +
        "<tr><th>Fielding</th><td>+8 per catch (+4 extra for a three-catch match), +12 per stumping, +8 per run-out.</td></tr></table>"
      ].join("")],
      ["world", "A living league", [
        "<p>The league remembers everything, and the world keeps moving around the cricket:</p>",
        "<ul><li><b>Careers and Moments.</b> Every player page keeps a season-by-season career table (runs, average, strike rate, wickets, best) and a dated Moments feed: debut, maiden fifty, first century, five-fors, call-ups, the day he signed. Rival players&rsquo; careers are just as public as yours.</li>",
        "<li><b>Roots.</b> Every player comes from a real town in his home country, shown on his page, and every club wears its founding date (Est.).</li>",
        "<li><b>International call-ups.</b> After rounds 6, 12 and 18 each cricketing nation names its <b>two standout performers</b> from the league. A cap is a permanent career milestone, recorded on the player&rsquo;s page and in the almanac.</li>",
        "<li><b>Umpires.</b> A named panel stands the league&rsquo;s fixtures; you will hear them in commentary, mostly turning down appeals.</li>",
        "<li><b>The press.</b> A named beat writer files the morning digest after every round: results, milestones, call-ups and farewells - and drops a transfer <b>rumour</b> the day before the market restocks.</li>",
        "<li><b>Venue records.</b> Every ground keeps its book: highest total, best figures, biggest win. Listed on the Stats page.</li>",
        "<li><b>The Almanac.</b> The league&rsquo;s book of record, linked from the Stats page: the roll of honour, all-time run and wicket charts, international caps, the record book and every venue&rsquo;s records.</li>",
        "<li><b>Farewells.</b> Players retire eventually. The paper marks each with a career retrospective, and tells you what he went on to do.</li></ul>"
      ].join("")],
      ["scouting", "Scouting the opposition", [
        "<p>Tap any club name - on the table, a fixture or a result - to open its <b>scout report</b>: squad strength, batting depth, the shape of the attack (pace against spin), your next meeting and the club&rsquo;s founding date. The <b>Players</b> tab lists their full squad.</p>",
        "<p>Rival players are public people: stats, career tables and dated Moments are all open. Only their <b>skills</b> are private - you judge a rival the way real scouts do, from output. Your players&rsquo; skills are hidden from rivals the same way.</p>",
        "<p>From a rival&rsquo;s report you can <b>challenge them to a friendly</b>: a no-stakes match between your clubs. Nothing carries over - no money, no fatigue, no points - but pride, obviously, carries forever. Both sides take the field at full freshness: fatigue neither affects a friendly nor carries out of one. Pending challenges, upcoming friendlies and their results all live in the <b>Friendlies</b> panel on the Matches page, and both managers see the same rows. A friendly <b>kicks off at its scheduled time and plays out ball by ball for an hour</b>, live for both managers: the row turns LIVE with a Watch link, the notification bell links straight to the broadcast, and the result stays under embargo until stumps. Attach your lineup at least an hour before the start - the engine prepares the match early. (If the league engine is running late the broadcast reads &ldquo;delayed at the toss&rdquo; and catches up by itself.)</p>"
      ].join("")],
      ["league", "The table, the run rate, the prizes", [
        "<p>Ten clubs, a full round robin, one round a day. Two points a win; ties and washouts split one. Level on points, <b>net run rate</b> decides, so a ten-run win chased lazily and a ten-run win chased hard are not the same result. Margins are money.</p>",
        "<p>Friends can <b>join mid-season</b>: a newcomer takes over a computer club, drafts a fresh squad, and inherits the fixtures. The table does not reset, but a well-drafted late joiner can still affect the title race.</p>",
        "<p>Season prizes run <b>$200k, $160k, $130k, $110k, $90k, $75k, $60k, $50k, $40k, $30k</b>, first to tenth. Every place in the final table pays differently, so no fixture is meaningless.</p>"
      ].join("")],
      ["practice", "Practice games", [
        "<p><b>New practice game</b>, in the Friendlies panel on the Matches page, plays a friendly against any club in your league. You choose the opponent, the pitch, and the weather. Nothing carries over: no money, no fatigue, no points, no consequences - and everyone plays fully rested.</p>",
        "<p>Use it like a professional: rehearse a batting order before a big fixture, audition a young bowler at the death, or play on the exact pitch you&rsquo;ll face away next week. A live practice match can be left and resumed from the <b>&#9679; Live Match</b> link that appears while it&rsquo;s running.</p>"
      ].join("")],
      ["tips", "Ten reliable habits", [
        "<ul><li><b>Set orders every day.</b> The automatic lineup is adequate; a considered one is consistently better.</li>",
        "<li><b>Check form and fatigue before names.</b> The best manager fields the best <i>available</i> team, not the best team sheet.</li>",
        "<li><b>Bank two or three matchdays of wages, always.</b> Losing streaks cut your gate at the exact moment you need it.</li>",
        "<li><b>Draft for your home pitch.</b> Half your matches are played on it.</li>",
        "<li><b>Protect wickets early, cash in late.</b> Set batters score in ways new batters can&rsquo;t. Collapse-proof beats explosive.</li>",
        "<li><b>Rest bowlers one week before they break, not one after.</b> The fatigue ladder goes down much faster than it comes up.</li>",
        "<li><b>Prioritise training your youngest players.</b> Youth, potential and academy level multiply together; nothing else in the game compounds like this.</li>",
        "<li><b>Buy the player who fixes your worst day</b>, not the one with the prettiest rating.</li>",
        "<li><b>Captaincy is a skill, not an honour.</b> Field placings win quiet runs all season.</li>",
        "<li><b>Read the training report and ledger after every matchday.</b> They state exactly what is and is not working.</li></ul>"
      ].join("")]
    ];
    // ---- reference articles built from the game's own data ----
    try {
      var talRows = "";
      if (typeof TALTIPS !== "undefined") {
        talRows = Object.keys(TALTIPS).map(function (k) {
          var nm2 = k; try { if (typeof foTalentName === "function") nm2 = foTalentName(k) || k; } catch (eT) {}
          return "<tr><td><b>" + E(nm2) + "</b></td><td>" + E(TALTIPS[k]) + "</td></tr>";
        }).join("");
      }
      secs.push(["attributes", "Attribute glossary", "<p>Every number on a player card, with exactly what it does in the match engine. These definitions are rendered from the same source the Squad page uses, so they cannot drift from the game.</p>" + glossary]);
      secs.push(["talents", "Talent glossary", "<p>Talents are permanent traits that apply in specific situations. They are named on a player&rsquo;s card, and match commentary calls a talent out when it fires. A talent shapes the situations it names and nothing else &ndash; it never replaces the underlying skills.</p>" +
        (talRows ? "<table><tr><th>Talent</th><th>What it does, and when it matters</th></tr>" + talRows + "</table>" : "") +
        "<div class='fo-man-tip'><b>Reading a talent:</b> ask three questions - what does it affect, when can it trigger, and what does it not touch? A Death Specialist changes nothing before over 40.</div>"]);
      secs.push(["faq", "Frequently asked questions", [
        "<table><tr><th>Question</th><th>Answer</th></tr>",
        "<tr><td>When do matches play?</td><td>One round every day at " + MATCH_TIME + ", followed by a one-hour live broadcast. Results unlock at stumps.</td></tr>",
        "<tr><td>What if I don&rsquo;t submit orders?</td><td>An automatic lineup is used. It is reasonable, but it does not know your plans.</td></tr>",
        "<tr><td>When do lineups lock?</td><td>About an hour before the start, while the engine warms the round up.</td></tr>",
        "<tr><td>Why can&rsquo;t I see rival players&rsquo; skills?</td><td>Skills are private to each manager. You judge rivals from output: stats, careers and match ratings are all public.</td></tr>",
        "<tr><td>What decides a tie on points?</td><td>Net run rate. Margins matter, so finish wins strongly and keep chases brisk.</td></tr>",
        "<tr><td>When does the transfer market restock?</td><td>Every 3 matchdays, completely. Signed players are removed for everyone at once.</td></tr>",
        "<tr><td>How big can my squad be?</td><td>18 players. Every seat you fill is a seat you can&rsquo;t offer someone better later.</td></tr>",
        "<tr><td>Do friendlies cost anything?</td><td>No - no money, no fatigue, no points. Pride only.</td></tr>",
        "</table>"].join("")]);
    } catch (eRef) {}

    // ---- the shell: categories, landing, article view, search ----
    var byId = {}; secs.forEach(function (s) { byId[s[0]] = s; });
    var cats = [
      ["Getting started", "The league, the daily rhythm, and habits that win.", ["basics", "day", "tips"]],
      ["Players & squad", "Reading player cards: skills, form, fatigue, talents, age.", ["players"]],
      ["Matches & tactics", "Orders, conditions, the match centre and the table.", ["orders", "conditions", "matchcentre", "scouting", "practice", "league"]],
      ["Development", "Training programs and the youth pipeline.", ["training", "youth"]],
      ["Club operations", "Money, sponsors and the transfer market.", ["money", "sponsors", "market"]],
      ["Reference", "Glossaries, the living league, and quick answers.", ["attributes", "talents", "world", "faq"]]
    ].map(function (c) { return { name: c[0], desc: c[1], arts: c[2].filter(function (id) { return byId[id]; }) }; });
    var flat = []; cats.forEach(function (c) { c.arts.forEach(function (id) { flat.push(id); }); });
    var catOf = function (id) { for (var i = 0; i < cats.length; i++) if (cats[i].arts.indexOf(id) >= 0) return cats[i]; return null; };
    var mQ = (location.hash.split("?")[1] || "").match(/(?:^|&)a=([\w-]+)/);
    var artId = mQ && byId[mQ[1]] ? mQ[1] : null;
    window.__foMnOpen = window.__foMnOpen || {};
    if (artId) { var cA = catOf(artId); if (cA) window.__foMnOpen[cA.name] = true; }

    // search index: plain text of every article, built once per session
    if (!window.__foMnIx) window.__foMnIx = null;
    window.__foMnIx = secs.map(function (s) {
      return { id: s[0], title: s[1], cat: (catOf(s[0]) || {}).name || "", text: String(s[2]).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").toLowerCase() };
    });

    var searchBox = "<form id='fo-mn2-form' role='search'><input id='fo-mn2-q' type='search' placeholder='Search the manual&hellip;' aria-label='Search the manual' autocomplete='off'></form>";
    var sideNav = cats.map(function (c) {
      var open = !!window.__foMnOpen[c.name];
      return "<div class='fo-mn2-cat'><button class='fo-mn2-cbtn' aria-expanded='" + open + "' data-cat='" + E(c.name) + "'>" + E(c.name) + "<i>" + (open ? "&minus;" : "+") + "</i></button>" +
        "<div class='fo-mn2-arts'" + (open ? "" : " hidden") + ">" + c.arts.map(function (id) {
          return "<a href='#/guide?a=" + id + "'" + (id === artId ? " class='on' aria-current='page'" : "") + ">" + byId[id][1] + "</a>";
        }).join("") + "</div></div>";
    }).join("");
    var side = "<aside class='fo-mn2-side'><div class='fo-mn2-sh'><a href='#/guide'>Game manual</a><span>Complete guide to managing a winning cricket club</span></div>" +
      searchBox + "<nav id='fo-mn2-nav'>" + sideNav + "</nav>" +
      "<div class='fo-man-tip' style='margin-top:14px'><b>Manager tip</b><br>Every great team is built on smart decisions off the field.</div></aside>";

    var main;
    if (!artId) {
      main = "<div class='fo-mn2-land'><div class='fo-mn2-intro'><h1>Game manual</h1>" +
        "<p>Learn how to build, manage, and compete with your cricket club. Every explanation here is checked against the match engine.</p></div>" +
        "<div id='fo-mn2-res'></div>" +
        "<div class='fo-mn2-cards'>" + cats.map(function (c) {
          return "<a class='fo-mn2-cc' href='#/guide?a=" + c.arts[0] + "'><b>" + E(c.name) + "</b><p>" + E(c.desc) + "</p><span>" + c.arts.length + " article" + (c.arts.length === 1 ? "" : "s") + " &rsaquo;</span></a>";
        }).join("") + "</div></div>";
    } else {
      var art = byId[artId], cat2 = catOf(artId);
      var fi = flat.indexOf(artId);
      var prevA = fi > 0 ? byId[flat[fi - 1]] : null, nextA = fi < flat.length - 1 ? byId[flat[fi + 1]] : null;
      main = "<article class='fo-mn2-art' id='man-" + artId + "'>" +
        "<div class='fo-mn2-crumb'><a href='#/guide'>Manual</a> &rsaquo; <span>" + E(cat2 ? cat2.name : "") + "</span> &rsaquo; <b>" + art[1] + "</b></div>" +
        "<h1>" + art[1] + "</h1>" +
        "<div id='fo-mn2-res'></div>" +
        "<div class='fo-man-b'>" + art[2] + "</div>" +
        "<div class='fo-mn2-pn'>" +
        (prevA ? "<a class='fo-mn2-prev' href='#/guide?a=" + prevA[0] + "'><span>&lsaquo; Previous</span><b>" + prevA[1] + "</b></a>" : "<span></span>") +
        (nextA ? "<a class='fo-mn2-next' href='#/guide?a=" + nextA[0] + "'><span>Next &rsaquo;</span><b>" + nextA[1] + "</b></a>" : "<span></span>") +
        "</div></article>";
    }

    page.innerHTML = "<div class='fo-mn2'>" +
      "<div class='fo-mn2-mbar'>" + (artId ? "<a href='#/guide'>&lsaquo; Manual</a>" : "<b>Game manual</b>") +
      "<button id='fo-mn2-contents' aria-label='Contents'>Contents</button></div>" +
      side + "<main class='fo-mn2-main'>" + main + "</main></div>";

    // category expand/collapse (state survives navigation within the session)
    page.querySelectorAll(".fo-mn2-cbtn").forEach(function (b) {
      b.addEventListener("click", function () {
        var nm3 = b.getAttribute("data-cat");
        window.__foMnOpen[nm3] = !window.__foMnOpen[nm3];
        var artsEl = b.parentNode.querySelector(".fo-mn2-arts");
        var open2 = !!window.__foMnOpen[nm3];
        b.setAttribute("aria-expanded", open2);
        b.querySelector("i").innerHTML = open2 ? "&minus;" : "+";
        if (open2) artsEl.removeAttribute("hidden"); else artsEl.setAttribute("hidden", "");
      });
    });
    // search: live results over titles, bodies and glossaries; Enter opens the
    // best hit, Escape clears. Works entirely offline.
    var qIn = page.querySelector("#fo-mn2-q"), resEl = page.querySelector("#fo-mn2-res");
    var doSearch = function () {
      var q = (qIn.value || "").trim().toLowerCase();
      if (!resEl) return;
      if (q.length < 2) { resEl.innerHTML = ""; return; }
      var hits = window.__foMnIx.map(function (x) {
        var tHit = x.title.toLowerCase().indexOf(q) >= 0, bAt = x.text.indexOf(q);
        if (!tHit && bAt < 0) return null;
        var snip = "";
        if (bAt >= 0) {
          var s0 = Math.max(0, bAt - 55), s1 = Math.min(x.text.length, bAt + q.length + 55);
          snip = (s0 > 0 ? "&hellip;" : "") + E(x.text.slice(s0, s1)).replace(new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>") + (s1 < x.text.length ? "&hellip;" : "");
        }
        var freq = 0, at2 = bAt;
        while (at2 >= 0 && freq < 6) { freq++; at2 = x.text.indexOf(q, at2 + q.length); }
        return { x: x, score: (tHit ? 10 : 0) + freq, snip: snip };
      }).filter(Boolean).sort(function (a, b2) { return b2.score - a.score; }).slice(0, 8);
      resEl.innerHTML = hits.length
        ? "<div class='fo-mn2-hits'>" + hits.map(function (h) {
            return "<a href='#/guide?a=" + h.x.id + "'><b>" + h.x.title + "</b><span>" + E(h.x.cat) + "</span>" + (h.snip ? "<i>" + h.snip + "</i>" : "") + "</a>";
          }).join("") + "</div>"
        : "<div class='fo-mn2-hits'><div class='fo-mn2-none'>No articles match &ldquo;" + E(q) + "&rdquo;.</div></div>";
    };
    if (qIn) {
      qIn.addEventListener("input", doSearch);
      qIn.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") { qIn.value = ""; doSearch(); qIn.blur(); }
      });
      var form = page.querySelector("#fo-mn2-form");
      if (form) form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var first = resEl && resEl.querySelector("a");
        if (first) { location.hash = first.getAttribute("href").slice(1); }
      });
    }
    // mobile Contents: the manual nav in the refined drawer style
    var cBtn = page.querySelector("#fo-mn2-contents");
    if (cBtn) cBtn.addEventListener("click", function () {
      var d = document.getElementById("fo-mandrawer");
      if (d) { d.remove(); return; }
      d = document.createElement("div"); d.id = "fo-mandrawer";
      d.innerHTML = "<div class='fo-mdk'></div><div class='fo-mdp'><div class='fo-mdh'>Game manual<button class='fo-mdx' aria-label='Close contents'>&#10005;</button></div><nav class='fo-mdn'>" +
        cats.map(function (c) {
          return "<div class='fo-mn2-dcat'>" + E(c.name) + "</div>" + c.arts.map(function (id) {
            return "<a class='fo-mdl" + (id === artId ? " on" : "") + "' href='#/guide?a=" + id + "'>" + byId[id][1] + "</a>";
          }).join("");
        }).join("") + "</nav></div>";
      document.body.appendChild(d);
      d.classList.add("open"); document.body.classList.add("fo-mnav-lock");
      var close = function () { d.remove(); document.body.classList.remove("fo-mnav-lock"); };
      d.querySelector(".fo-mdk").addEventListener("click", close);
      d.querySelector(".fo-mdx").addEventListener("click", close);
      d.querySelectorAll("a.fo-mdl").forEach(function (a) { a.addEventListener("click", close); });
    });
    try { window.scrollTo(0, 0); } catch (eSc) {}
    foMobileTables();
  }
  function foRenderManual() {
    if (!/^#\/guide/.test(location.hash || "")) return;
    try { bumpBrand(); } catch (e) {}
    try { foManualPage(); } catch (e) { console.warn("foManualPage", e); }
    try {
      var tb = document.getElementById("topbar");
      tb && tb.querySelectorAll("a").forEach(function (a) { a.classList.toggle("on", a.classList.contains("fo-guide")); });
    } catch (e) {}
  }
  window.addEventListener("hashchange", function () { setTimeout(foRenderManual, 15); });


