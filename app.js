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
const ABOUT = "about";

const EXPECTED_SEASON_LENGTH = 15;

const LIKELIHOOD_PRESETS = [
  { id: "very-likely",  label: "Very likely",  odds: 1.5 },
  { id: "likely",       label: "Likely",       odds: 2.0 },
  { id: "coin-flip",    label: "Coin flip",    odds: 3.0 },
  { id: "unlikely",     label: "Unlikely",     odds: 5.0 },
  { id: "long-shot",    label: "Long shot",    odds: 8.0 },
];

function oddsToLikelihood(odds) {
  const v = Number(odds);
  if (v <= 1.7) return "very-likely";
  if (v <= 2.5) return "likely";
  if (v <= 3.9) return "coin-flip";
  if (v <= 6.5) return "unlikely";
  return "long-shot";
}

function likelihoodToOdds(id) {
  return LIKELIHOOD_PRESETS.find((p) => p.id === id)?.odds ?? 2.0;
}

const SEASON_BET_CATEGORIES = [
  { key: "mie-winner",             label: "Mies sidste rose",                 desc: "Hvem ender Mie med at v\u00E6lge?",                                                  points: 20, inputType: "contestant" },
  { key: "sofie-winner",           label: "Sofies sidste rose",               desc: "Hvem ender Sofie med at v\u00E6lge?",                                                points: 20, inputType: "contestant" },
  { key: "first-kiss",             label: "F\u00F8rste bejler til at kysse med en bachelorette", desc: "Navngiv den specifikke bejler.",                                  points: 12, inputType: "contestant" },
  { key: "episode-first-kiss",     label: "Hvilken uge sker f\u00F8rste kys?", desc: "V\u00E6lg ugenummer (1\u2013N). T\u00E6ttest p\u00E5 vinder.",             points: 12, inputType: "week" },
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
  return `Week ${index + 1}`;
}

function deleteActiveEpisode() {
  const ep = activeEpisode();
  if (!ep) return;
  const idx = state.episodes.findIndex((e) => e.id === ep.id);
  const label = episodeTabLabel(idx);
  if (
    !confirm(
      `Delete ${label}? All bets and marked results for this week will be removed. This cannot be undone.`
    )
  )
    return;
  const id = ep.id;
  state.episodes = state.episodes.filter((e) => e.id !== id);
  delete state.bets[id];
  delete state.occurred[id];
  delete state.eliminationBets[id];
  delete state.nuttet[id];
  if (state.episodes.length === 0) {
    state.activeTab = OVERVIEW;
  } else {
    const nextIdx = Math.min(idx, state.episodes.length - 1);
    state.activeTab = state.episodes[nextIdx].id;
  }
  saveState();
  if (!suppressFirebaseWrite) {
    fbRef.update({
      [`bets/${id}`]: null,
      [`occurred/${id}`]: null,
      [`eliminationBets/${id}`]: null,
      [`nuttet/${id}`]: null,
    }).catch(() => {});
  }
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
      title: "Week 1",
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
      title: "Week 2",
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
      title: "Week 3",
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
    /** thursdayEpisodeId -> playerIndex -> contestantName */
    nuttet: {},
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
      activeTab === ABOUT ||
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
    if (!result.nuttet || typeof result.nuttet !== "object") result.nuttet = {};
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
      state.contestantNotes[contestantName] = { text: trimmed.slice(0, 1000) };
    }
    saveState();
    const indicator = document.querySelector(`.cast-note[data-name="${CSS.escape(contestantName)}"] .cast-note__saving`);
    if (indicator) {
      indicator.textContent = "saved \u2713";
      indicator.classList.add("cast-note__saving--visible");
      setTimeout(() => indicator.classList.remove("cast-note__saving--visible"), 1200);
    }
  }, delay);
}

const SYNC_EDIT_KEYS = ["bets", "occurred", "eliminationBets", "seasonBets", "seasonResults"];

function saveState(paths) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (suppressFirebaseWrite) return;
  if (Array.isArray(paths) && paths.length) {
    const updates = {};
    for (const p of paths) {
      const segs = p.split("/").filter(Boolean);
      let v = state;
      for (const s of segs) {
        v = v == null ? undefined : v[s];
        if (v === undefined) break;
      }
      updates[p] = v === undefined ? null : v;
    }
    fbRef.update(updates).catch(() => {});
  } else {
    const shared = { ...sharedState() };
    for (const k of SYNC_EDIT_KEYS) delete shared[k];
    fbRef.update(shared).catch(() => {});
  }
}

function getEpisode(id) {
  return state.episodes.find((e) => e.id === id);
}

function normalizeActiveTab() {
  if (state.activeTab === OVERVIEW || state.activeTab === CAST || state.activeTab === EVENT_BANK || state.activeTab === SEASON_BETS || state.activeTab === WEEKLY_RECAP || state.activeTab === MY_STATS || state.activeTab === ABOUT) return;
  if (!getEpisode(state.activeTab)) {
    state.activeTab = state.episodes[0]?.id ?? OVERVIEW;
    saveState();
  }
}

function activeEpisode() {
  if (state.activeTab === OVERVIEW || state.activeTab === CAST || state.activeTab === EVENT_BANK || state.activeTab === WEEKLY_RECAP || state.activeTab === MY_STATS || state.activeTab === ABOUT) return null;
  return getEpisode(state.activeTab);
}

function isEpisodeClosed(ep) {
  return ep?.closed === true;
}

function isEpisodeBetsLocked(ep) {
  return ep?.betsLocked === true || isEpisodeClosed(ep);
}

function isElimBetsLocked(ep) {
  return ep?.elimBetsLocked === true || isEpisodeClosed(ep);
}

function getNextTuesday(from) {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  for (let i = 1; i <= 7; i++) {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    if (next.getDay() === 2) return next.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function suggestNextWeekStart() {
  const lastEp = [...state.episodes].reverse().find((ep) => ep.airDate);
  if (lastEp) return getNextTuesday(new Date(lastEp.airDate + "T12:00:00"));
  const today = new Date();
  if (today.getDay() === 2) return today.toISOString().slice(0, 10);
  return getNextTuesday(today);
}

function mondayLockDeadline(tuesdayDateString) {
  const [y, m, d] = tuesdayDateString.split("-").map(Number);
  const monday = new Date(y, m - 1, d - 1);
  const my = monday.getFullYear(), mm = monday.getMonth() + 1, md = monday.getDate();
  const guess = new Date(Date.UTC(my, mm - 1, md, 22, 0, 0));
  for (let offsetH = -2; offsetH <= 2; offsetH++) {
    const ts = guess.getTime() - offsetH * 3600000;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Copenhagen",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    }).formatToParts(new Date(ts));
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    if (get("day") === md && get("month") === mm && get("hour") === 23 && get("minute") === 0) {
      return ts + 59 * 60000;
    }
  }
  return new Date(Date.UTC(my, mm - 1, md, 21, 59, 0)).getTime();
}

function wednesdayLockDeadline(tuesdayDateString) {
  const [y, m, d] = tuesdayDateString.split("-").map(Number);
  const wed = new Date(y, m - 1, d + 1);
  const wy = wed.getFullYear(), wm = wed.getMonth() + 1, wd = wed.getDate();
  const guess = new Date(Date.UTC(wy, wm - 1, wd, 22, 0, 0));
  for (let offsetH = -2; offsetH <= 2; offsetH++) {
    const ts = guess.getTime() - offsetH * 3600000;
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Copenhagen",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false
    }).formatToParts(new Date(ts));
    const get = (t) => Number(parts.find((p) => p.type === t).value);
    if (get("day") === wd && get("month") === wm && get("hour") === 23 && get("minute") === 0) {
      return ts + 59 * 60000;
    }
  }
  return new Date(Date.UTC(wy, wm - 1, wd, 21, 59, 0)).getTime();
}

function formatWeekDateRange(tuesdayDateStr) {
  if (!tuesdayDateStr) return "";
  const [y, m, d] = tuesdayDateStr.split("-").map(Number);
  const tue = new Date(y, m - 1, d);
  const thu = new Date(y, m - 1, d + 2);
  const tueDay = tue.getDate();
  const thuDay = thu.getDate();
  const thuMonth = DANISH_MONTHS[thu.getMonth()];
  const thuYear = thu.getFullYear();
  if (tue.getMonth() === thu.getMonth()) {
    return `tirsdag \u2013 torsdag, ${tueDay}\u2013${thuDay}. ${thuMonth} ${thuYear}`;
  }
  const tueMonth = DANISH_MONTHS[tue.getMonth()];
  return `tirsdag \u2013 torsdag, ${tueDay}. ${tueMonth} \u2013 ${thuDay}. ${thuMonth} ${thuYear}`;
}

