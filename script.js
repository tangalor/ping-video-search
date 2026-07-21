const API_BASE = "https://wyhtzfglpqrwptbampee.supabase.co/rest/v1/ping-video";

const form = document.getElementById("search-form");
const resultsList = document.getElementById("results");
const statusEl = document.getElementById("status");
const titleEl = document.getElementById("results-title");
const metaEl = document.getElementById("results-meta");
const resultsHeadEl = document.querySelector(".results-head");
const quickRangeLatestBtn = document.getElementById("quick-range-latest");
const quickRangeWeekBtn = document.getElementById("quick-range-week");
const quickRangeMonthBtn = document.getElementById("quick-range-month");
const indexedVideosInlineEl = document.getElementById("indexed-videos-inline");
const releaseVersionEl = document.getElementById("release-version");
const resetBtn = document.getElementById("reset-btn");
const heroSection = document.querySelector(".hero");
const searchCard = document.querySelector(".search-card");
const channelOptionsEl = document.getElementById("channel-options");
const channelSearchInput = document.getElementById("channel-search");
const channelToggleBtn = document.getElementById("channel-toggle-btn");
const channelClearBtn = document.getElementById("channel-clear-btn");
const channelTotalCount = document.getElementById("channel-total-count");
const footerChannelTotalCount = document.getElementById("footer-channel-total-count");
const channelSelectedCount = document.getElementById("channel-selected-count");
const athleteOptionsEl = document.getElementById("athlete");
const athleteSearchInput = document.getElementById("athlete-search");
const athleteToggleBtn = document.getElementById("athlete-toggle-btn");
const athleteClearBtn = document.getElementById("athlete-clear-btn");
const athleteTotalCount = document.getElementById("athlete-total-count");
const footerAthleteTotalCount = document.getElementById("footer-athlete-total-count");
const athleteSelectedCount = document.getElementById("athlete-selected-count");
const tagOptionsEl = document.getElementById("tag-options");
const tagSearchInput = document.getElementById("tag-search");
const tagToggleBtn = document.getElementById("tag-toggle-btn");
const tagClearBtn = document.getElementById("tag-clear-btn");
const tagTotalCount = document.getElementById("tag-total-count");
const tagSelectedCount = document.getElementById("tag-selected-count");
const dateRangePanel = document.getElementById("date-range-panel");
const dateRangeDisplay = document.getElementById("date-range-display");
const dateFromInput = document.getElementById("date-from");
const dateToInput = document.getElementById("date-to");
const dateRangeClearBtn = document.getElementById("date-range-clear");
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
const footerChannelLinksEl = document.getElementById("footer-channel-links");
const footerAthleteLinksEl = document.getElementById("footer-athlete-links");
const filtersPanel = document.getElementById("filters-panel");
const filtersToggleBtn = document.getElementById("filters-toggle-btn");
const homeBrandLinks = document.querySelectorAll(".home-brand-link");
const SUPABASE_API_KEY = window.APP_CONFIG?.supabaseApiKey || "";
const videoCache = new Map();
const DEFAULT_PAGE_SIZE = 10;
const LATEST_PAGE_SIZE = DEFAULT_PAGE_SIZE;
const LATEST_TOTAL_LIMIT = 30;
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

let hasInitialLatestResults = false;
let hasLoadedFilterOptions = false;
let filterOptionsLoadPromise = null;
let activeQuickRange = "latest";
let indexedVideoCount = null;
let releaseVersionValue = "--";
let footerChannelValues = [];
let footerAthleteValues = [];
let channelVideoCounts = new Map();
let athleteVideoCounts = new Map();
let tagVideoCounts = new Map();

const filterNoResultsState = {
  channel: false,
  athlete: false,
  tag: false
};

init();

async function init() {
  setupDateRangeInputs();
  bindEvents();
  await Promise.all([
    loadReleaseVersion(),
    loadIndexedVideoCount(),
    syncViewWithRoute()
  ]);
}

