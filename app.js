// --- Demo catalog (replace / expand with your own TMDB IDs) ---
const CATALOG = {
  featured: {
    id: "119051",
    mediaType: "tv",
    title: "The Last of Us",
    desc: "Opens the Vidking embed player in a modal. Progress events are saved locally.",
    season: 1,
    episode: 8,
    accent: "e50914", // Netflix red
    autoPlay: true,
    nextEpisode: true,
    episodeSelector: true
  },
  rails: [
    {
      title: "Trending Now",
      sub: "Quick picks (demo data)",
      items: [
        { mediaType: "movie", id: "1078605", title: "Movie Demo (TMDB 1078605)", accent: "9146ff", autoPlay: true },
        { mediaType: "tv", id: "119051", title: "The Last of Us (S1E8)", season: 1, episode: 8, accent: "e50914", autoPlay: true, nextEpisode: true, episodeSelector: true },
        { mediaType: "movie", id: "299534", title: "Movie Demo (TMDB 299534)", accent: "0dcaf0", autoPlay: false },
        { mediaType: "movie", id: "634649", title: "Movie Demo (TMDB 634649)", accent: "22c55e", autoPlay: true },
        { mediaType: "tv", id: "1399", title: "TV Demo (TMDB 1399) S1E1", season: 1, episode: 1, accent: "4DA3FF", autoPlay: false, nextEpisode: true, episodeSelector: true }
      ]
    },
    {
      title: "Because you watched",
      sub: "More like this (demo)",
      items: [
        { mediaType: "movie", id: "27205", title: "Movie Demo (TMDB 27205)", accent: "f59e0b", autoPlay: true },
        { mediaType: "movie", id: "603692", title: "Movie Demo (TMDB 603692)", accent: "ec4899", autoPlay: false },
        { mediaType: "tv", id: "82856", title: "TV Demo (TMDB 82856) S1E1", season: 1, episode: 1, accent: "0dcaf0", autoPlay: false, nextEpisode: true, episodeSelector: true },
        { mediaType: "movie", id: "155", title: "Movie Demo (TMDB 155)", accent: "4DA3FF", autoPlay: false }
      ]
    },
    {
      title: "4K / Premium Feel",
      sub: "Big, glossy, cinematic UI",
      items: [
        { mediaType: "movie", id: "447277", title: "Movie Demo (TMDB 447277)", accent: "22c55e", autoPlay: true },
        { mediaType: "movie", id: "550", title: "Movie Demo (TMDB 550)", accent: "e50914", autoPlay: false },
        { mediaType: "tv", id: "60625", title: "TV Demo (TMDB 60625) S1E1", season: 1, episode: 1, accent: "9146ff", autoPlay: false, nextEpisode: true, episodeSelector: true }
      ]
    }
  ]
};

// --- Helpers ---
const $ = (sel) => document.querySelector(sel);

