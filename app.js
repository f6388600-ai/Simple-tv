(() => {
  "use strict";

  const state = {
    channels: [],
    filtered: [],
    category: "All",
    search: "",
    sort: "default",
    current: null,
    hls: null,
    theme: localStorage.getItem("iptv_theme") || "dark"
  };

  const $ = (s) => document.querySelector(s);
  const channelGrid = $("#channelGrid");
  const categoryRow = $("#categoryRow");
  const emptyState = $("#emptyState");
  const resultCount = $("#resultCount");
  const searchInput = $("#searchInput");
  const searchWrap = $(".search-wrap");
  const playerModal = $("#playerModal");
  const video = $("#videoPlayer");
  const iframe = $("#embedPlayer");
  const loading = $("#loadingOverlay");
  const errorOverlay = $("#errorOverlay");
  const errorText = $("#errorText");
  const toast = $("#toast");

  document.documentElement.classList.toggle("light", state.theme === "light");
  $("#themeBtn").textContent = state.theme === "light" ? "☀" : "☾";

  function safeChannels() {
    const defaults = Array.isArray(window.DEFAULT_CHANNELS) ? window.DEFAULT_CHANNELS : [];
    const local = JSON.parse(localStorage.getItem("simple_iptv_channels") || "[]");
    return [...defaults, ...local].filter(c => c && c.name && c.url).map((c, i) => ({
      id: c.id || `${slug(c.name)}-${i}`,
      name: String(c.name),
      category: String(c.category || "Other"),
      logo: String(c.logo || ""),
      url: String(c.url),
      type: String(c.type || "auto").toLowerCase()
    }));
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  function initials(name) {
    const p = name.trim().split(/\s+/).slice(0, 2);
    return p.map(x => x[0]).join("").toUpperCase() || "TV";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function detectType(channel) {
    if (channel.type !== "auto") return channel.type;
    const u = channel.url.toLowerCase().split("?")[0];
    if (u.includes("youtube.com") || u.includes("youtu.be") || u.includes("vimeo.com") || u.includes("dailymotion.com")) return "embed";
    if (u.endsWith(".m3u8") || u.includes(".m3u8/")) return "hls";
    if (u.endsWith(".mpd") || u.includes(".mpd/")) return "dash";
    if (/\.(mp4|webm|ogg|ogv|m4v|mov)(\?|$)/i.test(channel.url)) return "video";
    if (/^https?:\/\/.+/i.test(channel.url)) return "video";
    return "embed";
  }

  function categories() {
    return ["All", ...new Set(state.channels.map(c => c.category).filter(Boolean))];
  }

  function renderCategories() {
    categoryRow.innerHTML = categories().map(c =>
      `<button class="category-btn ${c === state.category ? "active" : ""}" data-category="${escapeHtml(c)}">${escapeHtml(c)}</button>`
    ).join("");
  }

  function applyFilters() {
    const q = state.search.trim().toLowerCase();
    let list = state.channels.filter(c => {
      const matchesCat = state.category === "All" || c.category === state.category;
      const hay = `${c.name} ${c.category}`.toLowerCase();
      return matchesCat && (!q || hay.includes(q));
    });

    if (state.sort === "az") list.sort((a,b) => a.name.localeCompare(b.name));
    if (state.sort === "category") list.sort((a,b) => `${a.category}${a.name}`.localeCompare(`${b.category}${b.name}`));
    state.filtered = list;
    renderChannels();
  }

  function renderChannels() {
    resultCount.textContent = `${state.filtered.length} channel${state.filtered.length === 1 ? "" : "s"}`;
    emptyState.classList.toggle("hidden", state.filtered.length !== 0);
    channelGrid.classList.toggle("hidden", state.filtered.length === 0);

    channelGrid.innerHTML = state.filtered.map((c, i) => {
      const logo = c.logo
        ? `<img src="${escapeHtml(c.logo)}" alt="" loading="lazy" onerror="this.outerHTML='<div class=\\'logo-fallback\\'>${initials(c.name)}</div>'">`
        : `<div class="logo-fallback">${initials(c.name)}</div>`;
      return `<article class="channel-card" data-id="${escapeHtml(c.id)}" style="animation-delay:${Math.min(i * 25, 300)}ms">
        <div class="logo-box">${logo}<span class="live-badge">LIVE</span></div>
        <div class="card-body">
          <div class="channel-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>
          <div class="channel-meta"><span>${escapeHtml(c.category)}</span><span class="play-mini">▶</span></div>
        </div>
      </article>`;
    }).join("");
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function setLoading(on) { loading.classList.toggle("hidden", !on); }
  function showError(message) {
    setLoading(false);
    errorText.textContent = message;
    errorOverlay.classList.remove("hidden");
  }

  function destroyPlayers() {
    if (state.hls) { try { state.hls.destroy(); } catch {} state.hls = null; }
    video.pause();
    video.removeAttribute("src");
    video.load();
    iframe.src = "about:blank";
    video.style.display = "none";
    iframe.style.display = "none";
  }

  function youtubeEmbed(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1`;
      if (u.hostname.includes("youtube.com")) {
        const id = u.searchParams.get("v");
        if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
        if (u.pathname.includes("/embed/")) return url;
      }
      if (u.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${u.pathname.split("/").filter(Boolean).pop()}?autoplay=1`;
      if (u.hostname.includes("dailymotion.com")) {
        const id = u.pathname.split("/video/")[1]?.split("_")[0];
        if (id) return `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
      }
    } catch {}
    return url;
  }

  async function playChannel(channel) {
    state.current = channel;
    $("#playerTitle").textContent = channel.name;
    $("#playerMeta").textContent = "Connecting...";
    $("#playerCategory").textContent = channel.category;
    $("#playerType").textContent = detectType(channel).toUpperCase();
    playerModal.classList.remove("hidden");
    playerModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    destroyPlayers();
    errorOverlay.classList.add("hidden");
    setLoading(true);

    const type = detectType(channel);
    const url = channel.url;

    if (type === "embed") {
      iframe.src = youtubeEmbed(url);
      iframe.style.display = "block";
      setLoading(false);
      $("#playerMeta").textContent = "Embedded player";
      return;
    }

    video.style.display = "block";

    if (type === "hls") {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
        video.addEventListener("loadedmetadata", onReady, {once:true});
        video.addEventListener("error", onVideoError, {once:true});
        video.play().catch(() => {});
      } else if (window.Hls && Hls.isSupported()) {
        state.hls = new Hls({enableWorker:true, lowLatencyMode:true, backBufferLength:30});
        state.hls.loadSource(url);
        state.hls.attachMedia(video);
        state.hls.on(Hls.Events.MANIFEST_PARSED, () => { onReady(); video.play().catch(() => {}); });
        state.hls.on(Hls.Events.ERROR, (_, data) => {
          if (data?.fatal) showError("The HLS stream rejected the connection or is unavailable. Check the stream URL and CORS.");
        });
      } else {
        showError("This browser does not support HLS playback.");
      }
      return;
    }

    if (type === "dash") {
      showError("DASH (.mpd) playback needs a DASH player library. Use HLS/M3U8 or a browser-supported video URL for the simplest setup.");
      return;
    }

    video.src = url;
    video.addEventListener("loadedmetadata", onReady, {once:true});
    video.addEventListener("error", onVideoError, {once:true});
    video.play().catch(() => {});
  }

  function onReady() {
    setLoading(false);
    errorOverlay.classList.add("hidden");
    $("#playerMeta").textContent = "Live stream connected";
  }

  function onVideoError() {
    showError("The browser could not play this stream. The URL may require authentication, CORS access, a supported codec, or may be offline.");
  }

  function closePlayer() {
    destroyPlayers();
    playerModal.classList.add("hidden");
    playerModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  categoryRow.addEventListener("click", e => {
    const btn = e.target.closest("[data-category]");
    if (!btn) return;
    state.category = btn.dataset.category;
    renderCategories();
    applyFilters();
  });

  channelGrid.addEventListener("click", e => {
    const card = e.target.closest(".channel-card");
    if (!card) return;
    const c = state.channels.find(x => x.id === card.dataset.id);
    if (c) playChannel(c);
  });

  searchInput.addEventListener("input", e => {
    state.search = e.target.value;
    searchWrap.classList.toggle("has-value", !!state.search);
    applyFilters();
  });

  $("#clearSearch").onclick = () => {
    searchInput.value = "";
    state.search = "";
    searchWrap.classList.remove("has-value");
    applyFilters();
    searchInput.focus();
  };

  document.querySelectorAll(".sort-btn").forEach(btn => btn.onclick = () => {
    document.querySelectorAll(".sort-btn").forEach(x => x.classList.remove("active"));
    btn.classList.add("active");
    state.sort = btn.dataset.sort;
    applyFilters();
  });

  $("#browseBtn").onclick = () => $("#channelsSection").scrollIntoView({behavior:"smooth"});
  $("#featuredBtn").onclick = () => {
    state.sort = "default"; state.category = "All"; state.search = "";
    searchInput.value = ""; searchWrap.classList.remove("has-value");
    document.querySelectorAll(".sort-btn").forEach(x => x.classList.toggle("active", x.dataset.sort === "default"));
    renderCategories(); applyFilters(); $("#channelsSection").scrollIntoView({behavior:"smooth"});
  };
  $("#homeBtn").onclick = e => { e.preventDefault(); window.scrollTo({top:0,behavior:"smooth"}); };
  $("#refreshBtn").onclick = () => {
    state.channels = safeChannels(); renderCategories(); applyFilters(); showToast("Channel list refreshed");
  };
  $("#resetFilters").onclick = () => {
    state.category = "All"; state.search = ""; searchInput.value = ""; searchWrap.classList.remove("has-value");
    renderCategories(); applyFilters();
  };
  $("#randomBtn").onclick = () => {
    if (!state.filtered.length) return showToast("No channels available");
    playChannel(state.filtered[Math.floor(Math.random() * state.filtered.length)]);
  };
  $("#themeBtn").onclick = () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("light", state.theme === "light");
    localStorage.setItem("iptv_theme", state.theme);
    $("#themeBtn").textContent = state.theme === "light" ? "☀" : "☾";
  };
  $("#closePlayer").onclick = closePlayer;
  $(".modal-backdrop").onclick = closePlayer;
  $("#retryBtn").onclick = () => state.current && playChannel(state.current);
  $("#openStreamBtn").onclick = () => state.current && window.open(state.current.url, "_blank", "noopener,noreferrer");
  $("#copyStreamBtn").onclick = async () => {
    if (!state.current) return;
    try { await navigator.clipboard.writeText(state.current.url); showToast("Stream link copied"); }
    catch { showToast("Copy not available in this browser"); }
  };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !playerModal.classList.contains("hidden")) closePlayer(); });

  state.channels = safeChannels();
  renderCategories();
  applyFilters();
})();