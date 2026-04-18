const STORAGE_KEY = "bachelorette-bets-v1";
const MAX_BETS = 3;
const PLAYER_COUNT = 4;
const PLAYER_NAMES = ["Malle", "Dulde", "Yas", "Thiller"];
const OVERVIEW = "overview";
const CAST = "cast";
const EVENT_BANK = "event-bank";
const SEASON_BETS = "season-bets";
const WEEKLY_RECAP = "weekly-recap";
const MY_STATS = "my-stats";

const EXPECTED_SEASON_LENGTH = 30;

const SEASON_BET_CATEGORIES = [
  { key: "mie-winner",             label: "Mies sidste rose",                 desc: "Hvem ender Mie med at v\u00E6lge?",                                                  points: 20, inputType: "contestant" },
  { key: "sofie-winner",           label: "Sofies sidste rose",               desc: "Hvem ender Sofie med at v\u00E6lge?",                                                points: 20, inputType: "contestant" },
  { key: "first-kiss",             label: "F\u00F8rste bejler til at kysse med en bachelorette", desc: "Navngiv den specifikke bejler.",                                  points: 12, inputType: "contestant" },
  { key: "episode-first-kiss",     label: "Hvilken episode sker f\u00F8rste kys?", desc: "V\u00E6lg episodenummer (1\u2013N). T\u00E6ttest p\u00E5 vinder.",             points: 12, inputType: "episode" },
  { key: "bachelorette-quits",     label: "Forlader \u00E9n af bachelorettes s\u00E6sonen f\u00F8r tid?", desc: "Usandsynligt men muligt. Ja/nej.",                              points: 20, inputType: "yesno" },
  { key: "first-bachelorette-cry", label: "F\u00F8rste bachelorette til at gr\u00E6de", desc: "V\u00E6lg Mie eller Sofie.",                                              points: 6,  inputType: "bachelorette" },
];

/* ── Firebase ── */
const firebaseConfig = {
  apiKey: "AIzaSyDQv_7VJRKX9Swt4s1apUgVxXljr8IAVTc",
  authDomain: "thfbattf.firebaseapp.com",
  databaseURL: "https://thfbattf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "thfbattf",
  storageBucket: "thfbattf.firebasestorage.app",
  messagingSenderId: "980680524951",
  appId: "1:980680524951:web:4aaa9eebf95ca872bc15d2",
  measurementId: "G-X9DCJBDYDL",
};
const fbApp = firebase.initializeApp(firebaseConfig);
const fbDb = firebase.database();
const fbRef = fbDb.ref("state");
let firebaseReady = false;
let suppressFirebaseWrite = false;

function builtInBetEvents() {
  return typeof MASTER_BET_EVENTS !== "undefined" && Array.isArray(MASTER_BET_EVENTS)
    ? MASTER_BET_EVENTS
    : [];
}

function betCategories() {
  return typeof BET_CATEGORIES !== "undefined" && Array.isArray(BET_CATEGORIES)
    ? BET_CATEGORIES
    : [];
}

function masterBetEvents() {
  const hidden = new Set(state.hiddenBankEvents || []);
  const overrides = state.bankOddsOverrides || {};
  const textOverrides = state.bankTextOverrides || {};
  const phaseOverrides = state.bankPhaseOverrides || {};
  const builtIn = builtInBetEvents()
    .filter((ev) => !hidden.has(ev.text))
    .map((ev) => {
      const o = { ...ev, _origText: ev.text };
      if (overrides[ev.text] != null) o.odds = overrides[ev.text];
      if (textOverrides[ev.text]) o.text = textOverrides[ev.text];
      if (phaseOverrides[ev.text]) o.phase = phaseOverrides[ev.text];
      return o;
    });
  const custom = (state.customBankEvents || []).map((ev) => ({ ...ev, _origText: null }));
  return [...builtIn, ...custom];
}

function categoryLabel(catId) {
  const cat = betCategories().find((c) => c.id === catId);
  return cat ? cat.label : "Other";
}

function groupByCategory(events) {
  const order = betCategories().map((c) => c.id);
  const groups = new Map();
  for (const cat of order) groups.set(cat, []);
  groups.set("_custom", []);
  for (const ev of events) {
    const key = ev.category && groups.has(ev.category) ? ev.category : "_custom";
    groups.get(key).push(ev);
  }
  return [...groups.entries()].filter(([, items]) => items.length > 0);
}

function allCast() {
  const seen = new Set(CAST_BA4_2026.map((c) => c.name.toLowerCase()));
  const extras = (state.customCast || []).filter((c) => !seen.has(c.name.toLowerCase()));
  return [...CAST_BA4_2026, ...extras];
}

function castPhotoByName(name) {
  const n = name.trim().toLowerCase();
  const match = allCast().find((c) => c.name.toLowerCase() === n);
  return match?.photo || null;
}

function ensureInCast(name, photo) {
  const n = name.trim().toLowerCase();
  if (CAST_BA4_2026.some((c) => c.name.toLowerCase() === n)) return;
  if (!Array.isArray(state.customCast)) state.customCast = [];
  if (state.customCast.some((c) => c.name.toLowerCase() === n)) return;
  state.customCast.push({ name: name.trim(), photo: photo || "", occupation: "" });
}

function photoFallback(img, name) {
  const swap = () => {
    if (img._swapped) return;
    img._swapped = true;
    const ini = name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const el = document.createElement("div");
    el.className = "photo-fallback";
    el.textContent = ini;
    if (img.parentNode) img.replaceWith(el);
  };
  img.onerror = swap;
  setTimeout(() => { if (!img.complete || !img.naturalWidth) swap(); }, 3000);
}

/** Bachelorette sæson 4 (2026), TV 2 — pressekit */
const CAST_BA4_2026 = [
  {
    name: "Adam",
    age: 23,
    occupation: "Studerende",
    photo:
      "https://omtv2.tv2.dk/media/xm4lf2rz/adam.jpg?center=0.41073328466538539,0.50163841616193161&mode=crop&quality=80&width=480&height=320&rnd=134193377557800000",
  },
  {
    name: "Anders",
    age: 27,
    occupation: "Cand. merc. Management Accounting and Control",
    photo:
      "https://omtv2.tv2.dk/media/bkkpx0wi/anders.jpg?center=0.40773980901000217,0.55452967155337163&mode=crop&quality=80&width=480&height=320&rnd=134193378750630000",
  },
  {
    name: "Carl-Emil",
    age: 27,
    occupation: "Gartner",
    photo:
      "https://omtv2.tv2.dk/media/5rfh2jpw/carl-emil.jpg?center=0.4302558904041911,0.59744123614829869&mode=crop&quality=80&width=480&height=320&rnd=134193487571770000",
  },
  {
    name: "Christian",
    age: 30,
    occupation: "Regissør",
    photo:
      "https://omtv2.tv2.dk/media/db0dxmdg/christian.jpg?center=0.40773980901000217,0.507548533670212&mode=crop&quality=80&width=480&height=320&rnd=134193379168370000",
  },
  {
    name: "Frederik Alexander",
    age: 24,
    occupation: "Personlig træner og gymnastiktræner",
    photo:
      "https://omtv2.tv2.dk/media/f21fjdga/frederik-alexander.jpg?center=0.43366064677147864,0.54480943612926958&mode=crop&quality=80&width=480&height=320&rnd=134193379526130000",
  },
  {
    name: "Frederik P",
    age: 29,
    occupation: "Studerende",
    photo:
      "https://omtv2.tv2.dk/media/ngylohyf/frederik-p.jpg?center=0.44518101910991259,0.47514774892320549&mode=crop&quality=80&width=480&height=320&rnd=134193379760370000",
  },
  {
    name: "Jacob",
    age: 32,
    occupation: "Senior Art Director",
    photo:
      "https://omtv2.tv2.dk/media/3rheorcn/jacob.jpg?center=0.43942083294069562,0.53346916146781731&mode=crop&quality=80&width=480&height=320&rnd=134193379888970000",
  },
  {
    name: "Jasper",
    age: 24,
    occupation: "Studerende og virksomhedsejer",
    photo:
      "https://omtv2.tv2.dk/media/2byh3noh/jasper.jpg?center=0.4681583120773789,0.57284127255624484&mode=crop&quality=80&width=480&height=320&rnd=134193380081800000",
  },
  {
    name: "Laurids",
    age: 26,
    occupation: "Lærerstuderende",
    photo:
      "https://omtv2.tv2.dk/media/303btcsh/laurids.jpg?center=0.43654073985608716,0.63229155494618738&mode=crop&quality=80&width=480&height=320&rnd=134193380259470000",
  },
  {
    name: "Lauritz",
    age: 26,
    occupation: "Marketingrådgiver",
    photo:
      "https://omtv2.tv2.dk/media/xopnplsr/lauritz.jpg?center=0.46246157761756357,0.50916857290756234&mode=crop&quality=80&width=480&height=320&rnd=134193380437800000",
  },
  {
    name: "Michael",
    age: 31,
    occupation: "Renovationsmedarbejder",
    photo:
      "https://omtv2.tv2.dk/media/iwqp1hhz/michael.jpg?center=0.45382129836373808,0.52536896528106569&mode=crop&quality=80&width=480&height=320&rnd=134193380667100000",
  },
  {
    name: "Oliver",
    age: 28,
    occupation: "Senior IT Architect og lektor på CBS",
    photo:
      "https://omtv2.tv2.dk/media/hm3c5kqq/oliver.jpg?center=0.43654073985608716,0.48486798434730743&mode=crop&quality=80&width=480&height=320&rnd=134193380879230000",
  },
  {
    name: "Sigurd",
    age: 24,
    occupation: "Studerende",
    photo:
      "https://omtv2.tv2.dk/media/kjehdgxn/sigurd.jpg?center=0.43366064677147864,0.51564872985696364&mode=crop&quality=80&width=480&height=320&rnd=134193381081500000",
  },
  {
    name: "Simon",
    age: 26,
    occupation: "Værkfører",
    photo:
      "https://omtv2.tv2.dk/media/vu0ngpvr/simon.jpg?center=0.38652232693512817,0.515441357508119&mode=crop&quality=80&width=480&height=320&rnd=134193383872530000",
  },
  {
    name: "Søren",
    age: 32,
    occupation: "Lærer",
    photo:
      "https://omtv2.tv2.dk/media/wqclkq13/soeren.jpg?center=0.45382129836373808,0.502688415958161&mode=crop&quality=80&width=480&height=320&rnd=134193384054030000",
  },
  {
    name: "Theis",
    age: 26,
    occupation: "Universitetsstuderende",
    photo:
      "https://omtv2.tv2.dk/media/1p5jk4gf/theis.jpg?center=0.42150917771037849,0.44492146187756459&mode=crop&quality=80&width=480&height=320&rnd=134193384191570000",
  },
];

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function episodeTabLabel(index) {
  return `Episode ${index + 1}`;
}

function deleteActiveEpisode() {
  const ep = activeEpisode();
  if (!ep) return;
  const idx = state.episodes.findIndex((e) => e.id === ep.id);
  const label = episodeTabLabel(idx);
  if (
    !confirm(
      `Delete ${label}? All bets and marked results for this episode will be removed. This cannot be undone.`
    )
  )
    return;
  const id = ep.id;
  state.episodes = state.episodes.filter((e) => e.id !== id);
  delete state.bets[id];
  delete state.occurred[id];
  delete state.eliminationBets[id];
  if (state.episodes.length === 0) {
    state.activeTab = OVERVIEW;
  } else {
    const nextIdx = Math.min(idx, state.episodes.length - 1);
    state.activeTab = state.episodes[nextIdx].id;
  }
  saveState();
  renderMainTabs();
  updateViewVisibility();
  if (activeEpisode()) renderEpisodeContent();
  renderLeaderboard();
  renderEventBank();
}

function defaultEpisodes() {
  return [
    {
      id: "ep1",
      title: "Episode 1",
      guys: CAST_BA4_2026.map((c) => ({ id: uid(), name: c.name })),
      events: [
        { id: uid(), text: "Someone says “journey” unironically", odds: 1.8 },
        { id: uid(), text: "Two people kiss", odds: 2.4 },
        { id: uid(), text: "A limo exit stunt / costume bit", odds: 3.2 },
        { id: uid(), text: "Zodiac signs come up in conversation", odds: 4.5 },
        { id: uid(), text: "Someone cries in a confessional", odds: 2.0 },
      ],
    },
    {
      id: "ep2",
      title: "Episode 2",
      guys: [
        { id: uid(), name: "Alex" },
        { id: uid(), name: "Jordan" },
        { id: uid(), name: "Sam" },
      ],
      events: [
        { id: uid(), text: "Group date with a physical challenge", odds: 2.0 },
        { id: uid(), text: "One-on-one with a helicopter or plane", odds: 5.0 },
        { id: uid(), text: "Villain edit for someone at the cocktail party", odds: 2.8 },
        { id: uid(), text: "“Can I steal you for a sec?”", odds: 1.5 },
      ],
    },
    {
      id: "ep3",
      title: "Episode 3",
      guys: [
        { id: uid(), name: "Alex" },
        { id: uid(), name: "Jordan" },
      ],
      events: [
        { id: uid(), text: "Rose ceremony cliffhanger", odds: 3.5 },
        { id: uid(), text: "Surprise guest from a past season", odds: 6.0 },
      ],
    },
  ];
}

function defaultState() {
  const episodes = defaultEpisodes();
  return {
    activeTab: OVERVIEW,
    episodes,
    /** episodeId -> playerIndex -> eventId[] */
    bets: {},
    /** episodeId -> eventId[] (occurred) */
    occurred: {},
    /** episodeId -> playerIndex -> guyName (one elimination pick per player) */
    eliminationBets: {},
    /** User-added bank events [{text, odds, category}] */
    customBankEvents: [],
    /** Original text strings of built-in events the user deleted */
    hiddenBankEvents: [],
    /** { originalText: newOdds } — user-changed odds for built-in events */
    bankOddsOverrides: {},
    /** { originalText: newText } — user-renamed built-in events */
    bankTextOverrides: {},
    /** { originalText: newPhase } — user-changed phase for built-in events */
    bankPhaseOverrides: {},
    /** Season-long bets: playerIndex -> { categoryKey: contestantName } */
    seasonBets: {},
    /** Actual season results: { categoryKey: contestantName } */
    seasonResults: {},
    /** Whether season bets are locked (no more changes) */
    seasonBetsLocked: false,
    /** { contestantName: { text, lastEditedBy } } */
    contestantNotes: {},
    /** User-added contestants [{ name, photo?, age?, occupation? }] */
    customCast: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed.episodes?.length) return defaultState();
    const episodes = parsed.episodes;
    let activeTab =
      parsed.activeTab ??
      (parsed.activeEpisodeId &&
      episodes.some((e) => e.id === parsed.activeEpisodeId)
        ? parsed.activeEpisodeId
        : OVERVIEW);
    const tabOk =
      activeTab === OVERVIEW ||
      activeTab === CAST ||
      activeTab === EVENT_BANK ||
      activeTab === SEASON_BETS ||
      activeTab === WEEKLY_RECAP ||
      activeTab === MY_STATS ||
      episodes.some((e) => e.id === activeTab);
    if (!tabOk) {
      activeTab = OVERVIEW;
    }
    const { activeEpisodeId: _legacy, playerNames: _oldNames, ...rest } = parsed;
    const result = { ...defaultState(), ...rest, episodes, activeTab };
    if (!result.bets || typeof result.bets !== "object") result.bets = {};
    if (!result.occurred || typeof result.occurred !== "object") result.occurred = {};
    if (!Array.isArray(result.customBankEvents)) result.customBankEvents = [];
    if (!Array.isArray(result.hiddenBankEvents)) result.hiddenBankEvents = [];
    if (!result.bankOddsOverrides || typeof result.bankOddsOverrides !== "object") result.bankOddsOverrides = {};
    if (!result.bankTextOverrides || typeof result.bankTextOverrides !== "object") result.bankTextOverrides = {};
    if (!result.bankPhaseOverrides || typeof result.bankPhaseOverrides !== "object") result.bankPhaseOverrides = {};
    if (!result.eliminationBets || typeof result.eliminationBets !== "object") result.eliminationBets = {};
    if (!result.seasonBets || typeof result.seasonBets !== "object") result.seasonBets = {};
    if (!result.seasonResults || typeof result.seasonResults !== "object") result.seasonResults = {};
    if (typeof result.seasonBetsLocked !== "boolean") result.seasonBetsLocked = false;
    if (!result.contestantNotes || typeof result.contestantNotes !== "object") result.contestantNotes = {};
    if (!Array.isArray(result.customCast)) result.customCast = [];
    for (const ep of result.episodes) {
      if (!Array.isArray(ep.events)) ep.events = [];
      if (!Array.isArray(ep.eliminated)) ep.eliminated = [];
      if (!Array.isArray(ep.guys)) ep.guys = [];
    }
    return result;
  } catch {
    return defaultState();
  }
}

let state = loadState();

function sharedState() {
  const { activeTab, ...shared } = state;
  return shared;
}

const CURRENT_PLAYER_KEY = "bachelorette-current-player";
let currentPlayer = localStorage.getItem(CURRENT_PLAYER_KEY) || "";
if (!PLAYER_NAMES.includes(currentPlayer)) currentPlayer = "";

function setCurrentPlayer(name) {
  currentPlayer = name;
  localStorage.setItem(CURRENT_PLAYER_KEY, name);
}

const noteEditHistory = {};

const noteSaveTimers = {};
function saveNoteDebounced(contestantName, text, delay) {
  clearTimeout(noteSaveTimers[contestantName]);
  noteSaveTimers[contestantName] = setTimeout(() => {
    const trimmed = text.trim();
    if (!trimmed) {
      delete state.contestantNotes[contestantName];
    } else {
      if (!noteEditHistory[contestantName]) noteEditHistory[contestantName] = [];
      const prev = state.contestantNotes[contestantName]?.text;
      if (prev && prev !== trimmed) {
        noteEditHistory[contestantName].unshift(prev);
        if (noteEditHistory[contestantName].length > 3) noteEditHistory[contestantName].length = 3;
      }
      state.contestantNotes[contestantName] = {
        text: trimmed.slice(0, 1000),
        lastEditedBy: currentPlayer || "?",
      };
    }
    saveState();
    const indicator = document.querySelector(`.cast-note[data-name="${CSS.escape(contestantName)}"] .cast-note__saving`);
    if (indicator) {
      indicator.textContent = "gemt \u2713";
      indicator.classList.add("cast-note__saving--visible");
      setTimeout(() => indicator.classList.remove("cast-note__saving--visible"), 1200);
    }
  }, delay);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!suppressFirebaseWrite) {
    fbRef.set(sharedState()).catch(() => {});
  }
}

function getEpisode(id) {
  return state.episodes.find((e) => e.id === id);
}

function normalizeActiveTab() {
  if (state.activeTab === OVERVIEW || state.activeTab === CAST || state.activeTab === EVENT_BANK || state.activeTab === SEASON_BETS || state.activeTab === WEEKLY_RECAP || state.activeTab === MY_STATS) return;
  if (!getEpisode(state.activeTab)) {
    state.activeTab = state.episodes[0]?.id ?? OVERVIEW;
    saveState();
  }
}

function activeEpisode() {
  if (state.activeTab === OVERVIEW || state.activeTab === CAST || state.activeTab === EVENT_BANK || state.activeTab === WEEKLY_RECAP || state.activeTab === MY_STATS) return null;
  return getEpisode(state.activeTab);
}

function isEpisodeClosed(ep) {
  return ep?.closed === true;
}

function isEpisodeBetsLocked(ep) {
  return ep?.betsLocked === true || isEpisodeClosed(ep);
}

function getNextAirDate(from) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  for (let i = 1; i <= 7; i++) {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    const dow = next.getDay();
    if (dow === 2 || dow === 3 || dow === 4) {
      return next.toISOString().slice(0, 10);
    }
  }
  return d.toISOString().slice(0, 10);
}

