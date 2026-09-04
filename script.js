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
const liveCarouselSection = document.getElementById("live-carousel-section");
const liveCarouselTrack = document.getElementById("live-carousel-track");
const liveCarouselStatus = document.getElementById("live-carousel-status");
const liveCarouselPrevBtn = document.getElementById("live-carousel-prev");
const liveCarouselNextBtn = document.getElementById("live-carousel-next");
const livePresenceDot = document.getElementById("live-presence-dot");
const openLiveProgramDesktopBtn = document.getElementById("open-live-program-btn-desktop");
const openLiveProgramMobileBtn = document.getElementById("open-live-program-btn-mobile");
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
const contentTypeInput = document.getElementById("content-type");
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
const liveProgramView = document.getElementById("live-program-view");
const liveProgramBackBtn = document.getElementById("live-program-back-btn");
const liveProgramMeta = document.getElementById("live-program-meta");
const liveProgramList = document.getElementById("live-program-list");
const liveEndedMeta = document.getElementById("live-ended-meta");
const liveEndedList = document.getElementById("live-ended-list");
const liveProgramEndedTitle = document.querySelector(".live-program-ended-title");
const liveEndedPaginationEl = document.getElementById("live-ended-pagination");
const liveEndedPrevBtn = document.getElementById("live-ended-prev");
const liveEndedNextBtn = document.getElementById("live-ended-next");
const liveEndedPageNumbersEl = document.getElementById("live-ended-page-numbers");
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
const FOOTER_QUICK_LINK_INITIAL_LIMIT = 20;
const FOOTER_ATHLETE_MIN_VISIBLE_VIDEOS = 10;
const DETAIL_TAGS_COLLAPSE_MAX_ITEMS = 8;
const DETAIL_TAGS_COLLAPSE_MAX_CHARS = 220;
const DETAIL_DESCRIPTION_COLLAPSE_MAX_CHARS = 360;
const LIVE_FRONTEND_ONAIR_WINDOW_MS = 6 * 60 * 60 * 1000;
const LIVE_CAROUSEL_ONAIR_LOOKBACK_MS = 48 * 60 * 60 * 1000;

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
let footerChannelsExpanded = false;
let footerAthletesExpanded = false;
let channelVideoCounts = new Map();
let athleteVideoCounts = new Map();
let tagVideoCounts = new Map();
let liveRowsCache = [];

const liveEndedPagingState = {
  rows: [],
  currentPage: 1,
  totalItems: 0,
  totalPages: 1,
  pageSize: 10
};

const homeCountLoadingElements = [
  indexedVideosInlineEl,
  channelTotalCount,
  footerChannelTotalCount,
  athleteTotalCount,
  footerAthleteTotalCount,
  tagTotalCount
].filter(Boolean);

const filterNoResultsState = {
  channel: false,
  athlete: false,
  tag: false
};

init();

