const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { chromium } = require("playwright");

const CONFIG_PATH = path.join(__dirname, "autoclick.config.json");

function resolveMaybeRelative(value) {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return "";
  return path.isAbsolute(cleanValue) ? cleanValue : path.resolve(__dirname, cleanValue);
}

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`Config bulunamadi: ${CONFIG_PATH}`);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  return {
    targetUrl: String(config.targetUrl || "").trim(),
    target: String(config.target || "").trim(),
    intervalMs: Number(config.intervalMs || 800),
    clicksPerLoop: Number(config.clicksPerLoop || 1),
    stopWhenMissing: Boolean(config.stopWhenMissing),
    missLimit: Number(config.missLimit || 20),
    headless: Boolean(config.headless),
    slowMoMs: Number(config.slowMoMs || 0),
    waitForTargetBeforeClick: config.waitForTargetBeforeClick !== false,
    refreshWhenSelector: String(config.refreshWhenSelector || "").trim(),
    refreshWhenText: String(config.refreshWhenText || "").trim(),
    refreshIntervalMs: Number(config.refreshIntervalMs || 5000),
    refreshUntilTargetVisible: config.refreshUntilTargetVisible !== false,
    browserExecutablePath: resolveMaybeRelative(config.browserExecutablePath),
    userDataDir: path.resolve(__dirname, config.userDataDir || "./playwright-profile"),
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function installKeyHandler(stop) {
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) process.stdin.setRawMode(true);

  process.stdin.on("keypress", (_str, key) => {
    if (key?.name === "q" || (key?.ctrl && key?.name === "c")) {
      stop();
    }
  });
}

