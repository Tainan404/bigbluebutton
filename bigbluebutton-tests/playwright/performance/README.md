# Camera effects baseline benchmark

This opt-in Playwright suite measures the current camera-effects pipeline without changing product code. Its filenames deliberately avoid `*.spec.ts` and `*.test.ts`, so the main Playwright configuration and CI do not discover it.

## Prerequisites

Serve a production `bigbluebutton-html5` build, configure `BBB_URL` and `BBB_SECRET` in `../.env`, and create two local Y4M fixtures outside the repository:

```bash
mkdir -p /tmp/ephemeral/camera-effects-fixtures
ffmpeg -loop 1 -i /path/to/licensed-talking-head.png -vf "scale=640:480,fps=30" -t 30 -pix_fmt yuv420p /tmp/ephemeral/camera-effects-fixtures/talking-head-640x480.y4m
ffmpeg -loop 1 -i /path/to/licensed-talking-head.png -vf "scale=1280:720,fps=30" -t 30 -pix_fmt yuv420p /tmp/ephemeral/camera-effects-fixtures/talking-head-1280x720.y4m
```

The image must be licensed for the benchmark operator's use. Fixtures and derived snapshots are intentionally not committed.

## Run

```bash
cd bigbluebutton-tests/playwright
npx playwright test --config=performance/perf.config.ts
```

Each matrix cell runs three times, with a 5-second warm-up and a 15-second measurement window. Override those values only for smoke diagnostics with `CAMERA_EFFECTS_REPETITIONS`, `CAMERA_EFFECTS_WARMUP_MS`, and `CAMERA_EFFECTS_MEASURE_MS`. Results default to `/tmp/ephemeral/camera-effects-baseline/raw-results.jsonl`; one PNG and a JSON sidecar are written per run.

The committed profiles cover Chromium with SwiftShader and Firefox at medium and HD. Real-GPU and CPU-throttled profiles require a host with a physical GPU; preserve the same fixture, timing, browser version, and measured commit when adding those results.
