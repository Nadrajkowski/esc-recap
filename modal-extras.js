// modal-extras.js — adds voting visualization + lyrics side panel to the modal.
// Reads voting and lyrics from ESC_DATA entries.
(function () {
  const COUNTRIES = window.ESC_COUNTRIES || window.COUNTRIES_META || {};
  const DATA = window.ESC_DATA || [];
  const EXTRAS = window.ESC_EXTRAS || {};

  // Helper to find entry in ESC_DATA by year and country
  function findEntryData(year, countryCode) {
    return DATA.find(e => e.year === year && e.country === countryCode);
  }

  // Build extras object from entry data (scores + lyrics + computed given)
  function buildExtrasFromEntry(entry, year, cc) {
    if (!entry) return null;
    const extras = {};

    // Scores: use directly from entry (already has total, public, jury breakdown)
    if (entry.scores && Array.isArray(entry.scores)) {
      extras.scores = entry.scores;
    }

    // Compute "given": what votes this country gave to others in this year
    if (entry.scores && year && cc) {
      const given = computeGivenVotes(year, cc);
      if (given) {
        extras.given = given;
      }
    }

    // Lyrics: use directly from entry if available
    if (entry.lyrics && entry.lyrics.original) {
      extras.lyrics = entry.lyrics;
    }

    return Object.keys(extras).length > 0 ? extras : null;
  }

  // Compute "given" votes: extract what votes country CC gave in year YEAR
  function computeGivenVotes(year, cc) {
    // For each entry in this year, extract the votes that came from CC
    const givenTotal = {};
    const givenPublic = {};
    const givenJury = {};

    for (const entry of DATA) {
      if (entry.year !== year) continue;
      if (!entry.scores) continue;

      // For each score type (total, public, jury), extract votes from our country
      for (const scoreType of entry.scores) {
        if (!scoreType.votes || !scoreType.votes[cc]) continue;
        const votes = scoreType.votes[cc];

        if (scoreType.name === "total") {
          givenTotal[entry.country] = votes;
        } else if (scoreType.name === "public") {
          givenPublic[entry.country] = votes;
        } else if (scoreType.name === "jury") {
          givenJury[entry.country] = votes;
        }
      }
    }

    // Return in same format as scores array
    return [
      { name: "total", votes: givenTotal },
      { name: "public", votes: givenPublic },
      { name: "jury", votes: givenJury }
    ];
  }

  // ---------- inject styles ----------
  const css = `
  .modal { overflow-y: auto; }

  .vote-section {
    background: var(--surface);
    border-top: 1px solid var(--line);
  }
  .vote-section[hidden] { display: none; }
  .vote-head {
    width: 100%;
    display: flex; align-items: center; gap: 10px;
    padding: 14px 20px;
    border: 0; background: transparent;
    font: inherit; cursor: pointer; text-align: left;
    color: var(--ink);
  }
  .vote-head:hover { background: var(--bg-grid); }
  .vote-head .vote-head-label {
    font-family: var(--font-mono); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--ink-3); font-weight: 600;
  }
  .vote-head .vote-head-summary {
    font-family: var(--font-mono); font-size: 12px;
    color: var(--ink-2); margin-left: auto;
    display: flex; align-items: baseline; gap: 12px;
  }
  .vote-head .vote-head-summary b { color: var(--ink); font-weight: 700; }
  .vote-head .vote-head-summary .jury b { color: var(--eu-blue); }
  .vote-head .vote-head-summary .public b { color: #d63a4f; }
  .vote-head .chev {
    width: 16px; height: 16px; color: var(--ink-3);
    transition: transform .2s;
  }
  .vote-section.collapsed .chev { transform: rotate(-90deg); }
  .vote-section.collapsed .vote-body-wrap { display: none; }
  .vote-body-wrap { padding: 4px 20px 20px; }
  .vote-controls {
    display: flex; gap: 10px; align-items: center;
    flex-wrap: wrap; margin-bottom: 14px;
    padding-bottom: 12px; border-bottom: 1px solid var(--line);
  }
  .vote-seg {
    display: inline-flex; border: 1px solid var(--line);
    border-radius: 8px; overflow: hidden;
    background: var(--surface);
  }
  .vote-seg button {
    border: 0; background: transparent;
    padding: 6px 11px; font: inherit; font-size: 11px;
    color: var(--ink-3); cursor: pointer;
    font-family: var(--font-mono);
    text-transform: uppercase; letter-spacing: 0.06em;
    transition: all .12s;
  }
  .vote-seg button + button { border-left: 1px solid var(--line); }
  .vote-seg button:hover:not([aria-pressed="true"]) { color: var(--ink); background: var(--bg-grid); }
  .vote-seg button[aria-pressed="true"] { background: var(--eu-blue); color: white; }
  .vote-seg button:disabled { opacity: 0.35; cursor: not-allowed; }
  .vote-seg-label {
    font-family: var(--font-mono); font-size: 10px;
    color: var(--ink-3); text-transform: uppercase;
    letter-spacing: 0.08em; margin-right: 2px;
  }

  /* Bars view */
  .vote-bars { display: flex; flex-direction: column; gap: 4px; }
  .vote-bar-row {
    display: grid; grid-template-columns: 24px 1fr 36px;
    gap: 10px; align-items: center;
    padding: 4px 0;
  }
  .vote-bar-flag { font-size: 18px; line-height: 1; text-align: center; }
  .vote-bar-name {
    font-size: 11px; color: var(--ink-2);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .vote-bar-points {
    font-family: var(--font-mono); font-size: 12px;
    font-weight: 700; color: var(--ink); text-align: right;
  }
  .vote-bar-track {
    grid-column: 2 / 3; grid-row: 2;
    height: 6px; background: var(--bg-grid); border-radius: 3px;
    overflow: hidden; display: flex;
  }
  .vote-bar-row.with-track { grid-template-columns: 24px 1fr 36px; }
  .vote-bar-segs { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: var(--bg-grid); width: 100%; }
  .vote-bar-seg-jury { background: var(--eu-blue); height: 100%; }
  .vote-bar-seg-public { background: #d63a4f; height: 100%; }
  .vote-bar-seg-flat { background: var(--eu-blue); height: 100%; }
  .vote-bar-row .vote-bar-content { display: flex; flex-direction: column; gap: 4px; min-width: 0; }

  .vote-empty {
    padding: 24px; text-align: center;
    color: var(--ink-3); font-size: 12px;
    font-family: var(--font-mono);
    border: 1px dashed var(--line); border-radius: 10px;
  }

  .vote-legend {
    margin-top: 14px; display: flex; align-items: center; gap: 14px;
    justify-content: flex-start;
    font-family: var(--font-mono); font-size: 10px;
    color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em;
  }
  .vote-legend .swatch {
    display: inline-block; width: 10px; height: 10px;
    border-radius: 2px; margin-right: 6px; vertical-align: -1px;
  }

  /* Lyrics side panel */
  .lyrics-panel {
    position: fixed;
    top: 0; right: 0; bottom: 0;
    width: min(420px, 100vw);
    background: var(--surface);
    box-shadow: -12px 0 40px rgba(0,0,0,0.25);
    z-index: 200;
    display: flex; flex-direction: column;
    transform: translateX(100%);
    transition: transform .25s cubic-bezier(.2,.8,.2,1);
    pointer-events: none;
    overflow: visible;
  }
  .lyrics-panel.open { transform: none; pointer-events: auto; }
  .lyrics-header {
    padding: 14px 16px; border-bottom: 1px solid var(--line);
    display: flex; align-items: center; gap: 10px;
    background: linear-gradient(180deg, #fafaf6 0%, var(--surface) 100%);
    position: relative;
    z-index: 1;
  }
  .lyrics-title {
    font-family: var(--font-mono); font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--ink-3); flex: 0 0 auto;
  }
  .lyrics-lang-select {
    flex: 1; min-width: 0;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 8px;
    padding: 6px 10px 6px 10px;
    padding-right: 28px;
    font: inherit; font-size: 12px; font-weight: 600;
    color: var(--ink); cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234a4f66' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='M6 9l6 6 6-6'%3e%3c/path%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 6px center;
    background-size: 18px;
  }
  .lyrics-close {
    flex: 0 0 auto;
    border: 0; background: transparent;
    width: 32px; height: 32px; border-radius: 8px;
    color: var(--ink-3); cursor: pointer;
    display: grid; place-items: center;
    transition: all .15s;
  }
  .lyrics-close:hover { background: var(--bg-grid); color: var(--ink); }
  .lyrics-body {
    flex: 1; overflow-y: auto;
    padding: 18px 20px 32px;
    font-size: 14px; line-height: 1.65;
    color: var(--ink);
    white-space: pre-wrap;
    font-family: 'Georgia', 'Times New Roman', serif;
  }
  .lyrics-body .stanza { margin-bottom: 1em; }

  /* Lyrics open button next to nav */
  .lyrics-open-btn {
    margin: 0 20px 14px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 10px;
    font: inherit; font-size: 12px;
    color: var(--ink); cursor: pointer;
    display: flex; align-items: center; gap: 10px;
    transition: all .15s;
    font-weight: 600;
  }
  .lyrics-open-btn:hover {
    border-color: var(--eu-blue);
    color: var(--eu-blue);
    box-shadow: 0 2px 10px rgba(0,51,153,0.08);
  }
  .lyrics-open-btn[hidden] { display: none; }
  .lyrics-open-btn .icon {
    width: 22px; height: 22px;
    display: grid; place-items: center;
    color: var(--eu-blue);
  }
  .lyrics-open-btn .arrow { margin-left: auto; color: var(--ink-3); }

  @media (max-width: 640px) {
    .lyrics-panel {
      width: 100vw; height: 100vh;
      top: 0; right: 0;
      transform: translateY(100%);
      overflow-y: auto;
    }
    .lyrics-panel.open { transform: none; }
    .lyrics-lang-select {
      padding: 8px 10px;
      font-size: 14px;
    }
    .vote-head { padding: 12px 14px; }
    .vote-body-wrap { padding: 4px 14px 16px; }
    .vote-controls { gap: 6px; }
    .vote-seg button { padding: 5px 8px; font-size: 10px; }
    .vote-head .vote-head-summary { font-size: 11px; gap: 8px; }
    .lyrics-open-btn { margin: 0 12px 10px; }
  }
  `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ---------- inject DOM ----------
  const modal = document.getElementById("modal");
  if (!modal) return;
  const modalContent = modal.querySelector(".modal");
  const modalNav = document.getElementById("modal-nav");

  // Voting section (collapsible)
  const voteSection = document.createElement("section");
  voteSection.className = "vote-section";
  voteSection.id = "vote-section";
  voteSection.innerHTML = `
    <button class="vote-head" type="button" aria-expanded="true">
      <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      <span class="vote-head-label">Voting</span>
      <span class="vote-head-summary">
        <span><b id="vote-total-num">—</b> total</span>
        <span class="jury">Jury <b id="vote-jury-num">—</b></span>
        <span class="public">Public <b id="vote-public-num">—</b></span>
      </span>
    </button>
    <div class="vote-body-wrap">
      <div class="vote-controls">
        <span class="vote-seg-label">View</span>
        <div class="vote-seg" role="group" aria-label="Direction">
          <button data-dir="received" aria-pressed="true">Received</button>
          <button data-dir="given" aria-pressed="false">Given</button>
        </div>
        <span class="vote-seg-label" style="margin-left:6px">Source</span>
        <div class="vote-seg" role="group" aria-label="Source">
          <button data-src="total" aria-pressed="true">Total</button>
          <button data-src="jury" aria-pressed="false">Jury</button>
          <button data-src="public" aria-pressed="false">Public</button>
        </div>
      </div>
      <div class="vote-body" id="vote-body"></div>
    </div>
  `;

  // Lyrics open button
  const lyricsBtn = document.createElement("button");
  lyricsBtn.className = "lyrics-open-btn";
  lyricsBtn.id = "lyrics-open-btn";
  lyricsBtn.hidden = true;
  lyricsBtn.innerHTML = `
    <span class="icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></span>
    <span>Read lyrics</span>
    <span class="arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
  `;

  // Insert: voting section, then lyrics button, then nav (existing)
  modalContent.insertBefore(voteSection, modalNav);
  modalContent.insertBefore(lyricsBtn, modalNav);

  // Lyrics panel (separate fixed element appended to body)
  const lyricsPanel = document.createElement("aside");
  lyricsPanel.className = "lyrics-panel";
  lyricsPanel.id = "lyrics-panel";
  lyricsPanel.innerHTML = `
    <div class="lyrics-header">
      <span class="lyrics-title">Lyrics</span>
      <select class="lyrics-lang-select" id="lyrics-lang-select"></select>
      <button class="lyrics-close" id="lyrics-close" aria-label="Close lyrics">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="lyrics-body" id="lyrics-body"></div>
  `;
  document.body.appendChild(lyricsPanel);

  // ---------- state ----------
  let currentExtras = null;
  let currentEntry = null;
  let voteState = { dir: "received", src: "total" };

  // ---------- helpers ----------
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]));
  }
  function getScores(extras, dir, src) {
    if (!extras) return null;
    const arr = dir === "given" ? extras.given : extras.scores;
    if (!arr) return null;
    return arr.find(s => s.name === src) || null;
  }
  function pointsColor(pts, max) {
    if (!pts) return "var(--bg-grid)";
    const t = Math.min(1, pts / Math.max(max, 1));
    // interpolate from light blue tint to deep eu blue
    const a = 0.15 + t * 0.85;
    return `rgba(0, 51, 153, ${a.toFixed(2)})`;
  }

  function renderBars(scoresObj) {
    if (!scoresObj || !scoresObj.votes) {
      return `<div class="vote-empty">No data for this view.</div>`;
    }
    const entries = Object.entries(scoresObj.votes)
      .filter(([, p]) => p > 0)
      .sort((a, b) => b[1] - a[1]);
    if (!entries.length) return `<div class="vote-empty">No points.</div>`;
    const max = entries[0][1];
    const showStack = voteState.src === "total" && currentExtras &&
      ((voteState.dir === "received" && currentExtras.scores) || (voteState.dir === "given" && currentExtras.given));
    const publicOnly = voteState.src === "public";
    const juryArr = currentExtras && (voteState.dir === "received" ? currentExtras.scores : currentExtras.given);
    const juryV = juryArr ? (juryArr.find(s => s.name === "jury") || {}).votes || {} : {};
    const pubV = juryArr ? (juryArr.find(s => s.name === "public") || {}).votes || {} : {};
    return `<div class="vote-bars">${entries.map(([cc, pts]) => {
      const meta = COUNTRIES[cc] || { flag: "🏳️", name: cc };
      const total = pts;
      const j = juryV[cc] || 0;
      const p = pubV[cc] || 0;
      const denom = (j + p) || total || 1;
      const jPct = showStack ? (j / denom) * (total / max) * 100 : 0;
      const pPct = showStack ? (p / denom) * (total / max) * 100 : 0;
      const flatPct = (total / max) * 100;
      return `
        <div class="vote-bar-row">
          <span class="vote-bar-flag">${meta.flag}</span>
          <div class="vote-bar-content">
            <span class="vote-bar-name">${escapeHtml(meta.name)}</span>
            <div class="vote-bar-segs">
              ${showStack
                ? `<div class="vote-bar-seg-jury" style="width:${jPct}%"></div><div class="vote-bar-seg-public" style="width:${pPct}%"></div>`
                : publicOnly ? `<div class="vote-bar-seg-public" style="width:${flatPct}%"></div>` : `<div class="vote-bar-seg-flat" style="width:${flatPct}%"></div>`}
            </div>
          </div>
          <span class="vote-bar-points">${pts}</span>
        </div>
      `;
    }).join("")}</div>${showStack ? `
      <div class="vote-legend">
        <span><span class="swatch" style="background:var(--eu-blue)"></span>Jury</span>
        <span><span class="swatch" style="background:#d63a4f"></span>Public</span>
      </div>` : ""}`;
  }


  function renderVotes() {
    const body = document.getElementById("vote-body");
    if (!body) return;
    const arr = voteState.dir === "given" ? currentExtras?.given : currentExtras?.scores;
    if (!arr) {
      body.innerHTML = `<div class="vote-empty">${voteState.dir === "given" ? "Cross-entry data not wired yet for this entry." : "No voting data."}</div>`;
      return;
    }
    const scoresObj = arr.find(s => s.name === voteState.src);
    body.innerHTML = renderBars(scoresObj);
  }

  function updateSummary() {
    const total = (currentExtras?.scores || []).find(s => s.name === "total");
    const jury  = (currentExtras?.scores || []).find(s => s.name === "jury");
    const pub   = (currentExtras?.scores || []).find(s => s.name === "public");
    document.getElementById("vote-total-num").textContent = total ? total.points : "—";
    document.getElementById("vote-jury-num").textContent = jury ? jury.points : "—";
    document.getElementById("vote-public-num").textContent = pub ? pub.points : "—";
  }

  // ---------- voting controls ----------
  voteSection.addEventListener("click", (e) => {
    // collapse toggle
    const head = e.target.closest(".vote-head");
    if (head) {
      const collapsed = voteSection.classList.toggle("collapsed");
      head.setAttribute("aria-expanded", String(!collapsed));
      return;
    }
    const btn = e.target.closest(".vote-seg button");
    if (!btn || btn.disabled) return;
    const group = btn.parentElement;
    [...group.querySelectorAll("button")].forEach(b => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
    if (btn.dataset.dir) voteState.dir = btn.dataset.dir;
    if (btn.dataset.src) voteState.src = btn.dataset.src;
    renderVotes();
  });

  // ---------- lyrics panel ----------
  const langSelect = document.getElementById("lyrics-lang-select");
  const lyricsBody = document.getElementById("lyrics-body");
  const lyricsClose = document.getElementById("lyrics-close");
  function buildLangs() {
    const ly = currentExtras?.lyrics;
    langSelect.innerHTML = "";
    if (!ly) return;
    const opts = [{ ...ly.original, original: true }].concat(ly.translations || []);
    opts.forEach((o, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = o.label || o.lang || "—";
      langSelect.appendChild(opt);
    });
    showLang(0);
  }
  function showLang(i) {
    const ly = currentExtras?.lyrics;
    if (!ly) return;
    const opts = [ly.original].concat(ly.translations || []);
    const o = opts[i] || opts[0];
    if (!o) return;
    // split into stanzas
    const stanzas = o.text.split(/\n\s*\n/);
    lyricsBody.innerHTML = stanzas.map(s => `<div class="stanza">${escapeHtml(s)}</div>`).join("");
  }
  langSelect.addEventListener("change", (e) => showLang(+e.target.value));
  lyricsClose.addEventListener("click", () => lyricsPanel.classList.remove("open"));
  lyricsBtn.addEventListener("click", () => lyricsPanel.classList.add("open"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && lyricsPanel.classList.contains("open")) {
      e.stopPropagation();
      lyricsPanel.classList.remove("open");
    }
  }, true);

  // ---------- hook into modal open ----------
  // Watch the modal flag textContent to know when content updates.
  // Simpler approach: observe modal id changes via MutationObserver on modal-year.
  const modalYear = document.getElementById("modal-year");
  const modalCountry = document.getElementById("modal-country");
  function onModalUpdate() {
    const year = parseInt(modalYear.textContent, 10);
    if (!year) return;
    // resolve country code from country name displayed
    const ccName = modalCountry.textContent;
    const cc = Object.keys(COUNTRIES).find(k => COUNTRIES[k].name === ccName) || ccName;

    // First try ESC_DATA (our generated dataset)
    const entryData = findEntryData(year, cc);
    if (entryData) {
      currentExtras = buildExtrasFromEntry(entryData, year, cc);
    } else {
      // Fall back to ESC_EXTRAS mock data if available
      const key = `${year}-${cc}`;
      currentExtras = EXTRAS[key] || null;
    }

    currentEntry = { year, cc };
    // Show/hide voting section based on year + scores availability
    const hasVotes = currentExtras && currentExtras.scores && currentExtras.scores[0]?.votes;
    voteSection.hidden = !hasVotes;
    // Lyrics
    const hasLyrics = currentExtras && currentExtras.lyrics;
    lyricsBtn.hidden = !hasLyrics;
    if (hasLyrics) buildLangs();
    lyricsPanel.classList.remove("open");
    if (hasVotes) {
      // Disable/hide Given button if no given data
      const givenBtn = voteSection.querySelector('[data-dir="given"]');
      if (givenBtn) {
        if (currentExtras.given) {
          givenBtn.disabled = false;
        } else {
          givenBtn.disabled = true;
          // If currently on "given" view, switch back to "received"
          if (voteState.dir === "given") {
            voteState.dir = "received";
            voteSection.querySelector('[data-dir="received"]').setAttribute("aria-pressed", "true");
            givenBtn.setAttribute("aria-pressed", "false");
          }
        }
      }
      updateSummary();
      renderVotes();
    }
  }
  const obs = new MutationObserver(onModalUpdate);
  obs.observe(modalYear, { childList: true, characterData: true, subtree: true });
  obs.observe(modalCountry, { childList: true, characterData: true, subtree: true });

  // close lyrics when modal closes
  const closeBtn = document.getElementById("modal-close");
  if (closeBtn) closeBtn.addEventListener("click", () => lyricsPanel.classList.remove("open"));
})();
