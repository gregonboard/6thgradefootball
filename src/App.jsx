import { useState, useEffect, useRef, useMemo } from "react";

/* ============================================================
   VESTAVIA HILLS 6TH GRADE — SIDELINE COMMAND
   Roster & depth chart · Practice planner · Playbook
   Call sheet · Wristband printer · Game day sheet
   ============================================================ */

/* ---------- offensive formations ----------
   Same idea as the defensive fronts: position names are shared wherever the
   job is the same (QB, RB, FB, X, Z, TE, and all five linemen), so switching
   formations keeps assignments. Formation-only spots (Slots, Wing, HB) hide
   when the current formation doesn't use them and come back when you return. */
const OL5 = ["LT", "LG", "C", "RG", "RT"];
const OL_SPOTS = { "LT": [34, 16], "LG": [42, 16], "C": [50, 16], "RG": [58, 16], "RT": [66, 16] };
const OFF_SCHEMES = {
  "I-Form": {
    positions: ["QB", "RB", "FB", "WR (X)", "WR (Z)", "TE", ...OL5],
    spots: { ...OL_SPOTS, "WR (X)": [8, 16], "TE": [74, 16], "WR (Z)": [92, 22], "QB": [50, 36.7], "FB": [50, 61], "RB": [50, 84] },
  },
  "Singleback": {
    positions: ["QB", "RB", "TE", "WR (X)", "WR (Z)", "Slot (Y)", ...OL5],
    spots: { ...OL_SPOTS, "WR (X)": [6, 16], "TE": [74, 16], "Slot (Y)": [84, 22], "WR (Z)": [94, 16], "QB": [50, 36.7], "RB": [50, 64] },
  },
  "Spread": {
    positions: ["QB", "RB", "WR (X)", "Slot (H)", "Slot (Y)", "WR (Z)", ...OL5],
    spots: { ...OL_SPOTS, "WR (X)": [6, 16], "Slot (H)": [20, 22], "Slot (Y)": [80, 22], "WR (Z)": [94, 16], "QB": [50, 38], "RB": [36, 40] },
  },
  "Wing-T": {
    positions: ["QB", "FB", "HB", "Wing", "TE", "WR (X)", ...OL5],
    spots: { ...OL_SPOTS, "WR (X)": [8, 16], "TE": [74, 16], "Wing": [82, 28], "QB": [50, 36.7], "HB": [36, 62], "FB": [50, 62] },
  },
};
const OFF_POS_ALL = [...new Set(Object.values(OFF_SCHEMES).flatMap((s) => s.positions))];
const offScheme = (data) => (OFF_SCHEMES[data.offScheme] ? data.offScheme : "I-Form");
const offPositions = (data) => OFF_SCHEMES[offScheme(data)].positions;

/* ---------- defensive fronts ----------
   Position names are shared across fronts wherever the job is the same, so
   switching schemes keeps assignments: your MIKE stays your MIKE in a 5-3,
   5-2, or 4-3. Scheme-only spots (NG, SAM, BUCK, SS) hide when the current
   front doesn't use them, and their depth comes back when you switch back. */
const DL5 = ["DE (L)", "DT (L)", "NG", "DT (R)", "DE (R)"];
const DL4 = ["DE (L)", "DT (L)", "DT (R)", "DE (R)"];
const DEF_SCHEMES = {
  "5-3": {
    positions: [...DL5, "SAM LB", "MIKE LB", "WILL LB", "CB (L)", "CB (R)", "FS"],
    spots: {
      "DE (L)": [26, 14], "DT (L)": [38, 14], "NG": [50, 14], "DT (R)": [62, 14], "DE (R)": [74, 14],
      "SAM LB": [30, 42], "MIKE LB": [50, 42], "WILL LB": [70, 42],
      "CB (L)": [8, 26], "CB (R)": [92, 26], "FS": [50, 70],
    },
  },
  "5-2": {
    positions: [...DL5, "MIKE LB", "WILL LB", "CB (L)", "CB (R)", "SS", "FS"],
    spots: {
      "DE (L)": [26, 14], "DT (L)": [38, 14], "NG": [50, 14], "DT (R)": [62, 14], "DE (R)": [74, 14],
      "MIKE LB": [40, 42], "WILL LB": [60, 42],
      "CB (L)": [8, 26], "CB (R)": [92, 26], "SS": [34, 64], "FS": [66, 64],
    },
  },
  "4-3": {
    positions: [...DL4, "SAM LB", "MIKE LB", "WILL LB", "CB (L)", "CB (R)", "SS", "FS"],
    spots: {
      "DE (L)": [32, 14], "DT (L)": [44, 14], "DT (R)": [56, 14], "DE (R)": [68, 14],
      "SAM LB": [30, 42], "MIKE LB": [50, 42], "WILL LB": [70, 42],
      "CB (L)": [8, 26], "CB (R)": [92, 26], "SS": [34, 64], "FS": [66, 64],
    },
  },
  "4-4": {
    positions: [...DL4, "SAM LB", "MIKE LB", "BUCK LB", "WILL LB", "CB (L)", "CB (R)", "FS"],
    spots: {
      "DE (L)": [32, 14], "DT (L)": [44, 14], "DT (R)": [56, 14], "DE (R)": [68, 14],
      "SAM LB": [20, 38], "MIKE LB": [42, 42], "BUCK LB": [58, 42], "WILL LB": [80, 38],
      "CB (L)": [8, 26], "CB (R)": [92, 26], "FS": [50, 68],
    },
  },
};
const DEF_POS_ALL = [...new Set(Object.values(DEF_SCHEMES).flatMap((s) => s.positions))];
const defScheme = (data) => (DEF_SCHEMES[data.defScheme] ? data.defScheme : "5-3");
const defPositions = (data) => DEF_SCHEMES[defScheme(data)].positions;
const DRILL_CATS = ["Warmup", "Individual", "Group", "Team", "Special Teams", "Conditioning"];
const GROUPS = ["All", "Offense", "Defense", "OL", "DL", "OL/DL", "QB", "RB", "WR/TE", "Skill (QB/RB/WR/TE)", "LB", "DB", "LB/DB", "Bigs + Backs", "WR vs DB", "Skill + LB/DB", "Special Teams"];
const GROUP_TONES = {
  Offense: "#C32032", OL: "#C32032", QB: "#C32032", RB: "#C32032", "WR/TE": "#C32032",
  "Skill (QB/RB/WR/TE)": "#C32032", "Bigs + Backs": "#C32032",
  Defense: "#23356F", DL: "#23356F", LB: "#23356F", DB: "#23356F", "LB/DB": "#23356F",
  "Special Teams": "#0F6B4F",
};
const groupTone = (g) => GROUP_TONES[g] || "#23356F";

/* ---------- depth chart model ----------
   The depth chart is the source of truth. Each side has, per position,
   exactly three team slots: data.depth.off["QB"] = [id1, id2, id3] (null = open).
   A player can hold slots at multiple positions on the same side, so your
   starting WR can also be the 2nd team QB. */
function slotsFor(data, side, pos) {
  const ids = ((data.depth && data.depth[side]) || {})[pos] || [null, null, null];
  return [0, 1, 2].map((i) => data.players.find((p) => p.id === ids[i]) || null);
}

/* All slots a player holds on a side, e.g. [{pos:"WR (X)", team:1}, {pos:"QB", team:2}] */
function assignmentsFor(data, side, id) {
  const posList = side === "off" ? offPositions(data) : defPositions(data);
  const out = [];
  for (const pos of posList) {
    const ids = ((data.depth && data.depth[side]) || {})[pos] || [];
    const i = ids.indexOf(id);
    if (i >= 0) out.push({ pos, team: i + 1 });
  }
  return out.sort((a, b) => a.team - b.team);
}

/* ---------- playbook formations on the depth chart ----------
   Single source of truth: PLAY_FORM_NAMES / formSpots drive both the
   Play Lab and the Formation View, so the two can never drift apart.
   FORM_WEEKS staggers the install to match the WEEK dial. */
const FORM_WEEKS = { "Doubles": 1, "Doubles Lt": 1, "Trips Rt": 1, "Trips Lt": 1, "Tank Rt": 4, "Tank Lt": 4, "Bunch Rt": 5, "Bunch Lt": 5, "Empty": 6, "Stack": 5, "Nasty Rt": 5, "Nasty Lt": 5 };
const installedForms = (week) => PLAY_FORM_NAMES.filter((f) => (FORM_WEEKS[f] || 1) <= week);
/* Map play diagram labels to depth chart positions JOINTLY: each label
   has a preference list, resolved in order, and nobody gets used twice.
   That's what makes Singleback work: Y takes the TE (tight, on the line),
   which frees Slot (Y) to fill H (the traveler). No scheme leaves a play
   spot empty as long as eleven positions exist. */
const PLAY_POS_PREFS = {
  LT: ["LT"], LG: ["LG"], C: ["C"], RG: ["RG"], RT: ["RT"], QB: ["QB"],
  X: ["WR (X)"],
  Y: ["TE", "Slot (Y)", "Wing"],
  H: ["Slot (H)", "Slot (Y)", "Wing", "FB", "TE"],
  Z: ["WR (Z)", "Wing", "Slot (Y)", "TE", "FB"],
  RB: ["RB", "HB", "FB"],
};
const PLAY_RESOLVE_ORDER = ["LT", "LG", "C", "RG", "RT", "QB", "X", "Y", "H", "Z", "RB"];
function resolvePlayMap(data) {
  const list = offPositions(data);
  const used = new Set();
  const out = {};
  for (const label of PLAY_RESOLVE_ORDER) {
    const pick =
      (PLAY_POS_PREFS[label] || []).find((p) => list.includes(p) && !used.has(p)) ||
      list.find((p) => p.includes(`(${label})`) && !used.has(p)) ||
      null;
    out[label] = pick;
    if (pick) used.add(pick);
  }
  return out;
}
function resolvePlayPos(data, label) {
  return resolvePlayMap(data)[label];
}

/* Spread crowded cards apart so nothing overlaps. OL and QB stay planted;
   skill players get nudged outward until same-row neighbors have room. */
const PG_FIXED = new Set(["LT", "LG", "C", "RG", "RT", "QB"]);
function fvSpread(spots, rowEps, minGap) {
  const es = Object.entries(spots).map(([k, [x, y]]) => ({ k, x, y, fixed: PG_FIXED.has(k) }));
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < es.length; i++) {
      for (let j = i + 1; j < es.length; j++) {
        const a = es[i], b = es[j];
        if (a.fixed && b.fixed) continue;
        if (Math.abs(a.y - b.y) >= rowEps) continue;
        const [l, r] = a.x <= b.x ? [a, b] : [b, a];
        const gap = r.x - l.x;
        if (gap >= minGap) continue;
        const need = minGap - gap;
        if (l.fixed) r.x += need;
        else if (r.fixed) l.x -= need;
        else { l.x -= need / 2; r.x += need / 2; }
      }
    }
  }
  return Object.fromEntries(es.map((e) => [e.k, [Math.min(97, Math.max(3, e.x)), e.y]]));
}

/* ---------- practice groups ----------
   One button splits the whole roster into the three coaching groups
   (QB/WR skill, Linemen, LB/RB) from the depth chart, offense and
   defense combined. Two-way kids and kids on two depth lines get a
   default home (their best slot: 1st team beats 2nd, offense breaks
   ties) plus chips to move them. Overrides persist in pgOverrides. */
const PG_GROUPS = [["skill", "QB / WR"], ["line", "Linemen"], ["backs", "LB / RB"]];
function pgForPos(pos) {
  if (["LT", "LG", "C", "RG", "RT"].includes(pos) || /^(DE|DT|NG)/.test(pos)) return "line";
  if (/LB/.test(pos) || ["RB", "FB", "HB"].includes(pos)) return "backs";
  return "skill"; /* QB, receivers, slots, TE, Wing, corners, safeties */
}
function practiceGroupsFor(data) {
  const overrides = data.pgOverrides || {};
  const out = { skill: [], line: [], backs: [] };
  const multi = [];
  const unassigned = [];
  for (const p of data.players) {
    const asg = [
      ...assignmentsFor(data, "off", p.id).map((a) => ({ ...a, side: "off" })),
      ...assignmentsFor(data, "def", p.id).map((a) => ({ ...a, side: "def" })),
    ];
    if (asg.length === 0) {
      if (overrides[p.id] && out[overrides[p.id]]) out[overrides[p.id]].push({ p, groups: [], home: overrides[p.id] });
      else unassigned.push(p);
      continue;
    }
    const groups = [...new Set(asg.map((a) => pgForPos(a.pos)))];
    const best = [...asg].sort((a, b) => a.team - b.team || (a.side === "off" ? -1 : 1))[0];
    const home = out[overrides[p.id]] ? overrides[p.id] : pgForPos(best.pos);
    out[home].push({ p, groups, home });
    if (groups.length > 1) multi.push({ p, groups, home });
  }
  return { out, multi, unassigned };
}

/* Migrate older saves (single offPos/defPos per player, variable depth lists)
   into the 3-slot model. Depth is kept for the union of all fronts' positions,
   and the old single-high "SAFETY" becomes "FS". */
function migrateDepth(data) {
  const three = (a) => [a[0] || null, a[1] || null, a[2] || null];
  if ((data.depthVersion || 1) >= 2) {
    const fix = (m, list, legacyMap) => {
      const src = { ...(m || {}) };
      for (const [oldKey, newKey] of Object.entries(legacyMap || {})) {
        if (src[oldKey] && !(src[newKey] || []).some(Boolean)) src[newKey] = src[oldKey];
      }
      const o = {};
      for (const pos of list) o[pos] = three(src[pos] || []);
      return o;
    };
    return { ...data, depth: { off: fix(data.depth && data.depth.off, OFF_POS_ALL), def: fix(data.depth && data.depth.def, DEF_POS_ALL, { SAFETY: "FS" }) } };
  }
  const build = (side, posList, field, legacyMap) => {
    const out = {};
    for (const pos of posList) {
      const matches = (v) => v === pos || (legacyMap || {})[v] === pos;
      const stored = ((data.depth && data.depth[side]) || {})[pos] || [];
      const ordered = [];
      for (const id of stored) {
        const p = data.players.find((x) => x.id === id);
        if (p && matches(p[field]) && !ordered.includes(id)) ordered.push(id);
      }
      for (const p of data.players) {
        if (matches(p[field]) && !ordered.includes(p.id)) ordered.push(p.id);
      }
      out[pos] = three(ordered);
    }
    return out;
  };
  return { ...data, depth: { off: build("off", OFF_POS_ALL, "offPos"), def: build("def", DEF_POS_ALL, "defPos", { SAFETY: "FS" }) }, depthVersion: 2 };
}
const CAT_COLORS = {
  Warmup: "#B7791F",
  Individual: "#23356F",
  Group: "#4C2A85",
  Team: "#C32032",
  "Special Teams": "#0F6B4F",
  Conditioning: "#5B616B",
};
const PLAY_TYPES = ["Run", "Pass", "Screen", "Special"];
const TYPE_COLORS = { Run: "#C32032", Pass: "#23356F", Screen: "#0F6B4F", Special: "#B7791F" };

const SITUATIONS = [
  { key: "openers", label: "Openers (First 6)" },
  { key: "run", label: "Base Runs" },
  { key: "pass", label: "Base Passes" },
  { key: "third_short", label: "3rd & Short" },
  { key: "third_long", label: "3rd & Long" },
  { key: "redzone", label: "Red Zone" },
  { key: "goalline", label: "Goal Line / 2-Pt" },
  { key: "special", label: "Specials / Trick" },
];

const uid = () => Math.random().toString(36).slice(2, 10);


/* ============================================================
   SAFARI PLAY ENGINE
   Formation x Concept x Direction = a generated play diagram.
   ============================================================ */

/* Base formation geometry (Rt-strong). Lt variants are mirrored with
   paired labels swapped (X<->Z, LT<->RT, LG<->RG). H and Y travel. */
const PLAY_FORMS = {
  "Doubles": { X: [6, 23], H: [18, 25], LT: [38, 23], LG: [44, 23], C: [50, 23], RG: [56, 23], RT: [62, 23], Y: [68, 23], Z: [88, 25], QB: [50, 30], RB: [43, 30] },
  "Trips":   { X: [6, 23], LT: [38, 23], LG: [44, 23], C: [50, 23], RG: [56, 23], RT: [62, 23], Y: [68, 23], H: [76, 26], Z: [90, 25], QB: [50, 30], RB: [43, 30] },
  "Empty":   { X: [6, 23], H: [15, 25], RB: [24, 26], LT: [38, 23], LG: [44, 23], C: [50, 23], RG: [56, 23], RT: [62, 23], Y: [68, 23], Z: [88, 25], QB: [50, 30] },
  "Tank":    { X: [8, 23], LT: [38, 23], LG: [44, 23], C: [50, 23], RG: [56, 23], RT: [62, 23], Y: [68, 23], H: [73, 26], Z: [86, 25], QB: [50, 30], RB: [50, 35] },
  "Bunch":   { X: [6, 23], LT: [38, 23], LG: [44, 23], C: [50, 23], RG: [56, 23], RT: [62, 23], Y: [68, 23], H: [72, 27], Z: [77, 25], QB: [50, 30], RB: [43, 30] },
  "Stack":   { X: [8, 23], H: [9, 27], LT: [38, 23], LG: [44, 23], C: [50, 23], RG: [56, 23], RT: [62, 23], Y: [88, 23], Z: [87, 27], QB: [50, 30], RB: [43, 30] },
  "Nasty":   { X: [26, 23], H: [32, 26], LT: [38, 23], LG: [44, 23], C: [50, 23], RG: [56, 23], RT: [62, 23], Y: [68, 23], Z: [74, 25], QB: [50, 30], RB: [43, 30] },
};
const PLAY_FORM_NAMES = ["Doubles", "Doubles Lt", "Trips Rt", "Trips Lt", "Bunch Rt", "Bunch Lt", "Stack", "Nasty Rt", "Nasty Lt", "Empty", "Tank Rt", "Tank Lt"];

function formSpots(formName) {
  const lt = / Lt$/.test(formName);
  const base = PLAY_FORMS[formName.replace(/ (Rt|Lt)$/, "")] || PLAY_FORMS["Doubles"];
  if (!lt) return base;
  /* Linemen never flip sides, so their labels swap in the mirror.
     X and Z DO flip sides and keep their identity: X is always on the
     line (split end), Z is always off it (flanker). */
  const swap = { LT: "RT", RT: "LT", LG: "RG", RG: "LG" };
  const out = {};
  for (const [k, [x, y]] of Object.entries(base)) out[swap[k] || k] = [100 - x, y];
  return out;
}

/* ---- diagram generators ----
   Elements: block (line+cap), route (arrow), carry (thick red arrow),
   motion (dashed), fake (grey), throw (dotted). All points [x, y]. */
function genPlayElements(conceptKey, spots, dir, tags = []) {
  const s = dir === "Lt" ? -1 : 1;
  const el = {};
  const add = (L, kind, pts) => { if (spots[L]) (el[L] = el[L] || []).push({ kind, pts }); };
  const at = (L) => spots[L];
  const has = (L) => !!spots[L];
  const guards = ["LG", "RG"].filter(has);
  const backG = guards.find((g) => (at(g)[0] - 50) * s < 0);
  const backT = ["LT", "RT"].filter(has).find((t) => (at(t)[0] - 50) * s < 0);
  const edge = 50 + s * 26;

  const blockAll = (skip = []) => {
    for (const L of ["LT", "LG", "C", "RG", "RT"]) if (has(L) && !skip.includes(L)) add(L, "block", [at(L), [at(L)[0] - s * 2, at(L)[1] - 4]]);
    for (const L of ["X", "Z"]) if (has(L) && !skip.includes(L)) add(L, "block", [at(L), [at(L)[0], at(L)[1] - 4]]);
    if (has("Y") && !skip.includes("Y")) add("Y", "block", [at("Y"), [at("Y")[0] - s * 2, at("Y")[1] - 4]]);
  };
  const jetMotion = (thenFake = true) => {
    if (!has("H")) return;
    const [hx, hy] = at("H");
    const across = hx < 50 ? [[hx, hy], [42, 29], [56, 29]] : [[hx, hy], [58, 29], [44, 29]];
    add("H", "motion", across);
    if (thenFake) {
      const last = across[across.length - 1];
      add("H", "fake", [last, [last[0] + (across[0][0] < 50 ? 26 : -26), last[1] - 2]]);
    }
  };
  const qbFake = () => has("QB") && add("QB", "fake", [at("QB"), [at("QB")[0] - 3, at("QB")[1]]]);
  const rbLeak = () => has("RB") && add("RB", "route", [at("RB"), [at("RB")[0] - 8, at("RB")[1] - 3], [at("RB")[0] - 14, at("RB")[1] - 8]]);
  const olPass = () => { for (const L of ["LT", "LG", "C", "RG", "RT"]) if (has(L)) add(L, "block", [at(L), [at(L)[0], at(L)[1] - 3]]); };
  const throwTo = (L, i = 1) => { if (has("QB") && el[L]) { const r = el[L].find((e) => e.kind === "route" || e.kind === "carry"); if (r) add("QB", "throw", [at("QB"), r.pts[Math.min(i, r.pts.length - 1)]]); } };

  /* mirrored route helper: dx is drawn for a LEFT-side player, flipped for right */
  const rt = (L, rel) => {
    if (!has(L)) return;
    const [x, y] = at(L);
    const m = x <= 50 ? 1 : -1;
    add(L, "route", [[x, y], ...rel.map(([dx, dy]) => [x + dx * m, y + dy])]);
  };

  switch (conceptKey) {
    case "power":
      blockAll([backG]);
      add(backG, "carry_path", null);
      el[backG] = [{ kind: "route", pts: [at(backG), [50, 27], [50 + s * 14, 26], [50 + s * 20, 20], [50 + s * 22, 12]] }];
      jetMotion();
      qbFake();
      if (has("RB")) add("RB", "carry", [at("RB"), [50 + s * 4, 29], [50 + s * 17, 22], [50 + s * 19, 8]]);
      break;
    case "trap":
      blockAll([backG]);
      el[backG] = [{ kind: "route", pts: [at(backG), [50, 26], [50 + s * 4, 20], [50 + s * 7, 16]] }];
      if (has("RB")) add("RB", "carry", [at("RB"), [50 + s * 1, 27], [50 + s * 3, 8]]);
      qbFake();
      break;
    case "jet":
      blockAll(["Y", "Z", "X"]);
      if (has("Y")) add("Y", "block", [at("Y"), [at("Y")[0] + s * 5, at("Y")[1] - 7], [at("Y")[0] + s * 7, at("Y")[1] - 12]]);
      if (has(s > 0 ? "Z" : "X")) { const L = s > 0 ? "Z" : "X"; add(L, "block", [at(L), [at(L)[0] - s * 5, at(L)[1] - 5]]); }
      if (has(s > 0 ? "X" : "Z")) { const L = s > 0 ? "X" : "Z"; add(L, "block", [at(L), [at(L)[0], at(L)[1] - 4]]); }
      if (has("H")) {
        const [hx, hy] = at("H");
        const mesh = [50 + s * 2, 29];
        add("H", "motion", hx < 50 ? [[hx, hy], [44, 29], mesh] : [[hx, hy], [56, 29], mesh]);
        add("H", "carry", [mesh, [edge, 25], [edge + s * 8, 18], [edge + s * 10, 8]]);
        /* QB-owned handoff at the mesh; broken mesh = QB keeps on the Raccoon path */
        if (has("QB")) add("QB", "fake", [at("QB"), [mesh[0], mesh[1]]]);
      }
      if (has("RB")) add("RB", "fake", [at("RB"), [50 - s * 6, 27], [50 - s * 10, 22]]);
      break;
    case "keep":
      blockAll();
      jetMotion(false);
      if (has("H")) add("H", "fake", [[52, 29], [edge, 26]]);
      if (has("QB")) add("QB", "carry", [at("QB"), [50 + s * 10, 28], [50 + s * 22, 23], [50 + s * 26, 10]]);
      if (has("RB")) add("RB", "block", [at("RB"), [50 + s * 12, 27]]);
      break;
    case "counter":
      blockAll([backG, backT]);
      el[backG] = [{ kind: "route", pts: [at(backG), [50, 27], [50 + s * 14, 25], [50 + s * 18, 19]] }];
      if (backT) el[backT] = [{ kind: "route", pts: [at(backT), [48, 29], [50 + s * 11, 26], [50 + s * 13, 12]] }];
      if (has("RB")) add("RB", "carry", [at("RB"), [50 - s * 4, 32], [50 + s * 8, 27], [50 + s * 15, 20], [50 + s * 16, 8]]);
      qbFake();
      break;
    case "stretch": {
      /* every blocker leans playside (reach); H's jet motion becomes the lead */
      for (const L of ["LT", "LG", "C", "RG", "RT"]) if (has(L)) add(L, "block", [at(L), [at(L)[0] + s * 2.5, at(L)[1] - 3.5]]);
      if (has("Y")) add("Y", "block", [at("Y"), [at("Y")[0] + s * 4, at("Y")[1] - 3]]);
      if (has(s > 0 ? "Z" : "X")) { const L = s > 0 ? "Z" : "X"; add(L, "block", [at(L), [at(L)[0], at(L)[1] - 4]]); }
      if (has(s > 0 ? "X" : "Z")) { const L = s > 0 ? "X" : "Z"; add(L, "route", [at(L), [at(L)[0] - s * 2, at(L)[1] - 9]]); }
      if (has("H")) {
        const [hx, hy] = at("H");
        const turn = [50 + s * 4, 29];
        add("H", "motion", hx < 50 ? [[hx, hy], [44, 29], turn] : [[hx, hy], [56, 29], turn]);
        add("H", "block", [turn, [edge, 26], [edge + s * 2, 21]]);
      }
      if (has("RB")) add("RB", "carry", [at("RB"), [50 + s * 8, 30], [edge + s * 2, 26], [edge + s * 6, 16], [edge + s * 7, 8]]);
      qbFake();
      break;
    }
    case "sneak":
      blockAll();
      if (has("QB")) add("QB", "carry", [at("QB"), [50, 24], [50, 16]]);
      break;
    case "sparrow":
      olPass();
      rt("X", [[0, -9], [1.5, -7]]);
      rt("Z", [[0, -9], [1.5, -7]]);
      rt("H", [[1, -6], [8, -7]]);
      rt("Y", [[0, -8], [3, -7]]);
      rbLeak();
      throwTo(s > 0 ? "Z" : "X");
      break;
    case "robin":
      olPass();
      rt("X", [[2, -5], [10, -12]]);
      rt("Z", [[2, -5], [10, -12]]);
      rt("H", [[-6, -5], [-12, -7]]);
      rt("Y", [[6, -4], [12, -5]]);
      rbLeak();
      throwTo(s > 0 ? "Y" : "H");
      break;
    case "hawk":
      olPass();
      rt("X", [[0, -10], [2, -8]]);
      rt("Z", [[0, -10], [2, -8]]);
      rt("H", [[-6, -5], [-11, -6]]);
      rt("Y", [[4, -10], [12, -17]]);
      rbLeak();
      throwTo(s > 0 ? "Z" : "X");
      break;
    case "owl":
      blockAll(["Y"]);
      jetMotion();
      qbFake();
      if (has("Y")) add("Y", "carry", [at("Y"), [at("Y")[0] - 1, at("Y")[1] - 11], [at("Y")[0] - 2, 4]]);
      if (has("RB")) add("RB", "fake", [at("RB"), [50 + s * 5, 28], [50 + s * 10, 24]]);
      throwTo("Y");
      break;
    case "falcon":
      olPass();
      rt("X", [[0, -19]]);
      rt("Z", [[0, -19]]);
      rt("H", [[4, -13], [6, -21]]);
      rt("Y", [[-2, -12], [-4, -19]]);
      if (has("RB")) add("RB", "route", [at("RB"), [at("RB")[0] + 3, at("RB")[1] - 6], [at("RB")[0] + 3, at("RB")[1] - 10]]);
      break;
    case "flood": {
      /* sprint-out: line slides with the QB, three levels stacked call-side */
      for (const L of ["LT", "LG", "C", "RG", "RT"]) if (has(L)) add(L, "block", [at(L), [at(L)[0] + s * 1.5, at(L)[1] - 2.5]]);
      const goSide = s > 0 ? "Z" : "X";
      const backSide = s > 0 ? "X" : "Z";
      if (has(goSide)) add(goSide, "route", [at(goSide), [at(goSide)[0], at(goSide)[1] - 19]]);
      if (has(backSide)) add(backSide, "route", [at(backSide), [at(backSide)[0], at(backSide)[1] - 8], [at(backSide)[0] + s * 9, at(backSide)[1] - 15]]);
      if (has("H")) { const [hx, hy] = at("H"); add("H", "route", [[hx, hy], [50 + s * 10, hy - 8], [50 + s * 21, hy - 9]]); }
      if (has("Y")) { const [yx, yy] = at("Y"); add("Y", "route", [[yx, yy], [50 + s * 15, yy - 4], [50 + s * 24, yy - 4]]); }
      if (has("RB")) add("RB", "block", [at("RB"), [50 + s * 12, 29], [50 + s * 17, 26]]);
      if (has("QB")) add("QB", "fake", [at("QB"), [50 + s * 8, 31], [50 + s * 14, 29]]);
      throwTo("H", 2);
      break;
    }
    case "eagle":
      olPass();
      rt("X", [[0, -11], [8, -19]]);
      rt("Z", [[0, -19]]);
      if (has("Y")) add("Y", "route", [at("Y"), [at("Y")[0] - 8, at("Y")[1] - 6], [at("Y")[0] - 28, at("Y")[1] - 8]]);
      if (has("H")) add("H", "block", [at("H"), [at("H")[0], at("H")[1] - 3]]);
      if (has("RB")) add("RB", "block", [at("RB"), [at("RB")[0], at("RB")[1] - 3]]);
      qbFake();
      throwTo(s > 0 ? "Z" : "X");
      break;
    case "bubble": {
      olPass();
      const T = s > 0 ? "Z" : "X";
      const B = s > 0 ? "X" : "Z";
      if (has(T)) add(T, "route", [at(T), [at(T)[0] + s * 4, at(T)[1] + 3], [at(T)[0] + s * 9, at(T)[1] + 1]]);
      if (has(B)) add(B, "block", [at(B), [at(B)[0], at(B)[1] - 4]]);
      if (has("Y")) add("Y", "block", [at("Y"), [at("Y")[0] + s * 3, at("Y")[1] - 5]]);
      jetMotion();
      if (has("RB")) add("RB", "fake", [at("RB"), [50 + s * 4, 28]]);
      throwTo(T, 2);
      break;
    }
    case "slip":
      for (const L of ["LT", "LG"]) if (has(L)) add(L, "block", [at(L), [at(L)[0], at(L)[1] - 3]]);
      for (const L of ["C", "RG", "RT"]) if (has(L)) { add(L, "block", [at(L), [at(L)[0], at(L)[1] - 2]]); add(L, "fake", [[at(L)[0], at(L)[1] - 2], [at(L)[0] + s * 5, at(L)[1] - 7]]); }
      for (const L of ["X", "Z"]) if (has(L)) add(L, "fake", [at(L), [at(L)[0], at(L)[1] - 16]]);
      if (has("Y")) add("Y", "fake", [at("Y"), [at("Y")[0], at("Y")[1] - 12]]);
      if (has("QB")) add("QB", "fake", [at("QB"), [at("QB")[0] - s * 3, at("QB")[1] + 4]]);
      if (has("RB")) add("RB", "route", [at("RB"), [at("RB")[0] + s * 5, at("RB")[1] + 2], [50 + s * 12, 27], [50 + s * 16, 22]]);
      throwTo("RB", 2);
      break;
    case "reverse": {
      /* Rewind Rt: full Rocket fake LEFT, backside WR brings it back RIGHT */
      blockAll(["X", "Z"]);
      if (has("H")) {
        const [hx, hy] = at("H");
        add("H", "motion", hx * -s < 50 * -s ? [[hx, hy], [44, 29], [52, 29]] : [[hx, hy], [56, 29], [50, 29]]);
        add("H", "fake", [[50, 29], [50 - s * 22, 26]]);
      }
      const R = s > 0 ? "X" : "Z";
      const F = s > 0 ? "Z" : "X";
      if (has(R)) add(R, "carry", [at(R), [at(R)[0] + s * 10, at(R)[1] + 6], [46, 32], [50 + s * 16, 29], [edge + s * 6, 22], [edge + s * 8, 8]]);
      if (has(F)) add(F, "block", [at(F), [at(F)[0] - s * 4, at(F)[1] - 5]]);
      if (has("Y")) add("Y", "block", [at("Y"), [at("Y")[0] + s * 4, at("Y")[1] - 7]]);
      if (has("RB")) add("RB", "fake", [at("RB"), [50 - s * 8, 27]]);
      qbFake();
      break;
    }
    case "blank":
      break;
    default:
      break;
  }

  /* ---- tags: composable modifiers ---- */
  if (tags.includes("Jet") && has("H") && !["jet", "keep", "reverse"].includes(conceptKey)) {
    const [hx, hy] = at("H");
    const toRight = hx <= 50;
    el["H"] = [
      { kind: "motion", pts: toRight ? [[hx, hy], [44, 29], [56, 29]] : [[hx, hy], [56, 29], [44, 29]] },
      { kind: "fake", pts: toRight ? [[56, 29], [80, 27]] : [[44, 29], [20, 27]] },
    ];
  }
  if (tags.includes("Orbit") && has("RB")) {
    const [rx, ry] = at("RB");
    const m = rx <= 50 ? 1 : -1;
    el["RB"] = [
      { kind: "motion", pts: [[rx, ry], [50, ry + 4], [50 + m * 10, ry + 3], [50 + m * 16, ry - 1]] },
      { kind: "fake", pts: [[50 + m * 16, ry - 1], [50 + m * 27, ry - 4]] },
    ];
  }
  if (tags.includes("Zip") && has("Z")) {
    const [zx, zy] = at("Z");
    const m = zx <= 50 ? 1 : -1;
    const dx = m * 13;
    const cur = el["Z"] || [];
    el["Z"] = [
      { kind: "motion", pts: [[zx, zy], [zx + dx, zy + 1]] },
      ...cur.map((e) => ({ ...e, pts: e.pts.map(([x, y]) => [x + dx, y + 1]) })),
    ];
  }
  if (tags.includes("Now") && has("H")) {
    /* RPO bubble attached: H bubbles his side instead of jet motion, QB reads */
    const [hx, hy] = at("H");
    const m = hx <= 50 ? -1 : 1;
    el["H"] = [{ kind: "route", pts: [[hx, hy], [hx + m * 4, hy + 3], [hx + m * 10, hy + 1]] }];
    if (has("QB")) add("QB", "throw", [at("QB"), [hx + m * 8, hy + 2]]);
  }
  if (tags.includes("Wheel") && has("RB")) {
    const [rx, ry] = at("RB");
    el["RB"] = [{ kind: "route", pts: [[rx, ry], [rx - s * 10, ry + 2], [rx - s * 20, ry - 4], [rx - s * 22, ry - 16]] }];
  }
  if (tags.includes("Peek") && has("Y")) {
    /* Owl alive on a run call: Y slips to the seam, QB throws only if the backers bite */
    const [yx, yy] = at("Y");
    const bend = yx <= 50 ? 3 : -3;
    el["Y"] = [{ kind: "route", pts: [[yx, yy], [yx, yy - 4], [yx + bend, yy - 14]] }];
    if (has("QB")) add("QB", "throw", [at("QB"), [yx + bend * 0.7, yy - 11]]);
  }
  if (tags.includes("Max")) {
    if (has("H") && !tags.includes("Now")) el["H"] = [{ kind: "block", pts: [at("H"), [at("H")[0], at("H")[1] - 3]] }];
    if (has("RB") && !tags.includes("Wheel")) el["RB"] = [{ kind: "block", pts: [at("RB"), [at("RB")[0], at("RB")[1] - 3]] }];
  }
  return el;
}

