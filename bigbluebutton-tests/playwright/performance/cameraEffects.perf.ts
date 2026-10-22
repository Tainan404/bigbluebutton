import { type Browser, chromium, test } from '@playwright/test';
import { appendFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';

import { Page as BBBPage } from '../core/page';
import { trackPeerConnections } from '../core/rtcStatsProbe';
import { installCameraEffectsProbe, measureBrowserProbe } from './cameraEffectsProbe';

const effects = ['none', 'blur', 'image', 'brightness'] as const;
const repetitions = Number(process.env.CAMERA_EFFECTS_REPETITIONS ?? 3);
const warmUpMs = Number(process.env.CAMERA_EFFECTS_WARMUP_MS ?? 5000);
const measureMs = Number(process.env.CAMERA_EFFECTS_MEASURE_MS ?? 15000);
const outputDir = process.env.CAMERA_EFFECTS_OUTPUT_DIR ?? '/tmp/ephemeral/camera-effects-baseline';

async function selectEffect(page: import('@playwright/test').Page, effect: (typeof effects)[number], profile: string) {
  const audioModal = page.locator('div[data-testid="audioModal"]');
  if (await audioModal.isVisible()) await audioModal.getByRole('button', { name: /Close/ }).click();
  await page.locator('button[data-test="joinVideo"]').click();
  await page.locator('select#setQuality').selectOption(profile === 'hd' ? 'high' : 'medium');
  await page.locator('span#backgrounds-title').click();
  if (effect === 'none' || effect === 'brightness')
    await page.locator('button[data-test="noneBackgroundButton"]').click();
  if (effect === 'blur') await page.locator('button[aria-label="Blur"]').click();
  if (effect === 'image') await page.locator('button[data-test="selectDefaultBackground"][aria-label="Home"]').click();
  if (effect === 'brightness') {
    await page.locator('span#webcam-settings-title').click();
    const input = page.locator('input#brightness');
    await input.evaluate((element) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(element, '150');
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('input[aria-label="Whole image"]').check();
  }
  await page.locator('button[data-test="startSharingWebcam"]').click();
  await page.locator('video[data-local-stream="true"]').waitFor({ state: 'visible', timeout: 60000 });
}

for (const effect of effects) {
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    test(`${effect} repetition ${repetition}`, async ({ browser, context, page, browserName }, testInfo) => {
      await mkdir(outputDir, { recursive: true });
      await installCameraEffectsProbe(context);
      await trackPeerConnections(context);
      const metadata = testInfo.project.metadata as { profile: string; engine: string; acceleration: string };
      const moderator = new BBBPage(browser, page, testInfo);
      await moderator.init(true, { testInfo, shouldCloseAudioModal: false });

      let viewerBrowser: Browser | null = null;
      if (browserName === 'chromium') {
        viewerBrowser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--ignore-certificate-errors'],
        });
        const viewerContext = await viewerBrowser.newContext();
        const viewerPage = await viewerContext.newPage();
        const viewer = new BBBPage(viewerBrowser, viewerPage, testInfo);
        await viewer.init(false, {
          meetingId: moderator.meetingId,
          fullName: 'Benchmark viewer',
          testInfo,
          shouldCloseAudioModal: false,
        });
      }

      await selectEffect(page, effect, metadata.profile);
      await page.waitForTimeout(warmUpMs);
      const cdp = browserName === 'chromium' ? await context.newCDPSession(page) : null;
      const browserCdp = browserName === 'chromium' ? await browser.newBrowserCDPSession() : null;
      if (cdp) await cdp.send('Performance.enable');
      const metrics = await measureBrowserProbe(page, cdp, browserCdp, measureMs);
      const renderer = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl');
        const ext = gl?.getExtension('WEBGL_debug_renderer_info');
        return ext ? gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable';
      });
      const snapshot = path.join(outputDir, `${testInfo.project.name}-${effect}-r${repetition}.png`);
      await page.locator('video[data-local-stream="true"]').screenshot({ path: snapshot });
      const record = {
        project: testInfo.project.name,
        ...metadata,
        effect,
        repetition,
        warmUpMs,
        measureMs,
        renderer,
        metrics,
        snapshot,
        measuredAt: new Date().toISOString(),
      };
      await appendFile(path.join(outputDir, 'raw-results.jsonl'), `${JSON.stringify(record)}\n`);
      await writeFile(`${snapshot}.json`, JSON.stringify(record, null, 2));
      await viewerBrowser?.close();
    });
  }
}
