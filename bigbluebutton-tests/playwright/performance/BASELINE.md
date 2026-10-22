# Camera effects performance baseline

This report records the unchanged camera-effects pipeline at commit `16b4b9ad9f982b866ff75271bbb5cee4ee179cac`. The benchmark uses the static production HTML5 bundle and instruments the browser only through `addInitScript`.

## Results

Results are populated from the attached run as median [minimum-maximum]. `Unfinished` means the requested profile could not be measured faithfully on this host.

<!-- RESULTS_START -->

| Browser/profile             | Effect         |    Presented fps |       Effect fps | Main-thread ms/frame |        Inference ms |   Gaps >50 ms |       Sender fps |         CPU cores |
| --------------------------- | -------------- | ---------------: | ---------------: | -------------------: | ------------------: | ------------: | ---------------: | ----------------: |
| Chromium SwiftShader medium | none           | 29.9 [29.9-30.0] |              n/a |                  n/a |                 n/a |       0 [0-0] | 19.6 [19.3-19.7] |  1.25 [1.24-1.28] |
| Chromium SwiftShader medium | blur           |   9.5 [9.3-10.0] |   9.5 [9.4-10.0] |     75.0 [69.3-75.7] |    11.9 [11.2-12.0] | 141 [139-148] |    6.4 [6.3-6.9] |  8.29 [8.06-8.46] |
| Chromium SwiftShader medium | Home           |    8.0 [7.6-8.1] |    8.0 [7.7-8.1] |     94.2 [93.0-97.8] |    10.5 [10.2-11.5] | 119 [113-120] |    4.5 [4.1-5.0] |  9.29 [8.71-9.36] |
| Chromium SwiftShader medium | brightness +50 | 13.6 [13.5-13.9] | 13.7 [13.6-13.9] |     41.9 [39.7-43.1] |    11.4 [11.2-11.9] | 162 [161-166] |    8.6 [8.3-9.1] |  7.89 [7.53-7.99] |
| Chromium SwiftShader HD     | none           | 15.0 [15.0-15.0] |              n/a |                  n/a |                 n/a | 223 [215-224] | 14.0 [14.0-15.1] |  0.81 [0.78-0.82] |
| Chromium SwiftShader HD     | blur           |    4.7 [4.5-5.0] |    4.7 [4.5-5.0] |  185.1 [168.8-194.2] |    11.8 [11.2-12.2] |    69 [66-74] |    4.1 [3.9-4.5] |  9.17 [9.17-9.21] |
| Chromium SwiftShader HD     | Home           |    3.3 [3.2-3.3] |    3.3 [3.2-3.3] |  287.2 [279.8-291.0] |    11.0 [10.8-11.1] |    47 [46-48] |    2.4 [2.1-2.7] | 9.74 [9.12-10.01] |
| Chromium SwiftShader HD     | brightness +50 |    7.5 [7.1-7.5] |    7.5 [7.2-7.5] |  102.9 [102.1-109.7] |    10.7 [10.4-10.9] | 111 [106-111] |    7.1 [6.9-7.2] |  8.94 [8.88-8.95] |
| Firefox medium              | none           | 29.9 [29.8-30.0] |              n/a |                  n/a |                 n/a |      1 [0-38] | 19.9 [18.4-19.9] |               n/a |
| Firefox medium              | blur           |    4.5 [4.3-4.5] |    4.6 [4.4-4.6] |                  n/a | 109.6 [109.3-115.2] |    67 [64-67] |    2.8 [2.7-2.9] |               n/a |
| Firefox medium              | Home           |    5.7 [5.5-6.1] |    5.8 [5.6-6.1] |                  n/a |  101.3 [93.3-106.3] |    85 [82-91] |    4.0 [3.5-4.1] |               n/a |
| Firefox medium              | brightness +50 |    5.7 [5.7-5.9] |    5.8 [5.8-6.0] |                  n/a |  101.5 [96.5-101.6] |    85 [85-88] |    3.6 [3.6-4.0] |               n/a |
| Firefox HD                  | none           | 15.0 [15.0-15.0] |              n/a |                  n/a |                 n/a | 223 [196-224] | 14.9 [14.8-14.9] |               n/a |
| Firefox HD                  | blur           |    3.0 [2.9-3.1] |    3.1 [2.9-3.2] |                  n/a | 110.0 [104.2-112.5] |    44 [42-46] |    2.8 [2.0-3.0] |               n/a |
| Firefox HD                  | Home           |    4.1 [3.9-4.3] |    4.1 [3.9-4.3] |                  n/a | 111.9 [100.4-113.4] |    60 [57-63] |    3.9 [3.5-4.2] |               n/a |
| Firefox HD                  | brightness +50 |    3.9 [3.9-4.3] |    4.0 [4.0-4.4] |                  n/a |  114.7 [98.5-115.2] |    58 [58-64] |    4.0 [2.4-4.2] |               n/a |

Chromium CPU is the sum of renderer, GPU, and browser process CPU time over wall time. Values above one mean multiple cores were busy. Firefox CPU and CDP `TaskDuration` are unavailable, so those fields are not inferred from neighboring metrics.

<!-- RESULTS_END -->

## Environment

- CPU: Intel Xeon Gold 6138, 16 vCPUs available to the VM.
- GPU: none (`/dev/dri` is absent).
- Server: BBB 4.0 from source, production `bigbluebutton-html5` bundle.
- Chromium: Chrome for Testing 147.0.7727.15, SwiftShader.
- Firefox: Playwright Firefox 1511, synthetic camera source.
- Timing: 5-second warm-up, 15-second sample, three repetitions per cell.

## Analysis

The effect loop schedules its next 30 Hz timer only after the synchronous render completes. The expected ceiling is therefore approximately `1000 / (33 + render milliseconds)` rather than 30 fps. Blur, image replacement, and whole-image brightness all enter the segmentation pipeline; brightness is not a cheap post-process-only path. A new TFLite module and model fetch occur whenever an effect starts.

The data confirms the serial timer hypothesis: effect-loop fps tracks presented fps and collapses as synchronous work grows. Chromium SwiftShader spends about 7.9-9.7 CPU cores with effects, compared with 0.8-1.3 without them. Firefox inference alone is about 93-115 ms per frame, while Chromium is about 10-12 ms; this explains Firefox's 3-6 fps effect output. Whole-image brightness still invokes inference and consumes 7.9-8.9 CPU cores in Chromium, confirming that it is not a cheap filter-only path.

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
