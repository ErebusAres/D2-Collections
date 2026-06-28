(() => {
  const STORAGE_KEY = "d2-collections-layout-mode-v1";
  const MODES = new Set(["detailed", "simple"]);
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll("[data-layout-mode]")];

  function readMode() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return MODES.has(saved) ? saved : "detailed";
    } catch {
      return "detailed";
    }
  }

  function applyMode(mode) {
    const next = MODES.has(mode) ? mode : "detailed";
    root.classList.toggle("layout-simple", next === "simple");
    root.classList.toggle("layout-detailed", next !== "simple");
    buttons.forEach(button => {
      const active = button.dataset.layoutMode === next;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  }

  buttons.forEach(button => {
    button.addEventListener("click", () => applyMode(button.dataset.layoutMode));
  });

  applyMode(readMode());
})();