function suggestNextAirDate() {
  const lastEp = [...state.episodes].reverse().find((ep) => ep.airDate);
  if (lastEp) return getNextAirDate(new Date(lastEp.airDate + "T12:00:00"));
  return getNextAirDate(new Date());
}

function copenhagenMidnight(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  const prevDay = new Date(y, m - 1, d - 1);
  const py = prevDay.getFullYear(), pm = prevDay.getMonth() + 1, pd = prevDay.getDate();
  const guess = new Date(Date.UTC(py, pm - 1, pd, 22, 0, 0));
  for (let offsetH = -2; offsetH <= 2; offsetH++) {
    const ts = guess.getTime() - offsetH * 3600000;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Copenhagen",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    }).formatToParts(new Date(ts));
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    if (get("day") === pd && get("month") === pm && get("hour") === 23 && get("minute") === 0) {
      return ts + 59 * 60000;
    }
  }
  return new Date(Date.UTC(py, pm - 1, pd, 21, 59, 0)).getTime();
}

function formatCountdown(deadlineMs) {
  const diff = deadlineMs - Date.now();
  if (diff <= 0) return "nu";
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} time${hr > 1 ? "r" : ""}`;
  const days = Math.floor(hr / 24);
  return `${days} dag${days > 1 ? "e" : ""}`;
}

function formatDeadlineTime(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(new Date(ms));
}

function toLocalDatetimeString(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isEliminationEpisode(ep) {
  if (!ep) return true;
  if (typeof ep.hasElimination === "boolean") return ep.hasElimination;
  if (!ep.airDate) return true;
  const [y, m, d] = ep.airDate.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 4;
}

/* ── Weekly recap helpers ── */
const DANISH_MONTHS = ["januar","februar","marts","april","maj","juni","juli","august","september","oktober","november","december"];
const DANISH_DAYS = { 0: "s\u00F8n.", 1: "man.", 2: "tir.", 3: "ons.", 4: "tor.", 5: "fre.", 6: "l\u00F8r." };
const DANISH_DAYS_LONG = { 2: "tirsdag", 3: "onsdag", 4: "torsdag" };

function getISOWeekNumber(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - dayOfWeek);
  const yearStart = new Date(date.getFullYear(), 0, 1);
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function getWeekId(dateStr) {
  if (!dateStr) return null;
  const [y] = dateStr.split("-").map(Number);
  const wn = getISOWeekNumber(dateStr);
  return `${y}-${String(wn).padStart(2, "0")}`;
}

function getDayOfWeek(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function getDayOfWeekDanish(dateStr) {
  const dow = getDayOfWeek(dateStr);
  return DANISH_DAYS_LONG[dow] || DANISH_DAYS[dow] || "";
}

function formatDanishDate(dateStr) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d}. ${DANISH_MONTHS[m - 1]}`;
}

function formatDanishDateRange(startStr, endStr) {
  if (!startStr || !endStr) return formatDanishDate(startStr || endStr);
  const [, sm, sd] = startStr.split("-").map(Number);
  const [, em, ed] = endStr.split("-").map(Number);
  if (sm === em) return `${sd}.\u2013${ed}. ${DANISH_MONTHS[sm - 1]}`;
  return `${sd}. ${DANISH_MONTHS[sm - 1]} \u2013 ${ed}. ${DANISH_MONTHS[em - 1]}`;
}

