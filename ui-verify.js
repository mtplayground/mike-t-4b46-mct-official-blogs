const fs = require('fs');
const { chromium } = require('playwright');

function readEnv(path) {
  const out = {};
  if (!fs.existsSync(path)) return out;
  for (const raw of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

(async () => {
  const deployUrl = fs.readFileSync('/workspace/.deploy_url', 'utf8').trim();
  if (!deployUrl) {
    console.log('UI_VERIFY: FAIL | /workspace/.deploy_url empty');
    return;
  }
  const env = readEnv('/workspace/.env.production');
  const failures = [];
  const consoleErrors = [];
  const failedRequests = [];
  const badResponses = [];
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('requestfailed', req => {
    failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText || ''}`);
  });
  page.on('response', res => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !url.includes('/api/admin/login')) {
      badResponses.push(`${status} ${url}`);
    }
  });

  try {
    const resp = await page.goto(deployUrl + '/', { waitUntil: 'networkidle', timeout: 30000 });
    if (!resp || resp.status() !== 200) failures.push(`root status ${resp ? resp.status() : 'no response'}`);
    await page.screenshot({ path: '/workspace/verify-screenshot.png', fullPage: true });

    const bodyText = (await page.locator('body').innerText({ timeout: 5000 })).trim();
    if (bodyText.length < 100) failures.push('root page has little meaningful content');
    if (/DEPLOYMENT READY|myClawTeam user app is online|The Sprite service is serving|MONOREPO INITIALIZED|ready for feature work/i.test(bodyText)) {
      failures.push('root page shows placeholder/scaffold content');
    }
    if (!/myClawTeam Official Blogs|Latest Articles|Featured Article|Read the official journal/i.test(bodyText)) {
      failures.push('expected blog content not found');
    }
    if (/logout|sign out/i.test(bodyText)) failures.push('logged-out public page shows logout/sign out');

    const styleCheck = await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      const h1 = document.querySelector('h1');
      const button = document.querySelector('.editorial-button');
      const header = document.querySelector('header');
      const h1Style = h1 ? getComputedStyle(h1) : null;
      const buttonStyle = button ? getComputedStyle(button) : null;
      const headerStyle = header ? getComputedStyle(header) : null;
      return {
        bodyBg: body.backgroundColor,
        h1FontSize: h1Style ? parseFloat(h1Style.fontSize) : 0,
        h1Family: h1Style ? h1Style.fontFamily : '',
        buttonBg: buttonStyle ? buttonStyle.backgroundColor : '',
        headerBorder: headerStyle ? headerStyle.borderBottomWidth : '',
      };
    });
    if (styleCheck.h1FontSize < 32) failures.push(`CSS not convincingly applied: h1 font size ${styleCheck.h1FontSize}`);
    if (!/rgb\(232, 71, 43\)|#e8472b/i.test(styleCheck.buttonBg)) failures.push(`CSS not applied to CTA button background (${styleCheck.buttonBg})`);
    if (styleCheck.headerBorder === '0px') failures.push('CSS header border not applied');

    const homeLink = page.getByRole('link', { name: /^Home$/ }).first();
    if (await homeLink.count()) {
      await homeLink.click();
      await page.waitForURL(/\/$/, { timeout: 10000 }).catch(() => failures.push('Home nav did not load /'));
    } else {
      failures.push('Home navigation link missing');
    }

    const adminLink = page.getByRole('link', { name: /^Admin$/ }).first();
    if (await adminLink.count()) {
      await adminLink.click();
      await page.waitForURL(/\/admin(\/login)?/, { timeout: 15000 }).catch(() => failures.push('Admin nav did not load admin area'));
      const adminText = await page.locator('body').innerText().catch(() => '');
      if (!/Sign in to manage the blog|Username|Password/i.test(adminText)) failures.push('admin unauthenticated UI is not coherent login page');
      if (/Sign out/i.test(adminText)) failures.push('admin login page shows sign out before login');
    } else {
      failures.push('Admin navigation link missing');
    }

    async function attemptLogin(username, password) {
      await page.goto(deployUrl + '/admin/login', { waitUntil: 'networkidle', timeout: 30000 });
      await page.getByLabel(/username/i).fill(username);
      await page.getByLabel(/password/i).fill(password);
      await Promise.all([
        page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
        page.getByRole('button', { name: /sign in/i }).click(),
      ]);
      await page.waitForTimeout(1000);
      return { url: page.url(), text: await page.locator('body').innerText().catch(() => '') };
    }

    if (env.ADMIN_USERNAME && env.ADMIN_PASSWORD) {
      const configured = await attemptLogin(env.ADMIN_USERNAME, env.ADMIN_PASSWORD);
      if (!/\/admin(?:\?|$)/.test(new URL(configured.url).pathname + new URL(configured.url).search) || !/Post dashboard|New post|Subscribers|Sign out/i.test(configured.text)) {
        failures.push('configured admin login failed');
      }
    } else {
      failures.push('configured admin credentials unavailable for login check');
    }

    // Clear session before probing insecure defaults.
    await context.clearCookies();
    const defaults = [
      ['admin', 'change-me'],
      ['admin', 'admin'],
      ['admin', 'password'],
      ['administrator', 'password'],
      ['test', 'test'],
    ];
    for (const [u, p] of defaults) {
      if (u === env.ADMIN_USERNAME && p === env.ADMIN_PASSWORD) continue;
      const result = await attemptLogin(u, p);
      if (/Post dashboard|New post|Subscribers|Sign out/i.test(result.text) && /\/admin/.test(result.url) && !/\/admin\/login/.test(result.url)) {
        failures.push(`insecure default credentials accepted (${u}/${p})`);
        break;
      }
      await context.clearCookies();
    }

    if (consoleErrors.length) failures.push(`console errors: ${consoleErrors.slice(0, 3).join(' ; ')}`);
    if (failedRequests.length) failures.push(`failed network requests: ${failedRequests.slice(0, 3).join(' ; ')}`);
    if (badResponses.length) failures.push(`HTTP error responses: ${badResponses.slice(0, 5).join(' ; ')}`);
  } catch (err) {
    failures.push(`verification exception: ${err.message}`);
  } finally {
    await browser.close();
  }

  if (failures.length) console.log(`UI_VERIFY: FAIL | ${failures.join(' | ')}`);
  else console.log('UI_VERIFY: PASS');
})();
