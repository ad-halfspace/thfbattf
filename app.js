const STORAGE_KEY = "bachelorette-bets-v1";
const MAX_BETS = 3;
const PLAYER_COUNT = 4;
const PLAYER_NAMES = ["Malle", "Dulde", "Yas", "Thiller"];
const OVERVIEW = "overview";
const CAST = "cast";
const EVENT_BANK = "event-bank";

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
  const builtIn = builtInBetEvents()
    .filter((ev) => !hidden.has(ev.text))
    .map((ev) => {
      const o = { ...ev, _origText: ev.text };
      if (overrides[ev.text] != null) o.odds = overrides[ev.text];
      if (textOverrides[ev.text]) o.text = textOverrides[ev.text];
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

function castPhotoByName(name) {
  const n = name.trim().toLowerCase();
  const match = CAST_BA4_2026.find((c) => c.name.toLowerCase() === n);
  return match?.photo || null;
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
      episodes.some((e) => e.id === activeTab);
    if (!tabOk) {
      activeTab = OVERVIEW;
    }
    const { activeEpisodeId: _legacy, playerNames: _oldNames, ...rest } = parsed;
    const result = { ...defaultState(), ...rest, episodes, activeTab };
    if (!Array.isArray(result.customBankEvents)) result.customBankEvents = [];
    if (!Array.isArray(result.hiddenBankEvents)) result.hiddenBankEvents = [];
    if (!result.bankOddsOverrides || typeof result.bankOddsOverrides !== "object") result.bankOddsOverrides = {};
    if (!result.bankTextOverrides || typeof result.bankTextOverrides !== "object") result.bankTextOverrides = {};
    if (!result.eliminationBets || typeof result.eliminationBets !== "object") result.eliminationBets = {};
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
  if (state.activeTab === OVERVIEW || state.activeTab === CAST || state.activeTab === EVENT_BANK) return;
  if (!getEpisode(state.activeTab)) {
    state.activeTab = state.episodes[0]?.id ?? OVERVIEW;
    saveState();
  }
}

function activeEpisode() {
  if (state.activeTab === OVERVIEW || state.activeTab === CAST || state.activeTab === EVENT_BANK) return null;
  return getEpisode(state.activeTab);
}

function isEpisodeClosed(ep) {
  return ep?.closed === true;
}

function ensureEpisodeMaps(epId) {
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

function episodePoints(ep) {
  ensureEpisodeMaps(ep.id);
  ensureEliminatedArray(ep);
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

function updateViewVisibility() {
  const viewOverview = document.getElementById("view-overview");
  const viewCast = document.getElementById("view-cast");
  const viewEventBank = document.getElementById("view-event-bank");
  const episodeMain = document.getElementById("episode-workspace");
  const extras = document.getElementById("episode-extras");
  const onOverview = state.activeTab === OVERVIEW;
  const onCast = state.activeTab === CAST;
  const onEventBank = state.activeTab === EVENT_BANK;
  const onEpisode = !onOverview && !onCast && !onEventBank;
  if (viewOverview) viewOverview.hidden = !onOverview;
  if (viewCast) viewCast.hidden = !onCast;
  if (viewEventBank) viewEventBank.hidden = !onEventBank;
  if (episodeMain) episodeMain.hidden = !onEpisode;
  if (extras) extras.hidden = !onEpisode;
  const closeBtn = document.getElementById("close-episode");
  const reopenBtn = document.getElementById("reopen-episode");
  if (onEpisode) {
    const ep = activeEpisode();
    const closed = ep ? isEpisodeClosed(ep) : false;
    if (closeBtn) closeBtn.hidden = closed;
    if (reopenBtn) reopenBtn.hidden = !closed;
  } else {
    if (closeBtn) closeBtn.hidden = true;
    if (reopenBtn) reopenBtn.hidden = true;
  }
}

function renderOverview() {
  const root = document.getElementById("cast-grid");
  if (!root) return;
  root.innerHTML = "";
  CAST_BA4_2026.forEach((c) => {
    const card = document.createElement("article");
    card.className = "cast-card";
    const fig = document.createElement("div");
    fig.className = "cast-card__photo-wrap";
    const img = document.createElement("img");
    img.className = "cast-card__photo";
    img.src = c.photo;
    img.alt = `Portrætfoto — ${c.name}`;
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 480;
    img.height = 320;
    fig.append(img);
    const body = document.createElement("div");
    body.className = "cast-card__body";
    const h = document.createElement("h3");
    h.className = "cast-card__name";
    h.textContent = c.name;
    const meta = document.createElement("p");
    meta.className = "cast-card__meta";
    meta.textContent = `${c.age} år`;
    const job = document.createElement("p");
    job.className = "cast-card__job";
    job.textContent = c.occupation;
    body.append(h, meta, job);
    card.append(fig, body);
    root.append(card);
  });
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


function addMasterEventToEpisode(epId, text, odds) {
  const ep = getEpisode(epId);
  if (!ep) return false;
  const t = text.trim();
  if (ep.events.some((e) => e.text.trim() === t)) {
    alert("That episode already has this event.");
    return false;
  }
  ep.events.push({ id: uid(), text: t, odds: Number(odds) || 2 });
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
    const hadOptions = catFilter.options.length > 1;
    if (!hadOptions) {
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
    }
    if (prevCat) catFilter.value = prevCat;
  }

  list.innerHTML = "";
  const q = bankFilterQuery();
  const catVal = bankCategoryFilter();
  const allRows = masterBetEvents();
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

    items.forEach(({ text, odds, category, _origText }) => {
      const isCustom = !category || category === "_custom";
      const row = document.createElement("div");
      row.className = "event-bank-row";

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
        row.insertBefore(input, textEl.nextSibling);
        input.focus();
        input.select();
      });

      const meta = document.createElement("div");
      meta.className = "event-bank-row__meta";
      const oddsInput = document.createElement("input");
      oddsInput.type = "number";
      oddsInput.className = "input event-bank-row__odds-input";
      oddsInput.min = "1.1";
      oddsInput.max = "99";
      oddsInput.step = "0.1";
      oddsInput.value = Number(odds).toFixed(1);
      oddsInput.title = "Adjust odds";
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
        addMasterEventToEpisode(epId, text, customOdds);
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
        }
        saveState();
        populateMasterEventDatalist();
        renderEventBank();
      });
      meta.append(oddsInput, timesLabel, btn, rm);
      row.append(textEl, meta);
      body.append(row);
    });

    body.hidden = false;
    section.append(header, body);
    list.append(section);
  });
}

