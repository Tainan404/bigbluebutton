# Camera effects performance baseline

This report records the unchanged camera-effects pipeline at commit `09c1e34b9f37b09cfcc131cfe1e8ee6f5d2f4ea5`. The benchmark uses the static production HTML5 bundle and instruments the browser only through `addInitScript`.

## Results

Results are populated from the attached run as median [minimum-maximum]. `Unfinished` means the requested profile could not be measured faithfully on this host.

<!-- RESULTS_START -->

| Browser/profile             | Effect         |    Presented fps |     Effect fps | Main-thread ms/frame |        Inference ms |   Gaps >50 ms |       Sender fps |     CPU cores |
| --------------------------- | -------------- | ---------------: | -------------: | -------------------: | ------------------: | ------------: | ---------------: | ------------: |
| Chromium SwiftShader medium | none           | 29.9 [29.7-29.9] |            n/a |                  n/a |                 n/a |       2 [1-3] | 18.3 [17.9-19.9] | 1.2 [1.2-1.3] |
| Chromium SwiftShader medium | blur           |    8.4 [7.1-9.4] |  8.3 [7.2-9.4] |    90.5 [76.5-111.6] |    12.5 [11.9-13.7] | 125 [106-140] |    4.4 [4.2-5.1] | 7.9 [7.4-8.3] |
| Chromium SwiftShader medium | Home           |    6.3 [5.9-6.5] |  6.3 [5.9-6.5] |  129.2 [124.9-144.9] |    12.2 [12.1-12.4] |    94 [87-96] |    3.9 [3.5-4.1] | 8.4 [8.3-8.6] |
| Chromium SwiftShader medium | brightness +50 |   9.5 [8.9-10.9] | 9.7 [8.9-11.0] |     72.6 [60.8-82.2] |    13.5 [13.4-14.8] | 135 [132-154] |    7.2 [4.9-7.7] | 6.7 [6.6-7.2] |
| Chromium SwiftShader HD     | none           | 29.7 [29.7-29.9] |            n/a |                  n/a |                 n/a |      7 [3-10] | 25.1 [22.3-25.1] | 1.5 [1.4-1.6] |
| Chromium SwiftShader HD     | blur           |    4.3 [4.0-4.7] |  4.4 [4.1-4.8] |  200.0 [179.6-220.4] |    11.5 [11.5-11.9] |    64 [58-70] |    4.4 [3.9-4.4] | 9.0 [8.8-9.3] |
| Chromium SwiftShader HD     | Home           |    2.7 [2.5-2.8] |  2.8 [2.6-2.8] |  341.4 [334.1-359.1] |    11.9 [11.6-12.1] |    40 [37-41] |    2.7 [2.0-2.8] | 9.5 [9.2-9.5] |
| Chromium SwiftShader HD     | brightness +50 |    6.0 [5.3-6.1] |  6.1 [5.4-6.1] |  136.2 [134.2-156.4] |    12.2 [11.4-12.2] |    89 [79-91] |    5.3 [4.1-5.8] | 8.6 [8.3-8.7] |
| Firefox medium              | none           | 30.0 [29.9-30.0] |            n/a |                  n/a |                 n/a |       6 [3-9] | 19.9 [19.8-19.9] |           n/a |
| Firefox medium              | blur           |    4.4 [3.7-4.6] |  4.5 [3.7-4.6] |                  n/a | 116.0 [107.8-142.6] |    65 [54-68] |    2.8 [2.1-3.1] |           n/a |
| Firefox medium              | Home           |    4.7 [4.7-5.3] |  4.7 [4.7-5.3] |                  n/a | 130.7 [115.4-131.8] |    70 [69-78] |    2.8 [2.8-3.2] |           n/a |
| Firefox medium              | brightness +50 |    5.3 [5.1-5.5] |  5.3 [5.2-5.6] |                  n/a | 113.1 [106.5-119.0] |    79 [76-82] |    3.6 [3.5-3.8] |           n/a |
| Firefox HD                  | none           | 29.9 [29.5-30.0] |            n/a |                  n/a |                 n/a |     11 [1-60] | 23.5 [23.0-25.5] |           n/a |
| Firefox HD                  | blur           |    2.7 [2.5-2.9] |  2.7 [2.5-2.9] |                  n/a | 118.4 [117.1-124.6] |    38 [35-42] |    2.4 [2.3-2.8] |           n/a |
| Firefox HD                  | Home           |    3.5 [3.5-3.7] |  3.5 [3.5-3.7] |                  n/a | 129.2 [119.9-134.3] |    51 [50-54] |    2.7 [2.7-3.4] |           n/a |
| Firefox HD                  | brightness +50 |    3.7 [3.3-3.7] |  3.7 [3.3-3.7] |                  n/a | 119.7 [119.2-135.6] |    54 [48-55] |    3.2 [2.8-3.8] |           n/a |

Chromium CPU is the sum of renderer, GPU, and browser process CPU time over wall time. Values above one mean multiple cores were busy. Firefox CPU and CDP `TaskDuration` are unavailable, so those fields are not inferred from neighboring metrics.

