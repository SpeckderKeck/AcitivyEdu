/* Class-Activity Board – app.js
   - Teams (Name, Token, Farbe) im Menü
   - Würfeln + Karte ziehen + Punkte
   - Datensätze: Standard + localStorage Override
   - CSV-Import (überschreibt Datensätze im Browser)
*/

(() => {
  "use strict";

  // ---------- Helpers ----------
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const nowTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Very small CSV parser (supports ; or , delimiter, simple quotes)
  function parseCSV(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQ = false;

    // Normalize newlines
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          // escaped quote?
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else {
          cur += ch;
        }
        continue;
      }

      if (ch === '"') { inQ = true; continue; }

      if (ch === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
        continue;
      }

      // delimiter handling later (we detect by header) -> keep raw, split per line
      cur += ch;
    }
    // last cell
    if (cur.length || row.length) {
      row.push(cur);
      rows.push(row);
    }

    // At this point each line is one cell; we need to split by delimiter (best guess)
    // We'll re-split each line by the most common delimiter among ; and ,
    const rawLines = rows.map(r => r.join(""));
    const semiCount = rawLines.reduce((acc, ln) => acc + (ln.split(";").length - 1), 0);
    const commaCount = rawLines.reduce((acc, ln) => acc + (ln.split(",").length - 1), 0);
    const delim = semiCount >= commaCount ? ";" : ",";

    const splitRows = rawLines
      .map(ln => ln.trim())
      .filter(ln => ln.length > 0)
      .map(ln => ln.split(delim).map(c => c.trim()));

    return { rows: splitRows, delim };
  }

  // ---------- Default datasets ----------
  const DEFAULT_DATASETS = {
    kfz: {
      talk: [
        "Katalysator", "Zündkerze", "Einspritzdüse", "Kupplung", "Getriebe",
        "Bremsflüssigkeit", "Lambdasonde", "Kühlmittel", "Ölwechsel", "Batterie"
      ],
      draw: [
        "Bremsscheibe", "Reifenprofil", "Auspuff", "Kolben", "Zahnriemen",
        "Radlager", "Sicherung", "Stoßdämpfer", "Ölfilter", "Kühler"
      ],
      mime: [
        "Radwechsel", "Starthilfe geben", "Ölstand prüfen", "Bremsen entlüften",
        "OBD auslesen", "Batterie wechseln", "Luftdruck prüfen", "Wischer wechseln"
      ]
    },
    metall: {
      talk: [
        "Gleitlager", "Kugellager", "Passung", "Reibung", "Härte",
        "Schraubenverbindung", "Korrosion", "Werkstoff", "Toleranz", "Flächenpressung"
      ],
      draw: [
        "Messschieber", "Bügelmessschraube", "Welle", "Buchse", "Gewinde",
        "Nutmutter", "Lagerbock", "Bohrung", "Senkkopf", "Fase"
      ],
      mime: [
        "Messen", "Anreißen", "Entgraten", "Schmieren", "Sichern",
        "Montieren", "Prüfen", "Spannen"
      ]
    }
  };

  const LS_KEY_DATASETS = "cab_datasets_v1";
  const LS_KEY_EDITOR = "cab_editor_v1";

  function loadDatasets() {
    try {
      const raw = localStorage.getItem(LS_KEY_DATASETS);
      if (!raw) return structuredClone(DEFAULT_DATASETS);
      const obj = JSON.parse(raw);
      // basic validation
      for (const k of ["kfz", "metall"]) {
        if (!obj[k]) obj[k] = structuredClone(DEFAULT_DATASETS[k]);
        for (const c of ["talk", "draw", "mime"]) {
          if (!Array.isArray(obj[k][c])) obj[k][c] = structuredClone(DEFAULT_DATASETS[k][c]);
        }
      }
      return obj;
    } catch {
      return structuredClone(DEFAULT_DATASETS);
    }
  }

  function saveDatasets(ds) {
    localStorage.setItem(LS_KEY_DATASETS, JSON.stringify(ds));
  }

  // ---------- State ----------
  let datasets = loadDatasets();

  const TOKENS = ["🚗","🔧","🧰","⚙️","🛞","🧪","🛠️","🏁","🔩","🧯","🧲","📏"];
  const COLORS = ["#3b82f6","#22c55e","#eab308","#ef4444","#a855f7","#14b8a6","#f97316","#64748b"];

  let game = {
    inGame: false,
    datasetKey: "kfz",
    teams: [],
    teamIndex: 0,
    lastRoll: null,
    canDraw: false,
    currentCard: null,
    log: [],
  };

  // ---------- UI refs ----------
  const views = {
    menu: $("menuView"),
    game: $("gameView"),
    editor: $("editorView")
  };

  const ui = {
    toMenuBtn: $("toMenuBtn"),
    hardResetBtn: $("hardResetBtn"),

    teamCount: $("teamCount"),
    startTeam: $("startTeam"),
    teamNamesWrap: $("teamNamesWrap"),
    teamTokensWrap: $("teamTokensWrap"),
    teamColorsWrap: $("teamColorsWrap"),

    startGameBtn: $("startGameBtn"),
    openEditorBtn: $("openEditorBtn"),

    // CSV
    csvFile: $("csvFile"),
    csvImportBtn: $("csvImportBtn"),
    datasetsResetBtn: $("datasetsResetBtn"),
    csvStatus: $("csvStatus"),

    // Game
    turnBadge: $("turnBadge"),
    statusText: $("statusText"),
    rollBtn: $("rollBtn"),
    drawBtn: $("drawBtn"),
    nextBtn: $("nextBtn"),
    diceOut: $("diceOut"),
    cardOut: $("cardOut"),
    goodBtn: $("goodBtn"),
    badBtn: $("badBtn"),
    scoreWrap: $("scoreWrap"),
    logWrap: $("logWrap"),

    // Editor
    dbSelect: $("dbSelect"),
    editorArea: $("editorArea"),
    saveEditorBtn: $("saveEditorBtn"),
    cancelEditorBtn: $("cancelEditorBtn"),
  };

  // ---------- View switching ----------
  function showView(name) {
    for (const k of Object.keys(views)) views[k].style.display = "none";
    views[name].style.display = (name === "game") ? "" : "block";
    if (name === "game") views[name].style.display = ""; // grid uses default
  }

  // ---------- Teams UI ----------
  function ensureTeamConfigCount(n) {
    n = clamp(n, 2, 4);
    const prev = game.teams.length ? game.teams : null;
    const teams = [];
    for (let i = 0; i < n; i++) {
      teams.push({
        name: prev?.[i]?.name ?? `Team ${i + 1}`,
        token: prev?.[i]?.token ?? TOKENS[i % TOKENS.length],
        color: prev?.[i]?.color ?? COLORS[i % COLORS.length],
        score: 0
      });
    }
    game.teams = teams;
  }

  function renderTeamSelectors() {
    const n = parseInt(ui.teamCount.value, 10);
    ensureTeamConfigCount(n);

    // startTeam options
    ui.startTeam.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `Team ${i + 1}`;
      opt.disabled = i >= n;
      ui.startTeam.appendChild(opt);
    }
    ui.startTeam.value = String(clamp(parseInt(ui.startTeam.value || "0", 10), 0, n - 1));

    // names
    ui.teamNamesWrap.innerHTML = "";
    game.teams.forEach((t, idx) => {
      const box = document.createElement("div");
      box.className = "teamBox";
      box.style.minWidth = "180px";

      const lab = document.createElement("div");
      lab.className = "muted";
      lab.textContent = `Team ${idx + 1}`;
      lab.style.marginBottom = "6px";

      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = t.name;
      inp.placeholder = `Team ${idx + 1}`;
      inp.addEventListener("input", () => { t.name = inp.value.trim() || `Team ${idx + 1}`; });

      box.appendChild(lab);
      box.appendChild(inp);
      ui.teamNamesWrap.appendChild(box);
    });

    // tokens
    ui.teamTokensWrap.innerHTML = "";
    game.teams.forEach((t, idx) => {
      const box = document.createElement("div");
      box.className = "teamBox";
      box.style.minWidth = "180px";

      const lab = document.createElement("div");
      lab.className = "muted";
      lab.textContent = `Team ${idx + 1}`;
      lab.style.marginBottom = "6px";

      const sel = document.createElement("select");
      TOKENS.forEach(tok => {
        const opt = document.createElement("option");
        opt.value = tok;
        opt.textContent = tok;
        sel.appendChild(opt);
      });
      sel.value = t.token;
      sel.addEventListener("change", () => { t.token = sel.value; renderScores(); });

      box.appendChild(lab);
      box.appendChild(sel);
      ui.teamTokensWrap.appendChild(box);
    });

    // colors
    ui.teamColorsWrap.innerHTML = "";
    game.teams.forEach((t, idx) => {
      const box = document.createElement("div");
      box.className = "teamBox";
      box.style.minWidth = "180px";

      const lab = document.createElement("div");
      lab.className = "muted";
      lab.textContent = `Team ${idx + 1}`;
      lab.style.marginBottom = "6px";

      const sel = document.createElement("select");
      COLORS.forEach(col => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        sel.appendChild(opt);
      });
      sel.value = t.color;
      sel.addEventListener("change", () => { t.color = sel.value; renderScores(); });

      box.appendChild(lab);
      box.appendChild(sel);
      ui.teamColorsWrap.appendChild(box);
    });
  }

  // ---------- Game rendering ----------
  function renderTurn() {
    const t = game.teams[game.teamIndex];
    ui.turnBadge.textContent = `${t.token} ${t.name} ist dran`;
    ui.turnBadge.style.borderColor = t.color;
    ui.turnBadge.style.color = t.color;
  }

  function renderScores() {
    ui.scoreWrap.innerHTML = "";
    game.teams.forEach((t, idx) => {
      const row = document.createElement("div");
      row.className = "scoreRow";

      const left = document.createElement("div");
      left.style.display = "flex";
      left.style.gap = "10px";
      left.style.alignItems = "center";

      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = `${t.token} ${t.name}`;
      pill.style.borderColor = t.color;

      const score = document.createElement("span");
      score.className = "score";
      score.textContent = String(t.score);

      left.appendChild(pill);
      left.appendChild(score);

      const right = document.createElement("div");
      right.className = "muted";
      right.textContent = (idx === game.teamIndex) ? "dran" : "";

      row.appendChild(left);
      row.appendChild(right);

      ui.scoreWrap.appendChild(row);
    });
  }

  function pushLog(text) {
    game.log.unshift(`[${nowTime()}] ${text}`);
    game.log = game.log.slice(0, 10);
    ui.logWrap.innerHTML = game.log.map(x => `<div>${escapeHtml(x)}</div>`).join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // ---------- Cards ----------
  function getDeck() {
    const ds = datasets[game.datasetKey] || datasets.kfz;
    const all = [
      ...ds.talk.map(w => ({ type: "Erklären", word: w })),
      ...ds.draw.map(w => ({ type: "Zeichnen", word: w })),
      ...ds.mime.map(w => ({ type: "Pantomime", word: w })),
    ];
    return shuffle(all);
  }

  let deck = [];

  function drawCard() {
    if (!deck.length) deck = getDeck();
    const c = deck.pop();
    game.currentCard = c;
    ui.cardOut.textContent = `${c.type}: ${c.word}`;
    pushLog(`${game.teams[game.teamIndex].name} zieht: ${c.type} – ${c.word}`);
  }

  // ---------- Actions ----------
  function startGame() {
    const n = parseInt(ui.teamCount.value, 10);
    ensureTeamConfigCount(n);
    game.teamIndex = clamp(parseInt(ui.startTeam.value, 10), 0, n - 1);
    game.teams.forEach(t => t.score = 0);
    game.inGame = true;
    game.lastRoll = null;
    game.canDraw = false;
    game.currentCard = null;
    game.log = [];
    deck = [];

    ui.diceOut.textContent = "–";
    ui.cardOut.textContent = "Ziehe eine Karte…";
    ui.statusText.textContent = "Würfeln, dann Karte ziehen.";
    renderTurn();
    renderScores();
    ui.logWrap.innerHTML = "";

    showView("game");
  }

  function nextTeam() {
    const n = game.teams.length;
    game.teamIndex = (game.teamIndex + 1) % n;
    game.lastRoll = null;
    game.canDraw = false;
    game.currentCard = null;
    ui.diceOut.textContent = "–";
    ui.cardOut.textContent = "Ziehe eine Karte…";
    ui.statusText.textContent = "Würfeln, dann Karte ziehen.";
    renderTurn();
    renderScores();
  }

  function rollDice() {
    const v = Math.floor(Math.random() * 6) + 1;
    game.lastRoll = v;
    ui.diceOut.textContent = String(v);
    game.canDraw = true;
    ui.statusText.textContent = "Jetzt Karte ziehen.";
    pushLog(`${game.teams[game.teamIndex].name} würfelt: ${v}`);
  }

  function markResult(ok) {
    if (!game.currentCard) {
      pushLog("Keine Karte aktiv.");
      return;
    }
    const t = game.teams[game.teamIndex];
    const delta = ok ? 1 : 0;
    if (delta) t.score += delta;
    renderScores();
    pushLog(`${t.name}: ${ok ? "✅ erledigt (+1)" : "❌ nicht geschafft"}`);
    // keep card shown; allow next action
  }

  // ---------- Editor ----------
  function openEditor() {
    showView("editor");
    ui.dbSelect.value = game.datasetKey || "kfz";
    loadEditorText();
  }

  function loadEditorText() {
    const key = ui.dbSelect.value;
    const ds = datasets[key];
    const lines = [
      ...ds.talk.map(w => `talk;${w}`),
      ...ds.draw.map(w => `draw;${w}`),
      ...ds.mime.map(w => `mime;${w}`),
    ];
    ui.editorArea.value = lines.join("\n");
  }

  function saveEditorText() {
    const key = ui.dbSelect.value;
    const text = ui.editorArea.value || "";
    const parsed = parseLongTextToDataset(text);
    datasets[key] = parsed;
    saveDatasets(datasets);
    ui.csvStatus.textContent = "Begriffe gespeichert.";
    showView("menu");
  }

  function parseLongTextToDataset(text) {
    const out = { talk: [], draw: [], mime: [] };
    const seen = new Set();
    const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    for (const ln of lines) {
      const parts = ln.split(";").map(x => x.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const cat = parts[0].toLowerCase();
      const word = parts.slice(1).join(" ").trim();
      if (!word) continue;
      if (!["talk","draw","mime"].includes(cat)) continue;
      const k = `${cat}:${word}`.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out[cat].push(word);
    }
    // fallback to defaults if empty
    for (const c of ["talk","draw","mime"]) {
      if (!out[c].length) out[c] = structuredClone(DEFAULT_DATASETS.kfz[c]);
    }
    return out;
  }

  // ---------- CSV Import ----------
  async function importCSVFromInput() {
    const file = ui.csvFile.files?.[0];
    if (!file) {
      ui.csvStatus.textContent = "Bitte zuerst eine CSV-Datei auswählen.";
      return;
    }
    const text = await file.text();

    try {
      const { rows } = parseCSV(text);
      if (!rows.length) throw new Error("CSV ist leer.");

      const header = rows[0].map(h => h.toLowerCase());
      const hasCategoryWord = header.length >= 2 && header[0].includes("category") && header[1].includes("word");
      const hasWide = header.includes("talk") || header.includes("draw") || header.includes("mime");

      let parsed;
      if (hasCategoryWord) {
        parsed = parseLongCSV(rows);
      } else if (hasWide) {
        parsed = parseWideCSV(rows);
      } else {
        // Heuristic: if first row has 2 cols and first col looks like talk/draw/mime
        const first = rows[0];
        if (first.length >= 2 && ["talk","draw","mime"].includes(first[0].toLowerCase())) {
          parsed = parseLongCSV([["category","word"], ...rows]); // treat as no-header long
        } else {
          throw new Error("CSV-Header nicht erkannt. Nutze talk;draw;mime oder category;word.");
        }
      }

      // overwrite BOTH datasets? User asked "eigene Datensätze" - we overwrite current selected one AND keep other unchanged
      // We'll overwrite the currently selected dataset in editor dropdown (or default kfz).
      const targetKey = ui.dbSelect?.value || "kfz";
      datasets[targetKey] = parsed;
      saveDatasets(datasets);

      ui.csvStatus.textContent = `Import OK → Datensatz „${targetKey}“ überschrieben (${parsed.talk.length}/${parsed.draw.length}/${parsed.mime.length}).`;
    } catch (e) {
      ui.csvStatus.textContent = `Import fehlgeschlagen: ${e?.message || e}`;
    }
  }

  function parseWideCSV(rows) {
    const header = rows[0].map(h => h.toLowerCase());
    const idxTalk = header.indexOf("talk");
    const idxDraw = header.indexOf("draw");
    const idxMime = header.indexOf("mime");

    const out = { talk: [], draw: [], mime: [] };
    const seen = new Set();

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const add = (cat, v) => {
        const word = (v ?? "").trim();
        if (!word) return;
        const k = `${cat}:${word}`.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        out[cat].push(word);
      };
      if (idxTalk >= 0) add("talk", r[idxTalk] ?? "");
      if (idxDraw >= 0) add("draw", r[idxDraw] ?? "");
      if (idxMime >= 0) add("mime", r[idxMime] ?? "");
    }

    for (const c of ["talk","draw","mime"]) {
      if (!out[c].length) out[c] = structuredClone(DEFAULT_DATASETS.kfz[c]);
    }
    return out;
  }

  function parseLongCSV(rows) {
    // expects header category, word
    const out = { talk: [], draw: [], mime: [] };
    const seen = new Set();

    const start = 1; // skip header
    for (let i = start; i < rows.length; i++) {
      const r = rows[i];
      if (r.length < 2) continue;
      const cat = String(r[0] ?? "").trim().toLowerCase();
      const word = String(r[1] ?? "").trim();
      if (!word) continue;
      if (!["talk","draw","mime"].includes(cat)) continue;
      const k = `${cat}:${word}`.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out[cat].push(word);
    }

    for (const c of ["talk","draw","mime"]) {
      if (!out[c].length) out[c] = structuredClone(DEFAULT_DATASETS.kfz[c]);
    }
    return out;
  }

  function resetDatasets() {
    localStorage.removeItem(LS_KEY_DATASETS);
    datasets = loadDatasets();
    ui.csvStatus.textContent = "Datensätze zurückgesetzt.";
  }

  // ---------- Hard reset ----------
  function hardReset() {
    localStorage.removeItem(LS_KEY_DATASETS);
    localStorage.removeItem(LS_KEY_EDITOR);
    datasets = loadDatasets();
    game = {
      inGame: false,
      datasetKey: "kfz",
      teams: [],
      teamIndex: 0,
      lastRoll: null,
      canDraw: false,
      currentCard: null,
      log: [],
    };
    ui.teamCount.value = "2";
    ui.startTeam.value = "0";
    renderTeamSelectors();
    ui.csvStatus.textContent = "Alles zurückgesetzt.";
    showView("menu");
  }

  // ---------- Events ----------
  function bindEvents() {
    ui.toMenuBtn?.addEventListener("click", () => { showView("menu"); });
    ui.hardResetBtn?.addEventListener("click", hardReset);

    ui.teamCount?.addEventListener("change", renderTeamSelectors);
    ui.startTeam?.addEventListener("change", renderTeamSelectors);

    ui.startGameBtn?.addEventListener("click", startGame);
    ui.openEditorBtn?.addEventListener("click", openEditor);

    ui.rollBtn?.addEventListener("click", rollDice);
    ui.drawBtn?.addEventListener("click", () => {
      if (!game.canDraw) { pushLog("Erst würfeln."); return; }
      drawCard();
      game.canDraw = false;
      ui.statusText.textContent = "Aufgabe lösen, dann bewerten oder Team wechseln.";
    });
    ui.nextBtn?.addEventListener("click", nextTeam);
    ui.goodBtn?.addEventListener("click", () => markResult(true));
    ui.badBtn?.addEventListener("click", () => markResult(false));

    // Editor
    ui.dbSelect?.addEventListener("change", () => {
      game.datasetKey = ui.dbSelect.value;
      loadEditorText();
    });
    ui.saveEditorBtn?.addEventListener("click", saveEditorText);
    ui.cancelEditorBtn?.addEventListener("click", () => showView("menu"));

    // CSV
    ui.csvImportBtn?.addEventListener("click", importCSVFromInput);
    ui.datasetsResetBtn?.addEventListener("click", resetDatasets);
  }

  // ---------- Init ----------
  function init() {
    // If styles.css from earlier doesn't include some menu classes, we still render OK.
    // Ensure team selectors appear
    if (ui.teamCount) ui.teamCount.value = ui.teamCount.value || "2";
    ensureTeamConfigCount(parseInt(ui.teamCount?.value || "2", 10));
    renderTeamSelectors();

    // default dataset selected in editor dropdown (if present)
    if (ui.dbSelect) ui.dbSelect.value = "kfz";

    bindEvents();
    showView("menu");

    // Small "I'm loaded" marker for debugging
    // eslint-disable-next-line no-console
    console.log("CAB app.js loaded (teams + csv import).");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