async function init() {
  setHomeCountersLoading(true);
  setFilterOptionsLoading(true);
  setupDateRangeInputs();
  bindEvents();
  await Promise.all([
    loadReleaseVersion(),
    loadIndexedVideoCount(),
    loadLiveCarousel(),
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
  } finally {
    setHomeCountersLoading(false);
  }

  updateReleaseFooter();
}

function setHomeCountersLoading(isLoading) {
  for (const el of homeCountLoadingElements) {
    el.classList.toggle("is-inline-loading", Boolean(isLoading));
    el.setAttribute("aria-busy", isLoading ? "true" : "false");
  }
}

function setFilterOptionsLoading(isLoading) {
  setFilterSectionLoading("channel", isLoading);
  setFilterSectionLoading("athlete", isLoading);
  setFilterSectionLoading("tag", isLoading);
}

function setFilterSectionLoading(section, isLoading) {
  const loading = Boolean(isLoading);

  if (section === "channel") {
    const channelTargets = [channelTotalCount, footerChannelTotalCount].filter(Boolean);
    for (const el of channelTargets) {
      el.classList.toggle("is-inline-loading", loading);
      el.setAttribute("aria-busy", loading ? "true" : "false");
    }
    toggleFooterLoader(footerChannelLinksEl, loading, "Caricamento canali");
    return;
  }

  if (section === "athlete") {
    const athleteTargets = [athleteTotalCount, footerAthleteTotalCount].filter(Boolean);
    for (const el of athleteTargets) {
      el.classList.toggle("is-inline-loading", loading);
      el.setAttribute("aria-busy", loading ? "true" : "false");
    }
    toggleFooterLoader(footerAthleteLinksEl, loading, "Caricamento atleti");
    return;
  }

  if (section === "tag") {
    if (tagTotalCount) {
      tagTotalCount.classList.toggle("is-inline-loading", loading);
      tagTotalCount.setAttribute("aria-busy", loading ? "true" : "false");
    }
  }
}

function toggleFooterLoader(container, isLoading, label) {
  if (!container) {
    return;
  }

  container.classList.toggle("is-loading", Boolean(isLoading));

  if (!isLoading) {
    const existing = container.querySelector(".footer-filter-loader");
    if (existing) {
      existing.remove();
    }
    return;
  }

  if (container.querySelector(".footer-filter-loader")) {
    return;
  }

  container.innerHTML = "";
  const loader = document.createElement("span");
  loader.className = "footer-filter-loader";
  loader.setAttribute("aria-label", label);
  container.appendChild(loader);
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
    renderLoading();
    scrollToResultsIfNeeded({ behavior: "auto" });
    await runSearch();
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
      const expandButton = event.target.closest("button[data-action='expand-channels']");
      if (expandButton) {
        footerChannelsExpanded = true;
        renderFooterQuickLinks(footerChannelLinksEl, footerChannelValues, "channel");
        return;
      }

      const collapseButton = event.target.closest("button[data-action='collapse-channels']");
      if (collapseButton) {
        footerChannelsExpanded = false;
        renderFooterQuickLinks(footerChannelLinksEl, footerChannelValues, "channel");
        return;
      }

      const button = event.target.closest("button[data-filter-value]");
      if (!button) {
        return;
      }

      await applyFooterQuickFilter("channel", button.dataset.filterValue || "");
    });
  }

  if (footerAthleteLinksEl) {
    footerAthleteLinksEl.addEventListener("click", async (event) => {
      const expandButton = event.target.closest("button[data-action='expand-athletes']");
      if (expandButton) {
        footerAthletesExpanded = true;
        renderFooterQuickLinks(footerAthleteLinksEl, footerAthleteValues, "athlete");
        return;
      }

      const collapseButton = event.target.closest("button[data-action='collapse-athletes']");
      if (collapseButton) {
        footerAthletesExpanded = false;
        renderFooterQuickLinks(footerAthleteLinksEl, footerAthleteValues, "athlete");
        return;
      }

      const button = event.target.closest("button[data-filter-value]");
      if (!button) {
        return;
      }

      await applyFooterQuickFilter("athlete", button.dataset.filterValue || "");
    });
  }

  if (liveCarouselPrevBtn && liveCarouselTrack) {
    liveCarouselPrevBtn.addEventListener("click", () => {
      const scrollAmount = Math.max(280, Math.floor(liveCarouselTrack.clientWidth * 0.72));
      liveCarouselTrack.scrollBy({ left: -scrollAmount, behavior: "smooth" });
    });
  }

  if (liveCarouselNextBtn && liveCarouselTrack) {
    liveCarouselNextBtn.addEventListener("click", () => {
      const scrollAmount = Math.max(280, Math.floor(liveCarouselTrack.clientWidth * 0.72));
      liveCarouselTrack.scrollBy({ left: scrollAmount, behavior: "smooth" });
    });
  }

  if (liveCarouselTrack) {
    liveCarouselTrack.addEventListener("click", async (event) => {
      const link = event.target.closest("a[data-live-video-id]");
      if (!link) {
        return;
      }

      event.preventDefault();
      const videoId = String(link.dataset.liveVideoId || "");
      if (!videoId) {
        return;
      }

      await openDetailById(videoId, true);
    });
  }

  const liveProgramButtons = [openLiveProgramDesktopBtn, openLiveProgramMobileBtn].filter(Boolean);
  for (const button of liveProgramButtons) {
    button.addEventListener("click", async () => {
      await openLiveProgramPage(true);
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

  if (liveProgramBackBtn) {
    liveProgramBackBtn.addEventListener("click", async (event) => {
      event.preventDefault();
      await resetToInitialHome(true);
    });
  }

  if (liveProgramList) {
    liveProgramList.addEventListener("click", async (event) => {
      const link = event.target.closest("a[data-video-id]");
      if (!link) {
        return;
      }

      event.preventDefault();
      await openDetailById(String(link.dataset.videoId || ""), true);
    });
  }

  if (liveEndedList) {
    liveEndedList.addEventListener("click", async (event) => {
      const link = event.target.closest("a[data-video-id]");
      if (!link) {
        return;
      }

      event.preventDefault();
      await openDetailById(String(link.dataset.videoId || ""), true);
    });
  }

  if (liveEndedPrevBtn) {
    liveEndedPrevBtn.addEventListener("click", () => {
      if (liveEndedPagingState.currentPage <= 1) {
        return;
      }
      renderLiveEndedPage(liveEndedPagingState.currentPage - 1);
      scrollToLiveEndedTitle();
    });
  }

  if (liveEndedNextBtn) {
    liveEndedNextBtn.addEventListener("click", () => {
      if (liveEndedPagingState.currentPage >= liveEndedPagingState.totalPages) {
        return;
      }
      renderLiveEndedPage(liveEndedPagingState.currentPage + 1);
      scrollToLiveEndedTitle();
    });
  }

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
  setFilterOptionsLoading(true);

  const results = await Promise.allSettled([
    loadChannelFilterOptions(),
    loadAthleteFilterOptions(),
    loadTagFilterOptions()
  ]);

  const hasError = results.some((result) => result.status === "rejected");
  if (hasError) {
    showStatus("Alcune opzioni filtro non sono state caricate completamente.");
  }
}

async function loadChannelFilterOptions() {
  setFilterSectionLoading("channel", true);

  try {
    const query = new URLSearchParams();
    query.set("select", "channel");
    query.set("order", "channel.asc");
    const rows = await fetchAllRows(query, 500);

    const channelsByKey = new Map();
    channelVideoCounts = new Map();

    for (const row of rows) {
      if (!row.channel) {
        continue;
      }

      const channelName = String(row.channel || "").trim();
      const key = normalizeSearchText(channelName);
      if (!key) {
        continue;
      }

      if (!channelsByKey.has(key)) {
        channelsByKey.set(key, channelName);
      }
      channelVideoCounts.set(key, (channelVideoCounts.get(key) || 0) + 1);
    }

    renderChannelOptions(sortByVideoCount([...channelsByKey.values()], channelVideoCounts, normalizeSearchText));
  } catch (error) {
    renderChannelOptions([]);
    throw error;
  } finally {
    setFilterSectionLoading("channel", false);
  }
}

async function loadAthleteFilterOptions() {
  setFilterSectionLoading("athlete", true);

  try {
    const query = new URLSearchParams();
    query.set("select", "atleti");
    const rows = await fetchAllRows(query, 500);

    const athletesByKey = new Map();
    athleteVideoCounts = new Map();

    for (const row of rows) {
      const athleteNames = normalizeAthletesValue(row.atleti);
      const athleteKeysForRow = new Set();

      for (const name of athleteNames) {
        const displayName = formatAthleteDisplayName(name);
        if (!displayName || !isValidAthleteOption(displayName)) {
          continue;
        }

        const key = buildAthleteCanonicalKey(displayName);
        if (!key) {
          continue;
        }

        if (!athletesByKey.has(key)) {
          athletesByKey.set(key, displayName);
        }
        athleteKeysForRow.add(key);
      }

      for (const athleteKey of athleteKeysForRow) {
        athleteVideoCounts.set(athleteKey, (athleteVideoCounts.get(athleteKey) || 0) + 1);
      }
    }

    renderAthleteOptions(sortByVideoCount([...athletesByKey.values()], athleteVideoCounts, buildAthleteCanonicalKey));
  } catch (error) {
    renderAthleteOptions([]);
    throw error;
  } finally {
    setFilterSectionLoading("athlete", false);
  }
}

async function loadTagFilterOptions() {
  setFilterSectionLoading("tag", true);

  try {
    const query = new URLSearchParams();
    query.set("select", "tags");
    const rows = await fetchAllRows(query, 500);

    const tagsByKey = new Map();
    tagVideoCounts = new Map();

    for (const row of rows) {
      const tagNames = normalizeTagsValue(row.tags);
      const tagKeysForRow = new Set();

      for (const name of tagNames) {
        if (!name || isTimeLikeTag(name)) {
          continue;
        }

        const key = normalizeSearchText(name);
        if (!key) {
          continue;
        }

        if (!tagsByKey.has(key)) {
          tagsByKey.set(key, name);
        }
        tagKeysForRow.add(key);
      }

      for (const tagKey of tagKeysForRow) {
        tagVideoCounts.set(tagKey, (tagVideoCounts.get(tagKey) || 0) + 1);
      }
    }

    renderTagOptions(sortAlphabetically([...tagsByKey.values()]));
  } catch (error) {
    renderTagOptions([]);
    throw error;
  } finally {
    setFilterSectionLoading("tag", false);
  }
}

function renderChannelOptions(values) {
  footerChannelValues = Array.isArray(values) ? [...values] : [];
  footerChannelsExpanded = false;
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
  const visibleValues = getVisibleFooterQuickLinkValues(values, type);

  for (const value of visibleValues) {
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

  if (type === "channel" || type === "athlete") {
    const isExpanded = type === "channel" ? footerChannelsExpanded : footerAthletesExpanded;
    const hasMoreValues = values.length > FOOTER_QUICK_LINK_INITIAL_LIMIT;

    if (hasMoreValues) {
      const moreButton = document.createElement("button");
      moreButton.type = "button";
      moreButton.className = "footer-filter-more-btn";
      moreButton.dataset.action = isExpanded
        ? (type === "channel" ? "collapse-channels" : "collapse-athletes")
        : (type === "channel" ? "expand-channels" : "expand-athletes");
      moreButton.textContent = isExpanded ? "Mostra meno" : "Mostra tutti";
      fragment.appendChild(moreButton);
    }
  }

  container.appendChild(fragment);
}

function getVisibleFooterQuickLinkValues(values, type) {
  if (type === "channel") {
    return footerChannelsExpanded ? values : values.slice(0, FOOTER_QUICK_LINK_INITIAL_LIMIT);
  }

  if (type === "athlete") {
    return footerAthletesExpanded ? values : values.slice(0, FOOTER_QUICK_LINK_INITIAL_LIMIT);
  }

  if (type !== "athlete" || footerAthletesExpanded) {
    return values;
  }

  return values.filter(
    (value) => getVideoCountForValue(value, athleteVideoCounts, buildAthleteCanonicalKey) >= FOOTER_ATHLETE_MIN_VISIBLE_VIDEOS
  );
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
  footerAthletesExpanded = false;
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
  const contentType = normalizeContentTypeFilterValue(contentTypeInput?.value || "");

  applyStructuredFilters(query, {
    channels,
    dateFrom,
    dateTo,
    durationRange,
    contentType
  });

  if (!hasActiveFilters({
    q: text,
    channels,
    athletes,
    tags,
    dateFrom,
    dateTo,
    durationRange,
    contentType
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
    durationRange,
    contentType
  });
  setActiveQuickRange(matchedQuickRange);

  pagingState.titleText = buildSearchSummaryTitle({
    q: text,
    channels,
    athletes,
    tags,
    dateFrom,
    dateTo,
    durationRange,
    contentType
  });

  const needsLocalTextFilter = Boolean(text);
  const needsLocalAthleteFilter = athletes.length > 0;
  const needsLocalTagFilter = tags.length > 0;

  if (needsLocalTextFilter || needsLocalAthleteFilter || needsLocalTagFilter) {
    clearStatus();
    renderLoading();
    try {
      const candidates = await fetchAllRows(query, 500);
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

async function loadLiveCarousel() {
  if (!liveCarouselSection || !liveCarouselTrack || !liveCarouselStatus) {
    return;
  }

  liveCarouselSection.dataset.hasItems = "false";
  setLiveCarouselVisibility(true);
  updateLivePresenceDot(false);
  liveCarouselStatus.textContent = "Caricamento live...";
  liveCarouselTrack.innerHTML = "";

  try {
    const rows = await fetchLiveRows();
    const filteredRows = rows.filter((row) => shouldIncludeInLiveCarousel(row));

    const sortedRows = [...filteredRows].sort((a, b) => {
      const rankDelta = getLiveCarouselRank(a) - getLiveCarouselRank(b);
      if (rankDelta !== 0) {
        return rankDelta;
      }

      const dateA = getLiveCarouselSortDateMs(a);
      const dateB = getLiveCarouselSortDateMs(b);

      if (getLiveCarouselRank(a) === 0) {
        // Live in corso: le piu recenti prima.
        if (dateB !== dateA) {
          return dateB - dateA;
        }
      } else if (getLiveCarouselRank(a) === 1) {
        // Programmate: ordine cronologico crescente.
        if (dateA !== dateB) {
          return dateA - dateB;
        }
      } else if (dateB !== dateA) {
        return dateB - dateA;
      }

      return String(a.id || "").localeCompare(String(b.id || ""), "it", { sensitivity: "base" });
    });

    renderLiveCarousel(sortedRows);
  } catch (error) {
    liveRowsCache = [];
    liveCarouselSection.dataset.hasItems = "false";
    setLiveCarouselVisibility(false);
  }
}

async function fetchLiveRows() {
  const query = new URLSearchParams();
  query.set("select", "id,title_it,title_en,channel,thumbnail,upload_date,duration,view_count,content_type,live_status,is_live_now,was_live,live_started_at,live_published_at");
  query.set("content_type", "eq.live");
  const rows = await fetchAllRows(query, 500);
  liveRowsCache = Array.isArray(rows) ? rows : [];
  return liveRowsCache;
}

async function openLiveProgramPage(pushHistory) {
  showLiveProgramView();

  if (liveProgramMeta) {
    liveProgramMeta.textContent = "Caricamento programma live...";
  }
  if (liveEndedMeta) {
    liveEndedMeta.textContent = "Caricamento live terminate...";
  }
  if (liveProgramList) {
    liveProgramList.innerHTML = "";
  }
  if (liveEndedList) {
    liveEndedList.innerHTML = "";
  }
  if (liveEndedPaginationEl) {
    liveEndedPaginationEl.classList.add("hidden");
  }

  if (pushHistory) {
    window.history.pushState({ view: "live-program" }, "", buildAppPath("live-programma"));
  }

  try {
    const rows = liveRowsCache.length ? liveRowsCache : await fetchLiveRows();
    renderLiveProgramLists(rows);
  } catch (error) {
    if (liveProgramMeta) {
      liveProgramMeta.textContent = "Errore nel caricamento del programma live.";
    }
    if (liveEndedMeta) {
      liveEndedMeta.textContent = "Errore nel caricamento delle live terminate.";
    }
    if (liveProgramList) {
      liveProgramList.innerHTML = "";
    }
    if (liveEndedList) {
      liveEndedList.innerHTML = "";
    }
  }
}

function renderLiveProgramLists(rows) {
  if (!liveProgramList || !liveEndedList) {
    return;
  }

  const safeRows = Array.isArray(rows) ? rows : [];
  const inProgramRows = safeRows.filter((row) => shouldIncludeInLiveCarousel(row));
  const endedRows = safeRows.filter((row) => shouldIncludeAsEndedLiveProgramRow(row));

  const sortedInProgramRows = [...inProgramRows].sort((a, b) => {
    const rankDelta = getLiveCarouselRank(a) - getLiveCarouselRank(b);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    const dateA = getLiveCarouselSortDateMs(a);
    const dateB = getLiveCarouselSortDateMs(b);
    if (getLiveCarouselRank(a) === 1) {
      return dateA - dateB;
    }
    return dateB - dateA;
  });

  const sortedEndedRows = [...endedRows].sort((a, b) => getLiveCarouselSortDateMs(b) - getLiveCarouselSortDateMs(a));

  renderLiveProgramListToContainer(liveProgramList, sortedInProgramRows);
  setupLiveEndedPagination(sortedEndedRows);
  renderLiveEndedPage(1);

  if (liveProgramMeta) {
    liveProgramMeta.textContent = sortedInProgramRows.length
      ? `${sortedInProgramRows.length} live in corso o programmate a breve`
      : "Nessuna live in corso o programmata a breve.";
  }

  if (liveEndedMeta) {
    liveEndedMeta.textContent = sortedEndedRows.length
      ? `${sortedEndedRows.length} live terminate recenti`
      : "Nessuna live terminata recente.";
  }
}

function setupLiveEndedPagination(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  liveEndedPagingState.rows = safeRows;
  liveEndedPagingState.totalItems = safeRows.length;
  liveEndedPagingState.totalPages = Math.max(1, Math.ceil(safeRows.length / liveEndedPagingState.pageSize));
  liveEndedPagingState.currentPage = 1;
}

function renderLiveEndedPage(page) {
  if (!liveEndedList) {
    return;
  }

  const safePage = Math.max(1, Math.min(Number(page) || 1, liveEndedPagingState.totalPages));
  liveEndedPagingState.currentPage = safePage;

  const from = (safePage - 1) * liveEndedPagingState.pageSize;
  const to = from + liveEndedPagingState.pageSize;
  const pageRows = liveEndedPagingState.rows.slice(from, to);

  renderLiveProgramListToContainer(liveEndedList, pageRows);
  renderLiveEndedPagination();
}

function renderLiveEndedPagination() {
  if (!liveEndedPaginationEl || !liveEndedPageNumbersEl || !liveEndedPrevBtn || !liveEndedNextBtn) {
    return;
  }

  if (liveEndedPagingState.totalItems <= liveEndedPagingState.pageSize) {
    liveEndedPaginationEl.classList.add("hidden");
    liveEndedPageNumbersEl.innerHTML = "";
    liveEndedPrevBtn.classList.add("hidden");
    liveEndedNextBtn.classList.add("hidden");
    liveEndedPrevBtn.disabled = true;
    liveEndedNextBtn.disabled = true;
    return;
  }

  liveEndedPaginationEl.classList.remove("hidden");
  liveEndedPrevBtn.classList.toggle("hidden", liveEndedPagingState.currentPage <= 1);
  liveEndedNextBtn.classList.toggle("hidden", liveEndedPagingState.currentPage >= liveEndedPagingState.totalPages);
  liveEndedPrevBtn.disabled = liveEndedPagingState.currentPage <= 1;
  liveEndedNextBtn.disabled = liveEndedPagingState.currentPage >= liveEndedPagingState.totalPages;
  liveEndedPageNumbersEl.innerHTML = "";

  const pages = buildVisiblePages(liveEndedPagingState.currentPage, liveEndedPagingState.totalPages);
  for (const page of pages) {
    if (page === "...") {
      const span = document.createElement("span");
      span.className = "page-ellipsis";
      span.textContent = "...";
      liveEndedPageNumbersEl.appendChild(span);
      continue;
    }

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "page-btn";
    btn.textContent = String(page);
    if (page === liveEndedPagingState.currentPage) {
      btn.setAttribute("aria-current", "page");
    }
    btn.addEventListener("click", () => {
      if (page === liveEndedPagingState.currentPage) {
        return;
      }
      renderLiveEndedPage(page);
      scrollToLiveEndedTitle();
    });
    liveEndedPageNumbersEl.appendChild(btn);
  }
}

function scrollToLiveEndedTitle() {
  if (liveProgramEndedTitle) {
    liveProgramEndedTitle.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderLiveProgramListToContainer(container, rows) {
  container.innerHTML = "";

  if (!Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const row of rows) {
    fragment.appendChild(createLiveProgramResultItem(row));
  }
  container.appendChild(fragment);
}

function createLiveProgramResultItem(row) {
  videoCache.set(String(row.id), row);

  const item = template.content.firstElementChild.cloneNode(true);
  const thumbLink = item.querySelector(".thumb-wrap");
  const thumb = item.querySelector(".thumb");
  const title = item.querySelector(".title-link");
  const meta = item.querySelector(".meta");

  const internalUrl = buildVideoPath(row);
  const titleText = row.title_it || row.title_en || row.id || "Live";

  thumbLink.href = internalUrl;
  title.href = internalUrl;
  thumbLink.dataset.videoId = String(row.id || "");
  title.dataset.videoId = String(row.id || "");
  title.textContent = titleText;

  const liveBadgeInfo = getLiveBadgeInfo(row);
  if (liveBadgeInfo) {
    thumbLink.appendChild(createLiveBadgeElement(liveBadgeInfo));
  }

  thumb.src = row.thumbnail || "https://placehold.co/640x360/e7eef1/10333a?text=No+Thumbnail";
  thumb.alt = `Anteprima ${titleText}`;

  const startsAtText = formatDateTimeValue(row.live_started_at);
  const publishedAtText = formatDateTimeValue(row.live_published_at);
  const metaParts = [row.channel || "Canale n/d"];
  if (startsAtText && startsAtText !== "n/d") {
    metaParts.push(`Inizio ${startsAtText}`);
  } else if (publishedAtText && publishedAtText !== "n/d") {
    metaParts.push(`Pubblicata ${publishedAtText}`);
  }
  meta.textContent = metaParts.join(" • ");

  return item;
}

function shouldIncludeAsEndedLiveProgramRow(row) {
  const state = getLiveCarouselState(row);
  if (state !== "ended") {
    return false;
  }

  const referenceDate = getLiveCarouselReferenceDate(row);
  if (!(referenceDate instanceof Date)) {
    return false;
  }

  const nowMs = Date.now();
  const referenceMs = referenceDate.getTime();
  return referenceMs <= nowMs && referenceMs >= nowMs - LIVE_CAROUSEL_ONAIR_LOOKBACK_MS;
}

function renderLiveCarousel(rows) {
  if (!liveCarouselSection || !liveCarouselTrack || !liveCarouselStatus) {
    return;
  }

  liveCarouselTrack.innerHTML = "";
  const hasLiveInProgress = Array.isArray(rows) && rows.some((row) => getLiveCarouselRank(row) === 0);
  updateLivePresenceDot(hasLiveInProgress);

  if (!Array.isArray(rows) || rows.length === 0) {
    liveCarouselSection.dataset.hasItems = "false";
    setLiveCarouselVisibility(false);
    liveCarouselStatus.textContent = "Nessuna live in corso o programmata nel futuro.";
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    videoCache.set(String(row.id), row);

    const item = document.createElement("article");
    item.className = "live-carousel-item";

    const link = document.createElement("a");
    link.className = "live-carousel-link";
    link.href = buildVideoPath(row);
    link.dataset.liveVideoId = String(row.id || "");

    const thumbWrap = document.createElement("span");
    thumbWrap.className = "live-carousel-thumb-wrap";

    const thumb = document.createElement("img");
    thumb.className = "live-carousel-thumb";
    thumb.loading = "lazy";
    thumb.src = row.thumbnail || "https://placehold.co/640x360/e7eef1/10333a?text=No+Thumbnail";
    thumb.alt = `Anteprima ${row.title_it || row.title_en || row.id || "Live"}`;
    thumbWrap.appendChild(thumb);

    const liveBadgeInfo = getLiveBadgeInfo(row);
    if (liveBadgeInfo) {
      thumbWrap.appendChild(createLiveBadgeElement(liveBadgeInfo));
    }

    const content = document.createElement("span");
    content.className = "live-carousel-content";

    const title = document.createElement("span");
    title.className = "live-carousel-title";
    title.textContent = row.title_it || row.title_en || row.id || "Live";

    const meta = document.createElement("span");
    meta.className = "live-carousel-meta";

    const startsAtText = formatDateTimeValue(row.live_started_at);
    const publishedAtText = formatDateTimeValue(row.live_published_at);
    const metaParts = [row.channel || "Canale n/d"];

    if (startsAtText && startsAtText !== "n/d") {
      metaParts.push(`Inizio ${startsAtText}`);
    } else if (publishedAtText && publishedAtText !== "n/d") {
      metaParts.push(`Pubblicata ${publishedAtText}`);
    }

    meta.textContent = metaParts.join(" • ");
    content.appendChild(title);
    content.appendChild(meta);

    link.appendChild(thumbWrap);
    link.appendChild(content);
    item.appendChild(link);
    fragment.appendChild(item);
  }

  liveCarouselTrack.appendChild(fragment);
  liveCarouselSection.dataset.hasItems = "true";
  setLiveCarouselVisibility(true);
  liveCarouselStatus.textContent = `${rows.length} live in corso o programmate (future)`;
}

function getLiveCarouselRank(row) {
  const liveBadgeInfo = getLiveBadgeInfo(row);
  if (!liveBadgeInfo) {
    return 3;
  }

  if (liveBadgeInfo.className === "is-onair") {
    return 0;
  }

  if (liveBadgeInfo.className === "is-upcoming") {
    return 1;
  }

  return 2;
}

function getLiveCarouselSortDateMs(row) {
  const primaryDate = parseDateMaybe(row?.live_started_at) || parseDateMaybe(row?.live_published_at);
  if (primaryDate instanceof Date) {
    return primaryDate.getTime();
  }

  const uploadRaw = String(row?.upload_date || "").trim();
  if (/^\d{8}$/.test(uploadRaw)) {
    const uploadParsed = parseDateMaybe(`${uploadRaw.slice(0, 4)}-${uploadRaw.slice(4, 6)}-${uploadRaw.slice(6, 8)}T00:00:00`);
    if (uploadParsed instanceof Date) {
      return uploadParsed.getTime();
    }
  }

  return 0;
}

function isLiveCarouselRowInWindow(row) {
  const referenceDate = getLiveCarouselReferenceDate(row);
  if (!(referenceDate instanceof Date)) {
    return false;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lowerBound = new Date(todayStart);
  lowerBound.setDate(lowerBound.getDate() - 2);
  const upperBound = new Date(todayStart);
  upperBound.setDate(upperBound.getDate() + 1);

  const referenceMs = referenceDate.getTime();
  return referenceMs >= lowerBound.getTime() && referenceMs < upperBound.getTime();
}

function shouldIncludeInLiveCarousel(row) {
  const state = getLiveCarouselState(row);
  const referenceDate = getLiveCarouselReferenceDate(row);
  const nowMs = Date.now();

  if (state === "onair") {
    if (!(referenceDate instanceof Date)) {
      return true;
    }

    // Live in corso recenti: ora e ultime 48 ore.
    return referenceDate.getTime() >= nowMs - LIVE_CAROUSEL_ONAIR_LOOKBACK_MS;
  }

  if (state === "upcoming") {
    if (!(referenceDate instanceof Date)) {
      return false;
    }

    // Programmate: solo eventi futuri (esclude in programma con data passata).
    return referenceDate.getTime() > nowMs;
  }

  return false;
}

function getLiveCarouselState(row) {
  const liveBadgeInfo = getLiveBadgeInfo(row);
  if (!liveBadgeInfo) {
    return "ended";
  }

  if (liveBadgeInfo.className === "is-onair") {
    return "onair";
  }

  if (liveBadgeInfo.className === "is-upcoming") {
    return "upcoming";
  }

  return "ended";
}

function getLiveCarouselReferenceDate(row) {
  const startedAt = parseDateMaybe(row?.live_started_at);
  if (startedAt instanceof Date) {
    return startedAt;
  }

  const publishedAt = parseDateMaybe(row?.live_published_at);
  if (publishedAt instanceof Date) {
    return publishedAt;
  }

  return null;
}

function updateLivePresenceDot(hasLiveInProgress) {
  if (!livePresenceDot) {
    return;
  }

  const onAir = Boolean(hasLiveInProgress);
  livePresenceDot.classList.toggle("is-onair", onAir);
  livePresenceDot.classList.toggle("is-upcoming", !onAir);
  livePresenceDot.setAttribute("aria-label", onAir ? "Almeno una live in corso" : "Nessuna live in corso");
  livePresenceDot.title = onAir ? "Live in corso disponibili" : "Solo live programmate/terminate";
}

function createLiveBadgeElement(liveBadgeInfo) {
  const badgeEl = document.createElement("span");
  badgeEl.className = `live-badge ${liveBadgeInfo.className}`;

  const badgeCopyEl = document.createElement("span");
  badgeCopyEl.className = "live-badge-copy";

  const badgeMainEl = document.createElement("span");
  badgeMainEl.className = "live-badge-main";
  badgeMainEl.textContent = liveBadgeInfo.text;
  badgeCopyEl.appendChild(badgeMainEl);

  if (liveBadgeInfo.subtext) {
    const badgeSubEl = document.createElement("span");
    badgeSubEl.className = "live-badge-sub";
    badgeSubEl.textContent = liveBadgeInfo.subtext;
    badgeCopyEl.appendChild(badgeSubEl);
  }

  badgeEl.appendChild(badgeCopyEl);
  badgeEl.setAttribute("aria-label", liveBadgeInfo.ariaLabel);
  badgeEl.title = liveBadgeInfo.ariaLabel;
  return badgeEl;
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

    const liveBadgeInfo = getLiveBadgeInfo(row);
    if (liveBadgeInfo) {
      const badgeEl = createLiveBadgeElement(liveBadgeInfo);
      thumbLink.appendChild(badgeEl);
    }

    thumb.src = row.thumbnail || "https://placehold.co/640x360/e7eef1/10333a?text=No+Thumbnail";
    thumb.alt = `Anteprima ${titleText}`;

    const parts = [];
    if (row.channel) {
      parts.push(row.channel);
    }
    if (row.upload_date) {
      parts.push(formatUploadDate(row.upload_date));
    }
    const viewCount = Number(row.view_count);
    if (Number.isFinite(viewCount) && viewCount > 0) {
      const viewsLabel = getViewsLabel(isItalianContent);
      parts.push(`${viewCount.toLocaleString("it-IT")} ${viewsLabel}`);
    }
    const durationText = formatDurationHms(row.duration);
    if (durationText && String(durationText).trim() !== "00:00 minuti") {
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
  if (isLiveProgramPath(window.location.pathname)) {
    await openLiveProgramPage(false);
    return;
  }

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
  const isItalianContent = inferItalianContent(row);

  detailTitle.textContent = titleText;
  detailChannel.textContent = `${channelText} • ${formatUploadDate(row.upload_date)}`;
  renderDetailDescriptionValue(detailDescription, descriptionText, isItalianContent);

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

  if (currentState?.view === "detail" && window.history.length > 1) {
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
    durationRange: form.durationRange.value || "",
    contentType: normalizeContentTypeFilterValue(contentTypeInput?.value || "")
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
  const contentType = normalizeContentTypeFilterValue(filters?.contentType || "");

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
    parts.push(`da: ${formatIsoDateToIt(dateFrom)}`);
  }
  if (dateTo) {
    parts.push(`a: ${formatIsoDateToIt(dateTo)}`);
  }
  if (durationRange) {
    parts.push(`durata: ${getDurationRangeLabel(durationRange)}`);
  }
  if (contentType) {
    parts.push(`tipo: ${getContentTypeLabel(contentType)}`);
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
  if (contentTypeInput) {
    contentTypeInput.value = denormalizeContentTypeFilterValue(safe.contentType || "");
  }
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
    || normalizeContentTypeFilterValue(safe.contentType || "")
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
      btn.blur();
      scrollToResultsIfNeeded({ behavior: "auto" });
      await loadPage(page);
      scrollToResultsIfNeeded({ defer: true, behavior: "auto" });
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
    durationRange,
    contentType
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

  if (contentType) {
    query.set("content_type", `eq.${contentType}`);
  }
}

function normalizeContentTypeFilterValue(rawValue) {
  const value = String(rawValue || "").trim().toLowerCase();
  if (value === "reels" || value === "short") {
    return "short";
  }
  if (value === "live") {
    return "live";
  }
  if (value === "video") {
    return "video";
  }
  return "";
}

function denormalizeContentTypeFilterValue(value) {
  const normalized = normalizeContentTypeFilterValue(value);
  if (normalized === "short") {
    return "reels";
  }
  return normalized;
}

function getContentTypeLabel(value) {
  switch (normalizeContentTypeFilterValue(value)) {
    case "video":
      return "video";
    case "short":
      return "reels";
    case "live":
      return "live";
    default:
      return String(value || "");
  }
}

function toBoolLoose(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "y";
}

function parseDateMaybe(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function getLiveBadgeInfo(row) {
  if (normalizeContentTypeFilterValue(row?.content_type) !== "live") {
    return null;
  }

  const nowMs = Date.now();
  const liveStatus = String(row?.live_status || "").trim().toLowerCase();
  const isLiveNow = toBoolLoose(row?.is_live_now) || liveStatus === "is_live";
  const wasLive = toBoolLoose(row?.was_live) || liveStatus === "was_live" || liveStatus === "post_live";
  const startsAt = parseDateMaybe(row?.live_started_at);
  const startsAtMs = startsAt instanceof Date ? startsAt.getTime() : NaN;
  const hasScheduledStart = Number.isFinite(startsAtMs);
  const scheduledStartPassed = hasScheduledStart && startsAtMs <= nowMs;
  const withinFrontendOnAirWindow = scheduledStartPassed && nowMs <= startsAtMs + LIVE_FRONTEND_ONAIR_WINDOW_MS;
  const isLikelyLiveInProgress = !isLiveNow
    && !wasLive
    && withinFrontendOnAirWindow;

  if (isLiveNow || isLikelyLiveInProgress) {
    const ariaLabel = isLikelyLiveInProgress
      ? "Evento live in corso (stimato dal frontend in base all'orario di inizio)"
      : "Evento live in corso";

    return {
      text: "LIVE • in corso",
      className: "is-onair",
      ariaLabel
    };
  }

  const isUpcoming = liveStatus === "is_upcoming"
    || (!isLiveNow && !wasLive && hasScheduledStart && startsAtMs > nowMs);

  if (isUpcoming) {
    const startsAtText = formatLiveStartDateTime(startsAt);
    const subtext = startsAtText ? `Inizio ${startsAtText}` : "";
    const ariaLabel = startsAtText
      ? `Evento live in programma. Inizio previsto il ${startsAtText}`
      : "Evento live in programma";

    return {
      text: "LIVE • in programma",
      className: "is-upcoming",
      ariaLabel,
      subtext
    };
  }

  return {
    text: "LIVE • terminata",
    className: "is-ended",
    ariaLabel: "Evento live terminato"
  };
}

function formatLiveStartDateTime(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value).replace(",", "");
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

async function fetchAllRows(baseQuery, batchSize = 500, maxRows = null) {
  const allRows = [];
  let offset = 0;

  while (maxRows == null || offset < maxRows) {
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
  setLiveCarouselVisibility(liveCarouselSection?.dataset.hasItems === "true");
  resultsSection.classList.toggle("hidden", !showResultsSection);
  detailView.classList.add("hidden");
  if (liveProgramView) {
    liveProgramView.classList.add("hidden");
  }
}

function showDetailView() {
  heroSection.classList.add("hidden");
  searchCard.classList.add("hidden");
  setLiveCarouselVisibility(false);
  resultsSection.classList.add("hidden");
  detailView.classList.remove("hidden");
  if (liveProgramView) {
    liveProgramView.classList.add("hidden");
  }
}

function showLiveProgramView() {
  stopDetailPlayback();
  heroSection.classList.add("hidden");
  searchCard.classList.add("hidden");
  setLiveCarouselVisibility(false);
  resultsSection.classList.add("hidden");
  detailView.classList.add("hidden");
  if (liveProgramView) {
    liveProgramView.classList.remove("hidden");
  }
  clearStatus();
  document.title = "Programma LIVE | Ping Video Search";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setLiveCarouselVisibility(isVisible) {
  if (!liveCarouselSection) {
    return;
  }

  liveCarouselSection.classList.toggle("hidden", !isVisible);
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
    if (key === "tags") {
      renderDetailTagsValue(dd, value, isItalianContent);
    } else {
      dd.textContent = formatDetailValueByKey(key, value, isItalianContent);
    }
    detailData.appendChild(dt);
    detailData.appendChild(dd);
  }
}

function renderDetailDescriptionValue(container, text, isItalianContent) {
  const content = String(text || "").trim() || "Descrizione non disponibile.";
  const shouldCollapse = isCompactMobileDetailLayout() && content.length > DETAIL_DESCRIPTION_COLLAPSE_MAX_CHARS;

  container.innerHTML = "";

  if (!shouldCollapse) {
    container.textContent = content;
    return;
  }

  const previewCut = content.slice(0, DETAIL_DESCRIPTION_COLLAPSE_MAX_CHARS);
  const previewText = previewCut.replace(/\s+\S*$/, "").trim() || previewCut.trim();

  const textSpan = document.createElement("span");
  textSpan.className = "detail-description-text";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "detail-more-btn";

  const showMoreLabel = isItalianContent ? "Mostra altro" : "Show more";
  const showLessLabel = isItalianContent ? "Mostra meno" : "Show less";
  let expanded = false;

  const render = () => {
    textSpan.textContent = expanded ? content : `${previewText}...`;
    toggleBtn.textContent = expanded ? showLessLabel : showMoreLabel;
    toggleBtn.setAttribute("aria-expanded", String(expanded));
  };

  toggleBtn.addEventListener("click", () => {
    expanded = !expanded;
    render();
  });

  render();
  container.appendChild(textSpan);
  container.appendChild(toggleBtn);
}

function isCompactMobileDetailLayout() {
  return Boolean(window.matchMedia && window.matchMedia("(max-width: 680px)").matches);
}

function renderDetailTagsValue(container, value, isItalianContent) {
  const tags = normalizeTagsValue(value);
  if (!tags.length) {
    container.textContent = "n/d";
    return;
  }

  const fullText = tags.join(", ");
  const shouldCollapse = isCompactMobileDetailLayout() && (
    tags.length > DETAIL_TAGS_COLLAPSE_MAX_ITEMS ||
    fullText.length > DETAIL_TAGS_COLLAPSE_MAX_CHARS
  );

  if (!shouldCollapse) {
    container.textContent = fullText;
    return;
  }

  const previewText = tags.slice(0, DETAIL_TAGS_COLLAPSE_MAX_ITEMS).join(", ");
  const textSpan = document.createElement("span");
  textSpan.className = "detail-tags-text";

  const toggleBtn = document.createElement("button");
  toggleBtn.type = "button";
  toggleBtn.className = "detail-more-btn";

  const showMoreLabel = isItalianContent ? "Mostra altro" : "Show more";
  const showLessLabel = isItalianContent ? "Mostra meno" : "Show less";
  let expanded = false;

  const render = () => {
    textSpan.textContent = expanded ? fullText : `${previewText}, ...`;
    toggleBtn.textContent = expanded ? showLessLabel : showMoreLabel;
    toggleBtn.setAttribute("aria-expanded", String(expanded));
  };

  toggleBtn.addEventListener("click", () => {
    expanded = !expanded;
    render();
  });

  render();
  container.appendChild(textSpan);
  container.appendChild(toggleBtn);
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

  if (key.endsWith("_at") || key.includes("timestamp") || key.includes("datetime")) {
    return formatDateTimeValue(value);
  }

  if (key.includes("date")) {
    return formatDateValue(value);
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

function isLiveProgramPath(pathname) {
  const relativePath = stripBasePath(pathname);
  return /^\/live-programma\/?$/.test(String(relativePath || ""));
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

  return formatDateValue(yyyymmdd);
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

function scrollToResultsIfNeeded({ defer = false, behavior = "smooth" } = {}) {
  const runScroll = () => {
    const anchor = resultsHeadEl && !resultsHeadEl.classList.contains("hidden")
      ? resultsHeadEl
      : resultsSection;

    if (!anchor) {
      return;
    }

    const anchorTop = window.scrollY + anchor.getBoundingClientRect().top;
    const targetTop = Math.max(0, anchorTop - 8);
    window.scrollTo({ top: targetTop, behavior });
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
  renderLoading();
  scrollToResultsIfNeeded({ behavior: "auto" });
  await runSearch();
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
  const hasContentType = Boolean(normalizeContentTypeFilterValue(safe.contentType || ""));
  const dateFrom = String(safe.dateFrom || "");
  const dateTo = String(safe.dateTo || "");

  if (hasText || hasChannels || hasAthletes || hasTags || hasDuration || hasContentType) {
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
  return formatDateValue(isoDate);
}

function formatDateValue(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "n/d";
  }

  if (/^\d{8}$/.test(value)) {
    const year = value.slice(0, 4);
    const month = value.slice(4, 6);
    const day = value.slice(6, 8);
    return `${day}/${month}/${year}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-");
    return `${day}/${month}/${year}`;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const parsed = parseDateMaybe(value);
    if (parsed) {
      return new Intl.DateTimeFormat("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(parsed);
    }
  }

  return value;
}

function formatDateTimeValue(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) {
    return "n/d";
  }

  if (/^\d{8}$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return formatDateValue(value);
  }

  const parsed = parseDateMaybe(value);
  if (!parsed) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(parsed).replace(",", "");
}