function formatDanishNumber(n) {
  return n.toLocaleString("da-DK", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function getEpisodesForWeek(weekId) {
  return state.episodes
    .filter((ep) => ep.airDate && getWeekId(ep.airDate) === weekId)
    .sort((a, b) => a.airDate.localeCompare(b.airDate));
}

function isWeekComplete(weekId) {
  const eps = getEpisodesForWeek(weekId);
  return eps.length > 0 && eps.every((ep) => isEpisodeClosed(ep));
}

function getCeremonyEpisodeForWeek(weekId) {
  return getEpisodesForWeek(weekId).find((ep) => isEliminationEpisode(ep)) || null;
}

function getAllWeekIds() {
  const ids = new Set();
  for (const ep of state.episodes) {
    const wid = getWeekId(ep.airDate);
    if (wid) ids.add(wid);
  }
  return [...ids].sort().reverse();
}

function computeWeeklyRecap(weekId) {
  const eps = getEpisodesForWeek(weekId);
  if (!eps.length) return null;
  const airDates = eps.map((e) => e.airDate).filter(Boolean);
  const dateRange = formatDanishDateRange(airDates[0], airDates[airDates.length - 1]);
  const allSorted = getAllWeekIds().slice().sort();
  const weekNum = allSorted.indexOf(weekId) + 1;

  const streaks = getStreaks();

  const weeklyPoints = PLAYER_NAMES.map(() => 0);
  const perEpisode = [];
  let biggestPayout = null;
  let biggestWhiff = null;
  const eventBetCounts = new Map();

  for (const ep of eps) {
    ensureEpisodeMaps(ep.id);
    if (!Array.isArray(ep.events)) ep.events = [];
    const occurred = new Set(state.occurred[ep.id] || []);
    const elimSet = new Set(ep.eliminated || []);
    const elimOdd = eliminationOdds(ep);
    const epPts = episodePoints(ep);
    const dayName = getDayOfWeekDanish(ep.airDate);
    const hasElim = isEliminationEpisode(ep);

    let epWinnerIdx = 0;
    let epWinnerPts = epPts[0];
    for (let p = 0; p < PLAYER_COUNT; p++) {
      weeklyPoints[p] += epPts[p];
      if (epPts[p] > epWinnerPts) { epWinnerPts = epPts[p]; epWinnerIdx = p; }
    }

    let epMoment = null;
    for (let p = 0; p < PLAYER_COUNT; p++) {
      const picks = (state.bets[ep.id][p] || []).filter(Boolean);
      for (const evId of picks) {
        const ev = ep.events.find((e) => e.id === evId);
        if (!ev) continue;
        const odds = Number(ev.odds) || 0;
        const evKey = ev.text.trim();
        eventBetCounts.set(evKey, (eventBetCounts.get(evKey) || { count: 0, hit: occurred.has(evId), text: evKey }) );
        eventBetCounts.get(evKey).count++;
        if (occurred.has(evId)) {
          eventBetCounts.get(evKey).hit = true;
          if (!biggestPayout || odds > biggestPayout.odds) {
            biggestPayout = { player: PLAYER_NAMES[p], text: evKey, odds, day: dayName };
          }
          if (!epMoment || odds > epMoment.odds) {
            epMoment = { type: "win", player: PLAYER_NAMES[p], text: evKey, odds };
          }
        } else {
          if (!biggestWhiff || odds > biggestWhiff.odds) {
            biggestWhiff = { player: PLAYER_NAMES[p], text: evKey, odds, day: dayName };
          }
        }
      }
    }

    perEpisode.push({
      id: ep.id,
      title: ep.title || episodeTabLabel(state.episodes.indexOf(ep)),
      airDate: ep.airDate,
      dayOfWeek: dayName,
      winner: PLAYER_NAMES[epWinnerIdx],
      winnerPts: epWinnerPts,
      isCeremony: hasElim,
      eliminated: hasElim ? [...elimSet] : [],
      moment: epMoment,
    });
  }

  const streakBonus = PLAYER_NAMES.map((_, i) => {
    let bonus = 0;
    for (const ep of eps) {
      const bd = streaks[i]?.episodeBreakdown?.find((b) => b.episodeId === ep.id);
      if (bd?.bonus > 0) bonus += bd.bonus;
    }
    return bonus;
  });
  for (let p = 0; p < PLAYER_COUNT; p++) weeklyPoints[p] += streakBonus[p];

  const scoreboard = PLAYER_NAMES.map((_, i) => {
    let bestEpDay = "";
    let bestEpPts = -1;
    for (const epInfo of perEpisode) {
      const ep = eps.find((e) => e.id === epInfo.id);
      const pts = episodePoints(ep);
      if (pts[i] > bestEpPts) { bestEpPts = pts[i]; bestEpDay = epInfo.dayOfWeek; }
    }
    return { playerIndex: i, weekPoints: weeklyPoints[i], bestEpisodeDay: bestEpDay, bestEpisodePts: bestEpPts };
  }).sort((a, b) => b.weekPoints - a.weekPoints);
  scoreboard.forEach((s, idx) => { s.rank = idx + 1; });

  const ceremonyEp = getCeremonyEpisodeForWeek(weekId);
  const eliminations = [];
  let eliminationCallText = null;
  if (ceremonyEp) {
    ensureEpisodeMaps(ceremonyEp.id);
    ensureEliminatedArray(ceremonyEp);
    const elimSet = new Set(ceremonyEp.eliminated || []);
    if (elimSet.size === 0) {
      eliminationCallText = "Ingen elimineringer denne uge";
    } else {
      const callers = [];
      for (const name of elimSet) {
        const calledBy = [];
        for (let p = 0; p < PLAYER_COUNT; p++) {
          if (state.eliminationBets[ceremonyEp.id]?.[p] === name) calledBy.push(p);
        }
        eliminations.push({ contestantName: name, photoUrl: castPhotoByName(name), calledBy });
        callers.push(...calledBy);
      }
      const uniqueCallers = [...new Set(callers)];
      if (uniqueCallers.length === 0) {
        const names = [...elimSet].join(" og ");
        eliminationCallText = `En uge med overraskelser \u2014 ingen s\u00E5 det komme`;
      } else if (uniqueCallers.length === 1) {
        eliminationCallText = `\uD83C\uDFAF Kun ${PLAYER_NAMES[uniqueCallers[0]]} ramte plet`;
      }
    }
  }

  const hotStreak = streaks.reduce((best, s, i) => {
    const cur = s?.currentStreak || 0;
    return cur > (best?.count || 0) ? { player: PLAYER_NAMES[i], count: cur } : best;
  }, null);

  const mostPlayed = [...eventBetCounts.values()].sort((a, b) => b.count - a.count)[0] || null;

  const totalSeason = totalPointsAllEpisodes();
  const sPts = seasonBetPoints();
  const seasonTotals = totalSeason.map((v, i) => v + sPts[i] + (streaks[i]?.bonusPointsEarned || 0));
  const prevWeekIds = getAllWeekIds().filter((w) => w < weekId);
  let prevRanks = null;
  if (prevWeekIds.length) {
    const prevTotals = PLAYER_NAMES.map(() => 0);
    for (const ep of state.episodes) {
      const wid = getWeekId(ep.airDate);
      if (!wid || wid > prevWeekIds[0]) continue;
      const pts = episodePoints(ep);
      pts.forEach((v, i) => { prevTotals[i] += v; });
    }
    const prevSorted = prevTotals.map((v, i) => ({ i, pts: v + sPts[i] + (streaks[i]?.bonusPointsEarned || 0) - weeklyPoints[i] }))
      .sort((a, b) => b.pts - a.pts);
    prevRanks = PLAYER_NAMES.map((_, i) => prevSorted.findIndex((s) => s.i === i) + 1);
  }

  const seasonSorted = seasonTotals.map((pts, i) => ({ i, pts })).sort((a, b) => b.pts - a.pts);
  const firstPts = seasonSorted[0]?.pts || 0;
  const seasonStandings = seasonSorted.map((s, idx) => {
    const rank = idx + 1;
    let rankChange = null;
    if (prevRanks) {
      const diff = prevRanks[s.i] - rank;
      rankChange = diff > 0 ? `\u2191${diff}` : diff < 0 ? `\u2193${Math.abs(diff)}` : "\u2192";
    }
    return {
      playerIndex: s.i,
      totalPoints: s.pts,
      weekPointsGained: weeklyPoints[s.i],
      rank,
      rankChange,
      streakCount: streaks[s.i]?.currentStreak || 0,
      distanceToFirst: rank === 1 ? 0 : firstPts - s.pts,
    };
  });

  const runningGuys = getRunningGuyNames();

  const nextWeekDates = [];
  const lastAirDate = airDates[airDates.length - 1];
  if (lastAirDate) {
    let cursor = new Date(lastAirDate + "T12:00:00");
    for (let tries = 0; tries < 7 && nextWeekDates.length < 3; tries++) {
      cursor.setDate(cursor.getDate() + 1);
      const dow = cursor.getDay();
      if (dow >= 2 && dow <= 4) nextWeekDates.push(cursor.toISOString().slice(0, 10));
    }
  }

  return {
    weekId,
    weekNum,
    weekLabel: `Uge ${weekNum} \u00B7 ${dateRange}`,
    dateRange,
    episodes: perEpisode,
    scoreboard,
    highlights: {
      biggestPayout,
      biggestWhiff,
      eliminationCallText,
      hotStreak: hotStreak?.count >= 2 ? hotStreak : null,
      mostPlayedEvent: mostPlayed?.count >= 2 ? mostPlayed : null,
    },
    eliminations,
    seasonStandings,
    nextWeek: { airDates: nextWeekDates, contestantsRemaining: runningGuys.length },
  };
}

function shouldAutoLock(ep, now) {
  return ep.betsLockDeadline && !ep.betsLocked && !ep.closed && now >= ep.betsLockDeadline;
}

let toastTimer = null;
function showToast(msg) {
  let el = document.getElementById("app-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "app-toast";
    el.className = "app-toast";
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add("app-toast--visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("app-toast--visible"), 4000);
}

function ensureEpisodeMaps(epId) {
  if (!state.bets || typeof state.bets !== "object") state.bets = {};
  if (!state.occurred || typeof state.occurred !== "object") state.occurred = {};
  if (!state.eliminationBets || typeof state.eliminationBets !== "object") state.eliminationBets = {};
  if (!state.bets[epId]) state.bets[epId] = {};
  for (let i = 0; i < PLAYER_COUNT; i++) {
    if (!Array.isArray(state.bets[epId][i])) state.bets[epId][i] = [];
  }
  if (!Array.isArray(state.occurred[epId])) state.occurred[epId] = [];
  if (!state.eliminationBets[epId]) state.eliminationBets[epId] = {};
}

function ensureEliminatedArray(ep) {
  if (!Array.isArray(ep.eliminated)) ep.eliminated = [];
}

function eliminationOdds(ep) {
  const n = ep.guys?.length || 1;
  return Math.round(Math.max(1.5, n / 2) * 10) / 10;
}

const PHASE_MULTIPLIERS = {
  "early-heavy": { early: 0.7, mid: 1.2, late: 1.8 },
  "late-heavy":  { early: 1.8, mid: 1.2, late: 0.7 },
  "mid-peak":    { early: 1.3, mid: 0.8, late: 1.3 },
  "any":         { early: 1.0, mid: 1.0, late: 1.0 },
};

const PHASE_OPTIONS = ["any", "early-heavy", "mid-peak", "late-heavy"];

function getEpisodePhase(episodeIndex, totalEpisodes) {
  const horizon = Math.max(totalEpisodes, EXPECTED_SEASON_LENGTH);
  if (horizon <= 1) return "early";
  const progress = episodeIndex / (horizon - 1);
  if (progress < 0.33) return "early";
  if (progress < 0.67) return "mid";
  return "late";
}

function getPhaseMultiplier(eventPhase, episodePhase) {
  const table = PHASE_MULTIPLIERS[eventPhase || "any"] || PHASE_MULTIPLIERS["any"];
  return table[episodePhase] ?? 1.0;
}

function computePhaseAdjustedOdds(baseOdds, eventPhase, episodeIndex, totalEpisodes) {
  const epPhase = getEpisodePhase(episodeIndex, totalEpisodes);
  const mult = getPhaseMultiplier(eventPhase, epPhase);
  const raw = Math.round(baseOdds * mult * 10) / 10;
  return Math.min(25, Math.max(1.3, raw));
}

function episodePoints(ep) {
  ensureEpisodeMaps(ep.id);
  ensureEliminatedArray(ep);
  if (!Array.isArray(ep.events)) ep.events = [];
  if (!Array.isArray(ep.guys)) ep.guys = [];
  const occurred = new Set(state.occurred[ep.id]);
  const elimSet = new Set(ep.eliminated);
  const elimOdds = eliminationOdds(ep);
  const totals = PLAYER_NAMES.map(() => 0);
  for (let p = 0; p < PLAYER_COUNT; p++) {
    const picks = state.bets[ep.id][p] || [];
    for (const eventId of picks) {
      if (!occurred.has(eventId)) continue;
      const ev = ep.events.find((e) => e.id === eventId);
      if (ev) totals[p] += Number(ev.odds) || 0;
    }
    const elimPick = state.eliminationBets[ep.id]?.[p];
    if (elimPick && elimSet.has(elimPick)) {
      totals[p] += elimOdds;
    }
  }
  return totals;
}

function totalPointsAllEpisodes() {
  const totals = PLAYER_NAMES.map(() => 0);
  for (const ep of state.episodes) {
    const pts = episodePoints(ep);
    pts.forEach((v, i) => {
      totals[i] += v;
    });
  }
  return totals;
}

const STREAK_MILESTONES = [
  { at: 3, bonus: 2 },
  { at: 5, bonus: 5 },
  { at: 7, bonus: 10 },
  { at: 10, bonus: 20 },
];

function computePlayerStreaks() {
  const result = [];
  for (let p = 0; p < PLAYER_COUNT; p++) {
    let streak = 0;
    let longest = 0;
    let totalBonus = 0;
    const milestonesReached = [];
    const episodeBreakdown = [];
    const milestonesAwarded = new Set();

    for (const ep of state.episodes) {
      if (!isEpisodeClosed(ep)) {
        episodeBreakdown.push({ episodeId: ep.id, result: "open", streakAfter: streak });
        continue;
      }
      ensureEpisodeMaps(ep.id);
      const picks = (state.bets[ep.id][p] || []).filter(Boolean);
      if (picks.length === 0) {
        episodeBreakdown.push({ episodeId: ep.id, result: "skip", streakAfter: streak });
        continue;
      }
      const occurred = new Set(state.occurred[ep.id] || []);
      const hasHit = picks.some((id) => occurred.has(id));
      if (hasHit) {
        streak++;
        if (streak > longest) longest = streak;
        let epBonus = 0;
        for (const m of STREAK_MILESTONES) {
          if (streak >= m.at && !milestonesAwarded.has(m.at)) {
            milestonesAwarded.add(m.at);
            milestonesReached.push(m.at);
            epBonus += m.bonus;
            totalBonus += m.bonus;
          }
        }
        episodeBreakdown.push({ episodeId: ep.id, result: "hit", streakAfter: streak, bonus: epBonus });
      } else {
        streak = 0;
        milestonesAwarded.clear();
        episodeBreakdown.push({ episodeId: ep.id, result: "miss", streakAfter: 0 });
      }
    }
    result.push({
      currentStreak: streak,
      longestStreak: longest,
      bonusPointsEarned: totalBonus,
      milestonesReached,
      episodeBreakdown,
    });
  }
  return result;
}

let cachedStreaks = null;
let cachedStreaksKey = "";

function getStreaks() {
  const key = JSON.stringify(state.episodes.map((e) => e.id + ":" + (e.closed ? "c" : "o")))
    + JSON.stringify(state.bets) + JSON.stringify(state.occurred);
  if (cachedStreaksKey === key && cachedStreaks) return cachedStreaks;
  cachedStreaks = computePlayerStreaks();
  cachedStreaksKey = key;
  return cachedStreaks;
}

function updateViewVisibility() {
  const viewOverview = document.getElementById("view-overview");
  const viewCast = document.getElementById("view-cast");
  const viewEventBank = document.getElementById("view-event-bank");
  const viewSeasonBets = document.getElementById("view-season-bets");
  const viewWeeklyRecap = document.getElementById("view-weekly-recap");
  const viewMyStats = document.getElementById("view-my-stats");
  const episodeMain = document.getElementById("episode-workspace");
  const extras = document.getElementById("episode-extras");
  const onOverview = state.activeTab === OVERVIEW;
  const onCast = state.activeTab === CAST;
  const onEventBank = state.activeTab === EVENT_BANK;
  const onSeasonBets = state.activeTab === SEASON_BETS;
  const onWeeklyRecap = state.activeTab === WEEKLY_RECAP;
  const onMyStats = state.activeTab === MY_STATS;
  const onEpisode = !onOverview && !onCast && !onEventBank && !onSeasonBets && !onWeeklyRecap && !onMyStats;
  if (viewOverview) viewOverview.hidden = !onOverview;
  if (viewCast) viewCast.hidden = !onCast;
  if (viewEventBank) viewEventBank.hidden = !onEventBank;
  if (viewSeasonBets) viewSeasonBets.hidden = !onSeasonBets;
  if (viewWeeklyRecap) viewWeeklyRecap.hidden = !onWeeklyRecap;
  if (viewMyStats) viewMyStats.hidden = !onMyStats;
  if (episodeMain) {
    episodeMain.hidden = !onEpisode;
    if (onEpisode) {
      const ep = activeEpisode();
      episodeMain.classList.toggle("episode--closed", ep ? isEpisodeClosed(ep) : false);
    }
  }
  if (extras) extras.hidden = !onEpisode;
  const closeBtn = document.getElementById("close-episode");
  const reopenBtn = document.getElementById("reopen-episode");
  const lockBetsBtn = document.getElementById("lock-bets");
  const unlockBetsBtn = document.getElementById("unlock-bets");
  if (onEpisode) {
    const ep = activeEpisode();
    const closed = ep ? isEpisodeClosed(ep) : false;
    const betsLocked = ep ? ep.betsLocked === true : false;
    if (closeBtn) closeBtn.hidden = closed;
    if (reopenBtn) reopenBtn.hidden = !closed;
    if (lockBetsBtn) lockBetsBtn.hidden = closed || betsLocked;
    if (unlockBetsBtn) unlockBetsBtn.hidden = closed || !betsLocked;
  } else {
    if (closeBtn) closeBtn.hidden = true;
    if (reopenBtn) reopenBtn.hidden = true;
    if (lockBetsBtn) lockBetsBtn.hidden = true;
    if (unlockBetsBtn) unlockBetsBtn.hidden = true;
  }
}

function renderOverview() {
  const root = document.getElementById("cast-grid");
  if (!root) return;
  if (activeNoteEditor) return;
  root.innerHTML = "";
  allCast().forEach((c) => {
    const card = document.createElement("article");
    card.className = "cast-card";
    const fig = document.createElement("div");
    fig.className = "cast-card__photo-wrap";
    if (c.photo) {
      const img = document.createElement("img");
      img.className = "cast-card__photo";
      img.src = c.photo;
      img.alt = `Portr\u00E6tfoto \u2014 ${c.name}`;
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 480;
      img.height = 320;
      photoFallback(img, c.name);
      fig.append(img);
    } else {
      const fb = document.createElement("div");
      fb.className = "photo-fallback";
      fb.textContent = c.name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
      fig.append(fb);
    }
    const editPhoto = document.createElement("button");
    editPhoto.type = "button";
    editPhoto.className = "cast-card__edit-photo";
    editPhoto.textContent = c.photo ? "\uD83D\uDCF7" : "+ foto";
    editPhoto.addEventListener("click", () => {
      const url = prompt(`Photo URL for ${c.name}:`, c.photo || "");
      if (url === null) return;
      const trimmed = url.trim();
      const n = c.name.toLowerCase();
      const builtIn = CAST_BA4_2026.find((b) => b.name.toLowerCase() === n);
      if (builtIn) {
        if (!Array.isArray(state.customCast)) state.customCast = [];
        const existing = state.customCast.find((x) => x.name.toLowerCase() === n);
        if (existing) {
          existing.photo = trimmed;
        } else {
          state.customCast.push({ name: builtIn.name, photo: trimmed, age: builtIn.age, occupation: builtIn.occupation });
        }
        builtIn.photo = trimmed;
      } else {
        const custom = (state.customCast || []).find((x) => x.name.toLowerCase() === n);
        if (custom) custom.photo = trimmed;
      }
      saveState();
      renderOverview();
    });
    fig.append(editPhoto);
    const body = document.createElement("div");
    body.className = "cast-card__body";
    const h = document.createElement("h3");
    h.className = "cast-card__name";
    h.textContent = c.name;
    const meta = document.createElement("p");
    meta.className = "cast-card__meta";
    meta.textContent = c.age ? `${c.age} \u00E5r` : "";
    const job = document.createElement("p");
    job.className = "cast-card__job";
    job.textContent = c.occupation;
    body.append(h, meta, job);

    const noteData = state.contestantNotes[c.name];
    const noteWrap = document.createElement("div");
    noteWrap.className = "cast-note";
    noteWrap.dataset.name = c.name;

    const saving = document.createElement("span");
    saving.className = "cast-note__saving";

    if (!noteData?.text) {
      const addLink = document.createElement("button");
      addLink.type = "button";
      addLink.className = "cast-note__add";
      addLink.textContent = "+ noter\u2026";
      addLink.addEventListener("click", () => expandNote(noteWrap, c.name));
      noteWrap.append(addLink, saving);
    } else {
      const preview = document.createElement("div");
      preview.className = "cast-note__preview";
      const previewText = document.createElement("span");
      previewText.className = "cast-note__preview-text";
      previewText.textContent = noteData.text.length > 80 ? noteData.text.slice(0, 80) + "\u2026" : noteData.text;
      preview.append(previewText);
      if (noteData.lastEditedBy) {
        const metaLine = document.createElement("span");
        metaLine.className = "cast-note__meta";
        metaLine.textContent = noteData.lastEditedBy;
        preview.append(metaLine);
      }
      preview.addEventListener("click", () => expandNote(noteWrap, c.name));
      noteWrap.append(preview, saving);
    }
    body.append(noteWrap);

    const isCustom = !CAST_BA4_2026.some((b) => b.name.toLowerCase() === c.name.toLowerCase());
    if (isCustom) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "cast-card__delete";
      del.setAttribute("aria-label", `Remove ${c.name}`);
      del.textContent = "\u00D7";
      del.addEventListener("click", () => {
        if (!confirm(`Remove ${c.name} from the cast?`)) return;
        state.customCast = (state.customCast || []).filter(
          (x) => x.name.toLowerCase() !== c.name.toLowerCase()
        );
        saveState();
        renderOverview();
      });
      card.append(del);
    }

    card.append(fig, body);
    root.append(card);
  });
}

let activeNoteEditor = null;

function expandNote(noteWrap, contestantName, playerConfirmed) {
  if (!playerConfirmed) {
    promptPlayerPicker(() => expandNote(noteWrap, contestantName, true));
    return;
  }
  if (noteWrap.querySelector(".cast-note__editor")) return;

  const noteData = state.contestantNotes[contestantName];
  noteWrap.innerHTML = "";
  activeNoteEditor = contestantName;

  const editor = document.createElement("div");
  editor.className = "cast-note__editor";

  const playerBar = document.createElement("div");
  playerBar.className = "cast-note__player-bar";
  const playerLabel = document.createElement("span");
  playerLabel.className = "cast-note__player-label";
  playerLabel.textContent = `Skriver som: ${currentPlayer}`;
  const changeBtn = document.createElement("button");
  changeBtn.type = "button";
  changeBtn.className = "cast-note__change-player";
  changeBtn.textContent = "skift";
  changeBtn.addEventListener("click", () => {
    promptPlayerPicker(() => {
      playerLabel.textContent = `Skriver som: ${currentPlayer}`;
    });
  });
  playerBar.append(playerLabel, changeBtn);

  const ta = document.createElement("textarea");
  ta.className = "cast-note__textarea";
  ta.placeholder = "Skriv noter om denne bejler\u2026";
  ta.maxLength = 1000;
  ta.value = noteData?.text || "";
  ta.rows = 3;
  autoResizeTextarea(ta);

  const counter = document.createElement("span");
  counter.className = "cast-note__counter";
  const updateCounter = () => {
    const len = ta.value.length;
    counter.textContent = len > 400 ? `${len}/1000` : "";
    counter.classList.toggle("cast-note__counter--warn", len > 900);
  };
  updateCounter();

  const saving = document.createElement("span");
  saving.className = "cast-note__saving";

  ta.addEventListener("input", () => {
    autoResizeTextarea(ta);
    updateCounter();
    saving.textContent = "gemmer\u2026";
    saving.classList.add("cast-note__saving--visible");
    saveNoteDebounced(contestantName, ta.value, 2000);
  });

  ta.addEventListener("blur", (e) => {
    if (e.relatedTarget && editor.contains(e.relatedTarget)) return;
    if (document.querySelector(".player-picker-modal")) return;
    clearTimeout(noteSaveTimers[contestantName]);
    const trimmed = ta.value.trim();
    if (!trimmed) {
      delete state.contestantNotes[contestantName];
    } else {
      const prev = state.contestantNotes[contestantName]?.text;
      if (!noteEditHistory[contestantName]) noteEditHistory[contestantName] = [];
      if (prev && prev !== trimmed) {
        noteEditHistory[contestantName].unshift(prev);
        if (noteEditHistory[contestantName].length > 3) noteEditHistory[contestantName].length = 3;
      }
      state.contestantNotes[contestantName] = {
        text: trimmed.slice(0, 1000),
        lastEditedBy: currentPlayer || "?",
      };
    }
    activeNoteEditor = null;
    saveState();
    setTimeout(() => renderOverview(), 100);
  });

  editor.append(playerBar, ta, counter, saving);

  const history = noteEditHistory[contestantName];
  if (history?.length) {
    const histBlock = document.createElement("div");
    histBlock.className = "cast-note__history";
    for (const old of history) {
      const line = document.createElement("p");
      line.className = "cast-note__history-line";
      line.textContent = old.length > 60 ? old.slice(0, 60) + "\u2026" : old;
      histBlock.append(line);
    }
    editor.append(histBlock);
  }

  noteWrap.append(editor);
  ta.focus();
}

function autoResizeTextarea(ta) {
  ta.style.height = "auto";
  ta.style.height = Math.min(200, Math.max(60, ta.scrollHeight)) + "px";
}

function promptPlayerPicker(callback) {
  const existing = document.querySelector(".player-picker-modal");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.className = "player-picker-modal";
  const box = document.createElement("div");
  box.className = "player-picker-modal__box";
  const title = document.createElement("p");
  title.className = "player-picker-modal__title";
  title.textContent = "Hvem er du?";
  box.append(title);
  for (const name of PLAYER_NAMES) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--secondary player-picker-modal__btn"
      + (name === currentPlayer ? " player-picker-modal__btn--active" : "");
    btn.textContent = name;
    btn.addEventListener("click", () => {
      setCurrentPlayer(name);
      overlay.remove();
      if (callback) callback();
    });
    box.append(btn);
  }
  overlay.append(box);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.append(overlay);
}


function populateMasterEventDatalist() {
  const dl = document.getElementById("master-event-suggestions");
  if (!dl) return;
  dl.innerHTML = "";
  masterBetEvents().forEach(({ text }) => {
    const opt = document.createElement("option");
    opt.value = text;
    dl.append(opt);
  });
}

function bankFilterQuery() {
  const el = document.getElementById("bank-event-search");
  return (el?.value ?? "").trim().toLowerCase();
}


function addMasterEventToEpisode(epId, text, odds, eventPhase) {
  const ep = getEpisode(epId);
  if (!ep) return false;
  if (!Array.isArray(ep.events)) ep.events = [];
  const t = text.trim();
  if (ep.events.some((e) => e.text.trim() === t)) {
    alert("That episode already has this event.");
    return false;
  }
  const epIdx = state.episodes.indexOf(ep);
  const total = state.episodes.length;
  const phase = eventPhase || "any";
  const baseOdds = Number(odds) || 2;
  const adjusted = phase === "any" ? baseOdds : computePhaseAdjustedOdds(baseOdds, phase, epIdx, total);
  ep.events.push({ id: uid(), text: t, odds: adjusted });
  saveState();
  if (state.activeTab === ep.id) {
    renderEvents();
    renderBets();
    renderResults();
    renderEpisodeScoreSummary();
  }
  renderLeaderboard();
  return true;
}

function bankCategoryFilter() {
  const el = document.getElementById("bank-category-filter");
  return (el?.value ?? "");
}

function showPhaseDropdown(badgeEl, currentPhase, isCustom, text, _origText) {
  const existing = document.querySelector(".phase-dropdown");
  if (existing) existing.remove();
  const dd = document.createElement("div");
  dd.className = "phase-dropdown";
  for (const opt of PHASE_OPTIONS) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "phase-dropdown__item" + (opt === currentPhase ? " phase-dropdown__item--active" : "");
    item.textContent = opt === "any" ? "any" : opt.replace("-heavy", "").replace("-peak", "");
    item.addEventListener("click", () => {
      if (isCustom) {
        const entry = state.customBankEvents.find((e) => e.text === text);
        if (entry) entry.phase = opt;
      } else if (_origText) {
        if (opt === (builtInBetEvents().find((e) => e.text === _origText)?.phase || "any")) {
          delete state.bankPhaseOverrides[_origText];
        } else {
          state.bankPhaseOverrides[_origText] = opt;
        }
      }
      saveState();
      dd.remove();
      renderEventBank();
    });
    dd.append(item);
  }
  badgeEl.style.position = "relative";
  badgeEl.append(dd);
  const dismiss = (e) => { if (!dd.contains(e.target) && e.target !== badgeEl) { dd.remove(); document.removeEventListener("click", dismiss, true); } };
  setTimeout(() => document.addEventListener("click", dismiss, true), 0);
}

function renderEventBank() {
  const list = document.getElementById("event-bank-list");
  const targetSel = document.getElementById("bank-target-episode");
  const catFilter = document.getElementById("bank-category-filter");
  if (!list || !targetSel) return;

  const prev = targetSel.value;
  targetSel.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent =
    state.episodes.length === 0 ? "— Add an episode first —" : "— Select episode —";
  targetSel.append(placeholder);
  state.episodes.forEach((ep, idx) => {
    const opt = document.createElement("option");
    opt.value = ep.id;
    opt.textContent = episodeTabLabel(idx);
    targetSel.append(opt);
  });
  if (prev && state.episodes.some((e) => e.id === prev)) {
    targetSel.value = prev;
  }

  if (catFilter) {
    const prevCat = catFilter.value;
    catFilter.innerHTML = "";
    const all = document.createElement("option");
    all.value = "";
    all.textContent = "All categories";
    catFilter.append(all);
    betCategories().forEach((c) => {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.label;
      catFilter.append(o);
    });
    const customOpt = document.createElement("option");
    customOpt.value = "_custom";
    customOpt.textContent = "Custom bets";
    catFilter.append(customOpt);
    if (prevCat) catFilter.value = prevCat;
  }

  try { list.innerHTML = ""; } catch (_) {}
  const q = bankFilterQuery();
  const catVal = bankCategoryFilter();
  let allRows;
  try { allRows = masterBetEvents(); } catch (e) { console.error("masterBetEvents failed:", e); allRows = []; }
  let filtered = allRows;
  if (q) filtered = filtered.filter(({ text }) => text.toLowerCase().includes(q));
  if (catVal) {
    filtered = filtered.filter(({ category }) => {
      if (catVal === "_custom") return !category || category === "_custom";
      return category === catVal;
    });
  }

  if (!allRows.length) {
    const p = document.createElement("p");
    p.className = "panel__hint";
    p.textContent = "No preset events loaded.";
    list.append(p);
    return;
  }
  if (!filtered.length) {
    const p = document.createElement("p");
    p.className = "panel__hint";
    p.textContent = "No events match your search.";
    list.append(p);
    return;
  }

  const grouped = groupByCategory(filtered);
  grouped.forEach(([catId, items]) => {
    const section = document.createElement("div");
    section.className = "bank-category-group";

    const header = document.createElement("button");
    header.type = "button";
    header.className = "bank-category-header";
    const label = catId === "_custom" ? "Custom bets" : categoryLabel(catId);
    header.innerHTML = `<span class="bank-category-header__label">${escapeHtml(label)}</span><span class="bank-category-header__count">${items.length}</span><span class="bank-category-header__chevron">&#9662;</span>`;
    const body = document.createElement("div");
    body.className = "bank-category-body";

    header.addEventListener("click", () => {
      const open = !body.hidden;
      body.hidden = open;
      header.setAttribute("aria-expanded", String(!open));
      header.querySelector(".bank-category-header__chevron").textContent = open ? "\u25B8" : "\u25BE";
    });
    header.setAttribute("aria-expanded", "true");

    items.forEach(({ text, odds, category, phase, _origText }) => {
      const isCustom = !category || category === "_custom";
      const evPhase = phase || "any";
      const row = document.createElement("div");
      row.className = "event-bank-row";

      const leftCol = document.createElement("div");
      leftCol.className = "event-bank-row__left";

      const topLine = document.createElement("div");
      topLine.className = "event-bank-row__top-line";

      if (evPhase !== "any") {
        const phaseBadge = document.createElement("button");
        phaseBadge.type = "button";
        phaseBadge.className = "phase-badge phase-badge--" + evPhase;
        phaseBadge.textContent = evPhase.replace("-heavy", "").replace("-peak", "");
        phaseBadge.title = "Click to change phase";
        phaseBadge.addEventListener("click", (e) => {
          e.stopPropagation();
          showPhaseDropdown(phaseBadge, evPhase, isCustom, text, _origText);
        });
        topLine.append(phaseBadge);
      } else {
        const phaseBadge = document.createElement("button");
        phaseBadge.type = "button";
        phaseBadge.className = "phase-badge phase-badge--any";
        phaseBadge.textContent = "any";
        phaseBadge.title = "Click to set phase";
        phaseBadge.addEventListener("click", (e) => {
          e.stopPropagation();
          showPhaseDropdown(phaseBadge, "any", isCustom, text, _origText);
        });
        topLine.append(phaseBadge);
      }

      const textEl = document.createElement("p");
      textEl.className = "event-bank-row__text event-bank-row__text--editable";
      textEl.textContent = text;
      textEl.title = "Click to edit";
      textEl.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "input event-bank-row__text-input";
        input.value = text;
        input.maxLength = 140;
        const commit = () => {
          const val = input.value.trim();
          if (!val || val === text) {
            textEl.hidden = false;
            input.remove();
            return;
          }
          if (isCustom) {
            const entry = state.customBankEvents.find((e) => e.text === text);
            if (entry) entry.text = val;
          } else if (_origText) {
            state.bankTextOverrides[_origText] = val;
          }
          saveState();
          populateMasterEventDatalist();
          renderEventBank();
        };
        input.addEventListener("blur", commit);
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { textEl.hidden = false; input.remove(); }
        });
        textEl.hidden = true;
        topLine.insertBefore(input, textEl.nextSibling);
        input.focus();
        input.select();
      });
      topLine.append(textEl);
      leftCol.append(topLine);

      const meta = document.createElement("div");
      meta.className = "event-bank-row__meta";
      const oddsInput = document.createElement("input");
      oddsInput.type = "number";
      oddsInput.className = "input event-bank-row__odds-input";
      oddsInput.min = "1.1";
      oddsInput.max = "99";
      oddsInput.step = "0.1";
      oddsInput.value = Number(odds).toFixed(1);
      oddsInput.title = "Adjust base odds";

      const previewEl = document.createElement("span");
      previewEl.className = "event-bank-row__phase-preview";
      const updatePreview = () => {
        const epId = targetSel.value;
        if (!epId || evPhase === "any") { previewEl.textContent = ""; return; }
        const ep = getEpisode(epId);
        if (!ep) { previewEl.textContent = ""; return; }
        const epIdx = state.episodes.indexOf(ep);
        const total = state.episodes.length;
        const epPh = getEpisodePhase(epIdx, total);
        const mult = getPhaseMultiplier(evPhase, epPh);
        const base = Number.parseFloat(oddsInput.value) || Number(odds);
        const adj = computePhaseAdjustedOdds(base, evPhase, epIdx, total);
        previewEl.textContent = `Will add at ${adj.toFixed(1)}\u00D7 (base ${base.toFixed(1)} \u00D7 ${mult.toFixed(1)} ${epPh} phase)`;
      };
      leftCol.append(previewEl);

      oddsInput.addEventListener("change", () => {
        let v = Number.parseFloat(oddsInput.value);
        if (Number.isNaN(v) || v < 1.1) { oddsInput.value = Number(odds).toFixed(1); return; }
        if (isCustom) {
          const entry = state.customBankEvents.find((e) => e.text === text);
          if (entry) entry.odds = v;
        } else if (_origText) {
          state.bankOddsOverrides[_origText] = v;
        }
        oddsInput.value = v.toFixed(1);
        saveState();
        updatePreview();
      });
      const timesLabel = document.createElement("span");
      timesLabel.className = "event-bank-row__times";
      timesLabel.textContent = "\u00D7";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--secondary event-bank-row__btn";
      btn.textContent = "Add";
      btn.addEventListener("click", () => {
        const epId = targetSel.value;
        if (!epId) {
          alert("Choose an episode in the dropdown first.");
          return;
        }
        let customOdds = Number.parseFloat(oddsInput.value);
        if (Number.isNaN(customOdds) || customOdds < 1.1) customOdds = Number(odds);
        addMasterEventToEpisode(epId, text, customOdds, evPhase);
      });

      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "event-bank-row__remove-custom";
      rm.textContent = "\u00D7";
      rm.title = "Remove bet from bank";
      rm.addEventListener("click", () => {
        if (isCustom) {
          state.customBankEvents = state.customBankEvents.filter((e) => e.text !== text);
        } else if (_origText) {
          if (!Array.isArray(state.hiddenBankEvents)) state.hiddenBankEvents = [];
          state.hiddenBankEvents.push(_origText);
          delete state.bankOddsOverrides[_origText];
          delete state.bankTextOverrides[_origText];
          delete state.bankPhaseOverrides[_origText];
        }
        saveState();
        populateMasterEventDatalist();
        renderEventBank();
      });
      meta.append(oddsInput, timesLabel, btn, rm);
      row.append(leftCol, meta);
      body.append(row);

      updatePreview();
    });

    body.hidden = false;
    section.append(header, body);
    list.append(section);
  });
}