function formatCountdown(deadlineMs) {
  const diff = deadlineMs - Date.now();
  if (diff <= 0) return "now";
  const min = Math.floor(diff / 60000);
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr${hr > 1 ? "s" : ""}`;
  const days = Math.floor(hr / 24);
  return `${days} day${days > 1 ? "s" : ""}`;
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
  return true;
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
  const dateRange = airDates[0] ? formatWeekDateRange(airDates[0]) : "";
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
      eliminationCallText = "No eliminations this week";
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
        eliminationCallText = `A week of surprises \u2014 nobody saw it coming`;
      } else if (uniqueCallers.length === 1) {
        eliminationCallText = `\uD83C\uDFAF Only ${PLAYER_NAMES[uniqueCallers[0]]} called it`;
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
    weekLabel: `Week ${weekNum} \u00B7 ${dateRange}`,
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
  return ep.betsLockDeadline && !ep.betsLocked && !ep.closed && !ep.lockOverridden && now >= ep.betsLockDeadline;
}

function shouldAutoLockElim(ep, now) {
  return ep.elimBetsLockDeadline && !ep.elimBetsLocked && !ep.closed && !ep.lockOverridden && now >= ep.elimBetsLockDeadline;
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
  const viewAbout = document.getElementById("view-about");
  const episodeMain = document.getElementById("episode-workspace");
  const extras = document.getElementById("episode-extras");
  const onOverview = state.activeTab === OVERVIEW;
  const onCast = state.activeTab === CAST;
  const onEventBank = state.activeTab === EVENT_BANK;
  const onSeasonBets = state.activeTab === SEASON_BETS;
  const onWeeklyRecap = state.activeTab === WEEKLY_RECAP;
  const onMyStats = state.activeTab === MY_STATS;
  const onAbout = state.activeTab === ABOUT;
  const onEpisode = !onOverview && !onCast && !onEventBank && !onSeasonBets && !onWeeklyRecap && !onMyStats && !onAbout;
  const allViews = [viewOverview, viewCast, viewEventBank, viewSeasonBets, viewWeeklyRecap, viewMyStats, viewAbout, episodeMain];
  const activeFlags = [onOverview, onCast, onEventBank, onSeasonBets, onWeeklyRecap, onMyStats, onAbout, onEpisode];
  allViews.forEach((v, i) => {
    if (!v) return;
    const show = activeFlags[i];
    v.hidden = !show;
    if (show) {
      v.classList.remove("view-fade-in");
      void v.offsetWidth;
      v.classList.add("view-fade-in");
    }
  });
  if (episodeMain) {
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
    editPhoto.textContent = c.photo ? "edit" : "+ foto";
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
    h.textContent = c.age ? `${c.name}, ${c.age}` : c.name;
    const job = document.createElement("p");
    job.className = "cast-card__job";
    job.textContent = c.occupation;
    body.append(h, job);

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
      addLink.textContent = "+ nickname\u2026";
      addLink.addEventListener("click", () => expandNote(noteWrap, c.name));
      noteWrap.append(addLink, saving);
    } else {
      const preview = document.createElement("div");
      preview.className = "cast-note__preview";
      const previewText = document.createElement("span");
      previewText.className = "cast-note__preview-text";
      previewText.textContent = noteData.text.length > 80 ? noteData.text.slice(0, 80) + "\u2026" : noteData.text;
      preview.append(previewText);
      preview.addEventListener("click", () => expandNote(noteWrap, c.name));
      noteWrap.append(preview, saving);
    }
    body.append(noteWrap);

    const nuttetCount = getNuttetRanking().find((r) => r.name.toLowerCase() === c.name.toLowerCase())?.count || 0;
    if (nuttetCount > 0) {
      const nuttetBadge = document.createElement("p");
      nuttetBadge.className = "cast-card__nuttet";
      nuttetBadge.textContent = `Nuttet-score: ${nuttetCount}`;
      body.append(nuttetBadge);
    }

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

function expandNote(noteWrap, contestantName) {
  if (noteWrap.querySelector(".cast-note__editor")) return;

  const noteData = state.contestantNotes[contestantName];
  noteWrap.innerHTML = "";
  activeNoteEditor = contestantName;

  const editor = document.createElement("div");
  editor.className = "cast-note__editor";

  const ta = document.createElement("textarea");
  ta.className = "cast-note__textarea";
  ta.placeholder = "Add a nickname\u2026";
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

  function closeEditor() {
    clearTimeout(noteSaveTimers[contestantName]);
    const trimmed = ta.value.trim();
    if (!trimmed) {
      delete state.contestantNotes[contestantName];
    } else {
      state.contestantNotes[contestantName] = { text: trimmed.slice(0, 1000) };
    }
    activeNoteEditor = null;
    saveState();
    setTimeout(() => renderOverview(), 100);
  }

  ta.addEventListener("input", () => {
    autoResizeTextarea(ta);
    updateCounter();
    saving.textContent = "saving\u2026";
    saving.classList.add("cast-note__saving--visible");
    saveNoteDebounced(contestantName, ta.value, 2000);
  });

  const doneBtn = document.createElement("button");
  doneBtn.type = "button";
  doneBtn.className = "cast-note__done";
  doneBtn.textContent = "\u2713";
  doneBtn.title = "Done editing";
  doneBtn.addEventListener("click", closeEditor);

  const bottomRow = document.createElement("div");
  bottomRow.className = "cast-note__bottom";
  bottomRow.append(counter, saving, doneBtn);

  editor.append(ta, bottomRow);
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
    alert("That week already has this event.");
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
    state.episodes.length === 0 ? "— Add a week first —" : "— Select week —";
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

      const phaseBadge = document.createElement("button");
      phaseBadge.type = "button";
      if (evPhase !== "any") {
        phaseBadge.className = "phase-badge phase-badge--" + evPhase;
        phaseBadge.textContent = evPhase.replace("-heavy", "").replace("-peak", "");
        phaseBadge.title = "Click to change phase";
      } else {
        phaseBadge.className = "phase-badge phase-badge--any";
        phaseBadge.textContent = "any";
        phaseBadge.title = "Click to set phase";
      }
      phaseBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        showPhaseDropdown(phaseBadge, evPhase, isCustom, text, _origText);
      });

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

      let currentOdds = Number(odds);
      const currentLikelihood = oddsToLikelihood(currentOdds);

      const likelihoodSel = document.createElement("select");
      likelihoodSel.className = "input event-bank-row__likelihood";
      for (const p of LIKELIHOOD_PRESETS) {
        const opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.label;
        if (p.id === currentLikelihood) opt.selected = true;
        likelihoodSel.append(opt);
      }

      const oddsInput = document.createElement("input");
      oddsInput.type = "number";
      oddsInput.className = "input event-bank-row__odds-input";
      oddsInput.min = "1.1";
      oddsInput.max = "99";
      oddsInput.step = "0.1";
      oddsInput.value = currentOdds.toFixed(1);
      oddsInput.title = "Fine-tune odds";

      oddsInput.addEventListener("change", () => {
        let v = Number.parseFloat(oddsInput.value);
        if (Number.isNaN(v) || v < 1.1) { oddsInput.value = currentOdds.toFixed(1); return; }
        currentOdds = v;
        if (isCustom) {
          const entry = state.customBankEvents.find((e) => e.text === text);
          if (entry) entry.odds = v;
        } else if (_origText) {
          state.bankOddsOverrides[_origText] = v;
        }
        oddsInput.value = v.toFixed(1);
        likelihoodSel.value = oddsToLikelihood(v);
        saveState();
        updatePreview();
      });

      likelihoodSel.addEventListener("change", () => {
        currentOdds = likelihoodToOdds(likelihoodSel.value);
        if (isCustom) {
          const entry = state.customBankEvents.find((e) => e.text === text);
          if (entry) entry.odds = currentOdds;
        } else if (_origText) {
          state.bankOddsOverrides[_origText] = currentOdds;
        }
        oddsInput.value = currentOdds.toFixed(1);
        saveState();
        updatePreview();
      });

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
        const adj = computePhaseAdjustedOdds(currentOdds, evPhase, epIdx, total);
        previewEl.textContent = `Will add at ${adj.toFixed(1)}\u00D7 (base ${currentOdds.toFixed(1)} \u00D7 ${mult.toFixed(1)} ${epPh} phase)`;
      };
      leftCol.append(previewEl);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn--secondary event-bank-row__btn";
      btn.textContent = "Add";
      btn.addEventListener("click", () => {
        const epId = targetSel.value;
        if (!epId) {
          alert("Choose a week in the dropdown first.");
          return;
        }
        addMasterEventToEpisode(epId, text, currentOdds, evPhase);
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
      meta.append(phaseBadge, likelihoodSel, oddsInput, btn, rm);
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
    { id: WEEKLY_RECAP, label: "Week summaries" },
    { id: CAST, label: "Cast" },
    { id: EVENT_BANK, label: "Bet bank" },
    { id: SEASON_BETS, label: "Season bets" },
    { id: MY_STATS, label: "Player stats" },
    { id: ABOUT, label: "About" },
  ];

  function activateTab(id) {
    state.activeTab = id;
    saveState();
    renderMainTabs();
    updateViewVisibility();
    if (id === OVERVIEW) renderLeaderboard();
    if (id === EVENT_BANK) renderEventBank();
    if (id === SEASON_BETS) renderSeasonBets();
    if (id === WEEKLY_RECAP) renderWeeklyRecap();
      if (id === MY_STATS) renderMyStats();
      if (id === ABOUT) renderAbout();
    }

  function activateEpisode(epId) {
    state.activeTab = epId;
    saveState();
    renderMainTabs();
    updateViewVisibility();
    renderEpisodeContent();
    renderLeaderboard();
  }

  function currentLabel() {
    const pg = pages.find((p) => p.id === state.activeTab);
    if (pg) return pg.label;
    const epIdx = state.episodes.findIndex((e) => e.id === state.activeTab);
    if (epIdx >= 0) return episodeTabLabel(epIdx);
    return "Menu";
  }

  /* ── desktop tabs ── */
  const desktopRow = document.createElement("div");
  desktopRow.className = "tabs-desktop";

  const overviewBtn = document.createElement("button");
  overviewBtn.type = "button";
  overviewBtn.className = "tab";
  overviewBtn.textContent = "Overview";
  overviewBtn.setAttribute("role", "tab");
  overviewBtn.setAttribute("aria-selected", state.activeTab === OVERVIEW ? "true" : "false");
  overviewBtn.addEventListener("click", () => activateTab(OVERVIEW));
  desktopRow.append(overviewBtn);

  if (state.episodes.length) {
    const select = document.createElement("select");
    select.className = "tab-episode-select" + (isOnEpisode ? " tab-episode-select--active" : "");
    if (!isOnEpisode) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Week bets";
      placeholder.disabled = true;
      placeholder.selected = true;
      select.append(placeholder);
    }
    for (let idx = state.episodes.length - 1; idx >= 0; idx--) {
      const ep = state.episodes[idx];
      const opt = document.createElement("option");
      opt.value = ep.id;
      opt.textContent = episodeTabLabel(idx) + (ep.closed ? " \u2713" : ep.betsLocked ? " [locked]" : "");
      if (ep.id === state.activeTab) opt.selected = true;
      select.append(opt);
    }
    select.addEventListener("change", () => { if (select.value) activateEpisode(select.value); });
    desktopRow.append(select);
  }

  const spacer = document.createElement("span");
  spacer.className = "tab-spacer";
  desktopRow.append(spacer);

  pages.filter(p => p.id !== OVERVIEW).forEach(({ id, label }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.textContent = label;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", state.activeTab === id ? "true" : "false");
    btn.addEventListener("click", () => activateTab(id));
    desktopRow.append(btn);
  });
  root.append(desktopRow);

  /* ── mobile menu ── */
  const mobileBar = document.createElement("div");
  mobileBar.className = "tabs-mobile";

  const hamburger = document.createElement("button");
  hamburger.type = "button";
  hamburger.className = "mobile-menu-btn";
  hamburger.setAttribute("aria-label", "Open menu");
  hamburger.innerHTML = `<span class="mobile-menu-btn__bar"></span><span class="mobile-menu-btn__bar"></span><span class="mobile-menu-btn__bar"></span>`;

  const label = document.createElement("span");
  label.className = "mobile-menu-label";
  label.textContent = currentLabel();

  mobileBar.append(hamburger, label);

  const drawer = document.createElement("div");
  drawer.className = "mobile-drawer";
  drawer.hidden = true;

  const drawerClose = document.createElement("button");
  drawerClose.type = "button";
  drawerClose.className = "mobile-drawer__close";
  drawerClose.innerHTML = "\u2715";
  drawerClose.setAttribute("aria-label", "Close menu");
  drawer.append(drawerClose);

  const drawerTitle = document.createElement("span");
  drawerTitle.className = "mobile-drawer__title";
  drawerTitle.textContent = "Navigate";
  drawer.append(drawerTitle);

  pages.forEach(({ id, label: lbl }) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "mobile-drawer__item" + (state.activeTab === id ? " mobile-drawer__item--active" : "");
    item.textContent = lbl;
    item.addEventListener("click", () => { drawer.hidden = true; backdrop.hidden = true; activateTab(id); });
    drawer.append(item);
  });

  if (state.episodes.length) {
    const epHeader = document.createElement("span");
    epHeader.className = "mobile-drawer__section";
    epHeader.textContent = "Weeks";
    drawer.append(epHeader);

    for (let idx = state.episodes.length - 1; idx >= 0; idx--) {
      const ep = state.episodes[idx];
      const item = document.createElement("button");
      item.type = "button";
      const suffix = ep.closed ? " \u2713" : ep.betsLocked ? " [locked]" : "";
      item.className = "mobile-drawer__item mobile-drawer__item--ep" + (ep.id === state.activeTab ? " mobile-drawer__item--active" : "");
      item.textContent = episodeTabLabel(idx) + suffix;
      item.addEventListener("click", () => { drawer.hidden = true; backdrop.hidden = true; activateEpisode(ep.id); });
      drawer.append(item);
    }
  }

  const backdrop = document.createElement("div");
  backdrop.className = "mobile-drawer-backdrop";
  backdrop.hidden = true;

  function openDrawer() { drawer.hidden = false; backdrop.hidden = false; }
  function closeDrawer() { drawer.hidden = true; backdrop.hidden = true; }
  hamburger.addEventListener("click", openDrawer);
  mobileBar.addEventListener("click", openDrawer);
  drawerClose.addEventListener("click", (e) => { e.stopPropagation(); closeDrawer(); });
  backdrop.addEventListener("click", closeDrawer);

  root.append(mobileBar, drawer, backdrop);
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
    const oddsWrap = document.createElement("span");
    oddsWrap.className = "odds-input-wrap";
    oddsWrap.append(oddsInput);
    if (!closed) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "event-row__remove";
      rm.textContent = "\u00D7";
      if (frozen) rm.disabled = true;
      rm.addEventListener("click", () => {
        ep.events = ep.events.filter((x) => x.id !== ev.id);
        const betPaths = [];
        for (let i = 0; i < PLAYER_COUNT; i++) {
          const b = state.bets[ep.id]?.[i];
          if (b) {
            state.bets[ep.id][i] = b.filter((id) => id !== ev.id);
            betPaths.push(`bets/${ep.id}/${i}`);
          }
        }
        state.occurred[ep.id] = (state.occurred[ep.id] || []).filter((id) => id !== ev.id);
        saveState();
        if (!suppressFirebaseWrite) {
          const updates = { [`occurred/${ep.id}`]: state.occurred[ep.id] };
          for (const p of betPaths) {
            const parts = p.split("/");
            updates[p] = state.bets[parts[1]][parts[2]];
          }
          fbRef.update(updates).catch(() => {});
        }
        renderEvents();
        renderBets();
        renderResults();
        renderEpisodeScoreSummary();
        renderLeaderboard();
      });
      meta.append(oddsWrap, rm);
    } else {
      meta.append(oddsWrap);
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
        saveState([`bets/${ep.id}/${p}`]);
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
  const betsLocked = isEpisodeBetsLocked(ep);
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

  if (!betsLocked) {
    const hint = document.createElement("p");
    hint.className = "panel__hint";
    hint.style.margin = "0";
    hint.textContent = "Lock bets first before marking what happened.";
    root.append(hint);
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
      saveState([`occurred/${ep.id}`]);
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
  const frozen = isElimBetsLocked(ep);

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
      saveState([`eliminationBets/${ep.id}/${p}`]);
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
  const betsLocked = isEpisodeBetsLocked(ep);

  if (!ep.guys.length) {
    const p = document.createElement("p");
    p.className = "panel__hint";
    p.style.margin = "0";
    p.textContent = "Add contestants first.";
    root.append(p);
    return;
  }

  if (!betsLocked) {
    const hint = document.createElement("p");
    hint.className = "panel__hint";
    hint.style.margin = "0";
    hint.textContent = "Lock bets first before marking eliminations.";
    root.append(hint);
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
  const topEl = document.getElementById("episode-score-top");
  if (!ep) {
    el.hidden = true;
    if (topEl) topEl.hidden = true;
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
      lines.push(`${escapeHtml(name)}: ${bd.streakAfter}-week streak \u2192 +${bd.bonus} pts`);
    }
    return `<strong>${escapeHtml(name)}</strong>: ${pts[i].toFixed(2)} pts${extra}`;
  });
  let html = `This week: ${parts.join(" \u00B7 ")}`;
  if (lines.length) {
    html += `<br><span class="streak-summary">${lines.join(" \u00B7 ")}</span>`;
  }
  const closed = isEpisodeClosed(ep);
  el.hidden = true;
  if (topEl) {
    topEl.innerHTML = html;
    topEl.hidden = !closed;
  }
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
  const runningNames = new Set(getRunningGuyNames().map((n) => n.toLowerCase()));
  const cast = allCast();

  getRunningGuyNames().forEach((name) => {
    const info = cast.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const card = document.createElement("div");
    card.className = "running-card";

    const top = document.createElement("div");
    top.className = "running-card__top";

    if (info && info.photo) {
      const img = document.createElement("img");
      img.className = "running-card__photo";
      img.src = info.photo;
      img.alt = name;
      img.loading = "lazy";
      top.append(img);
    } else {
      const initials = document.createElement("span");
      initials.className = "running-card__initials";
      initials.textContent = name.charAt(0).toUpperCase();
      top.append(initials);
    }

    if (info && info.occupation) {
      const occ = document.createElement("span");
      occ.className = "running-card__occupation";
      occ.textContent = info.occupation;
      top.append(occ);
    }

    card.append(top);

    const nameEl = document.createElement("span");
    nameEl.className = "running-card__name";
    nameEl.textContent = name;
    if (info && info.age) nameEl.textContent += `, ${info.age}`;
    card.append(nameEl);

    card.addEventListener("click", () => {
      state.activeTab = CAST;
      saveState();
      renderMainTabs();
      updateViewVisibility();
      renderGuys();
    });

    runRoot.append(card);
  });

  const countEl = document.querySelector(".running-section__count");
  if (countEl) countEl.textContent = `${getRunningGuyNames().length} remaining`;

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
    p.textContent = "Close weeks with correct bets to build streaks.";
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
      streakEl.textContent = String(s.currentStreak);
    } else {
      streakEl.textContent = "\u2014";
    }
    row.append(nameEl, streakEl);
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
  if (cat.inputType === "week") {
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
  if (type === "week") {
    const inp = document.createElement("input");
    inp.type = "number";
    inp.className = "input season-card__select season-card__select--narrow";
    inp.min = 1;
    inp.max = Math.max(state.episodes.length, EXPECTED_SEASON_LENGTH);
    inp.step = 1;
    inp.placeholder = "Wk.";
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
      badge.textContent = "Season bets are locked";
      lockBar.append(badge);

      const unlockBtn = document.createElement("button");
      unlockBtn.type = "button";
      unlockBtn.className = "btn btn--secondary btn--season-unlock";
      unlockBtn.textContent = "Unlock";
      unlockBtn.addEventListener("click", () => {
        const pw = prompt("Enter the admin password to unlock season bets:");
        if (pw === null) return;
        if (pw === "thfbattf") {
          state.seasonBetsLocked = false;
          saveState();
          renderSeasonBets();
        } else {
          alert("Wrong password.");
        }
      });
      lockBar.append(unlockBtn);
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
          playerPick.classList.add("season-card__player--won");
        }

        const input = buildSeasonInput(cat, currentPick, locked, (val) => {
          if (!state.seasonBets[p]) state.seasonBets[p] = {};
          state.seasonBets[p][cat.key] = val;
          saveState([`seasonBets/${p}/${cat.key}`]);
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
        saveState([`seasonResults/${cat.key}`]);
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

    const sorted = PLAYER_NAMES
      .map((name, i) => ({ name, i, pts: pts[i] }))
      .sort((a, b) => b.pts - a.pts);
    const topPts = sorted[0]?.pts || 0;

    sorted.forEach(({ name, i, pts: p }, rank) => {
      const row = document.createElement("div");
      row.className = "season-score-row" + (rank === 0 && topPts > 0 ? " season-score-row--leader" : "");
      const rankEl = document.createElement("span");
      rankEl.className = "season-score-row__rank";
      rankEl.textContent = String(rank + 1).padStart(2, "0");
      const nameEl = document.createElement("span");
      nameEl.className = "season-score-row__name";
      nameEl.textContent = name;
      const val = document.createElement("span");
      val.className = "season-score-row__pts";
      val.textContent = `${p} / ${maxPts} pts`;
      row.append(rankEl, nameEl, val);
      summaryRoot.append(row);
    });
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
    const hero = document.createElement("header");
    hero.className = "page-hero";
    const h2 = document.createElement("h2");
    h2.id = "my-stats-heading";
    h2.className = "page-hero__title";
    h2.textContent = "Player stats";
    const tagline = document.createElement("p");
    tagline.className = "page-hero__tagline";
    tagline.textContent = "Stats overview across all players.";
    hero.append(h2, tagline);
    headerRoot.append(hero);
    renderAllPlayersOverview(contentRoot);
  } else {
    const p = selectedStatsPlayer;
    const hero = document.createElement("header");
    hero.className = "page-hero";
    const h2 = document.createElement("h2");
    h2.id = "my-stats-heading";
    h2.className = "page-hero__title";
    h2.textContent = `${PLAYER_NAMES[p]}'s stats`;
    hero.append(h2);
    headerRoot.append(hero);
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
    { label: "Current streak", fn: (s) => s.overview.currentStreak > 0 ? String(s.overview.currentStreak) : "0", raw: (s) => s.overview.currentStreak, cmp: "high" },
    { label: "Biggest win", fn: (s) => s.overview.biggestWin.odds > 0 ? `${s.overview.biggestWin.odds}\u00D7` : "\u2014", raw: (s) => s.overview.biggestWin.odds, cmp: "high" },
    { label: "Best week", fn: (s) => s.overview.bestNight.pts > 0 ? `${s.overview.bestNight.pts.toFixed(1)}` : "\u2014", raw: (s) => s.overview.bestNight.pts, cmp: "high" },
    { label: "Elim. correct", fn: (s) => `${s.eliminations.correctBets}/${s.eliminations.totalBets}`, raw: (s) => s.eliminations.correctBets, cmp: "high" },
    { label: "Elim. hit rate", fn: (s) => s.eliminations.hitRate != null ? `${s.eliminations.hitRate}%` : "\u2014", raw: (s) => s.eliminations.hitRate ?? -1, cmp: "high" },
  ];

  const hint = document.createElement("p");
  hint.className = "panel__hint";
  hint.style.fontSize = "0.75rem";
  hint.style.marginBottom = "1rem";
  hint.textContent = "Click a player name above to see their detailed stats.";
  section.append(hint);

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

}