/* ---- the dictionary ---- */
const CONCEPTS = {
  power:   { fam: "Run",    dirs: ["Rt", "Lt"], words: { Rt: "Rhino", Lt: "Lion" }, carrier: "RB", signal: "Fist to the nose like a horn, then point", how: "Playside blocks down, backside guard pulls and leads. RB downhill off the edge of the double team. Jet motion dresses it up.", read: "None. This is the hammer." },
  trap:    { fam: "Run",    dirs: ["Rt", "Lt"], words: { Rt: "Rabbit", Lt: "Lynx" }, carrier: "RB", signal: "Two-finger bunny hops, then point", how: "Quick hitter. Backside guard traps the first man past center. No motion: this is the changeup that punishes upfield tackles.", read: "None. Hits before they blink." },
  jet:     { fam: "Run",    dirs: ["Rt", "Lt"], words: { Rt: "Rocket", Lt: "Laser" }, carrier: "H", signal: "Arm launches off the palm, then point", how: "H sprints off motion and NEVER slows: he makes a basket and the QB presses the ball into it. The QB owns the exchange completely; if the mesh feels wrong he keeps it and runs the Raccoon path. Playside reaches, Y arcs to the safety. From Doubles, Laser is a return motion; rep it, or call it from Doubles Lt for the natural cross.", read: "None. Speed to the edge." },
  keep:    { fam: "Run",    dirs: ["Rt", "Lt"], words: { Rt: "Raccoon", Lt: "Longhorn" }, carrier: "QB", signal: "Wash the paws, then point", how: "Identical picture to the jet. QB keeps behind the chase with the RB leading. Call it AFTER Rocket has scared them.", read: "Pre-called. The defense pays for chasing Rocket." },
  counter: { fam: "Run",    dirs: ["Rt", "Lt"], words: { Rt: "Renegade", Lt: "Lizard" }, carrier: "RB", signal: "Cross the forearms, then point", how: "Backside guard kicks, backside tackle wraps, RB jabs away then hits behind them. Week 6 install, once they fear Rhino.", read: "None. Patience, then burst." },
  stretch: { fam: "Run",    dirs: ["Rt", "Lt"], words: { Rt: "Ram", Lt: "Leopard" }, carrier: "RB", signal: "Head-butt the horns, then point", how: "The answer when they attack our down blocks downhill. Everybody reaches and RUNS, H's jet motion becomes the lead block, RB takes the wide give and cuts when he sees grass. Downhill linebackers seal themselves.", read: "None. Race them to the edge." },
  sneak:   { fam: "Run",    dirs: [""],         words: { "": "Moose" }, carrier: "QB", signal: "Flat hand dives under", how: "QB sneak behind the big center. Short yardage answer.", read: "None." },
  sparrow: { fam: "Pass",   dirs: [""],         words: { "": "Sparrow" }, carrier: "WR", signal: "Pinch fingers, small bird", how: "Hitches outside, quick outs from the slots, Y sticks at 5. Ball out now. Against press, the pressed hitch automatically becomes a GO.", read: "Pick the widest cushion before the snap and throw it on rhythm. No cushion anywhere means they pressed: throw the GO over the presser or take Y at 5." },
  robin:   { fam: "Pass",   dirs: [""],         words: { "": "Robin" }, carrier: "WR", signal: "Flap the elbows", how: "Slants outside, arrows to the flats. The 6th grade money concept.", read: "Flat first. Covered means the slant is open behind it." },
  hawk:    { fam: "Pass",   dirs: [""],         words: { "": "Hawk" }, carrier: "WR", signal: "One arm soars", how: "Curls at 8 outside, flats underneath, Y to the corner.", read: "Watch the man over the slot: chases the flat, throw the curl; sits, throw the flat." },
  owl:     { fam: "Pass",   dirs: [""],         words: { "": "Owl" }, carrier: "Y", signal: "Circles over the eyes", how: "Everyone sells Rhino. Y slips into the seam behind the linebackers. QB fakes and pops it over their heads.", read: "Fake, find Y, throw it now. Covered? Tuck it and run the Rhino path. The most unfair play we own." },
  falcon:  { fam: "Pass",   dirs: [""],         words: { "": "Falcon" }, carrier: "WR", signal: "Both arms soar", how: "Four verticals, slots bend to the seams, RB checks down.", read: "Coach picks the target before the snap." },
  flood:   { fam: "Pass",   dirs: ["Rt", "Lt"], words: { Rt: "Raven", Lt: "Lark" }, carrier: "WR", signal: "Wing out flat, run the fingers sideways, then point", how: "Sprint-out flood: QB moves the launch point to the call side with the RB leading. Three levels stacked in front of him: go to clear it, deep out at 10, flat at 4. Half the field, one look at a time, and his legs are the third answer.", read: "Deep out first. Covered? Flat. Both covered? RUN for the sticks and get down or get out of bounds." },
  eagle:   { fam: "Pass",   dirs: [""],         words: { "": "Eagle" }, carrier: "WR", signal: "Full wingspan flex", how: "The shot. Post and go outside, Y drags underneath, H and RB stay in to protect seven strong.", read: "One look deep for two seconds, then take the drag." },
  bubble:  { fam: "Screen", dirs: ["Rt", "Lt"], words: { Rt: "Reese's", Lt: "Laffy" }, carrier: "WR", signal: "Rub the belly, then point", how: "Called-side outside WR bubbles behind the jet fake, Y and the backside crack down.", read: "Catch and throw now. Pressed over the bubble? MIRROR it the other way before the snap. Free yards when they chase the jet." },
  slip:    { fam: "Screen", dirs: ["Rt", "Lt"], words: { Rt: "Rolo", Lt: "Lifesaver" }, carrier: "RB", signal: "Take a big bite, then point", how: "QB drifts, the line lets the rush through and releases, RB slips out behind it.", read: "Let the rush come, then dump it over their heads." },
  reverse: { fam: "Special", dirs: ["Rt", "Lt"], words: { Rt: "Rewind", Lt: "Loop" }, carrier: "WR", signal: "Spin a finger backward, then point", how: "Full Rocket fake one way, backside WR takes it back the other way behind everyone chasing. Once a game, when they start flying to the jet.", read: "None. Sell the fake, hand it deep." },
  blank:   { fam: "Special", dirs: [""],         words: { "": "Custom" }, carrier: null, signal: "Your call", how: "A blank canvas. Use Customize to draw every path yourself.", read: "Your design." },
};
/* ---- line calls: the O-line's own channel, spoken first ---- */
const LINE_CALLS = { power: "HAMMER", owl: "HAMMER", trap: "TRAP", counter: "WRAP", jet: "REACH", keep: "REACH", stretch: "REACH", reverse: "REACH", sneak: "SURGE", sparrow: "QUICK", robin: "QUICK", bubble: "QUICK", hawk: "WALL", falcon: "WALL", eagle: "WALL", flood: "WALL", slip: "GATE" };
const LINE_WORDS = ["HAMMER", "TRAP", "WRAP", "REACH", "SURGE", "QUICK", "WALL", "GATE"];
const lineCallFor = (p) => (p && (p.lineCall || LINE_CALLS[p.concept])) || "";

const callWord = (c, dir, tags = []) => {
  const base = CONCEPTS[c] ? CONCEPTS[c].words[dir || ""] || CONCEPTS[c].words.Rt : "";
  return tags.length ? `${base} ${tags.join(" ")}` : base;
};
const playCarrier = (p) => {
  const c = CONCEPTS[p.concept];
  if (!c) return null;
  if (p.concept === "bubble") return p.dir === "Lt" ? "X" : "Z";
  if (p.concept === "reverse") return p.dir === "Lt" ? "Z" : "X";
  if ((p.tags || []).includes("Now")) return c.carrier + " / H";
  if ((p.tags || []).includes("Peek")) return c.carrier + " / Y";
  return c.carrier;
};

/* ---- kid-language jobs: what each position does on every concept ---- */
const ASSIGNMENTS = {
  power:   { OL: "Playside blocks down. Backside guard pulls and leads through the hole. Backside tackle steps DOWN first and walls the man over the pulled guard, then hinges on any chaser.", QB: "Open playside, hand it deep, fake the keep after.", RB: "Downhill off Y's hip. Follow the pulling guard.", H: "Jet motion full speed. Sell it like you have the ball.", Y: "Block down hard. You are the edge of the wall.", XZ: "Block the man over you." },
  trap:    { OL: "Center and playside block down. Backside guard traps the first man past center.", QB: "Quick handoff, then fake a rollout.", RB: "One step, hit the A gap NOW. It will be open.", H: "Stay wide, block your man.", Y: "Climb to the linebacker.", XZ: "Block the man over you." },
  jet:     { OL: "Everybody reach playside and run.", QB: "YOU own the ball. Press it into H's basket as he crosses. If the mesh feels wrong, keep it and run the Raccoon path. Never chase him with the ball.", RB: "Fake the power away. Sell it.", H: "Make a basket, NEVER slow down, squeeze when you feel it. Your only job is speed.", Y: "Arc release, go find the safety.", XZ: "Playside walls off inside: get in the way, stay high, no kill shots. Backside blocks his man." },
  keep:    { OL: "Reach playside just like Rocket.", QB: "Fake the flip, tuck it, follow the RB around the edge. Score or get down: never take the second hit.", RB: "Lead through the edge, block the first color you see.", H: "Motion full speed, fake it, keep sprinting.", Y: "Arc to the safety.", XZ: "Block the man over you." },
  stretch: { OL: "Reach playside and RUN. Cover him up, stay on your feet, do not win a wrestling match.", QB: "Open playside, hand it WIDE to the RB, fake the keep after.", RB: "Take it flat, race to the numbers, one cut upfield the moment you see grass. No grass at the numbers? Plant and slam it NORTH inside: their whole defense just overran you.", H: "Jet motion full speed, but this one is not yours: turn up at the edge and lead. Block the first color outside Y.", Y: "Reach the end and run him where he wants to go. The RB cuts off your butt.", XZ: "Playside stalks the corner. Backside sprints his man deep and away." },
  counter: { OL: "Playside blocks down and seals anyone chasing the pullers. Backside guard kicks, backside tackle wraps and leads. Center walls the backside A gap behind them.", QB: "Open away first, then hand it back.", RB: "Jab step away, be patient, then hit it behind the wrappers.", H: "Jet motion away. Sell it.", Y: "Block down hard.", XZ: "Block the man over you." },
  sneak:   { OL: "Fire out low. One yard war.", QB: "Snap and surge behind the center. Two hands on the ball.", RB: "Push the pile.", H: "Get big, wall off.", Y: "Get big, wall off.", XZ: "Block the man over you." },
  sparrow: { OL: "Set and punch. Ball is out fast.", QB: "Pick the widest cushion before the snap. Catch, throw, done.", RB: "Check the rush, leak to the flat.", H: "Quick out at 4.", Y: "Stick at 5, sit in the window.", XZ: "Hitch at 5. Turn around, show your numbers. Pressed? Nod and GO: your hitch just became a fly route." },
  robin:   { OL: "Set and punch. Ball out quick.", QB: "Flat first. If he jumps it, the slant is behind him.", RB: "Check, leak to the flat.", H: "Arrow to the flat right now.", Y: "Flat.", XZ: "Slant. Three steps, cut across his face." },
  hawk:    { OL: "Real pass set. Stay square.", QB: "Man over the slot chases the flat: throw curl. He sits: throw flat.", RB: "Check, leak.", H: "Flat.", Y: "Corner at 8.", XZ: "Push to 8, snap around. Curl." },
  owl:     { OL: "Block Rhino. Make it look exactly the same.", QB: "Fake Rhino big, pop it to Y over their heads. Covered? Tuck and run the Rhino path: your line is already run blocking.", RB: "Fake Rhino, run angry without the ball.", H: "Jet motion, sell it.", Y: "Sell the block one count, slip behind the linebackers, eyes up fast.", XZ: "Block like it's a run." },
  falcon:  { OL: "Best pass set of the day. Give him time.", QB: "Coach picks the target before the snap. Trust it.", RB: "Checkdown at 5.", H: "Seam.", Y: "Seam.", XZ: "Go. Run through his shoulder." },
  flood:   { OL: "Pass set, then slide with the QB. He is moving; move with him. Nobody crosses your face.", QB: "Sprint to the call, shoulders square so you can still throw. Deep out, then flat, then RUN. First down, then down or out of bounds.", RB: "You are his bodyguard. Lead the sprint and block the first color off the edge.", H: "Cross to the call side, deep out at 10. Snap your head around fast.", Y: "Flat at 4 on the call side. Be his easy answer.", XZ: "Called side runs the GO to pull the top off. Backside runs the post: stay alive, he might find you." },
  eagle:   { OL: "Max protect. Nobody touches him.", QB: "One look deep for two counts, then take the drag.", RB: "Block first. Always.", H: "Stay in and block. You are the bodyguard.", Y: "Drag at 10. Be the answer.", XZ: "X runs the post. Z runs the go." },
  bubble:  { OL: "Set and punch. Do not go downfield.", QB: "Catch and throw it NOW.", RB: "Fake.", H: "Jet motion, sell it.", Y: "Wall the first defender inside: get in his way, stay high.", XZ: "Called side bubbles back and out. Other side blocks his man." },
  slip:    { OL: "Block one count, let them through, release flat.", QB: "Drift back, let them come, dump it over their heads.", RB: "Let the rush go by, slip out behind them, eyes up fast.", H: "Run your man off deep.", Y: "Run him off.", XZ: "Run them off deep." },
  reverse: { OL: "Reach like Rocket, then wall off.", QB: "Fake to H, then YOU own the second exchange too: press it deep into the reverse man's basket.", RB: "Fake away.", H: "Full Rocket fake. Best acting on the team.", Y: "Arc, find the safety.", XZ: "Backside man comes around deep, makes a basket, and sprints. Called side blocks down." },
  blank:   { OL: "Coach draws it. Know your line on the picture.", QB: "Coach draws it. Know your path.", RB: "Coach draws it. Know your path.", H: "Coach draws it. Know your path.", Y: "Coach draws it. Know your path.", XZ: "Coach draws it. Know your path." },
};
const JOB_GROUPS = [["OL", "O-Line"], ["QB", "Quarterback"], ["RB", "Running Back"], ["H", "H (Slot)"], ["Y", "Y (Tight End)"], ["XZ", "X and Z (Outside)"]];
const jobKeyFor = (label) => (["LT", "LG", "C", "RG", "RT"].includes(label) ? "OL" : label === "X" || label === "Z" ? "XZ" : label);

/* ---- seeded Safari playbook ---- */
function mkSeedPlay(num, formation, concept, dir, core, week, tags) {
  return {
    id: uid(), num, formation, concept, dir: dir || "", tags: tags || [], core: !!core, week,
    name: `${formation} · ${callWord(concept, dir, tags || [])}`,
    type: CONCEPTS[concept].fam === "Screen" ? "Screen" : CONCEPTS[concept].fam,
    note: "",
  };
}
function safariSeedPlaysV2() {
  const mk = mkSeedPlay;
  return [
    mk(25, "Bunch Rt", "robin", "", false, 5), mk(26, "Bunch Lt", "robin", "", false, 5),
    mk(27, "Nasty Rt", "power", "Rt", false, 5), mk(28, "Nasty Lt", "power", "Lt", false, 5),
    mk(29, "Stack", "falcon", "", false, 5),
    mk(30, "Doubles", "keep", "Rt", false, 5, ["Orbit"]),
  ];
}
/* v4 looks: speed in space. Same words the kids already know, new costumes. */
function safariSeedPlaysV3() {
  const mk = mkSeedPlay;
  const note = (p, n) => ({ ...p, note: n });
  return [
    note(mk(31, "Tank Rt", "owl", "", false, 4), "Goal line. Fake the Tank Rhino they're selling out to stop, pop it to Y. Save it for six."),
    note(mk(32, "Doubles Lt", "jet", "Lt", false, 2), "H aligns right in Doubles Lt, so this is his natural full-speed cross. Use this Laser if the return motion from Doubles is ugly."),
    note(mk(33, "Bunch Rt", "bubble", "Rt", false, 5), "Bubble behind the bunch wall. Three blockers in a phone booth, ball outside them."),
    note(mk(34, "Bunch Lt", "bubble", "Lt", false, 5), "Bubble behind the bunch wall, left."),
    note(mk(35, "Nasty Rt", "jet", "Rt", false, 5), "Condensed splits pull the defense inside, jet outruns everything to the open edge."),
    note(mk(36, "Nasty Lt", "jet", "Lt", false, 5), "Condensed splits, jet to the open left edge."),
    note(mk(37, "Stack", "robin", "", false, 5), "Slant-flat off stacked releases. The rub is legal because it's a natural release."),
    note(mk(38, "Trips Rt", "jet", "Lt", false, 5), "Jet WEAK, away from trips. They shift to the numbers, H outruns the short side."),
    note(mk(39, "Trips Lt", "jet", "Rt", false, 5), "Jet weak to the right, away from trips."),
    note(mk(40, "Empty", "sparrow", "", false, 6), "Five out, ball out now. The check when they load the box late in the season."),
  ];
}
/* v5: the reach answer. When a coordinator keys our down blocks and comes
   downhill, everybody reaches and the RB races them to the edge. */
function safariSeedPlaysV4() {
  const mk = mkSeedPlay;
  const note = (p, n) => ({ ...p, note: n });
  return [
    note(mk(41, "Doubles", "stretch", "Rt", false, 3), "The counterpunch when they attack our down blocks. Same REACH the line knows from Rocket; H leads instead of taking it."),
    note(mk(42, "Doubles", "stretch", "Lt", false, 3), "Reach left. Downhill linebackers seal themselves."),
  ];
}
/* v6: more costumes for the plays that win. Options for the call sheet, not the kids. */
function safariSeedPlaysV5() {
  const mk = mkSeedPlay;
  const note = (p, n) => ({ ...p, note: n });
  return [
    note(mk(43, "Bunch Rt", "jet", "Rt", false, 5), "Jet into the bunch: three blockers in a phone booth and the fastest kid outside them."),
    note(mk(44, "Bunch Lt", "jet", "Lt", false, 5), "Jet into the bunch, left."),
    note(mk(45, "Nasty Rt", "stretch", "Rt", false, 5), "Reach from condensed splits. They pinch inside, RB has the whole field."),
    note(mk(46, "Nasty Lt", "stretch", "Lt", false, 5), "Nasty reach, left."),
    note(mk(47, "Tank Rt", "stretch", "Rt", false, 4), "The heavy sweep. They load the middle for Tank Rhino, we go around the pile."),
    note(mk(48, "Tank Lt", "stretch", "Lt", false, 4), "Heavy sweep, left."),
    note(mk(49, "Trips Rt", "power", "Rt", false, 3), "Power at a box that emptied chasing three receivers. When they match trips, run right at what's left."),
    note(mk(50, "Trips Lt", "power", "Lt", false, 3), "Trips power, left."),
  ];
}
/* v7: the QB tree. Sprint-out floods (his legs are the third answer) and the
   Empty quick menu, so five-out is never just two options. */
function safariSeedPlaysV6() {
  const mk = mkSeedPlay;
  const note = (p, n) => ({ ...p, note: n });
  return [
    note(mk(51, "Doubles", "flood", "Rt", false, 4), "Sprint-out flood. Half the field, one look at a time, and running for the sticks is always allowed."),
    note(mk(52, "Doubles", "flood", "Lt", false, 4), "Sprint-out flood, left."),
    note(mk(53, "Trips Rt", "flood", "Rt", false, 4), "Flood into trips: the three levels are already aligned. The easiest completion in the book."),
    note(mk(54, "Trips Lt", "flood", "Lt", false, 4), "Trips flood, left."),
    note(mk(55, "Doubles", "hawk", "", false, 3), "The curl-flat read from home base, not just Trips."),
    note(mk(56, "Empty", "robin", "", false, 6), "Slant-flat from five out. The backers can't hide."),
    note(mk(57, "Empty", "bubble", "Rt", false, 6), "Empty bubble right: numbers were counted before the snap."),
    note(mk(58, "Empty", "bubble", "Lt", false, 6), "Empty bubble, left."),
  ];
}
function safariSeedPlays() {
  const mk = mkSeedPlay;
  return [
    mk(1, "Doubles", "power", "Rt", true, 1), mk(2, "Doubles", "power", "Lt", true, 1),
    mk(3, "Doubles", "jet", "Rt", true, 2), mk(4, "Doubles", "jet", "Lt", true, 2),
    mk(5, "Doubles", "keep", "Rt", true, 2), mk(6, "Doubles", "keep", "Lt", true, 2),
    mk(7, "Doubles", "owl", "", true, 2),
    mk(8, "Doubles", "bubble", "Rt", true, 3), mk(9, "Doubles", "bubble", "Lt", true, 3),
    mk(10, "Doubles", "sparrow", "", true, 1),
    mk(11, "Doubles", "robin", "", false, 3),
    mk(12, "Trips Rt", "hawk", "", false, 3), mk(13, "Trips Lt", "hawk", "", false, 3),
    mk(14, "Doubles", "trap", "Rt", false, 3), mk(15, "Doubles", "trap", "Lt", false, 3),
    mk(16, "Doubles", "falcon", "", false, 4),
    mk(17, "Doubles", "eagle", "", false, 4),
    mk(18, "Doubles", "slip", "Rt", false, 4), mk(19, "Doubles", "slip", "Lt", false, 4),
    mk(20, "Tank Rt", "power", "Rt", false, 4), mk(21, "Tank Lt", "power", "Lt", false, 4),
    mk(22, "Tank Rt", "sneak", "", false, 4),
    mk(23, "Doubles", "counter", "Rt", false, 6), mk(24, "Doubles", "counter", "Lt", false, 6),
  ];
}


