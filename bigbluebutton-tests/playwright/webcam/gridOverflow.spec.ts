import { expect } from '@playwright/test';
import { test } from '../core/setup/fixtures';
import { MultiUsers } from '../user/multiusers';
import { Page } from '../core/page';
import { elements as e } from '../core/elements';

// Regression test for the Unified Layout webcam grid overflow bug
// (backport of bigbluebutton/bigbluebutton#25103, issue #25073).
//
// When the presentation is minimized in the unified layout, participants are
// shown as a tile grid. Above the grid limit (gridSize), the surplus is
// aggregated into a single "+X" overflow tile. The invariant that must hold:
//
//     (visible tiles) + (aggregated overflow count) === (total grid participants)
//
// Before the fix the component dropped only the LAST grid user to make room for
// the overflow tile, so the visible tile count and the aggregated count did not
// add up to the participant total. The fix caps both the grid item count and the
// overflow slicing by gridSize.
//
// REQUIRES a small webcam grid size on the server so the overflow tile appears
// with only a handful of users. Set before running:
//   yq -i '.public.kurento.pagination.desktopGridSizes.moderator = 4' /etc/bigbluebutton/bbb-html5.yml
//   yq -i '.public.kurento.pagination.desktopGridSizes.viewer = 4'    /etc/bigbluebutton/bbb-html5.yml
// (the test reads the real gridSize from the client, so any small value works as
// long as TOTAL_USERS strictly exceeds it).
const TOTAL_USERS = 6;

test.describe('Webcam unified layout grid overflow', () => {
  test('visible tiles plus aggregated overflow equals total participants', async ({
    browser,
    context,
    page,
  }, testInfo) => {
    const m = new MultiUsers(browser, context);

    // Moderator creates the meeting and shares a webcam.
    await m.initModPage(page, { fullName: 'Mod', testInfo });
    await m.modPage.shareWebcam();

    // Remaining viewers join the same meeting and share a webcam each, so every
    // participant is a tile in the grid.
    const extraPages: Page[] = [];
    for (let i = 1; i < TOTAL_USERS; i += 1) {
      const userBrowserPage = await context.newPage();
      const userPage = new Page(browser, userBrowserPage, m.modPage.testInfo);
      await userPage.init(false, { fullName: `User${i}`, meetingId: m.modPage.meetingId });
      await userPage.shareWebcam();
      extraPages.push(userPage);
    }

    // Read the grid size actually applied by the client.
    const gridSize: number = await m.modPage.page.evaluate(
      () => window.meetingClientSettings.public.kurento.pagination.desktopGridSizes.moderator,
    );
    expect(
      TOTAL_USERS,
      `this test needs more participants than the configured gridSize (${gridSize}) to force an overflow tile`,
    ).toBeGreaterThan(gridSize);

    // Switch to the unified/video-focus layout and minimize the presentation so
    // the participants fill the screen as a grid.
    await m.modPage.waitAndClick(e.optionsButton);
    await m.modPage.waitAndClick(e.manageLayoutBtn);
    await m.modPage.waitAndClick(e.focusOnVideo);
    await m.modPage.waitAndClick(e.updateLayoutBtn);
    await m.modPage.closeAllToastNotifications();

    // The overflow tile must be present (more participants than gridSize).
    await m.modPage.page.locator(e.overflowTile).first().waitFor({ state: 'visible' });

    const visibleTiles = await m.modPage.getSelectorCount(e.webcamVideoItem);
    const overflowText = (await m.modPage.page.locator(e.overflowTile).first().textContent()) ?? '';
    const overflowCount = parseInt((overflowText.match(/\+(\d+)/) ?? ['', '0'])[1], 10);

    // eslint-disable-next-line no-console
    console.log(
      `[gridOverflow] gridSize=${gridSize} totalUsers=${TOTAL_USERS} ` +
        `visibleTiles=${visibleTiles} overflowCount=${overflowCount} sum=${visibleTiles + overflowCount}`,
    );

    expect(
      visibleTiles + overflowCount,
      'visible tiles plus the aggregated overflow count should equal the total number of participants',
    ).toBe(TOTAL_USERS);
  });
});
