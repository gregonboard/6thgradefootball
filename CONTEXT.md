# PROJECT CONTEXT: Sideline Command + The Rebel Safari
### Read this first. It contains everything needed to work on this project with full context.
Last updated: July 21, 2026 (post full-system confusion audit)

**Formation legality rules (now enforced by tests):** X is the split end, ALWAYS on the line; Z is the flanker, ALWAYS off it; every formation has exactly seven on the line (OL5 + X + Y) and eleven total. The Lt mirror flips which SIDE kids stand on but never their on/off-line identity (the old mirror wrongly swapped the X and Z labels). Nasty's X was a step off the line (an illegal 6-man front) and Stack's front man on the right is Y, not Z. All fixed July 21; tests/app.test.jsx asserts legality for all twelve formation names so geometry errors of this class cannot recur.

**Terminology ruling:** Doubles is NOT Twins. Doubles = 2x2 (two receivers each side, our base). Twins = both wideouts on the SAME side, which we do not run. Staff says Doubles, always. Other audit outcomes: sneak word Sub -> Moose (runs are animals, and "Sub" sounded like a substitution), Eagle Max -> Eagle (one word per kid; max protection is built into the concept), slip screen -> Rolo/Lifesaver. Vocabulary rule-integrity tests now enforce: every directional word pair starts R/L, every word is a single word. TRAP/WRAP rhyme is kept deliberately and taught as a mnemonic: WRAP is TRAP's big brother (one puller vs two). Rewind vs Reese's are phonetically close (REE-): reverses come off the board with the number, never voice alone.

---

## 1. WHO AND WHY

**Coach:** Greg Boggs, head coach of the VH Rebels, a 6th grade tackle football team in Vestavia Hills, Alabama. Most players are first-year players. Greg is technical (builds software, uses GitHub/Netlify/Supabase) and demands elite results with ruthless iteration.

**Roster profile (drives every scheme decision):**
- Really good offensive line: big tackles and a big center (natural down-blockers), quick guards (natural pullers)
- A good, smart QB who can handle a check at the line and one read per concept
- Four playmakers who all need touches: WRs, RB, and TE

**Goals, in Greg's words across the project:**
- The greatest 6th grade tempo offense that's ever existed; win games by 30
- Insanely fast no-huddle pace, but only if that's actually the winning strategy
- Super easy for inexperienced coaches and first-year players, but very intelligent underneath
- Fully versatile: motion, formation multiplicity, plays built on top of one another, many looks per season
- Everything built into his coaching app: build plays visually, teach them, call them, log them
- No creativity ceiling: he must be able to invent and draw new plays

---

## 2. THE OFFENSE: "THE REBEL SAFARI"

A gap-scheme, series-based, fast-tempo spread built specifically for this roster. The core philosophy: **the smartness lives in the structure, not in anyone's head.** Same few concepts, many costumes (the Lane Kiffin principle adapted for 11-year-olds).

### The Four Rules (the entire mental model)
1. **Bird = pass. Candy = screen. Everything else RUNS.** (Rewritten July 22 after Greg's audit found six run words that aren't animals: Rocket, Laser, Rustler (since renamed Raccoon), Renegade, Rewind, Loop. The birds and candy are small CLOSED sets that are 100% consistent, so kids classify by them; any other word defaults to run. Default-to-run is also the fail-safe: a kid who mishears blocks his man, which is the harmless mistake. A vocabulary test now enforces that no run word may ever be named a bird or a candy.)
2. **R goes right, L goes left.** The first letter of the play word is the direction.
3. **Your word is the only word.** Linemen listen for the FIRST word (their blocking scheme). Everyone else listens for the SECOND word. Nobody decodes the whole call.
4. **"Set... GO." Every snap, all season.** One cadence.

### Call structure (spoken order, used consistently in app and on field)
**Formation · LINE WORD · play word.** Example: "Trips Right... HAMMER... Rhino." Formation is omitted if Doubles (the default alignment kids sprint to).