function renderSinglePlayerStats(root, p) {
  const stats = computePlayerStats(p);

  if (stats.totalBets === 0) {
    const empty = document.createElement("div");
    empty.className = "ms-empty";
    empty.innerHTML = `<p>No bets placed yet. Place bets on a week to see stats.</p>`;
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
    { label: "Best week", value: o.bestNight.pts > 0 ? `${o.bestNight.pts.toFixed(1)} pts` : "—", sub: o.bestNight.pts > 0 ? o.bestNight.label : null },
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
    hint.textContent = "Available after at least 2 closed weeks.";
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
    for (const e of data.slice(0, 5)) {
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

function renderAbout() {
  const root = document.getElementById("about-content");
  if (!root || root.hasChildNodes()) return;

  root.innerHTML = `
<header class="about-hero">
  <h1 class="about__h1" id="about-heading">About</h1>
  <p class="about-hero__tagline">The story behind the bets, the name, and the nuttet column.</p>
</header>

<article class="about-body">

<section class="about-split">
  <div class="about-split__label">
    <span class="about-split__label-text">The Origin</span>
  </div>
  <div class="about-split__content">
    <p class="about__lede">This started last year as a shared iCloud note.</p>
    <p>It had two columns. One for betting on who\u2019d go home that week. One labeled \u201Cnuttet\u201D where we each wrote down which guy we thought was cute. The cuteness column was worth zero points. It was not a betting column. It was a feelings column.</p>
    <p>We did this for an entire season. We tallied eliminations. We logged our cuteness opinions like it was a legally binding record. We disagreed violently about who was cute. We disagreed somewhat less about who was going home, mainly because none of us knew.</p>
    <p>The betting format was originally lifted from a Game of Thrones pool Malle ran with Dulde\u2019s family in high school, which was competitive, eerily accurate, and in retrospect probably a few kroner away from being structured gambling.</p>
    <p>This website is the third generation of the same basic idea: actual odds, actual events, actual infrastructure. The nuttet column persists, but in a new and updated and better-than-ever format.</p>
  </div>
</section>

<hr class="about-divider" />

<section class="about-split">
  <div class="about-split__label">
    <span class="about-split__label-text">How It Works</span>
  </div>
  <div class="about-split__content">
    <div class="about-numbered">
      <div class="about-numbered__item">
        <span class="about-numbered__num">01</span>
        <div class="about-numbered__body">
          <h3 class="about-numbered__title">Pick your bets</h3>
          <p>Before each week\u2019s episodes air, each of us picks <strong>3 events</strong> from a bank of way too many bets \u2014 things like \u201Csomeone cries,\u201D \u201Ca group date goes wrong,\u201D or \u201CStig Rossen makes an appearance.\u201D Each event has odds. Rarer events pay more. This is gambling for people who are too anxious to actually gamble.</p>
        </div>
      </div>
      <div class="about-numbered__item">
        <span class="about-numbered__num">02</span>
        <div class="about-numbered__body">
          <h3 class="about-numbered__title">Roseceremonien</h3>
          <p>Each week features a rose ceremony, which adds an <strong>extra elimination bet</strong>: who\u2019s going home? Correct guesses pay out based on how many contestants are still in the running. Early-season guesses are genuinely hard. Late-season guesses are mostly vibes.</p>
        </div>
      </div>
      <div class="about-numbered__item">
        <span class="about-numbered__num">03</span>
        <div class="about-numbered__body">
          <h3 class="about-numbered__title">Bets lock automatically</h3>
          <p>At midnight before the week\u2019s first episode, all bets lock \u2014 no late entries, no edits, no mercy. We love each other. We don\u2019t trust each other.</p>
        </div>
      </div>
      <div class="about-numbered__item">
        <span class="about-numbered__num">04</span>
        <div class="about-numbered__body">
          <h3 class="about-numbered__title">Mark what happened</h3>
          <p>After the week\u2019s episodes we tick off what actually happened and who got eliminated. Points get tallied automatically and the leaderboard updates instantly.</p>
        </div>
      </div>
      <div class="about-numbered__item">
        <span class="about-numbered__num">05</span>
        <div class="about-numbered__body">
          <h3 class="about-numbered__title">Nuttet</h3>
          <p>Every week, each of us picks which contestant we thought was cutest. It\u2019s worth zero points \u2014 pure vibes, no strategy. A running tally on the overview page shows who the group collectively finds most adorable. It\u2019s a feelings column.</p>
        </div>
      </div>
      <div class="about-numbered__item">
        <span class="about-numbered__num">06</span>
        <div class="about-numbered__body">
          <h3 class="about-numbered__title">S\u00E6sonbets</h3>
          <p>At the start of the season, we lock in <strong>long-range predictions</strong> \u2014 who wins, first kiss, biggest villain, and more. These don\u2019t pay out until the finale, but they carry big points and can completely swing the final standings.</p>
        </div>
      </div>
      <div class="about-numbered__item">
        <span class="about-numbered__num">07</span>
        <div class="about-numbered__body">
          <h3 class="about-numbered__title">Stats &amp; week summaries</h3>
          <p>The app tracks everything: hit rates, streaks, total points per week, and detailed player stats. A summary is available once the week closes, which we then immediately misread and take personally.</p>
        </div>
      </div>
      <div class="about-numbered__item">
        <span class="about-numbered__num">08</span>
        <div class="about-numbered__body">
          <h3 class="about-numbered__title">Everything syncs live</h3>
          <p>No refreshing. No \u201Cdid you see my bet?\u201D If Yas places a bet from her couch, Thiller\u2019s phone knows about it before Yas has set the phone down. Open it on your phone while watching or check the leaderboard on your laptop the next morning.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<hr class="about-divider" />

<section class="about-split">
  <div class="about-split__label">
    <span class="about-split__label-text">Our Approach</span>
  </div>
  <div class="about-split__content">
    <p class="about__lede">Fun before fair. Always.</p>
    <p>Perfect odds would make this a math exercise. We have spreadsheets at work. We did not build this to use another spreadsheet. A 20\u00D7 bet on something absurd happening is the entire personality of this site.</p>
    <p>There are no accounts, no logins. Four of us, one shared state, Firebase doing the actual work. If we can\u2019t trust each other not to tamper with the database, the friendship is cooked anyway and no login screen is going to save it.</p>
    <p>The bet bank is bachelorette-specific. The events know this is Mie and Sofie\u2019s season. They know about Lulu. They reference Sicily. A bet bank that doesn\u2019t mention Stig Rossen at least once is a bet bank that has failed you.</p>
    <p>Odds aren\u2019t sacred. We tune them between weeks. If \u201Csomeone cries\u201D keeps happening 100% of the time, that is feedback from the universe and we take it seriously. Dulde has a whole theory about this. We do not have time to hear the whole theory.</p>
  </div>
</section>

<hr class="about-divider" />

<section class="about-split">
  <div class="about-split__label">
    <span class="about-split__label-text">Fair Play</span>
  </div>
  <div class="about-split__content">
    <div class="about-fairplay">
      <div class="about-fairplay__block">
        <h3 class="about-fairplay__heading about-fairplay__heading--red">What counts as cheating</h3>
        <p>Waiting to see what happens in an episode before locking in your bets. That\u2019s why betting closes at midnight on air day. We love each other. We don\u2019t trust each other.</p>
      </div>
      <div class="about-fairplay__block">
        <h3 class="about-fairplay__heading about-fairplay__heading--green">What doesn\u2019t</h3>
        <p>Almost everything else. Betting strategically against a friend: yes. Building a color-coded tracker of which contestant cries on which day: enthusiastically yes. Stalking the contestants on Instagram for scouting intel: we call that research. If it happens before the deadline, it\u2019s fair play and arguably heroic.</p>
      </div>
    </div>
  </div>
</section>

<hr class="about-divider" />

<section class="about-feature">
  <div class="about-feature__text">
    <span class="about-feature__num">04</span>
    <h3 class="about-feature__heading">The Name</h3>
    <p class="about__lede">THFBATTF stands for <em>The Hotass French-speaking Bitches and their Translator Friends</em>.</p>
    <p>This is from a group project for national language day in high school. Thiller and Yas studied French. Dulde and Malle studied German and were press-ganged into translating. The project is forgotten. The presentation is forgotten. The French is, embarrassingly, also forgotten. The acronym survived all of it and now sits at the top of a betting website. This is, as far as we can tell, the peak of its journey.</p>
  </div>
  <figure class="about-feature__figure">
    <img class="about-feature__img" src="assets/thfbattf-group.png" alt="THFBATTF" loading="lazy" />
    <figcaption class="about-feature__caption">The original THFBATTF crew</figcaption>
  </figure>
</section>

</article>

`;
}

function renderLeaderboard() {
  const epTotals = totalPointsAllEpisodes();
  const sPts = seasonBetPoints();
  const streaks = getStreaks();
  const totals = epTotals.map((v, i) => v + sPts[i] + (streaks[i]?.bonusPointsEarned || 0));
  const root = document.getElementById("leaderboard");
  root.innerHTML = "";

  const hint = document.getElementById("lb-bet-status-hint");
  if (hint) hint.hidden = true;

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

  order.forEach(({ i, pts }, rank) => {
    const card = document.createElement("div");
    card.className = "lb-card" + (rank === 0 ? " lb-card--leader" : "");

    const rankEl = document.createElement("span");
    rankEl.className = "lb-card__rank";
    rankEl.textContent = String(rank + 1).padStart(2, "0");

    const body = document.createElement("div");
    body.className = "lb-card__body";

    const nameEl = document.createElement("span");
    nameEl.className = "lb-card__name";
    nameEl.textContent = PLAYER_NAMES[i];

    const meta = document.createElement("span");
    meta.className = "lb-card__meta";
    const st = streaks[i] || { currentStreak: 0, bonusPointsEarned: 0 };
    const parts = [];
    parts.push(`${elimCorrect[i]} correct elim.`);
    parts.push(`Season ${sPts[i]}/${maxSeason}`);
    if (st.currentStreak > 0) parts.push(`Streak ${st.currentStreak}`);
    if (st.bonusPointsEarned > 0) parts.push(`+${st.bonusPointsEarned} bonus`);
    meta.textContent = parts.join("  \u00B7  ");

    body.append(nameEl, meta);

    const ptsEl = document.createElement("span");
    ptsEl.className = "lb-card__points";
    ptsEl.textContent = pts.toFixed(2);

    const ptsLabel = document.createElement("span");
    ptsLabel.className = "lb-card__points-label";
    ptsLabel.textContent = "pts";

    const ptsWrap = document.createElement("div");
    ptsWrap.className = "lb-card__points-wrap";
    ptsWrap.append(ptsEl, ptsLabel);

    card.append(rankEl, body, ptsWrap);
    card.addEventListener("click", () => {
      statsViewMode = "player";
      selectedStatsPlayer = i;
      state.activeTab = MY_STATS;
      saveState();
      renderMainTabs();
      updateViewVisibility();
      renderMyStats();
    });
    root.append(card);
  });

  renderOverviewPanels();
  renderNuttetOverview();
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
    p.textContent = "No weeks yet.";
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

    const titleText = ep.name || `Week ${epIdx + 1}`;
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
    p.textContent = "No bets placed yet. Go to a week to start betting!";
    root.append(p);
  }
}

/* ── Nuttet helpers ── */

function getThursdayEpisodes() {
  return state.episodes.filter((ep) => isEliminationEpisode(ep));
}

function getThursdayEpisodeForWeek(weekId) {
  return getEpisodesForWeek(weekId).find((ep) => isEliminationEpisode(ep)) || null;
}

function getEligibleContestantsForNuttet(epId) {
  const epIdx = state.episodes.findIndex((e) => e.id === epId);
  if (epIdx < 0) return [];
  const ep = state.episodes[epIdx];
  if (!ep.guys || !ep.guys.length) return [];
  const priorEliminated = new Set();
  for (let i = 0; i < epIdx; i++) {
    for (const name of (state.episodes[i].eliminated || [])) {
      priorEliminated.add(name);
    }
  }
  return ep.guys.filter((g) => !priorEliminated.has(g.name));
}

function getNuttetRanking() {
  const counts = new Map();
  for (const epId of Object.keys(state.nuttet || {})) {
    const picks = state.nuttet[epId];
    for (const p of Object.keys(picks)) {
      const name = picks[p];
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, photoUrl: castPhotoByName(name) }))
    .sort((a, b) => b.count - a.count);
}

function getNuttetForWeek(thursdayEpId) {
  return state.nuttet?.[thursdayEpId] || {};
}

function renderNuttetSection(ep) {
  const root = document.getElementById("nuttet-section");
  if (!root) return;
  root.hidden = false;
  root.innerHTML = "";

  const closed = isEpisodeClosed(ep);
  const eligible = getEligibleContestantsForNuttet(ep.id);
  const picks = getNuttetForWeek(ep.id);

  const title = document.createElement("h2");
  title.className = "panel__title";
  title.textContent = "Nuttet this week";
  const hint = document.createElement("p");
  hint.className = "panel__hint";
  hint.textContent = "Zero points. Pure vibes. Tradition since the iCloud note days.";
  root.append(title, hint);

  const grid = document.createElement("div");
  grid.className = "nuttet-grid";

  for (let p = 0; p < PLAYER_COUNT; p++) {
    const row = document.createElement("div");
    row.className = "nuttet-row";

    const nameEl = document.createElement("span");
    nameEl.className = "nuttet-row__name";
    nameEl.textContent = PLAYER_NAMES[p];

    const select = document.createElement("select");
    select.className = "nuttet-row__select";
    select.disabled = closed;

    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "\u2014 pick one \u2014";
    select.append(emptyOpt);

    const currentPick = picks[p] || "";
    const eligibleNames = new Set(eligible.map((g) => g.name));
    if (currentPick && !eligibleNames.has(currentPick)) {
      eligibleNames.add(currentPick);
    }

    const sorted = [...eligibleNames].sort((a, b) => a.localeCompare(b, "da"));
    for (const name of sorted) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (name === currentPick) opt.selected = true;
      select.append(opt);
    }

    select.addEventListener("change", () => {
      if (!state.nuttet[ep.id]) state.nuttet[ep.id] = {};
      state.nuttet[ep.id][p] = select.value || null;
      saveState();
      renderNuttetSection(ep);
    });

    row.append(nameEl, select);
    if (currentPick) {
      row.classList.add("nuttet-row--done");
    }
    grid.append(row);
  }

  root.append(grid);
}

