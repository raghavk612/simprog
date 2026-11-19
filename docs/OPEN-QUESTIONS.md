# Open questions and risks (realism pass)

No phase gate failed three times, so nothing here blocked a phase. These are the decisions this pass left to the owners,
and the risks it knows about. Each points at the log entry with the details (docs/realism-log.md).

## Decisions for the owners

1. **High downloads +13% (15.8 → 17.8 MB).** Phase 1.4 put all three athlete variants on court (bodies follow each
   person's position), so High now fetches the third variant's 2k maps. Options: accept it (the service worker caches
   them after the first visit); give the third variant the 1k skin on High; or share one variant's kit and gear atlases.
   Medium went the other way (−24%), and Low is unchanged.
2. **Lite is an Auto-only level** (4.4). Settings still offers Auto, Low, Medium and High. Lite (the athletes and the
   broadcast lighting without crowd, bloom, depth of field, mirror and AO) might be worth offering by name to a school
   with weak Chromebooks.
3. **Texture compression** (4.5). The player maps are lossless PNG. KTX2/Basis would cut GPU memory and downloads
   further, but needs an encoder (`basisu` or `toktx`) in the asset pipeline and a transcoder in the bundle. The Houdini
   source directory the brief names (`/Users/raghav/coding/kangs-assets`) is not on this machine, so no asset was
   re-exported.

## Known weaknesses (see the final report for the ranking)

4. **Jersey trim reads thick up close** (docs/sheets/after/closeups.jpg). The trim is inflated 2 cm so skin never pokes
   through it (3.1); at a replay close-up the armhole trim looks lumpy. A thinner inflate needs the cover test re-run
   against every pose.
5. **The close-up defender's high hand rests by his head** in the "defender up close" shot: the stance's high hand is
   placed for the broadcast distance, where it reads as a hand in the passing lane.
6. **Low, Player-view replay is 0.1 ms slower than the baseline** (4.9): within run-to-run noise, from Phase 2's motion
   running for all ten players.

## Risks

7. **Measured on one machine** (an M1 Pro). The "laptop" configuration copies a school laptop's window size, not its GPU.
   The auto-quality ladder (4.4) is the guard on weaker hardware: it steps down to Lite or Low within a few seconds.
8. **three.js r180 GTAOPass bug**: it throws when given a depth texture in its constructor (4.2). Not used now; worth
   knowing before upgrading three.js or reusing the main depth for AO.
9. **One commit with a failing test**: 9bb42b6 (crowd shadows off on High) left a graphics test failing; the next commit
   (0956a6e) fixed the test. Every other commit on the branch passes `npm test`. Relevant only to a `git bisect`.
10. **Bundle warning**: Vite still warns about chunks over 500 kB (`players`, three.js and the gym, 647 kB; `index`,
    519 kB). Both are needed for the first frame (4.6).
