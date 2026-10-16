import { createGeometry } from "./geometry";

const root = document.documentElement;
const $ = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
const systemMotion = matchMedia("(prefers-reduced-motion: reduce)");
let geometry: ReturnType<typeof createGeometry>;

function readPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function savePreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Non-persistent mode remains usable. */
  }
}

let manualTheme = readPreference("talium-theme");
let manualMotion = readPreference("talium-motion");
const isDark = () =>
  manualTheme === "dark" || (manualTheme !== "light" && systemTheme.matches);
const motionEnabled = () =>
  manualMotion === "on" || (manualMotion !== "off" && !systemMotion.matches);

function syncTheme() {
  const dark = isDark();
  root.classList.toggle("is-dark", dark);
  if (manualTheme === "light" || manualTheme === "dark")
    root.dataset.theme = manualTheme;
  else delete root.dataset.theme;
  const label = `切换到${dark ? "浅" : "深"}色模式`;
  const button = $(".theme-toggle");
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  $('meta[name="theme-color"]').setAttribute(
    "content",
    dark ? "#0a0a0a" : "#fafafa",
  );
  geometry?.refresh();
}
function syncMotion() {
  root.dataset.motion = motionEnabled() ? "on" : "off";
  $(".motion-toggle").setAttribute("aria-pressed", String(motionEnabled()));
  $(".motion-toggle").setAttribute(
    "aria-label",
    motionEnabled() ? "动效已开启" : "动效已关闭",
  );
  $(".motion-toggle").setAttribute(
    "title",
    motionEnabled() ? "关闭动效" : "开启动效",
  );
  geometry?.refresh();
}
syncTheme();
syncMotion();
systemTheme.addEventListener("change", syncTheme);
systemMotion.addEventListener("change", syncMotion);
window.addEventListener("storage", (event) => {
  if (event.key === "talium-theme" || event.key === null) {
    manualTheme = readPreference("talium-theme");
    syncTheme();
  }
  if (event.key === "talium-motion" || event.key === null) {
    manualMotion = readPreference("talium-motion");
    syncMotion();
  }
});

let themeTransition: ViewTransition | undefined;
$(".theme-toggle").addEventListener("click", (event: MouseEvent) => {
  manualTheme = isDark() ? "light" : "dark";
  savePreference("talium-theme", manualTheme);
  if (!document.startViewTransition || !motionEnabled()) {
    syncTheme();
    return;
  }
  themeTransition?.skipTransition();
  const button = $(".theme-toggle").getBoundingClientRect();
  const x = event.detail ? event.clientX : button.left + button.width / 2;
  const y = event.detail ? event.clientY : button.top + button.height / 2;
  const radius = Math.hypot(
    Math.max(x, innerWidth - x),
    Math.max(y, innerHeight - y),
  );
  const transition = document.startViewTransition(syncTheme);
  themeTransition = transition;
  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 680,
          easing: "cubic-bezier(.22,1,.36,1)",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      /* A rapid second click can intentionally skip the previous transition. */
    });
});
$(".motion-toggle").addEventListener("click", () => {
  manualMotion = motionEnabled() ? "off" : "on";
  savePreference("talium-motion", manualMotion);
  syncMotion();
});
$("#year").textContent = String(new Date().getFullYear());

const art = $(".hero-art");
const card = $(".tool-card");
geometry = createGeometry($(".geometry-canvas"), $(".geometry-button"), {
  motion: motionEnabled,
  dark: isDark,
});
const waveform = $(".waveform");
for (let index = 0; index < 90; index++) {
  const bar = document.createElement("i");
  const envelope = 0.3 + 0.7 * Math.abs(Math.sin(index * 0.137));
  const height =
    12 +
    77 * envelope * Math.abs(Math.sin(index * 1.71) * Math.cos(index * 0.47));
  bar.style.setProperty("--bar-height", `${height}%`);
  bar.style.setProperty("--bar-delay", `${-index * 0.12}s`);
  waveform.appendChild(bar);
}
document
  .querySelectorAll<HTMLElement>(".signal-segments > i")
  .forEach((segment, index) =>
    segment.style.setProperty("--segment-index", String(index)),
  );

const search = $<HTMLDialogElement>(".search-dialog");
const input = $<HTMLInputElement>("#tool-search");
const result = $<HTMLAnchorElement>(".search-result");
let searchReturnFocus: HTMLElement | null = null;
const searchableText =
  `${card.dataset.toolTitle} ${card.dataset.toolKeywords}`.toLocaleLowerCase();
function updateSearch() {
  const words = input.value
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const matched = words.every((word) => searchableText.includes(word));
  result.hidden = !matched;
  $(".search-empty").hidden = matched;
  $("#result-count").textContent = `${matched ? 1 : 0} 个工具`;
  $(".search-announcement").textContent = matched
    ? "找到 1 个工具：MakoLrc Studio"
    : "没有匹配的工具";
}
function openSearch() {
  if (document.querySelector("dialog[open]")) return;
  const active = document.activeElement;
  searchReturnFocus =
    active instanceof HTMLElement &&
    active !== document.body &&
    !active.closest("dialog")
      ? active
      : $(".search-trigger");
  input.value = "";
  updateSearch();
  search.showModal();
  input.focus();
}
search.addEventListener("close", () => searchReturnFocus?.focus());
document
  .querySelectorAll(".search-trigger, .collection-search")
  .forEach((button) => button.addEventListener("click", openSearch));
input.addEventListener("input", updateSearch);
search.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" && !result.hidden) {
    event.preventDefault();
    result.focus();
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    input.focus();
  } else if (
    event.key === "Enter" &&
    document.activeElement === input &&
    !result.hidden &&
    !event.isComposing
  ) {
    event.preventDefault();
    result.click();
  }
});
const about = $<HTMLDialogElement>(".about-dialog");
$("[data-about-open]").addEventListener("click", () => about.showModal());
document.querySelectorAll<HTMLDialogElement>("dialog").forEach((dialog) => {
  dialog
    .querySelector(".dialog-close")
    ?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !event.isComposing) {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });
});
document.addEventListener("keydown", (event) => {
  if (event.isComposing || event.altKey) return;
  const target = event.target as HTMLElement;
  const editing =
    target.isContentEditable ||
    (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) &&
      !target.closest("dialog:not([open])"));
  if (
    (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) ||
    (event.key === "/" && !editing && !event.metaKey && !event.ctrlKey)
  ) {
    event.preventDefault();
    if (search.open) search.close();
    else openSearch();
  }
});

// Content is visible without JavaScript. Progressive reveals only start after observing succeeds.
if ("IntersectionObserver" in window) {
  const reveals = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        reveals.unobserve(entry.target);
      }
    },
    { threshold: 0.08 },
  );
  document
    .querySelectorAll(".reveal")
    .forEach((element) => reveals.observe(element));
  root.classList.add("js-ready");
  const animationVisibility = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        entry.target.classList.toggle("offscreen", !entry.isIntersecting);
        if (entry.target === art) geometry?.setVisible(entry.isIntersecting);
      }
    },
    { rootMargin: "60px" },
  );
  animationVisibility.observe(card);
  animationVisibility.observe(art);
}
document.addEventListener("visibilitychange", () =>
  root.classList.toggle("is-paused", document.hidden),
);