function renderMainTabs() {
  const root = document.getElementById("main-tabs");
  root.innerHTML = "";

  const ovBtn = document.createElement("button");
  ovBtn.type = "button";
  ovBtn.className = "tab";
  ovBtn.textContent = "Overview";
  ovBtn.setAttribute("role", "tab");
  ovBtn.setAttribute("aria-selected", state.activeTab === OVERVIEW ? "true" : "false");
  ovBtn.addEventListener("click", () => {
    state.activeTab = OVERVIEW;
    saveState();
    renderMainTabs();
    updateViewVisibility();
    renderLeaderboard();
  });
  root.append(ovBtn);

  const castBtn = document.createElement("button");
  castBtn.type = "button";
  castBtn.className = "tab";
  castBtn.textContent = "Bejlere";
  castBtn.setAttribute("role", "tab");
  castBtn.setAttribute("aria-selected", state.activeTab === CAST ? "true" : "false");
  castBtn.addEventListener("click", () => {
    state.activeTab = CAST;
    saveState();
    renderMainTabs();
    updateViewVisibility();
  });
  root.append(castBtn);

  const bankBtn = document.createElement("button");
  bankBtn.type = "button";
  bankBtn.className = "tab";
  bankBtn.textContent = "Bet bank";
  bankBtn.setAttribute("role", "tab");
  bankBtn.setAttribute("aria-selected", state.activeTab === EVENT_BANK ? "true" : "false");
  bankBtn.addEventListener("click", () => {
    state.activeTab = EVENT_BANK;
    saveState();
    renderMainTabs();
    updateViewVisibility();
    renderEventBank();
  });
  root.append(bankBtn);

  state.episodes.forEach((ep, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab" + (ep.closed ? " tab--closed" : "");
    btn.textContent = episodeTabLabel(idx) + (ep.closed ? " \u2713" : "");
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", ep.id === state.activeTab ? "true" : "false");
    btn.addEventListener("click", () => {
      state.activeTab = ep.id;
      saveState();
      renderMainTabs();
      updateViewVisibility();
      renderEpisodeContent();
      renderLeaderboard();
    });
    root.append(btn);
  });
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
    const ini = document.createElement("span");
    ini.className = "guy-chip__initial";
    ini.textContent = initials(g.name);
    const name = document.createElement("span");
    name.textContent = g.name;
    if (!closed) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove ${g.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", () => {
        ep.guys = ep.guys.filter((x) => x.id !== g.id);
        saveState();
        renderGuys();
        renderEliminationBets();
        renderEliminations();
        renderLeaderboard();
      });
      chip.append(ini, name, remove);
    } else {
      chip.append(ini, name);
    }
    root.append(chip);
  });
}