<!-- RESULTS_END -->

## Environment

- CPU: Intel Xeon Gold 6138, 16 vCPUs available to the VM.
- GPU: none (`/dev/dri` is absent).
- Server: BBB 4.0 from source, production `bigbluebutton-html5` bundle.
- Chromium: Chrome for Testing 147.0.7727.15, SwiftShader.
- Firefox: Playwright Firefox 1511, synthetic camera source.
- Timing: 5-second warm-up, 15-second sample, three repetitions per cell.

## Snapshots

Local snapshots are in `/tmp/ephemeral/camera-effects-baseline-v4/`, with one PNG and JSON sidecar per run. Chromium snapshots show the unchanged portrait, a sharp foreground over the blurred background, the foreground composited over the Home room, and visibly increased whole-image brightness at both profiles. Firefox uses its synthetic solid-color source; it produces an empty segmentation mask, so the image-effect snapshots show only the replacement background.

## Analysis

The effect loop schedules its next 30 Hz timer only after the synchronous render completes. The expected ceiling is therefore approximately `1000 / (33 + render milliseconds)` rather than 30 fps. Blur, image replacement, and whole-image brightness all enter the segmentation pipeline; brightness is not a cheap post-process-only path. A new TFLite module and model fetch occur whenever an effect starts.

The data confirms the serial timer hypothesis: effect-loop fps tracks presented fps and collapses as synchronous work grows. Chromium SwiftShader spends about 6.7-9.5 CPU cores with effects, compared with 1.2-1.6 without them. Firefox inference is about 108-143 ms per frame, while Chromium is about 11-15 ms; this explains Firefox's 3-5 fps effect output. Whole-image brightness still invokes inference and consumes 6.7-8.6 CPU cores in Chromium, confirming that it is not a cheap filter-only path.

The current output uses Canvas 2D and `captureStream(parseInt(frameRate, 15))`. The radix of 15 turns the nominal string `30` into 45; this is a product bug observed during source review and intentionally not fixed by this benchmark-only change.

## Proposed phase 1 targets

| Area               | Target                                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Output smoothness  | At least 28 presented fps at 720p on the reference laptop, with no more than one gap over 50 ms per 15 seconds                                                               |
| Main thread        | At most 4 ms per processed frame and less than 15% of one core attributable to effects                                                                                       |
| CPU overhead       | No more than 0.35 CPU cores above the no-effect cell on the reference laptop                                                                                                 |
| Brightness         | No segmentation when the whole image is selected; less than 1 ms main-thread cost per frame                                                                                  |
| Degradation ladder | Preserve the effect: reduce mask refinement first above 25 ms/frame, model/input resolution above 33 ms/frame, then output cadence to 20 and 15 fps above 45 and 60 ms/frame |

## Quality evaluation plan

Use redistributable clips with ground-truth person masks, including hair, glasses, hands crossing the face, motion, low light, and background colors close to skin or clothing. Measure mask IoU, boundary F-score, temporal mask change on static pixels, foreground erosion, and halo width. Capture the same frames through BBB and Google Meet at matching input resolution and compare blinded crops, paying special attention to hair, light wrapping, edge stability, and recovery after fast motion.

## Real-device plan

Run the same 5-second warm-up and 15-second sample on a ThinkPad T480-class i5-8350U, an actively supported Chromebook, and a mid-range Android phone. On desktop, use the automated harness with native GPU and the same Y4M source. On Android, host the fixture on a second screen or use a physical scene, record `chrome://webrtc-internals`, Performance traces, device temperature, and battery current, and repeat each cell three times after thermal stabilization.

## Choices made

- Fixtures: kept outside the repository. The run uses the public-domain Library of Congress portrait “President Bill Clinton, half-length portrait, seated at desk, facing front,” obtained through Wikimedia Commons and converted with the README recipe. A synthetic vector face was rejected after visual review because the model produced an empty mask.
- GPU substitutes: SwiftShader is reported only as the no-GPU/VDI profile, not mislabeled as real GPU. Real-GPU and real-GPU with 4x throttling remain unfinished.
- Firefox camera: use Playwright's synthetic source and report it separately; Firefox cannot consume the Y4M launch argument, so cross-browser image-quality comparisons are not valid.
- Variance: report median [minimum-maximum] from three repetitions because the sample count is intentionally small and does not support a stable percentile estimate.
- Viewer isolation: Chromium uses a separately launched browser instance. Firefox keeps the measurement focused on the publisher because starting another Firefox process would contaminate `/proc` CPU accounting.

## Unfinished

- Chromium with a real GPU: no GPU device is exposed to this VM.
- Chromium with a real GPU and 4x CPU throttling: CPU throttling without the required GPU would measure a different cell, so it was not substituted.
- Firefox process CPU attribution and main-thread `TaskDuration` are not included; the browser-level CDP APIs used for Chromium are unavailable in Firefox, and robust `/proc` process-tree attribution needs a dedicated wrapper.