async function loadReleaseVersion() {
  if (!releaseVersionEl) {
    return;
  }

  try {
    const response = await fetch("release-version.txt?v=16", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const version = (await response.text()).trim();
    releaseVersionValue = version || "--";
    updateReleaseFooter();
  } catch {
    releaseVersionValue = "--";
    updateReleaseFooter();
  }
}

async function loadIndexedVideoCount() {
  if (!releaseVersionEl) {
    return;
  }

  try {
    const result = await fetchRows("select=id&limit=1&offset=0", true);
    if (typeof result.total === "number") {
      indexedVideoCount = result.total;
    } else if (Array.isArray(result.rows)) {
      indexedVideoCount = result.rows.length;
    } else {
      indexedVideoCount = null;
    }
  } catch {
    indexedVideoCount = null;
  }

  updateReleaseFooter();
}

function updateReleaseFooter() {
  if (!releaseVersionEl && !indexedVideosInlineEl) {
    return;
  }

  const countLabel = typeof indexedVideoCount === "number"
    ? `${indexedVideoCount} video indicizzati / `
    : "-- video indicizzati / ";

  if (indexedVideosInlineEl) {
    indexedVideosInlineEl.textContent = typeof indexedVideoCount === "number"
      ? `${indexedVideoCount} video indicizzati`
      : "-- video indicizzati";
  }

  if (releaseVersionEl) {
    releaseVersionEl.textContent = `${countLabel}Versione rilascio: ${releaseVersionValue || "--"}`;
  }
}

function bindEvents() {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showHomeView();
    await runSearch();
    scrollToResultsIfNeeded();
  });

  if (filtersToggleBtn && filtersPanel) {
    filtersToggleBtn.addEventListener("click", async () => {
      const nextOpen = !filtersPanel.open;
      filtersPanel.open = nextOpen;
      filtersToggleBtn.setAttribute("aria-expanded", String(filtersPanel.open));

      if (nextOpen) {
        await ensureFilterOptionsLoaded();
      }
    });

    filtersPanel.addEventListener("toggle", () => {
      filtersToggleBtn.setAttribute("aria-expanded", String(filtersPanel.open));
    });
  }

  if (athleteSearchInput) {
    athleteSearchInput.addEventListener("input", () => {
      filterAthleteOptions(athleteSearchInput.value || "");
    });
  }

  if (channelSearchInput) {
    channelSearchInput.addEventListener("input", () => {
      filterChannelOptions(channelSearchInput.value || "");
    });
  }

  if (channelToggleBtn && channelOptionsEl) {
    channelToggleBtn.addEventListener("click", async () => {
      await ensureFilterOptionsLoaded();
      const isCollapsed = channelOptionsEl.classList.toggle("is-collapsed");
      channelToggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
      filterChannelOptions(channelSearchInput?.value || "");
    });
  }

  if (channelClearBtn) {
    channelClearBtn.addEventListener("click", () => {
      setSelectedChannels([]);
    });
  }

  if (tagSearchInput) {
    tagSearchInput.addEventListener("input", () => {
      filterTagOptions(tagSearchInput.value || "");
    });
  }

  if (tagToggleBtn && tagOptionsEl) {
    tagToggleBtn.addEventListener("click", async () => {
      await ensureFilterOptionsLoaded();
      const isCollapsed = tagOptionsEl.classList.toggle("is-collapsed");
      tagToggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
      filterTagOptions(tagSearchInput?.value || "");
    });
  }

  if (athleteClearBtn) {
    athleteClearBtn.addEventListener("click", () => {
      setSelectedAthletes([]);
    });
  }

  if (tagClearBtn) {
    tagClearBtn.addEventListener("click", () => {
      setSelectedTags([]);
    });
  }

  if (channelOptionsEl) {
    channelOptionsEl.addEventListener("change", () => {
      updateChannelSelectionUi();
    });
  }

  if (athleteOptionsEl) {
    athleteOptionsEl.addEventListener("change", () => {
      updateAthleteSelectionUi();
    });
  }

  if (tagOptionsEl) {
    tagOptionsEl.addEventListener("change", () => {
      updateTagSelectionUi();
    });
  }

  if (footerChannelLinksEl) {
    footerChannelLinksEl.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-filter-value]");
      if (!button) {
        return;
      }

      await applyFooterQuickFilter("channel", button.dataset.filterValue || "");
    });
  }

  if (footerAthleteLinksEl) {
    footerAthleteLinksEl.addEventListener("click", async (event) => {
      const button = event.target.closest("button[data-filter-value]");
      if (!button) {
        return;
      }

      await applyFooterQuickFilter("athlete", button.dataset.filterValue || "");
    });
  }

  if (dateFromInput) {
    dateFromInput.addEventListener("change", () => {
      normalizeDateRange("from");
      updateDateRangeDisplay();
    });
  }

  if (dateToInput) {
    dateToInput.addEventListener("change", () => {
      normalizeDateRange("to");
      updateDateRangeDisplay();
    });
  }

  if (dateRangeClearBtn) {
    dateRangeClearBtn.addEventListener("click", () => {
      if (dateFromInput) {
        dateFromInput.value = "";
      }
      if (dateToInput) {
        dateToInput.value = "";
      }
      updateDateRangeDisplay();
      if (dateRangePanel) {
        dateRangePanel.open = false;
      }
    });
  }

  if (quickRangeLatestBtn) {
    quickRangeLatestBtn.addEventListener("click", async () => {
      await applyQuickLatestRange();
    });
  }

  if (quickRangeWeekBtn) {
    quickRangeWeekBtn.addEventListener("click", async () => {
      await applyQuickDateRange("week");
    });
  }

  if (quickRangeMonthBtn) {
    quickRangeMonthBtn.addEventListener("click", async () => {
      await applyQuickDateRange("month");
    });
  }

  if (athleteToggleBtn && athleteOptionsEl) {
    athleteToggleBtn.addEventListener("click", async () => {
      await ensureFilterOptionsLoaded();
      const isCollapsed = athleteOptionsEl.classList.toggle("is-collapsed");
      athleteToggleBtn.setAttribute("aria-expanded", String(!isCollapsed));
      filterAthleteOptions(athleteSearchInput?.value || "");
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

async function ensureFilterOptionsLoaded() {
  if (hasLoadedFilterOptions) {
    return;
  }

  if (!filterOptionsLoadPromise) {
    filterOptionsLoadPromise = loadFilterOptions()
      .finally(() => {
        hasLoadedFilterOptions = true;
        filterOptionsLoadPromise = null;
      });
  }

  await filterOptionsLoadPromise;
}

async function loadFilterOptions() {
  try {
    const query = new URLSearchParams();
    query.set("select", "channel,atleti,tags");
    query.set("order", "channel.asc");
    const rows = await fetchAllRows(query, 500, 10000);

    const channelsByKey = new Map();
    const athletesByKey = new Map();
    const tagsByKey = new Map();
    channelVideoCounts = new Map();
    athleteVideoCounts = new Map();
    tagVideoCounts = new Map();

    for (const row of rows) {
      if (row.channel) {
        const channelName = String(row.channel || "").trim();
        const key = normalizeSearchText(channelName);
        if (key && !channelsByKey.has(key)) {
          channelsByKey.set(key, channelName);
        }
        if (key) {
          channelVideoCounts.set(key, (channelVideoCounts.get(key) || 0) + 1);
        }
      }

      const athleteNames = normalizeAthletesValue(row.atleti);
      const athleteKeysForRow = new Set();
      for (const name of athleteNames) {
        const displayName = formatAthleteDisplayName(name);
        if (displayName && isValidAthleteOption(displayName)) {
          const key = buildAthleteCanonicalKey(displayName);
          if (key && !athletesByKey.has(key)) {
            athletesByKey.set(key, displayName);
          }
          if (key) {
            athleteKeysForRow.add(key);
          }
        }
      }

      for (const athleteKey of athleteKeysForRow) {
        athleteVideoCounts.set(athleteKey, (athleteVideoCounts.get(athleteKey) || 0) + 1);
      }

      const tagNames = normalizeTagsValue(row.tags);
      const tagKeysForRow = new Set();
      for (const name of tagNames) {
        if (name && !isTimeLikeTag(name)) {
          const key = normalizeSearchText(name);
          if (key && !tagsByKey.has(key)) {
            tagsByKey.set(key, name);
          }
          if (key) {
            tagKeysForRow.add(key);
          }
        }
      }

      for (const tagKey of tagKeysForRow) {
        tagVideoCounts.set(tagKey, (tagVideoCounts.get(tagKey) || 0) + 1);
      }
    }

    renderChannelOptions(sortByVideoCount([...channelsByKey.values()], channelVideoCounts, normalizeSearchText));
    renderAthleteOptions(sortByVideoCount([...athletesByKey.values()], athleteVideoCounts, buildAthleteCanonicalKey));
    renderTagOptions(sortAlphabetically([...tagsByKey.values()]));
  } catch (error) {
    showStatus("Impossibile caricare le opzioni filtro.");
    renderChannelOptions([]);
    renderAthleteOptions([]);
    renderTagOptions([]);
  }
}

function renderChannelOptions(values) {
  footerChannelValues = Array.isArray(values) ? [...values] : [];
  renderFooterQuickLinks(footerChannelLinksEl, footerChannelValues, "channel");
  updateFilterTotalCount(channelTotalCount, values.length);
  updateFilterTotalCount(footerChannelTotalCount, values.length);

  if (!channelOptionsEl) {
    return;
  }

  channelOptionsEl.innerHTML = "";

  if (!values.length) {
    const empty = document.createElement("p");
    empty.className = "channel-empty";
    empty.textContent = "Nessun canale disponibile.";
    channelOptionsEl.appendChild(empty);
    updateChannelSelectionUi();
    return;
  }

  for (const value of values) {
    const label = document.createElement("label");
    label.className = "channel-option";
    label.dataset.searchLabel = value;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "channel";
    input.value = value;

    const text = document.createElement("span");
    text.className = "filter-option-text";
    appendLabelWithCount(
      text,
      value,
      getVideoCountForValue(value, channelVideoCounts, normalizeSearchText),
      "filter-option-count",
      "Video associati al canale"
    );

    label.appendChild(input);
    label.appendChild(text);
    channelOptionsEl.appendChild(label);
  }

  filterChannelOptions(channelSearchInput?.value || "");
  updateChannelSelectionUi();
}

function filterChannelOptions(searchText) {
  if (!channelOptionsEl) {
    return;
  }

  const needle = normalizeSearchText(searchText);
  const options = channelOptionsEl.querySelectorAll(".channel-option");
  let visibleCount = 0;

  for (const option of options) {
    const labelText = option.dataset.searchLabel || option.textContent || "";
    const visible = !needle || normalizeSearchText(labelText).includes(needle);
    option.classList.toggle("hidden", !visible);
    if (visible) {
      visibleCount += 1;
    }
  }

  syncDropdownVisibilityForSearch(channelOptionsEl, channelToggleBtn, searchText, visibleCount);

  filterNoResultsState.channel = Boolean(needle) && visibleCount === 0;
  updateChannelSelectionUi();
}

function getSelectedChannels() {
  if (!channelOptionsEl) {
    return [];
  }

  const checked = channelOptionsEl.querySelectorAll('input[name="channel"]:checked');
  return [...checked].map((input) => input.value).filter(Boolean);
}

function setSelectedChannels(values) {
  const selected = new Set((values || []).map((value) => String(value)));
  if (!channelOptionsEl) {
    return;
  }

  const checkboxes = channelOptionsEl.querySelectorAll('input[name="channel"]');
  for (const checkbox of checkboxes) {
    checkbox.checked = selected.has(checkbox.value);
  }

  updateChannelSelectionUi();
}

function updateSelectionUi(count, countEl, clearBtn, singularLabel, pluralLabel, noResults) {
  if (countEl) {
    if (noResults) {
      countEl.textContent = "Nessun risultato trovato";
      countEl.classList.remove("hidden");
    } else if (count > 0) {
      countEl.textContent = count === 1 ? `1 ${singularLabel}` : `${count} ${pluralLabel}`;
      countEl.classList.remove("hidden");
    } else {
      countEl.textContent = "";
      countEl.classList.add("hidden");
    }
  }

  if (clearBtn) {
    clearBtn.classList.toggle("hidden", count === 0);
  }
}

function syncDropdownVisibilityForSearch(optionsEl, toggleBtn, searchText, visibleCount) {
  if (!optionsEl || !toggleBtn) {
    return;
  }

  const hasSearchText = Boolean(normalizeSearchText(searchText));
  if (!hasSearchText) {
    return;
  }

  const shouldOpen = visibleCount > 0;
  optionsEl.classList.toggle("is-collapsed", !shouldOpen);
  toggleBtn.setAttribute("aria-expanded", String(shouldOpen));
}

function updateChannelSelectionUi() {
  updateSelectionUi(
    getSelectedChannels().length,
    channelSelectedCount,
    channelClearBtn,
    "canale selezionato",
    "canali selezionati",
    filterNoResultsState.channel
  );
}

function updateAthleteSelectionUi() {
  updateSelectionUi(
    getSelectedAthletes().length,
    athleteSelectedCount,
    athleteClearBtn,
    "atleta selezionato",
    "atleti selezionati",
    filterNoResultsState.athlete
  );
}

function updateTagSelectionUi() {
  updateSelectionUi(
    getSelectedTags().length,
    tagSelectedCount,
    tagClearBtn,
    "tag selezionato",
    "tag selezionati",
    filterNoResultsState.tag
  );
}

function updateFilterTotalCount(countEl, total) {
  if (!countEl) {
    return;
  }

  countEl.textContent = `(${Number(total) || 0} totali)`;
}

function renderFooterQuickLinks(container, values, type) {
  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!Array.isArray(values) || values.length === 0) {
    const empty = document.createElement("p");
    empty.className = "footer-filter-empty";
    empty.textContent = "Nessun filtro disponibile.";
    container.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const value of values) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "footer-filter-link";
    button.dataset.filterType = type;
    button.dataset.filterValue = value;
    let countMap = tagVideoCounts;
    let keyBuilder = normalizeSearchText;

    if (type === "channel") {
      countMap = channelVideoCounts;
    } else if (type === "athlete") {
      countMap = athleteVideoCounts;
      keyBuilder = buildAthleteCanonicalKey;
    }

    const count = getVideoCountForValue(value, countMap, keyBuilder);
    let typeLabel = "tag";
    if (type === "channel") {
      typeLabel = "canale";
    } else if (type === "athlete") {
      typeLabel = "atleta";
    }
    button.title = `Filtra per ${typeLabel}: ${value}. Video associati: ${count}.`;
    button.setAttribute("aria-label", `Filtra per ${typeLabel} ${value}. ${count} video associati.`);
    button.classList.add("has-tooltip");
    button.dataset.tooltip = `${count} video associati`;
    appendLabelWithCount(button, value, count, "footer-filter-count", "Video associati");
    fragment.appendChild(button);
  }

  container.appendChild(fragment);
}

function normalizeAthletesValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  const raw = String(value || "").trim();
  if (!raw) {
    return [];
  }

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || "").trim()).filter(Boolean);
      }
    } catch (error) {
      // Fallback to separator-based parsing.
    }
  }

  return raw
    .split(/\s*\|\s*|\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTagsValue(value) {
  return normalizeAthletesValue(value);
}

function buildAthleteCanonicalKey(value) {
  const variants = getAthleteNameVariants(value);
  if (!variants.length) {
    return "";
  }

  return [...variants].sort(localeCompareIt)[0];
}

function getAthleteNameVariants(value) {
  const normalized = normalizeSearchText(value).trim();
  if (!normalized) {
    return [];
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const variants = [normalized];

  if (words.length >= 2) {
    const inverted = `${words.slice(1).join(" ")} ${words[0]}`.trim();
    if (inverted && !variants.includes(inverted)) {
      variants.push(inverted);
    }
  }

  return variants;
}

function formatAthleteDisplayName(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const compact = raw.replace(/\s+/g, " ");
  const words = compact.split(" ");
  return words
    .map((word) => {
      const lower = word.toLocaleLowerCase("it-IT");
      const segments = lower.split(/([\-\'’])/);
      return segments
        .map((segment, index) => {
          if (index % 2 === 1 || !segment) {
            return segment;
          }
          return segment.charAt(0).toLocaleUpperCase("it-IT") + segment.slice(1);
        })
        .join("");
    })
    .join(" ");
}

function isValidAthleteOption(value) {
  const normalized = normalizeSearchText(value).trim();
  if (!normalized) {
    return false;
  }

  // Evita voci rumorose come "..." o solo punteggiatura.
  return /[a-z0-9]/.test(normalized);
}

function sortAlphabetically(values) {
  return [...(values || [])].sort((a, b) => localeCompareIt(String(a || ""), String(b || "")));
}

function sortByVideoCount(values, countMap, keyBuilder) {
  return [...(values || [])].sort((a, b) => {
    const countDiff = getVideoCountForValue(b, countMap, keyBuilder) - getVideoCountForValue(a, countMap, keyBuilder);
    if (countDiff !== 0) {
      return countDiff;
    }

    return localeCompareIt(String(a || ""), String(b || ""));
  });
}

function getVideoCountForValue(value, countMap, keyBuilder) {
  if (!countMap || typeof keyBuilder !== "function") {
    return 0;
  }

  const key = keyBuilder(value);
  if (!key) {
    return 0;
  }

  return Number(countMap.get(key) || 0);
}

function formatFilterValueWithCount(value, count) {
  return `${value} (${Number(count) || 0})`;
}

function appendLabelWithCount(target, value, count, countClassName, tooltipPrefix = "Video associati") {
  const numericCount = Number(count) || 0;

  const labelSpan = document.createElement("span");
  labelSpan.className = "option-label";
  labelSpan.textContent = value;

  const countSpan = document.createElement("span");
  countSpan.className = countClassName;
  countSpan.textContent = `(${numericCount})`;

  target.appendChild(labelSpan);
  target.appendChild(countSpan);
}

function isTimeLikeTag(value) {
  const text = String(value || "").trim();
  return /^\d{1,2}[:.]\d{2}$/.test(text);
}

function renderAthleteOptions(values) {
  footerAthleteValues = Array.isArray(values) ? [...values] : [];
  renderFooterQuickLinks(footerAthleteLinksEl, footerAthleteValues, "athlete");
  updateFilterTotalCount(athleteTotalCount, values.length);
  updateFilterTotalCount(footerAthleteTotalCount, values.length);

  if (!athleteOptionsEl) {
    return;
  }

  athleteOptionsEl.innerHTML = "";

  if (!values.length) {
    const empty = document.createElement("p");
    empty.className = "athlete-empty";
    empty.textContent = "Nessun atleta disponibile.";
    athleteOptionsEl.appendChild(empty);
    updateAthleteSelectionUi();
    return;
  }

  for (const value of values) {
    const label = document.createElement("label");
    label.className = "athlete-option";
    label.dataset.searchLabel = value;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "athlete";
    input.value = value;

    const text = document.createElement("span");
    text.className = "filter-option-text";
    appendLabelWithCount(
      text,
      value,
      getVideoCountForValue(value, athleteVideoCounts, buildAthleteCanonicalKey),
      "filter-option-count",
      "Video associati all'atleta"
    );

    label.appendChild(input);
    label.appendChild(text);
    athleteOptionsEl.appendChild(label);
  }

  filterAthleteOptions(athleteSearchInput?.value || "");
  updateAthleteSelectionUi();
}

function filterAthleteOptions(searchText) {
  if (!athleteOptionsEl) {
    return;
  }

  const needle = normalizeSearchText(searchText);
  const options = athleteOptionsEl.querySelectorAll(".athlete-option");
  let visibleCount = 0;

  for (const option of options) {
    const labelText = option.dataset.searchLabel || option.textContent || "";
    const visible = !needle || normalizeSearchText(labelText).includes(needle);
    option.classList.toggle("hidden", !visible);
    if (visible) {
      visibleCount += 1;
    }
  }

  syncDropdownVisibilityForSearch(athleteOptionsEl, athleteToggleBtn, searchText, visibleCount);

  filterNoResultsState.athlete = Boolean(needle) && visibleCount === 0;
  updateAthleteSelectionUi();
}

function getSelectedAthletes() {
  if (!athleteOptionsEl) {
    return [];
  }

  const checked = athleteOptionsEl.querySelectorAll('input[name="athlete"]:checked');
  return [...checked].map((input) => input.value).filter(Boolean);
}

function setSelectedAthletes(values) {
  const selected = new Set((values || []).map((value) => normalizeSearchText(value)));
  if (!athleteOptionsEl) {
    return;
  }

  const checkboxes = athleteOptionsEl.querySelectorAll('input[name="athlete"]');
  for (const checkbox of checkboxes) {
    checkbox.checked = selected.has(normalizeSearchText(checkbox.value));
  }

  updateAthleteSelectionUi();
}

function renderTagOptions(values) {
  updateFilterTotalCount(tagTotalCount, values.length);

  if (!tagOptionsEl) {
    return;
  }

  tagOptionsEl.innerHTML = "";

  if (!values.length) {
    const empty = document.createElement("p");
    empty.className = "tag-empty";
    empty.textContent = "Nessun tag disponibile.";
    tagOptionsEl.appendChild(empty);
    updateTagSelectionUi();
    return;
  }

  for (const value of values) {
    const label = document.createElement("label");
    label.className = "tag-option";
    label.dataset.searchLabel = value;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = "tag";
    input.value = value;

    const text = document.createElement("span");
    text.className = "filter-option-text";
    appendLabelWithCount(
      text,
      value,
      getVideoCountForValue(value, tagVideoCounts, normalizeSearchText),
      "filter-option-count",
      "Video associati al tag"
    );

    label.appendChild(input);
    label.appendChild(text);
    tagOptionsEl.appendChild(label);
  }

  filterTagOptions(tagSearchInput?.value || "");
  updateTagSelectionUi();
}

function filterTagOptions(searchText) {
  if (!tagOptionsEl) {
    return;
  }

  const needle = normalizeSearchText(searchText);
  const options = tagOptionsEl.querySelectorAll(".tag-option");
  let visibleCount = 0;

  for (const option of options) {
    const labelText = option.dataset.searchLabel || option.textContent || "";
    const visible = !needle || normalizeSearchText(labelText).includes(needle);
    option.classList.toggle("hidden", !visible);
    if (visible) {
      visibleCount += 1;
    }
  }

  syncDropdownVisibilityForSearch(tagOptionsEl, tagToggleBtn, searchText, visibleCount);

  filterNoResultsState.tag = Boolean(needle) && visibleCount === 0;
  updateTagSelectionUi();
}

function getSelectedTags() {
  if (!tagOptionsEl) {
    return [];
  }

  const checked = tagOptionsEl.querySelectorAll('input[name="tag"]:checked');
  return [...checked].map((input) => input.value).filter(Boolean);
}

function setSelectedTags(values) {
  const selected = new Set((values || []).map((value) => normalizeSearchText(value)));
  if (!tagOptionsEl) {
    return;
  }

  const checkboxes = tagOptionsEl.querySelectorAll('input[name="tag"]');
  for (const checkbox of checkboxes) {
    checkbox.checked = selected.has(normalizeSearchText(checkbox.value));
  }

  updateTagSelectionUi();
}

async function loadLatestItems() {
  pagingState.mode = "latest";
  pagingState.lastSearchParams = null;
  pagingState.clientRows = null;
  pagingState.titleText = "Ultimi video";
  setActiveQuickRange("latest");
  await loadPage(1);
}

async function runSearch() {
  const query = new URLSearchParams();
  query.set("select", "*");
  query.set("order", "upload_date.desc");

  const text = form.q.value.trim();
  const channels = getSelectedChannels();
  const athletes = getSelectedAthletes();
  const tags = getSelectedTags();
  const dateFrom = form.dateFrom.value;
  const dateTo = form.dateTo.value;
  const durationRange = form.durationRange.value;

  applyStructuredFilters(query, {
    channels,
    dateFrom,
    dateTo,
    durationRange
  });

  if (!hasActiveFilters({
    q: text,
    channels,
    athletes,
    tags,
    dateFrom,
    dateTo,
    durationRange
  })) {
    await loadLatestItems();
    return;
  }

  const matchedQuickRange = inferQuickRangeFromFilters({
    q: text,
    channels,
    athletes,
    tags,
    dateFrom,
    dateTo,
    durationRange
  });
  setActiveQuickRange(matchedQuickRange);

  pagingState.titleText = buildSearchSummaryTitle({
    q: text,
    channels,
    athletes,
    tags,
    dateFrom,
    dateTo,
    durationRange
  });

  const needsLocalTextFilter = Boolean(text);
  const needsLocalAthleteFilter = athletes.length > 0;
  const needsLocalTagFilter = tags.length > 0;

  if (needsLocalTextFilter || needsLocalAthleteFilter || needsLocalTagFilter) {
    clearStatus();
    renderLoading();
    try {
      const candidates = await fetchAllRows(query, 500, 5000);
      const filtered = candidates.filter((row) => {
        if (needsLocalTextFilter && !matchesSearchText(row, text)) {
          return false;
        }
        if (needsLocalAthleteFilter && !matchesSelectedAthletes(row, athletes)) {
          return false;
        }
        if (needsLocalTagFilter && !matchesSelectedTags(row, tags)) {
          return false;
        }
        return true;
      });

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
  const hasRows = Array.isArray(rows) && rows.length > 0;
  if (pagingState.mode === "latest" && hasRows) {
    hasInitialLatestResults = true;
  }

  if (hasRows && !hasLoadedFilterOptions) {
    ensureFilterOptionsLoaded().catch(() => {
      // Ignore footer quick links load errors here; the main results already rendered.
    });
  }

  const keepHiddenForInitialLatest = pagingState.mode === "latest" && !hasInitialLatestResults;
  showHomeView({ showResultsSection: !keepHiddenForInitialLatest });
  setResultsLoadingState(false);
  resultsList.innerHTML = "";

  if (resultsHeadEl) {
    resultsHeadEl.classList.toggle("hidden", !hasRows);
  }
  if (!hasRows) {
    if (titleEl) {
      titleEl.textContent = "";
    }
    if (metaEl) {
      metaEl.textContent = "";
    }
    if (paginationEl) {
      paginationEl.classList.add("hidden");
    }
  }

  for (const row of rows) {
    videoCache.set(String(row.id), row);

    const item = template.content.firstElementChild.cloneNode(true);
    const thumbLink = item.querySelector(".thumb-wrap");
    const thumb = item.querySelector(".thumb");
    const title = item.querySelector(".title-link");
    const meta = item.querySelector(".meta");

    const internalUrl = buildVideoPath(row);
    const titleText = row.title_it || row.title_en || row.id || "Video senza titolo";
    const isItalianContent = inferItalianContent(row);

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
      const viewsLabel = getViewsLabel(isItalianContent);
      parts.push(`${row.view_count.toLocaleString("it-IT")} ${viewsLabel}`);
    }
    const durationText = formatDurationHms(row.duration);
    if (durationText) {
      parts.push(`Durata ${durationText}`);
    }

    meta.textContent = parts.join(" • ");
    resultsList.appendChild(item);
  }
}

function renderLoading() {
  const keepHiddenForInitialLatest = pagingState.mode === "latest" && !hasInitialLatestResults;
  showHomeView({ showResultsSection: !keepHiddenForInitialLatest });
  setResultsLoadingState(true);
  resultsList.innerHTML = "";

  const item = document.createElement("li");
  item.className = "results-loader";
  item.setAttribute("role", "status");
  item.setAttribute("aria-live", "polite");

  const spinner = document.createElement("span");
  spinner.className = "results-loader-spinner";
  spinner.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.className = "results-loader-text";
  text.textContent = "Caricamento in corso...";

  item.appendChild(spinner);
  item.appendChild(text);
  resultsList.appendChild(item);
}

function setResultsLoadingState(isLoading) {
  resultsSection?.classList.toggle("is-loading", Boolean(isLoading));
  if (resultsHeadEl) {
    if (isLoading) {
      resultsHeadEl.classList.add("hidden");
    }
  }
  if (paginationEl) {
    if (isLoading) {
      paginationEl.classList.add("hidden");
    }
  }
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

  if (athleteSearchInput) {
    athleteSearchInput.value = "";
    filterAthleteOptions("");
  }

  if (channelSearchInput) {
    channelSearchInput.value = "";
    filterChannelOptions("");
  }

  if (tagSearchInput) {
    tagSearchInput.value = "";
    filterTagOptions("");
  }

  if (channelOptionsEl) {
    channelOptionsEl.classList.add("is-collapsed");
  }

  if (channelToggleBtn) {
    channelToggleBtn.setAttribute("aria-expanded", "false");
  }

  if (athleteOptionsEl) {
    athleteOptionsEl.classList.add("is-collapsed");
  }

  if (athleteToggleBtn) {
    athleteToggleBtn.setAttribute("aria-expanded", "false");
  }

  if (tagOptionsEl) {
    tagOptionsEl.classList.add("is-collapsed");
  }

  if (tagToggleBtn) {
    tagToggleBtn.setAttribute("aria-expanded", "false");
  }

  if (filtersPanel) {
    filtersPanel.open = false;
  }
  if (filtersToggleBtn) {
    filtersToggleBtn.setAttribute("aria-expanded", "false");
  }

  updateDateRangeDisplay();

  clearStatus();
  await navigateHome(pushHistory);
}

async function loadPage(page, customTitle = "") {
  clearStatus();
  renderLoading();
  const pageSize = pagingState.mode === "latest" ? LATEST_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  const safePage = Math.max(1, Number(page) || 1);
  const requestedPage = safePage;
  const from = (requestedPage - 1) * pageSize;

  if (pagingState.mode === "search-local") {
    const allRows = pagingState.clientRows || [];
    const totalItems = allRows.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    pagingState.currentPage = Math.min(requestedPage, totalPages);
    pagingState.totalItems = totalItems;
    pagingState.totalPages = totalPages;

    const start = (pagingState.currentPage - 1) * pageSize;
    const rows = allRows.slice(start, start + pageSize);
    renderResults(rows);
    renderPagination();
    if (rows.length > 0) {
      titleEl.textContent = pagingState.titleText || customTitle || "Risultati filtrati";
      metaEl.textContent = `${totalItems} risultati • Pagina ${pagingState.currentPage} di ${pagingState.totalPages}`;
    }
    persistListState();

    if (!rows.length) {
      showStatus("Nessun risultato con i filtri selezionati.");
    }
    return;
  }

  try {
    let rows = [];
    let totalItems = 0;
    let totalPages = 1;

    if (pagingState.mode === "latest") {
      const latestQuery = new URLSearchParams("select=*&order=upload_date.desc.nullslast");
      latestQuery.set("limit", String(LATEST_TOTAL_LIMIT));
      latestQuery.set("offset", "0");

      const result = await fetchRows(latestQuery.toString(), false);
      const allLatestRows = Array.isArray(result.rows) ? result.rows : [];
      totalItems = allLatestRows.length;
      totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

      pagingState.currentPage = Math.min(requestedPage, totalPages);
      const start = (pagingState.currentPage - 1) * pageSize;
      rows = allLatestRows.slice(start, start + pageSize);
    } else {
      const query = pagingState.mode === "search" && pagingState.lastSearchParams
        ? new URLSearchParams(pagingState.lastSearchParams)
        : new URLSearchParams("select=*&order=upload_date.desc.nullslast");

      query.set("limit", String(pageSize));
      query.set("offset", String(from));

      const result = await fetchRows(query.toString(), true);
      rows = result.rows;
      totalItems = result.total ?? rows.length;
      totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
      pagingState.currentPage = Math.min(requestedPage, totalPages);
    }

    pagingState.totalItems = totalItems;
    pagingState.totalPages = totalPages;

    renderResults(rows);
    renderPagination();

    if (rows.length > 0) {
      if (pagingState.mode === "latest") {
        titleEl.textContent = "Video più recenti";
        metaEl.textContent = `${totalItems} risultati (ultimi ${LATEST_TOTAL_LIMIT}) • Pagina ${pagingState.currentPage} di ${pagingState.totalPages}`;
      } else {
        titleEl.textContent = pagingState.titleText || customTitle || "Risultati filtrati";
        metaEl.textContent = `${totalItems} risultati • Pagina ${pagingState.currentPage} di ${pagingState.totalPages}`;
      }
    }
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
  const hasSearch = hasActiveFilters(filters);

  if (hasSearch) {
    await ensureFilterOptionsLoaded();
  }

  writeFormFilters(filters);

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
    channels: getSelectedChannels(),
    channelSearch: channelSearchInput?.value || "",
    athletes: getSelectedAthletes(),
    athleteSearch: athleteSearchInput?.value || "",
    tags: getSelectedTags(),
    tagSearch: tagSearchInput?.value || "",
    dateFrom: form.dateFrom.value || "",
    dateTo: form.dateTo.value || "",
    durationRange: form.durationRange.value || ""
  };
}

function buildSearchSummaryTitle(filters) {
  const parts = [];
  const q = String(filters?.q || "").trim();
  const channels = Array.isArray(filters?.channels) ? filters.channels : [];
  const athletes = Array.isArray(filters?.athletes) ? filters.athletes : [];
  const tags = Array.isArray(filters?.tags) ? filters.tags : [];
  const dateFrom = filters?.dateFrom || "";
  const dateTo = filters?.dateTo || "";
  const durationRange = filters?.durationRange || "";

  if (q) {
    parts.push(`testo: \"${q}\"`);
  }
  if (channels.length > 0) {
    parts.push(`canali: ${channels.join(", ")}`);
  }
  if (athletes.length > 0) {
    parts.push(`atleti: ${athletes.join(", ")}`);
  }
  if (tags.length > 0) {
    parts.push(`tag: ${tags.join(", ")}`);
  }
  if (dateFrom) {
    parts.push(`da: ${dateFrom}`);
  }
  if (dateTo) {
    parts.push(`a: ${dateTo}`);
  }
  if (durationRange) {
    parts.push(`durata: ${getDurationRangeLabel(durationRange)}`);
  }

  if (parts.length === 0) {
    return "Risultati filtrati";
  }

  return `Video per ${parts.join(" | ")}`;
}

function writeFormFilters(filters) {
  const safe = filters || {};
  form.q.value = safe.q || "";
  const channels = Array.isArray(safe.channels)
    ? safe.channels
    : (safe.channel ? [safe.channel] : []);
  const athletes = Array.isArray(safe.athletes)
    ? safe.athletes
    : (safe.athlete ? [safe.athlete] : []);
  const tags = Array.isArray(safe.tags)
    ? safe.tags
    : (safe.tag ? [safe.tag] : []);

  if (channelSearchInput) {
    channelSearchInput.value = safe.channelSearch || "";
  }

  if (athleteSearchInput) {
    athleteSearchInput.value = safe.athleteSearch || "";
  }

  if (tagSearchInput) {
    tagSearchInput.value = safe.tagSearch || "";
  }

  setSelectedChannels(channels);
  filterChannelOptions(channelSearchInput?.value || "");
  setSelectedAthletes(athletes);
  filterAthleteOptions(athleteSearchInput?.value || "");
  setSelectedTags(tags);
  filterTagOptions(tagSearchInput?.value || "");
  if (dateFromInput) {
    dateFromInput.value = safe.dateFrom || "";
  }
  if (dateToInput) {
    dateToInput.value = safe.dateTo || "";
  }
  form.durationRange.value = safe.durationRange || "";
  normalizeDateRange();
  updateDateRangeDisplay();
}

function hasActiveFilters(filters) {
  const safe = filters || {};
  const hasChannels = Array.isArray(safe.channels)
    ? safe.channels.length > 0
    : Boolean(safe.channel);
  const hasAthletes = Array.isArray(safe.athletes)
    ? safe.athletes.length > 0
    : Boolean(safe.athlete);
  const hasTags = Array.isArray(safe.tags)
    ? safe.tags.length > 0
    : Boolean(safe.tag);

  return Boolean(
    String(safe.q || "").trim()
    || hasChannels
    || hasAthletes
    || hasTags
    || safe.dateFrom
    || safe.dateTo
    || safe.durationRange
  );
}

function matchesSelectedAthletes(row, selectedAthletes) {
  if (!Array.isArray(selectedAthletes) || selectedAthletes.length === 0) {
    return true;
  }

  const candidateVariants = normalizeAthletesValue(row?.atleti)
    .flatMap((value) => getAthleteNameVariants(value));

  return selectedAthletes.some((selected) => {
    const selectedVariants = getAthleteNameVariants(selected);
    if (selectedVariants.length === 0) {
      return false;
    }

    return selectedVariants.some((needle) =>
      candidateVariants.some((candidate) => candidate.includes(needle))
    );
  });
}

function matchesSelectedTags(row, selectedTags) {
  if (!Array.isArray(selectedTags) || selectedTags.length === 0) {
    return true;
  }

  const normalizedCandidates = normalizeTagsValue(row?.tags)
    .map((value) => normalizeSearchText(value));

  return selectedTags.some((selected) => {
    const needle = normalizeSearchText(selected);
    if (!needle) {
      return false;
    }
    return normalizedCandidates.some((candidate) => candidate.includes(needle));
  });
}

function renderPagination(forceHide = false) {
  const pageSize = pagingState.mode === "latest" ? LATEST_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  if (forceHide || pagingState.totalItems <= pageSize) {
    paginationEl.classList.add("hidden");
    pageNumbersEl.innerHTML = "";
    pagePrevBtn.classList.add("hidden");
    pageNextBtn.classList.add("hidden");
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
      scrollToResultsIfNeeded({ defer: true });
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
    channels,
    dateFrom,
    dateTo,
    durationRange
  } = filters;

  if (Array.isArray(channels) && channels.length > 0) {
    query.set("channel", `in.${toPostgrestInValues(channels)}`);
  }

  if (dateFrom) {
    query.set("upload_date", `gte.${compactDate(dateFrom)}`);
  }

  if (dateTo) {
    query.append("upload_date", `lte.${compactDate(dateTo)}`);
  }

  const durationSpec = getDurationRangeSpec(durationRange);
  if (durationSpec?.minExclusive !== undefined) {
    query.set("duration", `gt.${durationSpec.minExclusive}`);
  }
  if (durationSpec?.minInclusive !== undefined) {
    query.set("duration", `gte.${durationSpec.minInclusive}`);
  }
  if (durationSpec?.maxInclusive !== undefined) {
    query.append("duration", `lte.${durationSpec.maxInclusive}`);
  }
}

function getDurationRangeSpec(durationRange) {
  switch (durationRange) {
    case "lte3":
      return { maxInclusive: 180 };
    case "3to5":
      return { minExclusive: 180, maxInclusive: 300 };
    case "5to10":
      return { minExclusive: 300, maxInclusive: 600 };
    case "10to30":
      return { minExclusive: 600, maxInclusive: 1800 };
    case "30to60":
      return { minExclusive: 1800, maxInclusive: 3600 };
    case "gt60":
      return { minExclusive: 3600 };
    default:
      return null;
  }
}

function getDurationRangeLabel(durationRange) {
  switch (durationRange) {
    case "lte3":
      return "<= 3 minuti";
    case "3to5":
      return "da 3 a 5 minuti";
    case "5to10":
      return "da 5 a 10 minuti";
    case "10to30":
      return "da 10 a 30 minuti";
    case "30to60":
      return "da 30 minuti ad 1 ora";
    case "gt60":
      return "> di 1 ora";
    default:
      return durationRange || "";
  }
}

function formatDurationHms(rawSeconds) {
  const secondsTotal = Number(rawSeconds);
  if (!Number.isFinite(secondsTotal) || secondsTotal < 0) {
    return "";
  }

  const rounded = Math.floor(secondsTotal);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours === 0) {
    return `${mm}:${ss} minuti`;
  }

  return `${hh}:${mm}:${ss} ore`;
}

function toPostgrestInValues(values) {
  const items = (values || [])
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((value) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`);

  return `(${items.join(",")})`;
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

function showHomeView({ showResultsSection = true } = {}) {
  stopDetailPlayback();
  heroSection.classList.remove("hidden");
  searchCard.classList.remove("hidden");
  resultsSection.classList.toggle("hidden", !showResultsSection);
  detailView.classList.add("hidden");
}

function showDetailView() {
  heroSection.classList.add("hidden");
  searchCard.classList.add("hidden");
  resultsSection.classList.add("hidden");
  detailView.classList.remove("hidden");
}

function stopDetailPlayback() {
  if (!detailPlayer) {
    return;
  }

  if (detailPlayer.src) {
    detailPlayer.src = "";
  }
}

function renderDetailData(row) {
  detailData.innerHTML = "";
  const safeRow = row || {};
  const isItalianContent = inferItalianContent(safeRow);
  const hiddenKeys = new Set([
    "id",
    "webpage_url",
    "channel_id",
    "thumbnail",
    "categories",
    "title_it",
    "title_en",
    "description_it",
    "description_en"
  ]);

  const entries = Object.entries(safeRow).filter(([key]) => !hiddenKeys.has(key));

  for (const [key, value] of entries) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = getDetailFieldLabel(key, isItalianContent);
    dd.textContent = formatDetailValueByKey(key, value, isItalianContent);
    detailData.appendChild(dt);
    detailData.appendChild(dd);
  }
}

function inferItalianContent(row) {
  return Boolean(row?.title_it || row?.description_it);
}

function getViewsLabel(isItalianContent) {
  return isItalianContent ? "visualizzazioni" : "views";
}

function getDetailFieldLabel(key, isItalianContent) {
  const labelsIt = {
    title: "Titolo",
    channel: "Canale",
    upload_date: "Data di pubblicazione",
    duration: "Durata",
    view_count: "Visualizzazioni",
    like_count: "Mi piace",
    comment_count: "Commenti",
    tags: "Tag",
    atleti: "Atleti",
    subtitles_it: "Sottotitoli (IT)",
    subtitles_en: "Sottotitoli (EN)"
  };

  const labelsEn = {
    title: "Title",
    channel: "Channel",
    upload_date: "Publication date",
    duration: "Duration",
    view_count: "Views",
    like_count: "Likes",
    comment_count: "Comments",
    tags: "Tags",
    atleti: "Athletes",
    subtitles_it: "Subtitles (IT)",
    subtitles_en: "Subtitles (EN)"
  };

  const labels = isItalianContent ? labelsIt : labelsEn;
  return labels[key] || key.replaceAll("_", " ");
}

function formatDetailValueByKey(key, value, isItalianContent) {
  if (key === "duration") {
    return formatDurationHms(value) || "n/d";
  }

  if (key === "upload_date") {
    return formatUploadDate(value);
  }

  if (key === "view_count") {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) {
      return `${numberValue.toLocaleString("it-IT")} ${getViewsLabel(isItalianContent)}`;
    }
  }

  return formatDetailValue(value);
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

function scrollToResultsIfNeeded({ defer = false } = {}) {
  const runScroll = () => {
    const anchor = resultsHeadEl && !resultsHeadEl.classList.contains("hidden")
      ? resultsHeadEl
      : resultsSection;

    if (!anchor) {
      return;
    }

    const anchorTop = window.scrollY + anchor.getBoundingClientRect().top;
    const targetTop = Math.max(0, anchorTop - 8);
    window.scrollTo({ top: targetTop, behavior: "smooth" });
  };

  if (!defer) {
    runScroll();
    return;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(runScroll);
  });
}

function setupDateRangeInputs() {
  const today = getTodayIsoDate();

  if (dateFromInput) {
    dateFromInput.max = today;
  }

  if (dateToInput) {
    dateToInput.max = today;
  }

  normalizeDateRange();
  updateDateRangeDisplay();
}

async function applyQuickDateRange(rangeKey) {
  if (!dateFromInput || !dateToInput) {
    return;
  }

  await resetToInitialHome(false);

  const todayIso = getTodayIsoDate();
  const toDate = new Date(`${todayIso}T00:00:00`);
  const fromDate = new Date(toDate);

  if (rangeKey === "week") {
    fromDate.setDate(fromDate.getDate() - 6);
  } else if (rangeKey === "month") {
    fromDate.setMonth(fromDate.getMonth() - 1);
  } else {
    return;
  }

  setActiveQuickRange(rangeKey);

  dateFromInput.value = toIsoDateLocal(fromDate);
  dateToInput.value = todayIso;
  normalizeDateRange("to");
  updateDateRangeDisplay();

  if (filtersPanel) {
    filtersPanel.open = true;
  }
  if (filtersToggleBtn) {
    filtersToggleBtn.setAttribute("aria-expanded", "true");
  }

  showHomeView();
  await runSearch();
  scrollToResultsIfNeeded();
}

async function applyQuickLatestRange() {
  setActiveQuickRange("latest");
  await resetToInitialHome(false);
  scrollToResultsIfNeeded();
}

async function applyFooterQuickFilter(type, value) {
  const normalizedValue = String(value || "").trim();
  if (!normalizedValue) {
    return;
  }

  await ensureFilterOptionsLoaded();
  await resetToInitialHome(false);

  if (type === "channel") {
    setSelectedChannels([normalizedValue]);
  } else if (type === "athlete") {
    setSelectedAthletes([normalizedValue]);
  } else if (type === "tag") {
    setSelectedTags([normalizedValue]);
  } else {
    return;
  }

  showHomeView();
  await runSearch();
  scrollToResultsIfNeeded({ defer: true });
}

function setActiveQuickRange(rangeKey) {
  activeQuickRange = rangeKey;

  const buttons = [
    [quickRangeLatestBtn, "latest"],
    [quickRangeWeekBtn, "week"],
    [quickRangeMonthBtn, "month"],
  ];

  for (const [button, key] of buttons) {
    if (!button) {
      continue;
    }

    const isActive = activeQuickRange === key;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function inferQuickRangeFromFilters(filters) {
  const safe = filters || {};
  const hasText = Boolean(String(safe.q || "").trim());
  const hasChannels = Array.isArray(safe.channels) && safe.channels.length > 0;
  const hasAthletes = Array.isArray(safe.athletes) && safe.athletes.length > 0;
  const hasTags = Array.isArray(safe.tags) && safe.tags.length > 0;
  const hasDuration = Boolean(safe.durationRange);
  const dateFrom = String(safe.dateFrom || "");
  const dateTo = String(safe.dateTo || "");

  if (hasText || hasChannels || hasAthletes || hasTags || hasDuration) {
    return "";
  }

  if (!dateFrom && !dateTo) {
    return "latest";
  }

  const todayIso = getTodayIsoDate();
  if (dateTo !== todayIso) {
    return "";
  }

  const toDate = new Date(`${todayIso}T00:00:00`);
  const weekFrom = new Date(toDate);
  weekFrom.setDate(weekFrom.getDate() - 6);

  const monthFrom = new Date(toDate);
  monthFrom.setMonth(monthFrom.getMonth() - 1);

  if (dateFrom === toIsoDateLocal(weekFrom)) {
    return "week";
  }

  if (dateFrom === toIsoDateLocal(monthFrom)) {
    return "month";
  }

  return "";
}

function toIsoDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateRange(changedField = "") {
  const today = getTodayIsoDate();
  if (!dateFromInput || !dateToInput) {
    return;
  }

  if (dateFromInput.value && dateFromInput.value > today) {
    dateFromInput.value = today;
  }

  if (dateToInput.value && dateToInput.value > today) {
    dateToInput.value = today;
  }

  if (dateFromInput.value && dateToInput.value && dateFromInput.value > dateToInput.value) {
    if (changedField === "to") {
      dateFromInput.value = dateToInput.value;
    } else {
      dateToInput.value = dateFromInput.value;
    }
  }
}

function updateDateRangeDisplay() {
  if (!dateRangeDisplay || !dateFromInput || !dateToInput) {
    return;
  }

  const dateRangeTextEl = dateRangeDisplay.querySelector(".date-range-text");
  if (!dateRangeTextEl) {
    return;
  }

  const from = dateFromInput.value;
  const to = dateToInput.value;

  if (!from && !to) {
    dateRangeTextEl.textContent = "Seleziona intervallo date";
    return;
  }

  if (from && to) {
    dateRangeTextEl.textContent = `${formatIsoDateToIt(from)} - ${formatIsoDateToIt(to)}`;
    return;
  }

  if (from) {
    dateRangeTextEl.textContent = `Da ${formatIsoDateToIt(from)}`;
    return;
  }

  dateRangeTextEl.textContent = `Fino a ${formatIsoDateToIt(to)}`;
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatIsoDateToIt(isoDate) {
  const value = String(isoDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