function renderMainTabs() {
  const root = document.getElementById("main-tabs");
  root.innerHTML = "";

  const isOnEpisode = state.episodes.some((e) => e.id === state.activeTab);

  const pages = [
    { id: OVERVIEW, label: "Overview" },
    { id: WEEKLY_RECAP, label: "Ugens recap" },
    { id: CAST, label: "Bejlere" },
    { id: EVENT_BANK, label: "Bet bank" },
    { id: SEASON_BETS, label: "Season bets" },
    { id: MY_STATS, label: "Player stats" },
  ];
  pages.forEach(({ id, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.textContent = label;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", state.activeTab === id ? "true" : "false");
    btn.addEventListener("click", () => {
      state.activeTab = id;
      saveState();
      renderMainTabs();
      updateViewVisibility();
      if (id === OVERVIEW) renderLeaderboard();
      if (id === EVENT_BANK) renderEventBank();
      if (id === SEASON_BETS) renderSeasonBets();
      if (id === WEEKLY_RECAP) renderWeeklyRecap();
      if (id === MY_STATS) renderMyStats();
    });
    root.append(btn);
  });

  if (state.episodes.length) {
    const sep = document.createElement("span");
    sep.className = "tab-separator";
    root.append(sep);

    const select = document.createElement("select");
    select.className = "tab-episode-select" + (isOnEpisode ? " tab-episode-select--active" : "");
    if (!isOnEpisode) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Episodes\u2026";
      placeholder.disabled = true;
      placeholder.selected = true;
      select.append(placeholder);
    }

    for (let idx = state.episodes.length - 1; idx >= 0; idx--) {
      const ep = state.episodes[idx];
      const opt = document.createElement("option");
      opt.value = ep.id;
      opt.textContent = episodeTabLabel(idx) + (ep.closed ? " \u2713" : ep.betsLocked ? " \uD83D\uDD12" : "");
      if (ep.id === state.activeTab) opt.selected = true;
      select.append(opt);
    }

    select.addEventListener("change", () => {
      if (!select.value) return;
      state.activeTab = select.value;
      saveState();
      renderMainTabs();
      updateViewVisibility();
      renderEpisodeContent();
      renderLeaderboard();
    });
    root.append(select);
  }
}

