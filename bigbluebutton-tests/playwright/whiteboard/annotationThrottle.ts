import { expect, BrowserContext, Page as PlaywrightPage } from '@playwright/test';
import { ELEMENT_WAIT_LONGER_TIME } from '../core/constants';
import { elements as e } from '../core/elements';
import { Page } from '../core/page';
import { MultiUsers } from '../user/multiusers';

export class AnnotationThrottle extends MultiUsers {
  /**
   * Installs a transparent WebSocket spy on a raw Playwright page **before**
   * navigation. Returns a live array that accumulates a timestamp (Date.now())
   * each time a `presAnnotationSubmit` message is observed on the wire.
   *
   * Must be called before page.goto() (i.e. before Page.init()).
   */
  async setupWsSpy(rawPage: PlaywrightPage): Promise<number[]> {
    const mutationTimes: number[] = [];

    await rawPage.routeWebSocket('**/graphql', (ws) => {
      const server = ws.connectToServer();

      ws.onMessage((msg) => {
        const text = typeof msg === 'string' ? msg : msg.toString();
        if (text.includes('presAnnotationSubmit') || text.includes('PresAnnotationSubmit')) {
          mutationTimes.push(Date.now());
        }
        server.send(msg);
      });

      server.onMessage((msg) => ws.send(msg));
    });

    return mutationTimes;
  }

  /**
   * Like MultiUsers.initUserPage() but installs the WS spy on the raw page
   * before navigation so the spy covers the full WebSocket lifetime.
   * Returns the mutation timestamp array for later assertions.
   */
  async initUserPageWithWsSpy(context?: BrowserContext): Promise<number[]> {
    const userContext = context || this.modPage.context;
    if (!userContext) throw new Error('No browser context provided for viewer page');

    const rawPage = await userContext.newPage();
    const mutationTimes = await this.setupWsSpy(rawPage);

    this.userPage = new Page(this.browser, rawPage, this.modPage?.testInfo ?? null);
    await this.userPage.init(false, {
      fullName: 'Attendee',
      meetingId: this.modPage?.meetingId,
    });

    return mutationTimes;
  }

  // ---------------------------------------------------------------------------
  // Test 1: new config keys are present in window.meetingClientSettings
  // ---------------------------------------------------------------------------

  async checkConfigDefaults() {
    await this.modPage.waitForSelector(e.whiteboard, ELEMENT_WAIT_LONGER_TIME);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = await this.modPage.page.evaluate(() => (window as any).meetingClientSettings.public.whiteboard);

    expect(
      config.annotationsTargetThroughput,
      'annotationsTargetThroughput should default to 60',
    ).toBe(60);

    expect(
      config.annotationsRateLimitMax,
      'annotationsRateLimitMax should default to 2000',
    ).toBe(2000);

    expect(
      config.maxNumberOfActiveUsers,
      'maxNumberOfActiveUsers should be 100 after the throttle bump',
    ).toBe(100);
  }

  // ---------------------------------------------------------------------------
  // Test 2: viewer annotations are throttled when targetThroughput is low
  // ---------------------------------------------------------------------------

