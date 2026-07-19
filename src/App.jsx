import { useState, useEffect, useRef, useMemo } from "react";

/* ============================================================
   VESTAVIA HILLS 6TH GRADE — SIDELINE COMMAND
   Roster & depth chart · Practice planner · Playbook
   Call sheet · Wristband printer · Game day sheet
   ============================================================ */

const OFF_POS = ["QB", "RB", "FB", "WR (X)", "WR (Z)", "TE", "LT", "LG", "C", "RG", "RT"];

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
  Offense: "#C8102E", OL: "#C8102E", QB: "#C8102E", RB: "#C8102E", "WR/TE": "#C8102E",
  "Skill (QB/RB/WR/TE)": "#C8102E", "Bigs + Backs": "#C8102E",
  Defense: "#1F3A5F", DL: "#1F3A5F", LB: "#1F3A5F", DB: "#1F3A5F", "LB/DB": "#1F3A5F",
  "Special Teams": "#0F6B4F",
};
const groupTone = (g) => GROUP_TONES[g] || "#15171B";

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
  const posList = side === "off" ? OFF_POS : defPositions(data);
  const out = [];
  for (const pos of posList) {
    const ids = ((data.depth && data.depth[side]) || {})[pos] || [];
    const i = ids.indexOf(id);
    if (i >= 0) out.push({ pos, team: i + 1 });
  }
  return out.sort((a, b) => a.team - b.team);
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
    return { ...data, depth: { off: fix(data.depth && data.depth.off, OFF_POS), def: fix(data.depth && data.depth.def, DEF_POS_ALL, { SAFETY: "FS" }) } };
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
  return { ...data, depth: { off: build("off", OFF_POS, "offPos"), def: build("def", DEF_POS_ALL, "defPos", { SAFETY: "FS" }) }, depthVersion: 2 };
}
const CAT_COLORS = {
  Warmup: "#B7791F",
  Individual: "#1F3A5F",
  Group: "#4C2A85",
  Team: "#C8102E",
  "Special Teams": "#0F6B4F",
  Conditioning: "#5B616B",
};
const PLAY_TYPES = ["Run", "Pass", "Screen", "Special"];
const TYPE_COLORS = { Run: "#C8102E", Pass: "#1F3A5F", Screen: "#0F6B4F", Special: "#B7791F" };

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

/* ---------- formation view coordinates (percent of field, x = center, y = top of node) ----------
   Vertical gaps are sized for a full 3-deep: tag + card + two backup lines
   needs about 21% of field height per level of the backfield stack. */
const OFF_SPOTS = {
  "WR (X)": [8, 16],
  "LT": [34, 16], "LG": [42, 16], "C": [50, 16], "RG": [58, 16], "RT": [66, 16],
  "TE": [74, 16],
  "WR (Z)": [92, 22],
  "QB": [50, 36.7], "FB": [50, 57.4], "RB": [50, 78],
};

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
  ],
  practice: { date: "", start: "17:30", title: "Practice Plan", items: [] },
  savedPlans: [],
  plays: [
    { id: uid(), num: 1, name: "Power Right", formation: "I-Form", type: "Run", note: "Base play. FB kickout." },
    { id: uid(), num: 2, name: "Power Left", formation: "I-Form", type: "Run", note: "" },
    { id: uid(), num: 3, name: "Toss Sweep Rt", formation: "I-Form", type: "Run", note: "Get RB to the edge." },
    { id: uid(), num: 4, name: "Waggle Pass", formation: "I-Form", type: "Pass", note: "TE drag, WR corner." },
  ],
  callSheet: {},
  wrist: { title: "REBELS", cols: 3, copies: 4, selected: null },
  depth: { off: {}, def: {} },
  defScheme: "5-3",
  libVersion: 2,
};
const SEED = migrateDepth(RAW_SEED);

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
      try { window.localStorage.setItem(key, value); } catch (e) {}
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
  // Merge in new library drills the coach doesn't have yet (by name).
  if ((parsed.libVersion || 1) < SEED.libVersion) {
    const have = new Set(drills.map((d) => d.name.toLowerCase()));
    drills = [...drills, ...SEED.drills.filter((d) => !have.has(d.name.toLowerCase()))];
  }
  return migrateDepth({
    ...SEED,
    ...parsed,
    drills,
    practice: { ...SEED.practice, ...(parsed.practice || {}), items },
    savedPlans: parsed.savedPlans || [],
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
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FBFAF8", fontFamily: "Inter, system-ui, sans-serif", color: "#5B616B" }}>
        Loading your program…
      </div>
    );
  }

  const TABS = [
    { key: "roster", label: "Roster & Depth" },
    { key: "practice", label: "Practice Planner" },
    { key: "playbook", label: "Playbook" },
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
            <BackupControls data={data} setData={setData} />
            <div className={"save-chip " + saveState}>
              {saveState === "saving" ? "Saving…" : saveState === "error" ? "Save failed" : "All changes saved"}
            </div>
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
          {tab === "roster" && <RosterTab data={data} up={up} onPrint={() => setPrintTarget("gameday")} />}
          {tab === "practice" && <PracticeTab data={data} up={up} onPrint={() => setPrintTarget("practice")} />}
          {tab === "playbook" && <PlaybookTab data={data} up={up} />}
          {tab === "callsheet" && <CallSheetTab data={data} up={up} onPrint={() => setPrintTarget("callsheet")} />}
          {tab === "wrist" && <WristTab data={data} up={up} onPrint={() => setPrintTarget("wrist")} />}
        </main>
      </div>

      {printTarget && (
        <PrintLayer target={printTarget} data={data} onClose={() => setPrintTarget(null)} />
      )}
    </div>
  );
}

