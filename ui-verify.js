const fs = require('fs');
const { chromium } = require('playwright');

function readDeployUrl() {
  try { return fs.readFileSync('/workspace/.deploy_url', 'utf8').trim(); } catch { return ''; }
}
function readEnvFile(path) {
  const env = {};
  try {
    for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
      if (!line || /^\s*#/.test(line)) continue;
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2];
    }
  } catch {}
  return env;
}
function sameOrigin(url, base) {
  try { return new URL(url, base).origin === new URL(base).origin; } catch { return false; }
}

(async () => {
  const reasons = [];
  const deployUrl = readDeployUrl();
  if (!deployUrl) {
    console.log('UI_VERIFY: FAIL | /workspace/.deploy_url empty');
    return;
  }
  const env = readEnvFile('/workspace/.env.production');
  const configuredUser = env.ADMIN_USERNAME;
  const configuredPass = env.ADMIN_PASSWORD;
  const consoleErrors = [];
  const failedRequests = [];
  const badResponses = [];
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('requestfailed', req => {
      failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText || 'requestfailed'}`);
    });
    page.on('response', res => {
      const status = res.status();
      const url = res.url();
      if (status >= 400 && sameOrigin(url, deployUrl)) badResponses.push(`${status} ${url}`);
    });

    const response = await page.goto(deployUrl, { waitUntil: 'networkidle', timeout: 30000 });
    if (!response) reasons.push('root navigation produced no response');
    else if (response.status() >= 400) reasons.push(`root returned HTTP ${response.status()}`);

    const bodyText = (await page.locator('body').innerText({ timeout: 10000 }).catch(() => '')).trim();
    if (bodyText.length < 80) reasons.push('root page lacks meaningful body content');
    if (/DEPLOYMENT READY|user app is online|The Sprite service is serving|MONOREPO INITIALIZED|ready for feature work/i.test(bodyText)) {
      reasons.push('root page appears to be a placeholder/scaffold');
    }
    if (!/Official Blog|Recent articles|newsletter|Ideavibes/i.test(bodyText)) {
      reasons.push('root page content does not match expected blog UI');
    }

    const styleInfo = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const header = document.querySelector('header');
      const h1 = document.querySelector('h1');
      const button = document.querySelector('button, .editorial-button');
      const headerStyle = header ? getComputedStyle(header) : null;
      const h1Style = h1 ? getComputedStyle(h1) : null;
      const buttonStyle = button ? getComputedStyle(button) : null;
      return {
        bodyBg: body.backgroundColor,
        font: body.fontFamily,
        headerDisplay: headerStyle?.display || '',
        h1Size: h1Style?.fontSize || '',
        buttonRadius: buttonStyle?.borderRadius || '',
        cssLinks: Array.from(document.styleSheets).length,
      };
    });
    if (!styleInfo.cssLinks) reasons.push('no stylesheets are loaded');
    if (styleInfo.bodyBg === 'rgba(0, 0, 0, 0)' && !styleInfo.font) reasons.push('computed styles look unstyled');
    const h1Px = parseFloat(styleInfo.h1Size || '0');
    if (!h1Px || h1Px < 24) reasons.push(`heading style not applied (font-size=${styleInfo.h1Size})`);

    const wm = page.locator('#mctai-watermark');
    if (await wm.count() !== 1) reasons.push('watermark is missing or duplicated');
    else {
      const wmText = await wm.innerText();
      if (!wmText.includes('Built by Ideavibes.ai') || !wmText.includes('Share')) reasons.push('watermark/share text incorrect');
      const href = await wm.locator('a').first().getAttribute('href').catch(() => '');
      if (href !== 'https://ideavibes.ai') reasons.push('watermark link target incorrect');
    }

    // Click same-origin header/nav links and verify they render non-error HTML.
    const navLinks = await page.locator('header a, nav a').evaluateAll((els) => els.map(a => ({ text: a.textContent.trim(), href: a.href })).filter(x => x.href));
    let clickedInternal = 0;
    for (const link of navLinks) {
      if (!sameOrigin(link.href, deployUrl)) continue;
      clickedInternal += 1;
      const navResp = await page.goto(link.href, { waitUntil: 'networkidle', timeout: 30000 });
      if (!navResp || navResp.status() >= 500) reasons.push(`navigation link failed: ${link.text || link.href}`);
      const txt = (await page.locator('body').innerText().catch(() => '')).trim();
      if (txt.length < 30 || /404 page not found|Application error/i.test(txt)) reasons.push(`navigation link rendered an error/blank page: ${link.text || link.href}`);
    }
    if (clickedInternal === 0) reasons.push('no same-origin navigation links found to verify');

    await page.goto(`${deployUrl.replace(/\/$/, '')}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
    const adminLoggedOutText = await page.locator('body').innerText().catch(() => '');
    if (/log out/i.test(adminLoggedOutText)) reasons.push('logged-out admin page shows logout');
    if (!/sign in|username|password/i.test(adminLoggedOutText)) reasons.push('admin login UI is missing or incoherent');

    if (!configuredUser || !configuredPass) {
      reasons.push('configured admin credentials missing from env file');
    } else {
      await page.fill('input[name="username"]', configuredUser);
      await page.fill('input[name="password"]', configuredPass);
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => null),
        page.click('button[type="submit"]'),
      ]);
      const afterLogin = await page.locator('body').innerText().catch(() => '');
      if (!/Posts|New post|Log out|Subscribers/i.test(afterLogin) || /Invalid admin credentials/i.test(afterLogin)) {
        reasons.push('configured admin login failed or did not reach dashboard');
      }
      if (!/Log out/i.test(afterLogin)) reasons.push('authenticated admin dashboard lacks logout control');
      await page.screenshot({ path: '/workspace/verify-screenshot.png', fullPage: true });
      // Log out before default credential probes.
      const logout = page.locator('form[action="/admin/logout"] button, button:has-text("Log out")').first();
      if (await logout.count()) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => null),
          logout.click(),
        ]);
      }
    }

    const defaultCreds = [
      ['admin', 'admin'],
      ['admin', 'password'],
      ['admin', 'change-me'],
      ['admin', 'changeme'],
      ['admin@example.com', 'password'],
    ];
    for (const [u, p] of defaultCreds) {
      const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const pge = await c.newPage();
      try {
        await pge.goto(`${deployUrl.replace(/\/$/, '')}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
        await pge.fill('input[name="username"]', u);
        await pge.fill('input[name="password"]', p);
        await Promise.all([
          pge.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => null),
          pge.click('button[type="submit"]'),
        ]);
        const text = await pge.locator('body').innerText().catch(() => '');
        if (/Log out|New post|Subscribers/i.test(text) && !/Invalid admin credentials/i.test(text)) {
          reasons.push(`insecure default admin credential accepted for ${u}`);
        }
      } finally {
        await c.close();
      }
    }

    await page.goto(deployUrl, { waitUntil: 'networkidle', timeout: 30000 });
    if (!fs.existsSync('/workspace/verify-screenshot.png')) {
      await page.screenshot({ path: '/workspace/verify-screenshot.png', fullPage: true });
    }

    const relevantBad = badResponses.filter(x => !/\/admin\/login/.test(x));
    if (consoleErrors.length) reasons.push(`console errors: ${consoleErrors.slice(0, 3).join('; ')}`);
    if (failedRequests.length) reasons.push(`failed network requests: ${failedRequests.slice(0, 3).join('; ')}`);
    if (relevantBad.some(x => /^5/.test(x))) reasons.push(`5xx responses: ${relevantBad.filter(x => /^5/.test(x)).slice(0, 3).join('; ')}`);

    if (reasons.length) console.log(`UI_VERIFY: FAIL | ${[...new Set(reasons)].join(' | ')}`);
    else console.log('UI_VERIFY: PASS');
  } catch (err) {
    console.log(`UI_VERIFY: FAIL | ${err && err.message ? err.message : String(err)}`);
  } finally {
    await browser.close();
  }
})();
