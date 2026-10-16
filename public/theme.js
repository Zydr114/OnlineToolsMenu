(() => {
  try {
    const theme = localStorage.getItem("talium-theme");
    if (theme === "light" || theme === "dark")
      document.documentElement.dataset.theme = theme;
    const motion = localStorage.getItem("talium-motion");
    if (motion === "off") document.documentElement.dataset.motion = "off";
  } catch {
    /* The page also works when browser storage is unavailable. */
  }
})();
