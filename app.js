/***********************
 * 1) DATENBANKEN (Industriemechaniker, max. 2 Wörter, je 30)
 * Fokus: Audi-Umfeld, Instandhaltung, Korrosion/Korrosionsschutz
 ***********************/
const WORDS_TALK = [
  "Wartung", "Reparatur", "Störung", "Stillstand", "Schichtbuch",
  "Störmeldung", "Ursache", "Maßnahme", "Prüfung", "Kontrolle",
  "Ersatzteil", "Lagerbestand", "Sicherheit", "Freigabe", "Absperren",
  "Not Aus", "Gefahr", "Arbeitsplatz", "Ordnung", "Sauberkeit",
  "Schmierplan", "Schmierung", "Ölstand", "Druckluft", "Leck",
  "Sensor", "Motor", "Getriebe", "Schraube", "Dichtung"
];

const WORDS_DRAW = [
  "Schraube", "Mutter", "Unterlegscheibe", "Sechskant", "Inbus",
  "Schraubendreher", "Maulschlüssel", "Ratsche", "Zange", "Hammer",
  "Bohrer", "Bohrmaschine", "Feile", "Säge", "Messschieber",
  "Kugellager", "Welle", "Achse", "Zahnrad", "Riemen",
  "Kette", "Feder", "Bolzen", "Splint", "Dichtung",
  "Ventil", "Schlauch", "Filter", "Schutzhaube", "Not Aus"
];

const WORDS_MIME = [
  "Maschine starten", "Maschine stoppen", "Not Aus", "Störung melden", "Hilfe holen",
  "Schraube lösen", "Schraube anziehen", "Teil wechseln", "Teil prüfen", "Teil reinigen",
  "Schmieren", "Öl nachfüllen", "Druck ablassen", "Leck suchen", "Stecker ziehen",
  "Stecker stecken", "Handschuhe an", "Brille auf", "Absperren", "Warnschild",
  "Messen", "Nachziehen", "Klopfen", "Schleifen", "Bürsten",
  "Rost weg", "Lackieren", "Abkleben", "Warten", "Weiter"
];

// Korrosion / Schutz als extra Pools (werden je nach Kategorie gemischt)
const CORR_TALK = [
  "Rost", "Korrosion", "Feuchtigkeit", "Salz", "Luft",
  "Metall", "Stahl", "Alu", "Kontakt", "Spalt",
  "Loch", "Schutz", "Lack", "Fett", "Öl",
  "Wachs", "Zink", "Grundierung", "Beschichtung", "Reinigung",
  "Trocknen", "Abdecken", "Pflege", "Kontrolle", "Schaden",
  "Kratzer", "Dreck", "Wasser", "Schutzfolie", "Spray"
];

const CORR_DRAW = [
  "Rost", "Roststelle", "Kratzer", "Spalt", "Schraube",
  "Zinkschicht", "Lackschicht", "Grundierung", "Fettfilm", "Ölfilm",
  "Wachsfilm", "Spray", "Bürste", "Schleifpapier", "Tuch",
  "Wasser", "Salz", "Dreck", "Stahl", "Alu",
  "Kontakt", "Schutzfolie", "Abdeckung", "Dichtung", "Riss",
  "Loch", "Kante", "Blech", "Rahmen", "Gehäuse"
];

const CORR_MIME = [
  "Rost prüfen", "Bürsten", "Schleifen", "Entfetten", "Reinigen",
  "Trocknen", "Abkleben", "Grundieren", "Lackieren", "Spray benutzen",
  "Wachs drauf", "Fett drauf", "Öl drauf", "Schutzfolie", "Abdecken",
  "Schraube raus", "Schraube rein", "Dichtung setzen", "Kratzer zeigen", "Salz zeigen",
  "Wasser zeigen", "Dreck weg", "Wischen", "Warten", "Kontrolle",
  "Nacharbeiten", "Nachlackieren", "Schutz an", "Schutz aus", "Fertig"
];

const CAT = {
  talk: { key:"talk", name:"Erklären", emoji:"🗣️", seconds:60,  symbol:"🗣️" },
  draw: { key:"draw", name:"Zeichnen", emoji:"✍️", seconds:90,  symbol:"✍️" },
  mime: { key:"mime", name:"Pantomime", emoji:"🤫", seconds:90, symbol:"🤫" }
};

