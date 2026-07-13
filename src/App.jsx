import { useState, useEffect, useRef, useMemo } from "react";

/* ============================================================
   VESTAVIA HILLS 6TH GRADE — SIDELINE COMMAND
   Roster & depth chart · Practice planner · Playbook
   Call sheet · Wristband printer · Game day sheet
   ============================================================ */

const OFF_POS = ["QB", "RB", "FB", "WR (X)", "WR (Z)", "TE", "LT", "LG", "C", "RG", "RT"];
const DEF_POS = ["DE (L)", "DT (L)", "NG", "DT (R)", "DE (R)", "SAM LB", "MIKE LB", "WILL LB", "CB (L)", "CB (R)", "SAFETY"];
const DRILL_CATS = ["Warmup", "Individual", "Group", "Team", "Special Teams", "Conditioning"];
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

const SEED = {
  players: [
    { id: uid(), name: "Sample Player", num: "7", offPos: "QB", defPos: "SAFETY" },
  ],
  drills: [
    { id: uid(), name: "Dynamic Warmup + Stretch", cat: "Warmup", mins: 10, notes: "High knees, karaoke, lunges. Captains lead." },
    { id: uid(), name: "Form Tackling Circuit", cat: "Individual", mins: 10, notes: "Angle, hawk roll, thud only. Heads out." },
    { id: uid(), name: "Ball Security Gauntlet", cat: "Individual", mins: 10, notes: "High and tight, two hands in traffic." },
    { id: uid(), name: "Inside Run (O vs D)", cat: "Group", mins: 15, notes: "Backs + line vs box. Script 10 reps each side." },
    { id: uid(), name: "7-on-7 Skelly", cat: "Group", mins: 15, notes: "Script routes vs base coverage." },
    { id: uid(), name: "Team Offense Script", cat: "Team", mins: 20, notes: "Run the game plan script. Huddle tempo." },
    { id: uid(), name: "Team Defense vs Scout", cat: "Team", mins: 15, notes: "Scout runs opponent looks off cards." },
    { id: uid(), name: "Kickoff / PAT Reps", cat: "Special Teams", mins: 10, notes: "Two full units, live lanes, no contact." },
    { id: uid(), name: "Conditioning: 10 Perfect Plays", cat: "Conditioning", mins: 10, notes: "End on a good rep. Break it down." },
  ],
  practice: { date: "", start: "17:30", title: "Practice Plan", items: [] },
  plays: [
    { id: uid(), num: 1, name: "Power Right", formation: "I-Form", type: "Run", note: "Base play. FB kickout." },
    { id: uid(), num: 2, name: "Power Left", formation: "I-Form", type: "Run", note: "" },
    { id: uid(), num: 3, name: "Toss Sweep Rt", formation: "I-Form", type: "Run", note: "Get RB to the edge." },
    { id: uid(), num: 4, name: "Waggle Pass", formation: "I-Form", type: "Pass", note: "TE drag, WR corner." },
  ],
  callSheet: {},
  wrist: { title: "REBELS", cols: 3, copies: 4, selected: null },
  liveGame: null,
  gameLog: [],
  settings: { minSnaps: 10 },
};

const STORAGE_KEY = "vh6-coach-data-v1";

/* ---------- storage adapter ----------
   Uses Claude's window.storage when running as a Claude artifact.
   Falls back to localStorage when deployed on the web (Netlify etc). */
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
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  },
  async set(key, value) {
    if (typeof window !== "undefined" && window.storage && window.storage.set) {
      const r = await window.storage.set(key, value);
      if (!r) throw new Error("save failed");
      return;
    }
    window.localStorage.setItem(key, value);
  },
};

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
          const parsed = JSON.parse(raw);
          setData({
            ...SEED,
            ...parsed,
            wrist: { ...SEED.wrist, ...(parsed.wrist || {}) },
            settings: { ...SEED.settings, ...(parsed.settings || {}) },
            gameLog: parsed.gameLog || [],
            liveGame: parsed.liveGame || null,
          });
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
    { key: "gameday", label: "Game Day" },
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
          {tab === "gameday" && <GameDayTab data={data} up={up} onPrintSheet={() => setPrintTarget("gameday")} />}
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
        setData({
          ...SEED,
          ...parsed,
          wrist: { ...SEED.wrist, ...(parsed.wrist || {}) },
          settings: { ...SEED.settings, ...(parsed.settings || {}) },
          gameLog: parsed.gameLog || [],
          liveGame: parsed.liveGame || null,
        });
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
   GAME DAY — live snap counter + season log
   ============================================================ */
