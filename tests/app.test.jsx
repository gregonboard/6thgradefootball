import React from "react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, cleanup } from "@testing-library/react";
import App, {
  normalizeData, practiceGroupsFor, pgForPos, CONCEPTS, callWord,
  LINE_CALLS, ASSIGNMENTS, SEED, seedPackages, day1Plan, applyKillPairs,
  installedForms, resolvePlayPos, FORM_WEEKS, formSpots,
} from "../src/App.jsx";

/* ---------- unit: vocabulary and doctrine ---------- */
describe("vocabulary", () => {
  it("renames Lasso to Longhorn and Snickers Lt to Skittles", () => {
    expect(CONCEPTS.keep.words.Lt).toBe("Longhorn");
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
    expect(SEED.plays.length).toBe(58);
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
    expect(LINE_CALLS.stretch).toBe("REACH"); // Ram/Leopard reuse the word the line already knows
  });
  it("answers the down-block key with a true reach play", () => {
    expect(CONCEPTS.stretch.words).toEqual({ Rt: "Ram", Lt: "Leopard" });
    expect(CONCEPTS.stretch.carrier).toBe("RB");
    const ram = SEED.plays.find((p) => p.name === "Doubles · Ram");
    expect(ram).toBeTruthy();
    expect(ram.week).toBe(3);
  });
  it("hinge rule: backside tackle walls the pulled guard's man on power", () => {
    // the assistant-coach fix: a DL keying the pulling guard gets walled by the tackle
    expect(ASSIGNMENTS.power.OL).toMatch(/walls the man over the pulled guard/i);
    expect(ASSIGNMENTS.stretch.H).toMatch(/lead/i); // jet motion becomes the lead block
    expect(ASSIGNMENTS.stretch.OL).toMatch(/reach/i);
  });
});

