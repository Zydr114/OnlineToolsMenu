import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("production entry has no broken local assets or browser errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (
      response.url().startsWith(new URL(page.url()).origin) &&
      response.status() >= 400
    )
      errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /小工具，\s*大有\s*可为\s*。/,
  );
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      document.fonts.check('600 16px "Workshop Sans"', "小工具大有可为"),
    ),
  ).toBe(true);
  await expect(page.locator(".launch-button")).toHaveAttribute(
    "href",
    "https://tool.talium.site/MakoLrcStudio/",
  );
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("theme follows system, can be changed and survives reload", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/is-dark/);
  await page.getByRole("button", { name: "切换到浅色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "切换到深色模式" }),
  ).toBeVisible();
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByRole("button", { name: "切换到深色模式" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("keyboard search matches keywords and handles empty and multiword queries", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Control+k");
  const input = page.getByRole("searchbox");
  await expect(input).toBeFocused();
  await input.fill("TTML");
  await expect(page.locator(".search-result")).toBeVisible();
  await input.fill("Mako 逐字");
  await expect(page.locator("#result-count")).toHaveText("1 个工具");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".search-result")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(input).toBeFocused();
  await input.fill("no such tool");
  await expect(page.locator(".search-result")).toBeHidden();
  await expect(page.locator(".search-empty")).toBeVisible();
  await input.fill("    ");
  await expect(page.locator(".search-result")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.keyboard.press("/");
  await expect(input).toBeFocused();
});

test("search opens the real tool on Enter", async ({ page }) => {
  await page.route("https://tool.talium.site/MakoLrcStudio/", (route) =>
    route.fulfill({
      body: "<h1>Tool destination</h1>",
      contentType: "text/html",
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "搜索工具", exact: true })
    .first()
    .click();
  await page.getByRole("searchbox").fill("歌词");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("https://tool.talium.site/MakoLrcStudio/");
});

test("dialogs restore focus and close using Escape and backdrop", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "关于这里" });
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: /一些小工具，\s*一点创造力。/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.mouse.click(5, 5);
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("button", { name: "搜索工具", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "关闭搜索" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
});

test("reduced motion is respected, can be toggled, and persists", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const motion = page.getByRole("button", { name: "动效已关闭" });
  await expect(motion).toHaveAttribute("aria-pressed", "false");
  expect(
    await page
      .locator(".bloom")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "绽放灵感花朵" }).click();
  await expect(page.locator(".toast")).toHaveText("灵感，在这里生长。");
  await motion.click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "动效已开启" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("preferences sync between tabs and localStorage failures remain usable", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const second = await context.newPage();
  await second.goto("/");
  await page.getByRole("button", { name: "切换到深色模式" }).click();
  await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");
  await second.close();
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Blocked");
    };
  });
  await page.reload();
  await page.getByRole("button", { name: "切换到深色模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const width of [320, 390, 768, 1440]) {
  test(`responsive layout has no horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(".launch-button").scrollIntoViewIfNeeded();
    await expect(page.locator(".launch-button")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const heading = await page.locator(".tool-info h3").boundingBox();
    const parent = await page.locator(".tool-info").boundingBox();
    expect(heading!.x + heading!.width).toBeLessThanOrEqual(
      parent!.x + parent!.width,
    );
    await page.screenshot({
      path: `artifacts/screenshots/${test.info().project.name}-${width}.png`,
      fullPage: true,
      animations: "disabled",
    });
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} theme and dialogs pass WCAG AA automated checks`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    const scan = () =>
      new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
    expect((await scan()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "搜索工具", exact: true })
      .first()
      .click();
    expect((await scan()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "关于这里" }).click();
    expect((await scan()).violations).toEqual([]);
  });
}

test("primary navigation remains useful with JavaScript disabled", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(process.env.TEST_BASE_URL || "http://127.0.0.1:4173");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "探索工具" }).press("Enter");
  await expect(page.locator(".launch-button")).toBeVisible();
  await context.close();
});