function initials(name) {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function renderGuys() {
  const ep = activeEpisode();
  const root = document.getElementById("guys-grid");
  root.innerHTML = "";
  if (!ep) return;
  if (!Array.isArray(ep.guys)) ep.guys = [];
  const closed = isEpisodeClosed(ep);
  if (!ep.guys.length) {
    const empty = document.createElement("p");
    empty.className = "panel__hint";
    empty.style.margin = "0";
    empty.textContent = closed ? "No contestants." : "No contestants yet — add names for this week.";
    root.append(empty);
    return;
  }
  ep.guys.forEach((g) => {
    const chip = document.createElement("div");
    chip.className = "guy-chip";
    const photo = castPhotoByName(g.name);
    if (photo) {
      const img = document.createElement("img");
      img.className = "guy-chip__photo";
      img.src = photo;
      img.alt = g.name;
      img.loading = "lazy";
      img.decoding = "async";
      photoFallback(img, g.name);
      chip.append(img);
    } else {
      const ini = document.createElement("span");
      ini.className = "guy-chip__initial";
      ini.textContent = initials(g.name);
      chip.append(ini);
    }
    const name = document.createElement("span");
    name.textContent = g.name;
    if (!closed) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${g.name}`);
      remove.textContent = "\u00D7";
      remove.addEventListener("click", () => {
        ep.guys = ep.guys.filter((x) => x.id !== g.id);
        saveState();
        renderGuys();
        renderEliminationBets();
        renderEliminations();
        renderLeaderboard();
      });
      chip.append(name, remove);
    } else {
      chip.append(name);
    }
    root.append(chip);
  });
}

function renderEvents() {
  const ep = activeEpisode();
  const root = document.getElementById("events-list");
  root.innerHTML = "";
  if (!ep) return;
  if (!Array.isArray(ep.events)) ep.events = [];
  const closed = isEpisodeClosed(ep);
  const frozen = isEpisodeBetsLocked(ep);
  if (!ep.events.length) {
    const empty = document.createElement("p");
    empty.className = "panel__hint";
    empty.style.margin = "0";
    empty.textContent = "Add prediction events with odds.";
    root.append(empty);
    return;
  }
  ep.events.forEach((ev) => {
    const li = document.createElement("li");
    li.className = "event-row";
    const p = document.createElement("p");
    p.className = "event-row__text";
    p.textContent = ev.text;
    const meta = document.createElement("div");
    meta.className = "event-row__meta";
    const oddsInput = document.createElement("input");
    oddsInput.type = "number";
    oddsInput.className = "input event-row__odds-input";
    oddsInput.min = "1.1";
    oddsInput.max = "99";
    oddsInput.step = "0.1";
    oddsInput.value = Number(ev.odds).toFixed(1);
    if (frozen) oddsInput.disabled = true;
    oddsInput.addEventListener("change", () => {
      let v = Number.parseFloat(oddsInput.value);
      if (Number.isNaN(v) || v < 1.1) v = Number(ev.odds);
      ev.odds = v;
      oddsInput.value = v.toFixed(1);
      saveState();
      renderBets();
      renderResults();
      renderEpisodeScoreSummary();
      renderLeaderboard();
    });
    const timesLabel = document.createElement("span");
    timesLabel.className = "event-row__times";
    timesLabel.textContent = "\u00d7";
    if (!closed) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "event-row__remove";
      rm.textContent = "Remove";
      if (frozen) rm.disabled = true;
      rm.addEventListener("click", () => {
        ep.events = ep.events.filter((x) => x.id !== ev.id);
        for (let i = 0; i < PLAYER_COUNT; i++) {
          const b = state.bets[ep.id]?.[i];
          if (b) state.bets[ep.id][i] = b.filter((id) => id !== ev.id);
        }
        state.occurred[ep.id] = (state.occurred[ep.id] || []).filter((id) => id !== ev.id);
        saveState();
        renderEvents();
        renderBets();
        renderResults();
        renderEpisodeScoreSummary();
        renderLeaderboard();
      });
      meta.append(oddsInput, timesLabel, rm);
    } else {
      meta.append(oddsInput, timesLabel);
    }
    li.append(p, meta);
    root.append(li);
  });
}

function eventOptionsHtml(ep, selectedId, otherSelected) {
  const blocked = new Set(otherSelected.filter(Boolean));
  let html = '<option value="">— Pick an event —</option>';
  for (const ev of (ep.events || [])) {
    if (ev.id !== selectedId && blocked.has(ev.id)) continue;
    const sel = ev.id === selectedId ? " selected" : "";
    html += `<option value="${ev.id}"${sel}>(${Number(ev.odds).toFixed(1)}×) ${escapeHtml(ev.text)}</option>`;
  }
  return html;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function renderBets() {
  const ep = activeEpisode();
  const root = document.getElementById("bets-grid");
  root.innerHTML = "";
  if (!ep) return;
  ensureEpisodeMaps(ep.id);
  const frozen = isEpisodeBetsLocked(ep);

  for (let p = 0; p < PLAYER_COUNT; p++) {
    const card = document.createElement("div");
    card.className = "bet-card" + (frozen ? " bet-card--locked" : "");
    const h = document.createElement("h3");
    h.className = "bet-card__name";
    h.textContent = PLAYER_NAMES[p];
    card.append(h);

    const picks = [...(state.bets[ep.id][p] || [])];
    while (picks.length < MAX_BETS) picks.push("");

    for (let slot = 0; slot < MAX_BETS; slot++) {
      const slotWrap = document.createElement("div");
      slotWrap.className = "bet-card__slot";
      const lab = document.createElement("label");
      lab.htmlFor = `bet-${ep.id}-${p}-${slot}`;
      lab.textContent = `Pick ${slot + 1}`;
      const select = document.createElement("select");
      select.id = `bet-${ep.id}-${p}-${slot}`;
      const others = picks.filter((_, i) => i !== slot);
      select.innerHTML = eventOptionsHtml(ep, picks[slot] || "", others);
      select.value = picks[slot] || "";
      if (frozen) select.disabled = true;
      select.addEventListener("change", () => {
        ensureEpisodeMaps(ep.id);
        const next = [...(state.bets[ep.id][p] || [])];
        while (next.length < MAX_BETS) next.push("");
        next[slot] = select.value;
        const used = new Set();
        const cleaned = [];
        for (const v of next) {
          if (!v || used.has(v)) continue;
          used.add(v);
          cleaned.push(v);
        }
        while (cleaned.length < MAX_BETS) cleaned.push("");
        state.bets[ep.id][p] = cleaned.slice(0, MAX_BETS);
        saveState();
        renderBets();
        renderResults();
        renderEpisodeScoreSummary();
        renderLeaderboard();
      });
      slotWrap.append(lab, select);
      card.append(slotWrap);
    }
    root.append(card);
  }
}

function betOnEventIds(ep) {
  ensureEpisodeMaps(ep.id);
  const ids = new Set();
  for (let p = 0; p < PLAYER_COUNT; p++) {
    for (const id of state.bets[ep.id][p] || []) {
      if (id) ids.add(id);
    }
  }
  return ids;
}

function renderResults() {
  const ep = activeEpisode();
  const root = document.getElementById("results-list");
  root.innerHTML = "";
  if (!ep) return;
  if (!Array.isArray(ep.events)) ep.events = [];
  ensureEpisodeMaps(ep.id);
  const closed = isEpisodeClosed(ep);
  const occurred = new Set(state.occurred[ep.id] || []);
  const betIds = betOnEventIds(ep);

  const betEvents = ep.events.filter((ev) => betIds.has(ev.id));

  if (!betEvents.length) {
    const empty = document.createElement("p");
    empty.className = "panel__hint";
    empty.style.margin = "0";
    empty.textContent = "Place bets above first — only events someone bet on appear here.";
    root.append(empty);
    return;
  }

  betEvents.forEach((ev) => {
    const row = document.createElement("label");
    row.className = "result-item";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = occurred.has(ev.id);
    if (closed) cb.disabled = true;
    cb.addEventListener("change", () => {
      ensureEpisodeMaps(ep.id);
      let next = new Set(state.occurred[ep.id] || []);
      if (cb.checked) next.add(ev.id);
      else next.delete(ev.id);
      state.occurred[ep.id] = [...next];
      saveState();
      renderEpisodeScoreSummary();
      renderLeaderboard();
    });
    const whoPickedNames = [];
    for (let p = 0; p < PLAYER_COUNT; p++) {
      if ((state.bets[ep.id][p] || []).includes(ev.id)) whoPickedNames.push(PLAYER_NAMES[p]);
    }
    const span = document.createElement("span");
    span.innerHTML = `${escapeHtml(ev.text)} <strong>(${Number(ev.odds).toFixed(1)}×)</strong> <em class="result-item__who">${escapeHtml(whoPickedNames.join(", "))}</em>`;
    row.append(cb, span);
    root.append(row);
  });
}

function renderEliminationBets() {
  const ep = activeEpisode();
  const root = document.getElementById("elim-bets-grid");
  if (!root) return;
  root.innerHTML = "";
  if (!ep) return;
  if (!Array.isArray(ep.guys)) ep.guys = [];
  ensureEpisodeMaps(ep.id);
  const frozen = isEpisodeBetsLocked(ep);

  if (!ep.guys.length) {
    const p = document.createElement("p");
    p.className = "panel__hint";
    p.style.margin = "0";
    p.textContent = "Add contestants first.";
    root.append(p);
    return;
  }

  const odds = eliminationOdds(ep);
  const oddsNote = document.getElementById("elim-odds-note");
  if (oddsNote) oddsNote.textContent = `(${odds.toFixed(1)}\u00D7 if correct \u2014 scales with number of guys)`;

  for (let p = 0; p < PLAYER_COUNT; p++) {
    const card = document.createElement("div");
    card.className = "elim-bet-card";
    const h = document.createElement("h3");
    h.className = "bet-card__name";
    h.textContent = PLAYER_NAMES[p];
    const select = document.createElement("select");
    select.className = "input";
    const current = state.eliminationBets[ep.id]?.[p] || "";
    let html = '<option value="">— Pick who leaves —</option>';
    for (const g of ep.guys) {
      const sel = g.name === current ? " selected" : "";
      html += `<option value="${escapeHtml(g.name)}"${sel}>${escapeHtml(g.name)}</option>`;
    }
    select.innerHTML = html;
    select.value = current;
    if (frozen) select.disabled = true;
    select.addEventListener("change", () => {
      ensureEpisodeMaps(ep.id);
      state.eliminationBets[ep.id][p] = select.value;
      saveState();
      renderEpisodeScoreSummary();
      renderLeaderboard();
    });
    card.append(h, select);
    root.append(card);
  }
}

function renderEliminations() {
  const ep = activeEpisode();
  const root = document.getElementById("elim-results-list");
  if (!root) return;
  root.innerHTML = "";
  if (!ep) return;
  if (!Array.isArray(ep.guys)) ep.guys = [];
  ensureEliminatedArray(ep);
  const closed = isEpisodeClosed(ep);

  if (!ep.guys.length) {
    const p = document.createElement("p");
    p.className = "panel__hint";
    p.style.margin = "0";
    p.textContent = "Add contestants first.";
    root.append(p);
    return;
  }

  const elimSet = new Set(ep.eliminated);
  ep.guys.forEach((g) => {
    const card = document.createElement("label");
    card.className = "elim-card" + (elimSet.has(g.name) ? " elim-card--out" : "");

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "elim-card__cb";
    cb.checked = elimSet.has(g.name);
    if (closed) cb.disabled = true;
    cb.addEventListener("change", () => {
      ensureEliminatedArray(ep);
      if (cb.checked) {
        if (!ep.eliminated.includes(g.name)) ep.eliminated.push(g.name);
      } else {
        ep.eliminated = ep.eliminated.filter((n) => n !== g.name);
      }
      saveState();
      renderEliminations();
      renderEpisodeScoreSummary();
      renderLeaderboard();
    });

    const photoWrap = document.createElement("div");
    photoWrap.className = "elim-card__photo-wrap";
    const photo = castPhotoByName(g.name);
    if (photo) {
      const img = document.createElement("img");
      img.className = "elim-card__photo";
      img.src = photo;
      img.alt = g.name;
      img.loading = "lazy";
      img.decoding = "async";
      img.width = 240;
      img.height = 160;
      photoFallback(img, g.name);
      photoWrap.append(img);
    } else {
      const initials = document.createElement("span");
      initials.className = "elim-card__initials";
      initials.textContent = g.name.slice(0, 2).toUpperCase();
      photoWrap.append(initials);
    }

    const name = document.createElement("span");
    name.className = "elim-card__name";
    name.textContent = g.name;

    card.append(cb, photoWrap, name);
    root.append(card);
  });
}

function renderEpisodeScoreSummary() {
  const ep = activeEpisode();
  const el = document.getElementById("episode-score-summary");
  if (!ep) {
    el.hidden = true;
    return;
  }
  const pts = episodePoints(ep);
  const streaks = getStreaks();
  const lines = [];
  const parts = PLAYER_NAMES.map((name, i) => {
    const bd = streaks[i]?.episodeBreakdown?.find((b) => b.episodeId === ep.id);
    let extra = "";
    if (bd?.bonus > 0) {
      extra = ` <span class="streak-bonus-tag">\uD83D\uDD25 +${bd.bonus} streak</span>`;
      lines.push(`${escapeHtml(name)}: ${bd.streakAfter}-episode streak \u2192 +${bd.bonus} pts`);
    }
    return `<strong>${escapeHtml(name)}</strong>: ${pts[i].toFixed(2)} pts${extra}`;
  });
  let html = `This episode: ${parts.join(" \u00B7 ")}`;
  if (lines.length) {
    html += `<br><span class="streak-summary">${lines.join(" \u00B7 ")}</span>`;
  }
  el.innerHTML = html;
  el.hidden = false;
}

function getRunningGuyNames() {
  for (let i = state.episodes.length - 1; i >= 0; i--) {
    const ep = state.episodes[i];
    if (ep.guys && ep.guys.length > 0) {
      return guysAfterEliminations(ep).map((g) => g.name);
    }
  }
  return CAST_BA4_2026.map((c) => c.name);
}

function getEventOccurrenceCounts() {
  const counts = new Map();
  for (const ep of state.episodes) {
    const occurred = new Set(state.occurred[ep.id] || []);
    for (const ev of (ep.events || [])) {
      if (!occurred.has(ev.id)) continue;
      const key = ev.text.trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function renderOverviewPanels() {
  const runRoot = document.getElementById("overview-running-guys");
  if (!runRoot) return;

  runRoot.innerHTML = "";
  getRunningGuyNames().forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "overview-chip";
    chip.textContent = name;
    runRoot.append(chip);
  });

  renderStreakLeaders();
}

function renderStreakLeaders() {
  const root = document.getElementById("overview-streak-leaders");
  if (!root) return;
  root.innerHTML = "";
  const streaks = getStreaks();
  const sorted = PLAYER_NAMES
    .map((name, i) => ({ name, i, currentStreak: 0, longestStreak: 0, bonusPointsEarned: 0, ...streaks[i] }))
    .sort((a, b) => b.currentStreak - a.currentStreak || b.longestStreak - a.longestStreak);

  const anyStreak = sorted.some((s) => s.currentStreak > 0 || s.longestStreak > 0);
  if (!anyStreak) {
    const p = document.createElement("p");
    p.className = "panel__hint";
    p.style.margin = "0";
    p.textContent = "Close episodes with correct bets to build streaks.";
    root.append(p);
    return;
  }

  sorted.forEach((s) => {
    const row = document.createElement("div");
    row.className = "streak-leader-row";
    const nameEl = document.createElement("span");
    nameEl.className = "streak-leader-row__name";
    nameEl.textContent = s.name;
    const streakEl = document.createElement("span");
    streakEl.className = "streak-leader-row__val";
    if (s.currentStreak > 0) {
      streakEl.textContent = `\uD83D\uDD25 ${s.currentStreak}`;
      const nextM = STREAK_MILESTONES.find((m) => m.at > s.currentStreak);
      if (nextM) {
        const dist = document.createElement("span");
        dist.className = "streak-leader-row__next";
        dist.textContent = `${nextM.at - s.currentStreak} til +${nextM.bonus}`;
        row.append(nameEl, streakEl, dist);
      } else {
        row.append(nameEl, streakEl);
      }
    } else {
      streakEl.textContent = "\u2014";
      row.append(nameEl, streakEl);
    }
    if (s.bonusPointsEarned > 0) {
      const bonusEl = document.createElement("span");
      bonusEl.className = "streak-leader-row__bonus";
      bonusEl.textContent = `+${s.bonusPointsEarned}`;
      row.append(bonusEl);
    }
    root.append(row);
  });
}

/* ── Season bets helpers ── */

function seasonBetMatches(cat, pick, actual) {
  if (!pick || !actual) return false;
  if (cat.inputType === "episode") {
    return String(pick) === String(actual);
  }
  return pick === actual;
}

function seasonBetPoints() {
  const pts = PLAYER_NAMES.map(() => 0);
  const res = state.seasonResults || {};
  for (let p = 0; p < PLAYER_COUNT; p++) {
    const picks = state.seasonBets?.[p] || {};
    for (const cat of SEASON_BET_CATEGORIES) {
      if (seasonBetMatches(cat, picks[cat.key], res[cat.key])) {
        pts[p] += cat.points;
      }
    }
  }
  return pts;
}

function seasonBetMaxPoints() {
  return SEASON_BET_CATEGORIES.reduce((sum, c) => sum + c.points, 0);
}

function castNames() {
  return allCast().map((c) => c.name);
}

function buildSeasonInput(cat, currentVal, locked, onChange) {
  const type = cat.inputType || "contestant";
  if (type === "contestant") {
    const sel = document.createElement("select");
    sel.className = "input season-card__select";
    sel.disabled = locked;
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "\u2014 V\u00E6lg \u2014";
    sel.append(ph);
    for (const n of castNames()) {
      const opt = document.createElement("option");
      opt.value = n;
      opt.textContent = n;
      sel.append(opt);
    }
    sel.value = currentVal || "";
    sel.addEventListener("change", () => onChange(sel.value || null));
    return sel;
  }
  if (type === "episode") {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.className = "input season-card__select season-card__select--narrow";
    inp.min = 1;
    inp.max = Math.max(state.episodes.length, EXPECTED_SEASON_LENGTH);
    inp.step = 1;
    inp.placeholder = "Ep.";
    inp.disabled = locked;
    inp.value = currentVal || "";
    inp.addEventListener("change", () => onChange(inp.value ? String(inp.value) : null));
    return inp;
  }
  if (type === "yesno") {
    const sel = document.createElement("select");
    sel.className = "input season-card__select";
    sel.disabled = locked;
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "\u2014 V\u00E6lg \u2014";
    sel.append(ph);
    for (const v of ["Ja", "Nej"]) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.append(opt);
    }
    sel.value = currentVal || "";
    sel.addEventListener("change", () => onChange(sel.value || null));
    return sel;
  }
  if (type === "bachelorette") {
    const sel = document.createElement("select");
    sel.className = "input season-card__select";
    sel.disabled = locked;
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "\u2014 V\u00E6lg \u2014";
    sel.append(ph);
    for (const v of ["Mie", "Sofie"]) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.append(opt);
    }
    sel.value = currentVal || "";
    sel.addEventListener("change", () => onChange(sel.value || null));
    return sel;
  }
  return document.createElement("span");
}

function renderSeasonBets() {
  const locked = !!state.seasonBetsLocked;

  const lockBar = document.getElementById("season-bets-lock-bar");
  if (lockBar) {
    lockBar.innerHTML = "";
    if (locked) {
      const badge = document.createElement("span");
      badge.className = "season-lock-badge season-lock-badge--locked";
      badge.innerHTML = "&#128274; Season bets are locked";
      lockBar.append(badge);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--lock btn--season-lock";
      btn.textContent = "Lock season bets";
      btn.addEventListener("click", () => {
        if (!confirm("Lock all season bets? This cannot be undone easily.")) return;
        state.seasonBetsLocked = true;
        saveState();
        renderSeasonBets();
      });
      lockBar.append(btn);
    }
  }

  const cardsRoot = document.getElementById("season-bets-cards");
  if (cardsRoot) {
    cardsRoot.innerHTML = "";
    for (const cat of SEASON_BET_CATEGORIES) {
      const card = document.createElement("div");
      card.className = "season-card";

      const header = document.createElement("div");
      header.className = "season-card__header";
      const title = document.createElement("span");
      title.className = "season-card__title";
      title.textContent = cat.label;
      const badge = document.createElement("span");
      badge.className = "season-card__pts";
      badge.textContent = `${cat.points} pts`;
      header.append(title, badge);

      const desc = document.createElement("p");
      desc.className = "season-card__desc";
      desc.textContent = cat.desc;

      card.append(header, desc);

      const playersRow = document.createElement("div");
      playersRow.className = "season-card__players";

      for (let p = 0; p < PLAYER_COUNT; p++) {
        const playerPick = document.createElement("div");
        playerPick.className = "season-card__player";

        const label = document.createElement("span");
        label.className = "season-card__player-name";
        label.textContent = PLAYER_NAMES[p];

        const currentPick = state.seasonBets?.[p]?.[cat.key] || "";
        const result = state.seasonResults?.[cat.key];
        const won = seasonBetMatches(cat, currentPick, result);

        if (won) {
          const trophy = document.createElement("span");
          trophy.className = "season-card__trophy";
          trophy.textContent = "\uD83C\uDFC6";
          playerPick.append(trophy);
        }

        const input = buildSeasonInput(cat, currentPick, locked, (val) => {
          if (!state.seasonBets[p]) state.seasonBets[p] = {};
          state.seasonBets[p][cat.key] = val;
          saveState();
          renderSeasonBets();
        });

        playerPick.append(label, input);
        playersRow.append(playerPick);
      }

      card.append(playersRow);
      cardsRoot.append(card);
    }
  }

  const resultsGrid = document.getElementById("season-results-grid");
  if (resultsGrid) {
    resultsGrid.innerHTML = "";
    for (const cat of SEASON_BET_CATEGORIES) {
      const row = document.createElement("div");
      row.className = "season-result-row";

      const label = document.createElement("span");
      label.className = "season-result-row__label";
      label.textContent = cat.label;

      const input = buildSeasonInput(cat, state.seasonResults?.[cat.key] || "", false, (val) => {
        if (!state.seasonResults) state.seasonResults = {};
        state.seasonResults[cat.key] = val;
        saveState();
        renderSeasonBets();
        renderLeaderboard();
      });

      row.append(label, input);
      resultsGrid.append(row);
    }
  }

  const summaryRoot = document.getElementById("season-points-summary");
  if (summaryRoot) {
    summaryRoot.innerHTML = "";
    const pts = seasonBetPoints();
    const maxPts = seasonBetMaxPoints();
    const heading = document.createElement("h3");
    heading.className = "overview-block__title panel__title";
    heading.textContent = "Season bet scoreboard";
    summaryRoot.append(heading);
    for (let p = 0; p < PLAYER_COUNT; p++) {
      const row = document.createElement("div");
      row.className = "season-score-row";
      const name = document.createElement("span");
      name.className = "season-score-row__name";
      name.textContent = PLAYER_NAMES[p];
      const val = document.createElement("span");
      val.className = "season-score-row__pts";
      val.textContent = `${pts[p]} / ${maxPts} pts`;
      row.append(name, val);
      summaryRoot.append(row);
    }
  }
}

/* ── Personal stats ── */

let selectedStatsPlayer = -1;
let statsViewMode = "overview";

function computePlayerStats(p) {
  const streaks = getStreaks();
  const epTotals = state.episodes.map((ep) => episodePoints(ep));
  const allTotals = totalPointsAllEpisodes();
  const sPts = seasonBetPoints();
  const grandTotals = allTotals.map((v, i) => v + sPts[i] + (streaks[i]?.bonusPointsEarned || 0));

  const sorted = grandTotals.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v);
  let rank = 1;
  for (let r = 0; r < sorted.length; r++) {
    if (r > 0 && sorted[r].v < sorted[r - 1].v) rank = r + 1;
    if (sorted[r].i === p) { rank = rank; break; }
  }

  let totalBets = 0, totalHits = 0;
  let biggestWin = { text: "—", odds: 0 };
  let bestNight = { label: "—", pts: 0 };
  const catStats = {};
  const eventStats = {};

  for (let ei = 0; ei < state.episodes.length; ei++) {
    const ep = state.episodes[ei];
    ensureEpisodeMaps(ep.id);
    ensureEliminatedArray(ep);
    const occurred = new Set(state.occurred[ep.id] || []);
    const picks = (state.bets[ep.id]?.[p] || []).filter(Boolean);
    const epPts = epTotals[ei][p];

    if (epPts > bestNight.pts) {
      bestNight = { label: episodeTabLabel(ei), pts: epPts };
    }

    for (const eventId of picks) {
      const ev = (ep.events || []).find((e) => e.id === eventId);
      if (!ev) continue;
      totalBets++;
      const hit = occurred.has(eventId);
      if (hit) totalHits++;

      const cat = ev.category || "_other";
      if (!catStats[cat]) catStats[cat] = { bet: 0, hit: 0 };
      catStats[cat].bet++;
      if (hit) catStats[cat].hit++;

      const key = ev.text;
      if (!eventStats[key]) eventStats[key] = { text: key, bet: 0, hit: 0 };
      eventStats[key].bet++;
      if (hit) {
        eventStats[key].hit++;
        const odds = Number(ev.odds) || 0;
        if (odds > biggestWin.odds) biggestWin = { text: ev.text, odds };
      }
    }
  }

  const hitRate = totalBets > 0 ? Math.round((totalHits / totalBets) * 100) : null;

  const byCategory = (window.BET_CATEGORIES || []).map((c) => {
    const s = catStats[c.id] || { bet: 0, hit: 0 };
    return { category: c.label, id: c.id, bet: s.bet, hit: s.hit, hitRate: s.bet > 0 ? Math.round((s.hit / s.bet) * 100) : null };
  }).filter((c) => c.bet > 0).sort((a, b) => (b.hitRate ?? 0) - (a.hitRate ?? 0));

  const allEvents = Object.values(eventStats);
  const mostBet = [...allEvents].sort((a, b) => b.bet - a.bet).slice(0, 5).map((e) => ({ ...e, hitRate: Math.round((e.hit / e.bet) * 100) }));
  const mostSuccessful = allEvents.filter((e) => e.bet >= 2).sort((a, b) => (b.hit / b.bet) - (a.hit / a.bet)).slice(0, 5).map((e) => ({ ...e, hitRate: Math.round((e.hit / e.bet) * 100) }));

  const weeklyTrend = state.episodes.map((ep, i) => ({
    weekLabel: `Ep ${i + 1}`,
    points: epTotals[i][p],
    groupAvg: Math.round((epTotals[i].reduce((a, b) => a + b, 0) / PLAYER_COUNT) * 10) / 10,
  }));

  let elimTotal = 0, elimCorrect = 0, elimPts = 0, elimStreak = 0, elimLongest = 0;
  const correctContestants = [];
  for (const ep of state.episodes) {
    ensureEpisodeMaps(ep.id);
    ensureEliminatedArray(ep);
    const pick = state.eliminationBets[ep.id]?.[p];
    if (!pick) continue;
    elimTotal++;
    const elimSet = new Set(ep.eliminated || []);
    if (elimSet.has(pick)) {
      elimCorrect++;
      elimStreak++;
      if (elimStreak > elimLongest) elimLongest = elimStreak;
      elimPts += eliminationOdds(ep);
      correctContestants.push({ name: pick, photoUrl: castPhotoByName(pick) });
    } else {
      elimStreak = 0;
    }
  }

  const comparisons = {};
  const allHitRates = PLAYER_NAMES.map((_, i) => {
    let b = 0, h = 0;
    for (const ep of state.episodes) {
      ensureEpisodeMaps(ep.id);
      const occ = new Set(state.occurred[ep.id] || []);
      for (const eid of (state.bets[ep.id]?.[i] || []).filter(Boolean)) {
        b++;
        if (occ.has(eid)) h++;
      }
    }
    return b > 0 ? h / b : 0;
  });
  const allBiggest = PLAYER_NAMES.map((_, i) => {
    let best = 0;
    for (const ep of state.episodes) {
      ensureEpisodeMaps(ep.id);
      const occ = new Set(state.occurred[ep.id] || []);
      for (const eid of (state.bets[ep.id]?.[i] || []).filter(Boolean)) {
        if (!occ.has(eid)) continue;
        const ev = (ep.events || []).find((e) => e.id === eid);
        if (ev && (Number(ev.odds) || 0) > best) best = Number(ev.odds);
      }
    }
    return best;
  });
  const allElimCorrect = PLAYER_NAMES.map((_, i) => {
    let c = 0;
    for (const ep of state.episodes) {
      ensureEpisodeMaps(ep.id);
      ensureEliminatedArray(ep);
      const pk = state.eliminationBets[ep.id]?.[i];
      if (pk && (ep.eliminated || []).includes(pk)) c++;
    }
    return c;
  });

  function rankOf(arr, idx) {
    const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    let r = 1;
    for (let j = 0; j < sorted.length; j++) {
      if (j > 0 && sorted[j].v < sorted[j - 1].v) r = j + 1;
      if (sorted[j].i === idx) return r;
    }
    return PLAYER_COUNT;
  }

  comparisons.hitRateRank = rankOf(allHitRates, p);
  comparisons.totalPointsRank = rankOf(grandTotals, p);
  comparisons.biggestWinRank = rankOf(allBiggest, p);
  comparisons.streakRank = rankOf(streaks.map((s) => s.currentStreak), p);
  comparisons.eliminationRank = rankOf(allElimCorrect, p);

  const seasonRes = state.seasonResults || {};
  const seasonPicks = state.seasonBets?.[p] || {};
  let seasonResolved = 0, seasonWon = 0;
  for (const cat of SEASON_BET_CATEGORIES) {
    if (seasonRes[cat.key]) {
      seasonResolved++;
      if (seasonBetMatches(cat, seasonPicks[cat.key], seasonRes[cat.key])) seasonWon++;
    }
  }

  const notesWritten = Object.keys(state.contestantNotes || {}).filter((k) => {
    const n = state.contestantNotes[k];
    return n?.lastEditedBy === PLAYER_NAMES[p] && n?.text;
  }).length;

  return {
    overview: { totalPoints: grandTotals[p], rank, hitRate, biggestWin, bestNight, currentStreak: streaks[p]?.currentStreak || 0 },
    byCategory,
    weeklyTrend,
    topEvents: { mostBet, mostSuccessful },
    eliminations: { totalBets: elimTotal, correctBets: elimCorrect, hitRate: elimTotal > 0 ? Math.round((elimCorrect / elimTotal) * 100) : null, pointsEarned: elimPts, longestStreak: elimLongest, correctContestants },
    comparisons,
    seasonSummary: seasonResolved > 0 ? `Season bets: ${seasonWon}/${seasonResolved} resolved in your favor` : null,
    notesWritten,
    totalBets,
  };
}

function renderMyStats() {
  const headerRoot = document.getElementById("my-stats-header");
  const barRoot = document.getElementById("my-stats-player-bar");
  const contentRoot = document.getElementById("my-stats-content");
  if (!headerRoot || !barRoot || !contentRoot) return;

  if (selectedStatsPlayer < 0) {
    const idx = PLAYER_NAMES.indexOf(currentPlayer);
    selectedStatsPlayer = idx >= 0 ? idx : 0;
  }

  barRoot.innerHTML = "";
  const ovBtn = document.createElement("button");
  ovBtn.type = "button";
  ovBtn.className = "ms-player-btn" + (statsViewMode === "overview" ? " ms-player-btn--active" : "");
  ovBtn.textContent = "All players";
  ovBtn.addEventListener("click", () => { statsViewMode = "overview"; renderMyStats(); });
  barRoot.append(ovBtn);

  const sep = document.createElement("span");
  sep.className = "ms-bar-sep";
  barRoot.append(sep);

  PLAYER_NAMES.forEach((name, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ms-player-btn" + (statsViewMode === "player" && selectedStatsPlayer === i ? " ms-player-btn--active" : "");
    btn.textContent = name;
    btn.addEventListener("click", () => { statsViewMode = "player"; selectedStatsPlayer = i; renderMyStats(); });
    barRoot.append(btn);
  });

  headerRoot.innerHTML = "";
  contentRoot.innerHTML = "";

  if (statsViewMode === "overview") {
    const h2 = document.createElement("h2");
    h2.id = "my-stats-heading";
    h2.className = "panel__title";
    h2.textContent = "Stats overview";
    headerRoot.append(h2);
    renderAllPlayersOverview(contentRoot);
  } else {
    const p = selectedStatsPlayer;
    const h2 = document.createElement("h2");
    h2.id = "my-stats-heading";
    h2.className = "panel__title";
    h2.textContent = `${PLAYER_NAMES[p]}'s stats`;
    headerRoot.append(h2);
    renderSinglePlayerStats(contentRoot, p);
  }
}

function renderAllPlayersOverview(root) {
  const allStats = PLAYER_NAMES.map((_, i) => computePlayerStats(i));
  const anyBets = allStats.some((s) => s.totalBets > 0);
  if (!anyBets) {
    const empty = document.createElement("div");
    empty.className = "ms-empty";
    empty.innerHTML = "<p>No bets placed yet. Stats will appear once players start betting.</p>";
    root.append(empty);
    return;
  }

  const section = document.createElement("div");
  section.className = "ms-section ms-matchday";

  const statRows = [
    { label: "Total points", fn: (s) => s.overview.totalPoints.toFixed(1), cmp: "high" },
    { label: "Rank", fn: (s) => ordinalShort(s.overview.rank), raw: (s) => s.overview.rank, cmp: "low" },
    { label: "Hit rate", fn: (s) => s.overview.hitRate != null ? `${s.overview.hitRate}%` : "\u2014", raw: (s) => s.overview.hitRate ?? -1, cmp: "high" },
    { label: "Bets placed", fn: (s) => String(s.totalBets), cmp: "high" },
    { label: "Current streak", fn: (s) => s.overview.currentStreak > 0 ? `\uD83D\uDD25 ${s.overview.currentStreak}` : "0", raw: (s) => s.overview.currentStreak, cmp: "high" },
    { label: "Biggest win", fn: (s) => s.overview.biggestWin.odds > 0 ? `${s.overview.biggestWin.odds}\u00D7` : "\u2014", raw: (s) => s.overview.biggestWin.odds, cmp: "high" },
    { label: "Best night", fn: (s) => s.overview.bestNight.pts > 0 ? `${s.overview.bestNight.pts.toFixed(1)}` : "\u2014", raw: (s) => s.overview.bestNight.pts, cmp: "high" },
    { label: "Elim. correct", fn: (s) => `${s.eliminations.correctBets}/${s.eliminations.totalBets}`, raw: (s) => s.eliminations.correctBets, cmp: "high" },
    { label: "Elim. hit rate", fn: (s) => s.eliminations.hitRate != null ? `${s.eliminations.hitRate}%` : "\u2014", raw: (s) => s.eliminations.hitRate ?? -1, cmp: "high" },
  ];

  const nameRow = document.createElement("div");
  nameRow.className = "ms-match-row ms-match-row--header";
  const corner = document.createElement("span");
  corner.className = "ms-match-cell ms-match-cell--label";
  nameRow.append(corner);
  PLAYER_NAMES.forEach((name) => {
    const cell = document.createElement("span");
    cell.className = "ms-match-cell ms-match-cell--name";
    cell.textContent = name;
    nameRow.append(cell);
  });
  section.append(nameRow);

  for (const sr of statRows) {
    const row = document.createElement("div");
    row.className = "ms-match-row";
    const lbl = document.createElement("span");
    lbl.className = "ms-match-cell ms-match-cell--label";
    lbl.textContent = sr.label;
    row.append(lbl);

    const rawFn = sr.raw || ((s) => parseFloat(sr.fn(s)) || 0);
    const rawVals = allStats.map(rawFn);
    const bestVal = sr.cmp === "high" ? Math.max(...rawVals) : Math.min(...rawVals.filter((v) => v >= 0));

    PLAYER_NAMES.forEach((_, i) => {
      const cell = document.createElement("span");
      cell.className = "ms-match-cell";
      cell.textContent = sr.fn(allStats[i]);
      if (rawVals[i] === bestVal && bestVal > 0) cell.classList.add("ms-match-cell--best");
      row.append(cell);
    });
    section.append(row);
  }

  root.append(section);

  if (allStats.some((s) => s.byCategory.length > 0)) {
    const catSection = document.createElement("div");
    catSection.className = "ms-section";
    const catH = document.createElement("h3");
    catH.className = "ms-section__title";
    catH.textContent = "Hit rate by category";
    catSection.append(catH);

    const cats = (window.BET_CATEGORIES || []);
    for (const cat of cats) {
      const rates = allStats.map((s) => {
        const c = s.byCategory.find((b) => b.id === cat.id);
        return c || { bet: 0, hit: 0, hitRate: null };
      });
      if (rates.every((r) => r.bet === 0)) continue;

      const catRow = document.createElement("div");
      catRow.className = "ms-cat-compare";
      const catLabel = document.createElement("span");
      catLabel.className = "ms-cat-compare__label";
      catLabel.textContent = cat.label;
      catRow.append(catLabel);

      const barsWrap = document.createElement("div");
      barsWrap.className = "ms-cat-compare__bars";
      const maxBet = Math.max(...rates.map((r) => r.bet), 1);

      PLAYER_NAMES.forEach((name, i) => {
        const r = rates[i];
        const col = document.createElement("div");
        col.className = "ms-cat-compare__col";
        const bar = document.createElement("div");
        bar.className = "ms-cat-compare__bar";
        bar.style.width = r.bet > 0 ? `${Math.max(8, ((r.hitRate ?? 0) / 100) * 100)}%` : "0%";
        const info = document.createElement("span");
        info.className = "ms-cat-compare__info";
        info.textContent = r.bet > 0 ? `${r.hitRate}%` : "\u2014";
        col.append(bar, info);
        barsWrap.append(col);
      });

      catRow.append(barsWrap);
      catSection.append(catRow);
    }

    const legend = document.createElement("div");
    legend.className = "ms-cat-compare__legend";
    PLAYER_NAMES.forEach((name, i) => {
      const sp = document.createElement("span");
      sp.className = "ms-cat-compare__legend-item";
      sp.dataset.player = i;
      sp.textContent = name;
      legend.append(sp);
    });
    catSection.append(legend);

    root.append(catSection);
  }

  const hint = document.createElement("p");
  hint.className = "panel__hint";
  hint.style.textAlign = "center";
  hint.style.marginTop = "1rem";
  hint.textContent = "Click a player name above to see their detailed stats.";
  root.append(hint);
}

function renderSinglePlayerStats(root, p) {
  const stats = computePlayerStats(p);

  if (stats.totalBets === 0) {
    const empty = document.createElement("div");
    empty.className = "ms-empty";
    empty.innerHTML = `<p>No bets placed yet. Place bets on an episode to see stats.</p>`;
    root.append(empty);
    return;
  }

  renderStatsOverview(root, stats);
  renderStatsByCategory(root, stats);
  renderStatsWeeklyTrend(root, stats);
  renderStatsFavoriteEvents(root, stats);
  renderStatsEliminations(root, stats);
  renderStatsComparisons(root, stats);

  if (stats.seasonSummary) {
    const p2 = document.createElement("p");
    p2.className = "ms-season-summary";
    p2.textContent = stats.seasonSummary;
    root.append(p2);
  }
  if (stats.notesWritten > 0) {
    const p3 = document.createElement("p");
    p3.className = "ms-notes-summary";
    p3.textContent = `Written notes on ${stats.notesWritten} contestant${stats.notesWritten !== 1 ? "s" : ""}.`;
    root.append(p3);
  }
}

function renderStatsOverview(root, stats) {
  const section = document.createElement("div");
  section.className = "ms-section";
  const h = document.createElement("h3");
  h.className = "ms-section__title";
  h.textContent = "Overview";
  section.append(h);

  const grid = document.createElement("div");
  grid.className = "ms-metric-grid";

  const o = stats.overview;
  const ordinal = ["—", "1st", "2nd", "3rd", "4th"];
  const cards = [
    { label: "Total points", value: o.totalPoints.toFixed(1) },
    { label: "Rank", value: ordinal[o.rank] || `${o.rank}th` },
    { label: "Hit rate", value: o.hitRate != null ? `${o.hitRate}%` : "—" },
    { label: "Biggest win", value: o.biggestWin.odds > 0 ? `${o.biggestWin.odds}\u00D7` : "—", sub: o.biggestWin.odds > 0 ? o.biggestWin.text : null },
    { label: "Best night", value: o.bestNight.pts > 0 ? `${o.bestNight.pts.toFixed(1)} pts` : "—", sub: o.bestNight.pts > 0 ? o.bestNight.label : null },
    { label: "Current streak", value: o.currentStreak > 0 ? `\uD83D\uDD25 ${o.currentStreak}` : "0" },
  ];
  for (const c of cards) {
    const card = document.createElement("div");
    card.className = "ms-metric-card";
    const lbl = document.createElement("span");
    lbl.className = "ms-metric-card__label";
    lbl.textContent = c.label;
    const val = document.createElement("span");
    val.className = "ms-metric-card__value";
    val.textContent = c.value;
    card.append(lbl, val);
    if (c.sub) {
      const sub = document.createElement("span");
      sub.className = "ms-metric-card__sub";
      sub.textContent = c.sub;
      card.append(sub);
    }
    grid.append(card);
  }
  section.append(grid);
  root.append(section);
}

function renderStatsByCategory(root, stats) {
  if (stats.byCategory.length === 0) return;
  const section = document.createElement("div");
  section.className = "ms-section";
  const h = document.createElement("h3");
  h.className = "ms-section__title";
  h.textContent = "Hit rate by category";
  section.append(h);

  const list = document.createElement("div");
  list.className = "ms-cat-bars";
  const maxRate = Math.max(...stats.byCategory.map((c) => c.hitRate ?? 0), 1);

  stats.byCategory.forEach((c, i) => {
    const row = document.createElement("div");
    row.className = "ms-cat-row";
    const label = document.createElement("span");
    label.className = "ms-cat-row__label";
    label.textContent = c.category;
    const barWrap = document.createElement("div");
    barWrap.className = "ms-cat-row__bar-wrap";
    const bar = document.createElement("div");
    bar.className = "ms-cat-row__bar";
    const pct = c.hitRate ?? 0;
    bar.style.width = `${Math.max(2, (pct / 100) * 100)}%`;
    if (i < 2) bar.classList.add("ms-cat-row__bar--top");
    else if (i >= stats.byCategory.length - 2 && stats.byCategory.length > 4) bar.classList.add("ms-cat-row__bar--bottom");
    barWrap.append(bar);
    const info = document.createElement("span");
    info.className = "ms-cat-row__info";
    const sampleNote = c.bet === 1 ? " (small sample)" : "";
    info.textContent = `${c.hit} of ${c.bet} hit (${pct}%)${sampleNote}`;
    row.append(label, barWrap, info);
    list.append(row);
  });
  section.append(list);
  root.append(section);
}

function renderStatsWeeklyTrend(root, stats) {
  const closedEps = stats.weeklyTrend.filter((_, i) => isEpisodeClosed(state.episodes[i]));
  if (closedEps.length < 2) {
    const section = document.createElement("div");
    section.className = "ms-section";
    const h = document.createElement("h3");
    h.className = "ms-section__title";
    h.textContent = "Points per week";
    const hint = document.createElement("p");
    hint.className = "panel__hint";
    hint.textContent = "Available after at least 2 closed episodes.";
    section.append(h, hint);
    root.append(section);
    return;
  }
  const section = document.createElement("div");
  section.className = "ms-section";
  const h = document.createElement("h3");
  h.className = "ms-section__title";
  h.textContent = "Points per week";
  section.append(h);

  const data = closedEps;
  const W = 600, H = 200, pad = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const maxY = Math.max(...data.map((d) => Math.max(d.points, d.groupAvg)), 1);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "ms-chart");
  svg.setAttribute("role", "img");

  const x = (i) => pad.left + (i / (data.length - 1 || 1)) * chartW;
  const y = (v) => pad.top + chartH - (v / maxY) * chartH;

  const avgPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.groupAvg).toFixed(1)}`).join("");
  const avgLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
  avgLine.setAttribute("d", avgPath);
  avgLine.setAttribute("class", "ms-chart__avg-line");
  svg.append(avgLine);

  const playerPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.points).toFixed(1)}`).join("");
  const playerLine = document.createElementNS("http://www.w3.org/2000/svg", "path");
  playerLine.setAttribute("d", playerPath);
  playerLine.setAttribute("class", "ms-chart__player-line");
  svg.append(playerLine);

  data.forEach((d, i) => {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", x(i).toFixed(1));
    dot.setAttribute("cy", y(d.points).toFixed(1));
    dot.setAttribute("r", "4");
    dot.setAttribute("class", "ms-chart__dot");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${d.weekLabel}: ${d.points.toFixed(1)} pts`;
    dot.append(title);
    svg.append(dot);
  });

  for (let i = 0; i < data.length; i++) {
    const lbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lbl.setAttribute("x", x(i).toFixed(1));
    lbl.setAttribute("y", H - 5);
    lbl.setAttribute("class", "ms-chart__x-label");
    lbl.textContent = data[i].weekLabel;
    svg.append(lbl);
  }

  const legend = document.createElement("div");
  legend.className = "ms-chart-legend";
  legend.innerHTML = '<span class="ms-chart-legend__player">\u25CF You</span> <span class="ms-chart-legend__avg">\u25CF Group avg</span>';
  section.append(svg, legend);
  root.append(section);
}

function renderStatsFavoriteEvents(root, stats) {
  const { mostBet, mostSuccessful } = stats.topEvents;
  if (mostBet.length === 0 && mostSuccessful.length === 0) return;
  const section = document.createElement("div");
  section.className = "ms-section";
  const h = document.createElement("h3");
  h.className = "ms-section__title";
  h.textContent = "Favorite events";
  section.append(h);

  const cols = document.createElement("div");
  cols.className = "ms-tables-row";

  function makeTable(title, data) {
    const wrap = document.createElement("div");
    wrap.className = "ms-table-wrap";
    const th = document.createElement("h4");
    th.className = "ms-table-wrap__title";
    th.textContent = title;
    wrap.append(th);
    if (data.length === 0) { const p = document.createElement("p"); p.className = "panel__hint"; p.textContent = "Not enough data yet."; wrap.append(p); return wrap; }
    const tbl = document.createElement("table");
    tbl.className = "ms-table";
    tbl.innerHTML = "<thead><tr><th>Event</th><th>Bets</th><th>Hits</th><th>Rate</th></tr></thead>";
    const tbody = document.createElement("tbody");
    for (const e of data) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td class="ms-table__event">${e.text}</td><td>${e.bet}</td><td>${e.hit}</td><td>${e.hitRate}%</td>`;
      tbody.append(tr);
    }
    tbl.append(tbody);
    wrap.append(tbl);
    return wrap;
  }

  cols.append(makeTable("Most-bet events", mostBet));
  cols.append(makeTable("Most successful events", mostSuccessful));
  section.append(cols);
  root.append(section);
}