/* ---------- unit: seeds ---------- */
describe("seeds", () => {
  it("seeds SAFARI, STAMPEDE, and CHEETAH packages", () => {
    const pk = seedPackages();
    expect(pk.map((p) => p.name)).toEqual(["SAFARI", "STAMPEDE", "CHEETAH"]);
    expect(pk.every((p) => p.steps.length === 3)).toBe(true);
  });
  it("jet exchange: QB owns the basket, H never has to catch", () => {
    expect(CONCEPTS.jet.how).toMatch(/basket/i);
    expect(ASSIGNMENTS.jet.QB).toMatch(/you own the ball/i);
    expect(ASSIGNMENTS.jet.QB).toMatch(/Rustler path/); // broken mesh has an answer
    expect(ASSIGNMENTS.jet.H).not.toMatch(/catch/i);
    expect(CONCEPTS.jet.fam).toBe("Run");
  });
  it("seeds the v6 costume looks", () => {
    const names = SEED.plays.map((p) => p.name);
    for (const want of ["Bunch Rt · Rocket", "Nasty Rt · Ram", "Tank Rt · Ram", "Trips Rt · Rhino", "Tank Lt · Leopard"]) {
      expect(names, want + " is seeded").toContain(want);
    }
    expect(SEED.plays.length).toBe(58);
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
    for (const want of ["Jet Mesh & Basket", "Motion Landmark Races", "Owl Fake & Pop", "Reach & Run (REACH steps)"]) {
      expect(names, want + " is in the plan").toContain(want);
    }
  });
  it("adds the jet drills and Week 2 plan to an existing program once", () => {
    const old = {
      players: [],
      drills: SEED.drills.filter((d) => !/Jet Mesh|Motion Landmark|Owl Fake|Reach & Run/.test(d.name)).map((d) => ({ ...d })),
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
    expect(v3.plays.length).toBe(58); // 30 + v4 looks + Ram/Leopard + v6 costumes + QB tree
    expect(v3.safariVersion).toBe(7);
    expect(v3.packages.map((p) => p.name)).toContain("CHEETAH");
    const rocket = v3.plays.find((p) => p.name === "Doubles · Rocket");
    const reeses = v3.plays.find((p) => p.name === "Doubles · Reese's");
    expect(rocket.killId).toBe(reeses.id);
    // running it again must change nothing (Greg's live data reloads every session)
    const again = normalizeData(JSON.parse(JSON.stringify(v3)));
    expect(again.plays.length).toBe(58);
    expect(again.packages.length).toBe(v3.packages.length);
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
    expect(d.packages.map((p) => p.name)).toContain("SAFARI");
    const rhino = d.plays.find((p) => p.concept === "power" && p.dir === "Rt");
    const bubble = d.plays.find((p) => p.concept === "bubble" && p.dir === "Rt");
    expect(rhino.killId).toBe(bubble.id);
    const keepLt = d.plays.find((p) => p.concept === "keep" && p.dir === "Lt");
    expect(keepLt.name).toContain("Longhorn"); // derived names propagate the rename
    expect(d.savedPlans.some((s) => /day 1/i.test(s.name))).toBe(true);
    expect(d.players[0].name).toBe("Old Kid"); // user data untouched
    expect(d.safariVersion).toBe(7);
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
      off: { "LT": ["a", null, null], "QB": ["b", null, null], "RB": ["c", null, null] },
      def: { "MIKE LB": ["a", null, null], "WILL LB": [null, "c", null] },
    },
    offScheme: "I-Form",
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
describe("formations", () => {
  it("staggers formation installs on the week dial", () => {
    expect(installedForms(1)).toEqual(["Doubles", "Doubles Lt", "Trips Rt", "Trips Lt"]);
    expect(installedForms(6).length).toBe(12);
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
  it("resolves play labels to depth chart positions for any scheme", () => {
    const spread = { offScheme: "Spread" };
    expect(resolvePlayPos(spread, "H")).toBe("Slot (H)");
    expect(resolvePlayPos(spread, "Y")).toBe("Slot (Y)");
    expect(resolvePlayPos(spread, "X")).toBe("WR (X)");
    const iform = { offScheme: "I-Form" };
    expect(resolvePlayPos(iform, "Y")).toBe("TE");
    expect(resolvePlayPos(iform, "H")).toBe("FB");
    expect(resolvePlayPos(iform, "QB")).toBe("QB");
  });
  it("fills every play spot in Singleback: Y takes the TE, the slot travels as H", () => {
    const sb = { offScheme: "Singleback" };
    expect(resolvePlayPos(sb, "Y")).toBe("TE");
    expect(resolvePlayPos(sb, "H")).toBe("Slot (Y)");
    expect(resolvePlayPos(sb, "Z")).toBe("WR (Z)");
    expect(resolvePlayPos(sb, "RB")).toBe("RB");
  });
  it("leaves no empty spots in any scheme", () => {
    for (const scheme of ["I-Form", "Singleback", "Spread", "Wing-T"]) {
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

  it("locks packages before week 3 and runs SAFARI at week 3", async () => {
    await load();
    fireEvent.click(screen.getByText("Caller"));
    expect(screen.getByText(/unlock at week 3/i)).toBeTruthy();
    setWeek(3);
    const safari = await screen.findByText("SAFARI");
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

  it("keeps the local copy when the sideline connection is dead", async () => {
    cloudOn();
    global.fetch = () => Promise.reject(new TypeError("network down"));
    await load(); // load survives: falls through to localStorage/SEED
    fireEvent.change(screen.getByLabelText("Season week"), { target: { value: "3" } });
    await waitFor(() => {
      const raw = window.localStorage.getItem("vh6-coach-data-v1");
      expect(raw).toBeTruthy();
      expect(JSON.parse(raw).seasonWeek).toBe(3);
    }, { timeout: 3000 });
    // The failed cloud sync surfaces a tappable retry chip; a retry that
    // reaches Supabase flips it back to saved.
    const retry = await screen.findByText(/tap to retry/i, {}, { timeout: 3000 });
    global.fetch = () => Promise.resolve({ ok: true, json: async () => [] });
    fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText("All changes saved")).toBeTruthy(), { timeout: 3000 });
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
