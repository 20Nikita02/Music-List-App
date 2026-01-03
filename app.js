(() => {
  "use strict";
  
  // ========== CONSTANTS ==========
  const LS_KEY = "allSongsDB_v6";
  
  const DEFAULT_GENRES = [
    "Pop","Hip-Hop","R&B","Rock","Hard Rock","Metal Rock","Jazz","Classical","Electronic",
    "Indie","K-Pop","Country","Gospel","French","Instrumental","Other"
  ];
  
  const DEFAULT_LANGS = [
    "English","Spanish","French","Dutch","German","Italian","Korean","Japanese","Arabic","Other"
  ];
  
  const DEFAULT_COUNTRIES = [
    "USA","UK","Canada","France","Netherlands","Germany","Italy","Korea","Japan","Nigeria","Other"
  ];

  // ========== STATE ==========
  let state = loadState();
  let editingId = null;
  let bulkMode = false;
  let selectedSongs = new Set();
  let pendingDuplicateSong = null;
  let deletedSongs = [];
  let undoTimeout = null;

  // ========== ELEMENT REFERENCES ==========
  const $ = (id) => document.getElementById(id);

  // Main containers
  const listEl = $("list");
  const quickSearchEl = $("quickSearch");

  // Counts
  const countSongsEl = $("countSongs");
  const countArtistsEl = $("countArtists");
  const countGenresEl = $("countGenres");
  const countCountriesEl = $("countCountries");

  // Filters
  const filtersToggle = $("filtersToggle");
  const filtersBody = $("filtersBody");
  const favFilterEl = $("favFilter");
  const genreFilterEl = $("genreFilter");
  const langFilterEl = $("langFilter");
  const countryFilterEl = $("countryFilter");
  const applyFiltersBtn = $("applyFilters");
  const resetFiltersBtn = $("resetFilters");

  // Add/Edit form
  const addToggle = $("addToggle");
  const addBody = $("addBody");
  const songTitleEl = $("songTitle");
  const artistNameEl = $("artistName");
  const genreSelectEl = $("genreSelect");
  const langSelectEl = $("langSelect");
  const countrySelectEl = $("countrySelect");
  const favSelectEl = $("favSelect");
  const yearInputEl = $("yearInput");
  const newGenreEl = $("newGenre");
  const newLangEl = $("newLang");
  const newCountryEl = $("newCountry");
  const addGenreBtn = $("addGenreBtn");
  const addLangBtn = $("addLangBtn");
  const addCountryBtn = $("addCountryBtn");
  const saveSongBtn = $("saveSongBtn");
  const clearFormBtn = $("clearFormBtn");
  const exportBtn = $("exportBtn");
  const importFile = $("importFile");
  const artistsList = $("artistsList");

  // Genres
  const genresToggle = $("genresToggle");
  const genresBody = $("genresBody");
  const topBubblesEl = $("topBubbles");
  const restListEl = $("restList");
  const restCountEl = $("restCount");
  const totalGenresCountEl = $("totalGenresCount");
  const expandBtn = $("expandBtn");
  const restGenresSection = $("restGenresSection");

  // Bulk edit
  const bulkToggleBtn = $("bulkToggleBtn");
  const floatingBar = $("floatingBar");
  const selectedCountEl = $("selectedCount");
  const bulkChangeGenreBtn = $("bulkChangeGenre");
  const bulkChangeCountryBtn = $("bulkChangeCountry");
  const bulkChangeLanguageBtn = $("bulkChangeLanguage");
  const bulkDeleteBtn = $("bulkDelete");

  // Modals
  const duplicateModal = $("duplicateModal");
  const duplicateCancelBtn = $("duplicateCancel");
  const duplicateEditBtn = $("duplicateEdit");
  const duplicateAddAnywayBtn = $("duplicateAddAnyway");
  const existingSongInfo = $("existingSongInfo");
  const bulkEditModal = $("bulkEditModal");
  const bulkEditTitle = $("bulkEditTitle");
  const bulkEditField = $("bulkEditField");
  const bulkEditCount = $("bulkEditCount");
  const bulkEditLabel = $("bulkEditLabel");
  const bulkEditSelect = $("bulkEditSelect");
  const bulkEditCancelBtn = $("bulkEditCancel");
  const bulkEditConfirmBtn = $("bulkEditConfirm");

  // ========== INITIALIZATION ==========
  setCollapsed(filtersBody, filtersToggle, true);
  setCollapsed(genresBody, genresToggle, true);

  ensureDefaults();
  rebuildSelects();
  renderEverything();

  // ========== EVENT LISTENERS ==========
  
  // Filters
  filtersToggle.addEventListener("click", () => {
    const willCollapse = !filtersBody.classList.contains("hidden");
    setCollapsed(filtersBody, filtersToggle, willCollapse);
  });

  applyFiltersBtn.addEventListener("click", () => {
    state.ui.q = quickSearchEl.value || "";
    state.ui.favFilter = favFilterEl.value;
    state.ui.genreFilter = genreFilterEl.value;
    state.ui.langFilter = langFilterEl.value;
    state.ui.countryFilter = countryFilterEl.value;
    state.ui.sortMode = $("sortMode").value;  // NIEUW
    saveState();
    renderEverything();
    setCollapsed(filtersBody, filtersToggle, true);
  });

  resetFiltersBtn.addEventListener("click", () => {
    state.ui = defaultUI();
    saveState();
    syncFilterInputs();
    renderEverything();
  });

  // Genres
  genresToggle.addEventListener("click", () => {
    const willCollapse = !genresBody.classList.contains("hidden");
    setCollapsed(genresBody, genresToggle, willCollapse);
    if (!willCollapse) renderGenreViz();
  });

  expandBtn.addEventListener("click", () => {
    if(restListEl.classList.contains('expanded')){
      restListEl.classList.remove('expanded');
      expandBtn.textContent = 'Show all';
    } else {
      restListEl.classList.add('expanded');
      expandBtn.textContent = 'Show less';
    }
  });

  // Add/Edit
  addToggle.addEventListener("click", () => {
    const willCollapse = !addBody.classList.contains("hidden");
    if (willCollapse) {
      addBody.classList.add("hidden");
      addToggle.textContent = "+ Add Song";
    } else {
      addBody.classList.remove("hidden");
      addToggle.textContent = "✕ Close";
      setTimeout(() => songTitleEl.focus(), 50);
    }
  });

  clearFormBtn.addEventListener("click", () => clearForm());

  addGenreBtn.addEventListener("click", () => addOption("genres", newGenreEl.value, genreSelectEl, genreFilterEl));
  addLangBtn.addEventListener("click", () => addOption("langs", newLangEl.value, langSelectEl, langFilterEl));
  addCountryBtn.addEventListener("click", () => addOption("countries", newCountryEl.value, countrySelectEl, countryFilterEl));

  saveSongBtn.addEventListener("click", () => {
    const title = cleanStr(songTitleEl.value);
    const artist = cleanStr(artistNameEl.value);
    if (!title || !artist) {
      alert("Please fill Song title and Artist.");
      return;
    }

    const year = yearInputEl.value ? parseInt(yearInputEl.value) : null;

    const item = {
      id: editingId ?? cryptoId(),
      title,
      artist,
      genre: genreSelectEl.value || "Other",
      language: langSelectEl.value || "English",
      country: countrySelectEl.value || "Other",
      fav: favSelectEl.value || "none",
      year: year,
      updatedAt: Date.now()
    };

    // Duplicate detection - only for NEW songs
    if (!editingId) {
      const duplicate = state.songs.find(s => 
        cleanStr(s.title) === cleanStr(title) && 
        cleanStr(s.artist) === cleanStr(artist)
      );
      
      if (duplicate) {
        pendingDuplicateSong = item;
        showDuplicateModal(duplicate);
        return;
      }
    }

    // Save song
    if (editingId) {
      const idx = state.songs.findIndex(s => s.id === editingId);
      if (idx >= 0) state.songs[idx] = item;
    } else {
      state.songs.push(item);
    }

    editingId = null;
    saveState();
    clearForm();
    renderEverything();
  });

  // Export/Import
  exportBtn.addEventListener("click", () => {
    const payload = {
      version: 6,
      exportedAt: new Date().toISOString(),
      data: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "all-songs-export.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const incoming = obj?.data ?? obj;

      if (!incoming || !Array.isArray(incoming.songs)) throw new Error("Invalid file format.");

      state.songs = incoming.songs.map(s => ({
        id: s.id || cryptoId(),
        title: cleanStr(s.title) || "Untitled",
        artist: cleanStr(s.artist) || "Unknown",
        genre: s.genre || "Other",
        language: s.language || "English",
        country: s.country || "Other",
        fav: s.fav || "none",
        year: s.year || null,
        updatedAt: s.updatedAt || Date.now()
      }));

      state.options = incoming.options || state.options;
      state.ui = incoming.ui || defaultUI();

      ensureDefaults();
      saveState();
      rebuildSelects();
      syncFilterInputs();
      renderEverything();
      alert("Import successful ✅");
    } catch (err) {
      alert("Import failed: " + err.message);
    } finally {
      importFile.value = "";
    }
  });

  // Live search
  quickSearchEl.addEventListener("input", () => {
    state.ui.q = quickSearchEl.value;
    renderEverything();
  });

  // Bulk edit toggle
  bulkToggleBtn.addEventListener("click", () => {
    bulkMode = !bulkMode;
    selectedSongs.clear();
    
    if (bulkMode) {
      bulkToggleBtn.textContent = "☑";
      bulkToggleBtn.classList.add("active");
    } else {
      bulkToggleBtn.textContent = "☐";
      bulkToggleBtn.classList.remove("active");
      floatingBar.classList.add("hidden");
    }
    
    renderEverything();
  });
  
  // Bulk actions
  bulkChangeGenreBtn.addEventListener("click", () => {
    if (selectedSongs.size === 0) return;
    showBulkEditModal("genre", "Genre", state.options.genres);
  });
  
  bulkChangeCountryBtn.addEventListener("click", () => {
    if (selectedSongs.size === 0) return;
    showBulkEditModal("country", "Country", state.options.countries);
  });
  
  bulkChangeLanguageBtn.addEventListener("click", () => {
    if (selectedSongs.size === 0) return;
    showBulkEditModal("language", "Language", state.options.langs);
  });
  
  bulkDeleteBtn.addEventListener("click", () => {
    if (selectedSongs.size === 0) return;
    if (!confirm(`Delete ${selectedSongs.size} selected songs?`)) return;
    
    state.songs = state.songs.filter(s => !selectedSongs.has(s.id));
    selectedSongs.clear();
    saveState();
    renderEverything();
  });
  
  bulkEditCancelBtn.addEventListener("click", () => {
    bulkEditModal.classList.add("hidden");
  });
  
  bulkEditConfirmBtn.addEventListener("click", () => {
    const field = bulkEditConfirmBtn.dataset.field;
    const newValue = bulkEditSelect.value;
    
    for (const song of state.songs) {
      if (selectedSongs.has(song.id)) {
        song[field] = newValue;
      }
    }
    
    saveState();
    bulkEditModal.classList.add("hidden");
    selectedSongs.clear();
    renderEverything();
  });
  
  bulkEditModal.addEventListener("click", (e) => {
    if (e.target === bulkEditModal) {
      bulkEditModal.classList.add("hidden");
    }
  });
  
  // Duplicate modal
  duplicateCancelBtn.addEventListener("click", () => {
    duplicateModal.classList.add("hidden");
    pendingDuplicateSong = null;
  });
  
  duplicateEditBtn.addEventListener("click", () => {
    duplicateModal.classList.add("hidden");
    const existing = state.songs.find(s => 
      cleanStr(s.title) === cleanStr(pendingDuplicateSong.title) && 
      cleanStr(s.artist) === cleanStr(pendingDuplicateSong.artist)
    );
    if (existing) {
      startEdit(existing);
    }
    pendingDuplicateSong = null;
  });
  
  duplicateAddAnywayBtn.addEventListener("click", () => {
    if (pendingDuplicateSong) {
      state.songs.push(pendingDuplicateSong);
      saveState();
      clearForm();
      renderEverything();
    }
    duplicateModal.classList.add("hidden");
    pendingDuplicateSong = null;
  });
  
  duplicateModal.addEventListener("click", (e) => {
    if (e.target === duplicateModal) {
      duplicateModal.classList.add("hidden");
      pendingDuplicateSong = null;
    }
  });

  // ========== RENDERING FUNCTIONS ==========
  
  function renderEverything(){
    syncFilterInputs();

    const filtered = getFilteredSongs();
    const all = getSortedSongs(state.songs);
    const uniqArtists = unique(all.map(s => norm(s.artist))).length;
    const uniqGenres = unique(all.map(s => norm(s.genre))).length;
    const uniqCountries = unique(all.map(s => norm(s.country))).length;

    countSongsEl.textContent = all.length.toString();
    countArtistsEl.textContent = uniqArtists.toString();
    countGenresEl.textContent = uniqGenres.toString();
    countCountriesEl.textContent = uniqCountries.toString();

    renderList(filtered);

    if (!genresBody.classList.contains("hidden")) renderGenreViz();
    if (bulkMode) updateFloatingBar();
  }

  function renderList(songs){
    listEl.innerHTML = "";

    if (!songs.length){
      const div = document.createElement("div");
      div.className = "empty";
      div.textContent = "No songs match your filters.";
      listEl.appendChild(div);
      return;
    }

    const allSorted = getSortedSongs(state.songs);
    const artistOrder = unique(allSorted.map(s => norm(s.artist)));
    const artistIndexMap = new Map();
    artistOrder.forEach((a, i) => artistIndexMap.set(a, i+1));

    const songIndexMap = new Map();
    allSorted.forEach((s, i) => songIndexMap.set(s.id, i+1));

    const grouped = new Map();
    for (const s of songs){
      const key = norm(s.artist);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(s);
    }

    for (const artistKey of artistOrder){
      const arr = grouped.get(artistKey);
      if (!arr || !arr.length) continue;

      const artistName = arr[0].artist;

      const block = document.createElement("div");
      block.className = "artistBlock";

      const head = document.createElement("div");
      head.className = "artistHead";

      const left = document.createElement("div");
      left.className = "artistLeft";
      
      // Artist checkbox for bulk mode
      if (bulkMode) {
        const artistCheckbox = document.createElement("div");
        artistCheckbox.className = "checkbox";
        artistCheckbox.dataset.artist = artistKey;
        artistCheckbox.addEventListener("click", () => {
          artistCheckbox.classList.toggle("checked");
          const isChecked = artistCheckbox.classList.contains("checked");
          arr.forEach(s => {
            if (isChecked) {
              selectedSongs.add(s.id);
            } else {
              selectedSongs.delete(s.id);
            }
          });
          renderEverything();
        });
        left.appendChild(artistCheckbox);
      }

      const aBadge = document.createElement("div");
      aBadge.className = "badge";
      aBadge.textContent = "#A" + artistIndexMap.get(artistKey);

      const metaWrap = document.createElement("div");
      metaWrap.style.minWidth = "0";

      const name = document.createElement("div");
      name.className = "artistName";
      name.textContent = artistName;

      metaWrap.appendChild(name);

      left.appendChild(aBadge);
      left.appendChild(metaWrap);

      const right = document.createElement("div");
      right.className = "artistRight";
      right.textContent = `${arr.length} shown`;

      head.appendChild(left);
      head.appendChild(right);

      block.appendChild(head);

      // Render songs
      for (const s of arr){
        const row = document.createElement("div");
        row.className = "songCard";
        
        // Song checkbox for bulk mode
        if (bulkMode) {
          const songCheckbox = document.createElement("div");
          songCheckbox.className = "checkbox";
          if (selectedSongs.has(s.id)) {
            songCheckbox.classList.add("checked");
          }
          songCheckbox.addEventListener("click", () => {
            if (selectedSongs.has(s.id)) {
              selectedSongs.delete(s.id);
            } else {
              selectedSongs.add(s.id);
            }
            renderEverything();
          });
          row.appendChild(songCheckbox);
        }

        const main = document.createElement("div");
        main.className = "songMain";

        const top = document.createElement("div");
        top.className = "songTop";

        const titleWrap = document.createElement("div");
        titleWrap.style.minWidth = "0";
        titleWrap.style.flex = "1 1 auto";

        const title = document.createElement("div");
        title.className = "songTitle";
        const searchQuery = state.ui.q || quickSearchEl.value || "";
        title.innerHTML = highlightText(s.title, searchQuery);

        const metaWrap = document.createElement("div");
        metaWrap.style.display = "flex";
        metaWrap.style.alignItems = "center";
        metaWrap.style.gap = "8px";
        metaWrap.style.marginTop = "4px";

        const sBadge = document.createElement("div");
        sBadge.className = "songId";
        sBadge.textContent = "#S" + padSong(songIndexMap.get(s.id));
        
        metaWrap.appendChild(sBadge);
        
        // Add year if exists
        if (s.year) {
          const dot = document.createElement("span");
          dot.className = "songId";
          dot.textContent = "•";
          dot.style.opacity = "0.5";
          
          const yearEl = document.createElement("span");
          yearEl.className = "songId";
          yearEl.textContent = s.year;
          
          metaWrap.appendChild(dot);
          metaWrap.appendChild(yearEl);
        }

        titleWrap.appendChild(title);
        titleWrap.appendChild(metaWrap);
        top.appendChild(titleWrap);

        const sub = document.createElement("div");
        sub.className = "songSub";

        const g = mkTag(s.genre);
        const l = mkTag(s.language);
        const c = mkTag(s.country);

        sub.appendChild(g);
        sub.appendChild(l);
        sub.appendChild(c);

        if (s.fav === "fav") sub.appendChild(mkTag("★ Fav", "good"));
        if (s.fav === "xfav") sub.appendChild(mkTag("★★ X-Fav", "warn"));

        const actions = document.createElement("div");
        actions.className = "actions";

        const editBtn = iconBtn("✎", "Edit");
        editBtn.addEventListener("click", () => startEdit(s));

        const delBtn = iconBtn("🗑", "Delete", true);
        delBtn.addEventListener("click", () => 
        {
          // Opslaan voor undo
          deletedSongs.push({song: s, timestamp: Date.now()});

          // Delete
          state.songs = state.songs.filter(x => x.id !== s.id);
          saveState();
          renderEverything();

          // Toon undo toast
          showUndoToast(s.title);
        });

        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        main.appendChild(top);
        main.appendChild(sub);

        row.appendChild(main);
        row.appendChild(actions);

        block.appendChild(row);
      }

      listEl.appendChild(block);
    }

    rebuildArtistDatalist();
  }

  function renderGenreViz(){
    const TOP_COUNT = 6;
    
    const all = getSortedSongs(state.songs);
    const counts = new Map();
    for (const s of all){
      const g = s.genre || "Other";
      counts.set(g, (counts.get(g) || 0) + 1);
    }
    
    const entries = Array.from(counts.entries()).sort((a,b) => b[1] - a[1]);
    const maxCount = Math.max(1, ...entries.map(e => e[1]));
    
    const topGenres = entries.slice(0, TOP_COUNT);
    const restGenres = entries.slice(TOP_COUNT);
    
    totalGenresCountEl.textContent = entries.length;
    
    // Render top bubbles
    topBubblesEl.innerHTML = "";
    topGenres.forEach(([name, count]) => {
      const sizeClass = getGenreSizeClass(count, maxCount);
      const bubble = document.createElement('div');
      bubble.className = `bubble ${sizeClass}`;
      bubble.innerHTML = `
        <div class="bubbleName">${name}</div>
        <div class="bubbleCount">${count} songs</div>
      `;
      
      // Click om te filteren
      bubble.addEventListener('click', () => {
        state.ui.genreFilter = name;
        genreFilterEl.value = name;
        saveState();
        renderEverything();
        
        // Scroll naar song list (smooth op mobiel)
        setTimeout(() => {
          listEl.scrollIntoView({behavior: 'smooth', block: 'start'});
        }, 100);
      });
      
      topBubblesEl.appendChild(bubble);
    });
    
    // Render rest
    if (restGenres.length > 0){
      restGenresSection.style.display = 'block';
      restCountEl.textContent = restGenres.length;
      restListEl.innerHTML = "";
      restGenres.forEach(([name, count]) => {
        const item = document.createElement('div');
        item.className = 'compactGenre';
        item.innerHTML = `
          <div class="compactGenreName">${name}</div>
          <div class="compactGenreCount">${count}</div>
        `;
        
        // NIEUW: Click om te filteren
        item.style.cursor = 'pointer';
        item.addEventListener('click', () => {
          state.ui.genreFilter = name;
          genreFilterEl.value = name;
          saveState();
          renderEverything();
          
          // Scroll naar song list
          setTimeout(() => {
            listEl.scrollIntoView({behavior: 'smooth', block: 'start'});
          }, 100);
        });
        
        restListEl.appendChild(item);
      });
    } else {
      restGenresSection.style.display = 'none';
    }
  }

  // ========== HELPER FUNCTIONS ==========
  
  function setCollapsed(bodyEl, btnEl, collapsed){
    if (collapsed){
      bodyEl.classList.add("hidden");
      btnEl.textContent = "Collapsed ▾";
    } else {
      bodyEl.classList.remove("hidden");
      if (btnEl === filtersToggle) btnEl.textContent = "Open ▴";
      if (btnEl === genresToggle) btnEl.textContent = "Open ▴";
    }
  }

  function mkTag(text, kind){
    const el = document.createElement("div");
    el.className = "tag" + (kind ? (" " + kind) : "");
    el.textContent = text || "—";
    return el;
  }

  function iconBtn(char, title, danger=false){
    const b = document.createElement("button");
    b.className = "iconBtn" + (danger ? " danger" : "");
    b.title = title;
    b.textContent = char;
    return b;
  }

  function startEdit(s){
    editingId = s.id;
    addBody.classList.remove("hidden");
    addToggle.textContent = "✕ Close";
    
    songTitleEl.value = s.title;
    artistNameEl.value = s.artist;

    ensureOption("genres", s.genre);
    ensureOption("langs", s.language);
    ensureOption("countries", s.country);

    rebuildSelects();

    genreSelectEl.value = s.genre || "Other";
    langSelectEl.value = s.language || "English";
    countrySelectEl.value = s.country || "Other";
    favSelectEl.value = s.fav || "none";
    yearInputEl.value = s.year || "";

    setTimeout(() => songTitleEl.focus(), 60);
  }

  function clearForm(){
    editingId = null;
    songTitleEl.value = "";
    artistNameEl.value = "";
    genreSelectEl.value = state.options.genres[0] || "Other";
    langSelectEl.value = "English";
    countrySelectEl.value = state.options.countries[0] || "Other";
    favSelectEl.value = "none";
    yearInputEl.value = "";
    newGenreEl.value = "";
    newLangEl.value = "";
    newCountryEl.value = "";
    
    addToggle.textContent = "+ Add Song";
  }

  function addOption(bucket, raw, selectA, selectB){
    const val = cleanStr(raw);
    if (!val) return;
    ensureOption(bucket, val);
    saveState();
    rebuildSelects();
    selectA.value = val;
    if (selectB) selectB.value = val;
    if (bucket === "genres") newGenreEl.value = "";
    if (bucket === "langs") newLangEl.value = "";
    if (bucket === "countries") newCountryEl.value = "";
    renderEverything();
  }

  function ensureOption(bucket, val){
    const clean = cleanStr(val);
    if (!clean) return;
    const arr = state.options[bucket];
    if (!arr.some(x => norm(x) === norm(clean))){
      arr.push(clean);
      arr.sort((a,b)=> a.localeCompare(b, undefined, {sensitivity:"base"}));
    }
  }

  function ensureDefaults(){
    if (!state.options) state.options = {genres:[], langs:[], countries:[]};

    for (const g of DEFAULT_GENRES) ensureOption("genres", g);
    for (const l of DEFAULT_LANGS) ensureOption("langs", l);
    for (const c of DEFAULT_COUNTRIES) ensureOption("countries", c);

    ensureOption("langs", "English");
  }

  function rebuildSelects(){
    rebuildSelect(genreFilterEl, ["any"].concat(state.options.genres), state.ui.genreFilter || "any", (v)=> v==="any" ? "Any" : v);
    rebuildSelect(langFilterEl, ["any"].concat(state.options.langs), state.ui.langFilter || "any", (v)=> v==="any" ? "Any" : v);
    rebuildSelect(countryFilterEl, ["any"].concat(state.options.countries), state.ui.countryFilter || "any", (v)=> v==="any" ? "Any" : v);

    rebuildSelect(genreSelectEl, state.options.genres, genreSelectEl.value || state.options.genres[0]);
    rebuildSelect(langSelectEl, state.options.langs, langSelectEl.value || "English");
    rebuildSelect(countrySelectEl, state.options.countries, countrySelectEl.value || state.options.countries[0]);

    rebuildArtistDatalist();
    syncFilterInputs();
  }

  function rebuildSelect(selectEl, values, selected, labelFn){
    const old = selectEl.value;
    selectEl.innerHTML = "";
    for (const v of values){
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = labelFn ? labelFn(v) : v;
      selectEl.appendChild(opt);
    }
    const candidate = selected ?? old;
    if (candidate && Array.from(selectEl.options).some(o => o.value === candidate)){
      selectEl.value = candidate;
    } else {
      selectEl.selectedIndex = 0;
    }
  }

  function rebuildArtistDatalist(){
    const all = getSortedSongs(state.songs);
    const artists = unique(all.map(s => s.artist)).sort((a,b)=> a.localeCompare(b, undefined, {sensitivity:"base"}));
    artistsList.innerHTML = "";
    for (const a of artists){
      const opt = document.createElement("option");
      opt.value = a;
      artistsList.appendChild(opt);
    }
  }

  function syncFilterInputs(){
    quickSearchEl.value = state.ui.q || "";
    favFilterEl.value = state.ui.favFilter || "any";
    genreFilterEl.value = state.ui.genreFilter || "any";
    langFilterEl.value = state.ui.langFilter || "any";
    countryFilterEl.value = state.ui.countryFilter || "any";
    $("sortMode").value = state.ui.sortMode || "artist_song";  // NIEUW
  }

  function getFilteredSongs(){
    const base = getSortedSongs(state.songs);
    const q = (quickSearchEl.value || state.ui.q || "").trim().toLowerCase();
    const fav = state.ui.favFilter || favFilterEl.value || "any";
    const g = state.ui.genreFilter || genreFilterEl.value || "any";
    const l = state.ui.langFilter || langFilterEl.value || "any";
    const c = state.ui.countryFilter || countryFilterEl.value || "any";

    return base.filter(s => {
      if (q){
        const hay = (s.title + " " + s.artist).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (fav !== "any"){
        if (fav === "none" && s.fav !== "none") return false;
        if (fav === "fav" && s.fav !== "fav") return false;
        if (fav === "xfav" && s.fav !== "xfav") return false;
      }
      if (g !== "any" && norm(s.genre) !== norm(g)) return false;
      if (l !== "any" && norm(s.language) !== norm(l)) return false;
      if (c !== "any" && norm(s.country) !== norm(c)) return false;
      return true;
    });
  }

  function getSortedSongs(arr){
    const sortMode = state.ui.sortMode || "artist_song";
    
    return [...arr].sort((a,b) => {
      // Newest First
      if (sortMode === "newest") {
        return (b.updatedAt||0) - (a.updatedAt||0);
      }
      
      // Oldest First
      if (sortMode === "oldest") {
        return (a.updatedAt||0) - (b.updatedAt||0);
      }
      
      // Favorites First
      if (sortMode === "most_fav") {
        const favOrder = {xfav: 0, fav: 1, none: 2};
        const favA = favOrder[a.fav] ?? 2;
        const favB = favOrder[b.fav] ?? 2;
        if (favA !== favB) return favA - favB;
        // Dan artist -> song
        const aa = norm(a.artist), ab = norm(b.artist);
        if (aa !== ab) return aa.localeCompare(ab, undefined, {sensitivity:"base"});
        const ta = norm(a.title), tb = norm(b.title);
        return ta.localeCompare(tb, undefined, {sensitivity:"base"});
      }
      
      // Song Title A-Z
      if (sortMode === "song_title") {
        const ta = norm(a.title), tb = norm(b.title);
        if (ta !== tb) return ta.localeCompare(tb, undefined, {sensitivity:"base"});
        const aa = norm(a.artist), ab = norm(b.artist);
        return aa.localeCompare(ab, undefined, {sensitivity:"base"});
      }
      
      // Artist A-Z → Song A-Z (default)
      const aa = norm(a.artist), ab = norm(b.artist);
      if (aa !== ab) return aa.localeCompare(ab, undefined, {sensitivity:"base"});
      const ta = norm(a.title), tb = norm(b.title);
      if (ta !== tb) return ta.localeCompare(tb, undefined, {sensitivity:"base"});
      return (a.updatedAt||0) - (b.updatedAt||0);
    });
  }

  function highlightText(text, query) {
    if (!query || query.trim() === "") return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  function padSong(n){
    return String(n || 0);
  }

  function unique(arr){
    const seen = new Set();
    const out = [];
    for (const v of arr){
      const k = norm(v);
      if (!seen.has(k)){
        seen.add(k);
        out.push(v);
      }
    }
    return out;
  }

  function cleanStr(s){
    return (s ?? "").toString().trim().replace(/\s+/g, " ");
  }
  
  function norm(s){
    return cleanStr(s).toLowerCase();
  }

  function defaultUI(){
    return {
      q: "",
      favFilter: "any",
      genreFilter: "any",
      langFilter: "any",
      countryFilter: "any",
      sortMode: "artist_song"
    };
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return {songs:[], options:{genres:[], langs:[], countries:[]}, ui: defaultUI()};
      const parsed = JSON.parse(raw);
      return {
        songs: Array.isArray(parsed.songs) ? parsed.songs : [],
        options: parsed.options || {genres:[], langs:[], countries:[]},
        ui: parsed.ui || defaultUI()
      };
    } catch {
      return {songs:[], options:{genres:[], langs:[], countries:[]}, ui: defaultUI()};
    }
  }

  function saveState(){
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  }

  function cryptoId(){
    return "s_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }
  
  function getGenreSizeClass(count, max){
    const percentage = count / max;
    if (percentage >= 0.70) return 'size-xl';
    if (percentage >= 0.50) return 'size-lg';
    if (percentage >= 0.30) return 'size-md';
    return 'size-sm';
  }
  
  function updateFloatingBar() {
    selectedCountEl.textContent = selectedSongs.size;
    if (selectedSongs.size > 0) {
      floatingBar.classList.remove("hidden");
    } else {
      floatingBar.classList.add("hidden");
    }
  }
  
  function showBulkEditModal(field, fieldLabel, options) {
    bulkEditTitle.textContent = `✏️ Bulk Edit ${fieldLabel}`;
    bulkEditField.textContent = fieldLabel.toLowerCase();
    bulkEditCount.textContent = selectedSongs.size;
    bulkEditLabel.textContent = `New ${fieldLabel}`;
    
    bulkEditSelect.innerHTML = "";
    for (const opt of options) {
      const option = document.createElement("option");
      option.value = opt;
      option.textContent = opt;
      bulkEditSelect.appendChild(option);
    }
    
    bulkEditModal.classList.remove("hidden");
    bulkEditConfirmBtn.dataset.field = field;
  }
  
  function showDuplicateModal(existingSong) {
    const meta = [
      existingSong.genre,
      existingSong.language,
      existingSong.country
    ];
    if (existingSong.year) meta.push(existingSong.year);
    
    existingSongInfo.innerHTML = `
      <div class="existingSongTitle">${existingSong.title} • ${existingSong.artist}</div>
      <div class="existingSongMeta">${meta.join(" • ")}</div>
    `;
    
    duplicateModal.classList.remove("hidden");
  }

    // Undo Toast functies
function showUndoToast(songTitle) {
  // Verwijder oude toast
  const oldToast = document.querySelector('.undoToast');
  if (oldToast) oldToast.remove();
  
  // Clear oude timeout
  if (undoTimeout) clearTimeout(undoTimeout);
  
  // Maak nieuwe toast
  const toast = document.createElement('div');
  toast.className = 'undoToast';
  toast.innerHTML = `
    <div class="message">Deleted "${songTitle}"</div>
    <button class="undoBtn">Undo</button>
  `;
  
  document.body.appendChild(toast);
  
  // Undo button
  toast.querySelector('.undoBtn').addEventListener('click', () => {
    undoDelete();
    toast.remove();
  });
  
  // Auto-hide na 5 seconden
  undoTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

function undoDelete() {
  if (deletedSongs.length === 0) return;
  
  const {song} = deletedSongs.pop();
  state.songs.push(song);
  saveState();
  renderEverything();
  
  if (undoTimeout) clearTimeout(undoTimeout);
}
})();