function renderStatsEliminations(root, stats) {
  const section = document.createElement("div");
  section.className = "ms-section";
  const h = document.createElement("h3");
  h.className = "ms-section__title";
  h.textContent = "Elimination skills";
  section.append(h);
  const e = stats.eliminations;
  if (e.totalBets === 0) {
    const hint = document.createElement("p");
    hint.className = "panel__hint";
    hint.textContent = "No elimination picks placed yet.";
    section.append(hint);
    root.append(section);
    return;
  }
  const grid = document.createElement("div");
  grid.className = "ms-metric-grid ms-metric-grid--small";
  const items = [
    { label: "Picks placed", value: e.totalBets },
    { label: "Correct", value: e.correctBets },
    { label: "Hit rate", value: e.hitRate != null ? `${e.hitRate}%` : "—" },
    { label: "Points earned", value: e.pointsEarned.toFixed(1) },
    { label: "Longest streak", value: e.longestStreak },
  ];
  for (const item of items) {
    const card = document.createElement("div");
    card.className = "ms-metric-card ms-metric-card--sm";
    const lbl = document.createElement("span");
    lbl.className = "ms-metric-card__label";
    lbl.textContent = item.label;
    const val = document.createElement("span");
    val.className = "ms-metric-card__value";
    val.textContent = item.value;
    card.append(lbl, val);
    grid.append(card);
  }
  section.append(grid);
  if (e.correctContestants.length > 0) {
    const sub = document.createElement("div");
    sub.className = "ms-elim-correct";
    const subH = document.createElement("p");
    subH.className = "ms-elim-correct__title";
    subH.textContent = "Correctly called:";
    sub.append(subH);
    const chips = document.createElement("div");
    chips.className = "ms-elim-correct__chips";
    for (const c of e.correctContestants) {
      const chip = document.createElement("div");
      chip.className = "ms-elim-chip";
      if (c.photoUrl) {
        const img = document.createElement("img");
        img.src = c.photoUrl;
        img.alt = c.name;
        img.className = "ms-elim-chip__photo";
        img.loading = "lazy";
        photoFallback(img, c.name);
        chip.append(img);
      } else {
        const ini = document.createElement("div");
        ini.className = "photo-fallback ms-elim-chip__fb";
        ini.textContent = c.name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
        chip.append(ini);
      }
      const nm = document.createElement("span");
      nm.textContent = c.name;
      chip.append(nm);
      chips.append(chip);
    }
    sub.append(chips);
    section.append(sub);
  }
  root.append(section);
}

function renderStatsComparisons(root, stats) {
  const section = document.createElement("div");
  section.className = "ms-section";
  const h = document.createElement("h3");
  h.className = "ms-section__title";
  h.textContent = "Compared to the others";
  section.append(h);

  const c = stats.comparisons;
  const medals = { 1: "\uD83E\uDD47", 2: "\uD83E\uDD48", 3: "\uD83E\uDD49", 4: "\uD83D\uDE43" };
  const flavor = { 1: "", 2: "", 3: "", 4: " last place on" };
  const items = [
    { stat: "hit rate", rank: c.hitRateRank },
    { stat: "total points", rank: c.totalPointsRank },
    { stat: "biggest win", rank: c.biggestWinRank },
    { stat: "current streak", rank: c.streakRank },
    { stat: "correct eliminations", rank: c.eliminationRank },
  ];
  const list = document.createElement("div");
  list.className = "ms-compare-list";
  for (const item of items) {
    const chip = document.createElement("span");
    chip.className = "ms-compare-chip ms-compare-chip--r" + item.rank;
    chip.textContent = `${medals[item.rank] || ""} ${item.rank === 4 ? "last place on" : ordinalShort(item.rank) + " on"} ${item.stat}`;
    list.append(chip);
  }
  section.append(list);
  root.append(section);
}

