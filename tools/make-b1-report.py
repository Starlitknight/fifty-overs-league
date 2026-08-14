#!/usr/bin/env python3
"""Build the Fifty Overs engine anatomy + findings report."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, KeepTogether)

OUT = "/home/user/fifty-overs-league/docs/b1-evidence/engine-anatomy-report.pdf"

INK = colors.HexColor("#1B1710")
MUTE = colors.HexColor("#5E5545")
RULE = colors.HexColor("#C3B9A5")
MARK = colors.HexColor("#8E2F1C")
BG = colors.HexColor("#F5F1E7")
CODEBG = colors.HexColor("#EFEBE0")

ss = getSampleStyleSheet()
S = {}
S['title'] = ParagraphStyle('title', parent=ss['Title'], fontName='Times-Bold',
                            fontSize=24, leading=27, textColor=INK, spaceAfter=4, alignment=0)
S['sub'] = ParagraphStyle('sub', parent=ss['Normal'], fontName='Times-Italic',
                          fontSize=11.5, leading=15, textColor=MUTE, spaceAfter=16)
S['h1'] = ParagraphStyle('h1', parent=ss['Heading1'], fontName='Times-Bold',
                         fontSize=15, leading=18, textColor=INK, spaceBefore=18, spaceAfter=7)
S['h2'] = ParagraphStyle('h2', parent=ss['Heading2'], fontName='Times-Bold',
                         fontSize=11.5, leading=14, textColor=MARK, spaceBefore=12, spaceAfter=5)
S['body'] = ParagraphStyle('body', parent=ss['Normal'], fontName='Times-Roman',
                           fontSize=10.2, leading=14.4, textColor=INK,
                           alignment=TA_JUSTIFY, spaceAfter=7)
S['note'] = ParagraphStyle('note', parent=S['body'], fontName='Times-Italic',
                           textColor=MUTE, fontSize=9.6, leading=13)
S['code'] = ParagraphStyle('code', parent=ss['Normal'], fontName='Courier',
                           fontSize=8.4, leading=11.4, textColor=INK,
                           backColor=CODEBG, borderPadding=6, spaceBefore=4, spaceAfter=8,
                           leftIndent=4, rightIndent=4)
S['cap'] = ParagraphStyle('cap', parent=ss['Normal'], fontName='Times-Italic',
                          fontSize=8.6, leading=11, textColor=MUTE, spaceAfter=12)
S['bullet'] = ParagraphStyle('bullet', parent=S['body'], leftIndent=13,
                             bulletIndent=3, spaceAfter=4)

def P(t, s='body'): return Paragraph(t, S[s])
def H1(t): return Paragraph(t, S['h1'])
def H2(t): return Paragraph(t, S['h2'])
def C(t): return Paragraph(t.replace(' ', '&nbsp;').replace('\n', '<br/>'), S['code'])
def B(t): return Paragraph(t, S['bullet'], bulletText='-')

def tbl(data, widths, head=True, size=8.4, align=None):
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0, hAlign='LEFT')
    st = [
        ('FONT', (0, 0), (-1, -1), 'Helvetica', size, size + 3.4),
        ('TEXTCOLOR', (0, 0), (-1, -1), INK),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('LINEBELOW', (0, 0), (-1, -2), 0.25, RULE),
    ]
    if head:
        st += [('FONT', (0, 0), (-1, 0), 'Helvetica-Bold', size, size + 3.4),
               ('LINEBELOW', (0, 0), (-1, 0), 0.9, INK),
               ('TEXTCOLOR', (0, 0), (-1, 0), INK)]
    for col, a in (align or {}).items():
        st.append(('ALIGN', (col, 0), (col, -1), a))
    t.setStyle(TableStyle(st))
    return t

def page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(BG)
    canvas.rect(0, 0, A4[0], A4[1], stroke=0, fill=1)
    canvas.setFont('Times-Italic', 8)
    canvas.setFillColor(MUTE)
    canvas.drawString(20 * mm, 12 * mm, "Fifty Overs — match engine anatomy and Phase B1 findings")
    canvas.drawRightString(A4[0] - 20 * mm, 12 * mm, "page %d" % doc.page)
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.4)
    canvas.line(20 * mm, 15.5 * mm, A4[0] - 20 * mm, 15.5 * mm)
    canvas.restoreState()

W = A4[0] - 40 * mm
story = []
A = story.append

# ---------------------------------------------------------------- title
A(P("The Fifty Overs match engine", 'title'))
A(P("How one delivery becomes cricket, where a broad 0–100 player world breaks it, "
    "and what has been measured, fixed and left undone. Phase B1.", 'sub'))

A(H1("The finding, in one table"))
A(P("Three deliveries, computed by the shipped engine. Mid-innings, balanced pitch, "
    "settled batsman, uniform skills. Probabilities in per cent."))
A(tbl([
    ["contest", "dot", "1", "2", "4", "6", "wicket"],
    ["85 bat  v  85 bowl", "37.73", "37.80", "6.88", "7.52", "1.42", "1.33"],
    ["95 bat  v  85 bowl", "37.65", "37.85", "6.88", "7.54", "1.42", "1.33"],
    ["85 bat  v  95 bowl", "37.72", "37.80", "6.88", "7.54", "1.42", "1.33"],
], [58*mm, 20*mm, 20*mm, 20*mm, 20*mm, 20*mm, 20*mm],
    align={1:'RIGHT',2:'RIGHT',3:'RIGHT',4:'RIGHT',5:'RIGHT',6:'RIGHT'}))
A(P("These are the same delivery. A generational batsman facing a good bowler receives an "
    "identical ball to a good batsman facing a great one. The differences are in the third "
    "decimal place — noise, not cricket.", 'cap'))
A(P("<b>The engine cannot tell, at elite level, which of the two men is better.</b> That single "
    "fact explains the dead top end we have been chasing, and it is the reason a world running "
    "from amateur to legend cannot be built on the engine as it stands. Everything else in this "
    "report is either the mechanism behind it or the evidence for it."))

# ---------------------------------------------------------------- pipeline
A(H1("1.  What happens when a ball is bowled"))
A(P("The whole simulation lives in <font face='Courier' size='9'>engine/src/00-core.js</font>. "
    "One delivery runs through six stages."))
A(tbl([
    ["#", "function", "line", "what it does"],
    ["1", "stepBall()", "1168", "Reads the two men, the over, the field, fatigue, intent, keeper, "
                                 "talents and match state"],
    ["2", "ballDist(…)", "233", "Builds a log-odds score for every possible outcome, then "
                                     "softmaxes them into probabilities"],
    ["3", "foTuneDist(…)", "~562", "A multiplicative tuning layer applied after the model"],
    ["4", "outcome draw", "~1210", "ONE uniform random number walks the cumulative distribution"],
    ["5", "fielding", "after", "Catch or drop, run-out, boundary saved — further draws"],
    ["6", "scoreboard", "tail", "Runs, wickets, balls, strike, over, innings state"],
], [8*mm, 34*mm, 14*mm, W - 56*mm]))
A(P("<b>There is exactly one probability vector per ball.</b> The model is not staged — it does "
    "not decide “wicket or not” and then “how many runs”. Dot, 1, 2, 3, 4, 6, five "
    "kinds of dismissal and four kinds of extra all compete in a single softmax, and one random "
    "draw picks the winner. This is a sound design and is not the problem."))

A(H2("The outcome buckets"))
A(C("dot   1   2   3   4   6\n"
    "wC (caught)   wB (bowled)   wLBW   wRO (run out)   wST (stumped)\n"
    "wide   noball   bye   legbye"))

# ---------------------------------------------------------------- skill
A(H1("2.  Where player skill enters — and the architectural flaw"))
A(P("Skill reaches the ball through exactly three channels."))

A(H2("Channel 1 and 2 — absolute quality, independently softened"))
A(C("bs = 10 · tanh( (bat.bat    - 56.6) / 10 )      the batsman\n"
    "wt = 10 · tanh( (bowl.threat - 68.1) / 10 )      the bowler"))
A(P("Each man is measured against a fixed global average and the result is squashed by "
    "<font face='Courier' size='9'>tanh</font> with a ceiling of 10. The two numbers are then "
    "<i>subtracted from each other in the log-odds</i> — but each has already been flattened "
    "on its own, so the comparison happens after the information has gone."))

A(H2("Channel 3 — the difference, which is switched off most of the time"))
A(C("mmRaw  = (threat - 68.1) - (bat - 56.6) - (-10)\n"
    "mmOver = max( 0, |mmRaw| - 15 )          &lt;- the dead band\n"
    "mm     = sign · 2.0 · tanh( (mmOver²/300) / 2.0 )"))
A(P("<b>This is the only term in the engine that genuinely compares the two cricketers, and it "
    "is exactly zero until they are roughly 25 skill points apart</b> "
    "(<font face='Courier' size='9'>mismatch_free = 15</font> combined with "
    "<font face='Courier' size='9'>mismatch_pivot = -10</font>)."))

A(H2("Why the three deliveries came out identical"))
A(P("For a 95 batsman against an 85 bowler:"))
A(C("mmRaw  = (85 - 68.1) - (95 - 56.6) + 10  =  -11.5\n"
    "|-11.5| < 15   -&gt;   mmOver = 0   -&gt;   mm = 0        (no mismatch at all)\n\n"
    "bs(95) = 10·tanh(38.4/10) = 9.99\n"
    "bs(85) = 10·tanh(28.4/10) = 9.94\n"
    "difference 0.05, multiplied by skill_bat 0.011  =  0.0006 on the logit"))
A(P("Ten points of world-class talent are worth six ten-thousandths of a log-odds unit. That is "
    "the dead top end, proven from the code rather than inferred from win rates.", 'note'))

A(H2("A fourth, quieter channel"))
A(C("stdRaw = (((bat - 56.6) + (threat - 68.1)) / 2 + 8) / 10\n"
    "std    = 1.5 · tanh( stdRaw / 1.5 )"))
A(P("<font face='Courier' size='9'>std</font> reads the <b>sum</b> of the two men, not their "
    "difference — it represents “what standard of cricket is this”, and it correctly "
    "makes better cricket score more and lose fewer wickets. It is not a comparison."))

A(PageBreak())

# ---------------------------------------------------------------- evidence
A(H1("3.  How much information survives the transforms"))
A(P("Pure arithmetic. What a ten-point improvement in raw skill is worth to the engine, at "
    "different points on the scale, for several values of the softening constant "
    "(<font face='Courier' size='9'>skill_soft</font>; shipped value is 10)."))
A(tbl([
    ["raw step", "soft=10", "soft=15", "soft=20", "soft=30", "soft=50", "linear"],
    ["20 -&gt; 30", "0.084", "0.614", "1.612", "3.897", "6.869", "10.000"],
    ["25 -&gt; 35", "0.227", "1.157", "2.508", "4.986", "7.622", "10.000"],
    ["45 -&gt; 55", "6.624", "8.139", "8.857", "9.456", "9.797", "10.000"],
    ["55 -&gt; 65", "8.445", "9.214", "9.535", "9.786", "9.921", "10.000"],
    ["70 -&gt; 80", "1.099", "3.036", "4.786", "7.007", "8.741", "10.000"],
    ["80 -&gt; 90", "0.159", "0.924", "2.146", "4.576", "7.354", "10.000"],
    ["85 -&gt; 95", "0.059", "0.487", "1.366", "3.546", "6.594", "10.000"],
], [26*mm] + [(W - 26*mm)/6]*6,
    align={i:'RIGHT' for i in range(1,7)}))
A(P("At the shipped setting a ten-point step is worth <b>8.4</b> points of engine signal in the "
    "middle of the range and <b>0.06</b> at the top — a factor of 143. The usable window is "
    "roughly raw 45 to 70, twenty-five points of a hundred-point scale.", 'cap'))

A(H1("4.  The causal bisect"))
A(P("Six configurations of the engine, 13 matchups each, 300 matches per cell, sides swapped and "
    "played on neutral ground. Each run turns off or widens exactly one term. This is the repo's "
    "own method for proving a term responsible — reading a formula and reasoning about it "
    "produced two confident wrong diagnoses in this investigation, and only the bisect corrected "
    "them."))
A(tbl([
    ["configuration", "25-&gt;35", "50-&gt;60", "70-&gt;80", "85-&gt;95",
     "50v50 runs", "85v85 runs", "85v85 wkts"],
    ["shipped", "86.7%", "73.7%", "61.7%", "52.3%", "300", "318", "3.67"],
    ["skill_soft 15", "88.3%", "75.3%", "64.0%", "56.3%", "310", "329", "3.36"],
    ["skill_soft 30", "87.7%", "77.0%", "63.7%", "60.0%", "329", "357", "3.05"],
    ["skill_soft 100", "93.0%", "84.0%", "67.7%", "55.7%", "359", "417", "1.92"],
    ["mismatch off", "80.0%", "70.7%", "62.0%", "52.3%", "313", "320", "3.60"],
    ["standard off", "85.3%", "69.7%", "62.7%", "60.7%", "187", "185", "8.12"],
], [30*mm] + [(W - 30*mm)/7]*7, size=8,
    align={i:'RIGHT' for i in range(1,8)}))

A(H2("What it establishes"))
A(B("<b>The mismatch term owns the low-end collapse, and owns it alone.</b> Disabled, a side of "
    "mean skill 25 facing one of 70 goes from 65.6 all out to 234.8, and from 9.95 wickets to "
    "7.77. Nothing else moved that number — tripling the softening made it worse (54.5) and "
    "zeroing the standard terms made it worse still (31.1)."))
A(B("<b>The standard terms own the scoring level.</b> Zeroed, every grade of cricket collapses to "
    "about 180 all out with an all-out rate over half — the best cricket in the world "
    "included. They are load-bearing."))
A(B("<b>Widening the softening is not a fix.</b> It buys about eight points of top-end resolution "
    "for forty runs of score inflation, does nothing whatever for the low-end cliff, and at extreme "
    "settings stops equal sides being neutral (25 v 25 comes out 57.7%)."))
A(B("<b>A hypothesis of mine was refuted.</b> I had argued from algebra that the softening caused "
    "the low-end cliff. It does not: 25-&gt;35 measures 86.7%, 88.3%, 87.7% and 93.0% as the "
    "constant triples — flat, then worse."))

A(PageBreak())

# ---------------------------------------------------------------- fixed
A(H1("5.  What has been changed, and what it bought"))
A(P("Two contained changes to <font face='Courier' size='9'>ballDist</font>, both written in the "
    "engine's own <font face='Courier' size='9'>tanh</font> idiom, both leaving ordinary cricket "
    "where it was calibrated. Committed as <font face='Courier' size='9'>a115e30</font> on the "
    "working branch; <font face='Courier' size='9'>main</font> is untouched."))

A(H2("Bounding the mismatch"))
A(C("before   mm = sign · mmOver² / 300                    (unbounded)\n"
    "after    mm = sign · 2.0 · tanh( (mmOver²/300) / 2.0 )"))
A(P("The old term reached 6.3 against an amateur, which the wicket coefficient turned into "
    "<b>+2.9 on a logit whose base is about -2.7</b> — a coin-toss wicket every ball. Below "
    "the cap the curve is virtually unchanged, so every mismatch a real league produces passes "
    "through as before."))

A(H2("Bounding the standard"))
A(C("before   std = stdRaw                                (unbounded, linear)\n"
    "after    std = 1.5 · tanh( stdRaw / 1.5 )"))
A(P("At 85 against 85 the old term reached 3.07 and took 0.77 off the wicket logit on its own, so "
    "an innings arrived at roughly 3.7 wickets and 318 runs <i>before anybody's relative advantage "
    "was considered</i>. An innings cannot lose much under three wickets, so a better batsman had "
    "nowhere to put his extra quality."))

A(tbl([
    ["measure", "before", "after"],
    ["25 v 70  — weak side runs", "65.6", "117.4"],
    ["25 v 50  — weak side runs", "119", "160.9"],
    ["25 v 35  — stronger side wins", "86.7%", "84.8%"],
    ["85 v 95  — stronger side wins", "52.3%", "56.8%"],
    ["50 v 50  — first innings", "300", "255"],
    ["70 v 70  — first innings", "320", "246"],
    ["85 v 85  — first innings", "318", "239"],
    ["85 v 85  — wickets lost", "3.67", "6.48"],
], [70*mm, (W-70*mm)/2, (W-70*mm)/2], align={1:'RIGHT',2:'RIGHT'}))

A(H2("The tails survived, which was the risk"))
A(P("A cap on a skill term can flatten a distribution while leaving its mean exactly where it was, "
    "so the mean is the one statistic that cannot detect the damage. Measured at 700 matches a "
    "cell, the bounded engine still produces cricket at both extremes, naturally and at believable "
    "rarity."))
A(tbl([
    ["contest", "min", "5th pct", "median", "95th pct", "max", "under 50", "over 400"],
    ["25 v 70", "9", "79", "220", "423", "455", "1.6%", "14.1%"],
    ["25 v 50", "21", "110", "271", "390", "427", "0.6%", "2.1%"],
    ["50 v 50", "60", "188", "278", "326", "359", "0%", "0%"],
    ["70 v 70", "7", "195", "264", "302", "334", "0.1%", "0%"],
    ["85 v 85", "101", "195", "254", "292", "340", "0%", "0%"],
], [26*mm] + [(W-26*mm)/7]*7, align={i:'RIGHT' for i in range(1,8)}))
A(P("A nine-all-out and a 455 both remain reachable by ordinary sequences of deliveries, and "
    "neither is forced by anything. No score caps, floors, rubber-banding or innings-total "
    "normalisation exist anywhere in the engine — audited specifically.", 'cap'))

A(PageBreak())

# ---------------------------------------------------------------- nonlinearity
A(H1("6.  Every nonlinearity in the delivery model"))
A(tbl([
    ["element", "formula", "what it does", "verdict"],
    ["SOFT", "10·tanh(v/10)", "Saturates 25 points from the mean, in BOTH directions",
     "Dangerous"],
    ["mismatch dead band", "max(0,|gap|-15)", "Zero response inside a 30-point window",
     "Dangerous"],
    ["mismatch curvature", "over²/300", "Small gaps nothing, large gaps explode", "Suspicious"],
    ["mismatch cap (new)", "2.0·tanh(x/2)", "Bounds the low-end cliff", "Healthy"],
    ["standard cap (new)", "1.5·tanh(x/1.5)", "Restores wicket headroom; removed the last "
     "channel separating 85 from 95", "Suspicious"],
    ["softmax", "exp(lo)/SUMexp", "Log-odds to probability compression near 0 and 1",
     "Healthy (inherent)"],
    ["new ball / grip", "exp(-over/8), logistic", "Phase shape over the innings", "Healthy"],
    ["field average", "clamp to [-1.2, 1.4]", "Hard clamp on team fielding", "Suspicious"],
    ["foTuneDist", "multiplicative", "Post-model tuning layer", "Unknown — not audited"],
], [30*mm, 32*mm, W-92*mm, 30*mm], size=8))

A(H1("7.  Hidden scale assumptions"))
A(P("The engine was fitted around a population that no longer describes the world we want to "
    "build. Every skill term is centred on a hard-coded average:"))
A(C("mean_bat 56.6    mean_thr 68.1    mean_pow 47    mean_rot 57.7    mean_ctl 64.6\n"
    "mismatch_pivot -10    mismatch_free 15    standard_pivot -8    skill_soft 10"))
A(P("<font face='Courier' size='9'>mean_thr = 68.1</font> carries the code comment "
    "“the best bowler alive has 68” — so the bowling term is <i>always</i> negative in "
    "the shipped world. Together these constants define a usable band of roughly twenty-five skill "
    "points, which is precisely why the entire cricket world, from the bottom of the second "
    "division to the best national side, has had to be squeezed into raw skill 20–35."))

A(H1("8.  What is left to do"))
A(P("<b>One architectural change, not a rewrite.</b> The pipeline, the single-softmax outcome "
    "selection, the correlated match state that produces genuine fat tails, the conditions and the "
    "talents are all sound and worth keeping."))
A(P("But the engine is fundamentally <i>absolute quality plus absolute quality</i>, with one "
    "relative term that is inert across a thirty-point window. No amount of parameter tuning fixes "
    "that, because at elite level there is nothing in the arithmetic that reads “this batsman "
    "is better than this bowler”."))
A(P("The fix is to make the batsman-versus-bowler <b>difference</b> a first-class, continuous "
    "input: either remove the dead band and soften the mismatch smoothly from zero, or re-express "
    "the two independently-softened absolute terms as one softened differential. The probability "
    "table on the first page is direct evidence for this rather than a hypothesis."))

A(H2("Honest remaining state"))
A(B("The low end is improved but not solved: a ten-point gap is still worth about 85% at the "
    "bottom against 57% at the top. Measurement shows this is driven by the low-scoring, "
    "high-wicket environment down there rather than by any skill term — a brittle innings "
    "converts a small per-ball edge into a large win-probability edge."))
A(B("The standard cap should be re-examined once the difference term is fixed. It may prove "
    "unnecessary, or want a higher ceiling."))
A(B("Three validations remain unrun: the batting-versus-bowling grid, the individual career curves "
    "at 70/80/85/90/95, and the production calibration retest. Each is a single command against "
    "the committed harness."))
A(B("The extras buckets do not scale with standard, so at very low totals they become a large "
    "share of the score. Plausible low-end distortion; unmeasured."))

A(H1("9.  Tooling, evidence and commits"))
A(tbl([
    ["commit", "what it is"],
    ["3d20a90", "strength-response harness — measures the engine across the full range"],
    ["78486d4", "bisect handle — turns one tuning term off at a time inside the test VM"],
    ["775084a", "causal evidence — the six bisect configurations and their verdict"],
    ["a115e30", "the engine fix — bounded mismatch and bounded standard, plus 8 regression tests"],
    ["53b6334", "tail evidence — percentile distributions proving extremes survived"],
    ["eda9412", "the arithmetic showing why sweeping the mismatch cannot smooth the low end"],
], [24*mm, W-24*mm]))
A(Spacer(1, 6))
A(P("Everything lives on the working branch. <font face='Courier' size='9'>main</font> has not been "
    "touched, the frozen golden master has not been re-blessed, and no part of the player world "
    "— ratings, wages, squads, national teams — has been modified. Raw output is under "
    "<font face='Courier' size='9'>docs/b1-evidence/</font>.", 'note'))
A(P("Engine test suite: <b>370 of 371 pass</b>, plus 8 new regression tests. The single failure is "
    "the bit-for-bit golden-master replay, which cannot pass after an authorised engine change and "
    "must not be edited to — that test existing is how we know the engine moved.", 'note'))

doc = SimpleDocTemplate(OUT, pagesize=A4,
                        leftMargin=20*mm, rightMargin=20*mm,
                        topMargin=18*mm, bottomMargin=20*mm,
                        title="Fifty Overs — match engine anatomy and Phase B1 findings",
                        author="Fifty Overs")
doc.build(story, onFirstPage=page, onLaterPages=page)
print("wrote", OUT)