  async viewerAnnotationsAreThrottled(mutationTimes: number[]) {
    await this.modPage.waitForSelector(e.whiteboard, ELEMENT_WAIT_LONGER_TIME);
    await this.userPage.waitForSelector(e.whiteboard);

    // Grant whiteboard access to all attendees
    await this.modPage.waitAndClick(e.multiUsersWhiteboardOn);

    // Wait until the viewer's toolbar shows the pencil tool (WB access confirmed)
    await this.userPage.hasElement(
      e.wbPencilShape,
      'viewer should see the pencil tool after multi-user WB is enabled',
      ELEMENT_WAIT_LONGER_TIME,
    );

    // Lower targetThroughput to 1 event/sec → computeFlushInterval() = 1000ms for 1 user.
    // This simulates the same throttle rate as having 60 concurrent users at the
    // default target of 60, but without spinning up 60 browser tabs.
    await this.userPage.page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).meetingClientSettings.public.whiteboard.annotationsTargetThroughput = 1;
    });

    const wbLocator = this.userPage.page.locator(e.whiteboard);
    const wbBox = await wbLocator.boundingBox();
    if (!wbBox) throw new Error('whiteboard boundingBox is null');

    // Select the pencil (draw) tool on the viewer page
    await this.userPage.waitAndClick(e.wbPencilShape);

    // Mark time immediately before drawing so we can filter out any
    // pre-drawing mutations (page-load syncs, reconnect flushes, etc.)
    const drawingStartTime = Date.now();

    // Draw 3 short strokes in rapid succession.
    // steps:1 minimises CDP round-trips so the whole loop finishes in ~100ms,
    // keeping the observation window well under 2 × throttleInterval (2000ms).
    for (let i = 0; i < 3; i++) {
      const x = wbBox.x + (0.2 + i * 0.2) * wbBox.width;
      const y = wbBox.y + 0.45 * wbBox.height;
      await this.userPage.page.mouse.move(x, y);
      await this.userPage.page.mouse.down();
      await this.userPage.page.mouse.move(x + 15, y + 15, { steps: 1 });
      await this.userPage.page.mouse.up();
    }

    // Wait just over one throttle cycle (1000ms) to let any pending flush happen
    await this.userPage.page.waitForTimeout(1200);

    // Only count mutations that fired during drawing + observation window;
    // pre-drawing syncs (page load, reconnect) are excluded.
    const drawingMutations = mutationTimes.filter((t) => t >= drawingStartTime);

    // With targetThroughput=1 the flush interval is 1000ms. In 1.2s we expect:
    //   - flush #1 at ~30ms (initial annotationsBufferTimeMin trigger)
    //   - flush #2 at ~1030ms (first throttled loop tick)
    // Upper bound: ≤ 2 mutations. Without throttling (default config) 5+ would fire.
    expect(
      drawingMutations.length,
      `annotation mutation count (${drawingMutations.length}) should be ≤ 2 under 1 event/sec throttle`,
    ).toBeLessThanOrEqual(2);

    // Shapes must still reach the mod page — throttle batches them, not drops them
    await this.modPage.hasElement(
      e.wbDraw,
      'drawn shapes should be visible on mod page after throttled delivery',
    );
  }

  // ---------------------------------------------------------------------------
  // Test 3: presenter annotations bypass the throttle entirely
  // ---------------------------------------------------------------------------

  async presenterAnnotationsNotThrottled(mutationTimes: number[]) {
    await this.modPage.waitForSelector(e.whiteboard, ELEMENT_WAIT_LONGER_TIME);
    await this.userPage.waitForSelector(e.whiteboard);

    // Set an aggressively low throughput cap on the presenter page.
    // If the presenter exception were broken, shapes would be held for 1000ms.
    // With the exception working, isCurrentUserPresenter=true bypasses this and
    // uses annotationsBufferTimeMin (30ms) instead.
    await this.modPage.page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).meetingClientSettings.public.whiteboard.annotationsTargetThroughput = 1;
    });

    const wbLocator = this.modPage.page.locator(e.whiteboard);
    const wbBox = await wbLocator.boundingBox();
    if (!wbBox) throw new Error('whiteboard boundingBox is null');

    // Presenter draws a rectangle
    await this.modPage.waitAndClick(e.wbShapesButton);
    await this.modPage.waitAndClick(e.wbRectangleShape);
    await this.modPage.page.mouse.move(wbBox.x + 0.3 * wbBox.width, wbBox.y + 0.3 * wbBox.height);
    await this.modPage.page.mouse.down();
    await this.modPage.page.mouse.move(
      wbBox.x + 0.65 * wbBox.width,
      wbBox.y + 0.65 * wbBox.height,
      { steps: 10 },
    );
    await this.modPage.page.mouse.up();

    // Wait 500ms — well within the 1000ms throttle window that would apply if the
    // presenter exception were NOT working
    await this.modPage.page.waitForTimeout(500);

    // Presenter must have fired at least 1 mutation before the throttle window closes
    expect(
      mutationTimes.length,
      `presenter should bypass throttle: expected ≥ 1 mutation in 500ms but got ${mutationTimes.length}`,
    ).toBeGreaterThanOrEqual(1);

    // Shape must also be visible on the viewer side
    await this.userPage.hasElement(
      e.wbDrawnShape,
      'presenter shape should reach the viewer page within 500ms (unthrottled)',
    );
  }
}
