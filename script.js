const API_BASE = "https://wyhtzfglpqrwptbampee.supabase.co/rest/v1/ping-video";

const form = document.getElementById("search-form");
const resultsList = document.getElementById("results");
const statusEl = document.getElementById("status");
const titleEl = document.getElementById("results-title");
const metaEl = document.getElementById("results-meta");
const resetBtn = document.getElementById("reset-btn");
const heroSection = document.querySelector(".hero");
const searchCard = document.querySelector(".search-card");
const channelSelect = document.getElementById("channel");
const athleteSelect = document.getElementById("athlete");
const template = document.getElementById("result-item-template");
const resultsSection = document.querySelector(".results-section");
const detailView = document.getElementById("detail-view");
const detailTitle = document.getElementById("detail-title");
const detailChannel = document.getElementById("detail-channel");
const detailPlayer = document.getElementById("detail-player");
const detailPlayerNote = document.getElementById("detail-player-note");
const detailDescription = document.getElementById("detail-description");
const detailData = document.getElementById("detail-data");
const backBtn = document.getElementById("back-btn");
const paginationEl = document.getElementById("pagination");
const pagePrevBtn = document.getElementById("page-prev");
const pageNextBtn = document.getElementById("page-next");
const pageNumbersEl = document.getElementById("page-numbers");
const filtersPanel = document.getElementById("filters-panel");
const filtersToggleBtn = document.getElementById("filters-toggle-btn");
const homeBrandLinks = document.querySelectorAll(".home-brand-link");
const SUPABASE_API_KEY = window.APP_CONFIG?.supabaseApiKey || "";
const videoCache = new Map();
const PAGE_SIZE = 10;
const BASE_PATH = getBasePath();

let pagingState = {
  mode: "latest",
  currentPage: 1,
  totalItems: 0,
  totalPages: 1,
  lastSearchParams: null,
  clientRows: null,
  titleText: "Ultimi video"
};

init();

async function init() {
  bindEvents();
  await loadFilterOptions();
  await syncViewWithRoute();
}

function bindEvents() {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showHomeView();
    await runSearch();
  });

  if (filtersToggleBtn && filtersPanel) {
    filtersToggleBtn.addEventListener("click", () => {
      filtersPanel.open = !filtersPanel.open;
      filtersToggleBtn.setAttribute("aria-expanded", String(filtersPanel.open));
    });

    filtersPanel.addEventListener("toggle", () => {
      filtersToggleBtn.setAttribute("aria-expanded", String(filtersPanel.open));
    });
  }

  for (const link of homeBrandLinks) {
    link.addEventListener("click", async (event) => {
      event.preventDefault();
      await resetToInitialHome(true);
    });
  }

  resetBtn.addEventListener("click", async () => {
    await resetToInitialHome(false);
  });

  pagePrevBtn.addEventListener("click", async () => {
    if (pagingState.currentPage <= 1) {
      return;
    }
    await loadPage(pagingState.currentPage - 1);
  });

  pageNextBtn.addEventListener("click", async () => {
    if (pagingState.currentPage >= pagingState.totalPages) {
      return;
    }
    await loadPage(pagingState.currentPage + 1);
  });

  resultsList.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-video-id]");
    if (!link) {
      return;
    }

    event.preventDefault();
    const row = videoCache.get(link.dataset.videoId);
    if (!row) {
      return;
    }

    openDetailPage(row, true);
  });

  backBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    await goBackFromDetail();
  });

  window.addEventListener("popstate", async (event) => {
    await syncViewWithRoute(event.state || null);
  });
}

async function loadFilterOptions() {
  try {
    const result = await fetchRows("select=channel,atleti&limit=1000");
    const rows = result.rows;

    const channels = new Set();
    const athletes = new Set();

    for (const row of rows) {
      if (row.channel) {
        channels.add(row.channel);
      }

      if (Array.isArray(row.atleti)) {
        for (const name of row.atleti) {
          if (name) {
            athletes.add(name);
          }
        }
      }
    }

    fillSelect(channelSelect, [...channels].sort(localeCompareIt));
    fillSelect(athleteSelect, [...athletes].sort(localeCompareIt));
  } catch (error) {
    showStatus("Impossibile caricare le opzioni filtro.");
  }
}

async function loadLatestItems() {
  pagingState.mode = "latest";
  pagingState.lastSearchParams = null;
  pagingState.clientRows = null;
  pagingState.titleText = "Ultimi video";
  await loadPage(1);
}