const RAW_SEED = {
  players: [
    { id: uid(), name: "Sample Player", num: "7", offPos: "QB", defPos: "SAFETY" },
  ],
  drills: [
    /* ---- WARMUP ---- */
    { id: uid(), name: "Dynamic Warmup & Stretch", cat: "Warmup", group: "All", mins: 10, notes: "High knees, karaoke, lunges, leg swings. Captains lead, coaches walk the lines." },
    { id: uid(), name: "Form Running Buildups", cat: "Warmup", group: "All", mins: 5, notes: "Two each at 10, 20, 30 yds building to 75%. Arm drive, knees up, run through the line." },
    { id: uid(), name: "Agility Ladder Quick Feet", cat: "Warmup", group: "All", mins: 8, notes: "Two ladders, two lines. In-in-out-out, icky shuffle, single foot hops. Eyes up." },
    { id: uid(), name: "Stance & Takeoff", cat: "Warmup", group: "All", mins: 5, notes: "Position stance, 5 yd burst on cadence. Kill the false step." },
    { id: uid(), name: "Pat & Go", cat: "Warmup", group: "Skill (QB/RB/WR/TE)", mins: 8, notes: "Lines on both hashes, QBs throw 15 yd rails. Warm arms and hands, jog it back." },
    { id: uid(), name: "5-10-5 Shuttles", cat: "Warmup", group: "All", mins: 5, notes: "Change of direction. Touch the line, stay low, no rounded turns." },

    /* ---- TACKLING ---- */
    { id: uid(), name: "Angle Tackle Fit", cat: "Individual", group: "Defense", mins: 10, notes: "Fit, wrap, drive five steps. Eyes up, head across the front. Thud, never to the ground." },
    { id: uid(), name: "Hawk Roll Tackle", cat: "Individual", group: "Defense", mins: 10, notes: "Shoulder leverage tackle, wrap and roll. Mats or soft grass. Head out every rep." },
    { id: uid(), name: "Open Field Tackle", cat: "Individual", group: "Defense", mins: 10, notes: "10 yd box, breakdown, near foot near shoulder. Thud finish, no lunging." },
    { id: uid(), name: "Sideline Tackle", cat: "Individual", group: "Defense", mins: 8, notes: "Use the sideline as the 12th defender. Leverage inside-out, run him out or wrap." },
    { id: uid(), name: "Pursuit Angles", cat: "Individual", group: "Defense", mins: 8, notes: "Coach points, sprint to the cutoff cone. Take the angle, never chase from behind." },
    { id: uid(), name: "Tackle Ring Rolls", cat: "Individual", group: "Defense", mins: 8, notes: "Chase the rolling ring, wrap and roll through. Perfect for no-pads days." },

    /* ---- BLOCK DESTRUCTION ---- */
    { id: uid(), name: "Strike & Shed", cat: "Individual", group: "Defense", mins: 8, notes: "Six points to fit to full speed. Hands inside, thumbs up, extend, rip and replace." },
    { id: uid(), name: "Rip & Swim Escapes", cat: "Individual", group: "DL", mins: 8, notes: "Vs bag holder. Violent get-off, tight rip through the hip. Swim stays low." },
    { id: uid(), name: "Get-Off on Ball Movement", cat: "Individual", group: "DL", mins: 5, notes: "Move on the ball, not the voice. First step wins the rep." },

    /* ---- OL ---- */
    { id: uid(), name: "OL Stance & First Steps", cat: "Individual", group: "OL", mins: 8, notes: "Three point, flat back, no rocking. Drive, reach, and pull steps on cadence." },
    { id: uid(), name: "Fit & Drive Boards", cat: "Individual", group: "OL", mins: 10, notes: "Fit on a partner, drive him down the board. Pad under pad, feet like pistons." },
    { id: uid(), name: "Chutes & Duck Walks", cat: "Individual", group: "OL", mins: 6, notes: "Pad level day. Flat back under the chute, hands loaded." },
    { id: uid(), name: "Pass Pro Kick & Mirror", cat: "Individual", group: "OL", mins: 10, notes: "Kick slide, stay square, mirror his numbers. Punch and reset, never lunge." },
    { id: uid(), name: "Pull & Kickout", cat: "Individual", group: "OL", mins: 10, notes: "Guards pull flat down the line, kick out the end man. This is Power and Trap." },
    { id: uid(), name: "Double Team Combo", cat: "Individual", group: "OL", mins: 10, notes: "Hip to hip, four hands on him, eyes on the backer. Climb late, not early." },
    { id: uid(), name: "Down Block Angles", cat: "Individual", group: "OL", mins: 8, notes: "Wash him down the line, head playside. Do not get pushed upfield." },
    { id: uid(), name: "Snap & Steps", cat: "Individual", group: "OL", mins: 6, notes: "Center and QB exchange while the whole line steps the play call." },
    { id: uid(), name: "OL vs DL 1-on-1 Pass Rush", cat: "Group", group: "OL/DL", mins: 10, notes: "Cone box, best on best. Coach the win and the loss on every rep. Pairs with 7-on-7." },

    /* ---- QB ---- */
    { id: uid(), name: "QB Drops & Footwork", cat: "Individual", group: "QB", mins: 8, notes: "Three and five step drops off the snap. Two hands on the ball, eyes downfield." },
    { id: uid(), name: "Handoff Mesh Circuit", cat: "Individual", group: "QB", mins: 8, notes: "Mesh with every back, both directions. Look it in, then carry out the fake." },
    { id: uid(), name: "Boot & Play-Action Fakes", cat: "Individual", group: "QB", mins: 8, notes: "Sell it with eyes and shoulders. Snap the head around late on the boot." },
    { id: uid(), name: "Throw on the Run", cat: "Individual", group: "QB", mins: 8, notes: "Sprint out both ways. Shoulders level, step at the target, no arm-only throws." },
    { id: uid(), name: "Accuracy Targets", cat: "Individual", group: "QB", mins: 8, notes: "Nets or hands at 8, 12, 18 yds. Keep score, loser picks up cones." },

    /* ---- RB ---- */
    { id: uid(), name: "Ball Security Gauntlet", cat: "Individual", group: "RB", mins: 8, notes: "High and tight, five points of pressure, two hands in traffic. A drop restarts the line." },
    { id: uid(), name: "Bags & Burst", cat: "Individual", group: "RB", mins: 8, notes: "Quick feet through the bags, plant, burst 10 yds. One cut, then north." },
    { id: uid(), name: "Make-a-Miss in Space", cat: "Individual", group: "RB", mins: 8, notes: "One move max, jump cut or spin, then get vertical. Dancing loses yards." },
    { id: uid(), name: "Blitz Pickup Fit", cat: "Individual", group: "RB", mins: 8, notes: "Scan inside out, wide base, fit low. Thud only, protect the QB." },
    { id: uid(), name: "Finish Runs", cat: "Individual", group: "RB", mins: 6, notes: "Run through hand shields the last five yards. Fall forward, cover the ball." },

    /* ---- WR / TE ---- */
    { id: uid(), name: "Routes on Air", cat: "Individual", group: "Skill (QB/RB/WR/TE)", mins: 10, notes: "Full route tree with QBs, both hashes. Burst out of the break, tuck and get five upfield." },
    { id: uid(), name: "Catch Circuit", cat: "Individual", group: "WR/TE", mins: 10, notes: "High point, over the shoulder, sideline toe tap, low ball. Eyes follow it into the tuck." },
    { id: uid(), name: "Releases vs Press", cat: "Individual", group: "WR/TE", mins: 8, notes: "Foot fire, swipe the hands, stack on top. Air first, then a partner." },
    { id: uid(), name: "Stalk Blocking", cat: "Individual", group: "WR/TE", mins: 8, notes: "Break down, mirror, hands inside the frame. Sweeps score when receivers block." },
    { id: uid(), name: "Distraction Catches", cat: "Individual", group: "WR/TE", mins: 6, notes: "Tennis balls, waving hands, late looks. Train the eyes through traffic." },
    { id: uid(), name: "TE Base & Arc Release", cat: "Individual", group: "WR/TE", mins: 8, notes: "Base block the end man, then arc release reps. Know both jobs cold." },

    /* ---- LB / DB ---- */
    { id: uid(), name: "Pedal & Break", cat: "Individual", group: "DB", mins: 8, notes: "Backpedal, T-step plant, drive on the point. No false steps, no standing up." },
    { id: uid(), name: "W Drill", cat: "Individual", group: "DB", mins: 8, notes: "Pedal, break, pedal on the W cones. Hips down, eyes on the coach the whole way." },
    { id: uid(), name: "LB Read Steps", cat: "Individual", group: "LB", mins: 8, notes: "High hat pass, low hat run. Downhill fill on run, wall off on pass." },
    { id: uid(), name: "Scrape & Fill", cat: "Individual", group: "LB", mins: 8, notes: "Flow over the trash, square up in the gap, thud fit on the back." },
    { id: uid(), name: "Man Coverage Mirror", cat: "Individual", group: "LB/DB", mins: 8, notes: "Shadow the receiver in a 5 yd lane. Stay in phase, hands off jerseys." },
    { id: uid(), name: "Zone Drops & Landmarks", cat: "Individual", group: "LB/DB", mins: 8, notes: "Drop to curl, flat, and hook spots. Eyes on the QB, break on the throw." },
    { id: uid(), name: "Turn & Find the Ball", cat: "Individual", group: "DB", mins: 8, notes: "Locate, yell BALL, high point at its highest, return up the sideline." },
    { id: uid(), name: "Strip & Scoop Circuit", cat: "Individual", group: "Defense", mins: 8, notes: "First man wraps, second man punches. Scoop it clean and score." },

    /* ---- GROUP PERIODS ---- */
    { id: uid(), name: "Inside Run (O vs D)", cat: "Group", group: "Bigs + Backs", mins: 15, notes: "OL, DL, QB, RB, LB. Script 10 each side at thud. Pair with WR vs DB in the same period." },
    { id: uid(), name: "WR vs DB 1-on-1s", cat: "Group", group: "WR vs DB", mins: 15, notes: "Press and off looks, QBs alternate. Runs opposite Inside Run every week." },
    { id: uid(), name: "7-on-7 Skelly", cat: "Group", group: "Skill + LB/DB", mins: 15, notes: "Script routes vs base coverage. Linemen run 1-on-1 pass rush in the same period." },
    { id: uid(), name: "Half-Line Run Fits", cat: "Group", group: "All", mins: 12, notes: "Split the field, double the reps. Thud tempo, coach one gap at a time." },
    { id: uid(), name: "Perimeter Drill", cat: "Group", group: "All", mins: 12, notes: "Toss and sweep crew vs force players. Stalk blocks, corner sets the edge." },
    { id: uid(), name: "Blitz Pickup Period", cat: "Group", group: "Offense", mins: 10, notes: "OL and RB vs scout pressure off cards. ID the Mike out loud every snap." },
    { id: uid(), name: "Screen Period", cat: "Group", group: "Offense", mins: 10, notes: "Timing on bubble and RB screens. Linemen release flat, block level to level." },

    /* ---- TEAM ---- */
    { id: uid(), name: "Team Offense Script", cat: "Team", group: "Offense", mins: 20, notes: "Game plan script vs scout defense. Huddle tempo, clean breaks, no wasted reps." },
    { id: uid(), name: "Team Defense vs Scout", cat: "Team", group: "Defense", mins: 15, notes: "Scout runs opponent cards. Align, key, fit, and every hat runs to the ball." },
    { id: uid(), name: "Openers Rehearsal", cat: "Team", group: "Offense", mins: 10, notes: "First six plays of the game, twice each. Perfect alignment, perfect tempo." },
    { id: uid(), name: "Situations: 3rd Down", cat: "Team", group: "All", mins: 10, notes: "3rd and short, medium, long. Offense converts, defense gets off the field." },
    { id: uid(), name: "Red Zone & Goal Line", cat: "Team", group: "All", mins: 12, notes: "Condensed field, low pads, zero penalties. Defense mantra: nothing inside." },
    { id: uid(), name: "2-Minute Drill", cat: "Team", group: "All", mins: 10, notes: "Live clock. Sideline throws, spike rules, use of timeouts. Poise wins." },
    { id: uid(), name: "Sudden Change", cat: "Team", group: "All", mins: 8, notes: "Defense sprints on after a turnover call. Attitude and body language period." },
    { id: uid(), name: "Mock Game Procedures", cat: "Team", group: "All", mins: 10, notes: "Cadence with noise, substitutions, penalty downs, timeout mechanics." },

    /* ---- SPECIAL TEAMS ---- */
    { id: uid(), name: "Kickoff Coverage Lanes", cat: "Special Teams", group: "Special Teams", mins: 10, notes: "Sprint your lane, squeeze to the ball, breakdown. No live tackling needed." },
    { id: uid(), name: "Kick Return Setup", cat: "Special Teams", group: "Special Teams", mins: 10, notes: "Front line retreats, wall sets, returner catches and gets vertical." },
    { id: uid(), name: "Punt Operation", cat: "Special Teams", group: "Special Teams", mins: 10, notes: "Snap to punt on time. Protect first, then release and cover." },
    { id: uid(), name: "PAT & FG Operation", cat: "Special Teams", group: "Special Teams", mins: 8, notes: "Snap, hold, kick timing. Everyone knows block rules and fire calls." },
    { id: uid(), name: "Hands Team & Onside", cat: "Special Teams", group: "Special Teams", mins: 8, notes: "High hop reactions, fair catch rules, fall on it and cradle." },

    /* ---- CONDITIONING ---- */
    { id: uid(), name: "10 Perfect Plays", cat: "Conditioning", group: "All", mins: 10, notes: "Ten flawless team plays to end practice. A jump or fumble starts it over." },
    { id: uid(), name: "Gassers", cat: "Conditioning", group: "All", mins: 6, notes: "Sideline to sideline. Sprint through the line, finish together." },
    { id: uid(), name: "Pursuit Chase", cat: "Conditioning", group: "Defense", mins: 8, notes: "Full pursuit to the sideline cone from every spot. Conditioning that looks like defense." },
    { id: uid(), name: "Competition Relays", cat: "Conditioning", group: "All", mins: 8, notes: "Ball carry relays by position group. Winners pick the break-down chant." },
    /* ---- TEAM INSTALL (helmets-friendly) ---- */
    { id: uid(), name: "Formation Races (Sprint-Align-Look)", cat: "Team", group: "Offense", mins: 12, notes: "Coach calls it, kids SPRINT to alignment, set, eyes to the sideline. Doubles first, then Trips Rt/Lt. Race the clock, celebrate perfect stances." },
    { id: uid(), name: "Team Walk-Through Install", cat: "Team", group: "Offense", mins: 15, notes: "Rhino, Lion, and Sparrow on air at walk speed, then jog speed. Line steps only, no contact. Every kid says his job out loud before the snap." },
    /* ---- JET SERIES INSTALL (libVersion 4) ---- */
    { id: uid(), name: "Motion Landmark Races", cat: "Individual", group: "Skill (QB/RB/WR/TE)", mins: 8, notes: "H starts on Set, hits the mesh cone at GO at FULL speed. Cone behind the QB spot. Race two H's, time them, same speed every rep." },
    { id: uid(), name: "Jet Mesh & Basket", cat: "Group", group: "Skill (QB/RB/WR/TE)", mins: 12, notes: "QB and H only: Set... GO, H makes a basket at full speed, QB presses it in. The QB owns the ball: a bad mesh is the QB's rep, and he keeps it on the Raccoon path instead of forcing it. 20 reps each way, both QBs." },
    { id: uid(), name: "Owl Fake & Pop", cat: "Group", group: "Skill (QB/RB/WR/TE)", mins: 10, notes: "QB, RB, Y. Big Rhino fake (RB runs angry), Y sells the block one count, slips, QB pops it over the cone linebackers. Rhythm: fake, find, throw." },
    { id: uid(), name: "Reach & Run (REACH steps)", cat: "Individual", group: "OL", mins: 8, notes: "Playside reach step and RUN on the cadence. Cover him up, do not win a wrestling match. Jet and keep live behind this." },
  ],
  practice: { date: "", start: "17:30", title: "Practice Plan", items: [] },
  savedPlans: [],
  plays: [...safariSeedPlays(), ...safariSeedPlaysV2(), ...safariSeedPlaysV3(), ...safariSeedPlaysV4(), ...safariSeedPlaysV5(), ...safariSeedPlaysV6()],
  callLog: [],
  gameLabel: "",
  script: [],
  scriptPos: 0,
  safariVersion: 2,
  callSheet: {},
  wrist: { title: "REBELS", cols: 3, copies: 4, selected: null },
  depth: { off: {}, def: {} },
  offScheme: "I-Form",
  defScheme: "5-3",
  libVersion: 4,
  seasonWeek: 1,
  pgOverrides: {},
  packages: [],
};
const SEED = migrateDepth(RAW_SEED);

/* ---- packages: one word, three snaps, all off the same picture ---- */
function seedPackages() {
  return [
    { id: uid(), name: "SAFARI", steps: [{ concept: "power", dir: "Rt" }, { concept: "jet", dir: "Rt" }, { concept: "owl", dir: "" }] },
    { id: uid(), name: "STAMPEDE", steps: [{ concept: "power", dir: "Rt" }, { concept: "power", dir: "Lt" }, { concept: "keep", dir: "Rt" }] },
    { id: uid(), name: "CHEETAH", steps: [{ concept: "jet", dir: "Rt" }, { concept: "bubble", dir: "Rt" }, { concept: "keep", dir: "Rt" }] },
  ];
}
/* ---- kill pairs: the base answers kill to the bubble when the box is heavy ---- */
function applyKillPairs(plays) {
  const find = (c, d) => plays.find((p) => p.concept === c && (p.dir || "") === d);
  const pair = (a, b) => { if (a && b && !a.killId) a.killId = b.id; };
  pair(find("power", "Rt"), find("bubble", "Rt"));
  pair(find("power", "Lt"), find("bubble", "Lt"));
  pair(find("jet", "Rt"), find("bubble", "Rt"));
  pair(find("jet", "Lt"), find("bubble", "Lt"));
  return plays;
}
/* ---- Day 1 helmets plan: routes and throws by group, formations in team ---- */
function day1Plan(drills) {
  const idOf = (name) => { const d = drills.find((x) => x.name.toLowerCase() === name.toLowerCase()); return d ? d.id : null; };
  const per = (mins, names) => ({ id: uid(), mins, stations: names.map(idOf).filter(Boolean).map((drillId) => ({ id: uid(), drillId })) });
  const items = [
    per(10, ["Dynamic Warmup & Stretch"]),
    per(6, ["Stance & Takeoff"]),
    per(12, ["Routes on Air", "OL Stance & First Steps", "LB Read Steps"]),
    per(12, ["Catch Circuit", "Accuracy Targets", "Down Block Angles", "Handoff Mesh Circuit"]),
    per(8, ["Pat & Go", "Snap & Steps"]),
    per(12, ["Formation Races (Sprint-Align-Look)"]),
    per(15, ["Team Walk-Through Install"]),
    per(5, ["Gassers"]),
  ].filter((p) => p.stations.length > 0);
  return { date: "", start: "17:30", title: "Day 1 · Helmets: Routes + Formations", items };
}
/* ---- Week 2 plan: the jet series install (Rocket, Raccoon, Owl) ---- */
function week2Plan(drills) {
  const idOf = (name) => { const d = drills.find((x) => x.name.toLowerCase() === name.toLowerCase()); return d ? d.id : null; };
  const per = (mins, names) => ({ id: uid(), mins, stations: names.map(idOf).filter(Boolean).map((drillId) => ({ id: uid(), drillId })) });
  const items = [
    per(10, ["Dynamic Warmup & Stretch"]),
    per(8, ["Motion Landmark Races", "Reach & Run (REACH steps)", "LB Read Steps"]),
    per(12, ["Jet Mesh & Basket", "Down Block Angles", "Pedal & Break"]),
    per(10, ["Owl Fake & Pop", "OL Stance & First Steps", "Scrape & Fill"]),
    per(12, ["Perimeter Drill"]),
    per(15, ["Team Walk-Through Install"]),
    per(10, ["10 Perfect Plays"]),
  ].filter((p) => p.stations.length > 0);
  return { date: "", start: "17:30", title: "Week 2 · Jet Series Install (Rocket, Raccoon, Owl)", items };
}
SEED.packages = seedPackages();
applyKillPairs(SEED.plays);
SEED.safariVersion = 7;
SEED.savedPlans = [
  { id: uid(), name: "Day 1 · Helmets (Routes + Formations)", savedAt: "library", plan: day1Plan(SEED.drills) },
  { id: uid(), name: "Week 2 · Jet Series Install (Rocket, Raccoon, Owl)", savedAt: "library", plan: week2Plan(SEED.drills) },
];
SEED.practice = { ...SEED.practice, ...day1Plan(SEED.drills) };
SEED.day1Seeded = true;
SEED.week2Seeded = true;

const STORAGE_KEY = "vh6-coach-data-v1";

/* ---------- storage adapter ----------
   Priority: Claude artifact storage → Supabase (if configured) → localStorage.
   To turn on Supabase sync, set window.SUPABASE_URL and window.SUPABASE_ANON_KEY
   in index.html and run supabase-setup.sql in your project. */
function supaCfg() {
  if (typeof window === "undefined") return null;
  return window.SUPABASE_URL && window.SUPABASE_ANON_KEY
    ? { url: window.SUPABASE_URL, key: window.SUPABASE_ANON_KEY }
    : null;
}