### Line calls (the O-line's channel: 8 words = their whole season)
| Line word | Meaning | Used by |
|---|---|---|
| HAMMER | Power: playside down blocks, backside guard pulls and leads | Rhino/Lion, Owl (deliberately, to enforce the play-action disguise) |
| TRAP | Backside guard traps first man past center | Rabbit/Lynx |
| WRAP | Counter: backside guard kicks, backside tackle wraps | Renegade/Lizard (week 6) |
| REACH | Step playside and run | Rocket/Laser, Raccoon/Longhorn, Ram/Leopard, Rewind/Loop |
| SURGE | Fire out low, one-yard war | Sub (QB sneak) |
| QUICK | Set and punch, ball out under 2 seconds | Sparrow, Robin, Reese's/Laffy |
| WALL | True pass set, kick-slide and mirror | Hawk, Falcon, Eagle, Raven/Lark |
| GATE | Block one count, let rush through, release flat | Snickers (RB screen) |

Eight words compress to four techniques (down+pull family, reach, pass set, release). Installed max two per week.

### The dictionary (play words)
**Runs (ground animals, R/L pairs):**
- Rhino / Lion = Power (base play, RB behind the pulling guard)
- Rabbit / Lynx = Trap (quick hitter, the quick guards' showcase)
- Rocket / Laser = Jet sweep (H at full speed off motion). Exchange ruling history (do not relitigate without Greg): v1 was a backward flip (live-fumble risk), briefly a forward touch pass (drop = incomplete, but H must catch at full speed), FINAL July 22 ruling from Greg: "he shouldn't have to catch it." The QB owns a pressed handoff into H's basket; H's only job is speed. Broken mesh = QB keeps it on the Raccoon path, never chases H with the ball. Principle established: every exchange skill belongs to the QB (our smart asset), never to the kid at full speed; the reverse follows the same basket rule. From Doubles, Laser is a return motion; a seeded Doubles Lt · Laser gives the natural-cross alternative if the return rep is ugly.
- Raccoon / Longhorn = QB keep behind the jet fake. Naming history: Rodeo -> Rustler in the phonetic audit; Rustler -> Raccoon July 22 because Greg asked "how are these kids gonna know rustler is an animal": the raccoon is the masked bandit that steals the ball while everyone chases Rocket. Signal changed to "wash the paws" (the lasso signal died with Rustler; circles-over-eyes was already Owl's). Lasso -> Longhorn in year two because Laser/Lasso was a missed collision. Renegade stays non-animal deliberately: every candidate collided (Rattler vs Rabbit, Rottweiler vs Rocket) and the rewritten Rule 1 covers it.
- Renegade / Lizard = Counter (renamed from Rattler for the same reason)
- Ram / Leopard = Stretch (July 2026, assistant-coach audit): the reach answer when a coordinator keys our down blocks and attacks downhill. Line hears REACH (already knows it from Rocket); H's jet motion becomes the lead block; RB takes the wide give, one cut when he sees grass. Same audit added the hinge rule: on HAMMER the backside tackle steps down and walls the man over the pulled guard before hinging, so a DL keyed on the puller gets sealed.
- Sub = QB sneak

**Passes (birds; bigger bird = deeper ball):**
- Sparrow = hitches at 5 (QB: pick widest cushion pre-snap)
- Robin = slant-flat (QB: flat first, slant behind it)
- Hawk = curl-flat at 8 (QB: read the man over the slot)
- Owl = TE seam pop off a perfect Rhino fake (the most unfair play at this level; line hears HAMMER and blocks run)
- Falcon = four verticals (coach picks target pre-snap)
- Eagle Max = the deep shot, seven blocking
- Raven / Lark = sprint-out flood (July 22, built for the QB, who is Greg's son; make him very successful): QB moves the launch point with the RB as bodyguard, three levels stacked call-side (go clears, deep out at 10, flat at 4), and his legs are the third answer with a hard "get down or out of bounds" rule. The only directional bird pair; birds stay direction-less otherwise. Line hears WALL.

**Screens (candy):** Reese's / Laffy = bubble; Rolo / Lifesaver = RB slip screen (Snickers/Skittles was briefly used but both start with S, breaking the R/L rule; Rolo/Lifesaver restores it)
**Special:** Rewind / Loop = reverse off the full Rocket fake

**Receiver rule:** X always left outside, Z always right outside, H slot, Y tight end. Routes are keyed to letters, never formations, so every formation is free learning. Not a bird, not candy: block the man over you.

### Formations (12 selectable looks, kids learn nothing new per look)
Doubles (home base, 2x2 with Y attached), Doubles Lt, Trips Rt/Lt, Bunch Rt/Lt (3-man cluster, rub routes), Stack (stacked receivers, beats press), Nasty Rt/Lt (condensed splits, crack blocks), Empty, Tank Rt/Lt (heavy short yardage).

**Formation direction rule (Greg asked July 22):** the Rt/Lt in a formation name ALWAYS points at Y, the strength side. Doubles Lt = Y attached LEFT, which pushes the two-man open side (X on the line, H in the slot) to the RIGHT. Same rule everywhere: Trips Rt = Y plus two more right, Tank Rt = extra beef right. Teach coaches "the direction is where Y lives"; the kids never need it because jobs key off letters, not formations.

### Tags (composable modifiers; each new tag combination is a new picture)
- Jet = H motion across on any play
- Orbit = RB orbit loop behind the QB
- Zip = Z snaps down inside pre-snap
- Now = bubble attached (Rhino Now IS the RPO: QB reads the man over the slot; legal on Trap and Counter too)
- Peek (week 5+) = Owl alive behind any HAMMER run call; QB throws the Y seam only if the backers bite. The line never knows.
- Wheel = RB wheel route
- Max = H and RB stay in to protect

### The Series (touch distribution engine)
Every core snap shows the same picture (jet motion, RB downhill, Y attached). Off that one look: Rhino (RB), Rocket (H), Raccoon (QB), Reese's (WR), Owl (Y). When the defense takes one kid away, the structure hands the ball to the next. Touches distribute by design; a scripted 10-play opener guarantees every playmaker the ball early.

### Tempo doctrine (the gearbox, war-gamed)
- **TURBO** = same play again, snapped instantly. Never twice in a row (app enforces this).
- **MIRROR** = same play, other direction (every word has a twin). QB can also call it at the line after counting hats.
- **SWITCH** + any word = run its twin. Year-two doctrine: SWITCH lives on the board with a visual signal ONLY, never voice, never before week 5 (a kid who misses the word runs the mirror against ten teammates). It was removed from all kid-facing route cards.
- **Packages** (week 3+) = one word, three snaps at tempo, all off the same picture. Seeded: SAFARI (Rhino, Rocket, Owl), STAMPEDE (Rhino, Lion, Raccoon), and CHEETAH (Rocket, Reese's, Raccoon: everything looks like jet right and hits edge, bubble, then QB). Real Kiffin tempo is next-play-fast, not same-play-fast.
- **Kill checks** (week 4+) = paired plays on the band ("14 / K8"). Default is the first play; QB counts the box and yells KILL KILL to flip. Seeded pairs: Rhino/Lion AND Rocket/Laser kill to the same-side bubble.
- **FREEZE** = cadence trick, once a game.
- **Call security:** wristband numbers are the encrypted everyday channel, shown silently on a board (or the app's Board Mode), never yelled. One-word calls are reserved for Turbo, where tempo outruns decoding. The app can shuffle all play numbers in one click to re-encrypt mid-season.
- Up two scores in the 4th: stop tapping, milk the clock.

### Install schedule
Week 1: Doubles, Rhino/Lion, Sparrow, cadence + sprint-align-look procedure, QB learns Mirror. Week 2: Rocket/Laser, Raccoon/Longhorn, Owl. Week 3: Rabbit/Lynx, Robin, Hawk, bubbles, Turbo live. Week 4: Eagle Max, Snickers, Sub, Tank, the Rhino Now RPO. Week 5: Bunch/Stack/Nasty looks, Orbit. Week 6: Renegade/Lizard, Freeze.

---

## 3. THE APP: "SIDELINE COMMAND"

A single-page React app that runs the whole program: roster, depth, practice, playbook, game-day calling.

### Tech stack
- React 18 + Vite; entire app lives in `src/App.jsx` (single file by design, ~2,700 lines, CSS embedded in a template string)
- Deploys to Netlify via `netlify.toml` (zero-config: push to GitHub, import to Netlify)
- Storage adapter, in priority order: Claude artifact storage (window.storage) → Supabase → localStorage. Supabase is LIVE (project `lauljgjrwnqfaxattutj`, "6thGradFootball"; URL + anon key in index.html; `app_state` table from supabase-setup.sql): every coach reads/writes the shared cloud record. Auto-saves ~700ms debounced, localStorage written BEFORE the network call so a dead sideline connection can't lose data; a failed sync turns the masthead chip into a "tap to retry" button. Sync is last-write-wins and loads once per page load. The old JSON Backup/Restore buttons were removed (July 2026).
- Design system follows the VHCS Brand and Identity Guide (Oct 2023): PMS 288 blue #23356F (primary dark/ink), PMS 200 red #C32032, accent-only PMS 124 gold #EAAA00 and light blue #7DCBF1, Roboto Condensed display font, Roboto body. Brand contrast rules honored (no red text on blue, dark-on-light only). Print styles for every printable. Mobile: a dedicated max-width-640px CSS block (compact masthead, sticky swipeable tabs, tables scroll inside panels, wrapped form rows, 16px inputs against iOS focus-zoom, scaled wristband proof); all six tabs verified zero horizontal overflow at 390px.
- Tests need `tests/setup.js` (in-memory localStorage shim; Node 22+ ships an experimental localStorage global that shadows jsdom's under vitest).

### The WEEK dial (year-two simplification spine)
One select in the masthead (`seasonWeek`, 1-6 or All). Every tab defaults to only what the team has installed: the Play Lab table and Teach Mode hide later installs (with a show-later toggle), the Caller filter starts at the current week, Packages unlock at week 3, Kill checks and band kill numbers at week 4, the Peek tag at week 5. Coaches never see complexity before the team has earned it.

### Practice Groups (Roster tab)
One button splits the full roster into three coaching groups (QB/WR skill incl. DBs, Linemen incl. DL, LB/RB) from the depth chart, offense and defense combined. A two-way kid or a kid on two depth lines gets a default home (best slot: 1st team beats 2nd, offense breaks ties) plus tap-chips to move him; moves persist in `pgOverrides`. Unassigned kids surface with placement buttons. Printable one-pager.

### Formation View + Formation School (Roster tab)
The Formation View dropdown now includes every playbook formation (single source of truth: PLAY_FORM_NAMES / formSpots, same as the Play Lab, so the two can never drift). Selecting a formation overlays the depth chart onto it: play labels (X/H/Y/Z/QB/RB/OL) resolve to scheme positions via resolvePlayMap, a JOINT resolver: preference lists per label, resolved in order (Y before H before Z), and no depth-chart position used twice. Singleback: Y -> TE (tight, on the line) which frees Slot (Y) to travel as H; I-Form: H -> FB; Wing-T: H -> Wing, Z -> FB. Every scheme fills all eleven play spots. Travelers H and Y render gold. fvSpread() nudges crowded skill cards apart (OL and QB stay planted) so cards never overlap; base-scheme backfield rows were deepened so QB backup lists clear the RB chip. FORM_WEEKS staggers installs on the WEEK dial and is synced to each formation's FIRST SEEDED PLAY (wk1 Doubles+Trips for alignment races, wk4 Tank, wk5 Bunch/Stack/Nasty, wk6 Empty); a test enforces that no formation installs before its first play; later installs stay visible in a "Later installs" optgroup. Formation School is the teaching mode: flashes a giant formation name, kids sprint and align, coach taps to reveal the diagram with names, taps again for the next installed formation. Print Cards produces one mini-field card per installed formation with 1st-team names on the dots (print target "formations").

### Tabs and features
1. **Roster & Depth**: players (name/number only); depth chart is the source of truth: 1st/2nd/3rd team slot grids per position; a kid can hold slots at multiple positions per side (starting WR AND backup QB). Offense supports 4 formations (I-Form, Singleback, Spread, Wing-T) and defense 4 fronts (5-3, 5-2, 4-3, 4-4) with shared position names so assignments persist across scheme switches. Fullscreen Formation View for projecting at coaches meetings (spacebar flips sides). Warnings: missing starters, double-booked starters, duplicate jersey numbers.
2. **Practice Planner**: 100+ drill library curated for this scheme and age (libVersion 5 added ~20 elite youth drills: safe Hawk-tackling progression, double-team/pull mechanics for HAMMER and WRAP, series mesh work, QB sprint-out ladder, tempo and kill-check team periods). Most-used drills carry a `detail` field (SETUP / COACH / WIN) that prints on the one-pager to coach the coaches. Position filter is bucket-based: filtering OL shows every drill OL takes part in, including combined groups like Bigs + Backs (GROUP_POSITIONS/drillMatchesBucket). Multi-station periods, auto-timed schedule, saved plan library, printable one-pager with a WEEK-installs banner and station key. **Practice generator** ("Build Tonight's Practice"): one tap builds a week-aware practice (warmup, skills stations, install stations featuring WEEK_FOCUS drills, group period, team, situations wk3+, 10 Perfect Plays) at 60/75/90 minutes; deterministic, genSeed bumps per tap for a fresh rotation.
3. **Play Lab**: the Safari engine. Plays are generated from grammar (formation × concept × direction × tags) with auto-drawn SVG diagrams (blocks with caps, pulls, red carry paths, dashed motion, dotted throws, ball-carrier highlighted). Visual editor to customize any play or draw from a blank canvas (click a player, draw waypoints, move players). "Add This Look" clones a play into another formation. Flip-duplicate creates the Rt/Lt twin. Teach Mode: fullscreen presenter with per-position spotlight (others dim), kid-language job text, and a Quiz toggle. Prints: System Sheet (the offense on one page for new coaches), Signal Chart (with Line column), Play Cards book, Job Cards (per position, kid language). Shuffle #s re-encrypts all play numbers.
4. **Caller**: game-day operation. Opening script queue (load suggested 10 or build your own, tap through). Core plays as big one-word buttons; band plays grouped by family; install-week filter. TURBO (locked after consecutive use) and MIRROR buttons. Board Mode: tapping a play flashes its giant number fullscreen to hold up. Optional one-tap result grading. Self-scout: success rate per call word, touch counts per playmaker, and a Looks Report flagging formation tendencies (80%+ one way on 4+ calls = "TENDENCY · break it").
5. **Call Sheet**: situational play organizer, printable.
6. **Wristbands**: printable QB bands (reading order: number, formation, LINE word in red, play word) and Bird Route Cards (all birds × all letters so any kid can slide positions).

### Data model (top-level keys in the single persisted object, storage key `vh6-coach-data-v1`)
`players, depth {off, def}, offScheme, defScheme, drills, practice, savedPlans, plays [{id,num,name,formation,concept,dir,tags,core,week,custom,lineCall,type,note,killId}], callSheet, wrist, callLog, gameLabel, script, scriptPos, seasonWeek, pgOverrides, packages [{id,name,steps|ids}], day1Seeded, week2Seeded, libVersion (5), depthVersion (2), safariVersion (7)`

libVersion 4 adds the jet-series install drills (Motion Landmark Races, Jet Touch Pass Timing, Owl Fake & Pop, Reach & Run) and week2Seeded gates a one-time "Week 2 · Jet Series Install (Rocket, Raccoon, Owl)" saved practice plan.

safariVersion 4 (July 2026, "speed in space" audit): jet exchange became the forward touch pass; QB keep job text adds "score or get down"; perimeter blocks teach wall-offs, never kill shots (youth blindside rules); ten appended looks (#31-40): Tank Rt Owl (goal line), Doubles Lt Laser, Bunch bubbles both ways, Nasty jets both ways, Stack Robin, Trips-weak jets both ways, Empty Sparrow; jet-to-bubble kill pairs; CHEETAH package.

### Migration philosophy (important for future changes)
Never destroy user data. `normalizeData()` runs on every load: version flags gate one-time appends (drill library merges by name; Safari playbook appended after existing plays; v2 extras dedupe by name). Concept play names are DERIVED (recomputed from vocabulary on load), so renaming a call word propagates everywhere automatically. Legacy migrations handled: single-position roster → slot depth; SAFETY → FS; flat practice items → station periods.

---

## 4. KEY DECISIONS AND WHY (the reasoning another AI should not re-litigate casually)

1. **Gap scheme, not zone**: big tackles/center down-block, quick guards pull; down blocks are also easier for first-year linemen than zone rules. Zone was v1 and was rejected as wrong for this roster.
2. **Letter-keyed receiver jobs**: formations become free; this is what makes 12 looks cost nothing.
3. **The line call channel (HAMMER etc.)**: Greg's own suggestion; completes the "one channel per kid" philosophy and makes mishearing require two very different words to fail.
4. **Owl calls HAMMER**: the line cannot tip the pop pass because they are never told it's a pass.
5. **Numbers on a board, words for Turbo only**: the QB echo broadcasts any spoken word; wristband numbers are the encryption; tempo is the encryption for words.
6. **Raccoon (not Rodeo) and Renegade (not Rattler)**: phonetic-collision audit; Rhino/Rodeo and Rabbit/Rattler were mishearing hazards.
7. **Series football over play lists**: four playmakers eat from one picture; distribution is structural.
8. **Depth chart as source of truth (not player positions)**: enables a kid to be starting WR and backup QB.
9. **Live snap counter was built and REMOVED**: Greg won't have a coach doing per-snap data entry in games. One tap per play call (Caller) is his ceiling for in-game input; result grading is optional.
10. **Tempo verdict**: fast pace favors the better team (more possessions = less variance), but it's a three-speed gearbox (Turbo/Base/Milk), not a religion; 6th grade ref spotting speed is the true ceiling.

---

## 5. WORKING WITH GREG (conventions)

- Never use em dashes anywhere in responses to him.
- He pushes hard ("question yourself", "rethink it", "impress me"): respond with honest self-audits, real fixes, and shipped code, not defensiveness or flattery. When he's right (line calls, call order), say so and build it.
- Ship working, tested code: this project's convention is jsdom end-to-end tests simulating real clicks before every delivery, plus geometry/collision math checks for visual layouts. Silent no-op string replacements have caused bugs; assert every programmatic edit.
- Deliverables: updated `src/App.jsx` synced into the Vite project, built, zipped as `sideline-command-site.zip`, plus the standalone `sideline-command.jsx`. He deploys via GitHub → Netlify.
- Keep his existing data safe: every change must pass through `normalizeData()` migration patterns.

## 6. CURRENT STATE AND OPEN IDEAS

Everything above is built, tested (vitest + jsdom end-to-end suite in `tests/app.test.jsx`, `npm test`), and in this zip. Empty formation is locked to the QUICK family in the builder (no back home to protect). A Day 1 helmets plan (routes/throws by group, formations in team) is seeded into the Practice Planner and saved plans, and the drill library gained Formation Races and Team Walk-Through Install (libVersion 3). Ideas discussed but not built: seeding the Call Sheet from the answer chain; opponent scout reports attached to game plans; play diagram animation; connecting practice periods to install weeks automatically; the F3-style "Sugar" shift package for late season.

The system doc that preceded the final build lives in Greg's files as `rebel-safari-offense.md`; where it conflicts with this document, THIS document is current (it reflects the line calls, renames, formations, and doctrine that came later).