async function runSearch() {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "upload_date.desc");

  const text = form.q.value.trim();
  const channel = form.channel.value;
  const athlete = form.athlete.value;
  const dateFrom = form.dateFrom.value;
  const dateTo = form.dateTo.value;
  const viewsMin = form.viewsMin.value;
  const durationMax = form.durationMax.value;

  applyStructuredFilters(query, {
    channel,
    athlete,
    dateFrom,
    dateTo,
    viewsMin,
    durationMax
  });

  if (!hasActiveFilters({
    q: text,
    channel,
    athlete,
    dateFrom,
    dateTo,
    viewsMin,
    durationMax
  })) {
    await loadLatestItems();
    return;
  }

  pagingState.titleText = text ? `Risultati per \"${text}\"` : "Risultati filtrati";

  if (text) {
    try {
      const candidates = await fetchAllRows(query, 500, 5000);
      const filtered = candidates.filter((row) => matchesSearchText(row, text));
      pagingState.mode = "search-local";
      pagingState.lastSearchParams = null;
      pagingState.clientRows = filtered;
      await loadPage(1);
      return;
    } catch (error) {
      renderResults([]);
      renderPagination(true);
      showStatus("Errore durante la ricerca. Controlla endpoint e permessi.");
      return;
    }
  }

  pagingState.mode = "search";
  pagingState.clientRows = null;
  pagingState.lastSearchParams = query;
  await loadPage(1);
}

