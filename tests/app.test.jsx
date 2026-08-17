import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import App, {
  buildCallSheet,
  normalizeData, practiceGroupsFor, pgForPos, slotsFor, CONCEPTS, callWord,
  LINE_CALLS, ASSIGNMENTS, jobsFor, genPlayElements, generatePractice, drillMatchesBucket, genDef, DEF_FRONTS, DEF_COVERAGES, SEED, seedPackages, day1Plan, applyKillPairs,
  installedForms, resolvePlayPos, FORM_WEEKS, formSpots, store,
} from "../src/App.jsx";

/* ---------- unit: vocabulary and doctrine ---------- */
describe("vocabulary", () => {
  it("renames Lasso to Longhorn and Snickers Lt to Skittles", () => {
    expect(CONCEPTS.keep.words).toEqual({ Rt: "Raccoon", Lt: "Longhorn" }); // Rustler wasn't an animal
    expect(CONCEPTS.slip.words).toEqual({ Rt: "Rolo", Lt: "Lifesaver" });
    expect(callWord("keep", "Lt")).toBe("Longhorn");
  });
  it("enforces the R/L first-letter rule on every directional word", () => {
    /* This test would have caught the Snickers/Skittles mistake. */
    for (const [key, c] of Object.entries(CONCEPTS)) {
      if (c.dirs[0] !== "Rt") continue;
      expect(c.words.Rt[0], key + " Rt word must start with R").toBe("R");
      expect(c.words.Lt[0], key + " Lt word must start with L").toBe("L");
    }
  });
  it("keeps every play word to one word (wristbands and kid brains)", () => {
    for (const c of Object.values(CONCEPTS)) {
      for (const w of Object.values(c.words)) expect(w.includes(" ")).toBe(false);
    }
  });
  it("Rule 1 integrity: birds fly, candy tricks, everything else runs", () => {
    /* Greg's July 22 audit: Rocket, Laser, Rustler, Renegade, Rewind, and Loop
       are runs but not animals, so the kid rule is inverted to the fail-safe:
       the closed sets (birds, candy) are 100% consistent, and any word outside
       them means RUN, which is also what a kid who mishears should default to. */
    const BIRDS = new Set(["Sparrow", "Robin", "Hawk", "Owl", "Falcon", "Eagle", "Raven", "Lark"]);
    const CANDY = new Set(["Reese's", "Laffy", "Rolo", "Lifesaver"]);
    for (const [key, c] of Object.entries(CONCEPTS)) {
      if (key === "blank") continue;
      for (const w of Object.values(c.words)) {
        if (c.fam === "Pass") expect(BIRDS.has(w), `${w} is a Pass so it must be a bird`).toBe(true);
        else if (c.fam === "Screen") expect(CANDY.has(w), `${w} is a Screen so it must be candy`).toBe(true);
        else {
          expect(BIRDS.has(w), `${w} runs, so it must never be a bird`).toBe(false);
          expect(CANDY.has(w), `${w} runs, so it must never be candy`).toBe(false);
        }
      }
    }
  });
  it("builds the QB tree: sprint-out flood exists with a run answer", () => {
    expect(CONCEPTS.flood.words).toEqual({ Rt: "Raven", Lt: "Lark" });
    expect(LINE_CALLS.flood).toBe("WALL");
    expect(ASSIGNMENTS.flood.QB).toMatch(/then RUN/);
    expect(ASSIGNMENTS.flood.QB).toMatch(/down or out of bounds/i);
    expect(ASSIGNMENTS.flood.RB).toMatch(/bodyguard/i);
    const names = SEED.plays.map((p) => p.name);
    for (const want of ["Doubles · Raven", "Trips Rt · Raven", "Doubles · Hawk", "Empty · Robin", "Empty · Reese's", "Empty · Laffy"]) {
      expect(names, want + " is seeded").toContain(want);
    }
    expect(SEED.plays.length).toBe(71);
  });
  it("never installs a formation before its first play", () => {
    for (const f of Object.keys(FORM_WEEKS)) {
      const weeks = SEED.plays.filter((p) => p.formation === f).map((p) => p.week || 1);
      if (weeks.length === 0 || FORM_WEEKS[f] === 1) continue; /* week-1 alignment installs are deliberate */
      expect(FORM_WEEKS[f], f + " installs with its first play").toBeLessThanOrEqual(Math.min(...weeks));
    }
  });
  it("keeps the line-call channel intact", () => {
    expect(LINE_CALLS.owl).toBe("HAMMER");
    expect(LINE_CALLS.slip).toBe("GATE");
    expect(LINE_CALLS.stretch).toBe("STRETCH"); // renamed from REACH July 28 (coach: too close to the R play words)
  });
  it("answers the down-block key with a true reach play", () => {
    expect(CONCEPTS.stretch.words).toEqual({ Rt: "Ram", Lt: "Leopard" });
    expect(CONCEPTS.stretch.carrier).toBe("RB");
    const ram = SEED.plays.find((p) => p.name === "Doubles · Ram");
    expect(ram).toBeTruthy();
    expect(ram.week).toBe(3);
  });
  it("no play has a run-it-right-and-lose branch (stress-test rules)", () => {
    /* July 22 war game vs a disciplined defense: every play's worst case
       must resolve to positive yards, not a sack, string-out, or dead throw. */
    expect(CONCEPTS.sparrow.read).toMatch(/GO over the presser/i);       // press kills hitches
    expect(ASSIGNMENTS.sparrow.XZ).toMatch(/Pressed\? Nod and GO/i);
    expect(CONCEPTS.owl.read).toMatch(/Tuck it and run the Rhino path/i); // backers who don't bite
    expect(ASSIGNMENTS.stretch.RB).toMatch(/slam it NORTH/i);             // edge strung out
    expect(CONCEPTS.bubble.read).toMatch(/MIRROR/);                       // press over the screen
    // smoke, not bubble: the target never drifts wide (Greg: "pick six every time")
    {
      const els = genPlayElements("bubble", formSpots("Doubles"), "Rt");
      const smoke = els.Z.find((e) => e.kind === "route");
      expect(Math.abs(smoke.pts[1][0] - smoke.pts[0][0]), "catch point stays put").toBeLessThan(1);
      expect(smoke.pts[1][1]).toBeGreaterThan(smoke.pts[0][1]); // one step BACK
      expect(smoke.pts[2][1]).toBeLessThan(smoke.pts[0][1]);    // then NORTH
      expect(CONCEPTS.bubble.read).toMatch(/forward/i);          // forward throw: a drop is dead
    }
    expect(ASSIGNMENTS.jet.QB).toMatch(/Raccoon path/);                   // broken mesh
  });
  it("REACH plays draw reach blocks (playside lean), HAMMER draws down blocks", () => {
    const OL = ["LT", "LG", "C", "RG", "RT"];
    for (const [concept, dir, want] of [["jet", "Rt", +1], ["jet", "Lt", -1], ["keep", "Rt", +1], ["stretch", "Lt", -1], ["power", "Rt", -1]]) {
      const els = genPlayElements(concept, formSpots("Doubles"), dir);
      for (const L of OL) {
        const b = (els[L] || []).find((e) => e.kind === "block");
        if (!b) { expect(concept, `${concept}: only power may skip an OL block (the puller)`).toBe("power"); continue; }
        const d = (b.pts[1][0] - b.pts[0][0]) * want;
        expect(d, `${concept} ${dir}: ${L} leans the wrong way`).toBeGreaterThan(0);
      }
    }
  });
  it("seeds the diabolical layer: RPO, tag combos, chain notes, the dagger", () => {
    const names = SEED.plays.map((p) => p.name);
    for (const want of ["Doubles · Rhino Now", "Doubles · Lion Now", "Doubles · Lion Owl", "Doubles · Rocket Owl", "Doubles · Rainbow", "Doubles · Lightning"]) {
      expect(names, want + " is seeded").toContain(want);
    }
    // the Aug 17 cuts stay dead: Orbit drew two men in motion at the snap,
    // Zip condensed the already-condensed Nasty, Rhino Peek duplicated Owl
    for (const gone of ["Doubles · Rhino Peek", "Doubles · Rocket Orbit", "Doubles · Raccoon Orbit", "Nasty Rt · Rocket Zip"]) {
      expect(names, gone + " stays cut").not.toContain(gone);
    }
    expect(CONCEPTS.rbpass.words).toEqual({ Rt: "Rainbow", Lt: "Lightning" });
    expect(LINE_CALLS.rbpass).toBe("STRETCH"); // it must smell exactly like Ram
    expect(ASSIGNMENTS.rbpass.RB).toMatch(/Never force it/);
    expect(ASSIGNMENTS.rbpass.OL).toMatch(/Nobody drifts downfield/i);
    const rhino = SEED.plays.find((p) => p.name === "Doubles · Rhino");
    expect(rhino.note).toMatch(/CHAIN:/);
  });
  it("Owl draws real HAMMER blocking and owns its direction", () => {
    /* Greg's July 27 catch: the card showed generic blocks (no pull), and the
       line's "HAMMER plus R or L" rule had no answer for a word starting with O. */
    const els = genPlayElements("owl", formSpots("Doubles"), "");
    const pull = (els.LG || []).find((e) => e.kind === "route");
    expect(pull, "backside guard pulls, exactly like Rhino").toBeTruthy();
    expect(pull.pts[pull.pts.length - 1][0]).toBeGreaterThan(55); // pulls playside right
    const rtBlock = els.RT.find((e) => e.kind === "block");
    expect(rtBlock.pts[1][0]).toBeLessThan(rtBlock.pts[0][0]); // down block lean
    expect((els.Y || []).some((e) => e.kind === "carry")).toBe(true); // seam
    expect(ASSIGNMENTS.owl.OL).toMatch(/RIGHT, every time/);
    expect(CONCEPTS.owl.how).toMatch(/Lion Owl/); // the whole Owl family is documented
  });
  it("Rewind and Loop finally have band numbers", () => {
    const names = SEED.plays.map((p) => p.name);
    expect(names).toContain("Doubles · Rewind");
    expect(names).toContain("Doubles · Loop");
  });
  it("Fill It For Me builds a call sheet from installed plays, never clobbering picks", () => {
    const data = { ...SEED, seasonWeek: 9, callSheet: {} };
    const cs = buildCallSheet(data);
    for (const key of ["openers", "run", "pass", "third_short", "third_long", "redzone", "goalline", "special"]) {
      expect((cs[key] || []).length, key + " gets plays").toBeGreaterThan(0);
      for (const id of cs[key]) expect(SEED.plays.some((p) => p.id === id), "every id is a real play").toBe(true);
    }
    // coach's existing picks are kept (never removed or reordered), even as the
    // completeness sweep appends any unplaced installed plays behind them
    const mine = [SEED.plays.find((p) => p.type === "Run").id];
    const cs2 = buildCallSheet({ ...data, callSheet: { run: mine } });
    expect(cs2.run[0]).toBe(mine[0]);
    expect(cs2.run).toContain(mine[0]);
    // installed variety: week 3 must offer the Trips looks, not all-Doubles
    const wk3 = buildCallSheet({ ...SEED, seasonWeek: 3, callSheet: {} });
    const wk3names = [...wk3.run, ...wk3.pass].map((id) => SEED.plays.find((p) => p.id === id).name);
    expect(wk3names.some((n) => n.startsWith("Trips")), "Trips looks appear once installed").toBe(true);
    // completeness: every installed play lands somewhere so none get lost (Greg's Aug 9 catch)
    const wkAll = { ...SEED, seasonWeek: 9, callSheet: {} };
    const full = buildCallSheet(wkAll);
    const placedAll = new Set(Object.values(full).flat());
    const installedConcepts = wkAll.plays.filter((p) => p.concept && CONCEPTS[p.concept] && p.concept !== "blank");
    const lost = installedConcepts.filter((p) => !placedAll.has(p.id));
    expect(lost.map((p) => p.name), "no installed play is missing from the sheet").toEqual([]);
    // no situation is ever empty: early weeks fall back to safe installed plays
    const wk2all = buildCallSheet({ ...SEED, seasonWeek: 2, callSheet: {} });
    for (const key of Object.keys(wk2all)) expect(wk2all[key].length, key + ' non-empty at wk2').toBeGreaterThan(0);
    // week gating: at week 2 the goal-line box only offers installed plays
    const wk2 = buildCallSheet({ ...SEED, seasonWeek: 2, callSheet: {} });
    const wk2names = wk2.goalline.map((id) => SEED.plays.find((p) => p.id === id).name);
    expect(wk2names.every((n) => { const p = SEED.plays.find((x) => x.name === n); return !p.week || p.week <= 2; })).toBe(true);
  });
  it("Heavy H shuffle-kicks in Tank; Speed H still jets in Trips", () => {
    // Tank (Heavy): H shuffles a few steps then blocks (kicks the end), no jet across
    const tank = genPlayElements("power", formSpots("Tank Rt"), "Rt", [], "Tank Rt");
    expect(tank.H.some((e) => e.kind === "motion")).toBe(true);
    expect(tank.H.some((e) => e.kind === "block"), "Tank H kicks the end").toBe(true);
    expect(tank.H.some((e) => e.kind === "fake"), "Tank H does not run the jet fake").toBe(false);
    // Trips (Speed): H keeps the jet motion + fake to disguise the play
    const trips = genPlayElements("power", formSpots("Trips Rt"), "Rt", [], "Trips Rt");
    expect(trips.H.some((e) => e.kind === "motion")).toBe(true);
    expect(trips.H.some((e) => e.kind === "fake"), "Trips H sells the jet").toBe(true);
    // Tank shows the QB under center (Moose needs it)
    expect(formSpots("Tank Rt").QB[1]).toBeLessThan(27);
    // trap kicks out: playside guard/tackle/Y lean playside, backside guard pulls
    const trap = genPlayElements("trap", formSpots("Doubles"), "Rt", [], "Doubles");
    const rg = trap.RG.find((e) => e.kind === "block");
    expect(rg.pts[rg.pts.length - 1][0]).toBeGreaterThan(rg.pts[0][0]); // RG kicks OUT to the right
    expect(trap.LG.some((e) => e.kind === "route"), "backside guard pulls to trap").toBe(true);
  });
  it("I formation cards speak fullback, never jet motion (Greg's catch)", () => {
    for (const p of SEED.plays.filter((x) => /^I (Rt|Lt)$/.test(x.formation))) {
      const jobs = jobsFor(p);
      expect(jobs.H, p.name + ": H is the FB").not.toMatch(/jet motion/i);
      expect(jobs.H, p.name + ": H's job says FB or pile").toMatch(/FB|pile/i);
      expect(jobs.QB, p.name + ": QB knows he is under center").toMatch(/UNDER CENTER/);
      expect(jobs.RB, p.name + ": RB knows he is the deep back").toMatch(/tailback/i);
    }
  });
  it("I formation: legal, under center, FB leads instead of jet motion", () => {
    const spots = formSpots("I Rt");
    const onLine = Object.entries(spots).filter(([, [, y]]) => y === 23).map(([k]) => k).sort();
    expect(onLine).toEqual(["C", "LG", "LT", "RG", "RT", "X", "Y"]);
    expect(spots.QB[1]).toBeLessThan(27); // under center, not gun
    expect(spots.H[0]).toBe(50); // H is the fullback
    const els = genPlayElements("power", spots, "Rt");
    const h = els.H.find((e) => e.kind === "block");
    expect(h, "FB lead blocks on I power").toBeTruthy();
    expect(h.pts[h.pts.length - 1][0]).toBeGreaterThan(55); // leads playside
    expect(els.H.some((e) => e.kind === "motion")).toBe(false); // no jet from the I
    const names = SEED.plays.map((p) => p.name);
    for (const want of ["I Rt · Rhino", "I Lt · Lion", "I Rt · Moose"]) expect(names, want).toContain(want);
  });
  it("Hawk carries last year's TE wheel inside the base play", () => {
    expect(ASSIGNMENTS.hawk.Y).toMatch(/WHEEL/);
    expect(CONCEPTS.hawk.how).toMatch(/wheel/i);
    // Greg's July 28 design: H sells the bubble away, then crosses BEHIND Y
    expect(ASSIGNMENTS.hawk.H).toMatch(/bubble ONE hard step/i);
    for (const form of ["Doubles", "Doubles Lt", "Trips Rt", "Trips Lt"]) {
      const els = genPlayElements("hawk", formSpots(form), "");
      const cross = els.H.find((e) => e.kind === "route");
      const [hx] = cross.pts[0];
      const sellDir = Math.sign(cross.pts[1][0] - hx);
      expect(sellDir, form + ": sell step goes toward H's own sideline").toBe(hx <= 50 ? -1 : 1);
      // after the sell, the path never boomerangs (Greg's Trips Lt catch)
      const d1 = Math.sign(cross.pts[2][0] - cross.pts[1][0]);
      const d2 = Math.sign(cross.pts[3][0] - cross.pts[2][0]);
      expect(d1 === d2 || d2 === 0, form + ": no direction reversal after the sell").toBe(true);
      // and he settles on Y's side of center
      const spots = formSpots(form);
      const ySide = spots.Y[0] > 50 ? 1 : -1;
      expect(Math.sign(cross.pts[3][0] - 50), form + ": settles in the wheel-side hook").toBe(ySide);
    }
    // Robin's RB settles the middle instead of crowding H's arrow
    expect(ASSIGNMENTS.robin.RB).toMatch(/MIDDLE/);
    const elsR = genPlayElements("robin", formSpots("Doubles"), "");
    const sit = elsR.RB.find((e) => e.kind === "route");
    expect(sit.pts[sit.pts.length - 1][0]).toBe(50);
    // the wheel bends to the SIDELINE, never the middle (Greg's July 27 catch)
    const els = genPlayElements("hawk", formSpots("Doubles"), "");
    const wheel = els.Y.find((e) => e.kind === "route");
    const [x0] = wheel.pts[0];
    const [xEnd] = wheel.pts[wheel.pts.length - 1];
    expect(Math.abs(xEnd - 50)).toBeGreaterThan(Math.abs(x0 - 50)); // moves toward the boundary
    const elsLt = genPlayElements("hawk", formSpots("Doubles Lt"), "");
    const wheelLt = elsLt.Y.find((e) => e.kind === "route");
    expect(wheelLt.pts[wheelLt.pts.length - 1][0]).toBeLessThan(wheelLt.pts[0][0]); // left sideline in the mirror
    // and the redundant tagged play is gone from seed and from migrated data
    expect(SEED.plays.some((p) => p.name === "Doubles · Hawk Wheel")).toBe(false);
    const migrated = normalizeData({ players: [], safariVersion: 8, plays: [...SEED.plays.map((p) => ({ ...p })), { id: "hw", num: 99, name: "Doubles · Hawk Wheel", formation: "Doubles", concept: "hawk", dir: "", tags: ["Wheel"], week: 5 }] });
    expect(migrated.plays.some((p) => p.name === "Doubles · Hawk Wheel")).toBe(false);
  });
  it("hinge rule: backside tackle walls the pulled guard's man on power", () => {
    // the assistant-coach fix: a DL keying the pulling guard gets walled by the tackle
    expect(ASSIGNMENTS.power.OL).toMatch(/walls the man over the pulled guard/i);
    expect(ASSIGNMENTS.stretch.H).toMatch(/lead/i); // jet motion becomes the lead block
    expect(ASSIGNMENTS.stretch.OL).toMatch(/stretch/i);
  });
});

