(() => {
  "use strict";

  /* =========================================================
     PREMIUM SIMPLE IPTV
     Supports:
     - HLS / M3U8
     - MP4 / WebM / OGG
     - YouTube
     - Vimeo
     - Dailymotion
     - DASH / MPD via dash.js
     - LocalStorage channels
     - Search
     - Category
     - Sorting
     - Dark / Light mode
     ========================================================= */

  /* =========================
     BUILT-IN CHANNELS
     ========================= */

  const BUILTIN_CHANNELS = [
    {
      id: "bd-tv-27",
      name: "BD TV",
      category: "Bangla",
      logo: "",
      url: "http://livetv.akr4m.com:8080/bdtv/restrem/27.m3u8",
      type: "hls"
    }
  ];


  /* =========================
     APP STATE
     ========================= */

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


  /* =========================
     HELPERS
     ========================= */

  const $ = (selector) => document.querySelector(selector);

  const $$ = (selector) => {
    return Array.from(document.querySelectorAll(selector));
  };

  function slug(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  function isHttp(url) {
    return /^https?:\/\//i.test(url);
  }

  function getInitials(name) {
    const words = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) return "TV";

    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }

    return (
      words[0][0] +
      words[words.length - 1][0]
    ).toUpperCase();
  }


  /* =========================
     CHANNEL LOADER
     ========================= */

  function safeChannels() {
    let local = [];

    try {
      local = JSON.parse(
        localStorage.getItem("simple_iptv_channels") || "[]"
      );

      if (!Array.isArray(local)) {
        local = [];
      }
    } catch (error) {
      console.warn("Invalid localStorage channel data:", error);
      local = [];
    }

    const external =
      Array.isArray(window.DEFAULT_CHANNELS)
        ? window.DEFAULT_CHANNELS
        : [];

    const allChannels = [
      ...BUILTIN_CHANNELS,
      ...external,
      ...local
    ];

    const cleaned = allChannels
      .filter((channel) => {
        return (
          channel &&
          channel.name &&
          channel.url &&
          isValidUrl(String(channel.url))
        );
      })
      .map((channel, index) => ({
        id:
          channel.id ||
          `${slug(channel.name)}-${index}`,

        name: String(channel.name),

        category:
          String(channel.category || "Other"),

        logo:
          String(channel.logo || ""),

        url:
          String(channel.url),

        type:
          String(channel.type || "auto")
            .toLowerCase()
            .trim()
      }));

    /* Remove duplicate IDs / duplicate URLs */

    const unique = [];

    for (const channel of cleaned) {
      const duplicate = unique.some(
        (item) =>
          item.id === channel.id ||
          item.url === channel.url
      );

      if (!duplicate) {
        unique.push(channel);
      }
    }

    return unique;
  }


  /* =========================
     SAVE LOCAL CHANNEL
     ========================= */

  function saveLocalChannel(channel) {
    let local = [];

    try {
      local = JSON.parse(
        localStorage.getItem("simple_iptv_channels") || "[]"
      );

      if (!Array.isArray(local)) {
        local = [];
      }
    } catch {
      local = [];
    }

    local.push(channel);

    localStorage.setItem(
      "simple_iptv_channels",
      JSON.stringify(local)
    );
  }


  /* =========================
     DETECT STREAM TYPE
     ========================= */

  function detectType(channel) {
    const explicit = String(channel.type || "auto")
      .toLowerCase();

    if (explicit !== "auto") {
      return explicit;
    }

    const url = String(channel.url || "")
      .toLowerCase();

    /* Remove query string for extension checking */

    const cleanUrl = url.split("?")[0].split("#")[0];

    /* HLS */

    if (
      cleanUrl.endsWith(".m3u8") ||
      url.includes(".m3u8?")
    ) {
      return "hls";
    }

    /* DASH */

    if (
      cleanUrl.endsWith(".mpd") ||
      url.includes(".mpd?")
    ) {
      return "dash";
    }

    /* Direct browser video */

    if (
      /\.(mp4|webm|ogg|ogv|m4v|mov)$/i.test(cleanUrl)
    ) {
      return "video";
    }

    /* YouTube */

    if (
      /youtube\.com|youtu\.be/i.test(url)
    ) {
      return "embed";
    }

    /* Vimeo */

    if (
      /vimeo\.com/i.test(url)
    ) {
      return "embed";
    }

    /* Dailymotion */

    if (
      /dailymotion\.com|dai\.ly/i.test(url)
    ) {
      return "embed";
    }

    /*
      Unknown HTTP stream.

      Browser video element will try it.
    */

    if (isHttp(url)) {
      return "video";
    }

    return "embed";
  }


  /* =========================
     YOUTUBE ID
     ========================= */

  function getYouTubeId(url) {
    try {
      const parsed = new URL(url);

      if (parsed.hostname.includes("youtu.be")) {
        return parsed.pathname.replace("/", "");
      }

      if (
        parsed.hostname.includes("youtube.com")
      ) {
        if (parsed.pathname === "/watch") {
          return parsed.searchParams.get("v");
        }

        if (
          parsed.pathname.startsWith("/embed/")
        ) {
          return parsed.pathname.split("/embed/")[1];
        }

        if (
          parsed.pathname.startsWith("/shorts/")
        ) {
          return parsed.pathname.split("/shorts/")[1];
        }

        if (
          parsed.pathname.startsWith("/live/")
        ) {
          return parsed.pathname.split("/live/")[1];
        }
      }
    } catch {}

    return null;
  }


  /* =========================
     VIMEO ID
     ========================= */

  function getVimeoId(url) {
    const match = String(url).match(
      /vimeo\.com\/(?:video\/)?(\d+)/
    );

    return match ? match[1] : null;
  }


  /* =========================
     DAILYMOTION ID
     ========================= */

  function getDailymotionId(url) {
    const match = String(url).match(
      /(?:dailymotion\.com\/video\/|dai\.ly\/)([a-zA-Z0-9]+)/
    );

    return match ? match[1] : null;
  }


  /* =========================
     FILTER CHANNELS
     ========================= */

  function applyFilters() {
    let result = [...state.channels];

    /* Category */

    if (state.category !== "All") {
      result = result.filter(
        (channel) =>
          channel.category === state.category
      );
    }

    /* Search */

    if (state.search) {
      const query = state.search.toLowerCase();

      result = result.filter((channel) => {
        return (
          channel.name.toLowerCase().includes(query) ||
          channel.category.toLowerCase().includes(query)
        );
      });
    }

    /* Sorting */

    if (state.sort === "az") {
      result.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    }

    if (state.sort === "za") {
      result.sort((a, b) =>
        b.name.localeCompare(a.name)
      );
    }

    if (state.sort === "category") {
      result.sort((a, b) =>
        a.category.localeCompare(b.category)
      );
    }

    if (state.sort === "random") {
      result.sort(() => Math.random() - 0.5);
    }

    state.filtered = result;

    renderChannels();
  }


  /* =========================
     CATEGORIES
     ========================= */

  function getCategories() {
    const categories = [
      "All",
      ...state.channels
        .map((channel) => channel.category)
        .filter(Boolean)
    ];

    return [...new Set(categories)];
  }


  function renderCategories() {
    const container =
      $("#categoryRow") ||
      $(".category-row") ||
      $("#categories") ||
      $(".categories") ||
      $("#categoryList");

    if (!container) return;

    const categories = getCategories();

    container.innerHTML = categories
      .map((category) => {
        const active =
          state.category === category
            ? "active"
            : "";

        return `
          <button
            class="category-btn ${active}"
            data-category="${escapeHTML(category)}"
          >
            ${escapeHTML(category)}
          </button>
        `;
      })
      .join("");

    $$(".category-btn").forEach((button) => {
      button.addEventListener("click", () => {
        state.category =
          button.dataset.category || "All";

        renderCategories();
        applyFilters();
      });
    });
  }


  /* =========================
     CHANNEL CARD
     ========================= */

  function channelCard(channel, index) {
    const initials = getInitials(channel.name);

    const logo = channel.logo
      ? `
        <img
          src="${escapeHTML(channel.logo)}"
          alt="${escapeHTML(channel.name)}"
          loading="lazy"
          onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
        >
        <span class="logo-fallback">
          ${escapeHTML(initials)}
        </span>
      `
      : `
        <span class="logo-fallback">
          ${escapeHTML(initials)}
        </span>
      `;

    return `
      <article
        class="channel-card"
        data-id="${escapeHTML(channel.id)}"
        style="--delay:${Math.min(index * 35, 500)}ms"
      >

        <div class="logo-box">
          ${logo}
        </div>

        <div class="card-body">

          <div class="channel-meta">

            <h3 class="channel-name">
              ${escapeHTML(channel.name)}
            </h3>

            <span class="live-badge">
              LIVE
            </span>

          </div>

          <div class="channel-meta">
            <span>${escapeHTML(channel.category)}</span>
            <span class="play-mini" aria-hidden="true">▶</span>
          </div>

        </div>

        <button
          class="watch-btn compact-btn"
          data-play="${escapeHTML(channel.id)}"
          aria-label="Watch ${escapeHTML(channel.name)}"
        >
          ▶
        </button>

      </article>
    `;
  }


  /* =========================
     RENDER CHANNELS
     ========================= */

  function renderChannels() {
    const container =
      $("#channelGrid") ||
      $(".channel-grid") ||
      $("#channels");

    if (!container) {
      console.warn(
        "Channel container not found."
      );
      return;
    }

    if (!state.filtered.length) {
      container.innerHTML = `
        <div class="empty-state">

          <div class="empty-icon">
            📺
          </div>

          <h3>
            No channels found
          </h3>

          <p>
            Try another search or category.
          </p>

        </div>
      `;

      updateCount();
      return;
    }

    container.innerHTML =
      state.filtered
        .map((channel, index) =>
          channelCard(channel, index)
        )
        .join("");

    $$("[data-play]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const id = button.dataset.play;
        const channel = state.channels.find((item) => item.id === id);
        if (channel) openPlayer(channel);
      });
    });

    $$(".channel-card").forEach((card) => {
      card.addEventListener("click", () => {
        const channel = state.channels.find(
          (item) => item.id === card.dataset.id
        );
        if (channel) openPlayer(channel);
      });
    });

    updateCount();
  }


  /* =========================
     COUNT
     ========================= */

  function updateCount() {
    const elements = [
      $("#channelCount"),
      $(".channel-count"),
      $("#resultCount")
    ];

    elements.forEach((element) => {
      if (element) {
        element.textContent =
          `${state.filtered.length} channel${state.filtered.length === 1 ? "" : "s"}`;
      }
    });
  }


  /* =========================
     PLAYER ELEMENTS
     ========================= */

  function getVideo() {
    return (
      $("#videoPlayer") ||
      $("video")
    );
  }

  function getModal() {
    return (
      $("#playerModal") ||
      $(".player-modal") ||
      $(".modal")
    );
  }


  /* =========================
     CLEAN PLAYER
     ========================= */

  function destroyPlayers() {
    const video = getVideo();

    if (state.hls) {
      try {
        state.hls.destroy();
      } catch {}

      state.hls = null;
    }

    if (state.dash) {
      try {
        state.dash.reset();
      } catch {}

      state.dash = null;
    }

    if (video) {
      try { video.pause(); } catch {}
      video.removeAttribute("src");
      video.removeAttribute("poster");
      try { video.load(); } catch {}
      video.style.display = "block";
    }

    const iframe = $("#embedPlayer");
    if (iframe) {
      iframe.src = "about:blank";
      iframe.style.display = "none";
    }
  }


  /* =========================
     PLAYER STATUS
     ========================= */

  function showLoading(message = "Connecting...") {
    const loader =
      $("#loadingOverlay") ||
      $("#playerLoading") ||
      $(".player-loading");

    if (!loader) return;

    loader.innerHTML = `
      <div class="loading-spinner"></div>
      <span>${escapeHTML(message)}</span>
    `;

    loader.classList.remove("hidden");
    loader.style.display = "flex";
  }


  function hideLoading() {
    const loader =
      $("#loadingOverlay") ||
      $("#playerLoading") ||
      $(".player-loading");

    if (loader) {
      loader.style.display = "none";
      loader.classList.add("hidden");
    }
  }


  function showError(message) {
    hideLoading();

    const errorBox =
      $("#errorOverlay") ||
      $("#playerError") ||
      $(".player-error");

    if (!errorBox) {
      alert(message);
      return;
    }

    errorBox.innerHTML = `
      <div class="error-icon">
        ⚠️
      </div>

      <h3>
        Playback Error
      </h3>

      <p>
        ${escapeHTML(message)}
      </p>

      <button
        type="button"
        id="retryPlayer"
      >
        Try Again
      </button>
    `;

    errorBox.classList.remove("hidden");
    errorBox.style.display = "flex";

    const retry =
      $("#retryPlayer");

    if (retry) {
      retry.onclick = () => {
        if (state.current) {
          openPlayer(state.current);
        }
      };
    }
  }


  function hideError() {
    const errorBox =
      $("#errorOverlay") ||
      $("#playerError") ||
      $(".player-error");

    if (errorBox) {
      errorBox.style.display = "none";
      errorBox.classList.add("hidden");
      errorBox.innerHTML = "";
    }
  }


  /* =========================
     PLAYER TITLE
     ========================= */

  function setPlayerTitle(channel) {
    const title =
      $("#playerTitle") ||
      $(".player-title");

    if (title) {
      title.textContent = channel.name;
    }

    const category =
      $("#playerCategory") ||
      $(".player-category");

    if (category) {
      category.textContent =
        channel.category;
    }
  }


  /* =========================
     OPEN PLAYER
     ========================= */

  function openPlayer(channel) {
    state.current = channel;

    const modal = getModal();

    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("active", "show");
      modal.style.display = "grid";
      modal.setAttribute("aria-hidden", "false");
    }

    setPlayerTitle(channel);

    const meta = $("#playerMeta");
    const playerType = $("#playerType");
    if (meta) meta.textContent = channel.url;
    if (playerType) playerType.textContent = detectType(channel).toUpperCase();

    hideError();
    destroyPlayers();

    // Browsers block insecure HTTP media when this site is served over HTTPS.
    if (location.protocol === "https:" && /^http:\/\//i.test(channel.url)) {
      showError("This stream uses HTTP. An HTTPS website cannot play it directly because the browser blocks mixed-content media. Use an HTTPS stream or a server-side HTTPS proxy.");
      return;
    }

    showLoading("Connecting to stream...");

    const type =
      detectType(channel);

    if (type === "hls") {
      playHLS(channel);
      return;
    }

    if (type === "dash") {
      playDASH(channel);
      return;
    }

    if (type === "embed") {
      playEmbed(channel);
      return;
    }

    if (type === "video") {
      playVideo(channel);
      return;
    }

    showError(
      "This stream type is not supported by this browser."
    );
  }


  /* =========================
     PLAY HLS
     ========================= */

  function playHLS(channel) {
    const video = getVideo();

    if (!video) {
      showError(
        "Video player element was not found."
      );
      return;
    }

    video.style.display = "block";

    /* Native HLS */

    if (
      video.canPlayType(
        "application/vnd.apple.mpegurl"
      )
    ) {
      video.src = channel.url;

      video.onloadedmetadata = () => {
        hideLoading();

        video.play().catch(() => {});
      };

      video.onerror = () => {
        showError(
          "The HLS stream could not be played. The stream may be offline, blocked, or require CORS/HTTPS."
        );
      };

      return;
    }

    /* HLS.js */

    if (
      typeof window.Hls === "undefined"
    ) {
      showError(
        "HLS.js is not loaded. Check the HLS.js CDN script in index.html."
      );
      return;
    }

    if (
      !window.Hls.isSupported()
    ) {
      showError(
        "This browser does not support HLS playback."
      );
      return;
    }

    const hls =
      new window.Hls({
        enableWorker: true,

        lowLatencyMode: true,

        backBufferLength: 30,

        maxBufferLength: 30,

        liveSyncDurationCount: 3,

        liveMaxLatencyDurationCount: 8
      });

    state.hls = hls;

    hls.loadSource(channel.url);

    hls.attachMedia(video);

    hls.on(
      window.Hls.Events.MANIFEST_PARSED,
      () => {
        hideLoading();

        video
          .play()
          .catch(() => {});
      }
    );

    hls.on(
      window.Hls.Events.ERROR,
      (_, data) => {
        console.warn(
          "HLS error:",
          data
        );

        if (
          !data.fatal
        ) {
          return;
        }

        if (
          data.type ===
          window.Hls.ErrorTypes.NETWORK_ERROR
        ) {
          try {
            hls.startLoad();
            return;
          } catch {}
        }

        if (
          data.type ===
          window.Hls.ErrorTypes.MEDIA_ERROR
        ) {
          try {
            hls.recoverMediaError();
            return;
          } catch {}
        }

        showError(
          "HLS playback failed. Check whether the M3U8 URL is active and allows browser CORS access."
        );
      }
    );
  }


  /* =========================
     PLAY DASH / MPD
     ========================= */

  function playDASH(channel) {
    const video = getVideo();

    if (!video) {
      showError(
        "Video player element was not found."
      );
      return;
    }

    if (
      typeof window.dashjs === "undefined"
    ) {
      showError(
        "DASH player is not loaded. Add dash.js to index.html."
      );
      return;
    }

    const player =
      window.dashjs.MediaPlayer().create();

    state.dash = player;

    player.initialize(
      video,
      channel.url,
      true
    );

    player.on(
      window.dashjs.MediaPlayer.events.STREAM_INITIALIZED,
      () => {
        hideLoading();
      }
    );

    player.on(
      window.dashjs.MediaPlayer.events.ERROR,
      (event) => {
        console.warn(
          "DASH error:",
          event
        );

        showError(
          "DASH playback failed. The MPD stream may be offline, protected, or blocked by CORS."
        );
      }
    );
  }


  /* =========================
     DIRECT VIDEO
     ========================= */

  function playVideo(channel) {
    const video = getVideo();

    if (!video) {
      showError(
        "Video player element was not found."
      );
      return;
    }

    video.style.display = "block";

    video.src = channel.url;

    video.onloadedmetadata = () => {
      hideLoading();

      video
        .play()
        .catch(() => {});
    };

    video.onerror = () => {
      showError(
        "This video cannot be played by the browser. Check the URL, format and server CORS settings."
      );
    };
  }


  /* =========================
     EMBED PLAYER
     ========================= */

  function playEmbed(channel) {
    const video = getVideo();
    const iframe = $("#embedPlayer");

    if (video) {
      video.style.display = "none";
    }

    if (!iframe) {
      showError("Embedded player element was not found.");
      return;
    }

    iframe.style.display = "block";

    let embedUrl = channel.url;
    const youtube = getYouTubeId(channel.url);
    const vimeo = getVimeoId(channel.url);
    const dailymotion = getDailymotionId(channel.url);

    if (youtube) {
      embedUrl = `https://www.youtube.com/embed/${youtube}?autoplay=1&rel=0`;
    } else if (vimeo) {
      embedUrl = `https://player.vimeo.com/video/${vimeo}?autoplay=1`;
    } else if (dailymotion) {
      embedUrl = `https://www.dailymotion.com/embed/video/${dailymotion}?autoplay=1`;
    }

    iframe.src = embedUrl;
    iframe.onload = () => hideLoading();
  }

  /* =========================
     CLOSE PLAYER
     ========================= */

  function closePlayer() {
    destroyPlayers();

    const modal = getModal();

    if (modal) {
      modal.classList.remove("active", "show");
      modal.classList.add("hidden");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }

    state.current = null;

    hideLoading();
    hideError();
  }


  /* =========================
     SEARCH
     ========================= */

  function setupSearch() {
    const inputs = [
      $("#searchInput"),
      $(".search-input"),
      $("input[type='search']")
    ].filter(Boolean);

    inputs.forEach((input) => {
      input.addEventListener(
        "input",
        () => {
          state.search =
            input.value.trim();

          input.parentElement?.classList.toggle(
            "has-value",
            Boolean(state.search)
          );

          applyFilters();
        }
      );
    });
  }


  /* =========================
     SORT
     ========================= */

  function setupSort() {
    const select = $("#sortSelect") || $(".sort-select");
    if (select) {
      select.addEventListener("change", () => {
        state.sort = select.value;
        applyFilters();
      });
    }

    $$("[data-sort]").forEach((button) => {
      button.addEventListener("click", () => {
        state.sort = button.dataset.sort || "default";
        $$("[data-sort]").forEach((b) => b.classList.toggle(
          "active", b === button
        ));
        applyFilters();
      });
    });
  }


  /* =========================
     HEADER / HERO CONTROLS
     ========================= */

  function setupUIControls() {
    const scrollToChannels = () => {
      $("#channelsSection")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    };

    $("#browseBtn")?.addEventListener("click", scrollToChannels);
    $("#featuredBtn")?.addEventListener("click", () => {
      state.category = "All";
      state.search = "";
      const input = $("#searchInput");
      if (input) input.value = "";
      applyFilters();
      scrollToChannels();
    });

    $("#refreshBtn")?.addEventListener("click", () => {
      state.channels = safeChannels();
      renderCategories();
      applyFilters();
      showToast("Channels refreshed");
    });

    $("#resetFilters")?.addEventListener("click", () => {
      state.category = "All";
      state.search = "";
      state.sort = "default";
      const input = $("#searchInput");
      if (input) input.value = "";
      $$("[data-sort]").forEach((b) => b.classList.toggle(
        "active", (b.dataset.sort || "default") === "default"
      ));
      renderCategories();
      applyFilters();
    });

    $("#clearSearch")?.addEventListener("click", () => {
      const input = $("#searchInput");
      if (input) {
        input.value = "";
        state.search = "";
        applyFilters();
        input.focus();
      }
    });

    $("#homeBtn")?.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({top: 0, behavior: "smooth"});
    });
  }

  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 1800);
  }

  /* =========================
     THEME
     ========================= */

  function applyTheme() {
    document.documentElement.classList.toggle(
      "light",
      state.theme === "light"
    );

    document.body.dataset.theme =
      state.theme;

    const button =
      $("#themeBtn") ||
      $("#themeToggle") ||
      $(".theme-toggle");

    if (button) {
      button.textContent =
        state.theme === "dark"
          ? "☀"
          : "☾";
    }
  }


  function setupTheme() {
    applyTheme();

    const button =
      $("#themeBtn") ||
      $("#themeToggle") ||
      $(".theme-toggle");

    if (!button) return;

    button.addEventListener(
      "click",
      () => {
        state.theme =
          state.theme === "dark"
            ? "light"
            : "dark";

        localStorage.setItem(
          "iptv_theme",
          state.theme
        );

        applyTheme();
      }
    );
  }


  /* =========================
     RANDOM CHANNEL
     ========================= */

  function setupRandom() {
    const buttons = [
      $("#randomBtn"),
      $("#randomChannel"),
      $(".random-channel")
    ].filter(Boolean);

    buttons.forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          if (!state.channels.length) {
            return;
          }

          const channel =
            state.channels[
              Math.floor(
                Math.random() *
                state.channels.length
              )
            ];

          openPlayer(channel);
        }
      );
    });
  }


  /* =========================
     CLOSE BUTTON
     ========================= */

  function setupClose() {
    const buttons = [
      $("#closePlayer"),
      $(".close-player"),
      "[data-close-player]"
    ];

    buttons.forEach((selector) => {
      $$(selector).forEach(
        (button) => {
          button.addEventListener(
            "click",
            closePlayer
          );
        }
      );
    });

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape"
        ) {
          closePlayer();
        }
      }
    );

    const modal = getModal();

    if (modal) {
      modal.addEventListener(
        "click",
        (event) => {
          if (
            event.target === modal ||
            event.target.matches?.(".modal-backdrop,[data-close='1']")
          ) {
            closePlayer();
          }
        }
      );
    }
  }


  /* =========================
     COPY STREAM
     ========================= */

  function setupCopy() {
    const button =
      $("#copyStreamBtn") ||
      $("#copyStream") ||
      $(".copy-stream");

    if (!button) return;

    button.addEventListener(
      "click",
      async () => {
        if (!state.current) return;

        try {
          await navigator.clipboard.writeText(
            state.current.url
          );

          const old =
            button.textContent;

          button.textContent =
            "Copied ✓";

          setTimeout(() => {
            button.textContent =
              old;
          }, 1500);
        } catch {
          alert(
            state.current.url
          );
        }
      }
    );
  }


  /* =========================
     OPEN STREAM
     ========================= */

  function setupOpenStream() {
    const button =
      $("#openStreamBtn") ||
      $("#openStream") ||
      $(".open-stream");

    if (!button) return;

    button.addEventListener(
      "click",
      () => {
        if (!state.current) return;

        window.open(
          state.current.url,
          "_blank",
          "noopener,noreferrer"
        );
      }
    );
  }


  /* =========================
     LIVE STATUS
     ========================= */

  function setupVideoEvents() {
    const video = getVideo();

    if (!video) return;

    video.addEventListener(
      "waiting",
      () => {
        showLoading("Buffering...");
      }
    );

    video.addEventListener(
      "playing",
      () => {
        hideLoading();
      }
    );

    video.addEventListener(
      "canplay",
      () => {
        hideLoading();
      }
    );

    video.addEventListener(
      "stalled",
      () => {
        showLoading(
          "Stream buffering..."
        );
      }
    );
  }


  /* =========================
     CONNECTION INFO
     ========================= */

  function showConnectionStatus() {
    const elements = [
      $("#connectionStatus"),
      $(".connection-status")
    ];

    elements.forEach((element) => {
      if (!element) return;

      element.textContent =
        navigator.onLine
          ? "Online"
          : "Offline";

      element.classList.toggle(
        "offline",
        !navigator.onLine
      );
    });
  }


  window.addEventListener(
    "online",
    showConnectionStatus
  );

  window.addEventListener(
    "offline",
    showConnectionStatus
  );


  /* =========================
     INITIALIZE
     ========================= */

  function init() {
    console.log(
      "Premium IPTV starting..."
    );

    state.channels =
      safeChannels();

    console.log(
      "Channels loaded:",
      state.channels
    );

    renderCategories();

    setupSearch();

    setupSort();

    setupUIControls();

    setupTheme();

    setupRandom();

    setupClose();

    setupCopy();

    setupOpenStream();

    setupVideoEvents();

    showConnectionStatus();

    applyFilters();

    console.log(
      `Premium IPTV ready — ${state.channels.length} channels`
    );
  }


  /* =========================
     DOM READY
     ========================= */

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  } else {
    init();
  }

})();