/* ============================================================
   BACKUP (export / import JSON)
   ============================================================ */
function BackupControls({ data, setData }) {
  const fileRef = useRef(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sideline-command-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importJson = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.players)) throw new Error("bad file");
        if (!window.confirm("Restore this backup? It replaces everything currently in the app.")) return;
        setData(normalizeData(parsed));
      } catch (err) {
        window.alert("That file doesn't look like a Sideline Command backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="backup-controls">
      <button className="mast-btn" onClick={exportJson} title="Download all data as a JSON file">Backup</button>
      <button className="mast-btn" onClick={() => fileRef.current && fileRef.current.click()} title="Restore from a backup file">Restore</button>
      <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: "none" }} onChange={importJson} />
    </div>
  );
}

/* ============================================================
   ROSTER & DEPTH CHART — 1st/2nd/3rd team slots per position
   ============================================================ */
function RosterTab({ data, up, onPrint }) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
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

  const posList = depthSide === "off" ? OFF_POS : defPositions(data);
  const offMissing = OFF_POS.filter((pos) => !slotsFor(data, "off", pos)[0]);
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
  const offDoubles = doubleStarters("off", OFF_POS);
  const defDoubles = doubleStarters("def", defPositions(data));

  const numCounts = {};
  for (const p of data.players) if (p.num) numCounts[p.num] = (numCounts[p.num] || 0) + 1;
  const dupNums = Object.keys(numCounts).filter((n) => numCounts[n] > 1);

  const byRoster = (side, id) =>
    assignmentsFor(data, side, id).map((a) => `${a.pos} ${a.team}`).join(" · ");

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel-head">
          <h2>Roster</h2>
          <button className="btn ghost" onClick={onPrint}>Print Game Day Sheet</button>
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

      {formationView && <FormationView data={data} up={up} onClose={() => setFormationView(false)} />}
    </div>
  );
}


/* ============================================================
   FORMATION VIEW — big screen depth chart
   ============================================================ */
