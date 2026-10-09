(function () {
  let root = null;
  let base = null;
  let knob = null;
  let fieldBtn = null;

  let onMove = () => {};
  let onField = () => {};
  let onJump = () => {};

  let active = false;
  let pointerId = null;
  let radius = 1;
  let cx = 0;
  let cy = 0;

  function build() {
    root.innerHTML = `
      <div class="joystick">
        <div class="joystick-base"><div class="joystick-knob"></div></div>
      </div>
      <div class="action-buttons">
        <button class="jump-btn" type="button">jump</button>
        <button class="field-btn" type="button">field</button>
      </div>`;

    base = root.querySelector(".joystick-base");
    knob = root.querySelector(".joystick-knob");
    fieldBtn = root.querySelector(".field-btn");
    const jumpBtn = root.querySelector(".jump-btn");

    base.addEventListener("pointerdown", (e) => {
      active = true;
      pointerId = e.pointerId;
      const rect = base.getBoundingClientRect();
      cx = rect.left + rect.width / 2;
      cy = rect.top + rect.height / 2;
      radius = rect.width / 2;
      try {
        base.setPointerCapture(e.pointerId);
      } catch (_) {}
      update(e.clientX, e.clientY);
      e.preventDefault();
    });

    base.addEventListener("pointermove", (e) => {
      if (!active || e.pointerId !== pointerId) return;
      update(e.clientX, e.clientY);
      e.preventDefault();
    });

    function end(e) {
      if (!active || (e.pointerId != null && e.pointerId !== pointerId)) return;
      active = false;
      pointerId = null;
      knob.style.transform = "translate(-50%, -50%)";
      onMove(0, 0);
    }
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);

    fieldBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      onField();
    });

    jumpBtn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      jumpBtn.classList.add("held");
      onJump(true);
    });
    const releaseJump = (e) => {
      if (e) e.preventDefault();
      jumpBtn.classList.remove("held");
      onJump(false);
    };
    jumpBtn.addEventListener("pointerup", releaseJump);
    jumpBtn.addEventListener("pointercancel", releaseJump);
    jumpBtn.addEventListener("pointerleave", releaseJump);
  }

  function update(px, py) {
    let dx = px - cx;
    let dy = py - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, radius);
    const nx = (dx / dist) * (clamped / radius);
    const ny = (dy / dist) * (clamped / radius);
    knob.style.transform = `translate(calc(-50% + ${nx * radius}px), calc(-50% + ${
      ny * radius
    }px))`;
    onMove(nx, ny);
  }

  window.Controls = {
    init(options) {
      root = options.root || document.getElementById("controls-root");
      onMove = options.onMove || onMove;
      onField = options.onField || onField;
      onJump = options.onJump || onJump;
      build();
    },

    show() {
      if (root) root.classList.remove("hidden");
    },

    hide() {
      if (root) root.classList.add("hidden");
    },

    setMode(mode) {
      if (root) root.classList.toggle("platformer", mode === "platformer");
    },

    setFieldMode(mode) {
      if (!fieldBtn) return;
      fieldBtn.classList.toggle("attract", mode === 1);
      fieldBtn.classList.toggle("repel", mode === 2);
      fieldBtn.textContent = mode === 1 ? "attract" : mode === 2 ? "repel" : "field";
    },
  };
})();