function renderEvents() {
  const ep = activeEpisode();
  const root = document.getElementById("events-list");
  root.innerHTML = "";
  if (!ep) return;
  const closed = isEpisodeClosed(ep);
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
    if (closed) oddsInput.disabled = true;
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
  for (const ev of ep.events) {
    if (ev.id !== selectedId && blocked.has(ev.id)) continue;
    const sel = ev.id === selectedId ? " selected" : "";
    html += `<option value="${ev.id}"${sel}>${escapeHtml(ev.text)} (${Number(ev.odds).toFixed(1)}×)</option>`;
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
  const closed = isEpisodeClosed(ep);

  for (let p = 0; p < PLAYER_COUNT; p++) {
    const card = document.createElement("div");
    card.className = "bet-card";
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
      if (closed) select.disabled = true;
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
  ensureEpisodeMaps(ep.id);
  const closed = isEpisodeClosed(ep);

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
  if (oddsNote) oddsNote.textContent = `(${odds.toFixed(1)}× if correct — scales with number of guys)`;

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
    if (closed) select.disabled = true;
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
  const parts = PLAYER_NAMES.map((name, i) => {
    return `<strong>${escapeHtml(name)}</strong>: ${pts[i].toFixed(2)} pts`;
  });
  el.innerHTML = `This episode: ${parts.join(" · ")}`;
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
    for (const ev of ep.events) {
      if (!occurred.has(ev.id)) continue;
      const key = ev.text.trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function renderOverviewPanels() {
  const runRoot = document.getElementById("overview-running-guys");
  const evRoot = document.getElementById("overview-event-stats");
  if (!runRoot || !evRoot) return;

  runRoot.innerHTML = "";
  getRunningGuyNames().forEach((name) => {
    const chip = document.createElement("span");
    chip.className = "overview-chip";
    chip.textContent = name;
    runRoot.append(chip);
  });

  evRoot.innerHTML = "";
  const ranked = getEventOccurrenceCounts();
  if (!ranked.length) {
    const p = document.createElement("p");
    p.className = "panel__hint";
    p.style.margin = "0";
    p.textContent =
      "When you tick events that happened in each episode, they’ll rank here.";
    evRoot.append(p);
  } else {
    const ul = document.createElement("ul");
    ul.className = "overview-stats-list";
    ranked.forEach(([text, n]) => {
      const li = document.createElement("li");
      li.className = "overview-stats-row";
      const label = document.createElement("span");
      label.className = "overview-stats-text";
      label.textContent = text;
      const cnt = document.createElement("span");
      cnt.className = "overview-stats-count";
      cnt.textContent = `${n}×`;
      li.append(label, cnt);
      ul.append(li);
    });
    evRoot.append(ul);
  }
}

function renderLeaderboard() {
  const totals = totalPointsAllEpisodes();
  const root = document.getElementById("leaderboard");
  root.innerHTML = "";
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
    row.append(name, val);
    root.append(row);
  });
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

  for (const ep of state.episodes) {
    ensureEpisodeMaps(ep.id);
    const closed = isEpisodeClosed(ep);
    const elimOdds = eliminationOdds(ep);

    const playerRows = [];
    for (let p = 0; p < PLAYER_COUNT; p++) {
      const picks = (state.bets[ep.id][p] || []).filter(Boolean);
      const elimPick = state.eliminationBets[ep.id]?.[p] || "";
      if (!picks.length && !elimPick) continue;
      playerRows.push({ p, picks, elimPick });
    }
    if (!playerRows.length) continue;
    hasBets = true;

    const epBlock = document.createElement("div");
    epBlock.className = "ov-bets-episode";

    const epTitle = document.createElement("h4");
    epTitle.className = "ov-bets-episode__title";
    epTitle.textContent = ep.name || `Episode ${state.episodes.indexOf(ep) + 1}`;
    if (closed) {
      const badge = document.createElement("span");
      badge.className = "ov-bets-episode__closed";
      badge.textContent = "closed";
      epTitle.append(" ", badge);
    }
    epBlock.append(epTitle);

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
        const ev = ep.events.find((e) => e.id === eventId);
        if (!ev) continue;
        const row = document.createElement("div");
        row.className = "ov-bet-row";

        const label = document.createElement("span");
        label.className = "ov-bet-row__label";
        label.textContent = ev.text;

        const oddsLabel = document.createElement("span");
        oddsLabel.className = "ov-bet-row__odds";
        oddsLabel.textContent = `${Number(ev.odds).toFixed(1)}\u00D7`;

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

        row.append(label, oddsLabel, tag);
        betList.append(row);
      }

      playerSection.append(betList);
      epBlock.append(playerSection);
    }

    root.append(epBlock);
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
  if (workspace) {
    workspace.classList.toggle("episode--closed", closed);
  }
  const addGuySection = document.querySelector("#episode-workspace .inline-actions");
  const addEventSection = document.querySelector("#episode-workspace .add-event");
  if (addGuySection) addGuySection.hidden = closed;
  if (addEventSection) addEventSection.hidden = closed;

  const lockBanner = document.getElementById("episode-lock-banner");
  if (lockBanner) lockBanner.hidden = !closed;

  const closeBtn = document.getElementById("close-episode");
  const reopenBtn = document.getElementById("reopen-episode");
  if (closeBtn) closeBtn.hidden = closed;
  if (reopenBtn) reopenBtn.hidden = !closed;

  renderGuys();
  renderEvents();
  renderBets();
  renderEliminationBets();
  renderResults();
  renderEliminations();
  renderEpisodeScoreSummary();
}

function guysAfterEliminations(ep) {
  ensureEliminatedArray(ep);
  const elimSet = new Set(ep.eliminated);
  return ep.guys.filter((g) => !elimSet.has(g.name));
}

function wireActions() {
  document.getElementById("bank-event-search")?.addEventListener("input", () => {
    renderEventBank();
  });
  document.getElementById("bank-category-filter")?.addEventListener("change", () => {
    renderEventBank();
  });
  document.getElementById("add-custom-bank-event")?.addEventListener("click", () => {
    const textEl = document.getElementById("custom-bank-text");
    const oddsEl = document.getElementById("custom-bank-odds");
    const catEl = document.getElementById("custom-bank-category");
    const text = (textEl?.value ?? "").trim();
    let odds = Number.parseFloat(oddsEl?.value);
    const category = catEl?.value || "_custom";
    if (!text) { alert("Enter a bet description."); return; }
    if (Number.isNaN(odds) || odds < 1.1) odds = 2.0;
    const dupe = masterBetEvents().some((e) => e.text.trim().toLowerCase() === text.toLowerCase());
    if (dupe) { alert("That bet already exists in the bank."); return; }
    state.customBankEvents.push({ text, odds, category });
    saveState();
    textEl.value = "";
    oddsEl.value = "2.0";
    populateMasterEventDatalist();
    renderEventBank();
  });

  document.getElementById("add-episode").addEventListener("click", () => {
    const n = state.episodes.length + 1;
    const prevEp = state.episodes.length > 0 ? state.episodes[state.episodes.length - 1] : null;
    const carryGuys = prevEp ? guysAfterEliminations(prevEp).map((g) => ({ id: uid(), name: g.name })) : [];
    const newEp = {
      id: uid(),
      title: `Episode ${n}`,
      guys: carryGuys,
      events: [],
      eliminated: [],
    };
    state.episodes.push(newEp);
    state.activeTab = newEp.id;
    saveState();
    renderMainTabs();
    updateViewVisibility();
    renderEpisodeContent();
    renderLeaderboard();
    renderEventBank();
  });

  document.getElementById("add-guy").addEventListener("click", () => {
    const ep = activeEpisode();
    const input = document.getElementById("new-guy-name");
    const name = input.value.trim();
    if (!ep || !name) return;
    ep.guys.push({ id: uid(), name });
    input.value = "";
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
  newEventText.addEventListener("change", syncOddsFromBankIfMatch);
  newEventText.addEventListener("input", syncOddsFromBankIfMatch);

  document.getElementById("add-event").addEventListener("click", () => {
    const ep = activeEpisode();
    const textEl = document.getElementById("new-event-text");
    const oddsEl = document.getElementById("new-event-odds");
    const text = textEl.value.trim();
    let odds = Number.parseFloat(oddsEl.value);
    if (!ep || !text) return;
    if (Number.isNaN(odds) || odds < 1.1) odds = 2.0;
    ep.events.push({ id: uid(), text, odds });
    textEl.value = "";
    saveState();
    renderEvents();
    renderBets();
    renderResults();
    renderEpisodeScoreSummary();
    renderLeaderboard();
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
  document.getElementById("reset-data").addEventListener("click", handleReset);

  document.getElementById("close-episode")?.addEventListener("click", () => {
    const ep = activeEpisode();
    if (!ep) return;
    ep.closed = true;
    saveState();
    renderMainTabs();
    renderEpisodeContent();
  });

  document.getElementById("reopen-episode")?.addEventListener("click", () => {
    const ep = activeEpisode();
    if (!ep) return;
    if (!confirm("Reopen this episode? Be careful not to change finalized data by accident.")) return;
    ep.closed = false;
    saveState();
    renderMainTabs();
    renderEpisodeContent();
  });

  document.getElementById("delete-episode").addEventListener("click", deleteActiveEpisode);
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

function renderAll() {
  normalizeActiveTab();
  renderMainTabs();
  updateViewVisibility();
  renderOverview();
  if (activeEpisode()) renderEpisodeContent();
  renderLeaderboard();
  populateMasterEventDatalist();
  populateCustomCategorySelect();
  renderEventBank();
}

function init() {
  renderAll();
  wireActions();

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
    if (!Array.isArray(merged.customBankEvents)) merged.customBankEvents = [];
    if (!Array.isArray(merged.hiddenBankEvents)) merged.hiddenBankEvents = [];
    if (!merged.bankOddsOverrides || typeof merged.bankOddsOverrides !== "object") merged.bankOddsOverrides = {};
    if (!merged.bankTextOverrides || typeof merged.bankTextOverrides !== "object") merged.bankTextOverrides = {};
    if (!merged.eliminationBets || typeof merged.eliminationBets !== "object") merged.eliminationBets = {};
    state = merged;
    normalizeActiveTab();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();
    suppressFirebaseWrite = false;
  });
}

init();
