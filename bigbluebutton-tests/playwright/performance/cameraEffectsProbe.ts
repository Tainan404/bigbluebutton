import { type BrowserContext, type CDPSession, type Page } from '@playwright/test';

export interface BrowserProbeResult {
  capture: MediaTrackSettings | null;
  effectFrames: number;
  effectFps: number;
  inferenceCalls: number;
  inferenceMsPerCall: number;
  longAnimationFrames: number;
  longAnimationFrameMs: number;
  mainThreadMs: number;
  mainThreadMsPerEffectFrame: number;
  processCpuCores: Record<string, number>;
  presentedFps: number;
  presentedGapsOver50Ms: number;
  senderFps: number;
}

type ProbeWindow = Window & {
  bbbCameraEffectsProbe?: {
    capture: MediaTrackSettings | null;
    effectDurations: number[];
    inferenceDurations: number[];
    longAnimationFrameDurations: number[];
  };
};

export async function installCameraEffectsProbe(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const state = {
      capture: null as MediaTrackSettings | null,
      effectDurations: [] as number[],
      inferenceDurations: [] as number[],
      longAnimationFrameDurations: [] as number[],
    };
    (window as ProbeWindow).bbbCameraEffectsProbe = state;

    const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await nativeGetUserMedia(constraints);
      const track = stream.getVideoTracks()[0];
      if (track) state.capture = track.getSettings();
      return stream;
    };

    const NativeWorker = window.Worker;
    const nativeOnMessage = Object.getOwnPropertyDescriptor(NativeWorker.prototype, 'onmessage');
    window.Worker = class extends NativeWorker {
      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        super(scriptURL, options);
        const isEffectWorker = options?.name === 'Blur effect worker';
        if (isEffectWorker) {
          let handler: ((this: Worker, event: MessageEvent) => unknown) | null = null;
          Object.defineProperty(this, 'onmessage', {
            configurable: true,
            get: () => handler,
            set: (next: ((this: Worker, event: MessageEvent) => unknown) | null) => {
              handler = next
                ? function timedHandler(this: Worker, event: MessageEvent) {
                    const start = performance.now();
                    try {
                      return next.call(this, event);
                    } finally {
                      state.effectDurations.push(performance.now() - start);
                    }
                  }
                : null;
              nativeOnMessage?.set?.call(this, handler);
            },
          });
        }
      }
    };

    const wrapFactory = (name: 'createTFLiteSIMDModule' | 'createTFLiteModule') => {
      let factory: unknown;
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => factory,
        set: (value: unknown) => {
          if (typeof value !== 'function') {
            factory = value;
            return;
          }
          factory = async (...args: unknown[]) => {
            const module = await (value as (...factoryArgs: unknown[]) => Promise<Record<string, unknown>>)(...args);
            // The leading underscore is the name exported by the Emscripten module.
            // eslint-disable-next-line no-underscore-dangle
            let inference = module._runInference;
            Object.defineProperty(module, '_runInference', {
              configurable: true,
              get: () =>
                typeof inference === 'function'
                  ? (...inferenceArgs: unknown[]) => {
                      const start = performance.now();
                      try {
                        return (inference as (...runArgs: unknown[]) => unknown)(...inferenceArgs);
                      } finally {
                        state.inferenceDurations.push(performance.now() - start);
                      }
                    }
                  : inference,
              set: (next: unknown) => {
                inference = next;
              },
            });
            return module;
          };
        },
      });
    };
    wrapFactory('createTFLiteSIMDModule');
    wrapFactory('createTFLiteModule');

    if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => state.longAnimationFrameDurations.push(entry.duration));
      }).observe({ type: 'long-animation-frame', buffered: true });
    }
  });
}

async function senderFrames(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const connections = (window as Window & { bbbTestPeerConnections?: RTCPeerConnection[] }).bbbTestPeerConnections;
    let frames = 0;
    for (const connection of connections ?? []) {
      const stats = await connection.getStats();
      // getStats owns the callback lifetime; it is complete before the next loop iteration.
      // eslint-disable-next-line no-loop-func
      stats.forEach((report) => {
        if (report.type === 'outbound-rtp' && report.kind === 'video') frames += report.framesEncoded ?? 0;
      });
    }
    return frames;
  });
}

export async function measureBrowserProbe(
  page: Page,
  cdp: CDPSession | null,
  browserCdp: CDPSession | null,
  windowMs: number,
): Promise<BrowserProbeResult> {
  const selector = 'video[data-local-stream="true"]';
  const beforeSender = await senderFrames(page);
  const beforeTask = cdp ? await cdp.send('Performance.getMetrics') : null;
  const beforeProcesses = browserCdp ? await browserCdp.send('SystemInfo.getProcessInfo') : null;
  const samples = await page.evaluate(
    async ({ selector: videoSelector, duration }) => {
      const state = (window as ProbeWindow).bbbCameraEffectsProbe!;
      state.effectDurations.length = 0;
      state.inferenceDurations.length = 0;
      state.longAnimationFrameDurations.length = 0;
      const video = document.querySelector<HTMLVideoElement>(videoSelector);
      if (!video) throw new Error(`Missing ${videoSelector}`);
      const frameTimes: number[] = [];
      let active = true;
      const onFrame = (now: number) => {
        frameTimes.push(now);
        if (active) video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
      await new Promise((resolve) => {
        setTimeout(resolve, duration);
      });
      active = false;
      return { frameTimes, state };
    },
    { selector, duration: windowMs },
  );
  const afterTask = cdp ? await cdp.send('Performance.getMetrics') : null;
  const afterProcesses = browserCdp ? await browserCdp.send('SystemInfo.getProcessInfo') : null;
  const afterSender = await senderFrames(page);
  const metric = (result: typeof beforeTask, name: string) =>
    result?.metrics.find((item) => item.name === name)?.value ?? 0;
  const mainThreadMs = (metric(afterTask, 'TaskDuration') - metric(beforeTask, 'TaskDuration')) * 1000;
  const frameGaps = samples.frameTimes.slice(1).map((time, index) => time - samples.frameTimes[index]);
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const effectFrames = samples.state.effectDurations.length;
  const inferenceCalls = samples.state.inferenceDurations.length;
  const processCpuCores: Record<string, number> = {};
  afterProcesses?.processInfo.forEach((process) => {
    const before = beforeProcesses?.processInfo.find((candidate) => candidate.id === process.id);
    if (!before) return;
    processCpuCores[process.type] =
      (processCpuCores[process.type] ?? 0) + (process.cpuTime - before.cpuTime) / (windowMs / 1000);
  });
  return {
    capture: samples.state.capture,
    effectFrames,
    effectFps: (effectFrames * 1000) / windowMs,
    inferenceCalls,
    inferenceMsPerCall: inferenceCalls ? sum(samples.state.inferenceDurations) / inferenceCalls : 0,
    longAnimationFrames: samples.state.longAnimationFrameDurations.length,
    longAnimationFrameMs: sum(samples.state.longAnimationFrameDurations),
    mainThreadMs,
    mainThreadMsPerEffectFrame: effectFrames ? mainThreadMs / effectFrames : 0,
    processCpuCores,
    presentedFps: (samples.frameTimes.length * 1000) / windowMs,
    presentedGapsOver50Ms: frameGaps.filter((gap) => gap > 50).length,
    senderFps: ((afterSender - beforeSender) * 1000) / windowMs,
  };
}