const store = {
  async get(key) {
    if (typeof window !== "undefined" && window.storage && window.storage.get) {
      try {
        const r = await window.storage.get(key);
        return r ? r.value : null;
      } catch (e) {
        return null;
      }
    }
    const supa = supaCfg();
    if (supa) {
      try {
        const res = await fetch(`${supa.url}/rest/v1/app_state?key=eq.${encodeURIComponent(key)}&select=value`, {
          headers: { apikey: supa.key, Authorization: `Bearer ${supa.key}` },
        });
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]) return JSON.stringify(rows[0].value);
      } catch (e) { /* fall through to localStorage */ }
    }
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  async set(key, value) {
    if (typeof window !== "undefined" && window.storage && window.storage.set) {
      const r = await window.storage.set(key, value);
      if (!r) throw new Error("save failed");
      return;
    }
    const supa = supaCfg();
    if (supa) {
      // Local copy FIRST: a dead sideline connection must never lose the game log.
      try { window.localStorage.setItem(key, value); } catch (e) {}
      const res = await fetch(`${supa.url}/rest/v1/app_state?on_conflict=key`, {
        method: "POST",
        headers: {
          apikey: supa.key,
          Authorization: `Bearer ${supa.key}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify([{ key, value: JSON.parse(value) }]),
      });
      if (!res.ok) throw new Error("supabase save failed");
      return;
    }
    window.localStorage.setItem(key, value);
  },
};

/* ---------- data migration ---------- */
function normalizeData(parsed) {
  // Old flat practice items ({drillId, mins}) become periods with one station.
  const rawItems = (parsed.practice && parsed.practice.items) || [];
  const items = rawItems.map((it) =>
    it.stations ? it : { id: it.id || uid(), mins: it.mins ?? null, stations: [{ id: uid(), drillId: it.drillId }] }
  );
  // Older drills get a default group.
  let drills = (parsed.drills || []).map((d) => ({ group: "All", ...d }));
  // Renamed drills update in place (same id, so saved plans keep their links).
  const DRILL_RENAMES = { "Jet Touch Pass Timing": "Jet Mesh & Basket" };
  drills = drills.map((d) => {
    if (!DRILL_RENAMES[d.name]) return d;
    const fresh = SEED.drills.find((x) => x.name === DRILL_RENAMES[d.name]);
    return { ...d, name: DRILL_RENAMES[d.name], notes: fresh ? fresh.notes : d.notes };
  });
  // Merge in new library drills the coach doesn't have yet (by name).
  if ((parsed.libVersion || 1) < SEED.libVersion) {
    const have = new Set(drills.map((d) => d.name.toLowerCase()));
    drills = [...drills, ...SEED.drills.filter((d) => !have.has(d.name.toLowerCase()))];
  }
  // Append the Safari playbook once for existing saves, numbered after their plays.
  let plays = parsed.plays || [];
  if (!(parsed.safariVersion >= 1)) {
    const base = plays.reduce((m, p) => Math.max(m, Number(p.num) || 0), 0);
    plays = [...plays, ...safariSeedPlays().map((p) => ({ ...p, id: uid(), num: p.num - 0 + base }))];
  }
  if (!(parsed.safariVersion >= 2)) {
    const have = new Set(plays.map((p) => p.name));
    const base2 = plays.reduce((m, p) => Math.max(m, Number(p.num) || 0), 0);
    let n = 0;
    plays = [...plays, ...safariSeedPlaysV2().filter((p) => !have.has(p.name)).map((p) => ({ ...p, id: uid(), num: base2 + (++n) }))];
  }
  // v3: kill pairs on the base answer (Rhino kills to the bubble when the box is heavy).
  if (!(parsed.safariVersion >= 3)) {
    plays = applyKillPairs(plays.map((p) => ({ ...p })));
  }
  // v4: speed-in-space looks, jet kill pairs, CHEETAH tempo package.
  let packages = parsed.packages && parsed.packages.length ? parsed.packages : seedPackages();
  if (!(parsed.safariVersion >= 4)) {
    const haveV4 = new Set(plays.map((p) => p.name));
    const base4 = plays.reduce((m, p) => Math.max(m, Number(p.num) || 0), 0);
    let n4 = 0;
    plays = [...plays, ...safariSeedPlaysV3().filter((p) => !haveV4.has(p.name)).map((p) => ({ ...p, id: uid(), num: base4 + (++n4) }))];
    plays = applyKillPairs(plays.map((p) => ({ ...p })));
    const havePkg = new Set(packages.map((p) => p.name));
    packages = [...packages, ...seedPackages().filter((p) => !havePkg.has(p.name))];
  }
  // v5: Ram/Leopard, the reach answer to coordinators keying our down blocks.
  if (!(parsed.safariVersion >= 5)) {
    const haveV5 = new Set(plays.map((p) => p.name));
    const base5 = plays.reduce((m, p) => Math.max(m, Number(p.num) || 0), 0);
    let n5 = 0;
    plays = [...plays, ...safariSeedPlaysV4().filter((p) => !haveV5.has(p.name)).map((p) => ({ ...p, id: uid(), num: base5 + (++n5) }))];
  }
  // v6: more costumes for the winners (Bunch jets, Nasty/Tank reach, Trips power).
  if (!(parsed.safariVersion >= 6)) {
    const haveV6 = new Set(plays.map((p) => p.name));
    const base6 = plays.reduce((m, p) => Math.max(m, Number(p.num) || 0), 0);
    let n6 = 0;
    plays = [...plays, ...safariSeedPlaysV5().filter((p) => !haveV6.has(p.name)).map((p) => ({ ...p, id: uid(), num: base6 + (++n6) }))];
  }
  // v7: the QB tree (sprint-out floods, Empty quick menu, Doubles Hawk).
  if (!(parsed.safariVersion >= 7)) {
    const haveV7 = new Set(plays.map((p) => p.name));
    const base7 = plays.reduce((m, p) => Math.max(m, Number(p.num) || 0), 0);
    let n7 = 0;
    plays = [...plays, ...safariSeedPlaysV6().filter((p) => !haveV7.has(p.name)).map((p) => ({ ...p, id: uid(), num: base7 + (++n7) }))];
  }
  // Concept play names are derived, so vocabulary updates flow through automatically.
  plays = plays.map((p) =>
    p.concept && CONCEPTS[p.concept] && p.concept !== "blank"
      ? { ...p, name: `${p.formation} · ${callWord(p.concept, p.dir, p.tags || [])}` }
      : p
  );
  // Seed the Day 1 helmets plan once for existing programs.
  let savedPlans = parsed.savedPlans || [];
  if (!parsed.day1Seeded && !savedPlans.some((s) => /day 1/i.test(s.name || ""))) {
    savedPlans = [{ id: uid(), name: "Day 1 · Helmets (Routes + Formations)", savedAt: "library", plan: day1Plan(drills) }, ...savedPlans];
  }
  // Seed the Week 2 jet-series install once (after the v4 drills have merged in).
  if (!parsed.week2Seeded && !savedPlans.some((s) => /week 2/i.test(s.name || ""))) {
    savedPlans = [{ id: uid(), name: "Week 2 · Jet Series Install (Rocket, Raccoon, Owl)", savedAt: "library", plan: week2Plan(drills) }, ...savedPlans];
  }
  // Rustler -> Raccoon (July 22): retitle the already-seeded plan in place.
  savedPlans = savedPlans.map((s) =>
    s.name === "Week 2 · Jet Series Install (Rocket, Rustler, Owl)" ? { ...s, name: "Week 2 · Jet Series Install (Rocket, Raccoon, Owl)" } : s
  );
  return migrateDepth({
    ...SEED,
    ...parsed,
    drills,
    plays,
    callLog: parsed.callLog || [],
    gameLabel: parsed.gameLabel || "",
    script: parsed.script || [],
    scriptPos: parsed.scriptPos || 0,
    safariVersion: 7,
    seasonWeek: parsed.seasonWeek || 1,
    pgOverrides: parsed.pgOverrides || {},
    packages,
    day1Seeded: true,
    week2Seeded: true,
    practice: { ...SEED.practice, ...(parsed.practice || {}), items },
    savedPlans,
    wrist: { ...SEED.wrist, ...(parsed.wrist || {}) },
    depth: parsed.depth || { off: {}, def: {} },
    depthVersion: parsed.depthVersion || 1,
    libVersion: SEED.libVersion,
  });
}

/* ---------- time helpers ---------- */
function fmtTime(mins) {
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}
function parseStart(s) {
  const [h, m] = (s || "17:30").split(":").map(Number);
  return h * 60 + (m || 0);
}
function todayStr() {
  const d = new Date();
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

/* ============================================================ */
export default function App() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("roster");
  const [printTarget, setPrintTarget] = useState(null);
  const [saveState, setSaveState] = useState("saved");
  const loaded = useRef(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const raw = await store.get(STORAGE_KEY);
        if (raw) {
          setData(normalizeData(JSON.parse(raw)));
        } else {
          setData(SEED);
        }
      } catch (e) {
        setData(SEED);
      }
      loaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current || !data) return;
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await store.set(STORAGE_KEY, JSON.stringify(data));
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
      }
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [data]);

  const up = (patch) => setData((d) => ({ ...d, ...patch }));

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBFAF8", fontFamily: "Roboto, system-ui, sans-serif", color: "#5B616B" }}>
        Loading your program…
      </div>
    );
  }

  const TABS = [
    { key: "roster", label: "Roster & Depth" },
    { key: "practice", label: "Practice Planner" },
    { key: "playbook", label: "Play Lab" },
    { key: "caller", label: "Caller" },
    { key: "callsheet", label: "Call Sheet" },
    { key: "wrist", label: "Wristbands" },
  ];

  return (
    <div className="root">
      <Styles />
      <div className="app-ui">
        <header className="masthead">
          <div className="mast-left">
            <div className="mark">VH</div>
            <div>
              <div className="team-line">VESTAVIA HILLS REBELS</div>
              <div className="sub-line">6TH GRADE FOOTBALL · SIDELINE COMMAND</div>
            </div>
          </div>
          <div className="mast-right">
            <label className="week-dial" title="One dial runs the whole app. Every tab defaults to only what the team has installed so far. Turn it up as you install.">WEEK
              <select aria-label="Season week" value={data.seasonWeek || 1} onChange={(e) => up({ seasonWeek: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map((w) => <option key={w} value={w}>{w}</option>)}
                <option value={9}>All</option>
              </select>
            </label>
            {saveState === "error" ? (
              <button className="save-chip error" onClick={() => setData((d) => ({ ...d }))} title="Your work is saved on this device. Tap to retry the cloud sync.">
                Cloud sync failed · tap to retry
              </button>
            ) : (
              <div className={"save-chip " + saveState}>{saveState === "saving" ? "Saving…" : "All changes saved"}</div>
            )}
          </div>
        </header>

        <nav className="tabs">
          {TABS.map((t) => (
            <button key={t.key} className={"tab" + (tab === t.key ? " active" : "")} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>

        <main className="content">
          {tab === "roster" && <RosterTab data={data} up={up} onPrint={() => setPrintTarget("gameday")} onPrintGroups={() => setPrintTarget("groups")} onPrintFormations={() => setPrintTarget("formations")} />}
          {tab === "practice" && <PracticeTab data={data} up={up} onPrint={() => setPrintTarget("practice")} />}
          {tab === "playbook" && <PlaybookTab data={data} up={up} onPrintSignals={() => setPrintTarget("signals")} onPrintBook={() => setPrintTarget("playbook")} onPrintJobs={() => setPrintTarget("jobs")} onPrintSystem={() => setPrintTarget("system")} onPrintCard={(id) => setPrintTarget("playcard:" + id)} />}
          {tab === "caller" && <CallerTab data={data} up={up} />}
          {tab === "callsheet" && <CallSheetTab data={data} up={up} onPrint={() => setPrintTarget("callsheet")} />}
          {tab === "wrist" && <WristTab data={data} up={up} onPrint={() => setPrintTarget("wrist")} onPrintRoutes={() => setPrintTarget("routes")} />}
        </main>
      </div>

      {printTarget && (
        <PrintLayer target={printTarget} data={data} onClose={() => setPrintTarget(null)} />
      )}
    </div>
  );
}

/* ============================================================
   ROSTER & DEPTH CHART — 1st/2nd/3rd team slots per position
   ============================================================ */
function RosterTab({ data, up, onPrint, onPrintGroups, onPrintFormations }) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [groupsView, setGroupsView] = useState(false);
  const [formationView, setFormationView] = useState(false);
  const [depthSide, setDepthSide] = useState("off");

  const add = () => {
    if (!name.trim()) return;
    up({ players: [...data.players, { id: uid(), name: name.trim(), num: num.trim() }] });
    setName("");
    setNum("");
  };
  const setPlayer = (id, patch) =>
    up({ players: data.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  const remove = (id) => {
    const p = data.players.find((x) => x.id === id);
    if (!window.confirm(`Remove ${p ? p.name : "this player"} from the roster? His depth chart spots open up.`)) return;
    const strip = (m) => Object.fromEntries(Object.entries(m || {}).map(([k, v]) => [k, v.map((x) => (x === id ? null : x))]));
    up({
      players: data.players.filter((p) => p.id !== id),
      depth: { off: strip(data.depth.off), def: strip(data.depth.def) },
    });
  };
  const move = (id, dir) => {
    const arr = [...data.players];
    const i = arr.findIndex((p) => p.id === id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    up({ players: arr });
  };

  /* Put a player in a team slot. He's cleared from other slots at the SAME
     position (can't be his own backup), but can hold slots at other positions. */
  const setSlot = (side, pos, idx, playerId) => {
    const depth = { off: { ...data.depth.off }, def: { ...data.depth.def } };
    const slots = [...(depth[side][pos] || [null, null, null])];
    if (playerId) for (let i = 0; i < 3; i++) if (slots[i] === playerId) slots[i] = null;
    slots[idx] = playerId || null;
    depth[side][pos] = slots;
    up({ depth });
  };

  const posList = depthSide === "off" ? offPositions(data) : defPositions(data);
  const offMissing = offPositions(data).filter((pos) => !slotsFor(data, "off", pos)[0]);
  const defMissing = defPositions(data).filter((pos) => !slotsFor(data, "def", pos)[0]);

  /* A kid slotted 1st team at two positions on the same side can't be in
     two places at once. Worth a flag, not a block. */
  const doubleStarters = (side, list) => {
    const seen = {};
    for (const pos of list) {
      const s = slotsFor(data, side, pos)[0];
      if (s) (seen[s.id] = seen[s.id] || { p: s, at: [] }).at.push(pos);
    }
    return Object.values(seen).filter((e) => e.at.length > 1);
  };
  const offDoubles = doubleStarters("off", offPositions(data));
  const defDoubles = doubleStarters("def", defPositions(data));

  const numCounts = {};
  for (const p of data.players) if (p.num) numCounts[p.num] = (numCounts[p.num] || 0) + 1;
  const dupNums = Object.keys(numCounts).filter((n) => numCounts[n] > 1);

  const byRoster = (side, id) =>
    assignmentsFor(data, side, id).map((a) => `${a.pos} ${a.team}`).join(" · ");

  return (
    <div className="two-col">
      {groupsView && <PracticeGroupsView data={data} up={up} onClose={() => setGroupsView(false)} onPrint={onPrintGroups} />}
      <section className="panel">
        <div className="panel-head">
          <h2>Roster</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setGroupsView(true)} title="One click: the whole roster split into QB/WR, Linemen, and LB/RB from the depth chart, offense and defense combined.">Practice Groups</button>
            <button className="btn ghost" onClick={onPrint}>Print Game Day Sheet</button>
          </div>
        </div>
        <div className="add-row">
          <input placeholder="Player name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <input placeholder="#" style={{ width: 56 }} value={num} onChange={(e) => setNum(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className="btn" onClick={add}>Add Player</button>
        </div>
        <p className="hint">Names and numbers live here. Positions are set in the depth chart, where a kid can hold spots on multiple lines: 1st team receiver and 2nd team QB at the same time.</p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Name</th><th>Offense</th><th>Defense</th><th></th></tr>
            </thead>
            <tbody>
              {data.players.map((p) => (
                <tr key={p.id}>
                  <td><input className="cell num" value={p.num} onChange={(e) => setPlayer(p.id, { num: e.target.value })} /></td>
                  <td><input className="cell" value={p.name} onChange={(e) => setPlayer(p.id, { name: e.target.value })} /></td>
                  <td className="assign off-assign">{byRoster("off", p.id) || <span className="unfilled">—</span>}</td>
                  <td className="assign def-assign">{byRoster("def", p.id) || <span className="unfilled">—</span>}</td>
                  <td className="row-actions">
                    <button title="Move up" onClick={() => move(p.id, -1)}>↑</button>
                    <button title="Move down" onClick={() => move(p.id, 1)}>↓</button>
                    <button title="Remove" className="danger" onClick={() => remove(p.id)}>✕</button>
                  </td>
                </tr>
              ))}
              {data.players.length === 0 && (
                <tr><td colSpan={5} className="empty">Add your first player above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Depth Chart</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div className="side-switch">
              <button className={"side-btn" + (depthSide === "off" ? " active off" : "")} onClick={() => setDepthSide("off")}>Offense</button>
              <button className={"side-btn" + (depthSide === "def" ? " active def" : "")} onClick={() => setDepthSide("def")}>Defense</button>
            </div>
            {depthSide === "off" && (
              <select className="cell" value={offScheme(data)} onChange={(e) => up({ offScheme: e.target.value })}>
                {Object.keys(OFF_SCHEMES).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            )}
            {depthSide === "def" && (
              <select className="cell" value={defScheme(data)} onChange={(e) => up({ defScheme: e.target.value })}>
                {Object.keys(DEF_SCHEMES).map((k) => <option key={k} value={k}>{k} front</option>)}
              </select>
            )}
            <button className="btn" onClick={() => setFormationView(true)}>Formation View</button>
          </div>
        </div>
        {depthSide === "def" && (
          <p className="hint">Switching fronts keeps every assignment. Positions the current front doesn't use (like SAM in a 5-2) are hidden and come right back when you switch back.</p>
        )}
        {depthSide === "off" && (
          <p className="hint">Switching formations keeps every assignment. Positions the current formation doesn't use (like the Wing outside a Wing-T) are hidden and come right back when you switch back.</p>
        )}
        <div className="table-wrap">
          <table className="slot-table">
            <thead>
              <tr><th>Position</th><th>1st Team</th><th>2nd Team</th><th>3rd Team</th></tr>
            </thead>
            <tbody>
              {posList.map((pos) => {
                const slots = slotsFor(data, depthSide, pos);
                return (
                  <tr key={pos}>
                    <td><span className={"depth-pos " + (depthSide === "off" ? "off-pos" : "def-pos")}>{pos}</span></td>
                    {[0, 1, 2].map((i) => (
                      <td key={i}>
                        <select
                          className={"cell slot" + (i === 0 && !slots[i] ? " missing" : "")}
                          value={slots[i] ? slots[i].id : ""}
                          onChange={(e) => setSlot(depthSide, pos, i, e.target.value)}
                        >
                          <option value="">—</option>
                          {data.players.map((p) => (
                            <option key={p.id} value={p.id}>{p.num ? `#${p.num} ` : ""}{p.name}</option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(offMissing.length > 0 || defMissing.length > 0 || offDoubles.length > 0 || defDoubles.length > 0 || dupNums.length > 0) && data.players.length > 1 && (
          <div className="warn">
            {dupNums.length > 0 && <div><b>Duplicate jersey numbers:</b> {dupNums.map((n) => `#${n}`).join(", ")}</div>}
            {offMissing.length > 0 && <div><b>Offense needs a starter at:</b> {offMissing.join(", ")}</div>}
            {defMissing.length > 0 && <div><b>Defense needs a starter at:</b> {defMissing.join(", ")}</div>}
            {offDoubles.map((e) => (
              <div key={e.p.id}><b>Heads up:</b> {e.p.num ? `#${e.p.num} ` : ""}{e.p.name} is 1st team offense at {e.at.join(" and ")}</div>
            ))}
            {defDoubles.map((e) => (
              <div key={e.p.id}><b>Heads up:</b> {e.p.num ? `#${e.p.num} ` : ""}{e.p.name} is 1st team defense at {e.at.join(" and ")}</div>
            ))}
          </div>
        )}
      </section>

      {formationView && <FormationView data={data} up={up} onClose={() => setFormationView(false)} onPrintFormations={onPrintFormations} />}
    </div>
  );
}


/* ============================================================
   FORMATION VIEW — big screen depth chart
   ============================================================ */
function FormationView({ data, up, onClose, onPrintFormations }) {
  const [side, setSide] = useState("offense");
  const seasonWeek = data.seasonWeek || 1;
  const installed = installedForms(seasonWeek >= 9 ? 6 : seasonWeek);
  const later = PLAY_FORM_NAMES.filter((f) => !installed.includes(f));
  const [form, setForm] = useState("base"); /* "base" = scheme look, else a playbook formation */
  const [school, setSchool] = useState(null); /* {i, revealed} over installed formations */
  const schoolList = installed;
  const advanceSchool = () =>
    setSchool((s) => {
      if (!s) return s;
      if (!s.revealed) return { ...s, revealed: true };
      return { i: (s.i + 1) % schoolList.length, revealed: false };
    });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { school ? setSchool(null) : onClose(); return; }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        if (school) advanceSchool();
        else setSide((s) => (s === "offense" ? "defense" : "offense"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, school]);

  const goFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
  };

  const schoolForm = school ? schoolList[school.i] : null;
  const activeForm = school ? schoolForm : form;
  const usePlayForm = side === "offense" && activeForm !== "base";
  /* Play-diagram space: y23 = LOS, deeper = bigger. Stretch onto the field view. */
  const playSpots = usePlayForm
    ? fvSpread(Object.fromEntries(Object.entries(formSpots(activeForm)).map(([k, [x, y]]) => [k, [x, 16 + (y - 23) * 3.2]])), 6, 9)
    : null;
  const playMap = usePlayForm ? resolvePlayMap(data) : null;
  const spots = usePlayForm ? playSpots : side === "offense" ? OFF_SCHEMES[offScheme(data)].spots : DEF_SCHEMES[defScheme(data)].spots;
  const posList = usePlayForm ? Object.keys(playSpots) : side === "offense" ? offPositions(data) : defPositions(data);
  const tone = side === "offense" ? "var(--red)" : "var(--def-blue)";

  return (
    <div className="fv-layer">
      <div className="fv-toolbar">
        <div className="fv-brand">
          <span className="p-mark" style={{ width: 30, height: 30, fontSize: 14 }}>VH</span>
          <b>REBELS DEPTH CHART</b>
        </div>
        <div className="fv-switch">
          <button className={"fv-side" + (side === "offense" ? " active off" : "")} onClick={() => setSide("offense")}>Offense</button>
          <button className={"fv-side" + (side === "defense" ? " active def" : "")} onClick={() => setSide("defense")}>Defense</button>
          {side === "offense" && !school && (
            <select className="fv-scheme" value={form} onChange={(e) => setForm(e.target.value)} aria-label="Formation">
              <option value="base">Base ({offScheme(data)})</option>
              <optgroup label={`Installed thru week ${seasonWeek >= 9 ? 6 : seasonWeek}`}>
                {installed.map((f) => <option key={f} value={f}>{f}</option>)}
              </optgroup>
              {later.length > 0 && (
                <optgroup label="Later installs">
                  {later.map((f) => <option key={f} value={f}>{f} (wk {FORM_WEEKS[f]})</option>)}
                </optgroup>
              )}
            </select>
          )}
          {side === "offense" && !school && form === "base" && (
            <select className="fv-scheme" value={offScheme(data)} onChange={(e) => up({ offScheme: e.target.value })}>
              {Object.keys(OFF_SCHEMES).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          )}
          {side === "defense" && (
            <select className="fv-scheme" value={defScheme(data)} onChange={(e) => up({ defScheme: e.target.value })}>
              {Object.keys(DEF_SCHEMES).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          )}
        </div>
        <div className="fv-actions">
          <span className="fv-hint">{school ? "Tap or Space: reveal, then next · Esc exits school" : "Space flips sides · Esc closes"}</span>
          {side === "offense" && !school && <button className="btn gold" onClick={() => setSchool({ i: 0, revealed: false })}>Formation School</button>}
          {school && <button className="btn ghost dark" onClick={() => setSchool(null)}>Exit School</button>}
          {side === "offense" && !school && <button className="btn ghost dark" onClick={onPrintFormations}>Print Cards</button>}
          <button className="btn ghost dark" onClick={goFullscreen}>Fullscreen</button>
          {!school && <button className="btn" onClick={onClose}>Close</button>}
        </div>
      </div>
      <div className="fv-stage" onClick={school ? advanceSchool : undefined} style={school ? { cursor: "pointer" } : undefined}>
        <div className="fv-field">
          {school && (
            <div className={"fv-flash" + (school.revealed ? " revealed" : "")}>
              <span className="fv-flash-name">{schoolForm}</span>
              {!school.revealed && <span className="fv-flash-hint">Call it. Kids sprint, align, set. Tap to check.</span>}
              {school.revealed && <span className="fv-flash-hint">Tap for the next one · {school.i + 1} of {schoolList.length}</span>}
            </div>
          )}
          {(!school || school.revealed) && <div className="fv-los" style={{ top: side === "offense" ? "14%" : "12%" }}>
            <span>LOS</span>
          </div>}
          {(!school || school.revealed) && posList.map((pos) => {
            const [x, y] = spots[pos] || [50, 50];
            const schemePos = usePlayForm ? playMap[pos] : pos;
            const slots = schemePos ? slotsFor(data, side === "offense" ? "off" : "def", schemePos) : [null, null, null];
            const starter = slots[0];
            const backups = [slots[1], slots[2]].filter(Boolean);
            return (
              <div key={pos} className="fv-node" style={{ left: `${x}%`, top: `${y}%` }}>
                <div className="fv-pos" style={{ background: usePlayForm && (pos === "H" || pos === "Y") ? "var(--gold, #EAAA00)" : tone, color: usePlayForm && (pos === "H" || pos === "Y") ? "#1C2430" : undefined }}>{pos}</div>
                {starter ? (
                  <div className="fv-card">
                    <span className="fv-num">{starter.num ? `#${starter.num}` : ""}</span>
                    <span className="fv-name">{starter.name}</span>
                  </div>
                ) : (
                  <div className="fv-card open">OPEN</div>
                )}
                {backups.map((b) => (
                  <div key={b.id} className="fv-backup">{b.num ? `#${b.num} ` : ""}{b.name}</div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PRACTICE PLANNER — library with filters + multi-station periods
   ============================================================ */
function PracticeTab({ data, up, onPrint }) {
  const [d, setD] = useState({ name: "", cat: "Team", group: "All", mins: 10, notes: "" });
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [groupFilter, setGroupFilter] = useState("All groups");
  const { practice, drills } = data;

  const addDrill = () => {
    if (!d.name.trim()) return;
    up({ drills: [...drills, { id: uid(), name: d.name.trim(), cat: d.cat, group: d.group, mins: Number(d.mins) || 10, notes: d.notes.trim() }] });
    setD({ name: "", cat: d.cat, group: d.group, mins: 10, notes: "" });
  };
  const removeDrill = (id) => {
    const dr = drills.find((x) => x.id === id);
    if (!window.confirm(`Delete drill${dr ? ` "${dr.name}"` : ""}? It comes out of today's plan too.`)) return;
    const items = practice.items
      .map((per) => ({ ...per, stations: per.stations.filter((s) => s.drillId !== id) }))
      .filter((per) => per.stations.length > 0);
    up({ drills: drills.filter((x) => x.id !== id), practice: { ...practice, items } });
  };

  /* period ops */
  const addPeriod = (drillId) =>
    up({ practice: { ...practice, items: [...practice.items, { id: uid(), mins: null, stations: [{ id: uid(), drillId }] }] } });
  const addStation = (periodId, drillId) => {
    if (!drillId) return;
    up({
      practice: {
        ...practice,
        items: practice.items.map((per) =>
          per.id === periodId ? { ...per, stations: [...per.stations, { id: uid(), drillId }] } : per
        ),
      },
    });
  };
  const removeStation = (periodId, stationId) => {
    const items = practice.items
      .map((per) => (per.id === periodId ? { ...per, stations: per.stations.filter((s) => s.id !== stationId) } : per))
      .filter((per) => per.stations.length > 0);
    up({ practice: { ...practice, items } });
  };
  const removePeriod = (id) =>
    up({ practice: { ...practice, items: practice.items.filter((per) => per.id !== id) } });
  const movePeriod = (id, dir) => {
    const arr = [...practice.items];
    const i = arr.findIndex((per) => per.id === id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    up({ practice: { ...practice, items: arr } });
  };
  const setPeriodMins = (id, mins) =>
    up({ practice: { ...practice, items: practice.items.map((per) => (per.id === id ? { ...per, mins: mins === "" ? null : Number(mins) } : per)) } });
  const setP = (patch) => up({ practice: { ...practice, ...patch } });
  const clearPlan = () => {
    if (!window.confirm("Clear today's plan? (Saved plans are untouched.)")) return;
    up({ practice: { ...practice, items: [] } });
  };

  /* ---- saved plans library ---- */
  const [planPick, setPlanPick] = useState("");
  const savedPlans = data.savedPlans || [];
  const savePlan = () => {
    const suggested = (practice.title && practice.title !== "Practice Plan" ? practice.title : "") || practice.date || todayStr();
    const nm = window.prompt("Name this plan:", suggested);
    if (!nm) return;
    const snap = JSON.parse(JSON.stringify(practice));
    up({ savedPlans: [{ id: uid(), name: nm.trim(), savedAt: todayStr(), plan: snap }, ...savedPlans] });
  };
  const loadPlan = () => {
    const sp = savedPlans.find((s) => s.id === planPick);
    if (!sp) return;
    if (practice.items.length > 0 && !window.confirm(`Load "${sp.name}"? It replaces today's plan.`)) return;
    up({ practice: JSON.parse(JSON.stringify(sp.plan)) });
  };
  const deletePlan = () => {
    const sp = savedPlans.find((s) => s.id === planPick);
    if (!sp) return;
    if (!window.confirm(`Delete saved plan "${sp.name}"?`)) return;
    up({ savedPlans: savedPlans.filter((s) => s.id !== sp.id) });
    setPlanPick("");
  };

  /* library filtering */
  const needle = q.trim().toLowerCase();
  const filtered = drills.filter((dr) => {
    if (catFilter !== "All" && dr.cat !== catFilter) return false;
    if (groupFilter !== "All groups" && dr.group !== groupFilter) return false;
    if (needle && !(`${dr.name} ${dr.notes} ${dr.group}`.toLowerCase().includes(needle))) return false;
    return true;
  });

  const schedule = buildSchedule(practice, drills);
  const total = schedule.reduce((s, r) => s + r.mins, 0);

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel-head">
          <h2>Drill Library</h2>
          <span className="hint" style={{ margin: 0 }}>{filtered.length} of {drills.length} drills</span>
        </div>
        <div className="lib-filters">
          <input placeholder="Search drills…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="cat-chip-row">
            {["All", ...DRILL_CATS].map((c) => (
              <button key={c} className={"filter-chip" + (catFilter === c ? " active" : "")}
                style={catFilter === c && c !== "All" ? { background: CAT_COLORS[c], borderColor: CAT_COLORS[c] } : undefined}
                onClick={() => setCatFilter(c)}>{c}</button>
            ))}
          </div>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
            <option>All groups</option>
            {GROUPS.map((g) => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div className="drill-list">
          {filtered.map((dr) => (
            <div key={dr.id} className="drill-card">
              <span className="cat-chip" style={{ background: CAT_COLORS[dr.cat] }}>{dr.cat}</span>
              <div className="drill-main">
                <b>{dr.name} <span className="group-tag" style={{ color: groupTone(dr.group), borderColor: groupTone(dr.group) }}>{dr.group}</span></b>
                {dr.notes && <span className="drill-notes">{dr.notes}</span>}
              </div>
              <span className="drill-mins">{dr.mins}m</span>
              <button className="btn small" onClick={() => addPeriod(dr.id)}>Add →</button>
              <button className="icon-btn danger" title="Delete drill" onClick={() => removeDrill(dr.id)}>✕</button>
            </div>
          ))}
          {filtered.length === 0 && <div className="empty pad">No drills match. Clear the filters or add your own below.</div>}
        </div>
        <div className="drill-form">
          <b className="form-title">Add your own drill</b>
          <input placeholder="Drill name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <div className="drill-form-row">
            <select value={d.cat} onChange={(e) => setD({ ...d, cat: e.target.value })}>
              {DRILL_CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select value={d.group} onChange={(e) => setD({ ...d, group: e.target.value })}>
              {GROUPS.map((g) => <option key={g}>{g}</option>)}
            </select>
            <input type="number" min="1" style={{ width: 70 }} value={d.mins} onChange={(e) => setD({ ...d, mins: e.target.value })} />
            <span className="hint" style={{ margin: 0 }}>min</span>
          </div>
          <input placeholder="Coaching points / equipment (optional)" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
          <button className="btn" onClick={addDrill}>Save Drill</button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Today's Plan</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn ghost" onClick={savePlan} disabled={practice.items.length === 0}>Save Copy</button>
            {practice.items.length > 0 && <button className="btn ghost" onClick={clearPlan}>Clear</button>}
            <button className="btn" onClick={onPrint} disabled={practice.items.length === 0}>Print One-Pager</button>
          </div>
        </div>
        {savedPlans.length > 0 && (
          <div className="saved-plans">
            <select value={planPick} onChange={(e) => setPlanPick(e.target.value)}>
              <option value="">Saved plans ({savedPlans.length})…</option>
              {savedPlans.map((s) => <option key={s.id} value={s.id}>{s.name} · saved {s.savedAt}</option>)}
            </select>
            <button className="btn small" onClick={loadPlan} disabled={!planPick}>Load</button>
            <button className="icon-btn danger" title="Delete saved plan" onClick={deletePlan} disabled={!planPick}>✕</button>
          </div>
        )}
        <div className="plan-meta">
          <label>Date <input placeholder={todayStr()} value={practice.date} onChange={(e) => setP({ date: e.target.value })} /></label>
          <label>Start <input type="time" value={practice.start} onChange={(e) => setP({ start: e.target.value })} /></label>
          <label>Title <input value={practice.title} onChange={(e) => setP({ title: e.target.value })} /></label>
        </div>
        {schedule.length === 0 && <div className="empty pad">Add drills from the library. Each one becomes a timed period, and you can run stations side by side: hit "+ station" on a period to put the linemen on one drill and the skill guys on another in the same slot.</div>}
        {schedule.map((row) => (
          <div key={row.id} className="plan-row period">
            <span className="plan-time">{row.timeLabel}</span>
            <div className="plan-main">
              {row.stations.map((st) => (
                <div key={st.stationId} className="station-line">
                  <span className="group-tag" style={{ color: groupTone(st.group), borderColor: groupTone(st.group) }}>{st.group}</span>
                  <span className="cat-bar" style={{ background: CAT_COLORS[st.cat] }} />
                  <b>{st.name}</b>
                  {row.stations.length > 1 && (
                    <button className="icon-btn danger station-x" title="Remove this station" onClick={() => removeStation(row.id, st.stationId)}>✕</button>
                  )}
                </div>
              ))}
              <select className="station-add" value="" onChange={(e) => { addStation(row.id, e.target.value); }}>
                <option value="">+ station (runs at the same time)…</option>
                {drills.filter((dr) => !row.stations.some((st) => st.drillId === dr.id)).map((dr) => <option key={dr.id} value={dr.id}>{dr.group}: {dr.name}</option>)}
              </select>
            </div>
            <input className="cell mins" type="number" min="1" value={row.rawMins ?? ""} placeholder={String(row.defaultMins)} onChange={(e) => setPeriodMins(row.id, e.target.value)} />
            <div className="row-actions">
              <button onClick={() => movePeriod(row.id, -1)}>↑</button>
              <button onClick={() => movePeriod(row.id, 1)}>↓</button>
              <button className="danger" onClick={() => removePeriod(row.id)}>✕</button>
            </div>
          </div>
        ))}
        {schedule.length > 0 && (
          <div className="plan-total">Total: <b>{total} min</b> · Ends {fmtTime(parseStart(practice.start) + total)}</div>
        )}
      </section>
    </div>
  );
}

function buildSchedule(practice, drills) {
  let t = parseStart(practice.start);
  return practice.items
    .map((per) => {
      const stations = per.stations
        .map((s) => {
          const dr = drills.find((x) => x.id === s.drillId);
          return dr ? { stationId: s.id, drillId: dr.id, name: dr.name, cat: dr.cat, group: dr.group || "All", notes: dr.notes, defMins: dr.mins } : null;
        })
        .filter(Boolean);
      if (stations.length === 0) return null;
      const defaultMins = Math.max(...stations.map((s) => Number(s.defMins) || 10));
      const mins = per.mins != null && per.mins > 0 ? per.mins : defaultMins;
      const row = {
        id: per.id, stations, mins,
        rawMins: per.mins, defaultMins,
        timeLabel: `${fmtTime(t)} – ${fmtTime(t + mins)}`,
        start: fmtTime(t), end: fmtTime(t + mins),
      };
      t += mins;
      return row;
    })
    .filter(Boolean);
}


/* ============================================================
   PLAY DIAGRAM (generated SVG)
   ============================================================ */
function PlayDiagram({ play, size = "big", editSel, onPick, onField, dimExcept }) {
  if (!play || !CONCEPTS[play.concept]) return null;
  const svgRef = useRef(null);
  const custom = play.custom || {};
  const spots = { ...formSpots(play.formation || "Doubles"), ...(custom.spots || {}) };
  const els = genPlayElements(play.concept, spots, play.dir, play.tags || []);
  for (const [label, arr] of Object.entries(custom.els || {})) els[label] = arr;
  const carrier = playCarrier(play);
  const fieldClick = (e) => {
    if (!onField || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    onField([Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, Math.round(((e.clientY - r.top) / r.height) * 440) / 10]);
  };
  const styles = {
    block: { stroke: "#23356F", width: 0.9, dash: null, cap: true },
    route: { stroke: "#23356F", width: 0.9, dash: null, arrow: true },
    carry: { stroke: "#C32032", width: 1.5, dash: null, arrow: true },
    motion: { stroke: "#6B6F76", width: 0.7, dash: "2 1.4", arrow: false },
    fake: { stroke: "#B9BCC2", width: 0.8, dash: null, arrow: true },
    throw: { stroke: "#C32032", width: 0.5, dash: "1 1.2", arrow: false },
  };
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const lines = [];
  for (const [label, arr] of Object.entries(els)) {
    for (const e of arr) {
      if (!e.pts) continue;
      const st = styles[e.kind] || styles.route;
      const last = e.pts[e.pts.length - 1];
      const prev = e.pts[e.pts.length - 2] || e.pts[0];
      const ang = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
      const dim = dimExcept && !dimExcept.includes(label);
      lines.push(
        <g key={label + e.kind + lines.length} opacity={dim ? 0.18 : 1}>
          <path d={path(e.pts)} fill="none" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash || undefined} strokeLinecap="round" strokeLinejoin="round" />
          {st.arrow && (
            <path d={`M${last[0]},${last[1]} L${last[0] - 2 * Math.cos(ang - 0.5)},${last[1] - 2 * Math.sin(ang - 0.5)} M${last[0]},${last[1]} L${last[0] - 2 * Math.cos(ang + 0.5)},${last[1] - 2 * Math.sin(ang + 0.5)}`} stroke={st.stroke} strokeWidth={st.width} fill="none" strokeLinecap="round" />
          )}
          {st.cap && (
            <path d={`M${last[0] - 1.6 * Math.sin(ang)},${last[1] + 1.6 * Math.cos(ang)} L${last[0] + 1.6 * Math.sin(ang)},${last[1] - 1.6 * Math.cos(ang)}`} stroke={st.stroke} strokeWidth={st.width} fill="none" />
          )}
        </g>
      );
    }
  }
  return (
    <svg ref={svgRef} className={"play-svg " + size + (onField ? " editing" : "")} viewBox="0 0 100 44" preserveAspectRatio="xMidYMid meet" onClick={fieldClick}>
      <rect x="0" y="0" width="100" height="44" fill="#F3F6F2" />
      <line x1="0" y1="20" x2="100" y2="20" stroke="#B7791F" strokeWidth="0.6" />
      {[10, 30, 50, 70, 90].map((x) => (
        <g key={x}>
          <line x1={x} y1="6" x2={x} y2="7.5" stroke="#C9CFC6" strokeWidth="0.5" />
          <line x1={x} y1="13" x2={x} y2="14.5" stroke="#C9CFC6" strokeWidth="0.5" />
        </g>
      ))}
      {lines}
      {Object.entries(spots).map(([label, [x, y]]) => {
        const hot = label === carrier;
        const active = label === editSel;
        const dim = dimExcept && !dimExcept.includes(label);
        const stroke = active ? "#B7791F" : hot ? "#C32032" : "#23356F";
        return (
          <g key={label} opacity={dim ? 0.25 : 1} onClick={onPick ? (e) => { e.stopPropagation(); onPick(label); } : undefined} style={onPick ? { cursor: "pointer" } : undefined}>
            {label === "C"
              ? <rect x={x - 2} y={y - 2} width="4" height="4" fill="#fff" stroke={stroke} strokeWidth={active || hot ? 1 : 0.7} />
              : <circle cx={x} cy={y} r="2.1" fill="#fff" stroke={stroke} strokeWidth={active || hot ? 1 : 0.7} />}
            <text x={x} y={y + 0.9} textAnchor="middle" fontSize="2.4" fontWeight="700" fontFamily="Roboto, sans-serif" fill={stroke}>{label.replace(" LB", "")}</text>
          </g>
        );
      })}
    </svg>
  );
}

/* ============================================================
   PLAY LAB (playbook, rebuilt around the Safari grammar)
   ============================================================ */
function PlaybookTab({ data, up, onPrintSignals, onPrintBook, onPrintJobs, onPrintSystem, onPrintCard }) {
  const { plays } = data;
  const seasonWeek = data.seasonWeek || 1;
  const [showLater, setShowLater] = useState(false);
  const visible = showLater ? plays : plays.filter((p) => !p.week || p.week <= seasonWeek);
  const hiddenCount = plays.length - visible.length;
  const emptyOK = (k) => LINE_CALLS[k] === "QUICK" || k === "blank";
  const [sel, setSel] = useState(null);
  const [b, setB] = useState({ formation: "Doubles", concept: "power", dir: "Rt", tags: [] });
  const [legacy, setLegacy] = useState({ name: "", formation: "", type: "Run", note: "" });
  const [editing, setEditing] = useState(false);
  const [ed, setEd] = useState({ sel: null, mode: "route", drawing: false });
  const [lookForm, setLookForm] = useState("Trips Rt");
  const [teach, setTeach] = useState(false);

  const nextNum = plays.reduce((m, p) => Math.max(m, Number(p.num) || 0), 0) + 1;
  const selected = plays.find((p) => p.id === sel) || null;
  const setPlay = (id, patch) => up({ plays: plays.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const addLook = () => {
    if (!selected || !selected.concept) return;
    const name = selected.concept === "blank" ? `${selected.name} (${lookForm})` : `${lookForm} · ${callWord(selected.concept, selected.dir, selected.tags || [])}`;
    /* That look already exists: jump to it instead of minting a duplicate. */
    const existing = plays.find((x) => x.name === name);
    if (existing) { setSel(existing.id); return; }
    const p = { ...selected, id: uid(), num: nextNum, formation: lookForm, core: false, custom: null, name };
    up({ plays: [...plays, p] });
    setSel(p.id);
  };

  /* ---- customize editor ---- */
  const custom = (selected && selected.custom) || { spots: {}, els: {} };
  const spotsNow = selected ? { ...formSpots(selected.formation || "Doubles"), ...(custom.spots || {}) } : {};
  const startLine = () => {
    if (!selected || !ed.sel) return;
    const els = { ...(custom.els || {}) };
    els[ed.sel] = [...(els[ed.sel] || []), { kind: ed.mode === "move" ? "route" : ed.mode, pts: [spotsNow[ed.sel]] }];
    setPlay(selected.id, { custom: { ...custom, els } });
    setEd({ ...ed, drawing: true });
  };
  const fieldClick = (pt) => {
    if (!selected || !ed.sel) return;
    if (ed.mode === "move") {
      setPlay(selected.id, { custom: { ...custom, spots: { ...(custom.spots || {}), [ed.sel]: pt } } });
      return;
    }
    if (!ed.drawing) return;
    const els = { ...(custom.els || {}) };
    const arr = [...(els[ed.sel] || [])];
    if (!arr.length) return;
    const lastEl = { ...arr[arr.length - 1], pts: [...arr[arr.length - 1].pts, pt] };
    arr[arr.length - 1] = lastEl;
    els[ed.sel] = arr;
    setPlay(selected.id, { custom: { ...custom, els } });
  };
  const clearPlayer = () => {
    if (!selected || !ed.sel) return;
    const els = { ...(custom.els || {}) };
    els[ed.sel] = [];
    setPlay(selected.id, { custom: { ...custom, els } });
    setEd({ ...ed, drawing: false });
  };
  const shuffleNums = () => {
    if (!window.confirm("Shuffle every play number randomly? The old numbers become meaningless to anyone who scouted you. Reprint wristbands after.")) return;
    const nums = plays.map((_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    up({ plays: plays.map((p, i) => ({ ...p, num: nums[i] })) });
  };
  const resetCustom = () => {
    if (!selected) return;
    if (!window.confirm("Reset this play to its generated diagram?")) return;
    setPlay(selected.id, { custom: null });
    setEd({ sel: null, mode: "route", drawing: false });
  };

  const concept = CONCEPTS[b.concept];
  const needsDir = concept && concept.dirs.includes("Rt");
  const bTags = b.tags || [];
  const toggleTag = (t) => setB({ ...b, tags: bTags.includes(t) ? bTags.filter((x) => x !== t) : [...bTags, t] });
  const buildName = `${b.formation} · ${callWord(b.concept, needsDir ? b.dir : "", bTags)}`;

  const addBuilt = () => {
    const p = {
      id: uid(), num: nextNum, formation: b.formation, concept: b.concept,
      dir: needsDir ? b.dir : "", tags: bTags, core: false, week: null,
      name: buildName, type: concept.fam === "Screen" ? "Screen" : concept.fam === "Special" ? "Special" : concept.fam, note: "",
    };
    up({ plays: [...plays, p] });
    setSel(p.id);
  };
  const addLegacy = () => {
    if (!legacy.name.trim()) return;
    up({ plays: [...plays, { id: uid(), num: nextNum, name: legacy.name.trim(), formation: legacy.formation.trim(), type: legacy.type, note: legacy.note.trim() }] });
    setLegacy({ name: "", formation: "", type: legacy.type, note: "" });
  };
  const duplicate = (id) => {
    const src = plays.find((p) => p.id === id);
    if (!src) return;
    if (src.concept && src.dir) {
      const nd = src.dir === "Rt" ? "Lt" : "Rt";
      up({ plays: [...plays, { ...src, id: uid(), num: nextNum, dir: nd, custom: null, name: `${src.formation} · ${callWord(src.concept, nd, src.tags || [])}` }] });
      return;
    }
    const flip = (s) => (/right|rt\b/i.test(s) ? s.replace(/Right/gi, "Left").replace(/\bRt\b/gi, "Lt") : /left|lt\b/i.test(s) ? s.replace(/Left/gi, "Right").replace(/\bLt\b/gi, "Rt") : s + " Copy");
    up({ plays: [...plays, { ...src, id: uid(), num: nextNum, name: flip(src.name) }] });
  };
  const remove = (id) => {
    const p = plays.find((x) => x.id === id);
    if (!window.confirm(`Delete play${p ? ` "${p.name}"` : ""}? It comes off the call sheet and wristbands too.`)) return;
    const cs = {};
    for (const k of Object.keys(data.callSheet || {})) cs[k] = (data.callSheet[k] || []).filter((pid) => pid !== id);
    const selWrist = data.wrist.selected === null ? null : data.wrist.selected.filter((pid) => pid !== id);
    up({ plays: plays.filter((x) => x.id !== id), callSheet: cs, wrist: { ...data.wrist, selected: selWrist } });
    if (sel === id) setSel(null);
  };

  const famGroups = { Run: [], Pass: [], Screen: [], Special: [] };
  for (const [k, c] of Object.entries(CONCEPTS)) famGroups[c.fam].push(k);

  const counts = {};
  for (const p of plays) counts[p.num] = (counts[p.num] || 0) + 1;
  const dups = Object.keys(counts).filter((n) => counts[n] > 1);

  return (
    <div className="two-col lab">
      <section className="panel">
        <div className="panel-head">
          <h2>Play Lab</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => setTeach(true)}>Teach Mode</button>
            <button className="btn ghost" onClick={onPrintSystem} title="The whole offense on one page, for new coaches">System Sheet</button>
            <button className="btn ghost" onClick={onPrintJobs}>Job Cards</button>
            <button className="btn ghost" onClick={shuffleNums} title="Re-encrypt: reassign every play number randomly, then reprint bands">Shuffle #s</button>
            <button className="btn ghost" onClick={onPrintBook}>Print Play Cards</button>
            <button className="btn ghost" onClick={onPrintSignals}>Print Signal Chart</button>
          </div>
        </div>
        <div className="builder">
          <b className="form-title">Build a play</b>
          <div className="builder-row">
            <select value={b.formation} onChange={(e) => { const f = e.target.value; setB({ ...b, formation: f, concept: f === "Empty" && !emptyOK(b.concept) ? "sparrow" : b.concept }); }}>
              {PLAY_FORM_NAMES.map((f) => <option key={f}>{f}</option>)}
            </select>
            <select value={b.concept} onChange={(e) => setB({ ...b, concept: e.target.value })}>
              {Object.entries(famGroups).map(([fam, keys]) => (
                <optgroup key={fam} label={fam}>
                  {keys.filter((k) => b.formation !== "Empty" || emptyOK(k)).map((k) => <option key={k} value={k}>{CONCEPTS[k].dirs[0] ? `${CONCEPTS[k].words.Rt} / ${CONCEPTS[k].words.Lt}` : CONCEPTS[k].words[""]}</option>)}
                </optgroup>
              ))}
            </select>
            {needsDir && (
              <select value={b.dir} onChange={(e) => setB({ ...b, dir: e.target.value })}>
                <option value="Rt">Rt</option><option value="Lt">Lt</option>
              </select>
            )}
            {["Jet", "Orbit", "Zip", "Now", "Wheel", "Max", ...(seasonWeek >= 5 ? ["Peek"] : [])].map((t) => (
              <label key={t} className={"tag-check" + (bTags.includes(t) ? " on" : "")}>
                <input type="checkbox" checked={bTags.includes(t)} onChange={() => toggleTag(t)} />{t}
              </label>
            ))}
            <button className="btn" onClick={addBuilt}>Add #{nextNum}</button>
          </div>
          <div className="builder-preview">
            <PlayDiagram play={{ formation: b.formation, concept: b.concept, dir: needsDir ? b.dir : "", tags: bTags }} size="small" />
            <div className="builder-call">
              {b.formation}{" · "}
              {LINE_CALLS[b.concept] && <span className="line-chip" style={{ margin: "0 4px" }}>{LINE_CALLS[b.concept]}</span>}
              {LINE_CALLS[b.concept] ? " " : "· "}{callWord(b.concept, needsDir ? b.dir : "", bTags)}
              {b.concept === "blank" && <span className="hint" style={{ margin: "0 0 0 8px" }}>(pick the line call on the play card)</span>}
              {b.formation === "Empty" && <span className="hint" style={{ margin: "0 0 0 8px" }}>Empty = QUICK family only. Nobody home to protect the QB.</span>}
            </div>
          </div>
        </div>
        <div className="lab-filter-row">
          <span className="hint" style={{ margin: 0 }}>Showing what's installed thru week {seasonWeek >= 9 ? 6 : seasonWeek} (the WEEK dial up top).</span>
          {hiddenCount > 0 && !showLater && <button className="btn ghost small" onClick={() => setShowLater(true)}>Show {hiddenCount} later installs</button>}
          {showLater && <button className="btn ghost small" onClick={() => setShowLater(false)}>Hide later installs</button>}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th style={{ width: 46 }}>No.</th><th>Play</th><th>Fam</th><th style={{ width: 44 }} title="Core plays are the memorized one-word calls">Core</th><th style={{ width: 40 }}>Wk</th><th></th></tr></thead>
            <tbody>
              {[...visible].sort((a, z) => a.num - z.num).map((p) => (
                <tr key={p.id} className={sel === p.id ? "sel-row" : ""} onClick={() => setSel(p.id)}>
                  <td><input className="cell num" type="number" key={p.id + ":" + p.num} defaultValue={p.num}
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => { const n = Number(e.target.value); if (n && n !== p.num) setPlay(p.id, { num: n }); }}
                    onKeyDown={(e) => e.key === "Enter" && e.target.blur()} /></td>
                  <td className="play-name-cell">{p.concept && CONCEPTS[p.concept] && p.concept !== "blank"
                    ? <b>{p.formation} · {lineCallFor(p) && <span className="row-line">{lineCallFor(p)} ·</span>} {callWord(p.concept, p.dir, p.tags || [])}</b>
                    : <b>{lineCallFor(p) && <span className="row-line">{lineCallFor(p)} ·</span>} {p.name}</b>}{p.concept && <span className="drill-notes"> {CONCEPTS[p.concept] ? "" : ""}</span>}</td>
                  <td><span className="type-dot" style={{ background: TYPE_COLORS[p.type] || "#5B616B" }} /></td>
                  <td><button className={"core-star" + (p.core ? " on" : "")} title="Core = one-word sideline call" onClick={(e) => { e.stopPropagation(); setPlay(p.id, { core: !p.core }); }}>★</button></td>
                  <td className="mono" style={{ fontSize: 11, color: "var(--muted)" }}>{p.week || ""}</td>
                  <td className="row-actions">
                    <button title={p.concept ? "Duplicate flipped (Rt/Lt)" : "Duplicate"} onClick={(e) => { e.stopPropagation(); duplicate(p.id); }}>⧉</button>
                    <button className="danger" onClick={(e) => { e.stopPropagation(); remove(p.id); }}>✕</button>
                  </td>
                </tr>
              ))}
              {plays.length === 0 && <tr><td colSpan={6} className="empty">Build your first play above.</td></tr>}
            </tbody>
          </table>
        </div>
        {dups.length > 0 && <div className="warn"><b>Duplicate play numbers:</b> {dups.map((n) => `#${n}`).join(", ")}. Kids read numbers off the wristband, so every play needs its own.</div>}
        <div className="drill-form">
          <b className="form-title">Add a custom play (no diagram)</b>
          <div className="builder-row">
            <input placeholder="Play name" value={legacy.name} onChange={(e) => setLegacy({ ...legacy, name: e.target.value })} />
            <input placeholder="Formation" style={{ width: 110 }} value={legacy.formation} onChange={(e) => setLegacy({ ...legacy, formation: e.target.value })} />
            <select value={legacy.type} onChange={(e) => setLegacy({ ...legacy, type: e.target.value })}>{PLAY_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <button className="btn" onClick={addLegacy}>Add</button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>{selected ? `#${selected.num} · ${selected.name}` : "Play Card"}</h2>
          {selected && (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" onClick={() => onPrintCard(selected.id)}>Print This Card</button>
              {selected.concept && CONCEPTS[selected.concept] && (
                <button className={"btn " + (editing ? "" : "ghost")} onClick={() => { setEditing(!editing); setEd({ sel: null, mode: "route", drawing: false }); }}>
                  {editing ? "Done Editing" : "Customize"}
                </button>
              )}
            </div>
          )}
        </div>
        {!selected && <div className="empty pad">Select a play to see its card: the diagram, the call, the signal, and the coaching points.</div>}
        {selected && (
          <div className="play-card">
            {selected.concept && CONCEPTS[selected.concept] ? (
              <>
                {editing && (
                  <div className="ed-toolbar">
                    <span className="ed-hint">{ed.sel ? `Editing ${ed.sel}:` : "Tap a player, then draw."}</span>
                    {["route", "carry", "block", "motion", "fake"].map((m) => (
                      <button key={m} className={"ed-mode " + m + (ed.mode === m ? " on" : "")} onClick={() => setEd({ ...ed, mode: m, drawing: false })}>{m}</button>
                    ))}
                    <button className="ed-mode" disabled={!ed.sel} onClick={() => startLine()}>{ed.drawing ? "Drawing… tap field" : "Start line"}</button>
                    <button className="ed-mode" disabled={!ed.sel} onClick={() => setEd({ ...ed, mode: "move", drawing: false })}>Move player</button>
                    <button className="ed-mode" disabled={!ed.sel} onClick={() => clearPlayer()}>Clear player</button>
                    <button className="ed-mode danger" onClick={() => resetCustom()}>Reset play</button>
                  </div>
                )}
                <PlayDiagram
                  play={selected}
                  editSel={editing ? ed.sel : null}
                  onPick={editing ? (label) => setEd({ ...ed, sel: label, drawing: false }) : undefined}
                  onField={editing ? fieldClick : undefined}
                />
                <div className="pc-meta">
                  <div className="pc-callrow">
                    {lineCallFor(selected) && <span className="line-chip">{lineCallFor(selected)}</span>}
                    <span className="pc-word">{callWord(selected.concept, selected.dir, selected.tags || [])}</span>
                    <span className={"pc-badge" + (selected.core ? " core" : "")}>{selected.core ? "CORE · one-word call" : `BAND · call "${selected.num}"`}</span>
                    {selected.custom && <span className="pc-badge">CUSTOMIZED</span>}
                    {selected.formation === "Empty" && lineCallFor(selected) !== "QUICK" && <span className="pc-badge" style={{ background: "var(--red)", color: "#fff" }}>EMPTY = QUICK ONLY</span>}
                  </div>
                  {selected.concept === "blank" && (
                    <input className="cell" placeholder="Name this play" value={selected.name} onChange={(e) => setPlay(selected.id, { name: e.target.value })} />
                  )}
                  {selected.concept === "blank" ? (
                    <div className="pc-line"><b>Line call:</b>{" "}
                      <select value={selected.lineCall || ""} onChange={(e) => setPlay(selected.id, { lineCall: e.target.value })}>
                        <option value="">(pick one)</option>
                        {LINE_WORDS.map((w) => <option key={w}>{w}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="pc-line"><b>Call it:</b> "{selected.formation === "Doubles" ? "" : selected.formation + "... "}{lineCallFor(selected)}... {callWord(selected.concept, selected.dir, selected.tags || [])}." The line only listens for {lineCallFor(selected) || "their word"} plus R or L.</div>
                  )}
                  <div className="pc-line"><b>Signal:</b> {CONCEPTS[selected.concept].signal}</div>
                  <div className="pc-line"><b>How it works:</b> {CONCEPTS[selected.concept].how}</div>
                  <div className="pc-line"><b>QB:</b> {CONCEPTS[selected.concept].read}</div>
                  <div className="pc-line"><b>Ball goes to:</b> {playCarrier(selected) || "your design"}</div>
                  {seasonWeek >= 4 && selected.concept !== "blank" && (
                    <div className="pc-line"><b>Kill to:</b>{" "}
                      <select value={selected.killId || ""} onChange={(e) => setPlay(selected.id, { killId: e.target.value || null })}>
                        <option value="">(none)</option>
                        {[...plays].filter((x) => x.id !== selected.id).sort((a, z) => a.num - z.num).map((x) => <option key={x.id} value={x.id}>#{x.num} {x.name}</option>)}
                      </select>
                      <span className="hint" style={{ margin: "0 0 0 8px" }}>Band shows both numbers. QB counts the box and yells KILL KILL to flip. Week 4 tool.</span>
                    </div>
                  )}
                  <div className="new-look">
                    <select value={lookForm} onChange={(e) => setLookForm(e.target.value)}>
                      {PLAY_FORM_NAMES.filter((f) => f !== selected.formation).map((f) => <option key={f}>{f}</option>)}
                    </select>
                    <button className="btn small" onClick={addLook}>Add This Look #{nextNum}</button>
                    <span className="hint" style={{ margin: 0 }}>Same play, new costume. Kids learn nothing new.</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="empty pad">Custom play, no generated diagram. Rebuild it in the builder to get one.</div>
            )}
            <input className="cell" placeholder="Coaching note for this play" value={selected.note || ""} onChange={(e) => setPlay(selected.id, { note: e.target.value })} />
          </div>
        )}
      </section>

      {teach && <TeachMode plays={visible} startId={sel} onClose={() => setTeach(false)} />}
    </div>
  );
}

/* ============================================================
   SIDELINE CALLER — three-speed tempo, tap to call, self-scout
   ============================================================ */
const RESULTS = ["Loss", "0-3", "4-9", "10+", "TD", "TO"];
function CallerTab({ data, up }) {
  const seasonWeek = data.seasonWeek || 1;
  const plays = [...data.plays].sort((a, z) => a.num - z.num);
  const log = data.callLog || [];
  const game = data.gameLabel || "";
  const gameLog = log.filter((e) => e.game === game);
  const last = gameLog[0] || null;

  const logCall = (p, note) => {
    up({ callLog: [{ id: uid(), t: Date.now(), game, playId: p.id, label: note ? `${note}: ${p.name}` : p.name, word: p.concept ? callWord(p.concept, p.dir, p.tags || []) : p.name, concept: p.concept || null, dir: p.dir || "", result: null }, ...log] });
    if (boardMode && !note) setBoard({ num: p.num, line: lineCallFor(p), word: p.concept ? callWord(p.concept, p.dir, p.tags || []) : p.name });
  };
  const setResult = (id, r) => up({ callLog: log.map((e) => (e.id === id ? { ...e, result: r } : e)) });
  const removeEntry = (id) => up({ callLog: log.filter((e) => e.id !== id) });
  const turbo = () => { const p = last && plays.find((x) => x.id === last.playId); if (p) logCall(p, "TURBO"); };
  const mirror = () => {
    const p = last && plays.find((x) => x.id === last.playId);
    if (!p) return;
    if (p.concept && p.dir) {
      const twin = plays.find((x) => x.concept === p.concept && x.formation === p.formation && x.dir === (p.dir === "Rt" ? "Lt" : "Rt"));
      if (twin) return logCall(twin, "MIRROR");
    }
    logCall(p, "MIRROR");
  };
  const clearGame = () => {
    if (!window.confirm(`Clear the log for "${game || "this game"}"?`)) return;
    up({ callLog: log.filter((e) => e.game !== game) });
  };

  const [wkFilter, setWkFilter] = useState(seasonWeek >= 9 ? 0 : seasonWeek);
  const [boardMode, setBoardMode] = useState(false);
  const [board, setBoard] = useState(null);

  /* ---- packages: one word, three snaps ---- */
  const packages = data.packages || [];
  const [pkgRun, setPkgRun] = useState(null); /* {name, ids, pos} */
  const resolvePkg = (pk) =>
    (pk.ids
      ? pk.ids.map((id) => plays.find((p) => p.id === id))
      : (pk.steps || []).map((s) =>
          plays.find((p) => p.concept === s.concept && (s.dir === "" || p.dir === s.dir) && p.formation === "Doubles") ||
          plays.find((p) => p.concept === s.concept && (s.dir === "" || p.dir === s.dir))
        )
    ).filter(Boolean);
  const startPkg = (pk) => { const ps = resolvePkg(pk); if (ps.length) setPkgRun({ name: pk.name, ids: ps.map((p) => p.id), pos: 0 }); };
  const callPkgNext = () => {
    if (!pkgRun) return;
    const p = plays.find((x) => x.id === pkgRun.ids[pkgRun.pos]);
    if (p) logCall(p);
    const pos = pkgRun.pos + 1;
    pos >= pkgRun.ids.length ? setPkgRun(null) : setPkgRun({ ...pkgRun, pos });
  };
  const removePkg = (id) => { if (window.confirm("Delete this package?")) up({ packages: packages.filter((x) => x.id !== id) }); };
  const [pkgName, setPkgName] = useState("");
  const [pkgPicks, setPkgPicks] = useState(["", "", ""]);
  const addPkg = () => {
    if (!pkgName.trim() || pkgPicks.some((x) => !x)) return;
    up({ packages: [...packages, { id: uid(), name: pkgName.trim().toUpperCase(), ids: [...pkgPicks] }] });
    setPkgName(""); setPkgPicks(["", "", ""]);
  };
  const installed = wkFilter > 0 ? plays.filter((p) => !p.week || p.week <= wkFilter) : plays;
  const core = installed.filter((p) => p.core);
  const rest = installed.filter((p) => !p.core);
  const fams = ["Run", "Pass", "Screen", "Special"];

  /* ---- opening script ---- */
  const script = data.script || [];
  const scriptPos = data.scriptPos || 0;
  const scriptPlays = script.map((id) => plays.find((p) => p.id === id)).filter(Boolean);
  const nextScripted = scriptPlays[scriptPos] || null;
  const addToScript = (id) => id && up({ script: [...script, id] });
  const removeFromScript = (i) => up({ script: script.filter((_, idx) => idx !== i), scriptPos: Math.min(scriptPos, Math.max(0, script.length - 2)) });
  const callScripted = () => { if (nextScripted) { logCall(nextScripted); up({ scriptPos: scriptPos + 1 }); } };
  const resetScript = () => up({ scriptPos: 0 });
  const loadSuggested = () => {
    const wants = [["power", "Rt"], ["jet", "Rt"], ["sparrow", ""], ["trap", "Rt"], ["owl", ""], ["bubble", "Rt"], ["power", "Lt"], ["keep", "Rt"], ["hawk", ""], ["eagle", ""]];
    const ids = wants.map(([c, d]) => (plays.find((p) => p.concept === c && (d === "" || p.dir === d)) || {}).id).filter(Boolean);
    up({ script: ids, scriptPos: 0 });
  };

  /* self-scout */
  const byWord = {};
  const touches = {};
  const byForm = {};
  for (const e of gameLog) {
    const k = e.word || e.label;
    byWord[k] = byWord[k] || { calls: 0, graded: 0, wins: 0 };
    byWord[k].calls++;
    if (e.result) { byWord[k].graded++; if (["4-9", "10+", "TD"].includes(e.result)) byWord[k].wins++; }
    const p = plays.find((x) => x.id === e.playId);
    const c = p && playCarrier(p);
    if (c) touches[c] = (touches[c] || 0) + 1;
    if (p && p.formation) {
      const f = (byForm[p.formation] = byForm[p.formation] || { calls: 0, runs: 0 });
      f.calls++;
      if (p.type === "Run" || p.type === "Special") f.runs++;
    }
  }

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel-head">
          <h2>Sideline Caller</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="cell" value={wkFilter} onChange={(e) => setWkFilter(Number(e.target.value))}>
              <option value={0}>All installed</option>
              <option value={1}>Thru week 1</option>
              <option value={2}>Thru week 2</option>
              <option value={3}>Thru week 3</option>
              <option value={4}>Thru week 4</option>
              <option value={5}>Thru week 5</option>
              <option value={6}>Thru week 6</option>
            </select>
            <input className="cell" style={{ width: 130 }} placeholder="Game (vs Hoover)" value={game} onChange={(e) => up({ gameLabel: e.target.value })} />
          </div>
        </div>
        <div className="tempo-row">
          <button className="tempo-btn turbo" disabled={!last || (last.label || "").startsWith("TURBO")} onClick={turbo} title="Same play again, snap it now. Never twice in a row.">TURBO</button>
          <button className="tempo-btn mirror" disabled={!last} onClick={mirror} title="Same play, other direction">MIRROR</button>
          {last && <span className="last-call">Last: <b>{last.word || last.label}</b></span>}
          <label className="tag-check" style={{ marginLeft: "auto" }} title="Tapping a play flashes its giant number to hold up. The board IS the call.">
            <input type="checkbox" checked={boardMode} onChange={(e) => setBoardMode(e.target.checked)} />Board mode
          </label>
        </div>
        {last && !last.result && (
          <div className="result-row">
            <span className="hint" style={{ margin: 0 }}>Result (optional):</span>
            {RESULTS.map((r) => <button key={r} className={"result-chip " + r.replace("+", "p")} onClick={() => setResult(last.id, r)}>{r}</button>)}
          </div>
        )}
        {seasonWeek >= 4 && last && (() => {
          const lp = plays.find((x) => x.id === last.playId);
          const kp = lp && lp.killId && plays.find((x) => x.id === lp.killId);
          return kp ? (
            <div className="result-row">
              <span className="hint" style={{ margin: 0 }}>Box heavy?</span>
              <button className="tempo-btn kill" onClick={() => logCall(kp, "KILL")}>KILL → {kp.concept ? callWord(kp.concept, kp.dir, kp.tags || []) : kp.name} #{kp.num}</button>
            </div>
          ) : null;
        })()}
        {seasonWeek >= 3 ? (
          <>
            <div className="caller-group-title core">PACKAGES · ONE WORD, THREE SNAPS</div>
            <div className="pkg-bar">
              {packages.map((pk) => (
                <span key={pk.id} className="pkg-wrap">
                  <button className="pkg-btn" onClick={() => startPkg(pk)} title={resolvePkg(pk).map((p) => p.name).join(" → ")}>{pk.name}</button>
                  <button className="pkg-x" title="Delete package" onClick={() => removePkg(pk.id)}>✕</button>
                </span>
              ))}
              {packages.length === 0 && <span className="hint" style={{ margin: 0 }}>No packages yet. Build one below.</span>}
            </div>
            {pkgRun && (() => {
              const p = plays.find((x) => x.id === pkgRun.ids[pkgRun.pos]);
              return (
                <div className="script-bar pkg-run">
                  <span className="script-next">{pkgRun.name} · {pkgRun.pos + 1} of {pkgRun.ids.length} · NEXT: <b>{p ? (p.concept ? callWord(p.concept, p.dir, p.tags || []) : p.name) : "?"}</b> <span className="mono">#{p ? p.num : ""}</span></span>
                  <button className="btn" onClick={callPkgNext}>CALL IT</button>
                  <button className="btn ghost small" onClick={() => setPkgRun(null)}>✕</button>
                </div>
              );
            })()}
            <div className="script-bar">
              <input className="cell" style={{ width: 110 }} placeholder="Name (RAID)" value={pkgName} onChange={(e) => setPkgName(e.target.value)} />
              {pkgPicks.map((v, i) => (
                <select key={i} className="cell" value={v} onChange={(e) => setPkgPicks(pkgPicks.map((x, j) => (j === i ? e.target.value : x)))}>
                  <option value="">{i + 1}…</option>
                  {plays.map((p) => <option key={p.id} value={p.id}>#{p.num} {p.name}</option>)}
                </select>
              ))}
              <button className="btn small" disabled={!pkgName.trim() || pkgPicks.some((x) => !x)} onClick={addPkg}>+ Package</button>
            </div>
          </>
        ) : (
          <div className="hint" style={{ padding: "4px 16px" }}>Packages (one word, three snaps at tempo) unlock at week 3 on the WEEK dial.</div>
        )}
        <div className="caller-group-title core">OPENING SCRIPT {scriptPlays.length > 0 && `· ${Math.min(scriptPos, scriptPlays.length)} of ${scriptPlays.length}`}</div>
        {scriptPlays.length === 0 ? (
          <div className="script-bar">
            <span className="hint" style={{ margin: 0 }}>Script your first ten before kickoff.</span>
            <button className="btn small" onClick={loadSuggested}>Load Suggested Opener</button>
          </div>
        ) : (
          <>
            <div className="script-bar">
              {nextScripted ? (
                <>
                  <span className="script-next">NEXT: <b>{nextScripted.concept ? callWord(nextScripted.concept, nextScripted.dir, nextScripted.tags || []) : nextScripted.name}</b> <span className="mono">#{nextScripted.num}</span></span>
                  <button className="btn" onClick={callScripted}>Call It</button>
                </>
              ) : (
                <>
                  <span className="script-next">Script complete. Now go hunt.</span>
                  <button className="btn ghost small" onClick={resetScript}>Restart</button>
                </>
              )}
            </div>
            <div className="script-chips">
              {scriptPlays.map((p, i) => (
                <span key={i} className={"script-chip" + (i < scriptPos ? " done" : i === scriptPos ? " up" : "")}>
                  {i + 1}. {p.concept ? callWord(p.concept, p.dir, p.tags || []) : p.name}
                  <button onClick={() => removeFromScript(i)}>✕</button>
                </span>
              ))}
            </div>
            <div className="script-bar">
              <select value="" onChange={(e) => addToScript(e.target.value)}>
                <option value="">+ add play to script…</option>
                {plays.map((p) => <option key={p.id} value={p.id}>#{p.num} {p.name}</option>)}
              </select>
            </div>
          </>
        )}
        <div className="caller-group-title core">THE SERIES · one-word calls</div>
        <div className="caller-grid">
          {core.map((p) => (
            <button key={p.id} className="call-btn core" onClick={() => logCall(p)}>
              <span className="cb-num">{p.num}</span>
              <span className="cb-word">{p.concept ? callWord(p.concept, p.dir, p.tags || []) : p.name}</span>
            </button>
          ))}
          {core.length === 0 && <div className="empty pad">Star plays in the Play Lab to make them one-word core calls.</div>}
        </div>
        {fams.map((fam) => {
          const list = rest.filter((p) => p.type === fam);
          if (!list.length) return null;
          return (
            <div key={fam}>
              <div className="caller-group-title">{fam.toUpperCase()} · wristband numbers</div>
              <div className="caller-grid">
                {list.map((p) => (
                  <button key={p.id} className="call-btn" onClick={() => logCall(p)}>
                    <span className="cb-num">{p.num}</span>
                    <span className="cb-word small">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <p className="hint">Call order: Formation, LINE WORD, play word (linemen only hear their word plus R or L). Numbers go on a dry-erase board, silent and meaningless without our band. Words are for TURBO only, where tempo outruns decoding. SWITCH (flip any word to its twin) lives on the board with a visual signal only, never voice, and not before week 5. Never Turbo twice in a row. Up two scores in the 4th, stop tapping and milk it.</p>
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Self-Scout {game && `· ${game}`}</h2></div>
        {gameLog.length === 0 && <div className="empty pad">Tap calls as you make them (or log them at halftime). You get efficiency by concept and touch counts for your playmakers, live.</div>}
        {Object.keys(touches).length > 0 && (
          <div className="touch-row">
            {Object.entries(touches).sort((a, z) => z[1] - a[1]).map(([who, n]) => (
              <span key={who} className="touch-chip"><b>{who}</b> {n} {n === 1 ? "touch" : "touches"}</span>
            ))}
          </div>
        )}
        {Object.keys(byWord).length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Call</th><th className="center">Calls</th><th className="center">Success</th></tr></thead>
              <tbody>
                {Object.entries(byWord).sort((a, z) => z[1].calls - a[1].calls).map(([w, s]) => (
                  <tr key={w}>
                    <td><b>{w}</b></td>
                    <td className="center mono">{s.calls}</td>
                    <td className="center mono">{s.graded ? Math.round((s.wins / s.graded) * 100) + "%" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {Object.keys(byForm).length > 0 && (
          <>
            <div className="caller-group-title">LOOKS REPORT · are we predictable?</div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Formation</th><th className="center">Calls</th><th className="center">Run %</th><th></th></tr></thead>
                <tbody>
                  {Object.entries(byForm).sort((a, z) => z[1].calls - a[1].calls).map(([f, s]) => {
                    const pct = Math.round((s.runs / s.calls) * 100);
                    const tell = s.calls >= 4 && (pct >= 80 || pct <= 20);
                    return (
                      <tr key={f}>
                        <td><b>{f}</b></td>
                        <td className="center mono">{s.calls}</td>
                        <td className="center mono">{pct}%</td>
                        <td>{tell && <span className="tell-flag">TENDENCY · break it</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {gameLog.length > 0 && (
          <>
            <div className="caller-group-title">CALL LOG</div>
            <div className="log-scroll">
              {gameLog.slice(0, 30).map((e) => (
                <div key={e.id} className="call-log-row">
                  <span className="mono log-time">{new Date(e.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                  <span className="log-label">{e.label}</span>
                  {e.result ? <span className={"result-chip tiny " + e.result.replace("+", "p")}>{e.result}</span> :
                    <span className="result-mini">{RESULTS.map((r) => <button key={r} onClick={() => setResult(e.id, r)}>{r === "Loss" ? "−" : r === "TO" ? "✗" : r === "TD" ? "6" : r}</button>)}</span>}
                  <button className="icon-btn danger" onClick={() => removeEntry(e.id)}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ padding: "10px 16px" }}><button className="btn ghost" onClick={clearGame}>Clear This Game's Log</button></div>
          </>
        )}
      </section>

      {board && (
        <div className="board-layer" onClick={() => setBoard(null)}>
          <div className="board-num">{board.num}</div>
          <div className="board-word">{board.line ? board.line + " · " : ""}{board.word}</div>
          <div className="board-hint">Hold it up · tap to clear</div>
        </div>
      )}
    </div>
  );
}

/* ---- bird route table: any kid can play any letter off this card ---- */
const ROUTE_TABLE = [
  { bird: "Sparrow", X: "Hitch at 5", H: "Quick out at 4", Y: "Stick at 5", Z: "Hitch at 5", RB: "Check, leak flat" },
  { bird: "Robin", X: "Slant", H: "Arrow to the flat", Y: "Flat", Z: "Slant", RB: "Check, leak flat" },
  { bird: "Hawk", X: "Curl at 8", H: "Flat", Y: "Corner at 8", Z: "Curl at 8", RB: "Check, leak flat" },
  { bird: "Owl", X: "Block", H: "Jet fake", Y: "Seam behind LBs", Z: "Block", RB: "Fake Rhino" },
  { bird: "Falcon", X: "Go", H: "Seam", Y: "Seam", Z: "Go", RB: "Checkdown" },
  { bird: "Eagle", X: "Post", H: "Block", Y: "Drag at 10", Z: "Go", RB: "Block" },
];

function RoutesPrint({ data }) {
  const copies = Math.max(1, Math.min(12, Number(data.wrist.copies) || 4));
  return (
    <div className="sheet">
      <PrintHead title="Bird Route Cards" right={<div className="p-meta">Cut, fold, tape into the wristband sleeve</div>} />
      <div className="routes-grid">
        {Array.from({ length: copies }, (_, i) => (
          <div key={i} className="routes-card">
            <div className="routes-title">BIRDS · bigger bird, deeper ball</div>
            <table className="routes-table">
              <thead><tr><th></th><th>X</th><th>H</th><th>Y</th><th>Z</th><th>RB</th></tr></thead>
              <tbody>
                {ROUTE_TABLE.map((r) => (
                  <tr key={r.bird}><td className="routes-bird">{r.bird}</td><td>{r.X}</td><td>{r.H}</td><td>{r.Y}</td><td>{r.Z}</td><td>{r.RB}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="routes-foot">Hear an animal: block your man.</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   TEACH MODE — fullscreen play presenter for chalk talks
   ============================================================ */
function TeachMode({ plays, startId, onClose }) {
  const list = [...plays].filter((p) => p.concept && CONCEPTS[p.concept]).sort((a, z) => a.num - z.num);
  const startIdx = Math.max(0, list.findIndex((p) => p.id === startId));
  const [i, setI] = useState(startIdx);
  const [hl, setHl] = useState(null);
  const [quiz, setQuiz] = useState(false);
  const [revealed, setRevealed] = useState(true);
  const play = list[i];

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); setI((x) => Math.min(list.length - 1, x + 1)); setRevealed(!quiz); }
      if (e.key === "ArrowLeft") { setI((x) => Math.max(0, x - 1)); setRevealed(!quiz); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, list.length, quiz]);

  if (!play) return null;
  const dimExcept = hl === null ? null : hl === "OL" ? ["LT", "LG", "C", "RG", "RT"] : hl === "XZ" ? ["X", "Z"] : [hl];
  const jobKey = hl === null ? null : jobKeyFor(hl === "OL" ? "LT" : hl === "XZ" ? "X" : hl);
  const job = jobKey && ASSIGNMENTS[play.concept] ? ASSIGNMENTS[play.concept][jobKey] : null;
  const word = callWord(play.concept, play.dir, play.tags || []);

  return (
    <div className="fv-layer">
      <div className="fv-toolbar">
        <div className="fv-brand"><span className="p-mark" style={{ width: 30, height: 30, fontSize: 14 }}>VH</span><b>TEACH MODE</b></div>
        <div className="teach-title">
          <span className="mono">#{play.num}</span>
          <span className="teach-form">{play.formation}</span>
          {lineCallFor(play) && !(quiz && !revealed) && <span className="line-chip dark">{lineCallFor(play)}</span>}
          <b>{quiz && !revealed ? "? ? ?" : word}</b>
          {quiz && !revealed && <button className="btn small" onClick={() => setRevealed(true)}>Reveal</button>}
        </div>
        <div className="fv-actions">
          <label className="tag-check" style={{ borderColor: "#4A4D53", color: "#B9BCC2" }}>
            <input type="checkbox" checked={quiz} onChange={(e) => { setQuiz(e.target.checked); setRevealed(!e.target.checked); }} />Quiz
          </label>
          <span className="fv-hint">Arrows flip plays · Esc closes</span>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="teach-stage">
        <button className="teach-nav" disabled={i === 0} onClick={() => { setI(i - 1); setRevealed(!quiz); }}>‹</button>
        <div className="teach-main">
          <PlayDiagram play={play} size="teach" dimExcept={dimExcept} />
          <div className="teach-hl-row">
            <button className={"teach-hl" + (hl === null ? " on" : "")} onClick={() => setHl(null)}>Everyone</button>
            {[["OL", "O-Line"], ["QB", "QB"], ["RB", "RB"], ["H", "H"], ["Y", "Y"], ["XZ", "X / Z"]].map(([k, lbl]) => (
              <button key={k} className={"teach-hl" + (hl === k ? " on" : "")} onClick={() => setHl(hl === k ? null : k)}>{lbl}</button>
            ))}
          </div>
          <div className="teach-job">
            {job ? job : (CONCEPTS[play.concept] ? CONCEPTS[play.concept].how : "")}
          </div>
        </div>
        <button className="teach-nav" disabled={i === list.length - 1} onClick={() => { setI(i + 1); setRevealed(!quiz); }}>›</button>
      </div>
    </div>
  );
}

/* ---- printable job cards: one card per position, kid language ---- */
function JobsPrint() {
  const order = ["power", "trap", "jet", "keep", "counter", "sneak", "sparrow", "robin", "hawk", "owl", "falcon", "eagle", "bubble", "slip", "reverse"];
  return (
    <div className="sheet">
      <PrintHead title="My Job Cards" right={<div className="p-meta">One card per position. Kid language. Laminate them.</div>} />
      <div className="jobs-grid">
        {JOB_GROUPS.map(([key, label]) => (
          <div key={key} className="jobs-card">
            <div className="routes-title">{label.toUpperCase()} · YOUR JOB ON EVERY PLAY</div>
            <table className="routes-table">
              <tbody>
                {order.map((c) => (
                  <tr key={c}>
                    <td className="routes-bird">{CONCEPTS[c].dirs[0] ? `${CONCEPTS[c].words.Rt} / ${CONCEPTS[c].words.Lt}` : CONCEPTS[c].words[""]}</td>
                    <td>{key === "OL" && LINE_CALLS[c] ? <span><b>{LINE_CALLS[c]}</b> · {ASSIGNMENTS[c][key]}</span> : ASSIGNMENTS[c][key]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="routes-foot">Bird = pass. Candy = screen. Everything else RUNS. R goes right, L goes left. Cadence: Set... GO.</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- printable play card book (for assistants) ---- */
function PlaybookPrint({ data }) {
  /* The book respects the WEEK dial: print what the team has installed,
     not all 58. Turn the dial to All (9) for the full book. */
  const wk = data.seasonWeek || 1;
  const list = [...data.plays]
    .filter((p) => p.concept && CONCEPTS[p.concept])
    .filter((p) => wk >= 9 || !p.week || p.week <= wk)
    .sort((a, z) => a.num - z.num);
  return (
    <div className="sheet">
      <PrintHead title="Rebel Safari Playbook" right={<div className="p-meta">{list.length} plays{wk < 9 ? ` · thru week ${wk}` : ""} · {todayStr()}</div>} />
      <div className="book-grid">
        {list.map((p) => (
          <div key={p.id} className="book-card">
            <div className="book-head">
              <span className="mono"><b>#{p.num}</b></span>
              <span className="book-line">{lineCallFor(p)}</span>
              <b>{callWord(p.concept, p.dir, p.tags || [])}</b>
              <span className="book-form">{p.formation}{p.core ? " · CORE" : ""}</span>
            </div>
            <PlayDiagram play={p} size="book" />
            <div className="book-notes">{CONCEPTS[p.concept].how}{p.note ? ` · ${p.note}` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---- one play, full coaching view, one page ---- */
function PlayCardPrint({ data, playId }) {
  const p = data.plays.find((x) => x.id === playId);
  if (!p) return <div className="sheet">Play not found.</div>;
  const c = p.concept && CONCEPTS[p.concept];
  const word = c ? callWord(p.concept, p.dir, p.tags || []) : p.name;
  const line = lineCallFor(p);
  return (
    <div className="sheet">
      <PrintHead title={`#${p.num} · ${p.name}`} right={<div className="p-meta">{todayStr()}</div>} />
      <div className="pc-callrow" style={{ marginBottom: 10 }}>
        {line && <span className="line-chip">{line}</span>}
        <span className="pc-word">{word}</span>
        {p.core && <span className="pc-badge core">CORE · ONE-WORD CALL</span>}
      </div>
      <PlayDiagram play={p} size="book" />
      {c && (
        <div style={{ margin: "10px 0" }}>
          <div className="pc-line"><b>Call it:</b> "{p.formation !== "Doubles" ? p.formation + "... " : ""}{line}... {word}." The line only listens for {line} plus R or L.</div>
          <div className="pc-line"><b>Signal:</b> {c.signal}</div>
          <div className="pc-line"><b>How it works:</b> {c.how}</div>
          <div className="pc-line"><b>QB:</b> {c.read}</div>
          <div className="pc-line"><b>Ball goes to:</b> {playCarrier(p) || "your design"}</div>
        </div>
      )}
      {p.note && <div className="pc-line" style={{ marginBottom: 10 }}><b>Coaching note:</b> {p.note}</div>}
      {c && ASSIGNMENTS[p.concept] && (
        <div className="jobs-grid">
          {JOB_GROUPS.map(([key, label]) => (
            <div key={key} className="jobs-card">
              <div className="routes-title">{label}</div>
              <div className="pc-line" style={{ padding: "6px 8px" }}>{ASSIGNMENTS[p.concept][key]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ---- the whole offense on one page, for brand new coaches ---- */
function SystemPrint() {
  const dict = [
    ["HAMMER", "Rhino / Lion", "Power. Down blocks, backside guard pulls and leads, RB downhill."],
    ["TRAP", "Rabbit / Lynx", "Quick trap up the middle. Hits before they blink."],
    ["REACH", "Rocket / Laser", "Jet sweep. H takes it at full speed."],
    ["REACH", "Raccoon / Longhorn", "QB keeps behind the jet fake."],
    ["WRAP", "Renegade / Lizard", "Counter, opposite the flow. Week 6."],
    ["SURGE", "Moose", "QB sneak behind the big center."],
    ["QUICK", "Sparrow", "Hitches at 5. Ball out now."],
    ["QUICK", "Robin", "Slants and flats. The money concept."],
    ["WALL", "Hawk", "Curls at 8 with flats under."],
    ["HAMMER", "Owl", "Looks exactly like Rhino. TE slips behind the linebackers."],
    ["WALL", "Falcon", "Four verticals. Coach picks the target."],
    ["WALL", "Eagle", "The deep shot, seven blocking."],
    ["QUICK", "Reese's / Laffy", "Bubble screen behind the jet fake."],
    ["GATE", "Rolo / Lifesaver", "Let the rush in, RB slips out behind it."],
    ["REACH", "Rewind / Loop", "The reverse. Once a game."],
  ];
  return (
    <div className="sheet">
      <PrintHead title="The Rebel Safari on One Page" right={<div className="p-meta">Hand this to every coach. This is the whole offense.</div>} />
      <div className="sys-rules">
        <div className="sys-rule"><b>1</b><span><b>Bird = pass. Candy = screen. Everything else RUNS.</b> Six birds fly. Four candies trick. Any other word is an animal on the ground: run it, block your man. Not sure? Block your man.</span></div>
        <div className="sys-rule"><b>2</b><span><b>R goes right. L goes left.</b> Rhino runs right, Lion runs left. If a kid can spell, he knows the direction.</span></div>
        <div className="sys-rule"><b>3</b><span><b>Your word is the only word.</b> Linemen listen for the FIRST word (their blocking). Everyone else listens for the SECOND word. Nobody decodes the whole call.</span></div>
        <div className="sys-rule"><b>4</b><span><b>"Set... GO." Every snap, all season.</b> One cadence. Zero procedure penalties.</span></div>
      </div>
      <div className="p-sec-title">HOW A CALL SOUNDS</div>
      <div className="sys-call">"Trips Right... <b>HAMMER</b>... <b>RHINO</b>." <span className="sys-note">Formation (skip it if Doubles) · line word · play word. That's it.</span></div>
      <div className="p-sec-title">THE DICTIONARY</div>
      <table className="p-table">
        <thead><tr><th style={{ width: "13%" }}>Line hears</th><th style={{ width: "22%" }}>Coach calls</th><th>What happens</th></tr></thead>
        <tbody>
          {dict.map((r, i) => <tr key={i}><td className="mono"><b>{r[0]}</b></td><td><b>{r[1]}</b></td><td>{r[2]}</td></tr>)}
        </tbody>
      </table>
      <div className="p-sec-title">SIDELINE WORDS</div>
      <div className="sys-call"><b>TURBO</b> = same play again, snap it now (never twice in a row) · <b>MIRROR</b> = same play, other side · <b>SWITCH</b> + word = run its twin (board signal only, week 5+) · Wristband numbers go on the board, never yelled</div>
      <div className="p-sec-title">WHO LEARNS WHAT</div>
      <div className="sys-call">Linemen: 7 words + the R/L rule. Backs: 5 paths. Receivers: animal means block, birds are on the wristband. QB: one read per bird. New coach: this page.</div>
      <div className="p-sec-title">YOUR FIRST PRACTICE</div>
      <div className="sys-call">Teach the four rules. Install Rhino, Lion, Sparrow. Rep "Set... GO" and sprint-align-look until it's boring. That's a real offense by Friday.</div>
    </div>
  );
}

function SignalsPrint({ data }) {
  const core = [...data.plays].filter((p) => p.core && p.concept).sort((a, z) => a.num - z.num);
  const others = [...data.plays].filter((p) => !p.core && p.concept).sort((a, z) => a.num - z.num);
  const row = (p) => (
    <tr key={p.id}>
      <td className="mono center"><b>{p.num}</b></td>
      <td className="mono">{lineCallFor(p)}</td>
      <td><b>{callWord(p.concept, p.dir, p.tags || [])}</b></td>
      <td>{p.name}</td>
      <td>{CONCEPTS[p.concept].signal}</td>
    </tr>
  );
  return (
    <div className="sheet">
      <PrintHead title="Sideline Call & Signal Chart" right={<div className="p-meta">{todayStr()}</div>} />
      <div className="p-sec-title">CORE · shout the word or throw the signal, no wristband needed</div>
      <table className="p-table">
        <thead><tr><th style={{ width: "7%" }}>#</th><th style={{ width: "11%" }}>Line</th><th style={{ width: "16%" }}>Call</th><th style={{ width: "28%" }}>Play</th><th>Signal</th></tr></thead>
        <tbody>{core.map(row)}</tbody>
      </table>
      <div className="p-sec-title">BAND · call the number, QB reads it off the wristband</div>
      <table className="p-table">
        <thead><tr><th style={{ width: "7%" }}>#</th><th style={{ width: "11%" }}>Line</th><th style={{ width: "16%" }}>Call</th><th style={{ width: "28%" }}>Play</th><th>Signal</th></tr></thead>
        <tbody>{others.map(row)}</tbody>
      </table>
      <div className="p-foot"><span>Call order: Formation, LINE WORD, play word · TURBO = same play again (never twice in a row) · MIRROR = other side · SWITCH = run its twin (board only) · Numbers on the board, never yelled</span><span>Set... GO</span></div>
    </div>
  );
}

/* ============================================================
   CALL SHEET
   ============================================================ */
function CallSheetTab({ data, up, onPrint }) {
  const cs = data.callSheet || {};
  const plays = data.plays;

  const addTo = (key, playId) => {
    if (!playId) return;
    const cur = cs[key] || [];
    if (cur.includes(playId)) return;
    up({ callSheet: { ...cs, [key]: [...cur, playId] } });
  };
  const removeFrom = (key, playId) =>
    up({ callSheet: { ...cs, [key]: (cs[key] || []).filter((id) => id !== playId) } });

  const anyAssigned = SITUATIONS.some((s) => (cs[s.key] || []).length > 0);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Call Sheet Builder</h2>
        <button className="btn" onClick={onPrint} disabled={!anyAssigned}>Print Call Sheet</button>
      </div>
      <p className="hint">Slot plays into game situations. A play can live in more than one box. Print, laminate, call the game.</p>
      <div className="cs-grid">
        {SITUATIONS.map((s) => (
          <div key={s.key} className="cs-box">
            <div className="cs-label">{s.label}</div>
            <div className="cs-plays">
              {(cs[s.key] || []).map((pid) => {
                const p = plays.find((x) => x.id === pid);
                if (!p) return null;
                return (
                  <span key={pid} className="cs-chip" style={{ borderColor: TYPE_COLORS[p.type] }}>
                    <b>{p.num}</b> {p.name}
                    <button onClick={() => removeFrom(s.key, pid)}>✕</button>
                  </span>
                );
              })}
            </div>
            <select value="" onChange={(e) => addTo(s.key, e.target.value)}>
              <option value="">+ Add play…</option>
              {[...plays].sort((a, b) => a.num - b.num)
                .filter((p) => !(cs[s.key] || []).includes(p.id))
                .map((p) => <option key={p.id} value={p.id}>#{p.num} {p.name} ({p.type})</option>)}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   WRISTBANDS
   ============================================================ */
function WristTab({ data, up, onPrint, onPrintRoutes }) {
  const w = data.wrist;
  const plays = [...data.plays].sort((a, b) => a.num - b.num);
  const selected = w.selected; // null = all
  const setW = (patch) => up({ wrist: { ...w, ...patch } });

  const isOn = (id) => selected === null || selected.includes(id);
  const toggle = (id) => {
    const base = selected === null ? plays.map((p) => p.id) : selected;
    setW({ selected: base.includes(id) ? base.filter((x) => x !== id) : [...base, id] });
  };

  const seasonWeek = data.seasonWeek || 1;
  const active = plays.filter((p) => isOn(p.id)).map((p) => ({
    ...p,
    _kill: seasonWeek >= 4 && p.killId ? (plays.find((x) => x.id === p.killId) || {}).num ?? null : null,
  }));

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel-head"><h2>Wristband Setup</h2></div>
        <div className="plan-meta">
          <label>Card title <input value={w.title} onChange={(e) => setW({ title: e.target.value })} /></label>
          <label>Columns
            <select value={w.cols} onChange={(e) => setW({ cols: Number(e.target.value) })}>
              <option value={2}>2</option><option value={3}>3 (standard)</option><option value={4}>4</option>
            </select>
          </label>
          <label>Cards per page
            <select value={w.copies} onChange={(e) => setW({ copies: Number(e.target.value) })}>
              {[1, 2, 4, 6].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
        <p className="hint">Cards print at 5" × 3", the standard triple-window youth wristband insert. Cut on the dashed lines and slide into the sleeve. Print one card per player who wears a band, plus spares.</p>
        <div className="check-head">
          <b>Plays on the band ({active.length})</b>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn ghost small" onClick={() => setW({ selected: null })}>All</button>
            <button className="btn ghost small" onClick={() => setW({ selected: [] })}>None</button>
          </div>
        </div>
        <div className="check-list">
          {plays.map((p) => (
            <label key={p.id} className="check-row">
              <input type="checkbox" checked={isOn(p.id)} onChange={() => toggle(p.id)} />
              <b className="mono">#{p.num}</b> {p.name} <span className="type-dot" style={{ background: TYPE_COLORS[p.type] }} />
            </label>
          ))}
          {plays.length === 0 && <div className="empty pad">Add plays in the Playbook tab first.</div>}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Preview</h2>
          <button className="btn ghost" onClick={onPrintRoutes}>Print Route Cards</button>
            <button className="btn" onClick={onPrint} disabled={active.length === 0}>Print Wristbands</button>
        </div>
        <div className="wrist-preview-wrap">
          <WristCard plays={active} title={w.title} cols={w.cols} />
        </div>
      </section>
    </div>
  );
}

function WristCard({ plays, title, cols }) {
  const perCol = Math.ceil(plays.length / cols) || 1;
  const columns = Array.from({ length: cols }, (_, c) => plays.slice(c * perCol, (c + 1) * perCol));
  const dense = perCol > 8;
  return (
    <div className="wrist-card">
      <div className="wrist-title">{title || "PLAYS"}</div>
      <div className="wrist-cols" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {columns.map((col, i) => (
          <div key={i} className="wrist-col">
            {col.map((p) => (
              <div key={p.id} className={"wrist-play" + (dense ? " dense" : "")}>
                <span className="wp-num">{p.num}</span>
                <span className="wp-name">
                  {p.concept && CONCEPTS[p.concept] && p.concept !== "blank"
                    ? <>{p.formation} · <span className="wp-line">{lineCallFor(p)}</span> · {callWord(p.concept, p.dir, p.tags || [])}</>
                    : <>{lineCallFor(p) && <span className="wp-line">{lineCallFor(p)} · </span>}{p.name}</>}
                </span>
                {p._kill != null && <span className="wp-kill">K{p._kill}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   PRACTICE GROUPS — one click, three coaching groups
   ============================================================ */
function PracticeGroupsView({ data, up, onClose, onPrint }) {
  const { out, multi, unassigned } = practiceGroupsFor(data);
  const overrides = data.pgOverrides || {};
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const setOverride = (id, g) => up({ pgOverrides: { ...overrides, [id]: g } });
  const clearOverride = (id) => { const o = { ...overrides }; delete o[id]; up({ pgOverrides: o }); };
  const label = (g) => (PG_GROUPS.find(([k]) => k === g) || [])[1] || g;
  return (
    <div className="pg-view">
      <div className="pg-head">
        <div>
          <h2 style={{ margin: 0 }}>Practice Groups</h2>
          <p className="hint" style={{ margin: "2px 0 0" }}>Built from the depth chart, offense and defense combined. A two-way kid lands with his best slot; tap a chip to move him for tonight. Moves are remembered.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={onPrint}>Print</button>
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      </div>
      <div className="pg-cols">
        {PG_GROUPS.map(([key, name]) => (
          <div key={key} className={"pg-col " + key}>
            <div className="pg-col-head">{name} <span className="pg-count">{out[key].length}</span></div>
            {out[key].map(({ p, groups }) => (
              <div key={p.id} className="pg-player">
                <b className="mono">#{p.num || "–"}</b> {p.name}
                <span className="pg-chips">
                  {groups.filter((g) => g !== key).map((g) => (
                    <button key={g} className="pg-chip" title={"Also on the depth chart as " + label(g) + ". Tap to move him there."} onClick={() => setOverride(p.id, g)}>→ {label(g)}</button>
                  ))}
                  {overrides[p.id] && <button className="pg-chip undo" title="Back to his default group" onClick={() => clearOverride(p.id)}>⟲</button>}
                </span>
              </div>
            ))}
            {out[key].length === 0 && <div className="empty pad">Nobody yet.</div>}
          </div>
        ))}
      </div>
      {multi.length > 0 && (
        <p className="hint" style={{ padding: "0 16px" }}>{multi.length} two-group {multi.length === 1 ? "kid" : "kids"} on this roster. They show a chip in their column above.</p>
      )}
      {unassigned.length > 0 && (
        <div className="pg-unassigned">
          <b>Not on the depth chart yet:</b>
          {unassigned.map((p) => (
            <span key={p.id} className="pg-player loose">
              <b className="mono">#{p.num || "–"}</b> {p.name}
              {PG_GROUPS.map(([g, nm]) => <button key={g} className="pg-chip" onClick={() => setOverride(p.id, g)}>{nm}</button>)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupsPrint({ data }) {
  const { out, unassigned } = practiceGroupsFor(data);
  const label = (g) => (PG_GROUPS.find(([k]) => k === g) || [])[1] || g;
  return (
    <div className="sheet">
      <PrintHead title="Practice Groups" right={<div className="p-meta">{todayStr()}</div>} />
      <div className="pg-print-cols">
        {PG_GROUPS.map(([key, name]) => (
          <div key={key} className="pg-print-col">
            <div className="p-sec-title">{name} · {out[key].length}</div>
            <table className="p-table">
              <tbody>
                {out[key].map(({ p, groups }) => (
                  <tr key={p.id}>
                    <td className="mono" style={{ width: 34 }}>{p.num || "–"}</td>
                    <td>{p.name}{groups.length > 1 ? <span className="p-meta"> (also {groups.filter((g) => g !== key).map(label).join(", ")})</span> : null}</td>
                  </tr>
                ))}
                {out[key].length === 0 && <tr><td>—</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      {unassigned.length > 0 && (
        <div className="p-foot"><span>Not on the depth chart: {unassigned.map((p) => `#${p.num || "–"} ${p.name}`).join(" · ")}</span></div>
      )}
    </div>
  );
}

/* ============================================================
   FORMATION CARDS PRINT — every installed look with 1st-team names
   ============================================================ */
function FormationsPrint({ data }) {
  const week = (data.seasonWeek || 1) >= 9 ? 6 : data.seasonWeek || 1;
  const forms = installedForms(week);
  const playMap = resolvePlayMap(data);
  const lastName = (p) => (p ? p.name.trim().split(/\s+/).slice(-1)[0] : "");
  return (
    <div className="sheet">
      <PrintHead title="Formation Cards" right={<div className="p-meta">Installed thru week {week} · {todayStr()}</div>} />
      <div className="fp-grid">
        {forms.map((f) => {
          const spots = fvSpread(formSpots(f), 2, 8);
          return (
            <div key={f} className="fp-card">
              <div className="fp-title">{f.toUpperCase()}</div>
              <div className="fp-field">
                <div className="fp-los" />
                {Object.entries(spots).map(([label, [x, y]]) => {
                  const schemePos = playMap[label];
                  const starter = schemePos ? slotsFor(data, "off", schemePos)[0] : null;
                  const trav = label === "H" || label === "Y";
                  const ol = ["LT", "LG", "C", "RG", "RT"].includes(label);
                  return (
                    <div key={label} className={"fp-dot" + (trav ? " trav" : "") + (ol ? " ol" : "")} style={{ left: `${x}%`, top: `${8 + (y - 22) * 6}%` }}>
                      <span className="fp-label">{label}</span>
                      {!ol && <span className="fp-name">{starter ? `${starter.num ? "#" + starter.num + " " : ""}${lastName(starter)}` : "open"}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="p-foot"><span>Gold = travelers (H and Y). Rt / Lt flips the picture. One card per look, kids find their name.</span></div>
    </div>
  );
}

/* ============================================================
   PRINT LAYER
   ============================================================ */
function PrintLayer({ target, data, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="print-layer">
      <div className="print-toolbar no-print">
        <span>Print preview — use landscape for the call sheet, portrait for everything else.</span>
        <div>
          <button className="btn" onClick={() => window.print()}>Print</button>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="print-page">
        {target === "practice" && <PracticePrint data={data} />}
        {target === "callsheet" && <CallSheetPrint data={data} />}
        {target === "wrist" && <WristPrint data={data} />}
        {target === "gameday" && <GameDayPrint data={data} />}
        {target === "signals" && <SignalsPrint data={data} />}
        {target === "playbook" && <PlaybookPrint data={data} />}
        {typeof target === "string" && target.startsWith("playcard:") && <PlayCardPrint data={data} playId={target.slice("playcard:".length)} />}
        {target === "routes" && <RoutesPrint data={data} />}
        {target === "jobs" && <JobsPrint />}
        {target === "system" && <SystemPrint />}
        {target === "groups" && <GroupsPrint data={data} />}
        {target === "formations" && <FormationsPrint data={data} />}
      </div>
    </div>
  );
}

function PrintHead({ title, right }) {
  return (
    <div className="p-head">
      <div className="p-mark">VH</div>
      <div className="p-head-text">
        <div className="p-team">VESTAVIA HILLS REBELS · 6TH GRADE</div>
        <div className="p-title">{title}</div>
      </div>
      <div className="p-right">{right}</div>
    </div>
  );
}

function PracticePrint({ data }) {
  const schedule = buildSchedule(data.practice, data.drills);
  const total = schedule.reduce((s, r) => s + r.mins, 0);
  return (
    <div className="sheet">
      <PrintHead title={data.practice.title || "Practice Plan"} right={<>
        <div className="p-meta">{data.practice.date || todayStr()}</div>
        <div className="p-meta">Start {fmtTime(parseStart(data.practice.start))} · {total} min</div>
      </>} />
      <table className="p-table">
        <thead>
          <tr><th style={{ width: "17%" }}>Time</th><th>Period · Stations run at the same time</th><th style={{ width: "7%" }}>Min</th></tr>
        </thead>
        <tbody>
          {schedule.map((r) => (
            <tr key={r.id}>
              <td className="mono" style={{ verticalAlign: "top", paddingTop: 9 }}>{r.start} – {r.end}</td>
              <td>
                {r.stations.map((st) => (
                  <div key={st.stationId} className="p-station">
                    <span className="p-cat" style={{ background: CAT_COLORS[st.cat] }}>{st.cat}</span>
                    <span className="p-group" style={{ color: groupTone(st.group), borderColor: groupTone(st.group) }}>{st.group}</span>
                    <b>{st.name}</b>
                    {st.notes && <span className="p-station-notes"> · {st.notes}</span>}
                  </div>
                ))}
              </td>
              <td className="mono center" style={{ verticalAlign: "top", paddingTop: 9 }}>{r.mins}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-foot">
        <span>Ends {fmtTime(parseStart(data.practice.start) + total)}</span>
        <span>Water every 2 periods · Break it down together</span>
      </div>
    </div>
  );
}

function CallSheetPrint({ data }) {
  const cs = data.callSheet || {};
  return (
    <div className="sheet">
      <PrintHead title="Offensive Call Sheet" right={<div className="p-meta">{todayStr()}</div>} />
      <div className="p-cs-grid">
        {SITUATIONS.map((s) => (
          <div key={s.key} className="p-cs-box">
            <div className="p-cs-label">{s.label}</div>
            {(cs[s.key] || []).map((pid) => {
              const p = data.plays.find((x) => x.id === pid);
              if (!p) return null;
              return (
                <div key={pid} className="p-cs-play">
                  <span className="p-cs-num" style={{ background: TYPE_COLORS[p.type] }}>{p.num}</span>
                  <span className="p-cs-name">{p.name}</span>
                  <span className="p-cs-form">{p.formation}</span>
                </div>
              );
            })}
            {(cs[s.key] || []).length === 0 && <div className="p-cs-empty">—</div>}
          </div>
        ))}
      </div>
      <div className="p-foot">
        <span><span className="key-dot" style={{ background: TYPE_COLORS.Run }} /> Run &nbsp; <span className="key-dot" style={{ background: TYPE_COLORS.Pass }} /> Pass &nbsp; <span className="key-dot" style={{ background: TYPE_COLORS.Screen }} /> Screen &nbsp; <span className="key-dot" style={{ background: TYPE_COLORS.Special }} /> Special</span>
        <span>Timeouts: ☐ ☐ ☐</span>
      </div>
    </div>
  );
}

function WristPrint({ data }) {
  const w = data.wrist;
  const plays = [...data.plays].sort((a, b) => a.num - b.num).filter((p) => w.selected === null || w.selected.includes(p.id));
  return (
    <div className="sheet">
      <div className="wrist-print-grid">
        {Array.from({ length: w.copies }, (_, i) => (
          <div key={i} className="wrist-cut">
            <WristCard plays={plays} title={w.title} cols={w.cols} />
          </div>
        ))}
      </div>
      <div className="p-foot no-border"><span>Cut on dashed lines · fits 5" × 3" wristband inserts</span></div>
    </div>
  );
}

function GameDayPrint({ data }) {
  const boxes = 12;
  return (
    <div className="sheet">
      <PrintHead title="Game Day Roster & Play Count" right={<>
        <div className="p-meta">vs ______________________</div>
        <div className="p-meta">{todayStr()}</div>
      </>} />
      <table className="p-table">
        <thead>
          <tr>
            <th style={{ width: "7%" }}>#</th>
            <th style={{ width: "26%" }}>Player</th>
            <th style={{ width: "12%" }}>Off</th>
            <th style={{ width: "12%" }}>Def</th>
            <th style={{ width: "28%" }}>Snaps (tally)</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {data.players.map((p) => (
            <tr key={p.id} className="gd-row">
              <td className="mono center"><b>{p.num}</b></td>
              <td>{p.name}</td>
              <td>{assignmentsFor(data, "off", p.id).map((a) => `${a.pos} ${a.team}`).join(" · ")}</td>
              <td>{assignmentsFor(data, "def", p.id).map((a) => `${a.pos} ${a.team}`).join(" · ")}</td>
              <td className="snap-cells">{Array.from({ length: boxes }, (_, i) => <span key={i} className="snap-box" />)}</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-foot"><span>Every kid plays. Track it so nobody gets missed.</span><span>Final: ____ — ____</span></div>
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */
function Styles() {
  return (
    <style>{`
@import url('https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@500;600;700&family=Roboto:wght@400;500;600;700&display=swap');

:root {
  --red: #C32032;
  --red-dark: #9A1927;
  --ink: #23356F;
  --paper: #FBFAF8;
  --panel: #FFFFFF;
  --line: #E2DFD8;
  --muted: #6B6F76;
  --def-blue: #23356F;
  --blue: #23356F;      /* PMS 288, VHCS primary */
  --lt-blue: #7DCBF1;   /* PMS 115-5, accent/trim only */
  --gold: #EAAA00;      /* PMS 124, accent/trim only */
  --disp: 'Roboto Condensed', 'Arial Narrow', sans-serif;
  --body: 'Roboto', system-ui, sans-serif;
  --mono: ui-monospace, 'SF Mono', Menlo, monospace;
}
* { box-sizing: border-box; }
.root { min-height: 100vh; background: var(--paper); font-family: var(--body); color: var(--ink); font-size: 14px; }
.mono { font-family: var(--mono); }

/* ---- masthead ---- */
.masthead { background: var(--ink); color: #fff; display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; }
.mast-left { display: flex; align-items: center; gap: 14px; }
.mark { background: var(--red); color: #fff; font-family: var(--disp); font-weight: 700; font-size: 22px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; letter-spacing: 1px; box-shadow: 3px 3px 0 rgba(255,255,255,.15); }
.team-line { font-family: var(--disp); font-weight: 700; font-size: 24px; letter-spacing: 2.5px; line-height: 1; }
.sub-line { font-size: 10px; letter-spacing: 2.5px; color: #B9BCC2; margin-top: 4px; }
.save-chip { font-size: 11px; letter-spacing: 1px; color: #9DA1A8; text-transform: uppercase; }
button.save-chip.error { appearance: none; background: transparent; border: 1px solid #EAAA00; color: #EAAA00; font-family: inherit; padding: 6px 10px; cursor: pointer; min-height: 32px; }
.mast-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

/* ---- play lab ---- */
.builder { padding: 12px 16px; border-bottom: 1px solid var(--line); display: grid; gap: 10px; background: #F6F4EF; }
.builder-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.builder-preview { display: flex; gap: 12px; align-items: center; }
.builder-call { font-family: var(--disp); font-weight: 700; font-size: 18px; letter-spacing: 1px; }
.play-svg { border: 1px solid var(--line); background: #F3F6F2; display: block; }
.play-svg.big { width: 100%; }
.play-svg.small { width: 220px; flex-shrink: 0; }
.sel-row { background: #FDF3F4; }
tbody tr { cursor: pointer; }
.core-star { appearance: none; background: none; border: none; font-size: 16px; color: var(--line); cursor: pointer; }
.core-star.on { color: #B7791F; }
.play-card { padding: 14px 16px; display: grid; gap: 12px; }
.pc-callrow { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pc-word { font-family: var(--disp); font-weight: 700; font-size: 34px; letter-spacing: 2px; text-transform: uppercase; color: var(--red); }
.pc-badge { font-family: var(--disp); font-weight: 600; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; padding: 3px 9px; background: var(--line); color: var(--muted); }
.pc-badge.core { background: #B7791F; color: #fff; }
.pc-line { font-size: 13px; line-height: 1.45; }
.pc-meta { display: grid; gap: 6px; }

/* ---- sideline caller ---- */
.tempo-row { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.tempo-btn { appearance: none; border: none; color: #fff; font-family: var(--disp); font-weight: 700; font-size: 20px; letter-spacing: 2px; padding: 12px 22px; cursor: pointer; }
.tempo-btn.turbo { background: var(--red); }
.tempo-btn.turbo:active { background: var(--red-dark); }
.tempo-btn.mirror { background: var(--ink); }
.tempo-btn:disabled { opacity: .35; cursor: default; }
.last-call { font-size: 13px; color: var(--muted); }
.result-row { display: flex; align-items: center; gap: 6px; padding: 10px 16px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
.result-chip { appearance: none; border: 1px solid var(--line); background: #fff; font-family: var(--disp); font-weight: 700; font-size: 13px; padding: 5px 10px; cursor: pointer; }
.result-chip.TD { border-color: #0F6B4F; color: #0F6B4F; }
.result-chip.TO, .result-chip.Loss { border-color: var(--red); color: var(--red); }
.result-chip.tiny { font-size: 11px; padding: 1px 6px; cursor: default; }
.caller-group-title { font-family: var(--disp); font-weight: 700; font-size: 13px; letter-spacing: 2px; color: var(--muted); padding: 12px 16px 6px; }
.caller-group-title.core { color: #B7791F; }
.caller-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; padding: 0 16px 12px; }
.call-btn { appearance: none; border: 2px solid var(--ink); background: #fff; cursor: pointer; padding: 10px 6px; display: grid; justify-items: center; gap: 2px; min-height: 64px; }
.call-btn:active { background: #FDF3F4; }
.call-btn.core { border-color: #B7791F; background: #FFFBF2; }
.cb-num { font-family: var(--mono); font-weight: 700; font-size: 11px; color: var(--muted); }
.cb-word { font-family: var(--disp); font-weight: 700; font-size: 19px; letter-spacing: 1px; text-transform: uppercase; text-align: center; line-height: 1; }
.cb-word.small { font-size: 13px; letter-spacing: .5px; text-transform: none; }
.touch-row { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.touch-chip { border: 1px solid var(--line); padding: 4px 10px; font-size: 12.5px; }
.touch-chip b { font-family: var(--disp); font-size: 14px; color: var(--red); margin-right: 4px; }
.log-scroll { max-height: 320px; overflow-y: auto; }
.call-log-row { display: flex; align-items: center; gap: 8px; padding: 6px 16px; border-bottom: 1px dotted var(--line); font-size: 12.5px; }
.log-time { color: var(--muted); font-size: 11px; flex-shrink: 0; }
.log-label { flex: 1; min-width: 0; }
.result-mini { display: flex; gap: 2px; }
.result-mini button { appearance: none; border: 1px solid var(--line); background: #fff; font-size: 10px; padding: 1px 5px; cursor: pointer; }
.p-sec-title { font-family: var(--disp); font-weight: 700; font-size: 13px; letter-spacing: 2px; margin: 14px 0 6px; color: var(--muted); }

/* ---- play editor ---- */
.play-svg.editing { cursor: crosshair; outline: 2px dashed #B7791F; }
.ed-toolbar { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding: 8px 0; }
.ed-hint { font-size: 12px; color: var(--muted); margin-right: 4px; }
.ed-mode { appearance: none; border: 1px solid var(--line); background: #fff; font-size: 11.5px; padding: 4px 8px; cursor: pointer; text-transform: capitalize; }
.ed-mode.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.ed-mode.danger { color: var(--red); border-color: var(--red); }
.ed-mode:disabled { opacity: .4; cursor: default; }
.ed-mode.carry.on { background: var(--red); border-color: var(--red); }
.tag-check { display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--line); padding: 5px 9px; font-size: 12px; cursor: pointer; user-select: none; }
.tag-check.on { border-color: #B7791F; background: #FFFBF2; font-weight: 600; }
.tag-check input { margin: 0; }

/* ---- formation school + cards ---- */
.fv-flash { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; z-index: 3; pointer-events: none; }
.fv-flash.revealed { inset: auto 0 4% 0; }
.fv-flash-name { font-family: var(--disp); font-size: clamp(56px, 12vw, 150px); letter-spacing: 4px; color: #fff; text-shadow: 0 2px 0 rgba(0,0,0,0.4); text-transform: uppercase; }
.fv-flash.revealed .fv-flash-name { font-size: clamp(28px, 5vw, 56px); }
.fv-flash-hint { font-size: 16px; color: #FFD24D; letter-spacing: 1px; }
.btn.gold { background: var(--gold, #EAAA00); border-color: var(--gold, #EAAA00); color: #1C2430; }
.fp-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.fp-card { border: 1.5px solid var(--ink); border-radius: 8px; overflow: hidden; break-inside: avoid; }
.fp-title { font-family: var(--disp); letter-spacing: 1.5px; background: var(--ink); color: #fff; padding: 3px 8px; font-size: 13px; }
.fp-field { position: relative; height: 150px; background: #FBF7EE; }
.fp-los { position: absolute; left: 4%; right: 4%; top: 14%; border-top: 1.5px dashed #9AA0A8; }
.fp-dot { position: absolute; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 1px; }
.fp-label { width: 20px; height: 20px; border-radius: 50%; background: #fff; border: 1.5px solid var(--ink); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 9px; }
.fp-dot.ol .fp-label { background: #9AA0A8; color: #fff; width: 16px; height: 16px; font-size: 8px; }
.fp-dot.trav .fp-label { background: var(--gold, #EAAA00); }
.fp-name { font-size: 8.5px; font-weight: 700; white-space: nowrap; background: rgba(255,255,255,0.85); padding: 0 3px; border-radius: 3px; }

/* ---- week dial ---- */
.week-dial { display: inline-flex; align-items: center; gap: 6px; font-family: var(--disp); font-size: 13px; letter-spacing: 1.5px; color: #fff; }
.week-dial select { background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.35); border-radius: 6px; padding: 3px 6px; font-family: var(--disp); font-size: 14px; }
.week-dial select option { color: var(--ink); }

/* ---- packages ---- */
.pkg-bar { display: flex; align-items: center; gap: 8px; padding: 8px 16px; flex-wrap: wrap; }
.pkg-wrap { display: inline-flex; align-items: stretch; }
.pkg-btn { font-family: var(--disp); font-size: 18px; letter-spacing: 1.5px; padding: 8px 14px; border: 2px solid var(--ink); border-radius: 8px 0 0 8px; background: var(--gold); color: var(--ink); cursor: pointer; }
.pkg-btn:hover { background: #FFC933; }
.pkg-x { border: 2px solid var(--ink); border-left: none; border-radius: 0 8px 8px 0; background: #fff; cursor: pointer; padding: 0 8px; color: #99310f; }
.pkg-run { background: #FFF8E1; }
.tempo-btn.kill { background: var(--red); color: #fff; border-color: var(--red); }

/* ---- practice groups ---- */
.pg-view { position: fixed; inset: 0; background: #FBFAF8; z-index: 70; overflow: auto; padding-bottom: 24px; }
.pg-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; padding: 16px; border-bottom: 3px solid var(--ink); background: #fff; position: sticky; top: 0; z-index: 2; }
.pg-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px; }
@media (max-width: 760px) { .pg-cols { grid-template-columns: 1fr; } }
.pg-col { background: #fff; border: 2px solid var(--ink); border-radius: 10px; overflow: hidden; }
.pg-col-head { font-family: var(--disp); font-size: 20px; letter-spacing: 1.5px; text-transform: uppercase; padding: 8px 12px; background: var(--ink); color: #fff; display: flex; justify-content: space-between; }
.pg-col.skill .pg-col-head { background: var(--red); }
.pg-col.line .pg-col-head { background: var(--ink); }
.pg-col.backs .pg-col-head { background: #3d4450; }
.pg-count { background: rgba(255,255,255,0.2); border-radius: 12px; padding: 0 10px; }
.pg-player { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-bottom: 1px solid #eee; font-size: 14px; flex-wrap: wrap; }
.pg-player.loose { border: none; padding: 4px 8px; }
.pg-chips { margin-left: auto; display: inline-flex; gap: 6px; }
.pg-chip { font-size: 11px; border: 1px solid var(--ink); border-radius: 999px; padding: 2px 8px; background: #fff; cursor: pointer; }
.pg-chip:hover { background: var(--gold); }
.pg-chip.undo { border-style: dashed; }
.pg-unassigned { margin: 0 16px; padding: 10px 12px; background: #FFF3CD; border: 2px dashed #b8860b; border-radius: 10px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; font-size: 14px; }
.lab-filter-row { display: flex; align-items: center; gap: 10px; padding: 6px 16px 0; flex-wrap: wrap; }
.pg-print-cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.wp-kill { font-family: var(--disp); font-size: 11px; background: var(--red); color: #fff; border-radius: 4px; padding: 0 4px; margin-left: 4px; }

/* ---- opening script ---- */
.script-bar { display: flex; align-items: center; gap: 10px; padding: 8px 16px; flex-wrap: wrap; }
.script-next { font-size: 14px; }
.script-next b { font-family: var(--disp); font-size: 20px; letter-spacing: 1px; text-transform: uppercase; color: var(--red); }
.script-chips { display: flex; gap: 6px; flex-wrap: wrap; padding: 4px 16px 8px; }
.script-chip { display: inline-flex; align-items: center; gap: 5px; border: 1px solid var(--line); padding: 3px 8px; font-size: 12px; }
.script-chip.done { opacity: .45; text-decoration: line-through; }
.script-chip.up { border-color: var(--red); background: #FDF3F4; font-weight: 600; }
.script-chip button { appearance: none; border: none; background: none; color: var(--muted); cursor: pointer; font-size: 11px; padding: 0; }

/* ---- play card book print ---- */
.book-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 10px; }
.book-card { border: 1.5px solid var(--ink); page-break-inside: avoid; }
.book-head { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-bottom: 1px solid var(--ink); font-size: 12px; }
.book-head b { font-family: var(--disp); font-size: 15px; letter-spacing: 1px; text-transform: uppercase; }
.book-form { margin-left: auto; color: var(--muted); font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; }
.book-line { font-family: var(--disp); font-weight: 700; font-size: 10px; letter-spacing: 1px; background: var(--ink); color: #EAAA00; padding: 1px 5px; }
.play-svg.book { width: 100%; border: none; }
.book-notes { padding: 4px 8px; font-size: 10px; color: var(--muted); border-top: 1px solid var(--line); }

.new-look { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 6px; border-top: 1px dotted var(--line); margin-top: 4px; }
.tell-flag { font-family: var(--disp); font-weight: 700; font-size: 10.5px; letter-spacing: 1px; color: #fff; background: var(--red); padding: 2px 7px; }

.line-chip { font-family: var(--disp); font-weight: 700; font-size: 13px; letter-spacing: 1.5px; padding: 3px 9px; background: var(--ink); color: #EAAA00; }
.line-chip.dark { background: transparent; border: 1px solid #4A4D53; }
.wp-line { font-family: var(--disp); font-weight: 700; font-size: 8px; letter-spacing: .5px; color: var(--red); flex-shrink: 0; }

.row-line { font-family: var(--mono); font-weight: 700; font-size: 9.5px; letter-spacing: .5px; color: var(--muted); margin-right: 6px; }

/* ---- system sheet ---- */
.sys-rules { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0 4px; }
.sys-rule { display: flex; gap: 10px; align-items: flex-start; border: 1.5px solid var(--ink); padding: 8px 10px; font-size: 11.5px; line-height: 1.4; }
.sys-rule > b { font-family: var(--disp); font-weight: 700; font-size: 26px; line-height: 1; color: var(--red); }
.sys-call { font-size: 11.5px; line-height: 1.5; padding: 4px 0 2px; }
.sys-call b { font-family: var(--disp); letter-spacing: .5px; }
.sys-note { color: var(--muted); font-size: 10.5px; }

/* ---- teach mode ---- */
.teach-title { display: flex; align-items: center; gap: 12px; }
.teach-title b { font-family: var(--disp); font-weight: 700; font-size: clamp(22px, 3vw, 40px); letter-spacing: 2px; text-transform: uppercase; color: #EAAA00; }
.teach-title .mono { color: #9DA1A8; font-size: 14px; }
.teach-form { color: #B9BCC2; font-family: var(--disp); font-weight: 600; font-size: 14px; letter-spacing: 1.5px; text-transform: uppercase; }
.teach-stage { flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 2vh 2vw; overflow: hidden; }
.teach-main { width: min(92vw, 150vh); display: grid; gap: 10px; }
.play-svg.teach { width: 100%; border: 3px solid rgba(255,255,255,.25); }
.teach-nav { appearance: none; background: transparent; border: 1px solid #4A4D53; color: #fff; font-size: 34px; width: 52px; height: 80px; cursor: pointer; flex-shrink: 0; }
.teach-nav:hover { border-color: #fff; }
.teach-nav:disabled { opacity: .25; cursor: default; }
.teach-hl-row { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.teach-hl { appearance: none; border: 1px solid #4A4D53; background: transparent; color: #B9BCC2; font-family: var(--disp); font-weight: 700; font-size: 14px; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 14px; cursor: pointer; }
.teach-hl.on { background: #EAAA00; border-color: #EAAA00; color: #23356F; }
.teach-job { color: #fff; font-size: clamp(14px, 1.6vw, 20px); line-height: 1.4; text-align: center; min-height: 2.8em; padding: 0 4vw; }

/* ---- job cards print ---- */
.jobs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
.jobs-card { border: 1.5px solid var(--ink); page-break-inside: avoid; }

/* ---- board mode ---- */
.board-layer { position: fixed; inset: 0; z-index: 70; background: #0C0E11; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; }
.board-num { font-family: var(--disp); font-weight: 700; font-size: min(58vh, 60vw); line-height: 1; color: #fff; }
.board-word { font-family: var(--disp); font-weight: 700; font-size: clamp(18px, 3vw, 34px); letter-spacing: 3px; text-transform: uppercase; color: #EAAA00; }
.board-hint { margin-top: 2vh; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #6B6F76; }

/* ---- route cards print ---- */
.routes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 10px; }
.routes-card { border: 1.5px solid var(--ink); page-break-inside: avoid; }
.routes-title { font-family: var(--disp); font-weight: 700; font-size: 11px; letter-spacing: 1.5px; padding: 3px 8px; background: var(--ink); color: #fff; }
.routes-table { width: 100%; border-collapse: collapse; font-size: 9px; }
.routes-table th, .routes-table td { border: 0.5px solid var(--line); padding: 2px 4px; text-align: left; }
.routes-table th { font-family: var(--disp); font-size: 9.5px; letter-spacing: 1px; }
.routes-bird { font-family: var(--disp); font-weight: 700; font-size: 10px; letter-spacing: .5px; text-transform: uppercase; color: var(--red); }
.routes-foot { padding: 3px 8px; font-size: 8px; color: var(--muted); border-top: 0.5px solid var(--line); }

/* ---- saved plans ---- */
.saved-plans { display: flex; gap: 8px; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--line); background: #F6F4EF; }
.saved-plans select { flex: 1; min-width: 0; }
.saved-plans .icon-btn:disabled, .saved-plans .btn:disabled { opacity: .45; cursor: default; }

/* ---- drill library filters ---- */
.lib-filters { display: grid; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
.cat-chip-row { display: flex; flex-wrap: wrap; gap: 5px; }
.filter-chip { appearance: none; border: 1px solid var(--line); background: #fff; color: var(--muted); font-family: var(--disp); font-weight: 600; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; padding: 4px 9px; cursor: pointer; }
.filter-chip:hover { border-color: var(--ink); color: var(--ink); }
.filter-chip.active { background: var(--ink); border-color: var(--ink); color: #fff; }
.group-tag { display: inline-block; border: 1px solid; font-family: var(--disp); font-weight: 600; font-size: 10.5px; letter-spacing: 1px; text-transform: uppercase; padding: 1px 5px; margin-left: 6px; vertical-align: 1px; }
.form-title { font-family: var(--disp); font-weight: 700; font-size: 14px; letter-spacing: 1.5px; text-transform: uppercase; }

/* ---- multi-station periods ---- */
.plan-row.period { align-items: flex-start; }
.plan-row.period .plan-time { padding-top: 5px; }
.station-line { display: flex; align-items: center; gap: 8px; padding: 3px 0; }
.station-line .cat-bar { width: 4px; height: 16px; align-self: center; }
.station-line b { font-size: 13px; }
.station-x { padding: 0 4px; }
.station-add { margin-top: 4px; max-width: 280px; font-size: 12px; color: var(--muted); border-style: dashed; }

/* ---- formation view (big screen) ---- */
.fv-layer { position: fixed; inset: 0; z-index: 60; background: #0C0E11; display: flex; flex-direction: column; }
.fv-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 20px; background: var(--ink); color: #fff; flex-wrap: wrap; }
.fv-brand { display: flex; align-items: center; gap: 10px; font-family: var(--disp); font-weight: 700; font-size: 16px; letter-spacing: 2px; }
.fv-switch { display: flex; }
.fv-side { appearance: none; border: 1px solid #4A4D53; background: transparent; color: #B9BCC2; font-family: var(--disp); font-weight: 700; font-size: 16px; letter-spacing: 1.5px; text-transform: uppercase; padding: 7px 18px; cursor: pointer; }
.fv-side.active.off { background: var(--red); border-color: var(--red); color: #fff; }
.fv-side.active.def { background: var(--def-blue); border-color: var(--def-blue); color: #fff; }
.fv-actions { display: flex; align-items: center; gap: 10px; }
.fv-scheme { margin-left: 8px; background: transparent; color: #fff; border: 1px solid #4A4D53; font-family: var(--disp); font-weight: 700; font-size: 15px; letter-spacing: 1px; padding: 6px 10px; }
.fv-scheme option { color: var(--ink); }
.fv-hint { font-size: 11px; letter-spacing: 1px; color: #9DA1A8; text-transform: uppercase; }
.btn.ghost.dark { color: #fff; border-color: #4A4D53; }
.btn.ghost.dark:hover { background: #fff; color: var(--ink); }
.fv-stage { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2vh 2vw; overflow: hidden; }
.fv-field { position: relative; width: min(96vw, 168vh); aspect-ratio: 16 / 9; background:
  repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0, rgba(255,255,255,.06) 2px, transparent 2px, transparent 11.1%),
  linear-gradient(180deg, #1E5A38 0%, #17492D 55%, #123B25 100%);
  border: 3px solid rgba(255,255,255,.25); box-shadow: 0 0 80px rgba(0,0,0,.6) inset; }
.fv-field::before, .fv-field::after { content: ""; position: absolute; top: 0; bottom: 0; width: 2px; background: rgba(255,255,255,.10); left: 33%; }
.fv-field::after { left: 67%; }
.fv-los { position: absolute; left: 0; right: 0; height: 3px; background: #EAAA00; opacity: .85; }
.fv-los span { position: absolute; right: 8px; top: -20px; font-family: var(--disp); font-weight: 700; font-size: 13px; letter-spacing: 2px; color: #EAAA00; }
.fv-node { position: absolute; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 4px; width: 7.6%; min-width: 84px; }
.fv-pos { color: #fff; font-family: var(--disp); font-weight: 700; font-size: clamp(10px, 1.1vw, 16px); letter-spacing: 1.5px; text-transform: uppercase; padding: 1px 8px; white-space: nowrap; }
.fv-card { background: #fff; border: 2px solid var(--ink); padding: 4px 8px 6px; display: flex; flex-direction: column; align-items: center; width: 100%; box-shadow: 0 3px 0 rgba(0,0,0,.35); }
.fv-card.open { background: transparent; border: 2px dashed rgba(255,255,255,.5); color: rgba(255,255,255,.7); font-family: var(--disp); font-weight: 700; letter-spacing: 2px; padding: 10px; font-size: clamp(11px, 1vw, 15px); }
.fv-num { font-family: var(--disp); font-weight: 700; font-size: clamp(16px, 2vw, 30px); line-height: 1; color: var(--ink); }
.fv-name { font-family: var(--disp); font-weight: 600; font-size: clamp(10px, .95vw, 14px); letter-spacing: .5px; text-transform: uppercase; text-align: center; line-height: 1.15; margin-top: 2px; overflow-wrap: break-word; max-width: 100%; min-height: 2.3em; display: flex; align-items: center; justify-content: center; }
.fv-backup { color: rgba(255,255,255,.85); font-size: clamp(9px, .8vw, 12px); letter-spacing: .3px; text-align: center; line-height: 1.2; max-width: 100%; text-shadow: 0 1px 2px rgba(0,0,0,.6); }

/* ---- tabs ---- */
.tabs { display: flex; gap: 0; background: var(--ink); padding: 0 20px; overflow-x: auto; }
.tab { appearance: none; background: none; border: none; border-bottom: 3px solid transparent; color: #B9BCC2; font-family: var(--disp); font-weight: 600; font-size: 16px; letter-spacing: 1.5px; text-transform: uppercase; padding: 10px 16px 12px; cursor: pointer; white-space: nowrap; }
.tab:hover { color: #fff; }
.tab.active { color: #fff; border-bottom-color: var(--red); }
.tab:focus-visible, .btn:focus-visible, button:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }

/* ---- layout ---- */
.content { padding: 20px; max-width: 1200px; margin: 0 auto; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
.two-col > * { min-width: 0; } /* grid items otherwise refuse to shrink below content width */
@media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
.panel { background: var(--panel); border: 1px solid var(--line); box-shadow: 0 1px 0 rgba(0,0,0,.03); }
.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 2px solid var(--ink); flex-wrap: wrap; }
.panel-head h2 { margin: 0; font-family: var(--disp); font-weight: 700; font-size: 22px; letter-spacing: 1.5px; text-transform: uppercase; }
.hint { color: var(--muted); font-size: 12px; margin: 10px 16px; }
.empty { color: var(--muted); text-align: center; padding: 18px; font-size: 13px; }
.empty.pad { padding: 24px 16px; }

/* ---- controls ---- */
input, select { font-family: var(--body); font-size: 13px; padding: 8px 10px; border: 1px solid var(--line); background: #fff; color: var(--ink); border-radius: 0; }
input:focus, select:focus { outline: 2px solid var(--red); outline-offset: -1px; }
.btn { appearance: none; background: var(--red); color: #fff; border: none; font-family: var(--disp); font-weight: 600; font-size: 15px; letter-spacing: 1.2px; text-transform: uppercase; padding: 9px 16px; cursor: pointer; }
.btn:hover { background: var(--red-dark); }
.btn:disabled { background: #C9CBCF; cursor: default; }
.btn.ghost { background: transparent; color: var(--ink); border: 1px solid var(--ink); }
.btn.ghost:hover { background: var(--ink); color: #fff; }
.btn.small { font-size: 13px; padding: 6px 10px; }
.icon-btn { appearance: none; background: none; border: none; cursor: pointer; font-size: 13px; padding: 4px 6px; color: var(--muted); }
.row-actions { white-space: nowrap; }
.row-actions button { appearance: none; background: none; border: 1px solid var(--line); cursor: pointer; padding: 3px 7px; margin-left: 4px; font-size: 12px; color: var(--ink); }
.row-actions button:hover { border-color: var(--ink); }
.row-actions .danger, .icon-btn.danger { color: var(--red); }
.add-row { display: flex; gap: 8px; padding: 14px 16px 0; }
.add-row.wrap { flex-wrap: wrap; align-items: center; }
.add-row input { flex: 1; min-width: 120px; }
.next-num { font-family: var(--disp); font-weight: 700; font-size: 20px; color: var(--red); min-width: 44px; }

/* ---- tables ---- */
.table-wrap { padding: 8px 16px 16px; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th { font-family: var(--disp); font-weight: 600; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; text-align: left; color: var(--muted); padding: 8px 6px; border-bottom: 2px solid var(--ink); }
td { padding: 5px 6px; border-bottom: 1px solid var(--line); vertical-align: middle; }
.cell { width: 100%; border-color: transparent; background: transparent; padding: 6px 8px; }
.cell:hover { border-color: var(--line); }
.cell.num { width: 56px; font-family: var(--mono); font-weight: 700; }
.cell.mins { width: 62px; font-family: var(--mono); }
select.cell.off { color: var(--red); font-weight: 600; }
select.cell.def { color: var(--def-blue); font-weight: 600; }

/* ---- depth chart ---- */
.depth-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
@media (max-width: 640px) { .depth-grid { grid-template-columns: 1fr; } }
.depth-grid > div { padding: 12px 16px 16px; }
.depth-grid > div:first-child { border-right: 1px solid var(--line); }
.depth-title { font-family: var(--disp); font-weight: 700; font-size: 16px; letter-spacing: 2px; padding: 6px 10px; color: #fff; margin-bottom: 10px; }
.off-title { background: var(--red); }
.def-title { background: var(--def-blue); }
.depth-row { display: flex; gap: 10px; padding: 5px 0; border-bottom: 1px dotted var(--line); align-items: baseline; }
.depth-pos { font-family: var(--disp); font-weight: 600; font-size: 14px; letter-spacing: 1px; width: 72px; flex-shrink: 0; }
.off-pos { color: var(--red); }
.def-pos { color: var(--def-blue); }
.depth-names { display: flex; flex-wrap: wrap; gap: 6px; font-size: 12.5px; }
.depth-name { color: var(--muted); }
.depth-name.first { color: var(--ink); font-weight: 600; }
.depth-name b { font-family: var(--mono); font-weight: 700; }
.promote { appearance: none; background: none; border: 1px solid var(--line); cursor: pointer; font-size: 10px; padding: 0 4px; margin-left: 3px; color: var(--muted); vertical-align: 1px; }
.promote:hover { border-color: var(--ink); color: var(--ink); }
.side-switch { display: flex; }
.side-btn { appearance: none; border: 1px solid var(--line); background: #fff; color: var(--muted); font-family: var(--disp); font-weight: 700; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; padding: 6px 12px; cursor: pointer; }
.side-btn.active.off { background: var(--red); border-color: var(--red); color: #fff; }
.side-btn.active.def { background: var(--def-blue); border-color: var(--def-blue); color: #fff; }
.slot-table select.slot { width: 100%; min-width: 110px; }
.slot-table select.slot.missing { border: 1px dashed var(--red); background: #FDF3F4; }
.assign { font-size: 11.5px; letter-spacing: .2px; }
.assign.off-assign { color: var(--red); }
.assign.def-assign { color: var(--def-blue); }
.unfilled { color: #C4A24A; font-style: italic; font-size: 12px; }
.warn { margin: 0 16px 16px; padding: 10px 12px; background: #FBF4E4; border: 1px solid #E4D3A1; font-size: 12.5px; display: grid; gap: 4px; }

/* ---- practice ---- */
.drill-form { display: grid; gap: 8px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
.drill-form-row { display: flex; gap: 8px; align-items: center; }
.drill-list { max-height: 520px; overflow-y: auto; }
.drill-card { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--line); }
.cat-chip { color: #fff; font-family: var(--disp); font-weight: 600; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px; flex-shrink: 0; width: 92px; text-align: center; }
.drill-main { flex: 1; min-width: 0; display: grid; }
.drill-main b { font-size: 13px; }
.drill-notes { color: var(--muted); font-size: 11.5px; }
.drill-mins { font-family: var(--mono); font-size: 12px; color: var(--muted); }
.plan-meta { display: flex; gap: 12px; padding: 14px 16px; flex-wrap: wrap; border-bottom: 1px solid var(--line); }
.plan-meta label { display: grid; gap: 4px; font-family: var(--disp); font-weight: 600; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); }
.plan-row { display: flex; align-items: center; gap: 10px; padding: 9px 16px; border-bottom: 1px solid var(--line); }
.plan-time { font-family: var(--mono); font-size: 11.5px; width: 118px; flex-shrink: 0; color: var(--ink); }
.cat-bar { width: 4px; align-self: stretch; flex-shrink: 0; }
.plan-main { flex: 1; min-width: 0; display: grid; }
.plan-total { padding: 12px 16px; font-size: 13px; text-align: right; }

/* ---- call sheet builder ---- */
.cs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 14px; padding: 16px; }
.cs-box { border: 1px solid var(--line); display: grid; align-content: start; }
.cs-label { font-family: var(--disp); font-weight: 700; font-size: 15px; letter-spacing: 1.5px; text-transform: uppercase; background: var(--ink); color: #fff; padding: 6px 10px; }
.cs-plays { padding: 8px; display: flex; flex-wrap: wrap; gap: 6px; min-height: 40px; }
.cs-chip { display: inline-flex; align-items: center; gap: 5px; border: 1.5px solid; padding: 3px 6px; font-size: 12px; background: #fff; }
.cs-chip b { font-family: var(--mono); }
.cs-chip button { appearance: none; border: none; background: none; cursor: pointer; color: var(--muted); font-size: 11px; padding: 0 2px; }
.cs-box select { margin: 0 8px 10px; }

/* ---- wristbands ---- */
.check-head { display: flex; justify-content: space-between; align-items: center; padding: 6px 16px; }
.check-list { max-height: 380px; overflow-y: auto; padding: 4px 16px 16px; display: grid; gap: 2px; }
.check-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 5px 6px; border-bottom: 1px dotted var(--line); cursor: pointer; }
.type-dot, .key-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.wrist-preview-wrap { padding: 20px; display: flex; justify-content: center; background: repeating-linear-gradient(45deg, #F4F2ED, #F4F2ED 12px, #EFEDE6 12px, #EFEDE6 24px); }
.wrist-card { width: 5in; height: 3in; background: #fff; border: 2px solid var(--ink); display: flex; flex-direction: column; overflow: hidden; flex-shrink: 0; }
.wrist-title { font-family: var(--disp); font-weight: 700; font-size: 13px; letter-spacing: 3px; text-align: center; background: var(--ink); color: #fff; padding: 2px 0; text-transform: uppercase; }
.wrist-cols { flex: 1; display: grid; }
.wrist-col { border-right: 1.5px solid var(--ink); display: flex; flex-direction: column; }
.wrist-col:last-child { border-right: none; }
.wrist-play { display: flex; align-items: center; gap: 5px; border-bottom: 1px solid #C9CBCF; padding: 1px 4px; flex: 1; min-height: 0; }
.wrist-play:last-child { border-bottom: none; }
.wp-num { font-family: var(--mono); font-weight: 700; font-size: 13px; color: var(--red); min-width: 20px; text-align: right; }
.wp-name { font-family: var(--disp); font-weight: 600; font-size: 14px; letter-spacing: .5px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wrist-play.dense .wp-name { font-size: 11.5px; }
.wrist-play.dense .wp-num { font-size: 11px; }
@media (max-width: 640px) { .wrist-preview-wrap { transform-origin: top left; overflow-x: auto; } }

/* ---- mobile (game-day phones) ---- */
@media (max-width: 640px) {
  /* compact masthead: brand on one line, controls beside it */
  .masthead { padding: 8px 12px; gap: 8px; }
  .mast-left { gap: 8px; }
  .mark { width: 32px; height: 32px; font-size: 15px; box-shadow: 2px 2px 0 rgba(255,255,255,.15); }
  .team-line { font-size: 16px; letter-spacing: 1.2px; }
  .sub-line { font-size: 8px; letter-spacing: 1.5px; margin-top: 2px; }
  .mast-right { gap: 8px; }
  .save-chip { font-size: 9px; }
  button.save-chip.error { font-size: 10px; padding: 5px 8px; min-height: 28px; }

  /* sticky, swipeable tab bar */
  .tabs { position: sticky; top: 0; z-index: 40; padding: 0 6px; -webkit-overflow-scrolling: touch; }
  .tab { font-size: 14px; padding: 12px 11px 13px; }

  .content { padding: 12px 8px; }
  .panel-head { padding: 12px; }
  .panel-head h2 { font-size: 19px; }

  /* wide tables swipe inside their panel instead of stretching the page */
  .content table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }

  /* form rows wrap instead of forcing width */
  .drill-form-row, .add-row { flex-wrap: wrap; }
  .drill-form-row input, .drill-form-row select { flex: 1 1 130px; min-width: 0; }

  /* fingers, not cursors */
  .btn { min-height: 42px; }
  .filter-chip, .result-chip, .ed-mode, .tag-check { padding: 7px 11px; }
  .pg-chip { padding: 5px 11px; }

  /* 16px controls stop iOS focus-zoom */
  input, select, textarea { font-size: 16px; }

  /* the 5in wristband proof shrinks to fit the screen */
  .wrist-preview-wrap { padding: 10px; justify-content: flex-start; }
  .wrist-card { transform: scale(.7); transform-origin: top left; margin-right: calc(-5in * .3); margin-bottom: calc(-3in * .3); }

  /* play lab: diagram preview goes full width */
  .builder-preview { flex-wrap: wrap; }
  .play-svg.small { width: 100%; }

  /* caller: two big columns of call words */
  .caller-grid { grid-template-columns: repeat(2, 1fr); }
  .tempo-btn { flex: 1 1 40%; }

  /* drill cards: category chip sizes to its word, name gets the room */
  .cat-chip { width: auto; }

  /* practice plan: time stacks above the period so stations get full width */
  .plan-row { flex-wrap: wrap; }
  .plan-row .plan-time { width: 100%; flex-basis: 100%; padding-top: 0; }
  .plan-main { flex-basis: 100%; }
  .station-add { max-width: 100%; }
}

/* ---- print layer ---- */
.print-layer { position: fixed; inset: 0; background: #4A4D53; overflow-y: auto; z-index: 50; }
.print-toolbar { position: sticky; top: 0; background: var(--ink); color: #fff; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 20px; font-size: 12.5px; z-index: 2; flex-wrap: wrap; }
.print-toolbar .btn { margin-left: 8px; }
.print-page { display: flex; justify-content: center; padding: 24px; }
.sheet { background: #fff; width: 8in; min-height: 10in; padding: .45in .5in; box-shadow: 0 4px 24px rgba(0,0,0,.35); }

.p-head { display: flex; align-items: center; gap: 12px; border-bottom: 3px solid var(--ink); padding-bottom: 10px; margin-bottom: 14px; }
.p-mark { background: var(--red); color: #fff; font-family: var(--disp); font-weight: 700; font-size: 18px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; }
.p-head-text { flex: 1; }
.p-team { font-family: var(--disp); font-weight: 600; font-size: 12px; letter-spacing: 2.5px; color: var(--muted); }
.p-title { font-family: var(--disp); font-weight: 700; font-size: 26px; letter-spacing: 1.5px; text-transform: uppercase; line-height: 1.05; }
.p-right { text-align: right; }
.p-meta { font-size: 11.5px; color: var(--ink); }

.p-table { width: 100%; border-collapse: collapse; }
.p-table th { font-size: 11px; padding: 6px 6px; }
.p-table td { font-size: 12px; padding: 7px 6px; }
.p-table .center { text-align: center; }
.p-cat { color: #fff; font-family: var(--disp); font-weight: 600; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; padding: 2px 6px; white-space: nowrap; }
.p-station { padding: 3px 0; font-size: 12px; }
.p-station .p-cat { margin-right: 6px; }
.p-group { display: inline-block; border: 1px solid; font-family: var(--disp); font-weight: 600; font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; padding: 0 5px; margin-right: 7px; }
.p-station-notes { color: var(--muted); font-size: 11px; }
.p-foot { display: flex; justify-content: space-between; margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); }
.p-foot.no-border { border-top: none; }

.p-cs-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.p-cs-box { border: 1.5px solid var(--ink); }
.p-cs-label { font-family: var(--disp); font-weight: 700; font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; background: var(--ink); color: #fff; padding: 4px 8px; }
.p-cs-play { display: flex; align-items: center; gap: 7px; padding: 4px 8px; border-bottom: 1px solid var(--line); }
.p-cs-play:last-child { border-bottom: none; }
.p-cs-num { color: #fff; font-family: var(--mono); font-weight: 700; font-size: 11px; min-width: 22px; text-align: center; padding: 1px 0; }
.p-cs-name { font-family: var(--disp); font-weight: 600; font-size: 15px; letter-spacing: .5px; text-transform: uppercase; flex: 1; }
.p-cs-form { font-size: 10px; color: var(--muted); }
.p-cs-empty { padding: 8px; color: var(--line); }

.wrist-print-grid { display: grid; grid-template-columns: repeat(auto-fill, 5in); gap: .25in; justify-content: center; }
.wrist-cut { border: 1.5px dashed #9DA1A8; padding: .08in; width: fit-content; }
.gd-row td { padding: 10px 6px; }
.snap-cells { display: flex; gap: 4px; flex-wrap: wrap; }
.snap-box { width: 15px; height: 15px; border: 1.2px solid var(--ink); display: inline-block; }

@media print {
  .app-ui, .no-print { display: none !important; }
  .print-layer { position: static; background: #fff; overflow: visible; }
  .print-page { padding: 0; }
  .sheet { box-shadow: none; width: auto; min-height: 0; padding: 0; }
  .root { background: #fff; }
  @page { margin: 0.45in; }
  .p-cat, .p-cs-num, .p-cs-label, .p-mark, .wrist-title, .cat-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`}</style>
  );
}

export { normalizeData, practiceGroupsFor, pgForPos, CONCEPTS, callWord, LINE_CALLS, ASSIGNMENTS, SEED, seedPackages, day1Plan, applyKillPairs, installedForms, resolvePlayPos, FORM_WEEKS, formSpots };
