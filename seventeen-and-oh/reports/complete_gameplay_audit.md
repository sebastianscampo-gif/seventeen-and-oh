# 17-0 — Complete Gameplay Audit & Redesign

*A serious, gameplay-first design review of the historical NFL team-season drafting game.*

**Scope.** This document audits and redesigns the **gameplay experience** only — the loop, the decisions, the strategy, the simulation, the feedback, and the replay value. It deliberately does **not** touch code structure, visual styling, or data storage. It does **not** propose an MVP or a reduced first version. It does **not** alter the core identity of 17-0:

> *A historical NFL team-season drafting game where the player builds a full roster, tries to go 17-0, survives the playoffs, and wins the Super Bowl.*

Everything below is written to make that exact game deeper, more honest, more strategic, more realistic, and more replayable — never to make it a different game.

**The two modes are fixed.** Classic (ratings and fit visible before each pick) and Blind (names and positions only, ratings hidden until after the pick). No third *active* mode is introduced. Where additional modes appear, they are explicitly flagged as long-horizon expansion, never as a replacement for the two-mode spine.

---

## How the game actually works today (ground truth)

So that every recommendation is anchored to reality, here is the mechanical spine as it currently exists:

- **Roster:** 24 slots — QB×1, RB×1, WR×3, TE×1, LT/LG/C/RG/RT×1 each (5 OL), EDGE×2, DT×2, LB×2, CB×3, S×2 (an 11-man offense and an 11-man 4-2-5 nickel defense), plus K×1 and P×1 marked optional.
- **Draft:** 24 rounds. Each round a spin wheel lands on one random team-season inside the player's chosen timeline window (the immediately-previous team-season is avoided). The player drafts **one** player from that team-season into **one** open slot, then spins again.
- **Position fit:** a 0–1 multiplier on a player's overall when slotted off-position. Natural = 1.0; tagged secondary positions floor at 0.93; QB anywhere else = 0.50; K/P are hard-locked out of everything else at 0.05; everything else falls through a fit matrix (e.g. WR→TE 0.72, CB→S 0.88, EDGE→LB 0.90) or a 0.52 generic penalty. `effectiveRating = round(overall × fit)`.
- **Displayed Team Rating** (`computeScore`): `total = offense×0.40 + defense×0.40 + fit×0.10 + balance×0.05 + star×0.05`, where offense/defense are simple averages of the 11 effective ratings on each side.
- **Simulation strength** (`team-profile.power`, a *different* formula): `power = clamp(0.30×offense + 0.32×defense + 0.16×qb + 0.08×oLine + 0.14×starScore, 0, 100)`.
- **Schedule:** 17 generated opponents. Each is a rolled tier (weak/average/good/great/elite at 18/34/28/14/6%) with power and unit ratings jittered by a Gaussian; real franchise names are shuffled on top purely as flavor. No persistent opponents, no strength-of-schedule, no division/conference structure.
- **Matchups:** 6 unit-vs-unit edges (e.g. pass rush vs O-line). Each edge contributes `clamp(diff×0.16, ±3)`; their sum is clamped to ±6 and scaled by an upset factor.
- **Win probability:** logistic on `diff = power − oppPower + matchupTotal (+ home field 2.0) (+ playoff bonus)`, scale 20 in the regular season, 24 in the playoffs (more variance), clamped to [0.02, 0.98].
- **Playoff bonus** (playoffs only): `starCount×0.5 + (clutch−75)×0.1 + (qb−85)×0.09`, clamped to ±5.
- **Playoff qualification:** probabilistic by win total (14+ wins → 100%, 10 → 78%, 9 → 50%, 8 → 18%, …), not a literal standings bracket.
- **Endings:** a 9-state taxonomy from "missed the playoffs" up through "17-0 + Super Bowl ring," with narrative flavor for favorite losses and underdog wins.
- **Special teams:** `specialTeams` is computed in the team profile and **never read** by the simulation. K and P contribute nothing to outcomes.
- **Projection:** a 4,000-run Monte Carlo produces season-odds (chance of 17-0, playoffs, ring).

This is a genuinely strong skeleton — a real probabilistic engine with matchup interactions, playoff variance, and an honest "elite rosters barely threaten 17-0" stance. The work below sharpens it, fills its gaps, and makes the *player's* decisions matter as much as the math.

---

## 1. Full Gameplay Loop Analysis

**The loop today:** choose mode + timeline → spin → pick a player into a slot → repeat 24× → see a Team Rating → simulate a season → read an ending → restart. It is clean and complete end-to-end, which is rare and worth protecting. But as a *game* — a sequence of meaningful, tense, escalating decisions — it has four structural weaknesses.

**1.1 The loop is front-loaded and tension-flat.** All 24 decisions carry nominally equal weight, fired in a uniform spin-pick-spin rhythm. There is no escalation, no "draft clock," no moment where the stakes visibly rise. A great sports-draft experience has a shape: early rounds are about vision and value, middle rounds about filling needs, late rounds about damage control and gambles. Right now round 3 and round 22 *feel* identical even though they are strategically very different. The loop needs an **internal arc** — phases the player can feel, not just a counter ticking from 1 to 24.

**1.2 The payoff is a single number, then a single simulation.** The entire 24-decision investment resolves into one "Overall X.X" and one season run. That is a thin payoff for a long build, and it collapses the *story* of the roster into a scalar. The loop should resolve into a **multi-beat reveal**: identity → strengths/weaknesses → projected odds → the season itself → the ending. The simulation is the climax; today it arrives almost as an afterthought behind a rating screen.

**1.3 The loop has no memory.** Every playthrough is hermetically sealed. No record of past teams, no "you've now drafted Montana three times," no streaks, no meta-progression of any kind. A drafting game lives or dies on the *next run* — and nothing in the loop pulls the player into one.

**1.4 Agency is reactive, not proactive.** The wheel decides which team-season appears; the player only reacts. This is the single most important loop-shaping choice in the game, and it is currently pure RNG. That is defensible (it creates surprise and forces adaptation) but it caps strategic depth, because the player can never *pursue* a plan — only respond to what fortune deals. The loop needs at least a thin layer of **forward agency** (see §2) so the player feels like a drafter, not a slot-machine puller.

**Redesigned loop (same identity, more shape):**

