// ESC Recap — grid app logic.
// Builds the year × country grid, handles search, filters, and modal video.

(function () {
  const DATA = window.ESC_DATA;
  const COUNTRIES_META = window.ESC_COUNTRIES;

  // ---------- Viewed entries tracking ----------
  const STORAGE_KEY = "esc-recap-viewed";
  let viewedEntries = new Set();

  function loadViewedEntries() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        viewedEntries = new Set(JSON.parse(stored));
      }
    } catch (e) {
      // silently fail if localStorage is unavailable
    }
  }

  function saveViewedEntries() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(viewedEntries)));
    } catch (e) {
      // silently fail if localStorage is unavailable
    }
  }

  function markAsViewed(year, country) {
    const key = year + "|" + country;
    viewedEntries.add(key);
    saveViewedEntries();
    updateViewedUI();
  }

  // ---------- Derived data ----------
  // unique years (asc) and countries (sorted by total entry count desc, ties alphabetical by code)
  const YEAR_MIN = Math.min(...window.ESC_DATA.map(r => r.year));
  const YEAR_MAX = Math.max(...window.ESC_DATA.map(r => r.year));
  const allYears = [];
  for (let y = YEAR_MAX; y >= YEAR_MIN; y--) allYears.push(y); // newest first (top → down)

  const countryCounts = {};
  const countryWins = {};
  const countryPlaceSum = {};
  for (const r of DATA) {
    if (r.country === "XX") continue;
    countryCounts[r.country] = (countryCounts[r.country] || 0) + 1;
    if (r.place === 1) countryWins[r.country] = (countryWins[r.country] || 0) + 1;
    if (r.place != null) countryPlaceSum[r.country] = (countryPlaceSum[r.country] || 0) + r.place;
  }

  // Sort orders
  function sortByPlacement(a, b) {
    // most wins first, then best average placement, then alphabetical
    const wA = countryWins[a] || 0, wB = countryWins[b] || 0;
    if (wB !== wA) return wB - wA;
    const avgA = (countryPlaceSum[a] || 999) / (countryCounts[a] || 1);
    const avgB = (countryPlaceSum[b] || 999) / (countryCounts[b] || 1);
    if (avgA !== avgB) return avgA - avgB;
    const nA = (COUNTRIES_META[a]?.name || a);
    const nB = (COUNTRIES_META[b]?.name || b);
    return nA.localeCompare(nB);
  }
  function sortAlpha(a, b) {
    const nA = (COUNTRIES_META[a]?.name || a);
    const nB = (COUNTRIES_META[b]?.name || b);
    return nA.localeCompare(nB);
  }

  let allCountries = Object.keys(countryCounts).sort(sortByPlacement);
  // populate state.countries after computing allCountries

  // index entries by year+country
  const byYC = new Map();
  for (const r of DATA) {
    byYC.set(r.year + "|" + r.country, r);
  }

  // years with a winner (for left-axis highlight)
  const winnerYears = new Set(DATA.filter(r => r.place === 1).map(r => r.year));

  // ---------- State ----------
  const state = {
    query: "",
    sort: "placement", // "placement" | "alpha"
  };

  // ---------- DOM refs ----------
  const grid = document.getElementById("grid");
  const gridWrap = document.getElementById("grid-wrap");
  const emptyState = document.getElementById("empty-state");
  const searchInput = document.getElementById("search");
  const searchWrap = document.getElementById("search-wrap");
  const searchClear = document.getElementById("search-clear");
  const searchResults = document.getElementById("search-results");
  const statEntries = document.getElementById("stat-entries");
  const statCountries = document.getElementById("stat-countries");
  const statYears = document.getElementById("stat-years");
  const sortBtnPlace = document.getElementById("sort-place");
  const sortBtnAlpha = document.getElementById("sort-alpha");
  const randomBtn = document.getElementById("random-btn");

  // modal
  const modal = document.getElementById("modal");
  const modalClose = document.getElementById("modal-close");
  const modalVideo = document.getElementById("modal-video");
  const modalFlag = document.getElementById("modal-flag");
  const modalYear = document.getElementById("modal-year");
  const modalCountry = document.getElementById("modal-country");
  const modalPlace = document.getElementById("modal-place");
  const modalTitle = document.getElementById("modal-title");
  const modalArtist = document.getElementById("modal-artist");
  const navPrevYear = document.getElementById("nav-prev-year");
  const navNextYear = document.getElementById("nav-next-year");
  const navPrevPlace = document.getElementById("nav-prev-place");
  const navNextPlace = document.getElementById("nav-next-place");
  const navPrevYearText = document.getElementById("nav-prev-year-text");
  const navNextYearText = document.getElementById("nav-next-year-text");
  const navPrevPlaceText = document.getElementById("nav-prev-place-text");
  const navNextPlaceText = document.getElementById("nav-next-place-text");

  // Pre-compute per-year ordering for placement mode.
  // For each year, build a sparse array indexed by (place - 1) -> country code.
  // Max placement slot we render in placement mode:
  const MAX_PLACE_SLOTS = 26;
  const placementByYear = {};
  for (const y of allYears) {
    placementByYear[y] = [];
  }
  for (const r of DATA) {
    if (r.country === "XX") continue;
    if (r.place == null) continue;
    if (r.place > MAX_PLACE_SLOTS) continue;
    placementByYear[r.year][r.place - 1] = r.country;
  }

  // ---------- Build static grid skeleton ----------
  // alpha mode: columns are countries (sorted A–Z)
  // placement mode: columns are rank slots (#1, #2, ...). Each row's cell at slot i
  // holds the entry whose final placement was i+1 in that year.
  function buildGrid() {
    const placementMode = state.sort === "placement";
    const colCount = placementMode ? MAX_PLACE_SLOTS : allCountries.length;
    const colWidth = placementMode ? "var(--col-w-rank)" : "var(--col-w)";
    grid.style.gridTemplateColumns = `var(--year-w) repeat(${colCount}, ${colWidth})`;
    grid.style.gridTemplateRows = `var(--header-h) repeat(${allYears.length}, var(--row-h))`;

    const frag = document.createDocumentFragment();

    // corner
    const corner = el("div", "corner");
    corner.innerHTML = placementMode
      ? `<div class="axis-label">YEAR ↓<br/>RANK →</div>`
      : `<div class="axis-label">YEAR ↓<br/>COUNTRY →</div>`;
    frag.appendChild(corner);

    if (placementMode) {
      // rank header row
      for (let i = 0; i < MAX_PLACE_SLOTS; i++) {
        const h = el("div", "col-head rank-head");
        h.dataset.rank = i + 1;
        const label = i === 0 ? `<span class="crown">★</span> 1<sup>st</sup>`
                    : i === 1 ? `2<sup>nd</sup>`
                    : i === 2 ? `3<sup>rd</sup>`
                    : `${i + 1}<sup>th</sup>`;
        h.innerHTML = `<span class="rank-label">${label}</span>`;
        frag.appendChild(h);
      }
    } else {
      // country header row
      for (const cc of allCountries) {
        const meta = COUNTRIES_META[cc] || { name: cc, flag: "🏳️" };
        const h = el("div", "col-head");
        h.dataset.country = cc;
        h.innerHTML = `
          <span class="flag">${meta.flag}</span>
          <span class="code">${cc}</span>
          <span class="name" title="${escapeHtml(meta.name)}">${escapeHtml(meta.name)}</span>
        `;
        frag.appendChild(h);
      }
    }

    // year rows
    for (const y of allYears) {
      const rh = el("div", "row-head");
      rh.dataset.year = y;
      if (y % 10 === 0) rh.dataset.decade = "true";
      if (winnerYears.has(y)) rh.dataset.hasWinner = "true";
      rh.innerHTML = `<span class="winner-dot"></span>${y}`;
      frag.appendChild(rh);

      if (placementMode) {
        const order = placementByYear[y] || [];
        for (let i = 0; i < MAX_PLACE_SLOTS; i++) {
          const cc = order[i];
          const entry = cc ? byYC.get(y + "|" + cc) : null;
          frag.appendChild(buildCell(y, cc, entry, true, i + 1));
        }
      } else {
        for (const cc of allCountries) {
          const entry = byYC.get(y + "|" + cc);
          frag.appendChild(buildCell(y, cc, entry, false));
        }
      }
    }

    grid.innerHTML = "";
    grid.appendChild(frag);
  }

  function buildCell(year, cc, entry, placementMode, rankSlot) {
    const c = el("div", "cell");
    c.dataset.year = year;
    if (cc) c.dataset.country = cc;
    if (rankSlot) c.dataset.rank = rankSlot;
    if (!entry) {
      c.classList.add("empty");
      return c;
    }
    const cellMeta = COUNTRIES_META[cc] || { name: cc, flag: "🏳️" };
    c.dataset.title = entry.title.toLowerCase();
    c.dataset.artist = entry.artist.toLowerCase();
    c.dataset.place = entry.place == null ? "" : String(entry.place);
    if (entry.place === 1) c.classList.add("winner");
    const roundLabel = { sf: "SF", sf1: "SF1", sf2: "SF2" };
    const placeStr = entry.place != null
      ? (entry.place === 1 ? `<span class="crown">★</span> 1ST` : `#${entry.place}`)
      : (entry.round && roundLabel[entry.round]
          ? `<span class="cell-sf">${roundLabel[entry.round]}</span>`
          : "—");
    const flagInCard = placementMode ? `<span class="cell-flag">${cellMeta.flag}</span>` : "";
    c.innerHTML = `
      <div class="cell-place">${placeStr}${flagInCard}</div>
      <div class="cell-title">${escapeHtml(entry.title)}</div>
      <div class="cell-artist">${escapeHtml(entry.artist)}</div>
`;
    return c;
  }

  // ---------- Filtering / search ----------
  function updateViewedUI() {
    for (const cell of grid.querySelectorAll(".cell")) {
      const y = +cell.dataset.year;
      const cc = cell.dataset.country;
      const key = y + "|" + cc;
      cell.classList.toggle("viewed", viewedEntries.has(key));
    }
    updateStats();
  }

  function updateStats() {
    const q = state.query.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    let visibleEntries = 0;
    let viewedCount = 0;
    let visibleCountries = new Set();
    let visibleYears = new Set();

    // Cells
    for (const cell of grid.querySelectorAll(".cell")) {
      const y = +cell.dataset.year;
      const cc = cell.dataset.country;
      const isEmpty = cell.classList.contains("empty");
      const isViewed = cell.classList.contains("viewed");

      let pass = !isEmpty;

      // search match
      let matches = false;
      if (tokens.length && pass && cc) {
        const haystack = [
          cell.dataset.title || "",
          cell.dataset.artist || "",
          cc.toLowerCase(),
          (COUNTRIES_META[cc]?.name || "").toLowerCase(),
          String(y),
        ].join(" ");
        matches = tokens.every(t => haystack.includes(t));
        if (!matches) pass = false;
      }

      cell.classList.toggle("dimmed", !pass);
      cell.classList.toggle("match", !!(tokens.length && matches));

      if (pass) {
        visibleEntries++;
        if (isViewed) viewedCount++;
        visibleCountries.add(cc);
        visibleYears.add(y);
      }
    }

    statEntries.textContent = visibleEntries.toLocaleString();
    statCountries.textContent = visibleCountries.size;
    statYears.textContent = visibleYears.size;

    const statViewed = document.getElementById("stat-viewed");
    if (statViewed) {
      statViewed.textContent = viewedCount;
    }

    // Update mobile stats
    const statEntriesMobile = document.getElementById("stat-entries-mobile");
    const statCountriesMobile = document.getElementById("stat-countries-mobile");
    const statYearsMobile = document.getElementById("stat-years-mobile");
    const statViewedMobile = document.getElementById("stat-viewed-mobile");
    if (statEntriesMobile) {
      statEntriesMobile.textContent = visibleEntries.toLocaleString();
      statCountriesMobile.textContent = visibleCountries.size;
      statYearsMobile.textContent = visibleYears.size;
      statViewedMobile.textContent = viewedCount;
    }

    emptyState.style.display = visibleEntries === 0 ? "grid" : "none";
  }

  function applyFilters() {
    updateStats();
  }

  // ---------- Modal ----------
  function loadModalVideo(ids, index, title) {
    const id = ids[index];
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&enablejsapi=1`;
    iframe.title = title;
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";

    const onMessage = (e) => {
      if (e.source !== iframe.contentWindow) return;
      let data = e.data;
      if (typeof data === "string") { try { data = JSON.parse(data); } catch (_) { return; } }
      if (data && data.event === "onError" && [150, 151, 153].includes(data.info)) tryNext();
    };
    window.addEventListener("message", onMessage);

    function tryNext() {
      window.removeEventListener("message", onMessage);
      if (index + 1 < ids.length) {
        loadModalVideo(ids, index + 1, title);
      } else {
        showYouTubeFallback(ids[0]);
      }
    }

    modalVideo.innerHTML = "";
    modalVideo.appendChild(iframe);
    modalVideo._cleanup = () => window.removeEventListener("message", onMessage);
  }

  function showYouTubeFallback(id) {
    const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
    const url = `https://www.youtube.com/watch?v=${id}`;
    modalVideo.innerHTML = `
      <a class="modal-yt-fallback" href="${url}" target="_blank" rel="noopener">
        <img src="${thumb}" alt="" />
        <div class="modal-yt-fallback-overlay">
          <svg viewBox="0 0 68 48" width="68" height="48"><path d="M66.5 7.8A8.5 8.5 0 0 0 60.7 2C55.4.5 34 .5 34 .5S12.6.5 7.3 2A8.5 8.5 0 0 0 1.5 7.8C0 13.1 0 24 0 24s0 10.9 1.5 16.2A8.5 8.5 0 0 0 7.3 46C12.6 47.5 34 47.5 34 47.5s21.4 0 26.7-1.5a8.5 8.5 0 0 0 5.8-5.8C68 34.9 68 24 68 24s0-10.9-1.5-16.2z" fill="red"/><path d="M27 34l18-10-18-10v20z" fill="white"/></svg>
          <span>Watch on YouTube</span>
        </div>
      </a>`;
  }

  function openModal(year, country) {
    const r = byYC.get(year + "|" + country);
    if (!r) return;
    const meta = COUNTRIES_META[country] || { name: country, flag: "🏳️" };

    modalFlag.textContent = meta.flag;
    modalYear.textContent = year;
    modalCountry.textContent = meta.name;
    modalPlace.classList.remove("winner");
    if (r.place === 1) {
      modalPlace.textContent = "★ Winner";
      modalPlace.classList.add("winner");
    } else if (r.place != null) {
      modalPlace.textContent = `Final · #${r.place}`;
    } else {
      modalPlace.textContent = "—";
    }
    modalTitle.textContent = r.title;
    modalArtist.textContent = r.artist;

    const videos = r.videos && r.videos.length ? r.videos : [];
    if (videos.length) {
      loadModalVideo(videos, 0, escapeHtml(r.title) + " — " + escapeHtml(r.artist));
    } else {
      modalVideo.innerHTML = `<div class="modal-novideo">No video available for this entry.</div>`;
    }

    // Update navigation buttons
    const prevYearEntry = byYC.get((year - 1) + "|" + country);
    const nextYearEntry = byYC.get((year + 1) + "|" + country);

    if (prevYearEntry) {
      navPrevYear.disabled = false;
      navPrevYearText.innerHTML = `<span class="nav-entry-title">${escapeHtml(prevYearEntry.title)}</span><span class="nav-entry-meta">${year - 1}</span>`;
    } else {
      navPrevYear.disabled = true;
      navPrevYearText.innerHTML = "";
    }

    if (nextYearEntry) {
      navNextYear.disabled = false;
      navNextYearText.innerHTML = `<span class="nav-entry-title">${escapeHtml(nextYearEntry.title)}</span><span class="nav-entry-meta">${year + 1}</span>`;
    } else {
      navNextYear.disabled = true;
      navNextYearText.innerHTML = "";
    }

    const prevPlaceEntry = r.place != null && r.place > 1
      ? DATA.find(e => e.year === year && e.place === r.place - 1)
      : null;
    const nextPlaceEntry = r.place != null
      ? DATA.find(e => e.year === year && e.place === r.place + 1)
      : null;

    if (prevPlaceEntry) {
      navPrevPlace.disabled = false;
      const placeLabel = prevPlaceEntry.place === 1 ? "★ 1st" : `#${prevPlaceEntry.place}`;
      navPrevPlace.title = prevPlaceEntry.country;
      const prevMeta = COUNTRIES_META[prevPlaceEntry.country] || { name: prevPlaceEntry.country, flag: "🏳️" };
      navPrevPlaceText.innerHTML = `<span class="nav-entry-title">${prevMeta.flag} ${escapeHtml(prevPlaceEntry.title)}</span><span class="nav-entry-meta">${placeLabel}</span>`;
    } else {
      navPrevPlace.disabled = true;
      navPrevPlaceText.innerHTML = "";
    }

    if (nextPlaceEntry) {
      navNextPlace.disabled = false;
      const placeLabel = nextPlaceEntry.place === 1 ? "★ 1st" : `#${nextPlaceEntry.place}`;
      navNextPlace.title = nextPlaceEntry.country;
      const nextMeta = COUNTRIES_META[nextPlaceEntry.country] || { name: nextPlaceEntry.country, flag: "🏳️" };
      navNextPlaceText.innerHTML = `<span class="nav-entry-title">${escapeHtml(nextPlaceEntry.title)} ${nextMeta.flag}</span><span class="nav-entry-meta">${placeLabel}</span>`;
    } else {
      navNextPlace.disabled = true;
      navNextPlaceText.innerHTML = "";
    }

    markAsViewed(year, country);
    modal.classList.add("open");
  }

  function closeModal() {
    modal.classList.remove("open");
    if (modalVideo._cleanup) { modalVideo._cleanup(); modalVideo._cleanup = null; }
    modalVideo.innerHTML = "";
  }


  // ---------- Helpers ----------
  function el(tag, cls) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // ---------- Wire up ----------
  function init() {
    loadViewedEntries();
    buildGrid();
    updateViewedUI();
    applyFilters();

    // search
    let searchTimer = null;
    let activeResultIdx = -1;
    let currentResults = [];

    searchInput.addEventListener("input", () => {
      const v = searchInput.value;
      searchWrap.classList.toggle("has-value", v.length > 0);
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = v;
        applyFilters();
        renderSearchResults();
      }, 80);
    });
    searchInput.addEventListener("focus", () => {
      if (state.query.trim()) renderSearchResults();
    });
    searchInput.addEventListener("keydown", (e) => {
      if (!searchResults.classList.contains("open")) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        activeResultIdx = Math.min(activeResultIdx + 1, currentResults.length - 1);
        updateActiveResult();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        activeResultIdx = Math.max(activeResultIdx - 1, 0);
        updateActiveResult();
      } else if (e.key === "Enter") {
        if (activeResultIdx >= 0 && currentResults[activeResultIdx]) {
          e.preventDefault();
          jumpToCell(currentResults[activeResultIdx]);
        }
      }
    });
    searchClear.addEventListener("click", () => {
      searchInput.value = "";
      searchWrap.classList.remove("has-value");
      state.query = "";
      applyFilters();
      searchResults.classList.remove("open");
      searchInput.focus();
    });
    document.addEventListener("click", (e) => {
      if (!searchWrap.contains(e.target)) {
        searchResults.classList.remove("open");
      }
    });

    function updateActiveResult() {
      const items = searchResults.querySelectorAll(".search-result");
      items.forEach((it, i) => it.classList.toggle("active", i === activeResultIdx));
      const active = items[activeResultIdx];
      if (active) active.scrollIntoView({ block: "nearest" });
    }

    function renderSearchResults() {
      const q = state.query.trim().toLowerCase();
      if (!q) {
        searchResults.classList.remove("open");
        currentResults = [];
        activeResultIdx = -1;
        return;
      }
      const tokens = q.split(/\s+/).filter(Boolean);
      const matches = [];
      for (const r of DATA) {
        if (r.country === "XX") continue;
        const meta = COUNTRIES_META[r.country] || { name: r.country };
        const hay = (r.title + " " + r.artist + " " + r.country + " " + meta.name + " " + r.year).toLowerCase();
        if (tokens.every(t => hay.includes(t))) matches.push(r);
        if (matches.length >= 30) break;
      }
      currentResults = matches;
      activeResultIdx = matches.length ? 0 : -1;

      if (!matches.length) {
        searchResults.innerHTML = `<div class="search-result-empty">No matches for "${escapeHtml(state.query)}"</div>`;
        searchResults.classList.add("open");
        return;
      }
      const head = `<div class="search-results-head">${matches.length} result${matches.length === 1 ? "" : "s"}${matches.length >= 30 ? "+" : ""}</div>`;
      const items = matches.map((r, i) => {
        const meta = COUNTRIES_META[r.country] || { name: r.country, flag: "🏳️" };
        const crown = r.place === 1 ? `<span class="crown">★</span>` : "";
        const hasVideo = r.videos && r.videos.length;
        const ytBtn = hasVideo
          ? `<button class="search-result-yt" data-year="${r.year}" data-country="${r.country}" title="Watch on YouTube" tabindex="-1">
               <svg viewBox="0 0 68 48" width="20" height="14"><path d="M66.5 7.8A8.5 8.5 0 0 0 60.7 2C55.4.5 34 .5 34 .5S12.6.5 7.3 2A8.5 8.5 0 0 0 1.5 7.8C0 13.1 0 24 0 24s0 10.9 1.5 16.2A8.5 8.5 0 0 0 7.3 46C12.6 47.5 34 47.5 34 47.5s21.4 0 26.7-1.5a8.5 8.5 0 0 0 5.8-5.8C68 34.9 68 24 68 24s0-10.9-1.5-16.2z" fill="currentColor"/><path d="M27 34l18-10-18-10v20z" fill="white"/></svg>
             </button>`
          : `<span class="search-result-yt-placeholder"></span>`;
        return `<div class="search-result${i === 0 ? " active" : ""}" data-year="${r.year}" data-country="${r.country}">
          <span class="flag">${meta.flag}</span>
          <div class="body">
            <div class="title">${crown}${highlight(r.title, tokens)}</div>
            <div class="sub">${highlight(r.artist, tokens)} · ${highlight(meta.name, tokens)}${r.place != null ? ` · #${r.place}` : ""}</div>
          </div>
          <span class="yr">${r.year}</span>
          ${ytBtn}
        </div>`;
      }).join("");
      searchResults.innerHTML = head + items;
      searchResults.classList.add("open");

      searchResults.querySelectorAll(".search-result").forEach(el => {
        el.addEventListener("click", (e) => {
          if (e.target.closest(".search-result-yt")) return; // handled separately
          const y = +el.dataset.year;
          const cc = el.dataset.country;
          jumpToCell({ year: y, country: cc });
        });
      });

      searchResults.querySelectorAll(".search-result-yt").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          window.open(`https://www.youtube.com/watch?v=${byYC.get(btn.dataset.year + "|" + btn.dataset.country)?.videos?.[0]}`, "_blank", "noopener");
        });
      });
    }

    function highlight(str, tokens) {
      let out = escapeHtml(str);
      for (const t of tokens) {
        if (!t) continue;
        const re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig");
        out = out.replace(re, "<mark>$1</mark>");
      }
      return out;
    }

    function jumpToCell(r) {
      const cell = grid.querySelector(`.cell[data-year="${r.year}"][data-country="${r.country}"]`);
      if (!cell) return;
      searchResults.classList.remove("open");
      // scroll into view, accounting for sticky headers
      const wrapRect = gridWrap.getBoundingClientRect();
      const cellRect = cell.getBoundingClientRect();
      const headerH = 64; // sticky col-head height approx
      const yearW = 84;
      gridWrap.scrollBy({
        top: cellRect.top - wrapRect.top - headerH - 24,
        left: cellRect.left - wrapRect.left - yearW - 24,
        behavior: "smooth",
      });
      cell.classList.remove("flash");
      void cell.offsetWidth;
      cell.classList.add("flash");
    }

    // sort toggle
    function setSort(mode) {
      state.sort = mode;
      allCountries = allCountries.slice().sort(mode === "alpha" ? sortAlpha : sortByPlacement);
      sortBtnPlace.setAttribute("aria-pressed", mode === "placement" ? "true" : "false");
      sortBtnAlpha.setAttribute("aria-pressed", mode === "alpha" ? "true" : "false");
      buildGrid();
      applyFilters();
    }
    sortBtnPlace.addEventListener("click", () => setSort("placement"));
    sortBtnAlpha.addEventListener("click", () => setSort("alpha"));

    // random video
    randomBtn.addEventListener("click", () => {
      const validEntries = DATA.filter(r => r.country !== "XX" && r.videos && r.videos.length);
      if (validEntries.length === 0) return;
      const r = validEntries[Math.floor(Math.random() * validEntries.length)];
      openModal(r.year, r.country);
    });

    // grid clicks → modal
    grid.addEventListener("click", (e) => {
      const cell = e.target.closest(".cell");
      if (!cell || cell.classList.contains("empty")) return;
      openModal(+cell.dataset.year, cell.dataset.country);
    });

    // modal close
    modalClose.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });

    // modal navigation
    navPrevYear.addEventListener("click", () => {
      const year = +modalYear.textContent;
      const country = Object.keys(COUNTRIES_META).find(cc => COUNTRIES_META[cc].name === modalCountry.textContent);
      if (country) openModal(year - 1, country);
    });
    navNextYear.addEventListener("click", () => {
      const year = +modalYear.textContent;
      const country = Object.keys(COUNTRIES_META).find(cc => COUNTRIES_META[cc].name === modalCountry.textContent);
      if (country) openModal(year + 1, country);
    });
    navPrevPlace.addEventListener("click", () => {
      const year = +modalYear.textContent;
      const currentEntry = DATA.find(r => r.year === year && COUNTRIES_META[r.country]?.name === modalCountry.textContent);
      if (currentEntry && currentEntry.place != null && currentEntry.place > 1) {
        const prevEntry = DATA.find(e => e.year === year && e.place === currentEntry.place - 1);
        if (prevEntry) openModal(year, prevEntry.country);
      }
    });
    navNextPlace.addEventListener("click", () => {
      const year = +modalYear.textContent;
      const currentEntry = DATA.find(r => r.year === year && COUNTRIES_META[r.country]?.name === modalCountry.textContent);
      if (currentEntry && currentEntry.place != null) {
        const nextEntry = DATA.find(e => e.year === year && e.place === currentEntry.place + 1);
        if (nextEntry) openModal(year, nextEntry.country);
      }
    });

    // keyboard
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (modal.classList.contains("open")) { closeModal(); return; }
      }
      if (e.key === "/" && document.activeElement !== searchInput && document.activeElement !== countryFilter) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    // reset filters
    document.getElementById("reset-filters").addEventListener("click", () => {
      state.query = "";
      searchInput.value = "";
      searchWrap.classList.remove("has-value");
      applyFilters();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
