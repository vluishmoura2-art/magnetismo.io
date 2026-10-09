(function () {
  const COLORS = [
    "#ff3b3b",
    "#ff9f1c",
    "#ffe14d",
    "#57e389",
    "#33d6d6",
    "#4f8cff",
    "#a06bff",
    "#ff5ac8",
  ];

  let root = null;
  let overlay = null;
  let hint = null;
  let nameInput = null;
  let hud = null;
  let hudState = null;
  let hudAlive = null;
  let banner = null;

  let selected = COLORS[0];
  let onPlay = () => {};
  let built = false;

  function build() {
    overlay = document.createElement("div");
    overlay.className = "menu-overlay";
    overlay.innerHTML = `
      <div class="menu-card">
        <h1 class="menu-title">magnet<span>.io</span></h1>
        <label class="menu-label" for="name-input">Name</label>
        <input id="name-input" class="menu-input" maxlength="14" placeholder="Player" autocomplete="off" />
        <span class="menu-label">Ball color</span>
        <div class="swatches"></div>
        <button class="menu-play" type="button">Play</button>
        <p class="menu-hint"></p>
      </div>`;
    root.appendChild(overlay);

    nameInput = overlay.querySelector("#name-input");
    hint = overlay.querySelector(".menu-hint");
    const swatches = overlay.querySelector(".swatches");
    const playBtn = overlay.querySelector(".menu-play");

    COLORS.forEach((color) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "swatch";
      swatch.style.background = color;
      if (color === selected) swatch.classList.add("selected");
      swatch.addEventListener("click", () => {
        selected = color;
        swatches.querySelectorAll(".swatch").forEach((s) => {
          s.classList.toggle("selected", s === swatch);
        });
      });
      swatches.appendChild(swatch);
    });

    playBtn.addEventListener("click", () => {
      onPlay(nameInput.value.trim() || "Player", selected);
    });

    hud = document.createElement("div");
    hud.className = "hud hidden";
    hud.innerHTML = `<div class="hud-state"></div><div class="hud-alive"></div>`;
    root.appendChild(hud);
    hudState = hud.querySelector(".hud-state");
    hudAlive = hud.querySelector(".hud-alive");

    banner = document.createElement("div");
    banner.className = "banner";
    root.appendChild(banner);

    built = true;
  }

  window.Menu = {
    colors: COLORS,

    init(options) {
      if (built) return;
      root = options.root || document.getElementById("menu-root");
      onPlay = options.onPlay || onPlay;
      build();
    },

    show() {
      if (overlay) overlay.classList.remove("hidden");
    },

    hide() {
      if (overlay) overlay.classList.add("hidden");
    },

    setHint(text) {
      if (hint) hint.textContent = text || "";
    },

    showHud(state, aliveText) {
      if (!hud) return;
      hud.classList.remove("hidden");
      hudState.textContent = state;
      hudAlive.textContent = aliveText;
    },

    hideHud() {
      if (hud) hud.classList.add("hidden");
    },

    banner(text, color) {
      if (!banner) return;
      banner.innerHTML = "";
      const el = document.createElement("div");
      el.className = "banner-text";
      el.textContent = text;
      if (color) el.style.color = color;
      banner.appendChild(el);
      banner.classList.add("show");
    },

    clearBanner() {
      if (!banner) return;
      banner.classList.remove("show");
      banner.innerHTML = "";
    },
  };
})();