1. **Setup** — mode, timeline, and (new) a one-line *team-building directive* the player opts into or declines (see §7).
2. **Draft, in three felt phases** — *Foundation* (rounds ~1–8: take the best high-leverage talent, premium positions), *Construction* (rounds ~9–18: fill needs, manage fit), *Endgame* (rounds ~19–24: scarcity bites, gambles and emergency fills). The phases are the same 24 spins — but the game *names* and *frames* the stakes so the player feels the arc.
3. **Roster reveal** — identity first (what kind of team did you build?), then strengths/weaknesses, then the headline rating, then the projected odds. A reveal *sequence*, not a static card.
4. **The season** — the simulation as the genuine climax, paced so the 17-game run and the playoffs have weight (see §8–10).
5. **The verdict** — the ending as a *story*, plus a concrete "here's the one decision that cost you / won you the season" takeaway (see §14).
6. **The hook** — a reason to immediately run it back: a new directive, a new timeline challenge, a record to beat (see §15).

This keeps every existing system. It re-sequences the payoff and gives the 24 decisions a dramatic shape.

---

## 2. Draft Decision Analysis

**What a single draft decision is today:** the wheel lands on a team-season; in Classic the player sees that roster's players with overalls, key attributes, and the fit each would have in each open slot; the player assigns one player to one slot. In Blind, the same but ratings are hidden.

**2.1 The core decision is sound but under-supported.** The real decision each round is a small optimization: *of the players this team-season offers, and the slots I still have open, which (player, slot) pairing most improves my team?* That is a legitimately interesting decision — it blends best-player-available, positional need, and fit penalties. The problem is the game gives the player almost no decision-support to reason about it well: no sense of opportunity cost, no sense of positional scarcity, no sense of how this pick moves the needle.

**2.2 The "regret" axis is the best mechanic in the draft — and it's invisible.** Because each slot can be filled only once and the wheel never repeats on demand, *timing* is everything. Fill QB in round 2 with a 78-overall game-manager and you may spin the '89 49ers in round 15 and be unable to put Montana at QB. This anticipation-and-regret tension is the soul of a drafting game. Today it is entirely implicit — the player only discovers the regret in hindsight, with no in-the-moment signal that "you still have your QB slot open and premium QBs are still out there." The game should **surface scarcity and regret risk** as first-class draft information (without removing the sting — see §4 vs §5 for how much to show per mode).

**2.3 There is no opportunity-cost framing.** When you draft a WR from the '99 Rams, you are also *declining* every other player on that roster forever. A strong draft makes the player feel the weight of what they leave behind. Right now passing on talent is silent. Even a light "you're passing on 4 other 88+ players from this team" beat would transform the decision's emotional weight.

**2.4 Slot assignment is the hidden strategic layer and deserves promotion.** Choosing to play a 95-overall safety at cornerback (0.85 fit → effective 81) *now* versus holding the CB slot for a natural fit *later* is a genuine, mathematically real trade-off the engine already supports. This is the most expert-feeling decision in the game and it is currently buried. It should be elevated to a deliberate, legible choice.

**2.5 The wheel needs a sliver of agency.** Pure RNG forever is exhausting over many runs and caps planning. Without changing identity, the draft can gain *thin* forward agency: a small number of per-draft "influence" actions — e.g., a couple of re-spins, or one "lock the next spin to a position of need," or a "reach" that guarantees a premium-position team-season once per draft. The point is not to remove luck (luck is core) but to let skilled players *steer* it occasionally, which is exactly what makes draft games re-playable for experts.

**2.6 Decisions should differ by draft phase.** Early, the right move is value-maximizing (take the best high-leverage player regardless of immediate need). Late, it is need-and-fit triage. The game currently presents identical information and framing in every round. Phase-aware decision support (see §1) makes each decision *feel* like the kind of decision it actually is.

---

## 3. Roster-Building Recommendations

**3.1 Resolve the build-vs-reward contradiction.** Today the *displayed* Team Rating rewards **balance** (a dedicated balance term that punishes offense/defense gaps) and treats all 11 starters per side as equal averages. But the *simulation* rewards **top-heavy star power and quarterback play** (power adds QB 0.16 and starScore 0.14 on top of offense/defense, and the playoff bonus rewards star count and elite QBs even more). So the game *tells* the player "build a balanced, deep roster" and then *rewards* "build a top-heavy, star-and-QB roster." A serious sports game must make its scoring and its outcomes point the same direction. **The displayed evaluation and the simulation strength must be reconciled into one coherent philosophy** (see §16). Whichever philosophy wins, the player must be building toward the thing that actually wins games.

**3.2 Make positional value explicit and real.** In real roster construction, QB ≫ edge ≈ tackle ≈ corner > everything > kicker. The engine half-believes this (QB and OL get bonus weight in `power`) but the *draft* presents every slot as equally worth filling. Roster-building gains enormous depth if positional value is a visible, consistent gradient the player drafts against — premium positions (QB, EDGE, LT, CB, WR1) should be understood as worth reaching for; commodity positions (interior OL depth, S2, WR3, K, P) as worth waiting on.

**3.3 Reward — don't just permit — roster *shape*.** Right now the only shape pressure is the balance term in the displayed score. Real teams have an identity: a juggernaut offense carrying a mediocre defense, a defense-and-running-game grinder, a balanced powerhouse. The roster-building layer should let the player *commit* to a shape and be rewarded for executing it well, rather than nudging everyone toward the same balanced blob (see §7).

**3.4 Make depth and the bench mean something — or formally declare it doesn't.** Today there is exactly one starter per slot and no bench; injuries don't exist, so depth is irrelevant. That is a legitimate design choice, but it removes a classic roster-building lever. At full scope (not MVP), 17-0 should decide deliberately: either (a) embrace the "best 24, no injuries" purity and lean into it as a clean puzzle, or (b) introduce a thin durability/injury dimension so depth and player availability become a real building consideration. This is a fork worth taking a clear position on.

**3.5 Treat special teams as either real or removed — never decorative.** K and P slots exist, cost draft consideration, and influence *nothing*. That is the worst of both worlds. Either special teams genuinely affect close games (field goals decide tight playoff matchups; a great punter flips field position) or the K/P slots should not pretend to be part of roster-building. Given the game's realism ambition and the existence of nail-biter playoff games, **special teams should become genuinely (if modestly) outcome-relevant** (see §16).

**3.6 The 4-2-5 nickel default is fine — but scheme should eventually matter.** The fixed nickel front is a reasonable modern default. As a long-horizon expansion (not core), letting the player choose a defensive front (e.g. a heavier 3-4 vs a lighter nickel) that changes which slots exist and how fit is computed would deepen roster-building without altering the game's identity. Flagged as advanced, not core.

---

## 4. Classic Mode Recommendations

Classic is the "informed GM" mode: ratings, key attributes, and fit visible before every pick. Its job is **strategic depth with full information** — the player should feel like a smart evaluator making optimal trade-offs.

**4.1 Classic should expose opportunity cost and scarcity, because it can.** Since information is the whole point of Classic, this is the mode where the game should lean *in* to decision support: show what you're passing up on this team-season, show which premium positions remain unfilled, show how this pick moves your projected strength. Classic is where the player earns the right to optimize — give them the instruments to do it.