function GameDayTab({ data, up, onPrintSheet }) {
  const { liveGame, gameLog, players, settings } = data;
  const [opp, setOpp] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const minSnaps = Number(settings.minSnaps) || 10;

  const startGame = () => {
    if (!opp.trim()) return;
    up({
      liveGame: {
        id: uid(),
        opponent: opp.trim(),
        date: todayStr(),
        quarter: 1,
        us: 0,
        them: 0,
        snaps: {},
        notes: "",
      },
    });
    setOpp("");
    setConfirmEnd(false);
  };

  const setG = (patch) => up({ liveGame: { ...liveGame, ...patch } });

  const bump = (pid, delta) => {
    const cur = liveGame.snaps[pid] || 0;
    const next = Math.max(0, cur + delta);
    setG({ snaps: { ...liveGame.snaps, [pid]: next } });
  };

  const endGame = () => {
    const entry = {
      id: liveGame.id,
      opponent: liveGame.opponent,
      date: liveGame.date,
      us: Number(liveGame.us) || 0,
      them: Number(liveGame.them) || 0,
      notes: liveGame.notes || "",
      snaps: liveGame.snaps,
    };
    up({ gameLog: [entry, ...gameLog], liveGame: null });
    setConfirmEnd(false);
  };

  const removeGame = (id) => up({ gameLog: gameLog.filter((g) => g.id !== id) });
  const setLogGame = (id, patch) => up({ gameLog: gameLog.map((g) => (g.id === id ? { ...g, ...patch } : g)) });

  const wins = gameLog.filter((g) => g.us > g.them).length;
  const losses = gameLog.filter((g) => g.us < g.them).length;
  const ties = gameLog.filter((g) => g.us === g.them).length;

  // Sort: fewest snaps first so the kids who need plays float to the top.
  const sorted = liveGame
    ? [...players].sort((a, b) => (liveGame.snaps[a.id] || 0) - (liveGame.snaps[b.id] || 0))
    : [];
  const underCount = liveGame ? players.filter((p) => (liveGame.snaps[p.id] || 0) < minSnaps).length : 0;

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel-head">
          <h2>Live Snap Counter</h2>
          {liveGame && (
            <span className={"snap-summary" + (underCount > 0 ? " under" : " good")}>
              {underCount > 0 ? `${underCount} player${underCount === 1 ? "" : "s"} under ${minSnaps}` : `Everyone at ${minSnaps}+`}
            </span>
          )}
        </div>

        {!liveGame && (
          <>
            <div className="add-row">
              <input placeholder="Opponent (e.g. Hoover)" value={opp} onChange={(e) => setOpp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && startGame()} />
              <button className="btn" onClick={startGame}>Start Game</button>
            </div>
            <div className="plan-meta">
              <label>Min plays per player
                <input type="number" min="1" style={{ width: 80 }} value={settings.minSnaps}
                  onChange={(e) => up({ settings: { ...settings, minSnaps: Number(e.target.value) || 1 } })} />
              </label>
            </div>
            <p className="hint">Start a game and tap +1 every time a kid takes a snap. Players with the fewest snaps rise to the top so nobody gets missed. Prefer paper? <button className="link-btn" onClick={onPrintSheet}>Print the tally sheet</button> instead.</p>
          </>
        )}

        {liveGame && (
          <>
            <div className="score-strip">
              <div className="score-team">
                <span className="score-label">REBELS</span>
                <div className="score-ctrl">
                  <button onClick={() => setG({ us: Math.max(0, liveGame.us - 1) })}>−</button>
                  <span className="score-num">{liveGame.us}</span>
                  <button onClick={() => setG({ us: liveGame.us + 1 })}>+</button>
                </div>
              </div>
              <div className="score-mid">
                <span className="score-opp">vs {liveGame.opponent}</span>
                <div className="qtr-chips">
                  {[1, 2, 3, 4].map((q) => (
                    <button key={q} className={"qtr" + (liveGame.quarter === q ? " active" : "")} onClick={() => setG({ quarter: q })}>Q{q}</button>
                  ))}
                </div>
              </div>
              <div className="score-team">
                <span className="score-label">THEM</span>
                <div className="score-ctrl">
                  <button onClick={() => setG({ them: Math.max(0, liveGame.them - 1) })}>−</button>
                  <span className="score-num">{liveGame.them}</span>
                  <button onClick={() => setG({ them: liveGame.them + 1 })}>+</button>
                </div>
              </div>
            </div>

            <div className="snap-list">
              {sorted.map((p) => {
                const n = liveGame.snaps[p.id] || 0;
                const under = n < minSnaps;
                return (
                  <div key={p.id} className={"snap-row" + (under ? " under" : " good")}>
                    <span className="snap-num-badge">{p.num || "–"}</span>
                    <div className="snap-name">
                      <b>{p.name}</b>
                      <span className="snap-pos">{[p.offPos, p.defPos].filter(Boolean).join(" / ")}</span>
                    </div>
                    <div className="snap-meter">
                      <div className="snap-meter-fill" style={{ width: `${Math.min(100, (n / minSnaps) * 100)}%` }} />
                    </div>
                    <span className="snap-count">{n}</span>
                    <button className="snap-minus" onClick={() => bump(p.id, -1)} title="Undo a snap">−</button>
                    <button className="snap-plus" onClick={() => bump(p.id, 1)}>+1</button>
                  </div>
                );
              })}
              {players.length === 0 && <div className="empty pad">Add players in Roster &amp; Depth first.</div>}
            </div>

            <div className="add-row" style={{ paddingBottom: 14 }}>
              <input placeholder="Game notes (injuries, what worked, what to fix)" value={liveGame.notes} onChange={(e) => setG({ notes: e.target.value })} />
              {!confirmEnd && <button className="btn ghost" onClick={() => setConfirmEnd(true)}>End Game</button>}
              {confirmEnd && (
                <>
                  <button className="btn" onClick={endGame}>Save Final</button>
                  <button className="btn ghost" onClick={() => setConfirmEnd(false)}>Keep Playing</button>
                </>
              )}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Season</h2>
          <span className="record-chip">{wins}–{losses}{ties > 0 ? `–${ties}` : ""}</span>
        </div>
        {gameLog.length === 0 && <div className="empty pad">Finished games land here with the final score, snap counts, and your notes.</div>}
        {gameLog.map((g) => {
          const result = g.us > g.them ? "W" : g.us < g.them ? "L" : "T";
          return (
            <div key={g.id} className="log-row">
              <span className={"log-result " + result}>{result}</span>
              <div className="log-main">
                <b>vs {g.opponent}</b>
                <span className="drill-notes">{g.date}{g.notes ? ` · ${g.notes}` : ""}</span>
              </div>
              <div className="log-score">
                <input className="cell num" type="number" value={g.us} onChange={(e) => setLogGame(g.id, { us: Number(e.target.value) || 0 })} />
                <span>–</span>
                <input className="cell num" type="number" value={g.them} onChange={(e) => setLogGame(g.id, { them: Number(e.target.value) || 0 })} />
              </div>
              <div className="row-actions">
                <button className="danger" onClick={() => removeGame(g.id)}>✕</button>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* ============================================================
   ROSTER & DEPTH CHART
   ============================================================ */
function RosterTab({ data, up, onPrint }) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");

  const add = () => {
    if (!name.trim()) return;
    up({ players: [...data.players, { id: uid(), name: name.trim(), num: num.trim(), offPos: "", defPos: "" }] });
    setName("");
    setNum("");
  };
  const setPlayer = (id, patch) =>
    up({ players: data.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const remove = (id) => up({ players: data.players.filter((p) => p.id !== id) });
  const move = (id, dir) => {
    const arr = [...data.players];
    const i = arr.findIndex((p) => p.id === id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    up({ players: arr });
  };

  const depth = (posList, field) =>
    posList.map((pos) => ({ pos, players: data.players.filter((p) => p[field] === pos) }));

  const offDepth = depth(OFF_POS, "offPos");
  const defDepth = depth(DEF_POS, "defPos");
  const offMissing = offDepth.filter((d) => d.players.length === 0).map((d) => d.pos);
  const defMissing = defDepth.filter((d) => d.players.length === 0).map((d) => d.pos);

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
        <p className="hint">Order matters: the first player listed at a position is 1st string. Use ↑ ↓ to set depth.</p>
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
                  <td>
                    <select className="cell off" value={p.offPos} onChange={(e) => setPlayer(p.id, { offPos: e.target.value })}>
                      <option value="">—</option>
                      {OFF_POS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="cell def" value={p.defPos} onChange={(e) => setPlayer(p.id, { defPos: e.target.value })}>
                      <option value="">—</option>
                      {DEF_POS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
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
        <div className="panel-head"><h2>Depth Chart</h2></div>
        <div className="depth-grid">
          <div>
            <div className="depth-title off-title">OFFENSE</div>
            {offDepth.map((d) => (
              <div key={d.pos} className="depth-row">
                <span className="depth-pos off-pos">{d.pos}</span>
                <span className="depth-names">
                  {d.players.length ? d.players.map((p, i) => (
                    <span key={p.id} className={"depth-name" + (i === 0 ? " first" : "")}>
                      {p.num && <b>#{p.num}</b>} {p.name}
                    </span>
                  )) : <span className="unfilled">open</span>}
                </span>
              </div>
            ))}
          </div>
          <div>
            <div className="depth-title def-title">DEFENSE</div>
            {defDepth.map((d) => (
              <div key={d.pos} className="depth-row">
                <span className="depth-pos def-pos">{d.pos}</span>
                <span className="depth-names">
                  {d.players.length ? d.players.map((p, i) => (
                    <span key={p.id} className={"depth-name" + (i === 0 ? " first" : "")}>
                      {p.num && <b>#{p.num}</b>} {p.name}
                    </span>
                  )) : <span className="unfilled">open</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
        {(offMissing.length > 0 || defMissing.length > 0) && data.players.length > 1 && (
          <div className="warn">
            {offMissing.length > 0 && <div><b>Offense needs:</b> {offMissing.join(", ")}</div>}
            {defMissing.length > 0 && <div><b>Defense needs:</b> {defMissing.join(", ")}</div>}
          </div>
        )}
      </section>
    </div>
  );
}

/* ============================================================
   PRACTICE PLANNER
   ============================================================ */
function PracticeTab({ data, up, onPrint }) {
  const [d, setD] = useState({ name: "", cat: "Team", mins: 10, notes: "" });
  const { practice, drills } = data;

  const addDrill = () => {
    if (!d.name.trim()) return;
    up({ drills: [...drills, { id: uid(), name: d.name.trim(), cat: d.cat, mins: Number(d.mins) || 10, notes: d.notes.trim() }] });
    setD({ name: "", cat: d.cat, mins: 10, notes: "" });
  };
  const removeDrill = (id) =>
    up({
      drills: drills.filter((x) => x.id !== id),
      practice: { ...practice, items: practice.items.filter((it) => it.drillId !== id) },
    });

  const addToPlan = (drillId) =>
    up({ practice: { ...practice, items: [...practice.items, { id: uid(), drillId, mins: null }] } });
  const removeItem = (id) =>
    up({ practice: { ...practice, items: practice.items.filter((it) => it.id !== id) } });
  const moveItem = (id, dir) => {
    const arr = [...practice.items];
    const i = arr.findIndex((it) => it.id === id);
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    up({ practice: { ...practice, items: arr } });
  };
  const setItemMins = (id, mins) =>
    up({ practice: { ...practice, items: practice.items.map((it) => (it.id === id ? { ...it, mins: mins === "" ? null : Number(mins) } : it)) } });
  const setP = (patch) => up({ practice: { ...practice, ...patch } });

  const schedule = buildSchedule(practice, drills);
  const total = schedule.reduce((s, r) => s + r.mins, 0);

  return (
    <div className="two-col">
      <section className="panel">
        <div className="panel-head"><h2>Drill Library</h2></div>
        <div className="drill-form">
          <input placeholder="Drill name" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          <div className="drill-form-row">
            <select value={d.cat} onChange={(e) => setD({ ...d, cat: e.target.value })}>
              {DRILL_CATS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input type="number" min="1" style={{ width: 70 }} value={d.mins} onChange={(e) => setD({ ...d, mins: e.target.value })} />
            <span className="hint" style={{ margin: 0 }}>min</span>
          </div>
          <input placeholder="Coaching notes / equipment (optional)" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} />
          <button className="btn" onClick={addDrill}>Save Drill</button>
        </div>
        <div className="drill-list">
          {drills.map((dr) => (
            <div key={dr.id} className="drill-card">
              <span className="cat-chip" style={{ background: CAT_COLORS[dr.cat] }}>{dr.cat}</span>
              <div className="drill-main">
                <b>{dr.name}</b>
                {dr.notes && <span className="drill-notes">{dr.notes}</span>}
              </div>
              <span className="drill-mins">{dr.mins}m</span>
              <button className="btn small" onClick={() => addToPlan(dr.id)}>Add →</button>
              <button className="icon-btn danger" title="Delete drill" onClick={() => removeDrill(dr.id)}>✕</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Today's Plan</h2>
          <button className="btn" onClick={onPrint} disabled={practice.items.length === 0}>Print One-Pager</button>
        </div>
        <div className="plan-meta">
          <label>Date <input placeholder={todayStr()} value={practice.date} onChange={(e) => setP({ date: e.target.value })} /></label>
          <label>Start <input type="time" value={practice.start} onChange={(e) => setP({ start: e.target.value })} /></label>
          <label>Title <input value={practice.title} onChange={(e) => setP({ title: e.target.value })} /></label>
        </div>
        {schedule.length === 0 && <div className="empty pad">Add drills from the library. The schedule times itself automatically.</div>}
        {schedule.map((row) => (
          <div key={row.id} className="plan-row">
            <span className="plan-time">{row.timeLabel}</span>
            <span className="cat-bar" style={{ background: CAT_COLORS[row.cat] }} />
            <div className="plan-main">
              <b>{row.name}</b>
              {row.notes && <span className="drill-notes">{row.notes}</span>}
            </div>
            <input className="cell mins" type="number" min="1" value={row.rawMins ?? ""} placeholder={String(row.defaultMins)} onChange={(e) => setItemMins(row.id, e.target.value)} />
            <div className="row-actions">
              <button onClick={() => moveItem(row.id, -1)}>↑</button>
              <button onClick={() => moveItem(row.id, 1)}>↓</button>
              <button className="danger" onClick={() => removeItem(row.id)}>✕</button>
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
    .map((it) => {
      const dr = drills.find((x) => x.id === it.drillId);
      if (!dr) return null;
      const mins = it.mins ?? dr.mins;
      const row = {
        id: it.id, name: dr.name, cat: dr.cat, notes: dr.notes,
        mins, rawMins: it.mins, defaultMins: dr.mins,
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
    const cs = {};
    for (const k of Object.keys(data.callSheet || {})) cs[k] = (data.callSheet[k] || []).filter((pid) => pid !== id);
    up({ plays: plays.filter((p) => p.id !== id), callSheet: cs });
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
                <td><input className="cell num" type="number" value={p.num} onChange={(e) => setPlay(p.id, { num: Number(e.target.value) })} /></td>
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
          <button className="btn ghost small" onClick={() => setW({ selected: null })}>Select all</button>
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
          <tr><th style={{ width: "18%" }}>Time</th><th style={{ width: "26%" }}>Period</th><th style={{ width: "14%" }}>Group</th><th>Coaching Points</th><th style={{ width: "7%" }}>Min</th></tr>
        </thead>
        <tbody>
          {schedule.map((r) => (
            <tr key={r.id}>
              <td className="mono">{r.start} – {r.end}</td>
              <td><b>{r.name}</b></td>
              <td><span className="p-cat" style={{ background: CAT_COLORS[r.cat] }}>{r.cat}</span></td>
              <td>{r.notes}</td>
              <td className="mono center">{r.mins}</td>
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
  const boxes = Math.max(10, Number(data.settings && data.settings.minSnaps) || 10);
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
              <td>{p.offPos}</td>
              <td>{p.defPos}</td>
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
.link-btn { appearance: none; background: none; border: none; padding: 0; color: var(--red); font-size: 12px; text-decoration: underline; cursor: pointer; font-family: var(--body); }

/* ---- game day: snap counter ---- */
.snap-summary { font-family: var(--disp); font-weight: 700; font-size: 14px; letter-spacing: 1.2px; text-transform: uppercase; padding: 4px 10px; color: #fff; }
.snap-summary.under { background: var(--red); }
.snap-summary.good { background: #0F6B4F; }
.score-strip { display: flex; align-items: stretch; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 2px solid var(--ink); background: var(--ink); color: #fff; flex-wrap: wrap; }
.score-team { display: grid; justify-items: center; gap: 4px; }
.score-label { font-family: var(--disp); font-weight: 600; font-size: 11px; letter-spacing: 2px; color: #B9BCC2; }
.score-ctrl { display: flex; align-items: center; gap: 8px; }
.score-ctrl button { appearance: none; width: 34px; height: 34px; border: 1px solid #4A4D53; background: transparent; color: #fff; font-size: 18px; cursor: pointer; }
.score-ctrl button:hover { border-color: #fff; }
.score-num { font-family: var(--disp); font-weight: 700; font-size: 34px; min-width: 44px; text-align: center; }
.score-mid { display: grid; justify-items: center; align-content: center; gap: 6px; }
.score-opp { font-family: var(--disp); font-weight: 700; font-size: 16px; letter-spacing: 1.5px; text-transform: uppercase; }
.qtr-chips { display: flex; gap: 4px; }
.qtr { appearance: none; border: 1px solid #4A4D53; background: transparent; color: #B9BCC2; font-family: var(--disp); font-weight: 600; font-size: 12px; padding: 3px 9px; cursor: pointer; }
.qtr.active { background: var(--red); border-color: var(--red); color: #fff; }
.snap-list { max-height: 460px; overflow-y: auto; }
.snap-row { display: flex; align-items: center; gap: 10px; padding: 8px 16px; border-bottom: 1px solid var(--line); }
.snap-row.under { background: #FDF3F4; }
.snap-num-badge { font-family: var(--mono); font-weight: 700; font-size: 13px; width: 30px; text-align: center; flex-shrink: 0; color: var(--ink); }
.snap-name { flex: 1; min-width: 0; display: grid; }
.snap-name b { font-size: 13px; }
.snap-pos { color: var(--muted); font-size: 11px; }
.snap-meter { width: 90px; height: 8px; background: var(--line); flex-shrink: 0; }
.snap-row.good .snap-meter-fill { background: #0F6B4F; height: 100%; }
.snap-row.under .snap-meter-fill { background: var(--red); height: 100%; }
.snap-count { font-family: var(--disp); font-weight: 700; font-size: 20px; min-width: 30px; text-align: right; }
.snap-minus { appearance: none; width: 32px; height: 36px; border: 1px solid var(--line); background: #fff; color: var(--muted); font-size: 16px; cursor: pointer; }
.snap-plus { appearance: none; min-width: 56px; height: 36px; border: none; background: var(--red); color: #fff; font-family: var(--disp); font-weight: 700; font-size: 16px; letter-spacing: 1px; cursor: pointer; }
.snap-plus:active { background: var(--red-dark); }

/* ---- season log ---- */
.record-chip { font-family: var(--disp); font-weight: 700; font-size: 20px; letter-spacing: 1px; color: var(--red); }
.log-row { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--line); }
.log-result { font-family: var(--disp); font-weight: 700; font-size: 16px; color: #fff; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.log-result.W { background: #0F6B4F; }
.log-result.L { background: var(--red); }
.log-result.T { background: var(--muted); }
.log-main { flex: 1; min-width: 0; display: grid; }
.log-main b { font-size: 13px; }
.log-score { display: flex; align-items: center; gap: 4px; }
.log-score .cell.num { width: 48px; text-align: center; border: 1px solid var(--line); }

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