function renderPlayerSections() {
  const root = document.getElementById("player-sections");
  if (!root) return;
  root.innerHTML = "";
  const ep = activeEpisode();
  if (!ep) return;
  ensureEpisodeMaps(ep.id);

  const frozen = isEpisodeBetsLocked(ep);

  const title = document.createElement("h2");
  title.className = "panel__title";
  title.textContent = "Event bets";
  const hint = document.createElement("p");
  hint.className = "panel__hint";
  hint.textContent = "Each player picks 3 events they think will happen this week.";
  root.append(title, hint);

  const grid = document.createElement("div");
  grid.className = "player-sections__grid";

  for (let p = 0; p < PLAYER_COUNT; p++) {
    const card = document.createElement("div");
    card.className = "player-section-card";

    const header = document.createElement("h3");
    header.className = "player-section-card__name";
    header.textContent = PLAYER_NAMES[p];
    card.append(header);

    // --- Event bets (3 picks) ---
    const betsLabel = document.createElement("span");
    betsLabel.className = "player-section-card__label";
    betsLabel.textContent = "Event bets";
    card.append(betsLabel);

    const picks = [...(state.bets[ep.id][p] || [])];
    while (picks.length < MAX_BETS) picks.push("");

    for (let slot = 0; slot < MAX_BETS; slot++) {
      const select = document.createElement("select");
      select.className = "player-section-card__select";
      if (frozen) select.disabled = true;
      const others = picks.filter((_, i) => i !== slot);
      select.innerHTML = eventOptionsHtml(ep, picks[slot] || "", others);
      select.value = picks[slot] || "";
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
        saveState([`bets/${ep.id}/${p}`]);
        renderBets();
        renderResults();
        renderEpisodeScoreSummary();
        renderLeaderboard();
        renderPlayerSections();
      });
      card.append(select);
    }

    const allFilled = picks.every(v => v !== "");
    if (allFilled) {
      card.classList.add("player-section-card--done");
    }

    grid.append(card);
  }
  root.append(grid);
}