**4.2 Classic must show the *right* number.** If the headline rating a Classic player optimizes against is not the number that wins games (§3.1), Classic is actively lying to its most engaged audience. In Classic especially, the visible evaluation must be the same philosophy the season honors. An informed-GM mode whose information is misleading is a broken contract.

**4.3 Classic needs marginal-value framing, not just absolute ratings.** A 90-overall WR added as your *fourth* receiver is worth far less than a 90-overall added as your QB. Classic should help the player reason about *marginal* contribution to the team, not just admire raw overalls. This is the difference between a ratings *viewer* and a strategy *game*.

**4.4 Classic should make fit a deliberate lever, not a passive readout.** The fit multipliers are already shown; Classic should turn them into an active decision — "take this elite player out of position now (and eat the penalty) or hold the slot." Surfacing the *expected* cost of waiting (scarcity at that position) versus the *certain* cost of the fit penalty is the signature expert decision Classic can own.

**4.5 Keep Classic honest about luck.** Even fully informed, the player cannot control the wheel. Classic should make clear that information ≠ control — the skill is in *adapting* optimally to what the wheel deals, not in executing a fixed plan. The thin agency tools (§2.5) matter most here, where the player has the knowledge to use them well.

---

## 5. Blind Mode Recommendations

Blind is the "trust your football knowledge" mode: names and positions only, ratings hidden until after the pick. Its job is **a knowledge-and-nerve test** — the player drafts on reputation, era memory, and gut.

**5.1 Blind's missing climax is the reveal.** A blind-draft game is fundamentally about the *moment the curtain lifts*. Today the ratings are simply hidden during the pick and then exist on the final screen — there is no satisfying per-pick or end-of-draft **reveal beat**. Blind should deliver the payoff its premise promises: the dramatic unveiling of what you actually built, ideally pick-by-pick or in a punchy end-of-draft "here's your real team" sequence. Without the reveal, Blind is just Classic with information removed — a subtraction, not a different game.

**5.2 Blind should be *graded*, because grading is the fun.** The entire pleasure of a blind draft is finding out how good your instincts were. Blind should score the player's *evaluation skill* — did you pick the best available player at that slot from that team-season, or did reputation fool you? A "draft IQ" / "scout grade" that only Blind can produce is the mode's signature reward and its biggest replay hook.

**5.3 Blind should lean on *reputation* signals, not numeric ones.** Names and positions alone are thin for casual-but-knowledgeable players and brutal for everyone else. Blind can stay true to its premise while adding *non-numeric* texture — era, team context, a reputational hint — that lets knowledge (not rating-reading) drive the decision. The line to hold: signals that reward *football memory*, never signals that leak the hidden overall.

**5.4 Blind needs a fairness floor.** Because outcomes hinge on hidden numbers, a Blind player can feel cheated by a pick that "looked right" but graded poorly. The post-pick reveal must *teach* — show why the better choice was better — so Blind feels like a skill you can improve, not a coin flip you can't see.

**5.5 Blind and Classic should produce comparable, contrastable results.** A player should be able to run the same timeline in both modes and meaningfully compare "how I did informed vs on instinct." That contrast is a strong replay driver and a reason both modes coexist. The result summary should make the comparison legible.

---

## 6. Position-Fit Recommendations

The fit system (the 0–1 multiplier matrix) is one of the game's best realism mechanics and is mostly well-tuned. Recommendations refine it rather than replace it.

**6.1 Fit should drive *narrative*, not just arithmetic.** Playing a corner at safety isn't only an 0.85 multiplier — it's a *story* ("you're asking a press corner to play deep middle"). The completed-roster review and the season story (§13, §14) should reference out-of-position starters as characterizing facts about the team, not just silent rating haircuts.

**6.2 Audit the matrix for realism outliers.** A few values deserve a second look against football reality: WR→TE at 0.72 is arguably too generous for a modern split end asked to inline-block; the generic 0.52 "wrong fit" floor is doing a lot of heavy lifting across very different mismatches (a guard at corner and a linebacker at receiver are not equally bad). The matrix would benefit from a pass that distinguishes *athletic-adjacent* mismatches (recoverable) from *physically-impossible* ones (should approach the K/P lockout floor).

**6.3 Make the secondary-position floor (0.93) a meaningful draft signal.** Players tagged with a real secondary position are *versatility assets* — they let you fill two needs with one pick. That versatility is currently invisible at draft time. Flagging "this player credibly plays two of your open slots" turns fit from a penalty system into a *positive* drafting consideration, which is more interesting than only ever punishing mismatches.

**6.4 Fit should interact with scheme and matchup, not sit in isolation.** An out-of-position starter should be *more* exposed in the specific unit matchups they're weak in (a converted safety at corner getting picked on by a great receiving corps). Tying fit to the 6-edge matchup engine (§11) makes off-position gambles feel consequential in the *right* games, not as a flat season-long tax.

**6.5 Preserve the special-teams hard lockout.** The 0.05 K/P cross-boundary lockout is correct and realistic and should stay. Specialists being non-interchangeable with field players is a feature; don't soften it.

---

## 7. Team Identity Recommendations

This is the game's largest untapped opportunity. The engine *already computes* a unit profile (QB, pass offense, rush offense, O-line, receivers, pass rush, run defense, linebackers, secondary) and even identifies a **best** and **weakest** unit — but the player never *plays toward* an identity. Identity is computed, not chosen, and barely surfaced.

**7.1 Let the player commit to an identity — and reward execution.** Before or early in the draft, the player should be able to opt into a team-building directive: *Air-It-Out* (elite QB + receivers), *Ground-and-Pound* (O-line + back + play-action), *Bend-Don't-Break Defense*, *Trench Warfare* (both lines), *Balanced Juggernaut*, etc. Committing should shape the season: a team that *executes* its identity well earns matchup and variance advantages that fit its style. This converts "build the highest average" into "build a *team* with a soul," which is the entire appeal of football roster games.

**7.2 Surface the computed identity as a first-class reveal.** Even before adding chosen identities, the game already knows your best and weakest units. That belongs at the *front* of the roster reveal — "This is a quarterback-and-receiver team with a soft interior defense" — as the headline characterization, ahead of the scalar rating. Identity-first framing makes every roster feel distinct even when two teams have the same Overall.

**7.3 Identity should change *how* you win, not just *whether*.** A ground-and-pound team should win ugly, low-variance games; an air-raid team should win shootouts and occasionally get blown out. Tying identity to the variance/matchup model (not just to raw power) means two 88-rated teams play *differently*, which is the realism payoff and a major replay driver.

