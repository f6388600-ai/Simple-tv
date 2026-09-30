(() => {
  "use strict";

  const BUILTIN_CHANNELS = [
    {
      id: "bd-tv-27",
      name: "BD TV",
      category: "Bangla",
      logo: "",
      url: "https://livetv.akr4m.com:8080/bdtv/restrem/27.m3u8",
      type: "hls"
    }
  ];

  const state = {
    channels: [],
    filtered: [],
    category: "All",
    search: "",
    sort: "default",
    current: null,
    hls: null,
    dash: null,
    theme: localStorage.getItem("iptv_theme") || "dark"
  };

  const $ = (selector) => document.querySelector(selector);   const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function slug(text) {
    return String(text || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function escapeHTML(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  function getInitials(name) {
    const words = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "TV";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  function safeChannels() {
    let local = [];
    try {
      local = JSON.parse(localStorage.getItem("simple_iptv_channels") || "[]");
      if (!Array.isArray(local)) local = [];
    } catch {
      local = [];
    }

    const external = Array.isArray(window.DEFAULT_CHANNELS) ? window.DEFAULT_CHANNELS : [];
    const allChannels = [...BUILTIN_CHANNELS, ...external, ...local];

    const cleaned = allChannels
      .filter((channel) => channel && channel.name && channel.url && isValidUrl(String(channel.url)))
      .map((channel, index) => ({
        id: channel.id || `${slug(channel.name)}-${index}`,
        name: String(channel.name),
        category: String(channel.category || "Other"),
        logo: String(channel.logo || ""),
        url: String(channel.url),
        type: String(channel.type || "auto").toLowerCase().trim()
      }));

    const unique = [];
    for (const channel of cleaned) {
      if (!unique.some((item) => item.id === channel.id || item.url === channel.url)) {
        unique.push(channel);
      }
    }
    return unique;
  }

  function detectType(channel) {
    const explicit = String(channel.type || "auto").toLowerCase();
    if (explicit !== "auto") return explicit;
    const url = String(channel.url || "").toLowerCase();
    const cleanUrl = url.split("?")[0].split("#")[0];

    if (cleanUrl.endsWith(".m3u8") || url.includes(".m3u8?")) return "hls";
    if (cleanUrl.endsWith(".mpd") || url.includes(".mpd?")) return "dash";
    if (/\.(mp4|webm|ogg|ogv|m4v|mov)$/i.test(cleanUrl)) return "video";
    if (/youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|dai\.ly/i.test(url)) return "embed";
    return "video";
  }

  function getYouTubeId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes("youtu.be")) return parsed.pathname.replace("/", "");
      if (parsed.hostname.includes("youtube.com")) {
        if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
        if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/embed/")[1];
        if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/shorts/")[1];
        if (parsed.pathname.startsWith("/live/")) return parsed.pathname.split("/live/")[1];
      }
    } catch {}
    return null;
  }

  function getVimeoId(url) {
    const match = String(url).match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return match ? match[1] : null;
  }

  function getDailymotionId(url) {
    const match = String(url).match(/(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  function applyFilters() {
    let result = [...state.channels];

    if (state.category !== "All") {
      result = result.filter((channel) => channel.category === state.category);
    }

    if (state.search) {
      const query = state.search.toLowerCase();
      result = result.filter((channel) =>
        channel.name.toLowerCase().includes(query) || channel.category.toLowerCase().includes(query)
      );
    }

    if (state.sort === "az") result.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sort === "za") result.sort((a, b) => b.name.localeCompare(a.name));
    else if (state.sort === "category") result.sort((a, b) => a.category.localeCompare(b.category));
    else if (state.sort === "random") result.sort(() => Math.random() - 0.5);

    state.filtered = result;
    renderChannels();
  }

  function getCategories() {
    const categories = ["All", ...state.channels.map((c) => c.category).filter(Boolean)];
    return [...new Set(categories)];
  }

  function renderCategories() {
    const container = $("#categoryRow") \vert{}\vert{} $(".category-row");
    if (!container) return;

    const categories = getCategories();
    container.innerHTML = categories
      .map((cat) => `<button class="category-btn ${state.category === cat ? "active" : ""}" data-category="${escapeHTML(cat)}">${escapeHTML(cat)}</button>`)
      .join("");

    $$(".category-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.category = btn.dataset.category || "All";
        renderCategories();
        applyFilters();
      });
    });
  }

  function channelCard(channel) {
    const initials = getInitials(channel.name);
    const logo = channel.logo
      ? `<img src="${escapeHTML(channel.logo)}" alt="${escapeHTML(channel.name)}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"><span class="logo-fallback" style="display:none;">${escapeHTML(initials)}</span>`
      : `<span class="logo-fallback">${escapeHTML(initials)}</span>`;

    return `
      <article class="channel-card" data-id="${escapeHTML(channel.id)}">
        <div class="logo-box">${logo}</div>
        <div class="card-body">
          <div class="channel-meta">
            <h3 class="channel-name">${escapeHTML(channel.name)}</h3>
            <span class="live-badge">LIVE</span>
          </div>
          <div class="channel-meta">
            <span>${escapeHTML(channel.category)}</span>
            <span class="play-mini">▶</span>
          </div>
        </div>
      </article>
    `;
  }

  function renderChannels() {
    const container = $("#channelGrid") \vert{}\vert{} $(".channel-grid");
    const emptyState = $("#emptyState");      if (!container) return;      if (!state.filtered.length) {       container.innerHTML = "";       if (emptyState) emptyState.classList.remove("hidden");       updateCount();       return;     }      if (emptyState) emptyState.classList.add("hidden");     container.innerHTML = state.filtered.map((ch) => channelCard(ch)).join("");      $$(".channel-card").forEach((card) => {
      card.addEventListener("click", () => {
        const channel = state.channels.find((item) => item.id === card.dataset.id);
        if (channel) openPlayer(channel);
      });
    });

    updateCount();
  }

  function updateCount() {
    const countEl = $("#resultCount");
    if (countEl) {
      countEl.textContent = `${state.filtered.length} channel${state.filtered.length === 1 ? "" : "s"}`;
    }
  }

  function getVideo() {
    return $("#videoPlayer") \vert{}\vert{} $("video");
  }

  function getModal() {
    return $("#playerModal") \vert{}\vert{} $(".modal");
  }

  function destroyPlayers() {
    const video = getVideo();
    if (state.hls) {
      try { state.hls.destroy(); } catch {}
      state.hls = null;
    }
    if (state.dash) {
      try { state.dash.reset(); } catch {}
      state.dash = null;
    }
    if (video) {
      try { video.pause(); } catch {}
      video.removeAttribute("src");
      video.load();
      video.style.display = "block";
    }
    const iframe = $("#embedPlayer");
    if (iframe) {
      iframe.src = "about:blank";
      iframe.style.display = "none";
    }
  }

  function showLoading(msg = "Connecting...") {
    const loader = $("#loadingOverlay");
    if (!loader) return;
    loader.querySelector("strong").textContent = msg;
    loader.classList.remove("hidden");
    loader.style.display = "flex";
  }

  function hideLoading() {
    const loader = $("#loadingOverlay");
    if (loader) {
      loader.style.display = "none";
      loader.classList.add("hidden");
    }
  }

  function showError(msg) {
    hideLoading();
    const errorBox = $("#errorOverlay");
    if (!errorBox) {
      alert(msg);
      return;
    }
    const textEl = $("#errorText");
    if (textEl) textEl.textContent = msg;
    errorBox.classList.remove("hidden");
    errorBox.style.display = "flex";
  }

  function hideError() {
    const errorBox = $("#errorOverlay");
    if (errorBox) {
      errorBox.style.display = "none";
      errorBox.classList.add("hidden");
    }
  }

  function openPlayer(channel) {
    state.current = channel;
    const modal = getModal();

    if (modal) {
      modal.classList.remove("hidden");
      modal.style.display = "grid";
      modal.setAttribute("aria-hidden", "false");
    }

    const titleEl = $("#playerTitle");
    const metaEl = $("#playerMeta");
    const catEl = $("#playerCategory");
    const typeEl = $("#playerType");

    if (titleEl) titleEl.textContent = channel.name;
    if (metaEl) metaEl.textContent = channel.url;
    if (catEl) catEl.textContent = channel.category;
    if (typeEl) typeEl.textContent = detectType(channel).toUpperCase();

    hideError();
    destroyPlayers();
    showLoading("Connecting to stream...");

    const type = detectType(channel);
    if (type === "hls") { playHLS(channel); return; }
    if (type === "dash") { playDASH(channel); return; }
    if (type === "embed") { playEmbed(channel); return; }
    if (type === "video") { playVideo(channel); return; }

    showError("Unsupported stream type.");
  }

  function playHLS(channel) {
    const video = getVideo();
    if (!video) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = channel.url;
      video.onloadedmetadata = () => {
        hideLoading();
        video.play().catch(() => {});
      };
      video.onerror = () => {
        showError("Failed to play HLS stream.");
      };
      return;
    }

    if (typeof window.Hls === "undefined" || !window.Hls.isSupported()) {
      showError("HLS is not supported in this browser.");
      return;
    }

    const hls = new window.Hls({ enableWorker: true, lowLatencyMode: true });
    state.hls = hls;
    hls.loadSource(channel.url);
    hls.attachMedia(video);
    hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
      hideLoading();
      video.play().catch(() => {});
    });
    hls.on(window.Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        showError("HLS playback network or stream error.");
      }
    });
  }

  function playDASH(channel) {
    const video = getVideo();
    if (!video || typeof window.dashjs === "undefined") {
      showError("DASH player unavailable.");
      return;
    }
    const player = window.dashjs.MediaPlayer().create();
    state.dash = player;
    player.initialize(video, channel.url, true);
    player.on(window.dashjs.MediaPlayer.events.STREAM_INITIALIZED, () => hideLoading());
    player.on(window.dashjs.MediaPlayer.events.ERROR, () => showError("DASH stream failed."));
  }

  function playVideo(channel) {
    const video = getVideo();
    if (!video) return;
    video.src = channel.url;
    video.onloadedmetadata = () => {
      hideLoading();
      video.play().catch(() => {});
    };
    video.onerror = () => showError("Direct video playback failed.");
  }

  function playEmbed(channel) {
    const video = getVideo();
    const iframe = $("#embedPlayer");
    if (video) video.style.display = "none";
    if (!iframe) return;

    iframe.style.display = "block";
    let embedUrl = channel.url;
    const yt = getYouTubeId(channel.url);
    const vim = getVimeoId(channel.url);
    const dm = getDailymotionId(channel.url);

    if (yt) embedUrl = `https://www.youtube.com/embed/${yt}?autoplay=1&rel=0`;
    else if (vim) embedUrl = `https://player.vimeo.com/video/${vim}?autoplay=1`;
    else if (dm) embedUrl = `https://www.dailymotion.com/embed/video/${dm}?autoplay=1`;

    iframe.src = embedUrl;
    iframe.onload = () => hideLoading();
  }

  function closePlayer() {
    destroyPlayers();
    const modal = getModal();
    if (modal) {
      modal.classList.add("hidden");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
    state.current = null;
    hideLoading();
    hideError();
  }

  function setupEventListeners() {
    const searchInput = $("#searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        state.search = e.target.value.trim();
        applyFilters();
      });
    }

    const clearSearch = $("#clearSearch");
    if (clearSearch) {
      clearSearch.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
          state.search = "";
          applyFilters();
        }
      });
    }

    $$("[data-sort]").forEach((btn) => {       btn.addEventListener("click", () => {         state.sort = btn.dataset.sort \vert{}\vert{} "default";         $$
("[data-sort]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        applyFilters();
      });
    });

    const themeBtn = $("#themeBtn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => {
        state.theme = state.theme === "dark" ? "light" : "dark";
        localStorage.setItem("iptv_theme", state.theme);
        applyTheme();
      });
    }

    const randomBtn = $("#randomBtn");
    if (randomBtn) {
      randomBtn.addEventListener("click", () => {
        if (!state.channels.length) return;
        const randomChannel = state.channels[Math.floor(Math.random() * state.channels.length)];
        openPlayer(randomChannel);
      });
    }

    const browseBtn = $("#browseBtn");
    if (browseBtn) {
      browseBtn.addEventListener("click", () => {
        $("#channelsSection")?.scrollIntoView({ behavior: "smooth" });
      });
    }

    const featuredBtn = $("#featuredBtn");
    if (featuredBtn) {
      featuredBtn.addEventListener("click", () => {
        state.category = "All";
        state.search = "";
        if (searchInput) searchInput.value = "";
        applyFilters();
        $("#channelsSection")?.scrollIntoView({ behavior: "smooth" });
      });
    }

    const refreshBtn = $("#refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        state.channels = safeChannels();
        renderCategories();
        applyFilters();
      });
    }

    const resetFilters = $("#resetFilters");     if (resetFilters) {       resetFilters.addEventListener("click", () => {         state.category = "All";         state.search = "";         state.sort = "default";         if (searchInput) searchInput.value = "";         $$("[data-sort]").forEach((b) => b.classList.toggle("active", b.dataset.sort === "default"));
        renderCategories();
        applyFilters();
      });
    }

    const closeBtn = $("#closePlayer");
    if (closeBtn) closeBtn.addEventListener("click", closePlayer);

    const modal = getModal();
    if (modal) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal || e.target.classList.contains("modal-backdrop")) {
          closePlayer();
        }
      });
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closePlayer();
    });

    const retryBtn = $("#retryBtn");
    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        if (state.current) openPlayer(state.current);
      });
    }

    const openStreamBtn = $("#openStreamBtn");
    if (openStreamBtn) {
      openStreamBtn.addEventListener("click", () => {
        if (state.current) window.open(state.current.url, "_blank");
      });
    }

    const copyStreamBtn = $("#copyStreamBtn");
    if (copyStreamBtn) {
      copyStreamBtn.addEventListener("click", () => {
        if (!state.current) return;
        navigator.clipboard.writeText(state.current.url).then(() => {
          copyStreamBtn.textContent = "Copied ✓";
          setTimeout(() => { copyStreamBtn.textContent = "Copy stream"; }, 1500);
        });
      });
    }
  }

  function applyTheme() {
    document.documentElement.classList.toggle("light", state.theme === "light");
    const themeBtn = $("#themeBtn");
    if (themeBtn) {
      themeBtn.textContent = state.theme === "dark" ? "☾" : "☀";
    }
  }

  function init() {
    applyTheme();
    state.channels = safeChannels();
    renderCategories();
    setupEventListeners();
    applyFilters();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