function renderElimSection() {
  const root = document.getElementById("elim-section");
  if (!root) return;
  root.innerHTML = "";
  const ep = activeEpisode();
  if (!ep) return;
  const hasElim = isEliminationEpisode(ep);
  if (!hasElim || !ep.guys?.length) return;
  ensureEpisodeMaps(ep.id);

  const frozen = isElimBetsLocked(ep);
  const elimOdds = eliminationOdds(ep);

  const title = document.createElement("h2");
  title.className = "panel__title";
  title.textContent = "Who goes home?";
  const hint = document.createElement("p");
  hint.className = "panel__hint";
  hint.textContent = `Pick the contestant you think won't get a rose. ${elimOdds.toFixed(1)}× if you're right.`;
  root.append(title, hint);

  const grid = document.createElement("div");
  grid.className = "elim-grid";

  for (let p = 0; p < PLAYER_COUNT; p++) {
    const row = document.createElement("div");
    row.className = "nuttet-row";

    const nameEl = document.createElement("span");
    nameEl.className = "nuttet-row__name";
    nameEl.textContent = PLAYER_NAMES[p];

    const select = document.createElement("select");
    select.className = "nuttet-row__select";
    if (frozen) select.disabled = true;
    const currentElim = state.eliminationBets[ep.id]?.[p] || "";

    const emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "\u2014 Pick who leaves \u2014";
    select.append(emptyOpt);

    for (const g of ep.guys) {
      const opt = document.createElement("option");
      opt.value = g.name;
      opt.textContent = g.name;
      if (g.name === currentElim) opt.selected = true;
      select.append(opt);
    }

    select.addEventListener("change", () => {
      ensureEpisodeMaps(ep.id);
      state.eliminationBets[ep.id][p] = select.value;
      saveState([`eliminationBets/${ep.id}/${p}`]);
      renderEliminationBets();
      renderEpisodeScoreSummary();
      renderLeaderboard();
      renderElimSection();
    });

    row.append(nameEl, select);
    if (currentElim) {
      row.classList.add("nuttet-row--done");
    }
    grid.append(row);
  }
  root.append(grid);
}

