# Motion delivery and review

The [storyboard and timeline map](motion-storyboard.md) describe the three scenes. The assets are authored CSS paper surfaces, a cut aperture and hand-drawn SVG paths; labels, source identities, controls and money remain DOM content. The homepage copy and navigation are available from first paint.

## Actual interface recordings

| Scene | Viewport recording | Intermediate frames |
| --- | --- | --- |
| Missing piece | [Hero, 1440 px](images/motion/motion-hero.webm) | [1 s](images/motion/motion-hero-1s.png), [3 s](images/motion/motion-hero-3s.png) |
| Four chapters | [Story, 1440 px](images/motion/motion-story.webm), [touch-sized story, 390 px](images/motion/motion-story-mobile.webm) | [Request](images/motion/motion-story-request.png), [Record](images/motion/motion-story-record.png), [mobile Allocate](images/motion/motion-story-mobile-allocate.png) |
| Source's money | [Lab, 1440 px](images/motion/motion-lab.webm) | [mixed](images/motion/motion-lab-mixed-allocate.png), [rejected](images/motion/motion-lab-rejected-allocate.png), [insufficient](images/motion/motion-lab-insufficient-allocate.png) |

All clips are Playwright recordings of the production Next preview and fixture API, not renders of a separate animation. The [browser review result](motion-review-results.json) records 146 passing checks, eight axe scans without detected WCAG A/AA violations, no unexpected page errors, viewport checks at 320/390/768/1440 px and the returned scenario/accounting/proof assertions. The review also exercised seek and reverse scroll, resizing during the story timeline, navigation interrupted during the hero entrance, no-request lab playback, reduced motion, keyboard controls, 200% reflow and cancellation/error paths. Local timings in that JSON are single unthrottled observations.

## Reference access

The four requested reference pages returned HTTP 200 in Chromium. [Bearplus](images/reference-motion/bearplus.webm), [Silana](images/reference-motion/silana.webm), [HeronAI](images/reference-motion/heronai.webm) and [United Carriers](images/reference-motion/unitedcarriers.webm) have scroll recordings and a representative frame each in the same directory. United Carriers showed a nearly black scroll field in this capture, so its material and camera behavior could not be resolved from the recording.

## Build and served version

The isolated review built to `NEXT_DIST_DIR=.next-motion-review` with `GAP402_API=http://127.0.0.1:4028`. Its last reviewed build ID was `hLu1LV6A48voiQymX03Bi`, with stylesheet `b17f98b5787c6ab5.css`. Before publication, the public hostname returned the older `e1a9360668464390.css` stylesheet and the local production `.next` build ID was `QyYDwWQzf1-M_EgdUlsPA`. Those are artifact/version identifiers, not source commit hashes. The old production artifact predates the reviewed source commit and has no embedded source SHA, so its precise build source cannot be proven from the artifact alone.

The full workspace lint, typecheck, test and production build passed in an isolated Linux copy. The Arc contract CLI was unavailable in this shell (`arc-forge: command not found`); contract code was not changed.