function ordinalShort(n) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function renderLeaderboard() {
  const epTotals = totalPointsAllEpisodes();
  const sPts = seasonBetPoints();
  const streaks = getStreaks();
  const totals = epTotals.map((v, i) => v + sPts[i] + (streaks[i]?.bonusPointsEarned || 0));
  const root = document.getElementById("leaderboard");
  root.innerHTML = "";

  const latestOpen = [...state.episodes].reverse().find((ep) => !isEpisodeClosed(ep));
  const statusEp = latestOpen || state.episodes[state.episodes.length - 1];
  if (statusEp) ensureEpisodeMaps(statusEp.id);

  const hint = document.getElementById("lb-bet-status-hint");
  if (hint) {
    if (statusEp) {
      const epIdx = state.episodes.indexOf(statusEp);
      hint.textContent = `Bet status for ${episodeTabLabel(epIdx)}${isEpisodeClosed(statusEp) ? " (closed)" : ""}`;
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  const elimCorrect = PLAYER_NAMES.map(() => 0);
  for (const ep of state.episodes) {
    ensureEpisodeMaps(ep.id);
    ensureEliminatedArray(ep);
    const elimSet = new Set(ep.eliminated);
    for (let p = 0; p < PLAYER_COUNT; p++) {
      const pick = state.eliminationBets[ep.id]?.[p];
      if (pick && elimSet.has(pick)) elimCorrect[p]++;
    }
  }

  const maxSeason = seasonBetMaxPoints();
  const order = totals
    .map((pts, i) => ({ i, pts }))
    .sort((a, b) => b.pts - a.pts);
  order.forEach(({ i, pts }) => {
    const row = document.createElement("div");
    row.className = "lb-row";
    const name = document.createElement("span");
    name.className = "lb-row__name";
    name.textContent = PLAYER_NAMES[i];
    const val = document.createElement("span");
    val.className = "lb-row__pts";
    val.textContent = `${pts.toFixed(2)} pts`;
    const elim = document.createElement("span");
    elim.className = "lb-row__elim";
    elim.title = "Correct elimination guesses";
    elim.textContent = `\uD83C\uDF39 ${elimCorrect[i]}`;
    const seasonCol = document.createElement("span");
    seasonCol.className = "lb-row__season";
    seasonCol.title = "Season bet points (earned / max)";
    seasonCol.textContent = `\uD83C\uDFC6 ${sPts[i]}/${maxSeason}`;

    row.append(name, val, elim, seasonCol);

    const st = streaks[i] || { currentStreak: 0, longestStreak: 0, bonusPointsEarned: 0 };
    if (st.currentStreak > 0) {
      const nextM = STREAK_MILESTONES.find((m) => m.at > st.currentStreak);
      const fire = document.createElement("span");
      fire.className = "lb-row__streak" + (st.currentStreak >= 3 ? " lb-row__streak--hot" : "");
      fire.textContent = `\uD83D\uDD25 ${st.currentStreak}`;
      fire.title = `${st.currentStreak} episode${st.currentStreak > 1 ? "r" : ""} i tr\u00E6k med korrekt bet` +
        (nextM ? `. ${nextM.at - st.currentStreak} fra +${nextM.bonus} bonus.` : ". Max milestone n\u00E5et!");
      row.append(fire);
    }

    if (statusEp) {
      const picks = (state.bets[statusEp.id][i] || []).filter(Boolean);
      const hasBets = picks.length > 0;
      const badge = document.createElement("span");
      badge.className = "lb-row__bet-status" + (hasBets ? " lb-row__bet-status--done" : " lb-row__bet-status--missing");
      badge.textContent = hasBets ? "\u2713" : "No bets";
      row.append(badge);
    }
    root.append(row);
  });

  const longestOverall = streaks.length ? Math.max(...streaks.map((s) => s?.longestStreak || 0)) : 0;
  if (longestOverall > 0) {
    const longestEl = document.createElement("p");
    longestEl.className = "lb-longest-streak";
    const who = PLAYER_NAMES.filter((_, i) => (streaks[i]?.longestStreak || 0) === longestOverall).join(", ");
    longestEl.textContent = `Longest streak: ${longestOverall} (${who})`;
    root.append(longestEl);
  }

  renderOverviewPanels();
  renderAllBetsOverview();
}

function renderAllBetsOverview() {
  const root = document.getElementById("overview-all-bets");
  if (!root) return;
  root.innerHTML = "";

  if (!state.episodes.length) {
    const p = document.createElement("p");
    p.className = "panel__hint";
    p.style.margin = "0";
    p.textContent = "No episodes yet.";
    root.append(p);
    return;
  }

  let hasBets = false;
  const epCount = state.episodes.length;

  for (let epIdx = 0; epIdx < epCount; epIdx++) {
    const ep = state.episodes[epIdx];
    ensureEpisodeMaps(ep.id);
    const closed = isEpisodeClosed(ep);
    const elimOdds = eliminationOdds(ep);
    const outcomes = (state.occurred || {})[ep.id] || [];

    const playerRows = [];
    for (let p = 0; p < PLAYER_COUNT; p++) {
      const picks = (state.bets[ep.id][p] || []).filter(Boolean);
      const elimPick = state.eliminationBets[ep.id]?.[p] || "";
      if (!picks.length && !elimPick) continue;
      playerRows.push({ p, picks, elimPick });
    }
    if (!playerRows.length) continue;
    hasBets = true;

    const isLatest = epIdx === epCount - 1;

    const details = document.createElement("details");
    details.className = "ov-bets-episode";
    if (isLatest) details.open = true;

    const summary = document.createElement("summary");
    summary.className = "ov-bets-episode__summary";

    const titleText = ep.name || `Episode ${epIdx + 1}`;
    const totalBets = playerRows.reduce((s, r) => s + r.picks.length + (r.elimPick ? 1 : 0), 0);
    const playersActive = playerRows.length;

    summary.innerHTML = "";
    const titleSpan = document.createElement("span");
    titleSpan.className = "ov-bets-episode__title";
    titleSpan.textContent = titleText;
    summary.append(titleSpan);

    if (closed) {
      const badge = document.createElement("span");
      badge.className = "ov-bets-episode__closed";
      badge.textContent = "closed";
      summary.append(badge);
    }

    const meta = document.createElement("span");
    meta.className = "ov-bets-episode__meta";
    meta.textContent = `${playersActive} player${playersActive !== 1 ? "s" : ""} \u00B7 ${totalBets} bet${totalBets !== 1 ? "s" : ""}`;
    summary.append(meta);

    details.append(summary);

    const body = document.createElement("div");
    body.className = "ov-bets-episode__body";

    for (const { p, picks, elimPick } of playerRows) {
      const playerSection = document.createElement("div");
      playerSection.className = "ov-bets-player";
      const playerName = document.createElement("span");
      playerName.className = "ov-bets-player__name";
      playerName.textContent = PLAYER_NAMES[p];
      playerSection.append(playerName);

      const betList = document.createElement("div");
      betList.className = "ov-bets-list";

      for (const eventId of picks) {
        const ev = (ep.events || []).find((e) => e.id === eventId);
        if (!ev) continue;
        const row = document.createElement("div");
        row.className = "ov-bet-row";

        const label = document.createElement("span");
        label.className = "ov-bet-row__label";
        label.textContent = ev.text;

        const oddsLabel = document.createElement("span");
        oddsLabel.className = "ov-bet-row__odds";
        oddsLabel.textContent = `${Number(ev.odds).toFixed(1)}\u00D7`;

        if (closed && outcomes.includes(eventId)) {
          row.classList.add("ov-bet-row--hit");
        }

        row.append(label, oddsLabel);
        betList.append(row);
      }

      if (elimPick) {
        const row = document.createElement("div");
        row.className = "ov-bet-row ov-bet-row--elim";

        const guyName = (ep.guys || []).find((g) => g.id === elimPick || g.name === elimPick);
        const label = document.createElement("span");
        label.className = "ov-bet-row__label";
        label.textContent = guyName ? guyName.name : elimPick;

        const oddsLabel = document.createElement("span");
        oddsLabel.className = "ov-bet-row__odds ov-bet-row__odds--elim";
        oddsLabel.textContent = `${elimOdds.toFixed(1)}\u00D7`;

        const tag = document.createElement("span");
        tag.className = "ov-bet-row__tag";
        tag.textContent = "elimination";

        const eliminated = (state.episodes[epIdx]?.eliminated || []);
        if (closed && eliminated.includes(elimPick)) {
          row.classList.add("ov-bet-row--hit");
        }

        row.append(tag, label, oddsLabel);
        betList.append(row);
      }

      playerSection.append(betList);
      body.append(playerSection);
    }

    details.append(body);
    root.append(details);
  }

  if (!hasBets) {
    const p = document.createElement("p");
    p.className = "panel__hint";
    p.style.margin = "0";
    p.textContent = "No bets placed yet. Go to an episode to start betting!";
    root.append(p);
  }
}

function renderEpisodeContent() {
  const ep = activeEpisode();
  const workspace = document.getElementById("episode-workspace");
  const closed = ep ? isEpisodeClosed(ep) : false;
  const betsLocked = ep ? isEpisodeBetsLocked(ep) : false;
  if (workspace) {
    workspace.classList.toggle("episode--closed", closed);
  }
  const addGuySection = document.querySelector("#episode-workspace .inline-actions");
  const addEventSection = document.querySelector("#episode-workspace .add-event");
  if (addGuySection) addGuySection.hidden = closed;
  if (addEventSection) addEventSection.hidden = closed;

  const lockBanner = document.getElementById("episode-lock-banner");
  if (lockBanner) lockBanner.hidden = !closed;

  const betsLockBanner = document.getElementById("bets-lock-banner");
  const betsLockText = document.getElementById("bets-lock-banner-text");
  if (betsLockBanner) {
    const showBetsLock = ep?.betsLocked && !closed;
    betsLockBanner.hidden = !showBetsLock;
    if (showBetsLock && betsLockText) {
      betsLockText.textContent = "Bets er l\u00E5st. Events og resultater kan stadig redigeres.";
    }
  }

  const deadlineEl = document.getElementById("deadline-display");
  if (deadlineEl && ep) {
    if (ep.betsLockDeadline && !closed) {
      deadlineEl.hidden = false;
      renderDeadlineDisplay(deadlineEl, ep);
    } else {
      deadlineEl.hidden = true;
    }
  } else if (deadlineEl) {
    deadlineEl.hidden = true;
  }

  const closeBtn = document.getElementById("close-episode");
  const reopenBtn = document.getElementById("reopen-episode");
  const lockBetsBtn = document.getElementById("lock-bets");
  const unlockBetsBtn = document.getElementById("unlock-bets");
  if (closeBtn) closeBtn.hidden = closed;
  if (reopenBtn) reopenBtn.hidden = !closed;
  if (lockBetsBtn) lockBetsBtn.hidden = closed || betsLocked;
  if (unlockBetsBtn) unlockBetsBtn.hidden = closed || !ep?.betsLocked;

  const airDateBar = document.getElementById("episode-airdate-bar");
  if (airDateBar && ep) {
    airDateBar.hidden = closed;
    airDateBar.innerHTML = "";
    if (!closed) {
      const label = document.createElement("span");
      label.className = "episode-airdate-bar__label";
      label.textContent = "Air date:";
      const input = document.createElement("input");
      input.type = "date";
      input.className = "input input--narrow episode-airdate-bar__input";
      input.value = ep.airDate || "";
      input.addEventListener("change", () => {
        ep.airDate = input.value || null;
        ep.betsLockDeadline = ep.airDate ? copenhagenMidnight(ep.airDate) : null;
        delete ep.hasElimination;
        saveState();
        renderEpisodeContent();
        renderMainTabs();
      });

      const elimLabel = document.createElement("label");
      elimLabel.className = "episode-airdate-bar__elim-toggle";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = isEliminationEpisode(ep);
      cb.addEventListener("change", () => {
        ep.hasElimination = cb.checked;
        saveState();
        renderEpisodeContent();
      });
      elimLabel.append(cb, document.createTextNode(" Roseceremoni"));
      airDateBar.append(label, input, elimLabel);
    }
  } else if (airDateBar) {
    airDateBar.hidden = true;
  }

  const hasElim = ep ? isEliminationEpisode(ep) : true;
  const elimBetsSection = document.querySelector('#episode-workspace [aria-labelledby="elim-bets-heading"]');
  const elimResultsSection = document.querySelector('#episode-workspace [aria-labelledby="elim-results-heading"]');
  if (elimBetsSection) elimBetsSection.hidden = !hasElim;
  if (elimResultsSection) elimResultsSection.hidden = !hasElim;

  const safe = (fn, label) => { try { fn(); } catch (e) { console.error(label + ":", e); } };
  safe(renderGuys, "renderGuys");
  safe(renderEvents, "renderEvents");
  safe(renderBets, "renderBets");
  if (hasElim) safe(renderEliminationBets, "renderEliminationBets");
  safe(renderResults, "renderResults");
  safe(renderEliminations, "renderEliminations");
  safe(renderEpisodeScoreSummary, "renderEpisodeScoreSummary");
}

function renderDeadlineDisplay(el, ep) {
  const now = Date.now();
  const dl = ep.betsLockDeadline;
  if (ep.betsLocked) {
    el.className = "deadline-display deadline-display--locked";
    el.textContent = "\uD83D\uDD12 L\u00E5st" + (ep.betsLockedAt ? " \u00B7 " + formatDeadlineTime(ep.betsLockedAt) : "");
  } else if (now >= dl) {
    el.className = "deadline-display deadline-display--warn";
    el.textContent = "\u23F3 Auto-l\u00E5ser nu\u2026";
  } else {
    const diff = dl - now;
    const isWarn = diff < 6 * 3600000;
    el.className = "deadline-display" + (isWarn ? " deadline-display--warn" : "");
    el.textContent = "\u23F0 Bets l\u00E5ses " + formatDeadlineTime(dl) + " (\u2248 " + formatCountdown(dl) + ")";
  }
}

function guysAfterEliminations(ep) {
  if (!Array.isArray(ep.guys)) ep.guys = [];
  ensureEliminatedArray(ep);
  const elimSet = new Set(ep.eliminated);
  return ep.guys.filter((g) => !elimSet.has(g.name));
}

function wireActions() {
  document.getElementById("cast-add-btn")?.addEventListener("click", () => {
    const nameEl = document.getElementById("cast-add-name");
    const photoEl = document.getElementById("cast-add-photo");
    const name = nameEl.value.trim();
    if (!name) return;
    const photo = photoEl.value.trim();
    ensureInCast(name, photo);
    nameEl.value = "";
    photoEl.value = "";
    saveState();
    renderOverview();
  });

  document.getElementById("bank-event-search")?.addEventListener("input", () => {
    renderEventBank();
  });
  document.getElementById("bank-category-filter")?.addEventListener("change", () => {
    renderEventBank();
  });
  document.getElementById("bank-target-episode")?.addEventListener("change", () => {
    renderEventBank();
  });
  document.getElementById("add-custom-bank-event")?.addEventListener("click", () => {
    const textEl = document.getElementById("custom-bank-text");
    const oddsEl = document.getElementById("custom-bank-odds");
    const catEl = document.getElementById("custom-bank-category");
    const phaseEl = document.getElementById("custom-bank-phase");
    const text = (textEl?.value ?? "").trim();
    let odds = Number.parseFloat(oddsEl?.value);
    const category = catEl?.value || "_custom";
    const phase = phaseEl?.value || "any";
    if (!text) { alert("Enter a bet description."); return; }
    if (Number.isNaN(odds) || odds < 1.1) odds = 2.0;
    const dupe = masterBetEvents().some((e) => e.text.trim().toLowerCase() === text.toLowerCase());
    if (dupe) { alert("That bet already exists in the bank."); return; }
    state.customBankEvents.push({ text, odds, category, phase });
    saveState();
    textEl.value = "";
    oddsEl.value = "2.0";
    if (phaseEl) phaseEl.value = "any";
    populateMasterEventDatalist();
    renderEventBank();
  });

  const addEpToggle = document.getElementById("add-episode-toggle");
  const addEpModal = document.getElementById("add-episode-modal");
  const addEpAirdate = document.getElementById("new-ep-airdate");

  addEpToggle?.addEventListener("click", () => {
    addEpAirdate.value = suggestNextAirDate();
    addEpModal.hidden = false;
  });

  document.getElementById("add-episode-cancel")?.addEventListener("click", () => {
    addEpModal.hidden = true;
  });

  addEpModal?.addEventListener("click", (e) => {
    if (e.target === addEpModal) addEpModal.hidden = true;
  });

  document.getElementById("add-episode")?.addEventListener("click", () => {
    const n = state.episodes.length + 1;
    const prevEp = state.episodes.length > 0 ? state.episodes[state.episodes.length - 1] : null;
    const carryGuys = prevEp ? guysAfterEliminations(prevEp).map((g) => ({ id: uid(), name: g.name })) : [];

    const airDate = addEpAirdate?.value || null;
    const betsLockDeadline = airDate ? copenhagenMidnight(airDate) : null;

    const newEp = {
      id: uid(),
      title: `Episode ${n}`,
      guys: carryGuys,
      events: [],
      eliminated: [],
      betsLocked: false,
      betsLockedAt: null,
      betsLockDeadline,
      airDate,
    };
    state.episodes.push(newEp);
    state.activeTab = newEp.id;
    addEpModal.hidden = true;
    saveState();
    const safe = (fn, label) => { try { fn(); } catch (e) { console.error(label + ":", e); } };
    safe(renderMainTabs, "renderMainTabs");
    safe(updateViewVisibility, "updateViewVisibility");
    safe(renderEpisodeContent, "renderEpisodeContent");
    safe(renderLeaderboard, "renderLeaderboard");
    safe(renderEventBank, "renderEventBank");
  });

  document.getElementById("add-guy")?.addEventListener("click", () => {
    const ep = activeEpisode();
    const input = document.getElementById("new-guy-name");
    const photoInput = document.getElementById("new-guy-photo");
    const name = input.value.trim();
    const photo = photoInput?.value.trim() || "";
    if (!ep || !name) return;
    if (!Array.isArray(ep.guys)) ep.guys = [];
    ep.guys.push({ id: uid(), name });
    ensureInCast(name, photo);
    input.value = "";
    if (photoInput) photoInput.value = "";
    saveState();
    renderGuys();
    renderEliminationBets();
    renderEliminations();
    renderLeaderboard();
  });

  const newEventText = document.getElementById("new-event-text");
  const newEventOdds = document.getElementById("new-event-odds");
  function syncOddsFromBankIfMatch() {
    const t = newEventText.value.trim();
    const m = masterBetEvents().find((e) => e.text === t);
    if (m) newEventOdds.value = String(m.odds);
  }
  newEventText?.addEventListener("change", syncOddsFromBankIfMatch);
  newEventText?.addEventListener("input", syncOddsFromBankIfMatch);

  document.getElementById("add-event")?.addEventListener("click", () => {
    const ep = activeEpisode();
    if (!ep || isEpisodeClosed(ep)) return;
    const textEl = document.getElementById("new-event-text");
    const oddsEl = document.getElementById("new-event-odds");
    const text = (textEl?.value || "").trim();
    let odds = Number.parseFloat(oddsEl?.value);
    if (!text) { showToast("Skriv en event-tekst f\u00F8rst."); return; }
    if (Number.isNaN(odds) || odds < 1.1) odds = 2.0;
    if (!Array.isArray(ep.events)) ep.events = [];
    ep.events.push({ id: uid(), text, odds });
    if (textEl) textEl.value = "";
    saveState();
    const safe = (fn, label) => { try { fn(); } catch (e) { console.error(label + ":", e); } };
    safe(renderEvents, "renderEvents");
    safe(renderBets, "renderBets");
    safe(renderResults, "renderResults");
    safe(renderEpisodeScoreSummary, "renderEpisodeScoreSummary");
    safe(renderLeaderboard, "renderLeaderboard");
  });

  function handleReset() {
    if (
      !confirm(
        "Clear all saved episodes, bets, and scores? This cannot be undone."
      )
    )
      return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    saveState();
    renderMainTabs();
    updateViewVisibility();
    renderOverview();
    if (activeEpisode()) renderEpisodeContent();
    renderLeaderboard();
    renderEventBank();
  }
  document.getElementById("reset-data")?.addEventListener("click", handleReset);

  document.getElementById("lock-bets")?.addEventListener("click", () => {
    const ep = activeEpisode();
    if (!ep) return;
    if (!confirm("Lock bets for this episode? Players won\u2019t be able to change their picks until unlocked.")) return;
    ep.betsLocked = true;
    ep.betsLockedAt = Date.now();
    saveState();
    renderMainTabs();
    renderEpisodeContent();
    updateViewVisibility();
  });

  document.getElementById("unlock-bets")?.addEventListener("click", () => {
    const ep = activeEpisode();
    if (!ep) return;
    if (!confirm("Unlock bets? Players will be able to change their picks again.")) return;
    ep.betsLocked = false;
    saveState();
    renderMainTabs();
    renderEpisodeContent();
    updateViewVisibility();
  });

  document.getElementById("close-episode")?.addEventListener("click", () => {
    const ep = activeEpisode();
    if (!ep) return;
    ep.closed = true;
    if (!ep.betsLocked) {
      ep.betsLocked = true;
      ep.betsLockedAt = Date.now();
    }
    saveState();
    renderMainTabs();
    renderEpisodeContent();
    updateViewVisibility();
  });

  document.getElementById("reopen-episode")?.addEventListener("click", () => {
    const ep = activeEpisode();
    if (!ep) return;
    if (!confirm("Reopen this episode? Be careful not to change finalized data by accident.")) return;
    ep.closed = false;
    ep.betsLocked = false;
    saveState();
    renderMainTabs();
    renderEpisodeContent();
    updateViewVisibility();
  });

  document.getElementById("delete-episode")?.addEventListener("click", deleteActiveEpisode);
}

function populateCustomCategorySelect() {
  const sel = document.getElementById("custom-bank-category");
  if (!sel) return;
  sel.innerHTML = "";
  betCategories().forEach((c) => {
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.label;
    sel.append(o);
  });
  const custom = document.createElement("option");
  custom.value = "_custom";
  custom.textContent = "Custom / other";
  sel.append(custom);
  sel.value = "_custom";
}

/* ── Weekly recap renderer ── */
const SEEN_RECAPS_KEY = "bachelorette-seen-weekly-recaps";

function getSeenRecaps() {
  try { return JSON.parse(localStorage.getItem(SEEN_RECAPS_KEY) || "{}"); } catch { return {}; }
}

function markRecapSeen(weekId) {
  const seen = getSeenRecaps();
  seen[weekId] = true;
  localStorage.setItem(SEEN_RECAPS_KEY, JSON.stringify(seen));
}

function generateRecapMarkdown(recap) {
  const RANK_ICONS = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49", "4."];
  let md = `\uD83D\uDCFA Uge ${recap.weekNum} opsummering (${recap.dateRange})\n\n`;
  recap.scoreboard.forEach((s, idx) => {
    md += `${RANK_ICONS[idx]} ${PLAYER_NAMES[s.playerIndex]} \u2014 ${formatDanishNumber(s.weekPoints)} point denne uge\n`;
  });
  md += "\n";
  if (recap.highlights.biggestPayout) {
    const h = recap.highlights.biggestPayout;
    md += `\uD83D\uDCB0 Ugens gevinst: ${h.player} ramte '${h.text}' til ${formatDanishNumber(h.odds)}x (${h.day})\n`;
  }
  if (recap.highlights.biggestWhiff) {
    const h = recap.highlights.biggestWhiff;
    md += `\uD83E\uDD21 Ugens fiasko: ${h.player} satsede p\u00E5 '${h.text}' til ${formatDanishNumber(h.odds)}x (${h.day}). Det skete ikke.\n`;
  }
  if (recap.eliminations.length) {
    const names = recap.eliminations.map((e) => e.contestantName).join(" og ");
    const callers = recap.eliminations.flatMap((e) => e.calledBy.map((i) => PLAYER_NAMES[i]));
    const unique = [...new Set(callers)];
    if (unique.length) {
      md += `\uD83C\uDFAF Eliminering: ${names} r\u00F8g ud. ${unique.join(" og ")} ramte plet!\n`;
    } else {
      md += `\uD83C\uDFAF Eliminering: ${names} r\u00F8g ud. Ingen s\u00E5 det komme.\n`;
    }
  }
  md += "\n\uD83C\uDFC6 S\u00E6sonen indtil nu:\n";
  recap.seasonStandings.forEach((s) => {
    const name = PLAYER_NAMES[s.playerIndex];
    const rc = s.rankChange || "\u2192";
    md += `  ${name} (${formatDanishNumber(s.totalPoints)} point) ${rc}\n`;
  });
  md += `\nBejlere tilbage: ${recap.nextWeek.contestantsRemaining}`;
  return md.trim();
}

function renderWeeklyRecap() {
  const root = document.getElementById("weekly-recap-cards");
  const progress = document.getElementById("weekly-recap-progress");
  if (!root) return;
  root.innerHTML = "";
  if (progress) progress.innerHTML = "";

  const allWeeks = getAllWeekIds();
  const RANK_ICONS = ["\uD83E\uDD47", "\uD83E\uDD48", "\uD83E\uDD49", ""];

  const currentWeek = allWeeks.find((wid) => !isWeekComplete(wid));
  if (currentWeek && progress) {
    const eps = getEpisodesForWeek(currentWeek);
    const closedCount = eps.filter((ep) => isEpisodeClosed(ep)).length;
    const strip = document.createElement("div");
    strip.className = "weekly-recap-progress__strip";
    strip.textContent = `Uge i gang: ${closedCount} af ${eps.length} episoder lukket`;
    progress.append(strip);
  }

  const completeWeeks = allWeeks.filter((wid) => isWeekComplete(wid));
  if (!completeWeeks.length) {
    const empty = document.createElement("p");
    empty.className = "panel__hint";
    empty.textContent = "Ingen f\u00E6rdige uger endnu. Luk alle episoder i en uge for at se opsummeringen.";
    root.append(empty);
    return;
  }

  const seen = getSeenRecaps();
  for (let wi = 0; wi < completeWeeks.length; wi++) {
    const weekId = completeWeeks[wi];
    const recap = computeWeeklyRecap(weekId);
    if (!recap) continue;

    if (!seen[weekId]) markRecapSeen(weekId);

    const isNewest = wi === 0;
    const card = document.createElement("article");
    card.className = "recap-card" + (isNewest ? "" : " recap-card--collapsed");

    // ── Header ──
    const header = document.createElement("header");
    header.className = "recap-card__header";
    const title = document.createElement("h3");
    title.className = "recap-card__title";
    title.textContent = recap.weekLabel;
    if (!isNewest) {
      const chevron = document.createElement("span");
      chevron.className = "recap-card__chevron";
      chevron.textContent = "\u25B6";
      title.prepend(chevron);
    }
    header.style.cursor = "pointer";
    header.addEventListener("click", (e) => {
      if (e.target.closest(".recap-card__copy")) return;
      card.classList.toggle("recap-card--collapsed");
    });
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn--ghost recap-card__copy";
    copyBtn.textContent = "Kopier ugens opsummering";
    copyBtn.addEventListener("click", () => {
      const md = generateRecapMarkdown(recap);
      navigator.clipboard.writeText(md).then(() => showToast("Kopieret!")).catch(() => showToast("Kunne ikke kopiere"));
    });
    header.append(title, copyBtn);
    card.append(header);

    const cardBody = document.createElement("div");
    cardBody.className = "recap-card__body";

    // ── Section A: Scoreboard ──
    const sbSection = document.createElement("section");
    sbSection.className = "recap-section";
    const sbTitle = document.createElement("h4");
    sbTitle.className = "recap-section__title";
    sbTitle.textContent = "Ugens stilling";
    sbSection.append(sbTitle);
    recap.scoreboard.forEach((s, idx) => {
      const row = document.createElement("div");
      row.className = "recap-sb-row" + (idx === 0 ? " recap-sb-row--winner" : "");
      const rank = document.createElement("span");
      rank.className = "recap-sb-row__rank";
      rank.textContent = RANK_ICONS[idx] || `${s.rank}.`;
      const name = document.createElement("span");
      name.className = "recap-sb-row__name";
      name.textContent = PLAYER_NAMES[s.playerIndex];
      const pts = document.createElement("span");
      pts.className = "recap-sb-row__pts";
      pts.textContent = `${formatDanishNumber(s.weekPoints)} point`;
      row.append(rank, name, pts);
      if (s.bestEpisodeDay && s.bestEpisodePts > 0) {
        const best = document.createElement("span");
        best.className = "recap-sb-row__best";
        best.textContent = `Bedste aften: ${s.bestEpisodeDay}, ${formatDanishNumber(s.bestEpisodePts)} point`;
        row.append(best);
      }
      sbSection.append(row);
    });
    cardBody.append(sbSection);

    // ── Section B: Highlights ──
    const hl = recap.highlights;
    const hlItems = [];
    if (hl.biggestPayout) {
      hlItems.push({
        icon: "\uD83D\uDCB0",
        title: "Ugens st\u00F8rste gevinst",
        text: `${hl.biggestPayout.player} ramte '${hl.biggestPayout.text}' til ${formatDanishNumber(hl.biggestPayout.odds)}x (${hl.biggestPayout.day})`,
        accent: "gold",
      });
    }
    if (hl.biggestWhiff) {
      hlItems.push({
        icon: "\uD83E\uDD21",
        title: "Ugens st\u00F8rste fiasko",
        text: `${hl.biggestWhiff.player} satsede p\u00E5 '${hl.biggestWhiff.text}' til ${formatDanishNumber(hl.biggestWhiff.odds)}x (${hl.biggestWhiff.day}). Det skete ikke.`,
        accent: "coral",
      });
    }
    if (hl.hotStreak) {
      hlItems.push({
        icon: "\uD83D\uDCC8",
        title: "Hot streak",
        text: `${hl.hotStreak.player} er p\u00E5 en ${hl.hotStreak.count}-episoders stime \uD83D\uDD25`,
        accent: "purple",
      });
    }
    if (hl.mostPlayedEvent) {
      const mp = hl.mostPlayedEvent;
      const verb = mp.hit ? "Det skete!" : "Det skete ikke.";
      hlItems.push({
        icon: "\uD83C\uDFAD",
        title: "Ugens mest spillede event",
        text: `${mp.count} af jer satsede p\u00E5 '${mp.text}'. ${verb}`,
        accent: mp.hit ? "gold" : "coral",
      });
    }
    if (hlItems.length) {
      const hlSection = document.createElement("section");
      hlSection.className = "recap-section";
      const hlTitle = document.createElement("h4");
      hlTitle.className = "recap-section__title";
      hlTitle.textContent = "Ugens h\u00F8jdepunkter";
      hlSection.append(hlTitle);
      const hlGrid = document.createElement("div");
      hlGrid.className = "recap-highlights";
      for (const item of hlItems) {
        const hlCard = document.createElement("div");
        hlCard.className = `recap-hl-card recap-hl-card--${item.accent}`;
        const hlIcon = document.createElement("span");
        hlIcon.className = "recap-hl-card__icon";
        hlIcon.textContent = item.icon;
        const hlBody = document.createElement("div");
        hlBody.className = "recap-hl-card__body";
        const hlH = document.createElement("strong");
        hlH.className = "recap-hl-card__title";
        hlH.textContent = item.title;
        const hlP = document.createElement("p");
        hlP.className = "recap-hl-card__text";
        hlP.textContent = item.text;
        hlBody.append(hlH, hlP);
        hlCard.append(hlIcon, hlBody);
        hlGrid.append(hlCard);
      }
      hlSection.append(hlGrid);
      cardBody.append(hlSection);
    }

    // ── Section D: Rose ceremony ──
    if (recap.eliminations.length || recap.highlights.eliminationCallText === "Ingen elimineringer denne uge") {
      const roseSection = document.createElement("section");
      roseSection.className = "recap-section recap-section--ceremony";
      const roseTitle = document.createElement("h4");
      roseTitle.className = "recap-section__title";
      roseTitle.textContent = "\uD83C\uDF39 Torsdagens roseceremoni";
      roseSection.append(roseTitle);
      if (!recap.eliminations.length) {
        const p = document.createElement("p");
        p.className = "recap-section__note";
        p.textContent = "Ingen elimineringer denne uge";
        roseSection.append(p);
      } else {
        const photoRow = document.createElement("div");
        photoRow.className = "recap-elim-photos";
        for (const el of recap.eliminations) {
          const wrap = document.createElement("div");
          wrap.className = "recap-elim-person";
          if (el.photoUrl) {
            const img = document.createElement("img");
            img.className = "recap-elim-person__photo";
            img.src = el.photoUrl;
            img.alt = el.contestantName;
            img.loading = "lazy";
            photoFallback(img, el.contestantName);
            wrap.append(img);
          }
          const textWrap = document.createElement("div");
          textWrap.className = "recap-elim-person__text";
          const name = document.createElement("span");
          name.className = "recap-elim-person__name";
          name.textContent = el.contestantName;
          textWrap.append(name);
          if (el.calledBy.length) {
            const callers = document.createElement("span");
            callers.className = "recap-elim-person__callers";
            callers.textContent = el.calledBy.map((i) => `\u2713 ${PLAYER_NAMES[i]}`).join(", ");
            textWrap.append(callers);
          }
          wrap.append(textWrap);
          photoRow.append(wrap);
        }
        if (recap.highlights.eliminationCallText) {
          const roseRow = document.createElement("div");
          roseRow.className = "recap-ceremony-row";
          const callNote = document.createElement("p");
          callNote.className = "recap-section__note recap-section__note--call";
          callNote.textContent = recap.highlights.eliminationCallText;
          roseRow.append(photoRow, callNote);
          roseSection.append(roseRow);
        } else {
          roseSection.append(photoRow);
        }
      }
      cardBody.append(roseSection);
    }

    // ── Section E: Season standings ──
    const standSection = document.createElement("section");
    standSection.className = "recap-section";
    const standTitle = document.createElement("h4");
    standTitle.className = "recap-section__title";
    standTitle.textContent = "S\u00E6sonstilling";
    standSection.append(standTitle);
    for (const s of recap.seasonStandings) {
      const row = document.createElement("div");
      row.className = "recap-stand-row";
      const rankEl = document.createElement("span");
      rankEl.className = "recap-stand-row__rank";
      rankEl.textContent = `${s.rank}.`;
      const nameEl = document.createElement("span");
      nameEl.className = "recap-stand-row__name";
      nameEl.textContent = PLAYER_NAMES[s.playerIndex];
      const ptsEl = document.createElement("span");
      ptsEl.className = "recap-stand-row__pts";
      ptsEl.textContent = `${formatDanishNumber(s.totalPoints)} point`;
      const weekGain = document.createElement("span");
      weekGain.className = "recap-stand-row__gain";
      weekGain.textContent = `+${formatDanishNumber(s.weekPointsGained)} denne uge`;
      row.append(rankEl, nameEl, ptsEl, weekGain);
      if (s.rankChange) {
        const rc = document.createElement("span");
        rc.className = "recap-stand-row__change" +
          (s.rankChange.startsWith("\u2191") ? " recap-stand-row__change--up" :
           s.rankChange.startsWith("\u2193") ? " recap-stand-row__change--down" : "");
        rc.textContent = s.rankChange;
        row.append(rc);
      }
      if (s.streakCount > 0) {
        const streak = document.createElement("span");
        streak.className = "recap-stand-row__streak";
        streak.textContent = `\uD83D\uDD25 ${s.streakCount}`;
        row.append(streak);
      }
      if (s.distanceToFirst > 0) {
        const dist = document.createElement("span");
        dist.className = "recap-stand-row__dist";
        dist.textContent = `${formatDanishNumber(s.distanceToFirst)} point bagud`;
        row.append(dist);
      }
      standSection.append(row);
    }
    const remaining = document.createElement("p");
    remaining.className = "recap-section__note";
    remaining.textContent = `Bejlere tilbage: ${recap.nextWeek.contestantsRemaining}`;
    standSection.append(remaining);
    cardBody.append(standSection);

    card.append(cardBody);
    root.append(card);
  }
}

function checkNewRecapBanner() {
  const seen = getSeenRecaps();
  const allWeeks = getAllWeekIds();
  const unseen = allWeeks.find((wid) => isWeekComplete(wid) && !seen[wid]);
  if (unseen) {
    const allSorted = getAllWeekIds().slice().sort();
    const seasonWeekNum = allSorted.indexOf(unseen) + 1;
    const existing = document.getElementById("recap-ready-banner");
    if (existing) existing.remove();
    const banner = document.createElement("div");
    banner.id = "recap-ready-banner";
    banner.className = "recap-ready-banner";
    banner.innerHTML = `<span>\uD83D\uDCFA Uge ${seasonWeekNum} opsummering er klar</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--secondary recap-ready-banner__btn";
    btn.textContent = "Se opsummering";
    btn.addEventListener("click", () => {
      state.activeTab = WEEKLY_RECAP;
      saveState();
      renderMainTabs();
      updateViewVisibility();
      renderWeeklyRecap();
      banner.remove();
    });
    banner.append(btn);
    document.querySelector(".app")?.prepend(banner);
  }
}

function renderAll() {
  normalizeActiveTab();
  const safe = (fn, label) => { try { fn(); } catch (e) { console.error(label + ":", e); } };
  safe(renderMainTabs, "renderMainTabs");
  safe(updateViewVisibility, "updateViewVisibility");
  safe(renderOverview, "renderOverview");
  if (activeEpisode()) safe(renderEpisodeContent, "renderEpisodeContent");
  safe(renderLeaderboard, "renderLeaderboard");
  safe(renderSeasonBets, "renderSeasonBets");
  safe(populateMasterEventDatalist, "populateMasterEventDatalist");
  safe(populateCustomCategorySelect, "populateCustomCategorySelect");
  safe(renderEventBank, "renderEventBank");
  safe(renderWeeklyRecap, "renderWeeklyRecap");
  safe(renderMyStats, "renderMyStats");
  safe(renderUpcomingDeadlineStrip, "renderUpcomingDeadlineStrip");
  safe(checkNewRecapBanner, "checkNewRecapBanner");
}

const REMINDER_KEY = "bachelorette-deadline-reminder-dismissed";

function autoLockTick() {
  const now = Date.now();
  let changed = false;
  for (const ep of state.episodes) {
    if (shouldAutoLock(ep, now)) {
      ep.betsLocked = true;
      ep.betsLockedAt = now;
      changed = true;
      const idx = state.episodes.indexOf(ep);
      showToast("\uD83D\uDD12 Bets auto-l\u00E5st for " + episodeTabLabel(idx));
    }
  }
  if (changed) {
    saveState();
    try { renderAll(); } catch (e) { console.error("renderAll (autolock):", e); }
  }
}

function renderUpcomingDeadlineStrip() {
  const el = document.getElementById("upcoming-deadline-strip");
  if (!el) return;
  const now = Date.now();
  let soonest = null;
  let soonestIdx = -1;
  for (let i = 0; i < state.episodes.length; i++) {
    const ep = state.episodes[i];
    if (ep.betsLockDeadline && !ep.betsLocked && !ep.closed) {
      if (!soonest || ep.betsLockDeadline < soonest.betsLockDeadline) {
        soonest = ep;
        soonestIdx = i;
      }
    }
  }
  if (!soonest) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  const diff = soonest.betsLockDeadline - now;
  const isWarn = diff < 6 * 3600000;
  el.className = "upcoming-deadline-strip" + (isWarn ? " upcoming-deadline-strip--warn" : "");
  el.textContent = "\u23F0 N\u00E6ste lock: " + episodeTabLabel(soonestIdx) + " \u2014 " + formatCountdown(soonest.betsLockDeadline);
}

function checkDeadlineReminder() {
  const now = Date.now();
  for (const ep of state.episodes) {
    if (!ep.betsLockDeadline || ep.betsLocked || ep.closed) continue;
    const diff = ep.betsLockDeadline - now;
    if (diff > 0 && diff < 12 * 3600000) {
      const key = REMINDER_KEY + "-" + ep.id;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        const idx = state.episodes.indexOf(ep);
        showToast("\u23F0 Bets for " + episodeTabLabel(idx) + " l\u00E5ses om " + formatCountdown(ep.betsLockDeadline) + ". Har du valgt?");
      }
    }
  }
}

function refreshCountdowns() {
  const ep = activeEpisode();
  if (ep) {
    const deadlineEl = document.getElementById("deadline-display");
    if (deadlineEl && ep.betsLockDeadline && !ep.closed) {
      renderDeadlineDisplay(deadlineEl, ep);
    }
  }
  renderUpcomingDeadlineStrip();
}

let autoLockIntervalId = null;
let countdownIntervalId = null;

function init() {
  try { renderAll(); } catch (e) { console.error("renderAll failed:", e); }
  try { wireActions(); } catch (e) { console.error("wireActions failed:", e); }
  autoLockTick();
  checkDeadlineReminder();

  if (!autoLockIntervalId) autoLockIntervalId = setInterval(autoLockTick, 30000);
  if (!countdownIntervalId) countdownIntervalId = setInterval(refreshCountdowns, 60000);

  fbRef.on("value", (snapshot) => {
    const remote = snapshot.val();
    if (!remote) {
      if (!firebaseReady) {
        fbRef.set(sharedState()).catch(() => {});
        firebaseReady = true;
      }
      return;
    }
    firebaseReady = true;
    const localTab = state.activeTab;
    suppressFirebaseWrite = true;
    const merged = { ...defaultState(), ...remote, activeTab: localTab };
    if (!merged.bets || typeof merged.bets !== "object") merged.bets = {};
    if (!merged.occurred || typeof merged.occurred !== "object") merged.occurred = {};
    if (!Array.isArray(merged.customBankEvents)) merged.customBankEvents = [];
    if (!Array.isArray(merged.hiddenBankEvents)) merged.hiddenBankEvents = [];
    if (!merged.bankOddsOverrides || typeof merged.bankOddsOverrides !== "object") merged.bankOddsOverrides = {};
    if (!merged.bankTextOverrides || typeof merged.bankTextOverrides !== "object") merged.bankTextOverrides = {};
    if (!merged.bankPhaseOverrides || typeof merged.bankPhaseOverrides !== "object") merged.bankPhaseOverrides = {};
    if (!merged.eliminationBets || typeof merged.eliminationBets !== "object") merged.eliminationBets = {};
    if (!merged.seasonBets || typeof merged.seasonBets !== "object") merged.seasonBets = {};
    if (!merged.seasonResults || typeof merged.seasonResults !== "object") merged.seasonResults = {};
    if (typeof merged.seasonBetsLocked !== "boolean") merged.seasonBetsLocked = false;
    if (!merged.contestantNotes || typeof merged.contestantNotes !== "object") merged.contestantNotes = {};
    if (!Array.isArray(merged.customCast)) merged.customCast = [];
    if (!Array.isArray(merged.episodes)) merged.episodes = [];
    for (const ep of merged.episodes) {
      if (!Array.isArray(ep.events)) ep.events = [];
      if (!Array.isArray(ep.eliminated)) ep.eliminated = [];
      if (!Array.isArray(ep.guys)) ep.guys = [];
    }
    state = merged;
    normalizeActiveTab();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    try { renderAll(); } catch (e) { console.error("renderAll failed:", e); }
    suppressFirebaseWrite = false;
  });
}

init();
