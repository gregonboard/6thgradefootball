import { it, expect } from "vitest";
import { SEED, CONCEPTS, genPlayElements, formSpots } from "../src/App.jsx";

it("SWEEP: every seeded play draws sanely in its real formation with its real tags", () => {
  const problems = [];
  for (const p of SEED.plays) {
    if (!p.concept || !CONCEPTS[p.concept] || p.concept === "blank") continue;
    const spots = formSpots(p.formation);
    const els = genPlayElements(p.concept, spots, p.dir, p.tags || []);
    for (const [L, list] of Object.entries(els)) {
      if (!spots[L]) { problems.push(`${p.name}: draws ${L} who is not in ${p.formation}`); continue; }
      for (const e of list) {
        for (const [x, y] of e.pts) {
          if (x < -1 || x > 101 || y < -2 || y > 40) problems.push(`${p.name}: ${L} ${e.kind} leaves the field [${Math.round(x)},${Math.round(y)}]`);
        }
        if (e.kind === "carry" && e.pts[e.pts.length - 1][1] >= e.pts[0][1]) problems.push(`${p.name}: ${L} carry never goes upfield`);
        if (e.kind === "motion") {
          for (const [, y] of e.pts) if (y < 22.5) problems.push(`${p.name}: ${L} motion crosses the LOS pre-snap`);
        }
        if (e.kind === "route" || e.kind === "carry") {
          // boomerang detector: a leg that retraces more than 70% of the previous leg's x travel
          for (let i = 2; i < e.pts.length; i++) {
            const a = e.pts[i - 1][0] - e.pts[i - 2][0];
            const b = e.pts[i][0] - e.pts[i - 1][0];
            if (Math.abs(a) > 6 && Math.sign(b) === -Math.sign(a) && Math.abs(b) > 0.7 * Math.abs(a)) {
              problems.push(`${p.name}: ${L} ${e.kind} boomerangs (${e.pts.map((q) => Math.round(q[0])).join("→")})`);
            }
          }
        }
      }
    }
  }
  expect(problems.length, "\n" + [...new Set(problems)].join("\n")).toBe(0);
});