const ICONS = [
  { key:"car",   label:"Auto",      glyph:"🚗" },
  { key:"wrench",label:"Schlüssel", glyph:"🔧" },
  { key:"bolt",  label:"Schraube",  glyph:"🔩" },
  { key:"spark", label:"Zündfunke", glyph:"⚡" },
  { key:"gear",  label:"Zahnrad",   glyph:"⚙️" },
  { key:"flag",  label:"Flagge",    glyph:"🏁" },
  { key:"pen",   label:"Stift",     glyph:"🖊️" },
  { key:"mask",  label:"Maske",     glyph:"🎭" }
];

/***********************
 * 2) STATE
 ***********************/
let teams = [];
let teamCount = 2;
let boardLength = 32;

const GRID_COLS = 8, GRID_ROWS = 5, GRID_MAX = GRID_COLS * GRID_ROWS;

let turnIndex = 0;
let lastRoll = null;
let currentCat = null;
let currentWord = null;

let previewPos = null;
let pendingOutcome = null;
let cardOpen = false;

let timer = null;
let remaining = 0;

let moveAnim = null;
let isMoving = false;

const STEP = { ROLL:"ROLL", REVEAL:"REVEAL", ANSWER:"ANSWER" };
let assistantStep = STEP.ROLL;

let catFlashTimeout = null;
let snakePath = [];

/***********************
 * 3) DOM
 ***********************/
const menuView = document.getElementById("menuView");
const gameView = document.getElementById("gameView");

const teamCountSel = document.getElementById("teamCount");
const boardLenSel  = document.getElementById("boardLen");
const teamInputs   = document.getElementById("teamInputs");

const startGameBtn = document.getElementById("startGameBtn");
const demoFillBtn  = document.getElementById("demoFillBtn");
const toMenuBtn    = document.getElementById("toMenuBtn");
const hardResetBtn = document.getElementById("hardResetBtn");

const btnOpenMenu  = document.getElementById("btnOpenMenu");
const btnRoll      = document.getElementById("btnRoll");
const btnReveal    = document.getElementById("btnReveal");
const btnNextTeam  = document.getElementById("btnNextTeam");

const assistantText= document.getElementById("assistantText");
const turnTeamEl   = document.getElementById("turnTeam");

const pathLayer    = document.getElementById("pathLayer");
const piecesLayer  = document.getElementById("piecesLayer");
const trackSvg     = document.getElementById("trackSvg");

const diceOverlay  = document.getElementById("diceOverlay");
const diceBox      = document.getElementById("diceBox");

const catFlash     = document.getElementById("catFlash");

const wordOverlay  = document.getElementById("wordOverlay");
const closeWord    = document.getElementById("closeWord");
const cardCatBadge = document.getElementById("cardCatBadge");
const cardTimer    = document.getElementById("cardTimer");
const cardWord     = document.getElementById("cardWord");
const btnCorrect   = document.getElementById("btnCorrect");
const btnWrong     = document.getElementById("btnWrong");
const btnSwap      = document.getElementById("btnSwap");

const toastEl      = document.getElementById("toast");

/***********************
 * 4) UTIL
 ***********************/
