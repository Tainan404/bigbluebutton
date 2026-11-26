import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import { existsSync, readdirSync } from 'fs';
import os from 'os';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const fixtureDir = process.env.CAMERA_EFFECTS_FIXTURE_DIR ?? '/tmp/ephemeral/camera-effects-fixtures';
const firefoxExecutable = readdirSync(path.join(os.homedir(), '.cache/ms-playwright'))
  .filter((entry) => entry.startsWith('firefox-'))
  .sort()
  .reverse()
  .map((entry) => path.join(os.homedir(), '.cache/ms-playwright', entry, 'firefox/firefox'))
  .find(existsSync);
const chromiumArgs = (fixture: string) => [
  '--no-sandbox',
  '--ignore-certificate-errors',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
  '--allow-file-access-from-files',
  '--use-angle=swiftshader',
  `--use-file-for-fake-video-capture=${path.join(fixtureDir, fixture)}`,
];

export default defineConfig({
  testDir: __dirname,
  testMatch: /cameraEffects\.perf\.ts/,
  workers: 1,
  timeout: 4 * 60 * 1000,
  reporter: [['list']],
  use: { headless: true, screenshot: 'off', trace: 'off', video: 'off', actionTimeout: 30000 },
  projects: [
    {
      name: 'chromium-medium-swiftshader',
      metadata: { profile: 'medium', engine: 'chromium', acceleration: 'swiftshader' },
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        launchOptions: { args: chromiumArgs('talking-head-640x480.y4m') },
      },
    },
    {
      name: 'chromium-hd-swiftshader',
      metadata: { profile: 'hd', engine: 'chromium', acceleration: 'swiftshader' },
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        launchOptions: { args: chromiumArgs('talking-head-1280x720.y4m') },
      },
    },
    {
      name: 'firefox-medium',
      metadata: { profile: 'medium', engine: 'firefox', acceleration: 'software' },
      use: {
        ...devices['Desktop Firefox'],
        browserName: 'firefox',
        launchOptions: {
          executablePath: firefoxExecutable,
          args: ['--quiet', '--use-test-media-devices'],
          firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true },
        },
      },
    },
    {
      name: 'firefox-hd',
      metadata: { profile: 'hd', engine: 'firefox', acceleration: 'software' },
      use: {
        ...devices['Desktop Firefox'],
        browserName: 'firefox',
        launchOptions: {
          executablePath: firefoxExecutable,
          args: ['--quiet', '--use-test-media-devices'],
          firefoxUserPrefs: { 'media.navigator.streams.fake': true, 'media.navigator.permission.disabled': true },
        },
      },
    },
  ],
});