/* ---------- unit: seeds ---------- */
describe("seeds", () => {
  it("seeds WHITE, STAMPEDE, and CHEETAH packages", () => {
    const pk = seedPackages();
    expect(pk.map((p) => p.name)).toEqual(["WHITE", "STAMPEDE", "CHEETAH"]);
    expect(pk.every((p) => p.steps.length === 3)).toBe(true);
  });
  it("jet exchange: QB owns the basket, H never has to catch", () => {
    expect(CONCEPTS.jet.how).toMatch(/basket/i);
    expect(ASSIGNMENTS.jet.QB).toMatch(/you own the ball/i);
    expect(ASSIGNMENTS.jet.QB).toMatch(/Raccoon path/); // broken mesh has an answer
    expect(ASSIGNMENTS.jet.H).not.toMatch(/catch/i);
    expect(CONCEPTS.jet.fam).toBe("Run");
  });
  it("seeds the v6 costume looks", () => {
    const names = SEED.plays.map((p) => p.name);
    for (const want of ["Bunch Rt · Rocket", "Nasty Rt · Ram", "Tank Rt · Ram", "Trips Rt · Rhino", "Tank Lt · Leopard"]) {
      expect(names, want + " is seeded").toContain(want);
    }
    expect(SEED.plays.length).toBe(71); // the Aug 17 cuts (6) + the v13 weaponized layer (5)
  });
  it("renames the jet drill in place so saved plans keep their links", () => {
    const old = { players: [], drills: [{ id: "d-keep", name: "Jet Touch Pass Timing", cat: "Group", group: "Skill (QB/RB/WR/TE)", mins: 12, notes: "old" }], libVersion: 4, safariVersion: 6, day1Seeded: true, week2Seeded: true, savedPlans: [], plays: SEED.plays.map((p) => ({ ...p })) };
    const d = normalizeData(old);
    const renamed = d.drills.find((x) => x.id === "d-keep");
    expect(renamed.name).toBe("Jet Mesh & Basket");
    expect(renamed.notes).toMatch(/QB owns the ball/i);
    expect(d.drills.filter((x) => x.name === "Jet Mesh & Basket").length).toBe(1);
  });
  it("seeds the v4 speed looks with the goal-line Owl", () => {
    const names = SEED.plays.map((p) => p.name);
    for (const want of ["Tank Rt · Owl", "Doubles Lt · Laser", "Bunch Rt · Reese's", "Nasty Rt · Rocket", "Stack · Robin", "Trips Rt · Laser", "Empty · Sparrow"]) {
      expect(names, want + " is seeded").toContain(want);
    }
  });
  it("pairs the jets with their bubbles as kills", () => {
    const rocket = SEED.plays.find((p) => p.concept === "jet" && p.dir === "Rt");
    const reeses = SEED.plays.find((p) => p.concept === "bubble" && p.dir === "Rt");
    expect(rocket.killId).toBe(reeses.id);
  });
  it("seeds the Week 2 jet-series install plan with the mesh drill", () => {
    const w2 = SEED.savedPlans.find((s) => /week 2/i.test(s.name));
    expect(w2).toBeTruthy();
    const byId = Object.fromEntries(SEED.drills.map((d) => [d.id, d.name]));
    const names = w2.plan.items.flatMap((it) => it.stations.map((s) => byId[s.drillId]));
    for (const want of ["Jet Mesh & Basket", "Motion Landmark Races", "Owl Fake & Pop", "Stretch & Run (STRETCH steps)"]) {
      expect(names, want + " is in the plan").toContain(want);
    }
  });
  it("adds the jet drills and Week 2 plan to an existing program once", () => {
    const old = {
      players: [],
      drills: SEED.drills.filter((d) => !/Jet Mesh|Motion Landmark|Owl Fake|Stretch & Run/.test(d.name)).map((d) => ({ ...d })),
      libVersion: 3, safariVersion: 4, day1Seeded: true, savedPlans: [],
      plays: SEED.plays.map((p) => ({ ...p })),
    };
    const d = normalizeData(old);
    expect(d.drills.some((x) => x.name === "Jet Mesh & Basket")).toBe(true);
    expect(d.savedPlans.filter((s) => /week 2/i.test(s.name)).length).toBe(1);
    const again = normalizeData(JSON.parse(JSON.stringify(d)));
    expect(again.savedPlans.filter((s) => /week 2/i.test(s.name)).length).toBe(1);
    expect(again.drills.length).toBe(d.drills.length);
  });
  it("migrates a v3 program to v4 once, without duplicates", () => {
    const v3 = normalizeData({ players: [], plays: SEED.plays.filter((p) => p.num <= 30).map((p) => ({ ...p, killId: null })), safariVersion: 3, packages: seedPackages().slice(0, 2) });
    const names = v3.plays.map((p) => p.name);
    expect(names).toContain("Tank Rt · Owl");
    expect(names.filter((n) => n === "Tank Rt · Owl").length).toBe(1);
    expect(v3.plays.length).toBe(71); // everything a fresh install gets, no dupes
    expect(v3.safariVersion).toBe(14);
    expect(v3.packages.map((p) => p.name)).toContain("CHEETAH");
    const rocket = v3.plays.find((p) => p.name === "Doubles · Rocket");
    const reeses = v3.plays.find((p) => p.name === "Doubles · Reese's");
    expect(rocket.killId).toBe(reeses.id);
    // running it again must change nothing (Greg's live data reloads every session)
    const again = normalizeData(JSON.parse(JSON.stringify(v3)));
    expect(again.plays.length).toBe(71);
    expect(again.packages.length).toBe(v3.packages.length);
  });
  it("v13: cuts the Orbit/Zip/Rhino-Peek plays, seeds the weaponized layer, fixes stale notes", () => {
    // a v12 program still carrying the cut plays and the old note text
    // live v12 data carries derived names (normalizeData re-derives and stores them on every load)
    const cutPlay = (num, formation, concept, dir, tags) => ({ id: "cut" + num, num, formation, concept, dir, tags, week: 5, name: `${formation} · ${callWord(concept, dir, tags)}`, type: "Run", note: "" });
    const old = {
      players: [], safariVersion: 12, day1Seeded: true, week2Seeded: true, savedPlans: [],
      plays: [
        ...SEED.plays.filter((p) => !/(Lion Owl|Rocket Owl|Laser Owl|Nasty Rt · Raccoon|Nasty Lt · Longhorn)/.test(p.name)).map((p) => ({ ...p })),
        cutPlay(30, "Doubles", "keep", "Rt", ["Orbit"]),
        cutPlay(61, "Doubles", "power", "Rt", ["Peek"]),
        cutPlay(62, "Doubles", "jet", "Rt", ["Orbit"]),
        cutPlay(63, "Doubles", "jet", "Lt", ["Orbit"]),
        cutPlay(64, "Nasty Rt", "jet", "Rt", ["Zip"]),
        cutPlay(65, "Nasty Lt", "jet", "Lt", ["Zip"]),
      ],
    };
    // give the RPO and reverse plays their pre-v13 notes
    for (const p of old.plays) {
      if (p.name === "Doubles · Rhino Now") p.note = "THE RPO. QB reads the man over the slot: he squeezes for Rhino, throw the bubble; he widens, hand Rhino. The defense is wrong before the snap.";
      if (p.name === "Doubles · Loop") p.note = "The reverse, left.";
    }
    const d = normalizeData(old);
    const names = d.plays.map((p) => p.name);
    for (const gone of ["Doubles · Raccoon Orbit", "Doubles · Rhino Peek", "Doubles · Rocket Orbit", "Doubles · Laser Orbit", "Nasty Rt · Rocket Zip", "Nasty Lt · Laser Zip"]) {
      expect(names, gone + " is cut").not.toContain(gone);
    }
    for (const added of ["Doubles · Lion Owl", "Doubles · Rocket Owl", "Doubles · Laser Owl", "Nasty Rt · Raccoon", "Nasty Lt · Longhorn"]) {
      expect(names.filter((n) => n === added).length, added + " seeded once").toBe(1);
    }
    expect(d.plays.find((p) => p.name === "Doubles · Rhino Now").note).toMatch(/smoke to X/);
    expect(d.plays.find((p) => p.name === "Doubles · Loop").note).toMatch(/fakes the jet RIGHT/);
    // a coach-edited note is left alone
    expect(d.plays.find((p) => p.name === "Doubles · Lion Now")).toBeTruthy();
    // idempotent: running it again changes nothing
    const again = normalizeData(JSON.parse(JSON.stringify(d)));
    expect(again.plays.length).toBe(d.plays.length);
    expect(again.plays.map((p) => p.name)).toEqual(d.plays.map((p) => p.name));
  });
  it("weaponized layer: the Owl family draws real play action, always thrown", () => {
    // Rocket Owl: jet motion live but the give is a FAKE, Y carries the seam, QB throw drawn
    const rp = genPlayElements("jet", formSpots("Doubles"), "Rt", ["Owl"], "Doubles");
    expect(rp.H.some((e) => e.kind === "motion")).toBe(true);
    expect(rp.H.some((e) => e.kind === "carry")).toBe(false); // the mesh is theater
    expect(rp.Y.some((e) => e.kind === "carry")).toBe(true); // Y is the play
    expect(rp.QB.some((e) => e.kind === "throw")).toBe(true);
    // Lion Owl: the left Owl, RB runs angry without the ball
    const lp = genPlayElements("power", formSpots("Doubles"), "Lt", ["Owl"], "Doubles");
    expect(lp.RB.some((e) => e.kind === "carry")).toBe(false);
    expect(lp.Y.some((e) => e.kind === "carry")).toBe(true);
    expect(lp.QB.some((e) => e.kind === "throw")).toBe(true);
    // Nasty Raccoon: QB carries, jet fake live from the condensed set
    const nr = genPlayElements("keep", formSpots("Nasty Rt"), "Rt", [], "Nasty Rt");
    expect(nr.QB.some((e) => e.kind === "carry")).toBe(true);
    expect(nr.H.some((e) => e.kind === "motion")).toBe(true);
  });
  it("v14: Peek becomes Owl in place, real play action, type flips to Pass", () => {
    // a v13 program: Peek tags, Run type, the v13 note text
    const old = {
      players: [], safariVersion: 13, day1Seeded: true, week2Seeded: true, savedPlans: [],
      plays: SEED.plays.map((p) => ((p.tags || []).includes("Owl")
        ? { ...p, tags: ["Peek"], type: "Run", name: `${p.formation} · ${callWord(p.concept, p.dir, ["Peek"])}` }
        : { ...p })),
    };
    const laser = old.plays.find((p) => p.name === "Doubles · Laser Peek");
    laser.note = "Laser Peek: the seam off left jet action. Same rule: chase the jet and Y is behind you.";
    const d = normalizeData(old);
    const names = d.plays.map((p) => p.name);
    expect(names).not.toContain("Doubles · Laser Peek");
    for (const want of ["Doubles · Lion Owl", "Doubles · Rocket Owl", "Doubles · Laser Owl"]) {
      const p = d.plays.find((x) => x.name === want);
      expect(p, want).toBeTruthy();
      expect(p.tags).toEqual(["Owl"]);
      expect(p.type, want + " reads as a pass").toBe("Pass");
    }
    expect(d.plays.find((p) => p.name === "Doubles · Laser Owl").note).toMatch(/always thrown/);
    const again = normalizeData(JSON.parse(JSON.stringify(d)));
    expect(again.plays.map((p) => p.name)).toEqual(names);
  });
  it("defense: both fronts field 11; coverages, stunts, blitzes draw on the field", () => {
    for (const front of Object.keys(DEF_FRONTS)) {
      for (const cov of Object.keys(DEF_COVERAGES)) {
        for (const stunt of ["none", "pinch", "slant", "twist"]) {
          for (const blitz of ["none", "thunder", "storm", "cannon"]) {
            const d = genDef(front, cov, stunt, blitz);
            expect(d.def.length, front + " fields 11").toBe(11);
            for (const p of [...d.def.map((x) => [x.x, x.y]), ...d.arrows.flatMap((a) => [a.from, a.to])]) {
              expect(p[0] >= 0 && p[0] <= 100 && p[1] >= 0 && p[1] <= 44, `${front}/${cov}/${stunt}/${blitz} on field`).toBe(true);
            }
          }
        }
      }
    }
    expect(genDef("4-4", "sky", "none", "none").arrows.some((a) => a.kind === "deep")).toBe(true);
    expect(genDef("4-4", "sky", "pinch", "none").arrows.some((a) => a.kind === "stunt")).toBe(true);
    expect(genDef("4-4", "sky", "none", "storm").arrows.filter((a) => a.kind === "blitz").length).toBe(2);
    // a blitzer is pulled out of coverage: Thunder's edge backer has no drop
    const thunder = genDef("4-4", "sky", "none", "thunder");
    expect(thunder.arrows.filter((a) => a.kind === "blitz").length).toBe(1);
    // Cover 2 has two deep defenders in the 4-3
    expect(genDef("4-3", "cloud", "none", "none").arrows.filter((a) => a.kind === "deep").length).toBe(2);
    // new package + blitzes field 11 and draw
    expect(genDef("GOAL LINE", "sky", "none", "none").def.length).toBe(11);
    expect(genDef("4-4", "sky", "none", "vice").arrows.filter((a) => a.kind === "blitz").length).toBe(2);
    expect(genDef("4-3", "sky", "none", "comet").arrows.some((a) => a.kind === "blitz")).toBe(true);
    // comet always leaves someone in the deep middle (honest rotation)
    for (const front of ["4-4", "4-3"]) {
      const g = genDef(front, "sky", "none", "comet");
      expect(g.arrows.some((a) => a.kind === "deep" && a.to[0] > 44 && a.to[0] < 60 && a.to[1] < 6), front + " comet keeps deep middle").toBe(true);
    }
  });
  it("seeds the elite drill library with coaching detail", () => {
    const names = SEED.drills.map((d) => d.name);
    for (const want of ["Hawk Tackle Progression", "Double-Team Drive", "Pull & Kick (guards)", "Mesh Triple Rep", "Sprint-Out Ladder (QB)", "Ball Security Gauntlet", "Kill Check Rehearsal", "Fastball Period (TURBO)"]) {
      expect(names, want + " is in the library").toContain(want);
    }
    const withDetail = SEED.drills.filter((d) => d.detail && /SETUP:/.test(d.detail));
    expect(withDetail.length).toBeGreaterThanOrEqual(40);
    const inside = SEED.drills.find((d) => d.name === "Inside Run (O vs D)");
    expect(inside.detail).toMatch(/WIN:/);
  });
  it("group filter shows every drill a position takes part in", () => {
    expect(drillMatchesBucket("Bigs + Backs", ["OL"])).toBe(true);
    expect(drillMatchesBucket("Bigs + Backs", ["DB"])).toBe(false);
    expect(drillMatchesBucket("WR vs DB", ["DB"])).toBe(true);
    expect(drillMatchesBucket("Skill (QB/RB/WR/TE)", ["QB"])).toBe(true);
    expect(drillMatchesBucket("OL", ["WR", "TE"])).toBe(false);
    expect(drillMatchesBucket("All", ["DL"])).toBe(true);
    expect(drillMatchesBucket("My Custom Group", ["QB"])).toBe(true); // unknown groups never hide
  });
  it("generates a complete week-aware practice in one tap", () => {
    for (const wk of [1, 2, 4]) {
      const plan = generatePractice({ ...SEED, seasonWeek: wk }, 75);
      expect(plan.items.length).toBeGreaterThanOrEqual(5);
      const total = plan.items.reduce((s, p) => s + p.mins, 0);
      expect(Math.abs(total - 75)).toBeLessThanOrEqual(6);
      const byId = Object.fromEntries(SEED.drills.map((d) => [d.id, d]));
      const names = plan.items.flatMap((it) => it.stations.map((s) => byId[s.drillId].name));
      expect(names[0]).toBe("Dynamic Warmup & Stretch");
      expect(names[names.length - 1]).toBe("10 Perfect Plays");
      expect(names.some((n) => /Sharks & Minnows|Fumble Scramble|Everybody's Eligible|Chase the Rabbit|TD Celebration|Tug of War/.test(n)), "a fun finisher is in every practice").toBe(true);
      if (wk === 2) expect(names.some((n) => /Jet Mesh|Motion Landmark|Owl Fake/.test(n)), "wk2 features the jet install").toBe(true);
      if (wk === 4) expect(names.some((n) => /Sprint-Out|Kill Check|Screen/.test(n)), "wk4 features the QB tree").toBe(true);
      // multi-station periods keep all three coaching groups busy
      const multi = plan.items.filter((it) => it.stations.length >= 3);
      expect(multi.length).toBeGreaterThanOrEqual(2);
    }
    // tapping again rotates the mix
    const a = generatePractice({ ...SEED, seasonWeek: 3, practice: { ...SEED.practice, genSeed: 0 } }, 75);
    const b = generatePractice({ ...SEED, seasonWeek: 3, practice: { ...SEED.practice, genSeed: 1 } }, 75);
    expect(JSON.stringify(a.items.map((i) => i.stations.map((s) => s.drillId)))).not.toBe(JSON.stringify(b.items.map((i) => i.stations.map((s) => s.drillId))));
  });
  it("seeds the Day 1 helmets plan with grouped stations", () => {
    const plan = day1Plan(SEED.drills);
    expect(plan.items.length).toBe(8);
    const routesPeriod = plan.items[2];
    expect(routesPeriod.stations.length).toBe(3); // QB/WR, OL, LB/RB in parallel
    expect(SEED.savedPlans.some((s) => /day 1/i.test(s.name))).toBe(true);
    expect(SEED.practice.items.length).toBe(8); // preloaded for tonight
  });
  it("pairs Rhino with the bubble as its kill on the seed", () => {
    const rhino = SEED.plays.find((p) => p.concept === "power" && p.dir === "Rt");
    const bubble = SEED.plays.find((p) => p.concept === "bubble" && p.dir === "Rt");
    expect(rhino.killId).toBe(bubble.id);
  });
});

/* ---------- unit: migration never destroys, always upgrades ---------- */
describe("normalizeData migration", () => {
  it("upgrades an old save: kills paired, packages seeded, names re-derived, plan appended", () => {
    const old = JSON.parse(JSON.stringify({
      players: [{ id: "p1", name: "Old Kid", num: "9" }],
      plays: SEED.plays.map((p) => ({ ...p, killId: undefined, name: p.name.replace("Longhorn", "Lasso") })),
      drills: [],
      safariVersion: 2,
      libVersion: 2,
      practice: { date: "", start: "17:30", title: "Practice Plan", items: [] },
    }));
    const d = normalizeData(old);
    expect(d.seasonWeek).toBe(1);
    expect(d.packages.map((p) => p.name)).toContain("WHITE");
    const rhino = d.plays.find((p) => p.concept === "power" && p.dir === "Rt");
    const bubble = d.plays.find((p) => p.concept === "bubble" && p.dir === "Rt");
    expect(rhino.killId).toBe(bubble.id);
    const keepLt = d.plays.find((p) => p.concept === "keep" && p.dir === "Lt");
    expect(keepLt.name).toContain("Longhorn"); // derived names propagate the rename
    expect(d.savedPlans.some((s) => /day 1/i.test(s.name))).toBe(true);
    expect(d.players[0].name).toBe("Old Kid"); // user data untouched
    expect(d.safariVersion).toBe(14);
  });
  it("does not double-seed on a second load", () => {
    const once = normalizeData({ safariVersion: 2, plays: SEED.plays.map((p) => ({ ...p })) });
    const twice = normalizeData(JSON.parse(JSON.stringify(once)));
    expect(twice.savedPlans.filter((s) => /day 1/i.test(s.name)).length).toBe(1);
    expect(twice.packages.length).toBe(once.packages.length);
    expect(twice.plays.length).toBe(once.plays.length);
  });
});

/* ---------- unit: practice groups ---------- */
describe("practiceGroupsFor", () => {
  const mk = () => ({
    players: [
      { id: "a", name: "Two Way Tank", num: "55" },
      { id: "b", name: "Quarterback", num: "7" },
      { id: "c", name: "Runner", num: "22" },
      { id: "d", name: "New Kid", num: "3" },
    ],
    depth: {
      off: { Speed: { "LT": ["a", null, null], "QB": ["b", null, null], "RB": ["c", null, null] } },
      def: { "5-3": { "MIKE LB": ["a", null, null], "WILL LB": [null, "c", null] } },
    },
    offScheme: "Speed",
    defScheme: "5-3",
    pgOverrides: {},
  });
  it("maps positions to the three groups", () => {
    expect(pgForPos("LT")).toBe("line");
    expect(pgForPos("DE (R)")).toBe("line");
    expect(pgForPos("MIKE LB")).toBe("backs");
    expect(pgForPos("RB")).toBe("backs");
    expect(pgForPos("QB")).toBe("skill");
    expect(pgForPos("CB (L)")).toBe("skill");
  });
  it("homes a two-way kid with his best slot and flags him as multi", () => {
    const { out, multi, unassigned } = practiceGroupsFor(mk());
    expect(out.line.map((e) => e.p.id)).toEqual(["a"]); // 1st team LT beats 1st team MIKE (offense wins the tie)
    expect(out.skill.map((e) => e.p.id)).toEqual(["b"]);
    expect(out.backs.map((e) => e.p.id)).toEqual(["c"]); // RB + WILL LB both map to backs, one group
    expect(multi.map((e) => e.p.id)).toEqual(["a"]);
    expect(unassigned.map((p) => p.id)).toEqual(["d"]);
  });
  it("respects overrides for two-way and unassigned kids", () => {
    const d = mk();
    d.pgOverrides = { a: "backs", d: "line" };
    const { out, unassigned } = practiceGroupsFor(d);
    expect(out.backs.map((e) => e.p.id)).toContain("a");
    expect(out.line.map((e) => e.p.id)).toContain("d");
    expect(unassigned.length).toBe(0);
  });
});

/* ---------- unit: formation install + depth resolution ---------- */
describe("per-front depth", () => {
  it("migration copies the old shared chart into every front", () => {
    const d = normalizeData({ players: [{ id: "x", name: "Luke", num: "32" }], depth: { off: {}, def: { "SAM LB": ["x", null, null] } }, depthVersion: 2 });
    expect(slotsFor({ ...d, defScheme: "4-4" }, "def", "SAM LB")[0].id).toBe("x");
    expect(slotsFor({ ...d, defScheme: "4-3" }, "def", "SAM LB")[0].id).toBe("x");
  });
  it("each front keeps its own lineup (Sam in the 4-4, safety in the 4-3)", () => {
    const d = normalizeData({
      players: [{ id: "x", name: "Luke" }, { id: "y", name: "Other" }],
      depth: { off: {}, def: { "4-4": { "SAM LB": ["x", null, null] }, "4-3": { "SS": ["x", null, null], "SAM LB": ["y", null, null] } } },
      depthVersion: 3,
    });
    expect(slotsFor({ ...d, defScheme: "4-4" }, "def", "SAM LB")[0].id).toBe("x");
    expect(slotsFor({ ...d, defScheme: "4-3" }, "def", "SS")[0].id).toBe("x");
    expect(slotsFor({ ...d, defScheme: "4-3" }, "def", "SAM LB")[0].id).toBe("y");
  });
  it("offense has two groups; Heavy can differ from Speed", () => {
    const d = normalizeData({
      players: [{ id: "s", name: "Speedy" }, { id: "b", name: "Big" }],
      depth: { off: { "Speed": { "RB": ["s", null, null] }, "Heavy": { "RB": ["b", null, null] } }, def: {} },
      depthVersion: 3,
    });
    expect(slotsFor({ ...d, offScheme: "Speed" }, "off", "RB")[0].id).toBe("s");
    expect(slotsFor({ ...d, offScheme: "Heavy" }, "off", "RB")[0].id).toBe("b");
  });
});

describe("formations", () => {
  it("staggers formation installs on the week dial", () => {
    expect(installedForms(1)).toEqual(["Doubles", "Doubles Lt", "Trips Rt", "Trips Lt"]);
    expect(installedForms(6).length).toBe(14); // 12 + the I Rt/Lt rain package
    expect(FORM_WEEKS["Empty"]).toBe(6);
  });
  it("mirrors Lt formations: kids flip sides, identities never change", () => {
    const rt = formSpots("Trips Rt"), lt = formSpots("Trips Lt");
    expect(lt.X[0]).toBe(100 - rt.X[0]); /* X crosses the field... */
    expect(lt.X[1]).toBe(rt.X[1]);       /* ...but stays on the line */
    expect(lt.Z[1]).toBe(rt.Z[1]);       /* Z stays off it */
    expect(Object.keys(lt).sort()).toEqual(Object.keys(rt).sort());
  });
  it("keeps every formation legal: exactly OL + X + Y on the line, Z and H off", () => {
    for (const f of ["Doubles", "Doubles Lt", "Trips Rt", "Trips Lt", "Bunch Rt", "Bunch Lt", "Stack", "Nasty Rt", "Nasty Lt", "Empty", "Tank Rt", "Tank Lt"]) {
      const spots = formSpots(f);
      expect(Object.keys(spots).length, f + " fields eleven").toBe(11);
      const onLine = Object.entries(spots).filter(([, [, y]]) => y === 23).map(([k]) => k).sort();
      expect(onLine, f + " has exactly seven on the line").toEqual(["C", "LG", "LT", "RG", "RT", "X", "Y"]);
      expect(spots.Z[1], f + ": Z is always off the line").toBeGreaterThan(23);
      if (spots.H) expect(spots.H[1], f + ": H is always off the line").toBeGreaterThan(23);
    }
  });
  it("resolves play labels to the two personnel groups", () => {
    const speed = { offScheme: "Speed" };
    expect(resolvePlayPos(speed, "H")).toBe("Slot (H)");
    expect(resolvePlayPos(speed, "Y")).toBe("Slot (Y)");
    expect(resolvePlayPos(speed, "X")).toBe("WR (X)");
    const heavy = { offScheme: "Heavy" };
    expect(resolvePlayPos(heavy, "Y")).toBe("TE"); // Y is the tight end in Heavy
    expect(resolvePlayPos(heavy, "H")).toBe("FB"); // H is the fullback in Heavy
    expect(resolvePlayPos(heavy, "QB")).toBe("QB");
  });
  it("leaves no empty spots in either group", () => {
    for (const scheme of ["Speed", "Heavy"]) {
      const map = Object.values(
        Object.fromEntries(
          ["LT","LG","C","RG","RT","QB","X","Y","H","Z","RB"].map((l) => [l, resolvePlayPos({ offScheme: scheme }, l)])
        )
      );
      expect(map.every(Boolean)).toBe(true);
      expect(new Set(map).size).toBe(11); /* nobody doubled up */
    }
  });
});

/* ---------- end to end: real clicks in jsdom ---------- */
describe("app end-to-end", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  const load = async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("VESTAVIA HILLS REBELS")).toBeTruthy());
  };
  const setWeek = (w) => fireEvent.change(screen.getByLabelText("Season week"), { target: { value: String(w) } });

  it("splits the roster into practice groups from one button", async () => {
    await load();
    fireEvent.click(screen.getByText("Practice Groups"));
    expect(screen.getByText("QB / WR")).toBeTruthy();
    expect(screen.getByText("Linemen")).toBeTruthy();
    expect(screen.getByText("LB / RB")).toBeTruthy();
    fireEvent.click(screen.getByText("Done"));
    expect(screen.queryByText("QB / WR")).toBeNull();
  });

  it("locks packages before week 3 and runs WHITE at week 3", async () => {
    await load();
    fireEvent.click(screen.getByText("Caller"));
    expect(screen.getByText(/unlock at week 3/i)).toBeTruthy();
    setWeek(3);
    const safari = await screen.findByText("WHITE");
    fireEvent.click(safari);
    expect(screen.getByText(/1 of 3/)).toBeTruthy();
    fireEvent.click(screen.getByText("CALL IT")); // Rhino
    expect(screen.getByText(/2 of 3/)).toBeTruthy();
    fireEvent.click(screen.getByText("CALL IT")); // Rocket
    fireEvent.click(screen.getByText("CALL IT")); // Owl, runner clears
    expect(screen.queryByText("CALL IT")).toBeNull();
    const last = screen.getByText("Last:", { exact: false });
    expect(last.textContent).toContain("Owl");
  });

  it("hides later installs in the Play Lab at week 1 and gates the kill tool to week 4", async () => {
    await load();
    fireEvent.click(screen.getByText("Play Lab"));
    expect(screen.getByText(/Show \d+ later installs/)).toBeTruthy();
    const rowText = () => [...document.querySelectorAll(".play-name-cell")].map((el) => el.textContent);
    const week1Rows = rowText();
    expect(week1Rows.length).toBe(3); // Rhino, Lion, Sparrow only
    expect(week1Rows.some((t) => /Rabbit/.test(t))).toBe(false); // trap installs week 3
    setWeek(4);
    await waitFor(() => expect(rowText().length).toBeGreaterThan(3));
    expect(rowText().some((t) => /Rabbit/.test(t))).toBe(true);
    fireEvent.click(document.querySelector(".play-name-cell").closest("tr"));
    expect(await screen.findByText("Kill to:")).toBeTruthy();
  });

  it("offers a kill after calling a paired play at week 4", async () => {
    await load();
    setWeek(4);
    fireEvent.click(screen.getByText("Caller"));
    const rhinoBtns = await screen.findAllByRole("button", { name: /Rhino/ });
    fireEvent.click(rhinoBtns[0]);
    const kill = await screen.findByText(/KILL →/);
    expect(kill.textContent).toContain("Reese's");
    fireEvent.click(kill);
    expect(screen.getByText("Last:", { exact: false }).textContent).toContain("Reese's");
  });

  it("locks Empty to the QUICK family in the builder", async () => {
    await load();
    fireEvent.click(screen.getByText("Play Lab"));
    const formationSel = screen.getByDisplayValue("Doubles");
    fireEvent.change(formationSel, { target: { value: "Empty" } });
    const conceptSel = await screen.findByDisplayValue("Sparrow"); // auto-switched off Rhino
    const opts = within(conceptSel).getAllByRole("option").map((o) => o.textContent);
    expect(opts.some((t) => /Rhino/.test(t))).toBe(false);
    expect(opts.some((t) => /Reese's/.test(t))).toBe(true);
    expect(screen.getByText(/QUICK family only/)).toBeTruthy();
  });

  it("shows playbook formations on the depth chart in Formation View", async () => {
    await load();
    fireEvent.click(screen.getByText("Formation View"));
    const sel = await screen.findByLabelText("Formation");
    fireEvent.change(sel, { target: { value: "Trips Rt" } });
    const fv = within(document.querySelector(".fv-layer"));
    expect(fv.getByText("X")).toBeTruthy();
    expect(fv.getByText("H")).toBeTruthy();
    expect(fv.getByText("QB")).toBeTruthy();
    expect(fv.getAllByText(/Sample Player/).length).toBeGreaterThanOrEqual(1);
  });

  it("Formation View opens on the side you're viewing (mirror bug)", async () => {
    await load();
    // switch the depth chart to Defense, then open Formation View
    fireEvent.click([...document.querySelectorAll(".side-btn")].find((b) => b.textContent === "Defense"));
    fireEvent.click(screen.getByText("Formation View"));
    const fv = within(document.querySelector(".fv-layer"));
    // it should show DEFENSE positions, not the offense (QB/OL) that used to appear
    expect(fv.getByText("MIKE LB")).toBeTruthy();
    expect(fv.queryByText("QB")).toBeNull();
    expect(document.querySelector(".fv-side.active.def")).toBeTruthy();
  });

  it("runs Formation School: name first, tap to reveal, tap for next", async () => {
    await load();
    fireEvent.click(screen.getByText("Formation View"));
    fireEvent.click(await screen.findByText("Formation School"));
    const fv = within(document.querySelector(".fv-layer"));
    expect(fv.getByText("Doubles")).toBeTruthy();
    expect(fv.getByText(/Tap to check/)).toBeTruthy();
    fireEvent.click(document.querySelector(".fv-stage"));
    expect(fv.getByText(/next one/)).toBeTruthy();
    expect(fv.getByText("QB")).toBeTruthy();
    fireEvent.click(document.querySelector(".fv-stage"));
    expect(fv.getByText("Doubles Lt")).toBeTruthy();
    fireEvent.click(screen.getByText("Exit School"));
    expect(screen.queryByText(/Tap to check/)).toBeNull();
  });

  it("preloads tonight's Day 1 helmets plan in the practice planner", async () => {
    await load();
    fireEvent.click(screen.getByText("Practice Planner"));
    expect(screen.getByDisplayValue(/Day 1 · Helmets/)).toBeTruthy();
    expect(screen.getAllByText(/Formation Races/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Team Walk-Through Install/).length).toBeGreaterThanOrEqual(1);
  });
});

