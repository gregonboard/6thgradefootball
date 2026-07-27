import { it, expect } from "vitest";
import { CONCEPTS, genPlayElements, formSpots } from "../src/App.jsx";

const OL_SWAP = { LT: "RT", RT: "LT", LG: "RG", RG: "LG" };
const mirror = ([x, y]) => [Math.round((100 - x) * 10) / 10, y];
const close = (a, b) => Math.abs(a[0] - b[0]) < 0.6 && Math.abs(a[1] - b[1]) < 0.6;

it("AUDIT: every concept mirrors perfectly and obeys football sanity", () => {
  const problems = [];
  for (const [key, c] of Object.entries(CONCEPTS)) {
    if (key === "blank") continue;
    const skipMirror = key === "owl"; /* Owl is ALWAYS Rhino-right by ruling, never mirrored */
    const dirs = c.dirs[0] === "Rt" ? [["Rt", "Lt"]] : [["", ""]];
    for (const [dr, dl] of dirs) {
      const rt = genPlayElements(key, formSpots("Doubles"), dr);
      const lt = genPlayElements(key, formSpots("Doubles Lt"), dl);
      for (const [L, els] of Object.entries(rt)) {
        if (skipMirror) break;
        const twin = lt[OL_SWAP[L] || L];
        if (!twin) { problems.push(`${key}: ${L} drawn in Rt but ${OL_SWAP[L] || L} missing in mirror`); continue; }
        for (const e of els) {
          const match = twin.find((t) => t.kind === e.kind && t.pts.length === e.pts.length && t.pts.every((p, i) => close(mirror(p), t.pts[i]) || close(mirror(e.pts[i]), t.pts[i])));
          const m2 = twin.find((t) => t.kind === e.kind && t.pts.length === e.pts.length && e.pts.every((p, i) => close(mirror(p), t.pts[i])));
          if (!m2) problems.push(`${key}: ${L} ${e.kind} does not mirror (Rt ${JSON.stringify(e.pts)} vs Lt ${JSON.stringify((twin.find((t) => t.kind === e.kind) || {}).pts)})`);
        }
      }
      // sanity on the Rt version
      for (const [L, els] of Object.entries(rt)) {
        for (const e of els) {
          for (const [x, y] of e.pts) {
            if (x < 0 || x > 100 || y < -2 || y > 40) problems.push(`${key}: ${L} ${e.kind} leaves the field at [${x},${y}]`);
          }
          if (e.kind === "carry" && e.pts[e.pts.length - 1][1] >= e.pts[0][1]) problems.push(`${key}: ${L} carry never goes upfield`);
        }
      }
    }
  }
  expect(problems.length, "\n" + problems.join("\n")).toBe(0);
});