function buildEmbedUrl(item, { progressSeconds } = {}) {
  const base =
    item.mediaType === "movie"
      ? `https://www.vidking.net/embed/movie/${item.id}`
      : `https://www.vidking.net/embed/tv/${item.id}/${item.season ?? 1}/${item.episode ?? 1}`;

  const params = new URLSearchParams();
  if (item.accent) params.set("color", (item.accent || "").replace("#", ""));
  if (item.autoPlay) params.set("autoPlay", "true");
  if (item.mediaType === "tv") {
    if (item.nextEpisode) params.set("nextEpisode", "true");
    if (item.episodeSelector) params.set("episodeSelector", "true");
  }
  if (typeof progressSeconds === "number" && progressSeconds > 0) {
    params.set("progress", String(Math.floor(progressSeconds)));
  }

  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

function contentKey(item) {
  // unique-ish key for progress tracking
  if (item.mediaType === "movie") return `movie:${item.id}`;
  return `tv:${item.id}:s${item.season ?? 1}:e${item.episode ?? 1}`;
}

function saveProgress(key, payload) {
  localStorage.setItem(`vk_progress:${key}`, JSON.stringify(payload));
}
function loadProgress(key) {
  try {
    const raw = localStorage.getItem(`vk_progress:${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAccent(hex) {
  const clean = (hex || "").replace("#", "");
  const val = clean ? `#${clean}` : "#4DA3FF";
  document.documentElement.style.setProperty("--accent", val);
}

// --- UI render ---
const railsEl = $("#rails");
const pageTitleEl = $("#pageTitle");
const searchInput = $("#searchInput");
const searchHint = $("#searchHint");

const heroTitleEl = $("#heroTitle");
const heroDescEl = $("#heroDesc");
const heroMetaEl = $("#heroMeta");
const heroPlayBtn = $("#heroPlay");
const heroInfoBtn = $("#heroInfo");

const modal = $("#playerModal");
const modalBackdrop = $("#modalBackdrop");
const closeModalBtn = $("#closeModal");
const playerFrame = $("#playerFrame");
const modalTitleEl = $("#modalTitle");
const modalSubEl = $("#modalSub");
const messageArea = $("#messageArea");

const progressFill = $("#progressFill");
const progressText = $("#progressText");
const resumeBtn = $("#resumeBtn");
const copyLinkBtn = $("#copyLinkBtn");
const colorToggleBtn = $("#colorToggle");

let currentItem = null;
let currentEmbedUrl = "";
let sidebarOpen = false;

// Build cards
function cardHTML(item) {
  const key = contentKey(item);
  const last = loadProgress(key);
  const pct = last?.data?.progress ?? last?.progress ?? null;

  const badges = [];
  badges.push(item.mediaType.toUpperCase());
  badges.push(`TMDB ${item.id}`);
  if (item.mediaType === "tv") badges.push(`S${item.season ?? 1}E${item.episode ?? 1}`);
  if (typeof pct === "number") badges.push(`${pct.toFixed(0)}%`);

  return `
    <div class="card" role="button" tabindex="0" data-item='${encodeURIComponent(JSON.stringify(item))}'>
      <div class="poster"></div>
      <div class="cardBody">
        <div class="cardTitle">${escapeHTML(item.title)}</div>
        <div class="cardMeta">
          ${badges.map(b => `<span class="badge">${escapeHTML(b)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderRails(filter = "") {
  const q = (filter || "").trim().toLowerCase();

  railsEl.innerHTML = CATALOG.rails
    .map((rail) => {
      const items = rail.items.filter((it) => {
        if (!q) return true;
        const hay = `${it.title} ${it.mediaType} ${it.id}`.toLowerCase();
        return hay.includes(q);
      });

      if (items.length === 0) return "";

      return `
        <div class="rail">
          <div class="railTop">
            <div>
              <div class="railTitle">${escapeHTML(rail.title)}</div>
              <div class="railSub">${escapeHTML(rail.sub)}</div>
            </div>
            <div class="railSub">${items.length} titles</div>
          </div>
          <div class="row">
            ${items.map(cardHTML).join("")}
          </div>
        </div>
      `;
    })
    .join("");

  // Bind clicks
  railsEl.querySelectorAll(".card").forEach((card) => {
    const openFromCard = () => {
      const raw = decodeURIComponent(card.getAttribute("data-item") || "");
      const item = JSON.parse(raw);
      openPlayer(item);
    };
    card.addEventListener("click", openFromCard);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") openFromCard();
    });
  });

  if (q) {
    searchHint.textContent = `Filtering: “${filter}”`;
  } else {
    searchHint.textContent = `Try “tv” or “movie”`;
  }
}

// Hero
function renderHero(item) {
  heroTitleEl.textContent = item.title;
  heroDescEl.textContent = item.desc || "Click Play to open the player.";
  heroMetaEl.innerHTML = `
    <span class="tag">${item.mediaType.toUpperCase()}</span>
    <span class="tag">TMDB: ${item.id}</span>
    ${
      item.mediaType === "tv"
        ? `<span class="tag">S${item.season ?? 1} · E${item.episode ?? 1}</span>`
        : `<span class="tag">Movie</span>`
    }
  `;
  setAccent(item.accent || "4DA3FF");

  heroPlayBtn.onclick = () => openPlayer(item);
  heroInfoBtn.onclick = () => {
    const key = contentKey(item);
    const last = loadProgress(key);
    const pct = last?.data?.progress ?? last?.progress ?? 0;
    alert(`Saved progress for this title: ${pct ? pct.toFixed(0) : 0}% (localStorage)`);
  };
}

// Modal controls
function openModal() {
  modal.classList.add("isOpen");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  modal.classList.remove("isOpen");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  playerFrame.src = "";
  currentItem = null;
  currentEmbedUrl = "";
  progressFill.style.width = "0%";
  progressText.textContent = "0%";
  messageArea.textContent = "Waiting for player events…";
}

function openPlayer(item, { resume = false } = {}) {
  currentItem = item;

  // Set accent for the session
  setAccent(item.accent || "4DA3FF");

  const key = contentKey(item);
  const last = loadProgress(key);
  const resumeSeconds =
    resume && last?.data?.currentTime ? Number(last.data.currentTime) :
    resume && last?.data?.timestamp ? Number(last.data.timestamp) : // fallback
    resume && last?.data?.progress ? null :
    resume && last?.currentTime ? Number(last.currentTime) :
    null;

  const url = buildEmbedUrl(item, {
    progressSeconds: (typeof resumeSeconds === "number" && resumeSeconds > 0) ? resumeSeconds : undefined
  });

  currentEmbedUrl = url;

  modalTitleEl.textContent = item.title;
  modalSubEl.textContent =
    item.mediaType === "tv"
      ? `TV · TMDB ${item.id} · S${item.season ?? 1}E${item.episode ?? 1}`
      : `Movie · TMDB ${item.id}`;

  // If we have saved progress percent, show it immediately
  const pct = last?.data?.progress ?? last?.progress ?? 0;
  if (typeof pct === "number") {
    progressFill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    progressText.textContent = `${pct.toFixed(0)}%`;
  }

  playerFrame.src = url;
  openModal();
}

// Escape
function escapeHTML(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// --- Player events (Vidking postMessage) ---
window.addEventListener("message", function (event) {
  // You may want to restrict origins in production:
  // if (event.origin !== "https://www.vidking.net") return;

  if (!currentItem) return;
  if (typeof event.data !== "string") return;

  // Their docs show the iframe posts JSON strings
  let parsed = null;
  try {
    parsed = JSON.parse(event.data);
  } catch {
    // If it's not JSON, still show it
    messageArea.textContent = String(event.data).slice(0, 220);
    return;
  }

  messageArea.textContent = JSON.stringify(parsed).slice(0, 240);

  if (parsed?.type === "PLAYER_EVENT" && parsed?.data) {
    const key = contentKey(currentItem);
    // Save the full payload; you'll have it for resume logic
    saveProgress(key, parsed);

    // Update UI progress
    const pct = parsed.data.progress;
    if (typeof pct === "number") {
      const clamped = Math.max(0, Math.min(100, pct));
      progressFill.style.width = `${clamped}%`;
      progressText.textContent = `${clamped.toFixed(0)}%`;
    }
  }
});

// --- Navigation ---
function setRoute(route) {
  const routes = ["home", "movies", "tv", "continue"];
  const r = routes.includes(route) ? route : "home";

  document.querySelectorAll(".navItem").forEach(btn => {
    btn.classList.toggle("isActive", btn.getAttribute("data-route") === r);
  });

  const title = r === "home" ? "Home"
    : r === "movies" ? "Movies"
    : r === "tv" ? "TV"
    : "Continue Watching";

  pageTitleEl.textContent = title;

  // Filter rails based on route
  if (r === "movies") renderRails("movie");
  else if (r === "tv") renderRails("tv");
  else if (r === "continue") {
    // show only items with saved progress
    const all = CATALOG.rails.flatMap(x => x.items);
    const withProgress = all.filter(it => {
      const last = loadProgress(contentKey(it));
      const pct = last?.data?.progress ?? last?.progress ?? 0;
      return typeof pct === "number" && pct > 0;
    });

    railsEl.innerHTML = `
      <div class="rail">
        <div class="railTop">
          <div>
            <div class="railTitle">Continue Watching</div>
            <div class="railSub">Titles with saved progress (localStorage)</div>
          </div>
          <div class="railSub">${withProgress.length} titles</div>
        </div>
        <div class="row">
          ${withProgress.length ? withProgress.map(cardHTML).join("") : `<div class="tiny">Nothing yet — play something first.</div>`}
        </div>
      </div>
    `;

    railsEl.querySelectorAll(".card").forEach((card) => {
      const raw = decodeURIComponent(card.getAttribute("data-item") || "");
      const item = JSON.parse(raw);
      card.addEventListener("click", () => openPlayer(item, { resume: true }));
    });
  } else {
    renderRails(searchInput.value);
  }

  // Close sidebar on mobile
  const sb = document.querySelector(".sidebar");
  if (sb && window.matchMedia("(max-width: 960px)").matches) {
    sb.classList.remove("isOpen");
    sidebarOpen = false;
  }
}

// --- Wire up UI events ---
document.querySelectorAll(".navItem").forEach(btn => {
  btn.addEventListener("click", () => setRoute(btn.getAttribute("data-route")));
});

$("#modalBackdrop").addEventListener("click", closeModal);
$("#closeModal").addEventListener("click", closeModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

$("#resumeBtn").addEventListener("click", () => {
  if (!currentItem) return;
  openPlayer(currentItem, { resume: true });
});

$("#copyLinkBtn").addEventListener("click", async () => {
  if (!currentEmbedUrl) return;
  try {
    await navigator.clipboard.writeText(currentEmbedUrl);
    alert("Copied embed URL!");
  } catch {
    prompt("Copy this URL:", currentEmbedUrl);
  }
});

searchInput.addEventListener("input", (e) => {
  const v = e.target.value || "";
  const active = document.querySelector(".navItem.isActive")?.getAttribute("data-route") || "home";
  if (active === "continue") return; // keep continue list intact
  renderRails(v);
});

colorToggleBtn.addEventListener("click", () => {
  // Rotate through a few “platform” accents
  const accents = ["4DA3FF", "e50914", "9146ff", "0dcaf0", "22c55e", "f59e0b", "ec4899"];
  const cur = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#4DA3FF";
  const curHex = cur.replace("#", "");
  const idx = accents.findIndex(a => a.toLowerCase() === curHex.toLowerCase());
  const next = accents[(idx + 1 + accents.length) % accents.length];
  setAccent(next);
});

const hamburger = document.querySelector(".hamburger");
hamburger.addEventListener("click", () => {
  const sb = document.querySelector(".sidebar");
  sidebarOpen = !sidebarOpen;
  sb.classList.toggle("isOpen", sidebarOpen);
});

// --- Init ---
renderHero(CATALOG.featured);
renderRails();
setRoute("home");