/* ---------- end to end: Supabase cloud sync ---------- */
describe("supabase sync", () => {
  const realFetch = global.fetch;
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    cleanup();
    delete window.SUPABASE_URL;
    delete window.SUPABASE_ANON_KEY;
    global.fetch = realFetch;
  });

  const cloudOn = () => {
    window.SUPABASE_URL = "https://test.supabase.co";
    window.SUPABASE_ANON_KEY = "test-anon-key";
  };
  const load = async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText("VESTAVIA HILLS REBELS")).toBeTruthy());
  };

  it("a dead cloud on load never overwrites the shared program", async () => {
    // Regression for the wiped depth chart: a failed cloud READ must not let the
    // app boot empty and then autosave that emptiness over the real cloud record.
    cloudOn();
    window.localStorage.setItem(
      "vh6-coach-data-v1",
      JSON.stringify({ ...JSON.parse(JSON.stringify(SEED)), seasonWeek: 4 })
    );
    const posts = [];
    global.fetch = (url, opts) => {
      if (opts && opts.method === "POST") {
        posts.push(opts);
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.reject(new TypeError("network down")); // the cloud READ fails
    };
    await load(); // boots view-only from the local cache
    expect(screen.getByText(/Working offline/i)).toBeTruthy();
    expect(screen.getByLabelText("Season week").value).toBe("4");
    // edit while offline
    fireEvent.change(screen.getByLabelText("Season week"), { target: { value: "6" } });
    await new Promise((r) => setTimeout(r, 1000)); // past the 700ms save debounce
    expect(posts.length).toBe(0); // the cloud was NEVER written -> record is safe
    expect(JSON.parse(window.localStorage.getItem("vh6-coach-data-v1")).seasonWeek).toBe(6); // local kept
  });

  it("reconnecting after an outage loads the real cloud copy, not the local guess", async () => {
    cloudOn();
    window.localStorage.setItem(
      "vh6-coach-data-v1",
      JSON.stringify({ ...JSON.parse(JSON.stringify(SEED)), seasonWeek: 2 })
    );
    let online = false;
    const cloudCopy = { ...JSON.parse(JSON.stringify(SEED)), seasonWeek: 5 };
    global.fetch = (url, opts) => {
      if (opts && opts.method === "POST") return Promise.resolve({ ok: true, json: async () => [] });
      if (!online) return Promise.reject(new TypeError("down"));
      return Promise.resolve({ ok: true, json: async () => [{ value: cloudCopy }] });
    };
    await load();
    expect(screen.getByLabelText("Season week").value).toBe("2"); // local cache while offline
    online = true;
    fireEvent.click(screen.getByText(/tap to reconnect/i));
    await waitFor(() => expect(screen.getByLabelText("Season week").value).toBe("5"), { timeout: 3000 });
    expect(screen.queryByText(/Working offline/i)).toBeNull();
  });

  it("store.get throws on a failed cloud read instead of returning empty", async () => {
    cloudOn();
    global.fetch = () => Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
    await expect(store.get("vh6-coach-data-v1")).rejects.toThrow();
    // a genuinely-empty account (read OK, no row) returns null, not a throw
    global.fetch = () => Promise.resolve({ ok: true, json: async () => [] });
    await expect(store.get("vh6-coach-data-v1")).resolves.toBeNull();
  });

  it("Add This Look refuses to mint a duplicate play", async () => {
    await load();
    fireEvent.click(screen.getByText("Play Lab"));
    fireEvent.click(document.querySelector(".play-name-cell").closest("tr")); // select Rhino
    const before = JSON.parse(window.localStorage.getItem("vh6-coach-data-v1") || "{}");
    const lookSel = screen.getByDisplayValue("Trips Rt");
    fireEvent.change(lookSel, { target: { value: "Doubles" } }); // Doubles · Rhino already exists
    fireEvent.click(screen.getByText(/Add This Look/));
    await waitFor(() => {
      const d = JSON.parse(window.localStorage.getItem("vh6-coach-data-v1"));
      expect(d.plays.filter((p) => p.name === "Doubles · Rhino").length).toBe(1);
    }, { timeout: 3000 });
  });

  it("prints a single coaching card from the play view", async () => {
    await load();
    fireEvent.click(screen.getByText("Play Lab"));
    fireEvent.click(document.querySelector(".play-name-cell").closest("tr"));
    fireEvent.click(screen.getByText("Print This Card"));
    await waitFor(() => expect(document.querySelector(".print-layer .jobs-grid")).toBeTruthy());
    expect(document.querySelector(".print-layer .line-chip").textContent).toBe("HAMMER");
  });

  it("prints the play-card book filtered to the WEEK dial", async () => {
    await load();
    fireEvent.click(screen.getByText("Play Lab"));
    fireEvent.click(screen.getByText("Print Play Cards"));
    // week 1: only Rhino, Lion, Sparrow are installed
    await waitFor(() => expect(document.querySelectorAll(".book-card").length).toBe(3));
    expect(document.querySelector(".print-layer .p-meta").textContent).toMatch(/thru week 1/);
  });

  it("Clear empties the call sheet, then Fill rebuilds it complete", async () => {
    await load();
    fireEvent.change(screen.getByLabelText("Season week"), { target: { value: "9" } });
    fireEvent.click(screen.getByText("Call Sheet"));
    fireEvent.click(screen.getByText(/Fill It For Me/));
    await waitFor(() => expect(document.querySelectorAll(".cs-chip").length).toBeGreaterThan(0));
    window.confirm = () => true;
    fireEvent.click(screen.getByText("Clear"));
    await waitFor(() => expect(document.querySelectorAll(".cs-chip").length).toBe(0));
    fireEvent.click(screen.getByText(/Fill It For Me/));
    await waitFor(() => expect(document.querySelectorAll(".cs-chip").length).toBeGreaterThan(0));
  });
  it("tags Heavy-personnel plays on the call sheet (sub reminder)", async () => {
    await load();
    fireEvent.change(screen.getByLabelText("Season week"), { target: { value: "9" } }); // install everything incl. Tank/I
    fireEvent.click(screen.getByText("Call Sheet"));
    fireEvent.click(screen.getByText(/Fill It For Me/));
    await waitFor(() => expect(document.querySelectorAll(".cs-chip").length).toBeGreaterThan(0));
    // a Tank/I chip carries HEAVY, a Doubles chip does not
    const chips = [...document.querySelectorAll(".cs-chip")];
    const heavy = chips.find((c) => /Tank|I Rt|I Lt/.test(c.textContent));
    const speed = chips.find((c) => /Doubles . (HAMMER|QUICK)/.test(c.textContent) && !/Tank|I Rt|I Lt/.test(c.textContent));
    expect(heavy && /HEAVY/.test(heavy.textContent), "a heavy formation is tagged").toBe(true);
    if (speed) expect(/HEAVY/.test(speed.textContent), "a spread play is not tagged").toBe(false);
  });
  it("every call surface includes the line word (Greg's July 27 catch)", async () => {
    await load();
    // Caller buttons carry the line word
    fireEvent.click(screen.getByText("Caller"));
    await waitFor(() => expect(document.querySelectorAll(".cb-line").length).toBeGreaterThan(0));
    expect([...document.querySelectorAll(".cb-line")].some((el) => el.textContent === "HAMMER")).toBe(true);
    // Call sheet chips and print carry it too
    fireEvent.click(screen.getByText("Call Sheet"));
    fireEvent.click(screen.getByText(/Fill It For Me/));
    await waitFor(() => expect(document.querySelectorAll(".cs-chip").length).toBeGreaterThan(0));
    expect([...document.querySelectorAll(".cs-chip")].some((el) => /HAMMER/.test(el.textContent))).toBe(true);
    fireEvent.click(screen.getByText("Print Call Sheet"));
    await waitFor(() => expect(document.querySelectorAll(".print-layer .p-cs-linecall").length).toBeGreaterThan(0));
    expect([...document.querySelectorAll(".print-layer .p-cs-linecall")].map((el) => el.textContent)).toContain("HAMMER");
    // spoken order: formation BEFORE the line word, Doubles silent (Greg's Aug 3 catch)
    const rows = [...document.querySelectorAll(".print-layer .p-cs-play")].map((el) => el.textContent);
    expect(rows.some((r) => /Doubles/.test(r)), "Doubles never printed in the call").toBe(false);
  });

  it("Print Cards works from inside Formation View", async () => {
    await load();
    fireEvent.click(screen.getByText("Formation View"));
    await waitFor(() => expect(document.querySelector(".fv-layer")).toBeTruthy());
    fireEvent.click(screen.getByText("Print Cards"));
    await waitFor(() => expect(document.querySelectorAll(".print-layer .fp-card").length).toBeGreaterThan(0));
  });

  it("tapping a situation loads the whole defensive call", async () => {
    await load();
    fireEvent.click([...document.querySelectorAll(".tab")].find((b) => b.textContent === "Defense"));
    await waitFor(() => expect(document.querySelector(".def-sit")).toBeTruthy());
    const longPass = [...document.querySelectorAll(".def-sit")].find((b) => /3rd . long|obvious pass/i.test(b.textContent));
    fireEvent.click(longPass);
    await waitFor(() => expect(document.querySelector(".def-call b").textContent).toMatch(/4-3.*THUNDER/));
  });
  it("survives stale defense data from the old version (cov=lock, blitz=mike)", async () => {
    // this exact shape blanked the page: DEF_COVERAGES['lock'] is gone
    window.localStorage.setItem("vh6-coach-data-v1", JSON.stringify({ players: [], defense: { front: "4-4", cov: "lock", blitz: "mike" } }));
    render(<App />);
    await waitFor(() => expect(screen.getByText("VESTAVIA HILLS REBELS")).toBeTruthy());
    fireEvent.click([...document.querySelectorAll(".tab")].find((b) => b.textContent === "Defense"));
    await waitFor(() => expect(document.querySelector(".def-diagram svg")).toBeTruthy());
    expect(document.querySelector(".def-call b").textContent).toMatch(/Cover 3/); // fell back to sky
  });
  it("Defense tab renders 11 defenders and toggles the front", async () => {
    await load();
    fireEvent.click([...document.querySelectorAll(".tab")].find((b) => b.textContent === "Defense"));
    await waitFor(() => expect(document.querySelector(".def-diagram svg")).toBeTruthy());
    const before = document.querySelectorAll(".def-diagram circle").length;
    expect(before).toBeGreaterThan(11); // 11 defenders + offense reference
    fireEvent.click(screen.getByText("4-3"));
    await waitFor(() => expect(document.querySelector(".def-call b").textContent).toMatch(/4-3/));
  });
  it("Game Day tab renders the plan and prints with edited owners", async () => {
    await load();
    fireEvent.click([...document.querySelectorAll(".tab")].find((b) => b.textContent === "Game Day"));
    await waitFor(() => expect(screen.getByText("Game Day Plan")).toBeTruthy());
    expect(screen.getByText(/OFFENSIVE EYES/)).toBeTruthy();
    const owner = document.querySelector(".gd-owner"); // now a coach dropdown
    expect(owner.tagName).toBe("SELECT");
    expect([...owner.options].map((o) => o.value)).toContain("Nathan"); // built from the crew
    fireEvent.change(owner, { target: { value: "Nathan" } });
    fireEvent.click(screen.getByText("Print Game Day Sheet"));
    await waitFor(() => expect(document.querySelector(".print-layer .gp-cols")).toBeTruthy());
    expect(document.querySelector(".print-layer").textContent).toMatch(/Nathan/);
    // never leaks roster PII: the plan is coach-org only
    expect(document.querySelector(".print-layer").textContent).not.toMatch(/@|Birthdate|Guardian/);
  });
  it("has no manual Backup/Restore buttons (cloud sync replaced them)", async () => {
    await load();
    expect(screen.queryByText("Backup")).toBeNull();
    expect(screen.queryByText("Restore")).toBeNull();
  });

  it("loads the shared program from the cloud when Supabase answers", async () => {
    cloudOn();
    const cloudData = { ...JSON.parse(JSON.stringify(SEED)), seasonWeek: 5 };
    global.fetch = (url, opts) =>
      Promise.resolve({
        ok: true,
        json: async () => ((opts && opts.method) === "POST" ? [] : [{ value: cloudData }]),
      });
    await load();
    expect(screen.getByLabelText("Season week").value).toBe("5");
  });
});