function FormationView({ data, up, onClose }) {
  const [side, setSide] = useState("offense");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setSide((s) => (s === "offense" ? "defense" : "offense"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const goFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
  };

  const spots = side === "offense" ? OFF_SPOTS : DEF_SCHEMES[defScheme(data)].spots;
  const posList = side === "offense" ? OFF_POS : defPositions(data);
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
          {side === "defense" && (
            <select className="fv-scheme" value={defScheme(data)} onChange={(e) => up({ defScheme: e.target.value })}>
              {Object.keys(DEF_SCHEMES).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          )}
        </div>
        <div className="fv-actions">
          <span className="fv-hint">Space flips sides · Esc closes</span>
          <button className="btn ghost dark" onClick={goFullscreen}>Fullscreen</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
      <div className="fv-stage">
        <div className="fv-field">
          <div className="fv-los" style={{ top: side === "offense" ? "14%" : "12%" }}>
            <span>LOS</span>
          </div>
          {posList.map((pos) => {
            const [x, y] = spots[pos] || [50, 50];
            const slots = slotsFor(data, side === "offense" ? "off" : "def", pos);
            const starter = slots[0];
            const backups = [slots[1], slots[2]].filter(Boolean);
            return (
              <div key={pos} className="fv-node" style={{ left: `${x}%`, top: `${y}%` }}>
                <div className="fv-pos" style={{ background: tone }}>{pos}</div>
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
   PLAYBOOK
   ============================================================ */
function PlaybookTab({ data, up }) {
  const { plays } = data;
  const [f, setF] = useState({ name: "", formation: "", type: "Run", note: "" });

  const nextNum = plays.reduce((m, p) => Math.max(m, Number(p.num) || 0), 0) + 1;

  const add = () => {
    if (!f.name.trim()) return;
    up({ plays: [...plays, { id: uid(), num: nextNum, name: f.name.trim(), formation: f.formation.trim(), type: f.type, note: f.note.trim() }] });
    setF({ name: "", formation: f.formation, type: f.type, note: "" });
  };
  const setPlay = (id, patch) => up({ plays: plays.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const duplicate = (id) => {
    const src = plays.find((p) => p.id === id);
    if (!src) return;
    const flip = (s) => {
      if (/right|rt\b/i.test(s)) return s.replace(/Right/gi, "Left").replace(/\bRt\b/gi, "Lt");
      if (/left|lt\b/i.test(s)) return s.replace(/Left/gi, "Right").replace(/\bLt\b/gi, "Rt");
      return s + " Copy";
    };
    up({ plays: [...plays, { ...src, id: uid(), num: nextNum, name: flip(src.name) }] });
  };
  const remove = (id) => {
    const p = plays.find((x) => x.id === id);
    if (!window.confirm(`Delete play${p ? ` "${p.name}"` : ""}? It comes off the call sheet and wristbands too.`)) return;
    const cs = {};
    for (const k of Object.keys(data.callSheet || {})) cs[k] = (data.callSheet[k] || []).filter((pid) => pid !== id);
    const selected = data.wrist.selected === null ? null : data.wrist.selected.filter((pid) => pid !== id);
    up({ plays: plays.filter((p) => p.id !== id), callSheet: cs, wrist: { ...data.wrist, selected } });
  };

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Playbook</h2>
        <span className="hint" style={{ margin: 0 }}>Play numbers are what go on the wristband. Keep names short so they print big.</span>
      </div>
      <div className="add-row wrap">
        <span className="next-num">#{nextNum}</span>
        <input placeholder="Play name (e.g. Power Rt)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} />
        <input placeholder="Formation" style={{ width: 130 }} value={f.formation} onChange={(e) => setF({ ...f, formation: e.target.value })} />
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
          {PLAY_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <input placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <button className="btn" onClick={add}>Add Play</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th style={{ width: 60 }}>No.</th><th>Play</th><th>Formation</th><th>Type</th><th>Note</th><th></th></tr></thead>
          <tbody>
            {[...plays].sort((a, b) => a.num - b.num).map((p) => (
              <tr key={p.id}>
                <td><input className="cell num" type="number" key={p.id + ":" + p.num} defaultValue={p.num}
                  onBlur={(e) => { const n = Number(e.target.value); if (n && n !== p.num) setPlay(p.id, { num: n }); }}
                  onKeyDown={(e) => e.key === "Enter" && e.target.blur()} /></td>
                <td><input className="cell" value={p.name} onChange={(e) => setPlay(p.id, { name: e.target.value })} /></td>
                <td><input className="cell" value={p.formation} onChange={(e) => setPlay(p.id, { formation: e.target.value })} /></td>
                <td>
                  <select className="cell" style={{ color: TYPE_COLORS[p.type], fontWeight: 600 }} value={p.type} onChange={(e) => setPlay(p.id, { type: e.target.value })}>
                    {PLAY_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </td>
                <td><input className="cell" value={p.note} onChange={(e) => setPlay(p.id, { note: e.target.value })} /></td>
                <td className="row-actions">
                  <button title="Duplicate (flips Rt/Lt)" onClick={() => duplicate(p.id)}>⧉</button>
                  <button className="danger" onClick={() => remove(p.id)}>✕</button>
                </td>
              </tr>
            ))}
            {plays.length === 0 && <tr><td colSpan={6} className="empty">No plays yet. Add your first one above.</td></tr>}
          </tbody>
        </table>
      </div>
      {(() => {
        const counts = {};
        for (const p of plays) counts[p.num] = (counts[p.num] || 0) + 1;
        const dups = Object.keys(counts).filter((n) => counts[n] > 1);
        return dups.length > 0 ? (
          <div className="warn"><b>Duplicate play numbers:</b> {dups.map((n) => `#${n}`).join(", ")}. Kids read numbers off the wristband, so every play needs its own.</div>
        ) : null;
      })()}
    </section>
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
function WristTab({ data, up, onPrint }) {
  const w = data.wrist;
  const plays = [...data.plays].sort((a, b) => a.num - b.num);
  const selected = w.selected; // null = all
  const setW = (patch) => up({ wrist: { ...w, ...patch } });

  const isOn = (id) => selected === null || selected.includes(id);
  const toggle = (id) => {
    const base = selected === null ? plays.map((p) => p.id) : selected;
    setW({ selected: base.includes(id) ? base.filter((x) => x !== id) : [...base, id] });
  };

  const active = plays.filter((p) => isOn(p.id));

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
                <span className="wp-name">{p.name}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
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
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');

:root {
  --red: #C8102E;
  --red-dark: #9C0C23;
  --ink: #15171B;
  --paper: #FBFAF8;
  --panel: #FFFFFF;
  --line: #E2DFD8;
  --muted: #6B6F76;
  --def-blue: #1F3A5F;
  --disp: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  --body: 'Inter', system-ui, sans-serif;
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
.save-chip.error { color: #FF8A8A; }
.mast-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.backup-controls { display: flex; gap: 6px; }
.mast-btn { appearance: none; background: transparent; border: 1px solid #4A4D53; color: #B9BCC2; font-family: var(--disp); font-weight: 600; font-size: 12px; letter-spacing: 1.5px; text-transform: uppercase; padding: 5px 10px; cursor: pointer; }
.mast-btn:hover { border-color: #fff; color: #fff; }

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
.fv-los { position: absolute; left: 0; right: 0; height: 3px; background: #F4D35E; opacity: .85; }
.fv-los span { position: absolute; right: 8px; top: -20px; font-family: var(--disp); font-weight: 700; font-size: 13px; letter-spacing: 2px; color: #F4D35E; }
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
