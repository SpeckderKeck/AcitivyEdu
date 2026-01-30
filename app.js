/* app.js – Version: Teams wie zuvor + CSV Import "Lernkarten"
   - Startmenü: Teamnamen + Icon + Farbe
   - Rechte Spalte: CSV Upload (überschreibt Datensatz)
   - Spiel: Würfeln + Lernkarte ziehen + Punkte
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

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  // ---------- Tiny CSV parsing (supports ; or ,) ----------
  function parseCSV(text) {
    // Normalize newlines
    text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!text) return { rows: [], delim: ";" };

    const lines = text.split("\n");

    const semiCount = lines.reduce((acc, ln) => acc + (ln.split(";").length - 1), 0);
    const commaCount = lines.reduce((acc, ln) => acc + (ln.split(",").length - 1), 0);
    const delim = semiCount >= commaCount ? ";" : ",";

    const rows = lines
      .map((ln) => ln.trim())
      .filter(Boolean)
      .map((ln) => ln.split(delim).map((c) => c.trim()));

    return { rows, delim };
  }

  // ---------- Default "Lernkarten" ----------
  const DEFAULT_DATASETS = {
    kfz: {
      talk: ["Katalysator", "Zündkerze", "Einspritzdüse", "Kupplung", "Getriebe", "Bremsflüssigkeit", "Lambdasonde", "Kühlmittel", "Ölwechsel", "Batterie"],
      draw: ["Bremsscheibe", "Reifenprofil", "Auspuff", "Kolben", "Zahnriemen", "Radlager", "Sicherung", "Stoßdämpfer", "Ölfilter", "Kühler"],
      mime: ["Radwechsel", "Starthilfe geben", "Ölstand prüfen", "Bremsen entlüften", "OBD auslesen", "Batterie wechseln", "Luftdruck prüfen", "Wischer wechseln"],
    },
    metall: {
      talk: ["Gleitlager", "Kugellager", "Passung", "Reibung", "Härte", "Schraubenverbindung", "Korrosion", "Werkstoff", "Toleranz", "Flächenpressung"],
      draw: ["Messschieber", "Bügelmessschraube", "Welle", "Buchse", "Gewinde", "Nutmutter", "Lagerbock", "Bohrung", "Senkkopf", "Fase"],
      mime: ["Messen", "Anreißen", "Entgraten", "Schmieren", "Sichern", "Montieren", "Prüfen", "Spannen"],
    },
  };

  const LS_KEY_DATASETS = "cab_datasets_v1";

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function loadDatasets() {
    try {
      const raw = localStorage.getItem(LS_KEY_DATASETS);
      if (!raw) return deepClone(DEFAULT_DATASETS);
      const obj = JSON.parse(raw);
      for (const k of ["kfz", "metall"]) {
        if (!obj[k]) obj[k] = deepClone(DEFAULT_DATASETS[k]);
        for (const c of ["talk", "draw", "mime"]) {
          if (!Array.isArray(obj[k][c])) obj[k][c] = deepClone(DEFAULT_DATASETS[k][c]);
        }
      }
      return obj;
    } catch {
      return deepClone(DEFAULT_DATASETS);
    }
  }

  function saveDatasets(ds) {
    localStorage.setItem(LS_KEY_DATASETS, JSON.stringify(ds));
  }

  let datasets = loadDatasets();

  // ---------- UI refs ----------
  const views = {
    menu: $("menuView"),
    game: $("gameView"),
    editor: $("editorView"),
  };

  const ui = {
    // global
    toMenuBtn: $("toMenuBtn"),
    hardResetBtn: $("hardResetBtn"),

    // menu / teams
    teamCount: $("teamCount"),
    startTeam: $("startTeam"),
    teamNamesWrap: $("teamNamesWrap"),
    teamTokensWrap: $("teamTokensWrap"),
    teamColorsWrap: $("teamColorsWrap"),
    startGameBtn: $("startGameBtn"),
    openEditorBtn: $("openEditorBtn"),

    // csv
    csvFile: $("csvFile"),
    csvImportBtn: $("csvImportBtn"),
    datasetsResetBtn: $("datasetsResetBtn"),
    csvStatus: $("csvStatus"),

    // game
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

    // editor
    dbSelect: $("dbSelect"),
    editorArea: $("editorArea"),
    saveEditorBtn: $("saveEditorBtn"),
    cancelEditorBtn: $("cancelEditorBtn"),
  };

  // ---------- View switching ----------
  function showView(name) {
    for (const k of Object.keys(views)) views[k].style.display = "none";
    if (name === "game") views[name].style.display = ""; // let css grid handle
    else views[name].style.display = "block";
  }

  // ---------- Game state ----------
  const TOKENS = ["🚗", "🔧", "🧰", "⚙️", "🛞", "🧪", "🛠️", "🏁", "🔩", "🧯", "🧲", "📏"];
  const COLORS = ["#3b82f6", "#22c55e", "#eab308", "#ef4444", "#a855f7", "#14b8a6", "#f97316", "#64748b"];

  let game = {
    datasetKey: "kfz",
    teams: [],
    teamIndex: 0,
    lastRoll: null,
    canDraw: false,
    currentCard: null,
    log: [],
  };

  // ---------- Menu: teams render ----------
  function ensureTeams(n) {
    n = clamp(n, 2, 4);
    const prev = game.teams;
    const teams = [];
    for (let i = 0; i < n; i++) {
      teams.push({
        name: prev[i]?.name ?? `Team ${i + 1}`,
        token: prev[i]?.token ?? TOKENS[i % TOKENS.length],
        color: prev[i]?.color ?? COLORS[i % COLORS.length],
        score: prev[i]?.score ?? 0,
      });
    }
    game.teams = teams;
  }

  function renderTeamSelectors() {
    const n = parseInt(ui.teamCount.value, 10);
    ensureTeams(n);

    // Start team dropdown: keep options 0-3, disable beyond n
    ui.startTeam.innerHTML = "";
    for (let i = 0; i < 4; i++) {
      const opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = `Team ${i + 1}`;
      opt.disabled = i >= n;
      ui.startTeam.appendChild(opt);
    }
    const currentStart = clamp(parseInt(ui.startTeam.value || "0", 10), 0, n - 1);
    ui.startTeam.value = String(currentStart);

    // Names
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
      inp.addEventListener("input", () => {
        const val = inp.value.trim();
        t.name = val || `Team ${idx + 1}`;
      });

      box.appendChild(lab);
      box.appendChild(inp);
      ui.teamNamesWrap.appendChild(box);
    });

    // Tokens
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
      TOKENS.forEach((tok) => {
        const opt = document.createElement("option");
        opt.value = tok;
        opt.textContent = tok;
        sel.appendChild(opt);
      });
      sel.value = t.token;
      sel.addEventListener("change", () => {
        t.token = sel.value;
        renderScores();
      });

      box.appendChild(lab);
      box.appendChild(sel);
      ui.teamTokensWrap.appendChild(box);
    });

    // Colors
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
      COLORS.forEach((col) => {
        const opt = document.createElement("option");
        opt.value = col;
        opt.textContent = col;
        sel.appendChild(opt);
      });
      sel.value = t.color;
      sel.addEventListener("change", () => {
        t.color = sel.value;
        renderScores();
        renderTurn();
      });

      box.appendChild(lab);
      box.appendChild(sel);
      ui.teamColorsWrap.appendChild(box);
    });
  }

  // ---------- Game UI ----------
  function renderTurn() {
    const t = game.teams[game.teamIndex];
    if (!t) return;
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
      right.textContent = idx === game.teamIndex ? "dran" : "";

      row.appendChild(left);
      row.appendChild(right);

      ui.scoreWrap.appendChild(row);
    });
  }

  function pushLog(text) {
    game.log.unshift(`[${nowTime()}] ${text}`);
    game.log = game.log.slice(0, 12);
    ui.logWrap.innerHTML = game.log.map((x) => `<div>${escapeHtml(x)}</div>`).join("");
  }

  // ---------- Cards ----------
  let deck = [];

  function buildDeck() {
    const ds = datasets[game.datasetKey] || datasets.kfz;
    const all = [
      ...ds.talk.map((w) => ({ type: "Erklären", word: w })),
      ...ds.draw.map((w) => ({ type: "Zeichnen", word: w })),
      ...ds.mime.map((w) => ({ type: "Pantomime", word: w })),
    ];
    return shuffle(all);
  }

  function drawCard() {
    if (!deck.length) deck = buildDeck();
    const c = deck.pop();
    game.currentCard = c;
    ui.cardOut.textContent = `${c.type}: ${c.word}`;
    pushLog(`${game.teams[game.teamIndex].name} zieht: ${c.type} – ${c.word}`);
  }

  // ---------- Game actions ----------
  function startGame() {
    const n = parseInt(ui.teamCount.value, 10);
    ensureTeams(n);

    // safety: apply names from inputs already bound
    const startIdx = clamp(parseInt(ui.startTeam.value, 10), 0, n - 1);
    game.teamIndex = startIdx;

    // reset scores
    game.teams.forEach((t) => (t.score = 0));
    game.lastRoll = null;
    game.canDraw = false;
    game.currentCard = null;
    game.log = [];
    deck = [];

    ui.diceOut.textContent = "–";
    ui.cardOut.textContent = "Ziehe eine Lernkarte…";
    ui.statusText.textContent = "Würfeln, dann Lernkarte ziehen.";

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
    ui.cardOut.textContent = "Ziehe eine Lernkarte…";
    ui.statusText.textContent = "Würfeln, dann Lernkarte ziehen.";

    renderTurn();
    renderScores();
  }

  function rollDice() {
    const v = Math.floor(Math.random() * 6) + 1;
    game.lastRoll = v;
    ui.diceOut.textContent = String(v);
    game.canDraw = true;
    ui.statusText.textContent = "Jetzt Lernkarte ziehen.";
    pushLog(`${game.teams[game.teamIndex].name} würfelt: ${v}`);
  }

  function markResult(ok) {
    if (!game.currentCard) {
      pushLog("Keine Lernkarte aktiv.");
      return;
    }
    const t = game.teams[game.teamIndex];
    if (ok) t.score += 1;
    renderScores();
    pushLog(`${t.name}: ${ok ? "✅ erledigt (+1)" : "❌ nicht geschafft"}`);
  }

  // ---------- Editor ("Lernkarten bearbeiten") ----------
  function openEditor() {
    showView("editor");
    ui.dbSelect.value = game.datasetKey;
    loadEditorText();
  }

  function loadEditorText() {
    const key = ui.dbSelect.value;
    const ds = datasets[key];
    const lines = [
      ...ds.talk.map((w) => `talk;${w}`),
      ...ds.draw.map((w) => `draw;${w}`),
      ...ds.mime.map((w) => `mime;${w}`),
    ];
    ui.editorArea.value = lines.join("\n");
  }

  function saveEditorText() {
    const key = ui.dbSelect.value;
    const parsed = parseLongText(ui.editorArea.value || "");
    datasets[key] = parsed;
    saveDatasets(datasets);
    if (ui.csvStatus) ui.csvStatus.textContent = "Lernkarten gespeichert.";
    showView("menu");
  }

  function parseLongText(text) {
    const out = { talk: [], draw: [], mime: [] };
    const seen = new Set();
    const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    for (const ln of lines) {
      const parts = ln.split(";").map((x) => x.trim()).filter(Boolean);
      if (parts.length < 2) continue;
      const cat = parts[0].toLowerCase();
      const word = parts.slice(1).join(" ").trim();
      if (!word) continue;
      if (!["talk", "draw", "mime"].includes(cat)) continue;
      const k = `${cat}:${word}`.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out[cat].push(word);
    }
    // if empty, fallback to defaults
    for (const c of ["talk", "draw", "mime"]) {
      if (!out[c].length) out[c] = deepClone(DEFAULT_DATASETS.kfz[c]);
    }
    return out;
  }

  // ---------- CSV Import ("Lernkarten") ----------
  async function importCSV() {
    if (!ui.csvFile?.files?.[0]) {
      if (ui.csvStatus) ui.csvStatus.textContent = "Bitte zuerst eine CSV-Datei auswählen.";
      return;
    }
    const file = ui.csvFile.files[0];
    const text = await file.text();

    try {
      const { rows } = parseCSV(text);
      if (!rows.length) throw new Error("CSV ist leer.");

      const header = rows[0].map((h) => h.toLowerCase());
      const hasLongHeader = header.length >= 2 && header[0].includes("category") && header[1].includes("word");
      const hasWideHeader = header.includes("talk") || header.includes("draw") || header.includes("mime");

      let parsed;
      if (hasLongHeader) parsed = parseLongCSV(rows);
      else if (hasWideHeader) parsed = parseWideCSV(rows);
      else {
        // no header long form?
        const first = rows[0];
        if (first.length >= 2 && ["talk", "draw", "mime"].includes(String(first[0]).toLowerCase())) {
          parsed = parseLongCSV([["category", "word"], ...rows]);
        } else {
          throw new Error("CSV-Header nicht erkannt. Nutze talk;draw;mime oder category;word.");
        }
      }

      // overwrite current dataset selection (editor dropdown), default kfz
      const targetKey = ui.dbSelect?.value || game.datasetKey || "kfz";
      datasets[targetKey] = parsed;
      saveDatasets(datasets);

      if (ui.csvStatus) ui.csvStatus.textContent = `Import OK → Lernkarten „${targetKey}“ überschrieben (${parsed.talk.length}/${parsed.draw.length}/${parsed.mime.length}).`;
    } catch (e) {
      if (ui.csvStatus) ui.csvStatus.textContent = `Import fehlgeschlagen: ${e?.message || e}`;
    }
  }

  function parseWideCSV(rows) {
    const header = rows[0].map((h) => h.toLowerCase());
    const iTalk = header.indexOf("talk");
    const iDraw = header.indexOf("draw");
    const iMime = header.indexOf("mime");

    const out = { talk: [], draw: [], mime: [] };
    const seen = new Set();

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const add = (cat, val) => {
        const word = String(val ?? "").trim();
        if (!word) return;
        const k = `${cat}:${word}`.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k);
        out[cat].push(word);
      };
      if (iTalk >= 0) add("talk", row[iTalk]);
      if (iDraw >= 0) add("draw", row[iDraw]);
      if (iMime >= 0) add("mime", row[iMime]);
    }

    for (const c of ["talk", "draw", "mime"]) {
      if (!out[c].length) out[c] = deepClone(DEFAULT_DATASETS.kfz[c]);
    }
    return out;
  }

  function parseLongCSV(rows) {
    const out = { talk: [], draw: [], mime: [] };
    const seen = new Set();

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row.length < 2) continue;
      const cat = String(row[0] ?? "").trim().toLowerCase();
      const word = String(row[1] ?? "").trim();
      if (!word) continue;
      if (!["talk", "draw", "mime"].includes(cat)) continue;
      const k = `${cat}:${word}`.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out[cat].push(word);
    }

    for (const c of ["talk", "draw", "mime"]) {
      if (!out[c].length) out[c] = deepClone(DEFAULT_DATASETS.kfz[c]);
    }
    return out;
  }

  function resetDatasets() {
    localStorage.removeItem(LS_KEY_DATASETS);
    datasets = loadDatasets();
    if (ui.csvStatus) ui.csvStatus.textContent = "Lernkarten zurückgesetzt.";
  }

  function hardReset() {
    resetDatasets();
    ui.teamCount.value = "2";
    ui.startTeam.value = "0";
    game.teams = [];
    renderTeamSelectors();
    showView("menu");
    if (ui.csvStatus) ui.csvStatus.textContent = "Reset abgeschlossen.";
  }

  // ---------- Events ----------
  function bindEvents() {
    ui.toMenuBtn?.addEventListener("click", () => showView("menu"));
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

    ui.dbSelect?.addEventListener("change", () => {
      game.datasetKey = ui.dbSelect.value;
      loadEditorText();
    });
    ui.saveEditorBtn?.addEventListener("click", saveEditorText);
    ui.cancelEditorBtn?.addEventListener("click", () => showView("menu"));

    ui.csvImportBtn?.addEventListener("click", importCSV);
    ui.datasetsResetBtn?.addEventListener("click", resetDatasets);
  }

  function init() {
    // Default team config
    if (ui.teamCount) ui.teamCount.value = ui.teamCount.value || "2";
    ensureTeams(parseInt(ui.teamCount?.value || "2", 10));
    renderTeamSelectors();

    // Default dataset key
    if (ui.dbSelect) ui.dbSelect.value = game.datasetKey;

    bindEvents();
    showView("menu");

    // Debug marker
    console.log("app.js loaded: teams + lernkarten csv");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