async function clickTarget(page, selector) {
  const target = await page.evaluate((rawSelector) => {
    function visibleElement(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth
      );
    }

    function textMatches(element, expectedText) {
      const actualText = (element.innerText || element.value || element.textContent || "").trim();
      return actualText.toLowerCase().includes(expectedText.toLowerCase());
    }

    const match = rawSelector.match(/^document\.querySelector\((['"`])([\s\S]+)\1\)$/);
    const selector = match ? match[2] : rawSelector.trim();
    let element = null;

    if (selector.toLowerCase().startsWith("text=")) {
      const expectedText = selector.slice(5).trim();
      element = [...document.querySelectorAll("button, a, [role='button'], input[type='button'], input[type='submit']")]
        .find((candidate) => visibleElement(candidate) && textMatches(candidate, expectedText));
    } else {
      element = document.querySelector(selector);
    }

    if (!element) return { clicked: false, reason: "not-found" };

    element.scrollIntoView({ block: "center", inline: "center" });

    const clickable =
      element.closest("button, a, [role='button'], input, label, [onclick], [tabindex]") || element;

    if (!visibleElement(clickable)) return { clicked: false, reason: "not-visible" };

    const rect = clickable.getBoundingClientRect();
    const x = Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height / 2));

    return {
      clicked: true,
      x,
      y,
      tagName: clickable.tagName,
      className: String(clickable.className || ""),
      text: (clickable.innerText || clickable.value || clickable.textContent || "").trim().slice(0, 80),
    };
  }, selector);

  if (!target.clicked) return target;

  await page.mouse.move(target.x, target.y);
  await page.mouse.down();
  await sleep(35);
  await page.mouse.up();

  return {
    clicked: true,
    x: Math.round(target.x),
    y: Math.round(target.y),
    tagName: target.tagName,
    className: target.className,
    text: target.text,
  };
}

async function getTargetState(page, selector) {
  return page.evaluate((rawSelector) => {
    function visibleElement(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth
      );
    }

    function textMatches(element, expectedText) {
      const actualText = (element.innerText || element.value || element.textContent || "").trim();
      return actualText.toLowerCase().includes(expectedText.toLowerCase());
    }

    const match = rawSelector.match(/^document\.querySelector\((['"`])([\s\S]+)\1\)$/);
    const selector = match ? match[2] : rawSelector.trim();
    let element = null;

    if (selector.toLowerCase().startsWith("text=")) {
      const expectedText = selector.slice(5).trim();
      element = [...document.querySelectorAll("button, a, [role='button'], input[type='button'], input[type='submit']")]
        .find((candidate) => visibleElement(candidate) && textMatches(candidate, expectedText));
    } else {
      element = document.querySelector(selector);
    }

    if (!element) return { visible: false, reason: "not-found" };
    if (!visibleElement(element)) return { visible: false, reason: "not-visible" };
    return { visible: true, reason: "visible" };
  }, selector);
}

async function getRefreshSignal(page, config) {
  if (!config.refreshWhenSelector && !config.refreshWhenText) {
    return { refresh: false, reason: "disabled" };
  }

  return page.evaluate(({ rawSelector, expectedText }) => {
    function normalizeText(value) {
      return String(value || "")
        .replace(/[\u2018\u2019]/g, "'")
        .toLowerCase();
    }

    function visibleElement(element) {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    const normalizedExpected = normalizeText(expectedText);
    const match = rawSelector.match(/^document\.querySelector\((['"`])([\s\S]+)\1\)$/);
    const selector = match ? match[2] : rawSelector.trim();
    const candidates = selector
      ? [...document.querySelectorAll(selector)].filter(visibleElement)
      : [document.body || document.documentElement].filter(Boolean);

    for (const element of candidates) {
      const text = normalizeText(element.innerText || element.textContent || "");
      if (!normalizedExpected || text.includes(normalizedExpected)) {
        return {
          refresh: true,
          reason: "matched",
          text: (element.innerText || element.textContent || "").trim().slice(0, 120),
        };
      }
    }

    return {
      refresh: false,
      reason: candidates.length ? "text-not-found" : "selector-not-found",
    };
  }, {
    rawSelector: config.refreshWhenSelector,
    expectedText: config.refreshWhenText,
  });
}

async function reloadPage(page) {
  await page.bringToFront().catch(() => {});

  try {
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    console.log(`Sayfa yenilendi: ${page.url()}`);
    return;
  } catch (error) {
    console.log(`page.reload basarisiz, location.reload deneniyor: ${error.message}`);
  }

  await page.evaluate(() => {
    window.location.reload();
  });
  await page.waitForLoadState("domcontentloaded", { timeout: 60000 }).catch(() => {});
  console.log(`Sayfa yenileme fallback tamamlandi: ${page.url()}`);
}

async function refreshUntilTargetVisible(page, config, isStopped) {
  let refreshCount = 0;

  while (!isStopped()) {
    refreshCount += 1;
    console.log(`Bekleme yazisi gorundu. Sayfa yenileniyor... (${refreshCount})`);

    await reloadPage(page);
    await sleep(config.refreshIntervalMs);

    const targetState = await getTargetState(page, config.target);
    if (targetState.visible) {
      console.log("Hedef tekrar gorundu. Tiklama dongusune donuluyor.");
      return true;
    }

    if (!config.refreshUntilTargetVisible) {
      console.log(`Hedef henuz yok: ${targetState.reason}`);
      return false;
    }

    console.log(`Hedef henuz yok: ${targetState.reason}. Yenilemeye devam ediliyor.`);
  }

  return false;
}

async function main() {
  const config = readConfig();

  if (!config.target) {
    throw new Error("autoclick.config.json icinde target bos olamaz.");
  }

  let stopped = false;
  const stop = () => {
    stopped = true;
    console.log("\nDurduruluyor...");
  };

  installKeyHandler(stop);

  console.log("Playwright auto click helper basliyor.");
  console.log("Durdurmak icin bu terminalde q veya Ctrl+C bas.");
  console.log(`Target: ${config.target}`);

  if (config.browserExecutablePath && !fs.existsSync(config.browserExecutablePath)) {
    throw new Error(`Chrome bulunamadi: ${config.browserExecutablePath}`);
  }

  const launchOptions = {
    headless: config.headless,
    slowMo: config.slowMoMs,
    viewport: null,
    args: ["--start-maximized"],
  };

  if (config.browserExecutablePath) {
    launchOptions.executablePath = config.browserExecutablePath;
    console.log(`Chrome executable: ${config.browserExecutablePath}`);
  }

  console.log(`Profil klasoru: ${config.userDataDir}`);

  const context = await chromium.launchPersistentContext(config.userDataDir, launchOptions);

  const page = context.pages()[0] || await context.newPage();

  if (config.targetUrl) {
    console.log(`Sayfa aciliyor: ${config.targetUrl}`);
    await page.goto(config.targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  } else {
    console.log("targetUrl bos. Browser icinde hedef sayfaya kendin git, sonra otomasyon devam eder.");
  }

  let missCount = 0;
  let totalClicks = 0;
  let waitingLogAt = 0;

  while (!stopped) {
    try {
      let clickedThisLoop = 0;

      const refreshSignal = await getRefreshSignal(page, config);
      if (refreshSignal.refresh) {
        missCount = 0;
        await refreshUntilTargetVisible(page, config, () => stopped);
        continue;
      }

      for (let i = 0; i < config.clicksPerLoop; i += 1) {
        const result = await clickTarget(page, config.target);
        if (!result.clicked) {
          if (config.waitForTargetBeforeClick && totalClicks === 0) {
            const now = Date.now();
            if (now - waitingLogAt > 3000) {
              console.log(`Hedef bekleniyor: ${result.reason}. Login gerekiyorsa acilan Chrome'da giris yap.`);
              waitingLogAt = now;
            }
            break;
          }

          missCount += 1;
          console.log(`Hedef yok/gorunmuyor: ${result.reason} (${missCount}/${config.missLimit})`);
          break;
        }

        missCount = 0;
        totalClicks += 1;
        clickedThisLoop += 1;
        console.log(`Tiklandi. Toplam: ${totalClicks} (${result.tagName} @ ${result.x},${result.y})`);
        await sleep(80);
      }

      if (config.stopWhenMissing && missCount >= config.missLimit) {
        console.log("Hedef bulunamama limiti doldu. Otomasyon durdu.");
        break;
      }

      if (clickedThisLoop === 0 && !config.stopWhenMissing) {
        await sleep(config.intervalMs);
      } else {
        await sleep(config.intervalMs);
      }
    } catch (error) {
      missCount += 1;
      console.log(`Hata: ${error.message} (${missCount}/${config.missLimit})`);
      if (config.stopWhenMissing && missCount >= config.missLimit) break;
      await sleep(config.intervalMs);
    }
  }

  await context.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