**7.4 Identity should create draft tension.** Committing to *Air-It-Out* should make passing on a generational pass rusher *hurt* in an interesting way ("great player, wrong team"). Identity gives the draft a *thesis* against which every pick is either on-brand or a luxury — exactly the kind of self-imposed constraint that makes drafting addictive.

**7.5 Identity is the natural backbone of replayability.** "Win 17-0 as a run-first team from the 1970s" is a far stronger reason to replay than "draft again." Identity + timeline together generate a near-infinite set of self-evident challenges (see §15).

---

## 8. Regular Season Recommendations

The 17-game regular season is where 17-0 earns its name, and it is currently the engine's weakest narrative link because the opponents are anonymous noise.

**8.1 Give opponents persistent identity and a real schedule.** Today's 17 opponents are rolled tiers with shuffled names and no continuity. For a game *named after a perfect season*, the schedule must feel like a gauntlet of real, identifiable challenges — recognizable opponent teams, a sense of early cupcakes and late marquee tests, and ideally a structure (division/conference flavor) that gives the 17 games shape. Anonymous opponents make 17-0 feel like 17 coin flips instead of a *journey*.

**8.2 Strength of schedule must exist and be felt.** Right now every player faces the same statistical distribution of opponents regardless of their roster, era, or timeline. A real season has an SOS, and going undefeated against a brutal slate should *mean more* than against a soft one. SOS should affect both the difficulty and the *credit* the player earns (a 15-2 against murderers' row can be a better team than a 17-0 against pushovers). This single change makes the regular season a story instead of a dice sequence.

**8.3 Pace the season into a felt arc.** Seventeen games resolved in one batch is anticlimactic. The season should have *beats*: a fast start, a midseason gut-check (the first real threat to the perfect record), a stretch run where the undefeated pressure mounts. The drama of 17-0 is *the streak surviving*, week after week — the pacing should let the player feel each near-miss.

**8.4 The undefeated chase needs escalating pressure.** As the win streak grows, the stakes of each game should *feel* higher — a 9-0 team facing its toughest remaining opponent is the heart of this game. The model already produces upset probabilities; the *presentation and pacing* should turn "game 12 of 17" into "can the perfect season survive its hardest test." Tension is a design output, not just a math output.

**8.5 Marquee games and signature wins.** Not all 17 wins are equal. Beating an elite opponent to stay perfect should be a *signature win* the game remembers and surfaces in the final story (§14). This gives the regular season memorable peaks instead of a uniform W-W-W ribbon.

**8.6 Close games should generate the most story.** A 51%-win nail-biter survived is more dramatic than a 95% blowout. The season recap should weight *how* you won — comfortable, escaped, survived — so the regular season produces narrative texture, not just a record.

---

## 9. Playoff Recommendations

The playoff system has the engine's best instincts — higher variance (scale 24 vs 20) and a star/clutch/QB bonus that rewards top-end talent when it matters most. The recommendations make it a *bracket the player feels*, not a probability draw.

**9.1 Make the playoffs a real bracket, not a qualification roll.** Today, making the playoffs is a probability check against win total, and the bracket is procedurally seeded. For a game whose climax is "survive the playoffs," the player should experience an actual bracket: a seed earned by the regular season, identifiable opponents of escalating quality, and a clear path to the Super Bowl. The win-total qualification odds are a clever abstraction, but the *playoff run itself* deserves to be concrete and dramatic.

**9.2 Seeding must be earned and matter.** A perfect or near-perfect season should yield a top seed with home field throughout — and home field (already a +2.0 factor) should be a *felt* reward, not a silent modifier. Earning the right to play every game at home is exactly the kind of regular-season payoff that makes the 17 games matter beyond the streak.

**9.3 Escalating opponent quality through the rounds.** Each playoff round should visibly raise the bar — wild-card, divisional, conference championship, Super Bowl — with opponents getting better and the variance staying high. The player should feel the difficulty ramp, not just face another sampled team.

**9.4 The higher playoff variance is correct — keep it, and explain it.** Real playoffs are where favorites fall; the bumped randomness models this well. But the player should *understand* that the playoffs are deliberately more volatile (your 78% regular-season team is a coin flip closer in January) so that a playoff upset feels like *football*, not like the game cheating. Communicated variance is fair variance.

**9.5 Star and clutch play should be the playoff difference-maker — and be legible.** The playoff bonus (star count, clutch, elite QB) is a great instinct: it means a balanced-but-starless team can go 17-0 and *still* lose in January to a team with three Hall-of-Famers. That is real football. The game should *show* this — "your stars showed up / your team had no closer" — so the player learns that **building for the playoffs (top-end talent) differs from building for the regular season (depth and balance).** That tension is one of the richest strategic ideas the game already half-contains.

**9.6 Each playoff game deserves its own weight.** Unlike the 17-game regular season (which can be paced as a streak), the 2–4 playoff games are individually monumental and should be presented as such — single, high-tension, named games with their own story, because *this* is the part the whole draft was building toward.

---

## 10. Super Bowl Recommendations

The Super Bowl is the literal goal in the name. It should be the single most charged moment in the game — and right now it is one more simulated game with an ending string.

**10.1 The Super Bowl must be a *destination*, not a final coin flip.** Everything — the perfect-season chase, the bracket, the draft itself — exists to reach this game. It should be framed, paced, and presented as the summit: the best opponent, the biggest stage, the highest stakes. The contrast between "another playoff game" and "the Super Bowl" should be unmistakable.

**10.2 The opponent should be a worthy final boss.** The title game should pit the player against a genuinely elite opponent (ideally the best team they've faced), so winning *means* something. A Super Bowl won against a mediocre opponent is a hollow climax; the final boss should be built to test the roster's actual identity and exploit its weakest unit.

**10.3 The outcome should hinge on the team you built — visibly.** Whether the player wins should clearly trace back to draft decisions: the elite QB who delivered, the weak secondary that got torched, the star edge who took over. The Super Bowl is where the *whole audit's worth of decisions* should pay off or come due, and the game should make that causal line explicit (§14).

**10.4 17-0-and-a-ring deserves a distinct, earned celebration.** The perfect season *plus* the Super Bowl is the maximal achievement and the game's namesake. It must be a categorically bigger payoff than any other ending — the rarest, most celebrated result, clearly set apart from "great season, lost the Super Bowl" or "17-0 but fell in the playoffs." This is the mountaintop; it should feel like one.

**10.5 Losing the Super Bowl is its own story.** Going 17-0 (or deep) and losing the final game is one of sport's great heartbreaks. That ending deserves bespoke, weighty storytelling — not a generic "you lost" — because near-misses are what bring players back to try again.

---

## 11. Upset Logic Recommendations

The upset machinery (matchup edges, an upset factor, capped swings, clamped win probabilities) is genuinely good systems design. The recommendations make upsets *legible and fair* rather than mysterious.

**11.1 Upsets must feel earned, not random.** Today an upset emerges from logistic noise plus matchup totals. When the player's favored team loses, they should be able to see *why*: a specific bad matchup (your weak O-line vs their elite pass rush), variance on a close line, a star who didn't show. An upset with a visible cause is dramatic; an upset without one feels like the dice hate you. The 6-edge matchup engine already contains the causes — they must be surfaced (§12, §14).

**11.2 Matchups should be the primary upset driver, not raw randomness.** The most satisfying upsets in football are *stylistic* — a team built to exploit your one weakness beats a team that's better on paper. The engine should lean harder on the matchup edges (and on identity, §7) as the *reason* underdogs win, so upsets reward and punish *how you built your team*, not just bad luck. Randomness should be the tiebreaker, not the engine.

**11.3 The upset rate must be tuned to football reality and held there.** Real NFL favorites win roughly two-thirds of the time; heavy favorites much more. The variance should be calibrated so upsets are *frequent enough to be scary, rare enough to feel meaningful*, and explicitly higher in the playoffs. §16 sets concrete targets. The cardinal sin is variance so high that roster quality stops mattering — that would gut the entire draft.

**11.4 Protect against both failure modes.** Too little variance → the best roster always wins and 17-0 is trivially solvable → no tension. Too much variance → drafting doesn't matter → no point. The upset logic must be tuned to the knife's edge where *a great team usually wins but never safely*, which is exactly what makes a perfect season feel precarious and precious.

**11.5 Upsets should respect identity and fit.** An out-of-position starter (§6) or a team that abandoned its identity (§7) should be *more* upset-prone in the games that expose them. This ties the upset system back to the draft, closing the loop: bad roster decisions create *specific, explicable* vulnerabilities that specific opponents exploit.

---

## 12. Draft Feedback Recommendations

This is the most glaring missing system. **The player currently receives zero feedback during the draft.** They pick 24 times in a vacuum and learn nothing until the final rating screen. For a strategy game, this is a critical gap — the player can't learn, can't course-correct, and can't feel the consequences of choices while they still matter.

**12.1 Every pick needs an immediate, honest reaction.** After each selection, the game should react: was this strong value, a reach, a need-fill, a positional gamble, an out-of-position stretch? Not a grade that breaks Blind mode's premise (§5) — but a *characterization* of the decision that makes each pick feel acknowledged. Twenty-four silent picks is twenty-four missed chances to engage the player.

**12.2 Feedback must differ by mode.** Classic can give *evaluative* feedback ("excellent value — best available at a premium position"). Blind must give *non-numeric* feedback during the draft and save the evaluative reveal for after (§5.1), or it breaks the mode. The feedback system must be mode-aware by design.

**12.3 Show running team state.** The player should always know what they're building: which premium slots remain open, where they're strong and thin, how the identity is taking shape. This is the decision-support that turns blind slot-filling into informed construction (Classic) and at least into *oriented* gambling (Blind). The data exists (the unit profile is computed every pick) — it simply isn't shown during the draft.

**12.4 Flag scarcity and regret risk in the moment.** "You still need a QB and elite QBs are getting rarer" is the single highest-value piece of feedback the game could give, because it directly addresses the draft's core tension (§2.2). This is where feedback becomes *strategy*, not just commentary.

**12.5 Mark the pivotal picks.** Some picks matter far more than others (your QB, your first pass rusher). The feedback system should signal when a *high-leverage* decision is on the table, so the player feels the weight of the big choices and skims the routine ones. Not all 24 picks deserve equal ceremony.

**12.6 Feedback should teach across runs.** Over multiple drafts, the feedback should help the player get *better* — recognizing value, understanding positional scarcity, learning when to reach. A strategy game's feedback loop is its teacher; right now there is no teacher at all.

---

## 13. Completed Roster Review Recommendations

The moment the 24th pick lands, before any simulation, the player should get a rich, honest **scouting report** on what they built. Today they get five rating bars and a field map — competent, but it's a *stat sheet*, not a *verdict*.

**13.1 Lead with identity, not the scalar.** The first thing the review should say is *what kind of team this is* (§7.2) — "an elite-quarterback, big-play offense with a vulnerable run defense" — because that's how humans understand football teams. The Overall number is a footnote to the identity, not the headline.

**13.2 Name the strengths and the fatal flaws.** The engine already finds the best and weakest unit. The review should celebrate the strength ("your pass rush is championship-caliber") and *warn* about the weakness ("your interior O-line will get your QB hurt") — and explicitly tell the player which opponents/styles will exploit that flaw. A scouting report that hides the team's weakness isn't a scouting report.

**13.3 Make the review *honest about playoff vs regular-season fit*.** A balanced, deep, starless team and a top-heavy, star-driven team can have the *same Overall* and *completely different* postseason ceilings (§9.5). The review should tell the player which kind of team they built and what that means for the 17-0 chase vs the Super Bowl chase. This is the strategic payoff of the whole draft made explicit.

**13.4 Highlight the bold and the questionable decisions.** "You reached for a QB and it paid off — he's the best player on the roster." "You're starting a corner at safety; that's a gamble against pass-heavy teams." The review should reflect the player's *choices* back at them, so the roster feels authored, not assembled.

**13.5 Let the player sit with the team before simulating.** The review is the last moment of *anticipation* before fate is rolled. It should be a satisfying pause — a chance to admire and worry about the team — not a speed bump on the way to the result. This is where pride and dread live; give them room.

**13.6 Set honest expectations.** The review should preview the odds *truthfully* — "this is a good-not-great team; 17-0 is a long shot but a deep playoff run is realistic" — so the simulation's outcome feels fair against the player's own understanding of what they built.

---

## 14. Final Result Storytelling Recommendations

The 9-ending taxonomy and the favorite-loss/underdog-win narrative flavor are a strong foundation. But the *result* is the emotional climax of the entire game and deserves to be a **story**, not a label.

**14.1 The result must be a narrative, not a verdict string.** "17-0, lost in the Super Bowl" is an outcome; *the story of how it happened* is the payoff. The ending should recount the season's arc — the signature wins, the near-misses, the game it all turned on — so the player relives the journey, not just reads its result.

**14.2 Name the decisive moment.** Every season has a turning point: the upset that ended the perfect run, the playoff game your star won single-handedly, the Super Bowl your weak secondary lost. The storytelling should *identify and dramatize that moment* — it's the single most memorable beat and the strongest reason to run it back.

**14.3 Trace the outcome back to the draft.** This is the audit's keystone: the final story should close the loop to the player's *decisions*. "Your round-3 gamble on an elite QB carried you to 17-0; your thin interior defense, drafted late, finally broke in the Super Bowl." When the result clearly traces to the build, *every* draft decision retroactively gains weight — and the player immediately wants to draft again to fix the flaw. **This is the mechanism that turns a single playthrough into a habit.**

**14.4 Differentiate the nine endings emotionally.** A perfect-season Super Bowl win and a "missed the playoffs" must feel *categorically* different — different ceremony, different weight, different tone. A heartbreak (17-0 then a Super Bowl loss) should *sting*; a Cinderella run (squeaked into the playoffs, caught fire) should *delight*. The endings exist; their emotional differentiation is what's missing.

**14.5 Make signature performances part of the story.** "Your QB threw for the season in the conference championship." "Your rookie corner had the game of his life in the Super Bowl." Individual-player story beats make the roster feel *alive* and reward the player for the specific stars they drafted.

**14.6 Give the player something to carry forward.** The result should produce a *keepsake* — a shareable, comparable record of this team and this season — that feeds the meta-progression and replay systems (§15). The story shouldn't evaporate the moment the player restarts.

---

## 15. Replayability Recommendations

This is where 17-0 is currently thinnest and where its potential is largest. A drafting game *is* its replay loop. Right now there is none: no memory, no goals beyond "draft again," no reason to choose *this* run over *that* one.

**15.1 Challenges are the killer feature.** Timeline + identity + mode already generate a vast space of self-evident challenges: "Go 17-0 with a 1970s ground-and-pound team in Blind mode." "Win a ring using only one decade." "Perfect season without a top-10 QB." A curated and procedurally-extensible set of **named challenges with clear win conditions** would give every run a *purpose*, which is the difference between a toy and a game with legs.

**15.2 The two modes are a built-in replay axis — use them.** Running the same timeline in Classic then Blind, and comparing results (§5.5), is a strong, cheap replay driver. The game should actively invite this contrast ("you went 14-3 informed — can your instincts match it?").

**15.3 Meta-progression that respects the core.** The game needs a reason to return *across* runs: a record book (best season per timeline, longest win streak, most rings), a collection (team-seasons or legends you've drafted), milestone achievements. Nothing pay-to-win or grind-y — just a *persistent sense of accumulation* so the player is always building a career, not just a roster. This is the single biggest lever on long-term retention.

**15.4 Timelines are an under-exploited replay engine.** The timeline filter is a great mechanic that currently only changes the talent pool. It should be framed as *eras with character* — drafting a 1970s team should *feel* different (run-heavy, defense-driven) from a 2010s team (pass-happy, spread). Era identity (tied to §7) turns the timeline slider from a filter into a set of distinct *games within the game*.

**15.5 Variance is a replay ally — when it's fair.** Because the wheel and the season are stochastic, the *same strategy* yields different stories each run. That is good — *if* the player feels their decisions still dominate outcomes (§11.4). Well-tuned variance means "I want to try that build again and see if it holds up," which is exactly the replay impulse to cultivate.

**15.6 Seeds and shared challenges.** The game already supports a seed. Surfacing it — "beat my exact draft," "everyone drafts the same wheel this week" — turns a solo toy into a *comparable, competitive* experience. Daily/weekly shared seeds with leaderboards is a proven, identity-preserving way to make a single-player drafting game endlessly re-playable.

**15.7 Escalating difficulty for mastery.** Once a player can routinely go 17-0, the game must have somewhere harder to go: tougher schedules, higher variance, tighter talent pools, self-imposed constraints. A skill ceiling is what keeps experts; without one, mastery ends the game.

---

## 16. Gameplay Balance Targets

Concrete, defensible targets so the game is *tuned*, not just *built*. These are design goals for the *feel* of the numbers, not implementation details.

**16.1 17-0 should be rare and precious.** The namesake achievement must sit at the far end of the difficulty curve. Target: even a genuinely elite, well-constructed roster should complete a perfect *regular* season only occasionally (a *strong minority* of its runs, not a coin flip and not a near-certainty); an average roster should almost never. If 17-0 is common, the title means nothing; if it's impossible, the game is unwinnable. The current "only a truly stacked roster realistically threatens 17-0" instinct is exactly right — hold that line.

**16.2 The full 17-0 + Super Bowl ring should be the rarest outcome by a wide margin.** Stacking a perfect season *and* a title run should be a genuine, memorable accomplishment — the kind a player chases across many sessions. It should be clearly harder than either alone.

**16.3 Roster quality must dominate outcomes; variance must threaten them.** Target balance: across many seasons, the better-built team should win the clear majority of individual games (≈ two-thirds for a solid favorite, more for a heavy one, mirroring real NFL favorite win rates) — *but never feel safe in any single game*. Roster quality sets the *odds*; variance keeps every game *live*.

**16.4 Playoffs measurably more volatile than the regular season.** The bumped playoff variance (and reduced power gap) should be real and felt: a team that was a comfortable regular-season favorite should be meaningfully closer to a coin flip in a given playoff game, so January upsets are common enough to be terrifying. This is what makes "survive the playoffs" a distinct challenge from "go 17-0."

**16.5 Star/QB construction should beat balanced construction *in the playoffs* — and the reverse in the regular season.** Target a real, learnable trade-off: depth-and-balance maximizes regular-season win expectancy (fewer bad games → better shot at 17-0), while top-end star power maximizes playoff ceiling (the bonus rewards closers when variance is high). A player who learns to build *differently* depending on whether they're chasing the perfect season or the ring is a player the game has successfully taught.

**16.6 Position value must be tuned to football reality.** QB the most valuable by a clear margin; premium edge/tackle/corner/WR1 next; interior depth, S2, WR3 as commodities; K/P low but **non-zero** (see 16.7). The draft's reward structure should make reaching for a QB *correct* and reaching for a third linebacker *wrong*, matching real roster-building.

**16.7 Special teams should be modest but real.** Target: special teams swing only the *closest* games (a great kicker wins a 50/50 nail-biter; a shaky one loses it), contributing meaningfully in maybe the tightest fraction of contests and ~nothing in blowouts. Enough that drafting a K/P is a real (if minor) decision; never enough to rival offense/defense. Today's zero is wrong; a large value would be equally wrong.

**16.8 Fit penalties should hurt enough to matter, not enough to forbid.** The fit multipliers should make out-of-position starts a *real cost* (a clearly worse expected outcome) without making them *never worth it* (an elite player out of position should sometimes beat a mediocre one in position). The current matrix is close; §6.2 refines the outliers.

**16.9 One coherent strength number.** The single most important balance fix: the number the player *optimizes* (displayed rating) and the number that *determines outcomes* (simulation power) must express the same football philosophy (§3.1). They need not be literally identical, but they must never point the player toward a build that the season then punishes. A strategy game with two contradictory definitions of "good" cannot be balanced — it's balanced against *itself*.

**16.10 Difficulty should scale, not cap.** Once mastered, the game needs harder targets (§15.7) so the balance curve extends for experts instead of flat-lining at "I always go 17-0."

---

## 17. Complete Gameplay Roadmap

Four buckets, ordered by how fundamentally each changes the experience. Every item is rated:

- **Priority** (H/M/L) — how urgently the game needs it.
- **Difficulty** (E/M/H) — design/build effort (gameplay-design effort, not code estimate).
- **Gameplay impact** (H/M/L) — how much it improves the actual play experience.
- **Why it matters** — the design rationale.
- **Risk if ignored** — what stays broken.
- **Risk if implemented poorly** — the failure mode to avoid.

---

### Bucket A — Core Gameplay Corrections
*Fix what's actively broken or contradictory before adding anything. Nothing else matters if the foundation lies to the player.*

**A1. Reconcile the displayed rating with the simulation strength into one philosophy.**
*Priority: H · Difficulty: M · Gameplay impact: H.*
**Why it matters:** The player currently optimizes a number (balance-weighted, all-starters-equal) that is *not* the number that wins games (QB/star/OL-weighted). The whole strategy layer is built on a false signal. **Risk if ignored:** every other recommendation that relies on honest feedback (§4, §12, §13, §16) inherits the lie; skilled players are actively misled. **Risk if poor:** over-simplifying into one blunt number erases the nuance (offense/defense/fit/balance/star) that makes the evaluation interesting — reconcile the *philosophy*, don't flatten the detail.

**A2. Make special teams outcome-relevant (or formally remove the slots).**
*Priority: H · Difficulty: E · Gameplay impact: M.*
**Why it matters:** K/P slots cost draft attention and decide nothing; the computed `specialTeams` value is never read. That's a dead mechanic in a realism game with close playoff games. **Risk if ignored:** two roster slots remain decorative; the game quietly teaches that special teams don't matter, which is unrealistic. **Risk if poor:** overweighting ST so kickers swing non-close games would be absurd — keep it to the tightest contests (§16.7).

**A3. Introduce per-pick draft feedback (mode-aware).**
*Priority: H · Difficulty: M · Gameplay impact: H.*
**Why it matters:** 24 silent picks is the single biggest engagement gap; the player can't learn or feel consequences while they still matter (§12). **Risk if ignored:** the draft stays a vacuum; no in-the-moment tension or teaching. **Risk if poor:** evaluative feedback leaking into Blind mode breaks Blind's entire premise — feedback *must* be mode-aware.

**A4. Surface scarcity and regret risk during the draft.**
*Priority: H · Difficulty: M · Gameplay impact: H.*
**Why it matters:** timing-and-regret is the draft's core tension (§2.2) and it's currently invisible until hindsight. **Risk if ignored:** the most interesting decision in the game is one the player can't see to make. **Risk if poor:** showing *too much* (especially in Blind) removes the gamble — calibrate by mode (full in Classic, oriented-but-not-numeric in Blind).

**A5. Tune the core variance so roster quality dominates but never feels safe.**
*Priority: H · Difficulty: M · Gameplay impact: H.*
**Why it matters:** the entire draft is pointless if variance is too high, and 17-0 is trivial if it's too low (§11.4, §16.3). **Risk if ignored:** the game sits at an unverified balance point; the namesake achievement may be trivial or impossible. **Risk if poor:** chasing "realistic upset rates" without protecting roster dominance turns the draft into decoration.

**A6. Elevate slot-assignment / fit as a deliberate, legible decision.**
*Priority: M · Difficulty: E · Gameplay impact: M.*
**Why it matters:** the most expert decision in the game (play elite-out-of-position now vs hold the slot) already exists mechanically but is buried (§2.4, §4.4). **Risk if ignored:** the game's deepest tactical layer stays hidden from the players who'd love it. **Risk if poor:** over-automating the choice (auto-suggesting the "optimal" slot) removes the very agency that makes it interesting.

---

### Bucket B — Full Gameplay Completion
*Build out the half-finished systems so the game is whole: a real season, a real bracket, a real Super Bowl, a real result.*

**B1. Give the regular season real opponents, a schedule, and strength-of-schedule.**
*Priority: H · Difficulty: H · Gameplay impact: H.*
**Why it matters:** a game named after a perfect season needs a gauntlet that feels real, not 17 anonymous tier-rolls (§8.1–8.2). **Risk if ignored:** 17-0 feels like 17 coin flips, not a journey; the central achievement lacks weight. **Risk if poor:** over-engineering a full standings/division model could bloat the loop — the goal is *felt* opponents and SOS, not a spreadsheet.

**B2. Turn the playoffs into a real, escalating bracket with earned seeding.**
*Priority: H · Difficulty: H · Gameplay impact: H.*
**Why it matters:** "survive the playoffs" is a core pillar; a probability roll doesn't deliver it (§9.1–9.3). **Risk if ignored:** the game's second act is an abstraction the player doesn't experience. **Risk if poor:** a bracket that ignores the clever win-total qualification logic, or that drops the (correct) higher playoff variance, would lose what already works.

**B3. Make the Super Bowl a distinct, climactic final boss.**
*Priority: H · Difficulty: M · Gameplay impact: H.*
**Why it matters:** it's the literal goal in the title and currently just another sim game (§10). **Risk if ignored:** the entire game's climax lands flat; the namesake payoff is muted. **Risk if poor:** spectacle without substance (a big screen but the outcome doesn't trace to the roster) feels hollow — the result must hinge on what the player built (§10.3).

**B4. Turn the result into a narrative that traces back to the draft.**
*Priority: H · Difficulty: M · Gameplay impact: H.*
**Why it matters:** the decisive-moment-traced-to-a-pick story (§14.3) is *the* mechanism that converts one playthrough into a habit. **Risk if ignored:** the climax stays a label; players don't connect outcomes to decisions and don't feel pulled to retry. **Risk if poor:** generic mad-lib narration ("your team played hard") is worse than a clean label — the story must cite *specific* games and *specific* picks.

**B5. Build the completed-roster scouting report (identity-first).**
*Priority: M · Difficulty: M · Gameplay impact: H.*
**Why it matters:** the pre-sim review is the anticipation peak and should characterize the *team*, name its fatal flaw, and set honest expectations (§13). **Risk if ignored:** the player goes into the season blind to what they built; the result feels arbitrary. **Risk if poor:** a wall of stats instead of a *verdict* keeps the current stat-sheet problem.

**B6. Make upsets legible — show the cause.**
*Priority: M · Difficulty: M · Gameplay impact: H.*
**Why it matters:** an upset with a visible cause (bad matchup, missing closer, close-line variance) is drama; one without is the dice cheating (§11.1). **Risk if ignored:** losses feel unfair; players blame RNG instead of their roster. **Risk if poor:** over-explaining every game with pseudo-stats buries the signal — surface the *one* decisive factor.

**B7. Deliver Blind mode's reveal and scout grade.**
*Priority: M · Difficulty: M · Gameplay impact: H.*
**Why it matters:** without the reveal-and-grade beat, Blind is just Classic-minus-information, not its own game (§5.1–5.2). **Risk if ignored:** half the mode roster has no payoff and no replay hook. **Risk if poor:** a grade that feels punitive rather than instructive makes Blind a coin flip you can't improve at.

---

### Bucket C — Replayability Improvements
*Give players a reason to start the next run, and the run after that.*

**C1. Add named challenges (timeline × identity × mode win-conditions).**
*Priority: H · Difficulty: M · Gameplay impact: H.*
**Why it matters:** challenges convert an open-ended toy into a game with *purpose* and near-infinite content from existing systems (§15.1). **Risk if ignored:** replay relies on intrinsic motivation alone; most players stop after a few runs. **Risk if poor:** poorly-tuned challenges (impossible or trivial) feel like busywork rather than goals.

**C2. Add meta-progression: a record book, collection, and milestones.**
*Priority: H · Difficulty: M · Gameplay impact: H.*
**Why it matters:** a persistent sense of accumulation across runs is the biggest long-term retention lever (§15.3). **Risk if ignored:** every run evaporates; there's no career, only disconnected sessions. **Risk if poor:** grind-y or pay-to-win-flavored progression would betray the game's clean, skill-based identity.

**C3. Give timelines/eras genuine character (tie to identity).**
*Priority: M · Difficulty: M · Gameplay impact: M.*
**Why it matters:** eras-with-character turn the timeline slider into distinct games-within-the-game (§15.4). **Risk if ignored:** the timeline stays a flavorless talent filter. **Risk if poor:** heavy-handed era modifiers that override player agency would feel scripted.

**C4. Promote team identity to a chosen, rewarded build directive.**
*Priority: M · Difficulty: H · Gameplay impact: H.*
**Why it matters:** identity is the game's largest untapped depth; chosen-and-rewarded identity gives the draft a thesis and the season a style (§7). **Risk if ignored:** every roster trends toward the same balanced blob; teams lack souls. **Risk if poor:** identities that are mechanically dominant (one always wins) collapse the strategy they were meant to create.

**C5. Surface seeds for shared/daily challenges and comparison.**
*Priority: M · Difficulty: E · Gameplay impact: M.*
**Why it matters:** shared seeds turn a solo toy into a comparable, lightly-competitive experience (§15.6) using infrastructure that already exists. **Risk if ignored:** a cheap, high-value social/replay hook goes unused. **Risk if poor:** leaderboards without anti-trivial-strategy tuning get solved and abandoned.

**C6. Add the Classic-vs-Blind self-comparison prompt.**
*Priority: L · Difficulty: E · Gameplay impact: M.*
**Why it matters:** inviting "informed vs instinct" replays of the same timeline is nearly free and leverages both modes (§5.5, §15.2). **Risk if ignored:** a natural replay axis goes unspoken. **Risk if poor:** minimal — at worst it's ignored.

---

### Bucket D — Advanced Gameplay Expansion
*Long-horizon depth. Explicitly NOT core, NOT MVP — these extend a finished game; they must never precede Buckets A–B.*

**D1. Thin durability/availability dimension so depth matters.**
*Priority: L · Difficulty: H · Gameplay impact: M.*
**Why it matters:** injuries/availability would make the (currently irrelevant) concept of depth a real roster-building lever (§3.4). **Risk if ignored:** none short-term — it's an enrichment, not a gap. **Risk if poor:** randomly losing your best player to a coin-flip injury feels punishing, not strategic; must be opt-in and skill-mitigable.

**D2. Selectable schemes/fronts that change slots and fit.**
*Priority: L · Difficulty: H · Gameplay impact: M.*
**Why it matters:** scheme choice (e.g. 3-4 vs nickel) deepens roster-building and identity without changing the game's soul (§3.6). **Risk if ignored:** none short-term. **Risk if poor:** scheme complexity that confuses the core 24-slot clarity would hurt accessibility.

**D3. Forward draft agency: limited re-spins / position targeting.**
*Priority: M · Difficulty: M · Gameplay impact: M.*
**Why it matters:** a sliver of control over the wheel lets experts *steer* luck, which raises the skill ceiling without removing surprise (§2.5). **Risk if ignored:** the draft stays fully reactive; expert agency is capped. **Risk if poor:** too much control removes the adaptive scramble that makes the wheel fun — keep it scarce.

**D4. Multi-season "dynasty / career" frame.**
*Priority: L · Difficulty: H · Gameplay impact: H.*
**Why it matters:** a career across seasons is the ultimate meta-progression and the natural long-term home for records, identity, and challenges. **Risk if ignored:** none short-term; it's a capstone. **Risk if poor:** bolting a dynasty onto an unbalanced core (Bucket A unfinished) would amplify every existing flaw across many seasons.

**D5. Asynchronous competition (shared-seed leaderboards, weekly meta).**
*Priority: L · Difficulty: H · Gameplay impact: M.*
**Why it matters:** social comparison is a proven, identity-preserving retention engine for single-player drafting games (§15.6). **Risk if ignored:** none short-term. **Risk if poor:** competition tends to surface and exploit any balance weakness — only viable after Bucket A and §16 are solid.

**D6. A "dynamic difficulty" / mastery ladder for expert players.**
*Priority: L · Difficulty: M · Gameplay impact: M.*
**Why it matters:** once a player routinely goes 17-0, the game needs somewhere harder to go (§15.7, §16.10). **Risk if ignored:** experts hit a flat ceiling and leave. **Risk if poor:** difficulty that scales by *raising variance* rather than *raising the bar* would punish skill instead of testing it.

---

## Closing principle

17-0 already has the hardest parts: a real probabilistic engine, a position-fit system with genuine realism, a playoff model with the right instincts, and a clean end-to-end loop. What it lacks is **honesty between its systems** (the rating must mean what the season honors), **a felt arc** (draft → season → playoffs → Super Bowl as escalating drama), **a voice** (feedback, identity, and storytelling that tell the player what they built and why they won or lost), and **a reason to return** (challenges, records, and the next run).

Fix the contradictions first (Bucket A). Complete the half-built season, bracket, and story (Bucket B). Then give players a reason to keep drafting (Bucket C), and only then extend the finished game (Bucket D).

Do that, and 17-0 becomes what its name promises: a serious, complete, strategic, replayable, realistic, and genuinely exciting NFL historical drafting game — one where chasing a perfect season *feels* like chasing history.