function randInt(min,max){ return Math.floor(Math.random()*(max-min+1))+min; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function toast(msg){
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(()=>toastEl.classList.remove("show"), 1400);
}

function fmtTime(s){
  const m = Math.floor(s/60);
  const r = s%60;
  return m>0 ? `${m}:${String(r).padStart(2,"0")}` : `${r}s`;
}

function stopTimer(){ if(timer) clearInterval(timer); timer = null; }
function stopMoveAnim(){ if(moveAnim) clearInterval(moveAnim); moveAnim = null; isMoving = false; }

function currentTeam(){ return teams[turnIndex]; }

function setControlsEnabled(enabled){
  const dis = !enabled;
  btnRoll.disabled = dis;
  btnReveal.disabled = dis;
  btnNextTeam.disabled = dis;
  btnOpenMenu.disabled = dis;

  btnCorrect.disabled = dis;
  btnWrong.disabled = dis;
  btnSwap.disabled = dis;
  closeWord.style.pointerEvents = enabled ? "auto" : "none";
  closeWord.style.opacity = enabled ? "1" : ".7";
}

function setAssistant(step, msg){
  assistantStep = step;
  assistantText.textContent = "Assistent: " + msg;

  [btnRoll, btnReveal].forEach(b=>b.classList.remove("glow"));
  [btnCorrect, btnWrong].forEach(b=>b.classList.remove("glow"));

  if(step === STEP.ROLL) btnRoll.classList.add("glow");
  if(step === STEP.REVEAL) btnReveal.classList.add("glow");
  if(step === STEP.ANSWER){
    btnCorrect.classList.add("glow");
    btnWrong.classList.add("glow");
  }
}

function showDiceOverlay(n){
  diceOverlay.classList.add("show");
  diceBox.classList.add("rolling");
  diceBox.textContent = "🎲";
  setTimeout(()=>{ diceBox.textContent = String(n); }, 420);
  setTimeout(()=>{
    diceBox.classList.remove("rolling");
    diceOverlay.classList.remove("show");
  }, 900);
}

/***********************
 * 5) Kategorie-Flash (2s)
 ***********************/
function flashCategory(catKey){
  if(catFlashTimeout) clearTimeout(catFlashTimeout);
  const c = CAT[catKey];
  if(!c) return;
  catFlash.textContent = `${c.emoji} ${c.name}`;
  catFlash.classList.add("show");
  catFlashTimeout = setTimeout(()=> catFlash.classList.remove("show"), 2000);
}

/***********************
 * 6) Snake Path + Board
 ***********************/
function tileCategoryAt(stepIndex){
  if(stepIndex === 0) return "start";
  if(stepIndex === boardLength-1) return "goal";
  const cyc = (stepIndex % 3);
  return cyc === 1 ? "talk" : (cyc === 2 ? "draw" : "mime");
}

function symbolForTile(stepIndex){
  const cat = tileCategoryAt(stepIndex);
  if(cat === "start") return { type:"text", value:"START" };
  if(cat === "goal") return { type:"text", value:"ZIEL" };
  return { type:"sym", value: CAT[cat]?.symbol || "•" };
}

function buildSnakePath(){
  const path = [];
  for(let r=0;r<GRID_ROWS;r++){
    const row = [];
    for(let c=0;c<GRID_COLS;c++) row.push(r*GRID_COLS + c);
    if(r % 2 === 1) row.reverse();
    path.push(...row);
  }
  return path.slice(0, boardLength);
}

function buildBoard(){
  boardLength = clamp(boardLength, 6, GRID_MAX);
  snakePath = buildSnakePath();

  pathLayer.innerHTML = "";
  piecesLayer.innerHTML = "";

  const activeSet = new Set(snakePath);
  const cellToStep = new Map();
  snakePath.forEach((cellIdx, stepIdx)=> cellToStep.set(cellIdx, stepIdx));

  for(let cellIdx=0; cellIdx<GRID_MAX; cellIdx++){
    const isActive = activeSet.has(cellIdx);
    const cell = document.createElement("div");
    cell.className = "cell " + (isActive ? tileCategoryAt(cellToStep.get(cellIdx)) : "inactive");

    const s = document.createElement("div");
    const sym = isActive ? symbolForTile(cellToStep.get(cellIdx)) : {type:"sym", value:""};
    s.className = "sym" + (sym.type==="text" ? " symText" : "");
    s.textContent = sym.value;
    cell.appendChild(s);

    pathLayer.appendChild(cell);

    const slot = document.createElement("div");
    slot.className = "pieceSlot";
    piecesLayer.appendChild(slot);
  }

  requestAnimationFrame(drawTrackOutline);
}

/***********************
 * 6b) Track: transparent (20% opacity) + FIX:
 * - Wir setzen die Outer-Path-Opacity wirklich sichtbar auf 0.20
 * - Wichtig: Cut bleibt opak, damit nur Außenkontur bleibt.
 * - Zusätzlich: Pointer-events bleiben aus, damit es nichts blockiert.
 ***********************/
function drawTrackOutline(){
  const cells = Array.from(pathLayer.children);
  if(!cells.length || !snakePath.length) return;

  const layerRect = pathLayer.getBoundingClientRect();
  const w = layerRect.width;
  const h = layerRect.height;

  trackSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  trackSvg.innerHTML = "";

  const pts = snakePath.map((cellIndex)=>{
    const r = cells[cellIndex].getBoundingClientRect();
    return [(r.left - layerRect.left) + r.width/2, (r.top - layerRect.top) + r.height/2];
  });

  const d = pts.map((p, i)=> (i===0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(" ");

  const shadow = document.createElementNS("http://www.w3.org/2000/svg","path");
  shadow.setAttribute("d", d);
  shadow.setAttribute("fill","none");
  shadow.setAttribute("stroke","rgba(0,0,0,.55)");
  shadow.setAttribute("stroke-width","64");
  shadow.setAttribute("stroke-linecap","round");
  shadow.setAttribute("stroke-linejoin","round");
  shadow.setAttribute("class","trackShadow");

  const outer = document.createElementNS("http://www.w3.org/2000/svg","path");
  outer.setAttribute("d", d);
  outer.setAttribute("fill","none");
  outer.setAttribute("stroke","rgba(255,255,255,1)");
  outer.setAttribute("stroke-width","58");
  outer.setAttribute("stroke-linecap","round");
  outer.setAttribute("stroke-linejoin","round");
  outer.setAttribute("class","trackOuter"); // 20% opacity via CSS
  // Safety: force opacity for cases where CSS might not apply
  outer.setAttribute("opacity","0.20");

  const cut = document.createElementNS("http://www.w3.org/2000/svg","path");
  cut.setAttribute("d", d);
  cut.setAttribute("fill","none");
  cut.setAttribute("stroke","transparent");
  cut.setAttribute("stroke-width","44");
  cut.setAttribute("stroke-linecap","round");
  cut.setAttribute("stroke-linejoin","round");
  cut.setAttribute("opacity","1");

  trackSvg.appendChild(shadow);
  trackSvg.appendChild(outer);
  trackSvg.appendChild(cut);
}

window.addEventListener("resize", ()=> requestAnimationFrame(drawTrackOutline));

/***********************
 * 7) Pieces
 ***********************/
function clearPieces(){
  const slots = piecesLayer.querySelectorAll(".pieceSlot");
  slots.forEach(s=>s.innerHTML = "");
}

function renderPieces(){
  clearPieces();
  const slots = piecesLayer.querySelectorAll(".pieceSlot");

  teams.forEach((tm, i)=>{
    const step = clamp(tm.displayPos, 0, boardLength-1);
    const cellIndex = snakePath[step];
    const slot = slots[cellIndex];

    const p = document.createElement("div");
    p.className = "piece";
    p.textContent = tm.glyph;
    p.style.background = tm.color;
    p.style.boxShadow = `0 18px 28px rgba(0,0,0,.45), 0 0 18px ${tm.color}66`;

    const offsetX = 10 + (i % 2) * 44;
    const offsetY = 10 + (Math.floor(i/2) % 2) * 44;
    p.style.left = offsetX + "px";
    p.style.top  = offsetY + "px";

    slot.appendChild(p);
  });
}

function hopOnStep(step){
  const cellIndex = snakePath[clamp(step,0,boardLength-1)];
  const slots = piecesLayer.querySelectorAll(".pieceSlot");
  const pieces = slots[cellIndex]?.querySelectorAll(".piece") || [];
  pieces.forEach(p=>{
    p.classList.remove("moving");
    void p.offsetWidth;
    p.classList.add("moving");
  });
}

function animateStepwise(teamIdx, fromStep, toStep, onDone){
  if(isMoving) return;
  isMoving = true;
  setControlsEnabled(false);

  const tm = teams[teamIdx];
  let current = fromStep;
  const dir = toStep >= fromStep ? 1 : -1;

  moveAnim = setInterval(()=>{
    if(current === toStep){
      stopMoveAnim();
      isMoving = false;
      setControlsEnabled(true);
      hopOnStep(toStep);
      if(onDone) onDone();
      return;
    }
    current += dir;
    tm.displayPos = current;
    renderPieces();
    hopOnStep(current);
  }, 170);
}

/***********************
 * 8) MENU
 ***********************/
function iconOptionsHtml(selectedKey){
  return ICONS.map(ic => `<option value="${ic.key}" ${ic.key===selectedKey ? "selected":""}>${ic.glyph} ${ic.label}</option>`).join("");
}

function rebuildTeamInputs(){
  teamInputs.innerHTML = "";
  teamCount = Number(teamCountSel.value);

  const defaults = [
    {name:"Team A", color:"#60a5fa", icon:"car"},
    {name:"Team B", color:"#a78bfa", icon:"wrench"},
    {name:"Team C", color:"#34d399", icon:"gear"},
    {name:"Team D", color:"#f59e0b", icon:"bolt"}
  ];

  for(let i=0;i<teamCount;i++){
    const row = document.createElement("div");
    row.className = "teamRow";

    const tag = document.createElement("div");
    tag.className = "teamTag";
    tag.textContent = String(i+1);

    const nameInp = document.createElement("input");
    nameInp.type = "text";
    nameInp.placeholder = defaults[i].name;
    nameInp.value = (teams[i]?.name) || defaults[i].name;

    const colorWrap = document.createElement("div");
    colorWrap.className = "colorPick";
    const color = document.createElement("input");
    color.type = "color";
    color.value = (teams[i]?.color) || defaults[i].color;
    colorWrap.appendChild(color);

    const iconSel = document.createElement("select");
    iconSel.className = "iconPick";
    iconSel.innerHTML = iconOptionsHtml((teams[i]?.iconKey) || defaults[i].icon);

    const iconPrev = document.createElement("div");
    iconPrev.className = "iconPreview";
    iconPrev.textContent = ICONS.find(x=>x.key===((teams[i]?.iconKey)||defaults[i].icon))?.glyph || "🚗";

    iconSel.addEventListener("change", ()=>{
      iconPrev.textContent = ICONS.find(x=>x.key===iconSel.value)?.glyph || "🚗";
    });

    row.appendChild(tag);
    row.appendChild(nameInp);
    row.appendChild(colorWrap);
    row.appendChild(iconSel);
    row.appendChild(iconPrev);
    teamInputs.appendChild(row);
  }
}

function readTeamsFromMenu(){
  const textInputs = teamInputs.querySelectorAll("input[type='text']");
  const colorInputs= teamInputs.querySelectorAll("input[type='color']");
  const iconSelects= teamInputs.querySelectorAll("select.iconPick");

  const t = [];
  for(let i=0;i<textInputs.length;i++){
    const name = (textInputs[i].value || textInputs[i].placeholder || "Team").trim();
    const color = colorInputs[i]?.value || "#60a5fa";
    const iconKey = iconSelects[i]?.value || "car";
    const glyph = ICONS.find(x=>x.key===iconKey)?.glyph || "🚗";
    t.push({ id:i, name, color, iconKey, glyph, committedPos:0, displayPos:0 });
  }
  return t;
}

/***********************
 * 9) KARTEN + TIMER (nur Karte)
 ***********************/
function pickWordForCategory(catKey){
  // Mix: ca. 25% Korrosion/Schutz, 75% allgemeine Instandhaltung/Mechanik
  const roll = Math.random();
  const pools = {
    talk: (roll < 0.25 ? CORR_TALK : WORDS_TALK),
    draw: (roll < 0.25 ? CORR_DRAW : WORDS_DRAW),
    mime: (roll < 0.25 ? CORR_MIME : WORDS_MIME)
  };
  const list = pools[catKey] || WORDS_TALK;
  return list[randInt(0, list.length-1)];
}

function startCategoryTimer(catKey){
  stopTimer();
  remaining = CAT[catKey]?.seconds ?? 60;
  cardTimer.textContent = fmtTime(remaining);

  timer = setInterval(()=>{
    remaining = Math.max(0, remaining - 1);
    cardTimer.textContent = fmtTime(remaining);

    if(remaining <= 0){
      stopTimer();
      if(cardOpen && !pendingOutcome){
        pendingOutcome = "timeout";
        toast("⏱️ Zeit ist um!");
        setTimeout(()=> closeCardAndResolve(), 450);
      }
    }
  }, 1000);
}

function openCard(){
  if(assistantStep !== STEP.REVEAL){ toast("Erst würfeln."); return; }
  if(isMoving) return;
  if(previewPos === null || !currentCat || !lastRoll){
    toast("Bitte zuerst würfeln.");
    return;
  }

  cardOpen = true;
  wordOverlay.classList.add("show");

  const c = CAT[currentCat];
  cardCatBadge.textContent = `${c.emoji} ${c.name}`;
  cardWord.textContent = currentWord;

  startCategoryTimer(currentCat);
  setAssistant(STEP.ANSWER, "Nach dem Darstellen: Richtig oder Falsch wählen.");
}

function closeCardAndResolve(){
  if(isMoving) return;

  cardOpen = false;
  wordOverlay.classList.remove("show");
  stopTimer();

  const tm = currentTeam();
  if(!tm) return;

  if(!pendingOutcome) pendingOutcome = "wrong";

  if(pendingOutcome === "correct"){
    tm.committedPos = tm.displayPos;

    if(tm.committedPos === boardLength-1){
      toast(`🏁 ${tm.name} hat das Ziel erreicht!`);
      currentCat = null; lastRoll = null; previewPos = null; pendingOutcome = null;
      setAssistant(STEP.ROLL, "Spiel beendet — Reset oder neues Spiel starten.");
      [btnRoll, btnReveal, btnCorrect, btnWrong].forEach(b=>b.classList.remove("glow"));
      return;
    }

    pendingOutcome = null;
    nextTeam();
    return;
  }

  const from = tm.displayPos;
  const to = tm.committedPos;
  toast(pendingOutcome === "timeout" ? "Zeit abgelaufen – zurück!" : "Falsch – zurück!");
  pendingOutcome = null;

  animateStepwise(turnIndex, from, to, ()=>{
    currentCat = null; lastRoll = null; previewPos = null;
    nextTeam();
  });
}

function answer(correct){
  if(assistantStep !== STEP.ANSWER){ toast("Erst Karte aufdecken."); return; }
  if(isMoving) return;
  pendingOutcome = correct ? "correct" : "wrong";
  closeCardAndResolve();
}

function swapWord(){
  if(!cardOpen) return;
  currentWord = pickWordForCategory(currentCat);
  cardWord.textContent = currentWord;
  toast("Neuer Begriff");
}

/***********************
 * 10) GAME FLOW
 ***********************/
function nextTeam(){
  stopTimer();
  stopMoveAnim();

  pendingOutcome = null;
  cardOpen = false;

  teams.forEach(t=> t.displayPos = t.committedPos);

  lastRoll = null;
  currentWord = null;
  currentCat = null;
  previewPos = null;

  turnIndex = (turnIndex + 1) % teams.length;
  turnTeamEl.textContent = `${currentTeam().glyph} ${currentTeam().name}`;
  setAssistant(STEP.ROLL, "Würfeln, um die Vorschau-Bewegung zu starten.");
  renderPieces();
}

function rollDice(){
  if(assistantStep !== STEP.ROLL){ toast("Erst den aktuellen Schritt abschließen."); return; }
  if(isMoving || cardOpen){ toast("Bitte warten…"); return; }

  const tm = currentTeam();
  if(!tm) return;

  const n = randInt(1,6);
  lastRoll = n;
  showDiceOverlay(n);

  const from = tm.committedPos;
  previewPos = clamp(from + n, 0, boardLength-1);

  currentCat = null;

  animateStepwise(turnIndex, from, previewPos, ()=>{
    let cat = tileCategoryAt(previewPos);
    if(cat === "start" || cat === "goal"){
      const next = tileCategoryAt(clamp(previewPos+1, 0, boardLength-1));
      cat = (next === "start" || next === "goal") ? "talk" : next;
    }
    currentCat = cat;
    currentWord = pickWordForCategory(currentCat);

    flashCategory(currentCat);
    setAssistant(STEP.REVEAL, "Karte aufdecken, wenn die Spieler bereit sind.");
  });
}

/***********************
 * 11) VIEW SWITCH + RESET
 ***********************/
function showMenu(){
  stopTimer();
  stopMoveAnim();
  menuView.classList.remove("hidden");
  gameView.classList.add("hidden");
}
function showGame(){
  menuView.classList.add("hidden");
  gameView.classList.remove("hidden");
  requestAnimationFrame(drawTrackOutline);
}

function hardReset(){
  stopTimer();
  stopMoveAnim();

  lastRoll = null; currentWord = null; currentCat = null;
  previewPos = null; pendingOutcome = null; cardOpen = false;

  teams.forEach(t=>{ t.committedPos = 0; t.displayPos = 0; });
  turnIndex = 0;

  buildBoard();
  renderPieces();
  turnTeamEl.textContent = `${currentTeam().glyph} ${currentTeam().name}`;
  setAssistant(STEP.ROLL, "Würfeln, um zu starten.");
  toast("Reset");
}

/***********************
 * 12) EVENTS (iPad-friendly: click + pointerup)
 ***********************/
function bindTap(el, fn){
  if(!el) return;
  el.addEventListener("click", fn, {passive:true});
  el.addEventListener("pointerup", (e)=>{ e.preventDefault(); fn(e); }, {passive:false});
}

teamCountSel.addEventListener("change", rebuildTeamInputs);
boardLenSel.addEventListener("change", ()=>{
  boardLength = Number(boardLenSel.value);
  buildBoard();
  teams.forEach(t=>{
    t.committedPos = clamp(t.committedPos, 0, boardLength-1);
    t.displayPos = clamp(t.displayPos, 0, boardLength-1);
  });
  renderPieces();
});

bindTap(demoFillBtn, ()=>{
  const names = ["Team A","Team B","Team C","Team D"];
  const textInputs = teamInputs.querySelectorAll("input[type='text']");
  const colorInputs= teamInputs.querySelectorAll("input[type='color']");
  const iconSelects= teamInputs.querySelectorAll("select.iconPick");

  textInputs.forEach((inp,i)=>inp.value = names[i] || inp.value);
  const demoColors = ["#60a5fa","#a78bfa","#34d399","#f59e0b"];
  colorInputs.forEach((c,i)=>c.value = demoColors[i] || c.value);

  const demoIcons = ["gear","wrench","bolt","spark"];
  iconSelects.forEach((s,i)=>{ s.value = demoIcons[i] || s.value; s.dispatchEvent(new Event("change")); });

  toast("Demo gesetzt");
});

bindTap(startGameBtn, ()=>{
  boardLength = Number(boardLenSel.value);
  teams = readTeamsFromMenu();
  if(teams.length < 2){ toast("Mindestens 2 Teams"); return; }

  turnIndex = 0;
  teams.forEach(t=>{ t.committedPos = 0; t.displayPos = 0; });

  lastRoll = null; currentWord = null; currentCat = null;
  previewPos = null; pendingOutcome = null; cardOpen = false;

  buildBoard();
  renderPieces();
  turnTeamEl.textContent = `${currentTeam().glyph} ${currentTeam().name}`;
  setAssistant(STEP.ROLL, "Würfeln, um die Vorschau-Bewegung zu starten.");
  showGame();
  toast("Spiel gestartet");
});

bindTap(btnOpenMenu, showMenu);
bindTap(toMenuBtn, showMenu);
bindTap(hardResetBtn, hardReset);

bindTap(btnRoll, rollDice);
bindTap(btnReveal, openCard);

bindTap(btnNextTeam, ()=>{
  if(isMoving){ toast("Bewegung läuft…"); return; }
  if(cardOpen){ toast("Erst Karte schließen."); return; }

  const tm = currentTeam();
  if(tm && previewPos !== null && tm.displayPos !== tm.committedPos){
    pendingOutcome = "wrong";
    closeCardAndResolve();
    return;
  }
  nextTeam();
  toast("Nächstes Team");
});

bindTap(closeWord, ()=>{
  if(isMoving) return;
  if(!cardOpen) return;
  pendingOutcome = pendingOutcome || "wrong";
  closeCardAndResolve();
});

bindTap(btnSwap, swapWord);
bindTap(btnCorrect, ()=>answer(true));
bindTap(btnWrong, ()=>answer(false));

window.addEventListener("keydown", (e)=>{
  if(gameView.classList.contains("hidden")) return;
  if(e.key === "r") rollDice();
  if(e.key === " ") { e.preventDefault(); openCard(); }
  if(e.key === "ArrowRight") answer(true);
  if(e.key === "ArrowLeft") answer(false);
  if(e.key === "s") swapWord();
  if(e.key === "n") btnNextTeam.click();
});

/***********************
 * 13) INIT
 ***********************/
boardLength = Number(boardLenSel.value);
teams = [
  {id:0, name:"Team A", color:"#60a5fa", iconKey:"gear",   glyph:"⚙️", committedPos:0, displayPos:0},
  {id:1, name:"Team B", color:"#a78bfa", iconKey:"wrench", glyph:"🔧", committedPos:0, displayPos:0}
];

rebuildTeamInputs();
buildBoard();
renderPieces();
turnTeamEl.textContent = `${currentTeam().glyph} ${currentTeam().name}`;
setAssistant(STEP.ROLL, "Teams einstellen und Spiel starten.");