function renderNuttetOverview() {
  const root = document.getElementById("overview-nuttet");
  if (!root) return;
  const ranking = getNuttetRanking();
  root.innerHTML = "";

  if (!ranking.length) {
    root.hidden = true;
    return;
  }
  root.hidden = false;
  root.className = "running-section";

  const left = document.createElement("div");
  left.className = "running-section__left";
  const title = document.createElement("h3");
  title.className = "running-section__heading";
  title.textContent = "Season's most cute";
  left.append(title);
  root.append(left);

  const grid = document.createElement("div");
  grid.className = "nuttet-ranking-grid";

  ranking.forEach(({ name, count, photoUrl }) => {
    const card = document.createElement("div");
    card.className = "nuttet-ranking-card";

    if (photoUrl) {
      const img = document.createElement("img");
      img.className = "nuttet-ranking-card__photo";
      img.src = photoUrl;
      img.alt = name;
      img.loading = "lazy";
      card.append(img);
    } else {
      const fb = document.createElement("span");
      fb.className = "nuttet-ranking-card__fb";
      fb.textContent = name.charAt(0).toUpperCase();
      card.append(fb);
    }

    const nameEl = document.createElement("span");
    nameEl.className = "nuttet-ranking-card__name";
    nameEl.textContent = name;

    const countEl = document.createElement("span");
    countEl.className = "nuttet-ranking-card__count";
    countEl.textContent = `\u00D7${count}`;

    card.append(nameEl, countEl);

    const noteData = state.contestantNotes?.[name];
    if (noteData?.text) {
      const noteEl = document.createElement("p");
      noteEl.className = "nuttet-ranking-card__note";
      noteEl.textContent = noteData.text;
      card.append(noteEl);
    }

    grid.append(card);
  });

  root.append(grid);
}

function renderEpisodeContent() {
  const ep = activeEpisode();
  const workspace = document.getElementById("episode-workspace");
  const closed = ep ? isEpisodeClosed(ep) : false;
  const betsLocked = ep ? isEpisodeBetsLocked(ep) : false;
  if (workspace) {
    workspace.classList.toggle("episode--closed", closed);
  }

  const heroEl = document.getElementById("episode-hero");
  if (heroEl) {
    heroEl.innerHTML = "";
    if (ep) {
      const epIdx = state.episodes.indexOf(ep);

      const h2 = document.createElement("h2");
      h2.className = "page-hero__title";
      h2.textContent = `Week ${epIdx + 1}`;

      const tagline = document.createElement("p");
      tagline.className = "page-hero__tagline";
      tagline.textContent = formatWeekDateRange(ep.airDate);

      heroEl.append(h2, tagline);

      if (ep.betsLockDeadline && !ep.betsLocked && !closed) {
        const strip = document.createElement("p");
        strip.className = "episode-deadline-strip";
        const now = Date.now();
        const dl = ep.betsLockDeadline;
        const diff = dl - now;
        if (diff <= 0) {
          strip.textContent = "Bets lock now\u2026";
          strip.classList.add("episode-deadline-strip--warn");
        } else {
          strip.textContent = "Bets close " + formatDeadlineTime(dl) + " (\u2248 " + formatCountdown(dl) + ")";
          if (diff < 6 * 3600000) strip.classList.add("episode-deadline-strip--warn");
        }
        heroEl.append(strip);
      }
    }
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
      const elimLocked = isElimBetsLocked(ep);
      let msg = elimLocked
        ? "Event og elimination bets er l\u00E5st."
        : "Event bets er l\u00E5st.";
      if (ep.betsLockedAt) {
        msg += " \u00B7 L\u00E5st " + formatDeadlineTime(ep.betsLockedAt);
      }
      const still = [];
      if (!elimLocked) still.push("dit bud p\u00E5 hvem der ikke f\u00E5r en rose (til ons. 23:59)");
      still.push("nuttet (til ugen lukkes)");
      msg += " \u00B7 Du kan stadig redigere " + still.join(" og ") + ".";
      betsLockText.textContent = msg;
    }
  }

  const deadlineEl = document.getElementById("deadline-display");
  if (deadlineEl) deadlineEl.hidden = true;

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
      label.textContent = "Week start (Tue):";
      const input = document.createElement("input");
      input.type = "date";
      input.className = "input input--narrow episode-airdate-bar__input";
      input.value = ep.airDate || "";
      input.addEventListener("change", () => {
        ep.airDate = input.value || null;
        ep.betsLockDeadline = ep.airDate ? mondayLockDeadline(ep.airDate) : null;
        ep.elimBetsLockDeadline = ep.airDate ? wednesdayLockDeadline(ep.airDate) : null;
        saveState();
        renderEpisodeContent();
        renderMainTabs();
      });

      airDateBar.append(label, input);
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
  safe(renderPlayerSections, "renderPlayerSections");
  safe(renderElimSection, "renderElimSection");
  if (ep) safe(() => renderNuttetSection(ep), "renderNuttetSection");
}