async function fetchRows(queryString, withCount = false) {
  if (!SUPABASE_API_KEY) {
    throw new Error("Missing SUPABASE_API_KEY");
  }

  const url = `${API_BASE}?${queryString}`;
  const headers = {
    Accept: "application/json",
    apikey: SUPABASE_API_KEY,
    Authorization: `Bearer ${SUPABASE_API_KEY}`
  };

  if (withCount) {
    headers.Prefer = "count=exact";
  }

  const response = await fetch(url, {
    headers
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const rows = await response.json();
  const contentRange = response.headers.get("content-range") || "";
  const total = parseTotalFromContentRange(contentRange);
  return {
    rows,
    total
  };
}

function renderResults(rows) {
  showHomeView();
  resultsList.innerHTML = "";

  for (const row of rows) {
    videoCache.set(String(row.id), row);

    const item = template.content.firstElementChild.cloneNode(true);
    const thumbLink = item.querySelector(".thumb-wrap");
    const thumb = item.querySelector(".thumb");
    const title = item.querySelector(".title-link");
    const meta = item.querySelector(".meta");

    const internalUrl = buildVideoPath(row);
    const titleText = row.title_it || row.title_en || row.id || "Video senza titolo";

    thumbLink.href = internalUrl;
    title.href = internalUrl;
    thumbLink.dataset.videoId = String(row.id || "");
    title.dataset.videoId = String(row.id || "");
    title.textContent = titleText;
    thumb.src = row.thumbnail || "https://placehold.co/640x360/e7eef1/10333a?text=No+Thumbnail";
    thumb.alt = `Anteprima ${titleText}`;

    const parts = [];
    if (row.channel) {
      parts.push(row.channel);
    }
    if (row.upload_date) {
      parts.push(formatUploadDate(row.upload_date));
    }
    if (typeof row.view_count === "number") {
      parts.push(`${row.view_count.toLocaleString("it-IT")} views`);
    }

    meta.textContent = parts.join(" • ");
    resultsList.appendChild(item);
  }
}

function renderLoading() {
  showHomeView();
  paginationEl.classList.add("hidden");
  resultsList.innerHTML = "";
  const item = document.createElement("li");
  item.className = "meta";
  item.textContent = "Caricamento in corso...";
  resultsList.appendChild(item);
}

async function syncViewWithRoute(routeState = null) {
  const videoId = parseVideoIdFromPath(window.location.pathname);
  if (!videoId) {
    if (routeState?.view === "home" && routeState.listState) {
      await restoreListState(routeState.listState);
      return;
    }
    await loadLatestItems();
    return;
  }

  await openDetailById(videoId, false);
}

async function openDetailById(videoId, pushHistory) {
  const id = String(videoId || "");
  if (!id) {
    await navigateHome(false);
    return;
  }

  let row = videoCache.get(id);
  if (!row) {
    const query = new URLSearchParams();
    query.set("select", "*");
    query.set("id", `eq.${id}`);
    query.set("limit", "1");
    const result = await fetchRows(query.toString());
    row = result.rows[0];
  }

  if (!row) {
    showStatus("Video non trovato.");
    await navigateHome(false);
    return;
  }

  openDetailPage(row, pushHistory);
}

function openDetailPage(row, pushHistory) {
  videoCache.set(String(row.id), row);

  const titleText = row.title_it || row.title_en || row.id || "Video";
  const channelText = row.channel || "Canale n/d";
  const descriptionText = row.description_it || row.description_en || "Descrizione non disponibile.";

  detailTitle.textContent = titleText;
  detailChannel.textContent = `${channelText} • ${formatUploadDate(row.upload_date)}`;
  detailDescription.textContent = descriptionText;

  const embedUrl = buildEmbedUrl(row.id);
  if (embedUrl) {
    detailPlayer.src = embedUrl;
    detailPlayer.classList.remove("hidden");
    detailPlayerNote.textContent = "";
  } else {
    detailPlayer.src = "";
    detailPlayer.classList.add("hidden");
    detailPlayerNote.textContent = "Questo elemento non e un video YouTube embeddabile.";
  }

  renderDetailData(row);
  showDetailView();
  clearStatus();

  if (pushHistory) {
    const listState = getCurrentListState();
    persistListState();
    window.history.pushState({ view: "detail", id: row.id, listState }, "", buildVideoPath(row));
  }

  document.title = `${titleText} | ${channelText} | Ping Video Search`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function navigateHome(pushHistory) {
  showHomeView();
  if (pushHistory) {
    window.history.pushState({ view: "home" }, "", buildAppPath(""));
  }
  document.title = "Ping Video Search";
  await loadLatestItems();
}

async function goBackFromDetail() {
  const currentState = window.history.state;
  const savedListState = currentState?.view === "detail" ? currentState.listState : null;

  if (savedListState) {
    await restoreListState(savedListState);
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  await resetToInitialHome(true);
}

async function resetToInitialHome(pushHistory) {
  form.reset();

  if (filtersPanel) {
    filtersPanel.open = false;
  }
  if (filtersToggleBtn) {
    filtersToggleBtn.setAttribute("aria-expanded", "false");
  }

  clearStatus();
  await navigateHome(pushHistory);
}

async function loadPage(page, customTitle = "") {
  clearStatus();
  renderLoading();
  const safePage = Math.max(1, Number(page) || 1);
  const from = (safePage - 1) * PAGE_SIZE;

  if (pagingState.mode === "search-local") {
    const allRows = pagingState.clientRows || [];
    const totalItems = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
    pagingState.currentPage = Math.min(safePage, totalPages);
    pagingState.totalItems = totalItems;
    pagingState.totalPages = totalPages;

    const start = (pagingState.currentPage - 1) * PAGE_SIZE;
    const rows = allRows.slice(start, start + PAGE_SIZE);
    renderResults(rows);
    renderPagination();
    titleEl.textContent = pagingState.titleText || customTitle || "Risultati filtrati";
    metaEl.textContent = `${totalItems} risultati • Pagina ${pagingState.currentPage} di ${pagingState.totalPages}`;
    persistListState();

    if (!rows.length) {
      showStatus("Nessun risultato con i filtri selezionati.");
    }
    return;
  }

  const query = pagingState.mode === "search" && pagingState.lastSearchParams
    ? new URLSearchParams(pagingState.lastSearchParams)
    : new URLSearchParams("select=*&order=upload_date.desc.nullslast");

  query.set("limit", String(PAGE_SIZE));
  query.set("offset", String(from));

  try {
    const result = await fetchRows(query.toString(), true);
    const rows = result.rows;
    const totalItems = result.total ?? rows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

    pagingState.currentPage = Math.min(safePage, totalPages);
    pagingState.totalItems = totalItems;
    pagingState.totalPages = totalPages;

    renderResults(rows);
    renderPagination();

    if (pagingState.mode === "latest") {
      titleEl.textContent = "Ultimi 10 video";
    } else {
      titleEl.textContent = pagingState.titleText || customTitle || "Risultati filtrati";
    }

    metaEl.textContent = `${totalItems} risultati • Pagina ${pagingState.currentPage} di ${pagingState.totalPages}`;
    persistListState();

    if (!rows.length) {
      showStatus("Nessun risultato con i filtri selezionati.");
    }
  } catch (error) {
    renderResults([]);
    renderPagination(true);
    const genericMessage = pagingState.mode === "latest"
      ? "Errore nel caricamento iniziale. Verifica CORS o permessi API."
      : "Errore durante la ricerca. Controlla endpoint e permessi.";
    showStatus(genericMessage);
  }
}

function persistListState() {
  if (detailView && !detailView.classList.contains("hidden")) {
    return;
  }

  const snapshot = {
    view: "home",
    listState: getCurrentListState()
  };

  window.history.replaceState(snapshot, "", buildAppPath(""));
}

function getCurrentListState() {
  return {
    page: pagingState.currentPage || 1,
    mode: pagingState.mode || "latest",
    titleText: pagingState.titleText || "",
    filters: readFormFilters()
  };
}

async function restoreListState(listState) {
  const safeState = listState || {};
  const filters = safeState.filters || {};
  const targetPage = Math.max(1, Number(safeState.page) || 1);

  writeFormFilters(filters);

  const hasSearch = hasActiveFilters(filters);
  if (!hasSearch || safeState.mode === "latest") {
    await loadLatestItems();
  } else {
    if (safeState.titleText) {
      pagingState.titleText = safeState.titleText;
    }
    await runSearch();
  }

  if (targetPage > 1) {
    await loadPage(targetPage);
  }
}

function readFormFilters() {
  return {
    q: form.q.value || "",
    channel: form.channel.value || "",
    athlete: form.athlete.value || "",
    dateFrom: form.dateFrom.value || "",
    dateTo: form.dateTo.value || "",
    viewsMin: form.viewsMin.value || "",
    durationMax: form.durationMax.value || ""
  };
}

function writeFormFilters(filters) {
  const safe = filters || {};
  form.q.value = safe.q || "";
  form.channel.value = safe.channel || "";
  form.athlete.value = safe.athlete || "";
  form.dateFrom.value = safe.dateFrom || "";
  form.dateTo.value = safe.dateTo || "";
  form.viewsMin.value = safe.viewsMin || "";
  form.durationMax.value = safe.durationMax || "";
}

function hasActiveFilters(filters) {
  const safe = filters || {};
  return Boolean(
    String(safe.q || "").trim()
    || safe.channel
    || safe.athlete
    || safe.dateFrom
    || safe.dateTo
    || safe.viewsMin !== ""
    || safe.durationMax !== ""
  );
}

function renderPagination(forceHide = false) {
  if (forceHide || pagingState.totalItems <= PAGE_SIZE) {
    paginationEl.classList.add("hidden");
    pageNumbersEl.innerHTML = "";
    pagePrevBtn.disabled = true;
    pageNextBtn.disabled = true;
    return;
  }

  paginationEl.classList.remove("hidden");
  pagePrevBtn.classList.toggle("hidden", pagingState.currentPage <= 1);
  pageNextBtn.classList.toggle("hidden", pagingState.currentPage >= pagingState.totalPages);
  pagePrevBtn.disabled = pagingState.currentPage <= 1;
  pageNextBtn.disabled = pagingState.currentPage >= pagingState.totalPages;
  pageNumbersEl.innerHTML = "";

  const pages = buildVisiblePages(pagingState.currentPage, pagingState.totalPages);

  for (const page of pages) {
    if (page === "...") {
      const span = document.createElement("span");
      span.className = "page-ellipsis";
      span.textContent = "...";
      pageNumbersEl.appendChild(span);
      continue;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-btn";
    btn.textContent = String(page);
    if (page === pagingState.currentPage) {
      btn.setAttribute("aria-current", "page");
    }
    btn.addEventListener("click", async () => {
      if (page === pagingState.currentPage) {
        return;
      }
      await loadPage(page);
    });
    pageNumbersEl.appendChild(btn);
  }
}

function buildVisiblePages(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) {
    pages.push("...");
  }

  for (let i = start; i <= end; i += 1) {
    pages.push(i);
  }

  if (end < total - 1) {
    pages.push("...");
  }

  pages.push(total);
  return pages;
}

function applyStructuredFilters(query, filters) {
  const {
    channel,
    athlete,
    dateFrom,
    dateTo,
    viewsMin,
    durationMax
  } = filters;

  if (channel) {
    query.set("channel", `eq.${channel}`);
  }

  if (athlete) {
    query.set("atleti", `cs.{"${athlete.replaceAll('"', '\\"')}"}`);
  }

  if (dateFrom) {
    query.set("upload_date", `gte.${compactDate(dateFrom)}`);
  }

  if (dateTo) {
    query.append("upload_date", `lte.${compactDate(dateTo)}`);
  }

  if (viewsMin !== "") {
    query.set("view_count", `gte.${viewsMin}`);
  }

  if (durationMax !== "") {
    query.set("duration", `lte.${durationMax}`);
  }
}

async function fetchAllRows(baseQuery, batchSize = 500, maxRows = 5000) {
  const allRows = [];
  let offset = 0;

  while (offset < maxRows) {
    const query = new URLSearchParams(baseQuery);
    query.set("limit", String(batchSize));
    query.set("offset", String(offset));
    const result = await fetchRows(query.toString());
    const rows = result.rows || [];

    allRows.push(...rows);
    if (rows.length < batchSize) {
      break;
    }
    offset += batchSize;
  }

  return allRows;
}

function matchesSearchText(row, text) {
  const needle = normalizeSearchText(text);
  if (!needle) {
    return true;
  }

  const textFields = [row.title_it, row.title_en, row.description_it, row.description_en];
  for (const field of textFields) {
    if (normalizeSearchText(field).includes(needle)) {
      return true;
    }
  }

  const arrayFields = [row.tags, row.atleti];
  for (const arr of arrayFields) {
    if (!Array.isArray(arr)) {
      continue;
    }
    for (const item of arr) {
      if (normalizeSearchText(item).includes(needle)) {
        return true;
      }
    }
  }

  return false;
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function parseTotalFromContentRange(contentRange) {
  const match = String(contentRange || "").match(/\/(\d+|\*)$/);
  if (!match || match[1] === "*") {
    return null;
  }
  return Number(match[1]);
}

function showHomeView() {
  heroSection.classList.remove("hidden");
  searchCard.classList.remove("hidden");
  resultsSection.classList.remove("hidden");
  detailView.classList.add("hidden");
}

function showDetailView() {
  heroSection.classList.add("hidden");
  searchCard.classList.add("hidden");
  resultsSection.classList.add("hidden");
  detailView.classList.remove("hidden");
}

function renderDetailData(row) {
  detailData.innerHTML = "";
  const entries = Object.entries(row || {});

  for (const [key, value] of entries) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = formatDetailValue(value);
    detailData.appendChild(dt);
    detailData.appendChild(dd);
  }
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === "") {
    return "n/d";
  }

  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "[]";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function buildVideoPath(row) {
  const id = encodeURIComponent(String(row.id || "video"));
  const slug = slugify(`${row.channel || "canale"} ${row.title_it || row.title_en || "video"}`);
  return buildAppPath(`video/${id}/${slug}`);
}

function parseVideoIdFromPath(pathname) {
  const relativePath = stripBasePath(pathname);
  const match = String(relativePath || "").match(/^\/video\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function getBasePath() {
  const baseHref = document.querySelector("base")?.getAttribute("href") || "/";
  const normalized = String(baseHref).replace(/\/+$/, "") || "/";
  return normalized === "/" ? "" : normalized;
}

function buildAppPath(relativePath) {
  const clean = String(relativePath || "").replace(/^\/+/, "");
  if (!BASE_PATH) {
    return clean ? `/${clean}` : "/";
  }
  return clean ? `${BASE_PATH}/${clean}` : `${BASE_PATH}/`;
}

function stripBasePath(pathname) {
  const path = String(pathname || "");
  if (!BASE_PATH || !path.startsWith(BASE_PATH)) {
    return path;
  }
  const stripped = path.slice(BASE_PATH.length);
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

function slugify(value) {
  return String(value || "video")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "video";
}

function buildEmbedUrl(id) {
  const videoId = String(id || "");
  if (!/^[A-Za-z0-9_-]{6,}$/.test(videoId) || videoId.startsWith("@")) {
    return "";
  }
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
}

function fillSelect(selectEl, values) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    selectEl.appendChild(option);
  }
}

function formatUploadDate(yyyymmdd) {
  if (yyyymmdd === null || yyyymmdd === undefined || yyyymmdd === "") {
    return "Data n/d";
  }

  const value = String(yyyymmdd);
  if (!/^\d{8}$/.test(value)) {
    return value;
  }

  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  return `${day}/${month}/${year}`;
}

function compactDate(dateValue) {
  return dateValue.replaceAll("-", "");
}

function localeCompareIt(a, b) {
  return a.localeCompare(b, "it", { sensitivity: "base" });
}

function showStatus(message) {
  showHomeView();
  statusEl.textContent = message;
}

function clearStatus() {
  statusEl.textContent = "";
}
