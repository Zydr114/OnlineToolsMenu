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
    /工具箱\s*\./,
  );
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      document.fonts.check('600 16px "Interface Sans"', "工具箱歌词编辑"),
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
  const trigger = page.getByRole("button", { name: "关于" });
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "Talium", exact: true }),
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
  await expect(page.locator(".geometry-canvas")).toHaveAttribute(
    "data-animating",
    "false",
  );
  const before = await page
    .locator(".geometry-canvas")
    .evaluate((el: HTMLCanvasElement) => el.toDataURL());
  await page.getByRole("button", { name: "变换几何结构" }).click();
  await expect(
    page.getByRole("button", { name: "变换几何结构" }),
  ).toHaveAttribute("aria-pressed", "true");
  const after = await page
    .locator(".geometry-canvas")
    .evaluate((el: HTMLCanvasElement) => el.toDataURL());
  expect(after).not.toBe(before);
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
    await page.getByRole("button", { name: "关于" }).click();
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
  await page.getByRole("link", { name: "查看工具" }).press("Enter");
  await expect(page.locator(".launch-button")).toBeVisible();
  await context.close();
});

test("geometry limits color to red and blue accents and pauses when offscreen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const canvas = page.locator(".geometry-canvas");
  await expect(canvas).toHaveAttribute("data-animating", "true");
  const palette = await canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element
      .getContext("2d")!
      .getImageData(0, 0, element.width, element.height).data;
    let rendered = 0,
      neutral = 0,
      red = 0,
      blue = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (!pixels[i + 3]) continue;
      rendered++;
      if (
        Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
          Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) <
        5
      )
        neutral++;
      if (pixels[i] > pixels[i + 1] + 20 && pixels[i] > pixels[i + 2] + 20)
        red++;
      if (pixels[i + 2] > pixels[i + 1] + 20 && pixels[i + 2] > pixels[i] + 20)
        blue++;
    }
    return { rendered, neutralRatio: neutral / rendered, red, blue };
  });
  expect(palette.rendered).toBeGreaterThan(100);
  expect(palette.neutralRatio).toBeGreaterThan(0.85);
  expect(palette.red).toBeGreaterThan(10);
  expect(palette.blue).toBeGreaterThan(10);
  const snapshot = () =>
    canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  const initial = await snapshot();
  await expect.poll(snapshot).not.toBe(initial);
  await page.locator("footer").scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-animating", "false");
  const paused = await snapshot();
  // Observe a full interval after intersection changed; paused renderers must stay idle.
  await page.waitForTimeout(150);
  expect(await snapshot()).toBe(paused);
  await page.locator(".hero-art").scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-animating", "true");
});

test("tool card opens the application when clicking its visual area", async ({
  page,
}) => {
  await page.route("https://tool.talium.site/MakoLrcStudio/", (route) =>
    route.fulfill({
      body: "<h1>Tool destination</h1>",
      contentType: "text/html",
    }),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = page.locator(".launch-button");
  const bounds = await card.boundingBox();
  await card.click({
    position: { x: bounds!.width * 0.72, y: bounds!.height * 0.7 },
  });
  await expect(page).toHaveURL("https://tool.talium.site/MakoLrcStudio/");
});

test("dragging rotates the knot without switching its shape", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const control = page.getByRole("button", { name: "变换几何结构" });
  const canvas = page.locator(".geometry-canvas");
  await expect(control).toHaveClass(/geometry-ready/);
  const pixels = () =>
    canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL());
  const initial = await pixels();
  const box = (await control.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width * 0.4 + 80,
    box.y + box.height * 0.55 - 30,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(control).toHaveAttribute("aria-pressed", "false");
  expect(await pixels()).not.toBe(initial);
  await expect(canvas).toHaveAttribute("data-animating", "false");
  await control.click();
  await expect(control).toHaveAttribute("aria-pressed", "true");
});

test("dark knot retains sparse red-blue lines and fits inside its canvas", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".geometry-button")).toHaveClass(/geometry-ready/);
  for (let shape = 0; shape < 2; shape++) {
    const palette = await page
      .locator("canvas")
      .evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0,
          blue = 0,
          neutral = 0,
          total = 0,
          edge = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (!data[i + 3]) continue;
          total++;
          if (data[i] > data[i + 1] + 20 && data[i] > data[i + 2] + 20) red++;
          if (data[i + 2] > data[i + 1] + 20 && data[i + 2] > data[i] + 20)
            blue++;
          if (
            Math.max(data[i], data[i + 1], data[i + 2]) -
              Math.min(data[i], data[i + 1], data[i + 2]) <
            5
          )
            neutral++;
          const x = (i / 4) % canvas.width,
            y = Math.floor(i / 4 / canvas.width);
          if (x < 8 || x > canvas.width - 9 || y < 8 || y > canvas.height - 9)
            edge++;
        }
        return { red, blue, neutralRatio: neutral / total, edge };
      });
    expect(palette.red).toBeGreaterThan(10);
    expect(palette.blue).toBeGreaterThan(10);
    expect(palette.neutralRatio).toBeGreaterThan(0.85);
    expect(palette.edge).toBe(0);
    if (!shape)
      await page.getByRole("button", { name: "变换几何结构" }).click();
  }
});