function renderDeadlineDisplay(el, ep) {
  const now = Date.now();
  const dl = ep.betsLockDeadline;
  if (ep.betsLocked) {
    el.className = "deadline-display deadline-display--locked";
    el.textContent = "L\u00E5st" + (ep.betsLockedAt ? " \u00B7 " + formatDeadlineTime(ep.betsLockedAt) : "");
  } else if (now >= dl) {
    el.className = "deadline-display deadline-display--warn";
    el.textContent = "Auto-l\u00E5ser nu\u2026";
  } else {
    const diff = dl - now;
    const isWarn = diff < 6 * 3600000;
    el.className = "deadline-display" + (isWarn ? " deadline-display--warn" : "");
    el.textContent = "Bets lock " + formatDeadlineTime(dl) + " (\u2248 " + formatCountdown(dl) + ")";
  }
}

function guysAfterEliminations(ep) {
  if (!Array.isArray(ep.guys)) ep.guys = [];
  ensureEliminatedArray(ep);
  const elimSet = new Set(ep.eliminated);
  return ep.guys.filter((g) => !elimSet.has(g.name));
}

function wireActions() {
  const castAddModal = document.getElementById("cast-add-modal");
  document.getElementById("cast-add-toggle")?.addEventListener("click", () => {
    if (castAddModal) castAddModal.hidden = false;
  });
  document.getElementById("cast-add-cancel")?.addEventListener("click", () => {
    if (castAddModal) castAddModal.hidden = true;
  });
  castAddModal?.addEventListener("click", (e) => {
    if (e.target === castAddModal) castAddModal.hidden = true;
  });
  document.getElementById("cast-add-btn")?.addEventListener("click", () => {
    const nameEl = document.getElementById("cast-add-name");
    const photoEl = document.getElementById("cast-add-photo");
    const name = nameEl.value.trim();
    if (!name) return;
    const photo = photoEl.value.trim();
    ensureInCast(name, photo);
    nameEl.value = "";
    photoEl.value = "";
    if (castAddModal) castAddModal.hidden = true;
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
    const likelihoodEl = document.getElementById("custom-bank-likelihood");
    const catEl = document.getElementById("custom-bank-category");
    const phaseEl = document.getElementById("custom-bank-phase");
    const text = (textEl?.value ?? "").trim();
    const odds = likelihoodToOdds(likelihoodEl?.value);
    const category = catEl?.value || "_custom";
    const phase = phaseEl?.value || "any";
    if (!text) { alert("Enter a bet description."); return; }
    const dupe = masterBetEvents().some((e) => e.text.trim().toLowerCase() === text.toLowerCase());
    if (dupe) { alert("That bet already exists in the bank."); return; }
    state.customBankEvents.push({ text, odds, category, phase });
    saveState();
    textEl.value = "";
    if (likelihoodEl) likelihoodEl.value = "likely";
    if (phaseEl) phaseEl.value = "any";
    populateMasterEventDatalist();
    renderEventBank();
  });

  const addEpToggle = document.getElementById("add-episode-toggle");
  const addEpModal = document.getElementById("add-episode-modal");
  const addEpAirdate = document.getElementById("new-ep-airdate");

  addEpToggle?.addEventListener("click", () => {
    addEpAirdate.value = suggestNextWeekStart();
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
    const betsLockDeadline = airDate ? mondayLockDeadline(airDate) : null;
    const elimBetsLockDeadline = airDate ? wednesdayLockDeadline(airDate) : null;

    const newEp = {
      id: uid(),
      title: `Week ${n}`,
      guys: carryGuys,
      events: [],
      eliminated: [],
      betsLocked: false,
      betsLockedAt: null,
      betsLockDeadline,
      elimBetsLocked: false,
      elimBetsLockDeadline,
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

  const addGuyModal = document.getElementById("add-guy-modal");
  document.getElementById("add-guy-toggle")?.addEventListener("click", () => {
    if (addGuyModal) addGuyModal.hidden = false;
  });
  document.getElementById("add-guy-cancel")?.addEventListener("click", () => {
    if (addGuyModal) addGuyModal.hidden = true;
  });
  addGuyModal?.addEventListener("click", (e) => {
    if (e.target === addGuyModal) addGuyModal.hidden = true;
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
    if (addGuyModal) addGuyModal.hidden = true;
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
    const typed = prompt('This will erase ALL weeks, bets, and scores.\n\nA backup will be saved automatically.\n\nType DELETE to confirm:');
    if (typed !== "DELETE") return;
    const backup = sharedState();
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    fbDb.ref("backups/" + ts).set(backup).catch((e) => console.error("Backup failed:", e));
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    saveState();
    renderMainTabs();
    updateViewVisibility();
    renderOverview();
    if (activeEpisode()) renderEpisodeContent();
    renderLeaderboard();
    renderEventBank();
    showToast("Data reset. Backup saved as " + ts);
  }
  document.getElementById("reset-data")?.addEventListener("click", handleReset);

  document.getElementById("restore-backup")?.addEventListener("click", async () => {
    try {
      const snap = await fbDb.ref("backups").orderByKey().limitToLast(10).once("value");
      const backups = snap.val();
      if (!backups) { alert("No backups found."); return; }
      const keys = Object.keys(backups).sort().reverse();
      const list = keys.map((k, i) => `${i + 1}. ${k}`).join("\n");
      const choice = prompt("Available backups:\n\n" + list + "\n\nEnter the number to restore:");
      const idx = parseInt(choice, 10) - 1;
      if (isNaN(idx) || idx < 0 || idx >= keys.length) return;
      if (!confirm("Restore backup from " + keys[idx] + "? This will overwrite current data.")) return;
      const restored = backups[keys[idx]];
      suppressFirebaseWrite = true;
      state = { ...defaultState(), ...restored, activeTab: state.activeTab };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      suppressFirebaseWrite = false;
      saveState();
      renderAll();
      showToast("Restored backup from " + keys[idx]);
    } catch (e) {
      console.error("Restore failed:", e);
      alert("Failed to load backups. Check console for details.");
    }
  });

  document.getElementById("lock-bets")?.addEventListener("click", () => {
    const ep = activeEpisode();
    if (!ep) return;
    if (!confirm("Lock bets for this week? Players won\u2019t be able to change their picks until unlocked.")) return;
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
    ep.elimBetsLocked = false;
    ep.lockOverridden = true;
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
    const epIdx = state.episodes.indexOf(ep);
    const nextEp = state.episodes[epIdx + 1];
    if (!nextEp) {
      const carryGuys = guysAfterEliminations(ep).map((g) => ({ id: uid(), name: g.name }));
      const nextAirDate = ep.airDate ? getNextTuesday(new Date(ep.airDate + "T12:00:00")) : null;
      const betsLockDeadline = nextAirDate ? mondayLockDeadline(nextAirDate) : null;
      const elimBetsLockDeadline = nextAirDate ? wednesdayLockDeadline(nextAirDate) : null;
      const newEp = {
        id: uid(),
        title: `Week ${state.episodes.length + 1}`,
        guys: carryGuys,
        events: [],
        eliminated: [],
        betsLocked: false,
        betsLockedAt: null,
        betsLockDeadline,
        elimBetsLocked: false,
        elimBetsLockDeadline,
        airDate: nextAirDate,
      };
      state.episodes.push(newEp);
    }
    saveState();
    renderMainTabs();
    renderEpisodeContent();
    updateViewVisibility();
    renderLeaderboard();
  });

  document.getElementById("reopen-episode")?.addEventListener("click", () => {
    const ep = activeEpisode();
    if (!ep) return;
    if (!confirm("Reopen this week? Be careful not to change finalized data by accident.")) return;
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
  let md = `WEEK ${recap.weekNum} \u2014 ${recap.dateRange}\n`;
  md += "___________________\n\n";

  md += "\uD83C\uDFAF SCOREBOARD:\n";
  const thursdayEp = getThursdayEpisodeForWeek(recap.weekId || "");
  const nuttetPicks = thursdayEp ? getNuttetForWeek(thursdayEp.id) : {};
  recap.scoreboard.forEach((s, idx) => {
    const rank = String(idx + 1).padStart(2, "0");
    const name = PLAYER_NAMES[s.playerIndex];
    const pts = `${formatDanishNumber(s.weekPoints)} pts`;
    const nuttet = nuttetPicks[s.playerIndex] ? ` | Nuttet: ${nuttetPicks[s.playerIndex]}` : "";
    md += `${rank}  ${name} \u2014 ${pts}${nuttet}\n`;
  });
  md += "\n";

  if (recap.highlights.biggestPayout || recap.highlights.biggestWhiff) {
    md += "\uD83E\uDD21 HIGHLIGHTS:\n";
    if (recap.highlights.biggestPayout) {
      const h = recap.highlights.biggestPayout;
      md += `- Biggest payout: ${h.player} hit '${h.text}' at ${formatDanishNumber(h.odds)}x\n`;
    }
    if (recap.highlights.biggestWhiff) {
      const h = recap.highlights.biggestWhiff;
      md += `- Biggest whiff: ${h.player} bet on '${h.text}' at ${formatDanishNumber(h.odds)}x\n`;
    }
    md += "\n";
  }

  if (recap.eliminations.length) {
    md += "\u274C ELIMINATIONS:\n";
    for (const e of recap.eliminations) {
      const callerNames = e.calledBy.map((i) => PLAYER_NAMES[i]);
      if (callerNames.length) {
        md += `- ${e.contestantName} went home. Called by ${callerNames.join(" and ")}.\n`;
      } else {
        md += `- ${e.contestantName} went home. Nobody saw it coming.\n`;
      }
    }
    md += "\n";
  }

  md += "\uD83C\uDFC6 SEASON STANDINGS:\n";
  recap.seasonStandings.forEach((s) => {
    const name = PLAYER_NAMES[s.playerIndex];
    md += `- ${name} \u2014 ${formatDanishNumber(s.totalPoints)} pts\n`;
  });

  md += `\n\uD83D\uDC98 CONTESTANTS REMAINING:\n`;
  md += `- ${recap.nextWeek.contestantsRemaining}!`;
  return md.trim();
}

function renderWeeklyRecap() {
  const root = document.getElementById("weekly-recap-cards");
  const progress = document.getElementById("weekly-recap-progress");
  if (!root) return;
  root.innerHTML = "";
  if (progress) progress.innerHTML = "";

  const allWeeks = getAllWeekIds();
  const RANK_LABELS = ["01", "02", "03", "04"];

  const currentWeek = allWeeks.find((wid) => !isWeekComplete(wid));
  if (currentWeek && progress) {
    const eps = getEpisodesForWeek(currentWeek);
    const closedCount = eps.filter((ep) => isEpisodeClosed(ep)).length;
    const sortedWeeks = allWeeks.slice().sort();
    const currentWeekNum = sortedWeeks.indexOf(currentWeek) + 1;
    const strip = document.createElement("div");
    strip.className = "weekly-recap-progress__strip";
    strip.textContent = `Week ${currentWeekNum} in progress`;
    progress.append(strip);
  }

  const completeWeeks = allWeeks.filter((wid) => isWeekComplete(wid));
  if (!completeWeeks.length) {
    const empty = document.createElement("p");
    empty.className = "panel__hint";
    empty.textContent = "No closed weeks yet. Close a week to see its summary.";
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
    header.addEventListener("click", (e) => {
      if (e.target.closest(".recap-card__copy")) return;
      card.classList.toggle("recap-card--collapsed");
    });
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "btn btn--ghost recap-card__copy";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const md = generateRecapMarkdown(recap);
      navigator.clipboard.writeText(md).then(() => showToast("Copied!")).catch(() => showToast("Could not copy"));
    });
    const toggle = document.createElement("span");
    toggle.className = "recap-card__toggle";
    header.append(title, copyBtn, toggle);
    card.append(header);

    const cardBody = document.createElement("div");
    cardBody.className = "recap-card__body";

    // ── Section A: Scoreboard ──
    const sbSection = document.createElement("section");
    sbSection.className = "recap-section";
    const sbTitle = document.createElement("h4");
    sbTitle.className = "recap-section__title";
    sbTitle.textContent = "Scoreboard";
    sbSection.append(sbTitle);
    const sbThursdayEp = getThursdayEpisodeForWeek(weekId);
    const sbNuttetPicks = sbThursdayEp ? getNuttetForWeek(sbThursdayEp.id) : {};
    recap.scoreboard.forEach((s, idx) => {
      const row = document.createElement("div");
      row.className = "recap-sb-row" + (idx === 0 ? " recap-sb-row--winner" : "");
      const rank = document.createElement("span");
      rank.className = "recap-sb-row__rank";
      rank.textContent = RANK_LABELS[idx] || `${s.rank}.`;
      const name = document.createElement("span");
      name.className = "recap-sb-row__name";
      name.textContent = PLAYER_NAMES[s.playerIndex];
      const pts = document.createElement("span");
      pts.className = "recap-sb-row__pts";
      pts.textContent = `${formatDanishNumber(s.weekPoints)} point`;
      const nuttetPick = sbNuttetPicks[s.playerIndex];
      const nuttetEl = document.createElement("span");
      nuttetEl.className = "recap-sb-row__nuttet";
      nuttetEl.textContent = nuttetPick ? `Nuttet: ${nuttetPick}` : "";
      row.append(rank, name, pts, nuttetEl);
      sbSection.append(row);
    });
    cardBody.append(sbSection);

    // ── Section B: Highlights ──
    const hl = recap.highlights;
    const hlItems = [];
    if (hl.biggestPayout) {
      hlItems.push({
        icon: "",
        title: "Biggest payout",
        text: `${hl.biggestPayout.player} hit '${hl.biggestPayout.text}' at ${formatDanishNumber(hl.biggestPayout.odds)}x`,
        accent: "gold",
      });
    }
    if (hl.biggestWhiff) {
      hlItems.push({
        icon: "",
        title: "Biggest whiff",
        text: `${hl.biggestWhiff.player} bet on '${hl.biggestWhiff.text}' at ${formatDanishNumber(hl.biggestWhiff.odds)}x. It didn\u2019t happen.`,
        accent: "coral",
      });
    }
    if (hl.hotStreak) {
      hlItems.push({
        icon: "",
        title: "Hot streak",
        text: `${hl.hotStreak.player} is on a ${hl.hotStreak.count}-week streak`,
        accent: "purple",
      });
    }
    if (hl.mostPlayedEvent) {
      const mp = hl.mostPlayedEvent;
      const verb = mp.hit ? "It happened!" : "It didn\u2019t happen.";
      hlItems.push({
        icon: "",
        title: "Most played event",
        text: `${mp.count} of you bet on '${mp.text}'. ${verb}`,
        accent: mp.hit ? "gold" : "coral",
      });
    }
    if (hlItems.length) {
      const hlSection = document.createElement("section");
      hlSection.className = "recap-section";
      const hlTitle = document.createElement("h4");
      hlTitle.className = "recap-section__title";
      hlTitle.textContent = "Highlights";
      hlSection.append(hlTitle);
      const hlGrid = document.createElement("div");
      hlGrid.className = "recap-highlights";
      for (const item of hlItems) {
        const hlCard = document.createElement("div");
        hlCard.className = `recap-hl-card recap-hl-card--${item.accent}`;
        const hlBody = document.createElement("div");
        hlBody.className = "recap-hl-card__body";
        const hlH = document.createElement("strong");
        hlH.className = "recap-hl-card__title";
        hlH.textContent = item.title;
        const hlP = document.createElement("p");
        hlP.className = "recap-hl-card__text";
        hlP.textContent = item.text;
        hlBody.append(hlH, hlP);
        hlCard.append(hlBody);
        hlGrid.append(hlCard);
      }
      hlSection.append(hlGrid);
      cardBody.append(hlSection);
    }

    // ── Section D: Rose ceremony ──
    if (recap.eliminations.length || recap.highlights.eliminationCallText === "No eliminations this week") {
      const roseSection = document.createElement("section");
      roseSection.className = "recap-section recap-section--ceremony";
      const roseTitle = document.createElement("h4");
      roseTitle.className = "recap-section__title";
      roseTitle.textContent = "Rose ceremony";
      roseSection.append(roseTitle);
      if (!recap.eliminations.length) {
        const p = document.createElement("p");
        p.className = "recap-section__note";
        p.textContent = "No eliminations this week";
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
            callers.textContent = "Called by " + el.calledBy.map((i) => PLAYER_NAMES[i]).join(", ");
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
    standTitle.textContent = "Season standings";
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
      row.append(rankEl, nameEl, ptsEl);
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
        streak.textContent = `Streak ${s.streakCount}`;
        row.append(streak);
      }
      if (s.distanceToFirst > 0) {
        const dist = document.createElement("span");
        dist.className = "recap-stand-row__dist";
        dist.textContent = `${formatDanishNumber(s.distanceToFirst)} pts behind`;
        row.append(dist);
      }
      standSection.append(row);
    }
    const remaining = document.createElement("p");
    remaining.className = "recap-section__note";
    remaining.textContent = `Contestants remaining: ${recap.nextWeek.contestantsRemaining}`;
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
    banner.innerHTML = `<span>Week ${seasonWeekNum} summary is ready</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--secondary recap-ready-banner__btn";
    btn.textContent = "View summary";
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
  safe(renderAbout, "renderAbout");
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
      showToast("Event bets auto-låst for " + episodeTabLabel(idx));
    }
    if (shouldAutoLockElim(ep, now)) {
      ep.elimBetsLocked = true;
      changed = true;
      const idx = state.episodes.indexOf(ep);
      showToast("Elimination bets auto-låst for " + episodeTabLabel(idx));
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
  el.textContent = "Next lock: " + episodeTabLabel(soonestIdx) + " \u2014 " + formatCountdown(soonest.betsLockDeadline);
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
        showToast("Bets for " + episodeTabLabel(idx) + " lock in " + formatCountdown(ep.betsLockDeadline) + ". Have you picked?");
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
