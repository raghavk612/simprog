# Player detail references (normal/AO bake, fingers, sneakers, afro)

Research notes, 2026-11-12. Reference only: nothing here is to be imported; the bodies stay our own SDF work.

**How to read the numbers.** `[S]` = taken from a page I read, or computed by me from raw data I downloaded (ANSUR II CSV, combine tables). `[E]` = my estimate or a common modelling rule of thumb, with no source behind it; treat as a starting value to tune against renders. Pages I could not open are listed at the end.

---

## 1. Reference models and breakdowns

Almost no free model matches "stylised-realistic basketball player, 5k–30k tris, own textures", so the list mixes player models, free character kits, sneaker and hand models, and pipeline write-ups. Open them to look at; do not import.

### Models (triangle counts as shown on the page)

| # | Model | Tris | Licence | What to borrow |
|---|---|---|---|---|
| 1 | [Quaternius Universal Base Characters](https://quaternius.itch.io/universal-base-characters) (6 rigged bodies, 20 hairstyles; Superhero, Regular, Teen builds) | avg 13k [S] | CC0 [S] | Same budget as ours. Compare how a 13k body spends triangles on hands, feet and hair, and how the Superhero build exaggerates shoulder-to-waist taper. |
| 2 | [PolyField Strikers - Football](https://www.sketchfab.com/3d-models/polyfield-strikers-football-3925d7fc941945509f7bae626843faeb) (charmipatel) | 28.8k (14.9k verts) [S] | CC BY 4.0 [S] | Upper end of the budget (about 2x ours). Look at how kit panels and boots are separated at this count. I read only the metadata, not the mesh. |
| 3 | [Low Poly Basketball Player Dribble Animation](https://www.sketchfab.com/3d-models/low-poly-basketball-player-dribble-animation-a4afa841b7224206a1d60ed0c7b0932d) (chroma3d) | 3.2k on the sidebar; description says 1.6k faces [S] | Not a standard CC licence; "NoAI" notice, royalty-free sale [S] | Floor of the range. Look at the dribble pose: bent knees, ball-side hand spread over the ball, off-hand relaxed. 25-bone Mixamo-style rig. |
| 4 | [Game-Ready Basketball Sneakers](https://sketchfab.com/3d-models/game-ready-basketball-sneakers-3d-model-eec229e6f0db4c108a6f34c2096c83e2) (3D Skill Up) | 8.5k (4.2k verts) [S] | Not stated on Sketchfab; sold on Superhive. Page says it was AI-generated [S] | High-top silhouette, perforated panels, padded tongue, sculpted outsole. 8.5k is far above what one of our shoes can afford (aim 1.2–2k each, see section 3), so use it to see which panels survive when you cut it down. |
| 5 | [Champion Sneaker](https://sketchfab.com/3d-models/champion-sneaker-20b61d7e9b744fe68a15a15ca4f7d63a) (SJSUSERC) | 291k (scan) [S] | CC BY 4.0 [S] | A dense scan: use as a true-to-life source for toe spring, sole wedge and lace routing. It is exactly the kind of thing you would bake normals from, if it were ours. |
| 6 | [Free Pack - VR Hands (Rigged)](https://sketchfab.com/3d-models/free-pack-vr-hands-rigged-b3b8309e59c748e3956531c8f57dd233) (PolyOne Studio) | 3.3k (1.7k verts) for the page; likely both hands [S] | CC BY 4.0 [S] | Roughly 1.5k tris per rigged hand with separate fingers. Cost reference for section 4. |
| 7 | [v0 Stylized Basketball Team Player](https://sketchfab.com/3d-models/v0-basketball-player-free-2307205c65ae4abe9d9009db4c6ef26b) (Tulio Portela) | 550k [S] | CC BY 4.0 [S] | Over budget by 40x. Only useful for the kit cut (jersey and shorts proportions on a lean athlete). The sibling [v0 Basketball Players Free](https://sketchfab.com/3d-models/v0-basketball-players-free-3072561dccdf4b298f1c2d06c00e376b) (458k) is labelled as generated with Meshy; do not use it. |

### Free sources to browse (not opened one by one)

| # | Source | Licence | Why |
|---|---|---|---|
| 8 | [Quaternius](https://quaternius.itch.io/) (Modular Character Outfits, Universal Animation Library; licence is per pack) | The cinevva guide says Quaternius Asset Licence for the Animated Character Pack: free in games, no resale as a pack [S, secondary]. Universal Base Characters is CC0 (row 1). | Clothing separated from the body, and a 120+ animation set for judging idle and dribble poses. |
| 9 | [Poly Pizza](https://poly.pizza/) | Per model, CC0 or CC BY, filterable [S, secondary] | Filter "human" or "shoe" and sort by licence. I could not load its listing. |
| 10 | [Kenney](https://kenney.nl/assets) (Animated Characters) | CC0 [S, secondary] | Very low-poly flat style. Useful only to see how little detail reads at distance. |
| 11 | [MakeHuman](https://static.makehumancommunity.org/makehuman/docs/modeling_the_body.html) / [MPFB](https://static.makehumancommunity.org/mpfb/docs/index.html) | Docs give no numeric proportions or poly counts [S] | The Muscle, Weight, Height and Proportions sliders produce a plausible athletic body to compare against. Use ANSUR (section 2) for numbers instead. |
| 12 | Sketchfab searches "basketball player", "NBA", "athlete": many hits are likenesses of real NBA players (e.g. Durant, George). I did not open them; they look like ripped game models, so skip for IP reasons. |  |  |

### Breakdowns (what the pros do)

| # | Article | Facts | What to borrow |
|---|---|---|---|
| 13 | [NBA 2K18 Captures So Many Details (Operation Sports)](https://www.operationsports.com/nba-2k18-captures-many-details-gets-done) | Handheld laser scans of jerseys capture perforations, number size, stitching, piping thickness and stripe borders; 200+ shoes scanned; a body system with no fixed template [S] | The checklist of jersey details that matter: perforation pattern, piping, number size. Put those in the normal map; keep the number and trim colours in the albedo. |
| 14 | [The Sole of 2K (SLAM)](https://slamonline.com/?p=836621) | Real shoes stuffed with paper, 30–40 photos per shoe, laser scan, high-poly scan cleaned and aligned to a low-poly textured scan [S] | The same high-to-low bake we are doing, with a physical shoe as the source. Confirms that sneaker colour blocks and lace detail come from baked textures on a low mesh. |
| 15 | [Techniques for Game Character Hair Creation (80.lv)](https://80.lv/articles/techniques-for-game-character-hair-creation) | 40k-poly hair is "quite heavy"; dense base layer first, then 2nd and 3rd layers with negative space, flyaways last; AO baked into vertices [S] | The layering order for section 6. |
| 16 | [Creating Real-Time Afro in FiberShop / Marmoset (80.lv)](https://80.lv/articles/creating-real-time-afro-in-fibershop-marmoset-toolbag/) | Three card layers (base covers skin gaps, secondary twisted tubes, tertiary silhouette breakup); lattice for broad shape; curl modifier for waviness; mirror then re-curl one side to break symmetry [S] | The best match for our clumpy-outline afro. |
| 17 | [Curly Hair breakdown (Games Artist)](https://gamesartist.co.uk/curly-hair-character-breakdown-thomas-sykutera/) | Thick clumps for volume, thin for variation, flyaway cards for breakup, hairline cards; leave some scalp uncovered; keep negative space between curls [S] | Clump placement rules. |
| 18 | [Real-Time Hair for AAA Games (yelzkizi)](https://yelzkizi.org/?p=36574) | 5k–20k tris of hair typical, 20–40k high-end; 2K atlas for mains, 1K or 512 for background; braids: wrap cards round a low-poly braid or bake a groom into a strip texture [S] | Budget and texture sizes. |

I found no usable GDC talk or ArtStation breakdown specific to 2K jerseys, hair or faces at game distance; the 2K material above is press coverage.

No image URLs worth quoting: none of the pages gave a stable direct image link that showed more than the page itself.

---

## 2. Anatomy targets (male, 17–18 y, 1.85–2.10 m)

**Sources.**
- ANSUR II male file (4,082 US Army men; [data page](https://www.openlab.psu.edu/ansur2/)). I downloaded the public CSV and computed ratios to stature myself. Three groups: all men; age 22 or under and 1.80 m or taller (n=215, mean 1.838 m); 1.85 m or taller (n=359, mean 1.884 m). It is a military sample, so waists and thighs are a little heavier than a school athlete; chest and waist are the least reliable rows.
- NBA draft combine tables, height without shoes: [DraftExpress averages by position](https://www.draftexpress.com/average-measurements-by-position/all/NBA+Draft+Combine/all/60/) and a 20-player sample from [theScore 2014](https://www.thescore.com/nba/news/502954). College prospects are 19–22; a 17–18-year-old will be slightly narrower and leaner, so trim girths 3–5% [E].
- Berkeley sports analytics: league average wingspan about 82.4 in, wingspan/height about 1.05 ([article](https://sportsanalytics.studentorg.berkeley.edu/articles/hands_up.html)). A study of 2,990 NBA recruits found wingspan/height significantly higher than in army recruits ([DOAJ](https://doaj.org/article/c40514df450346fd88db7b1c5dfe26e7)); it gives no means.

### Ratios to height (H)

| Measure | ANSUR II, age 22 or under, 1.80 m or taller [S] | ANSUR II, all men [S] | At H = 1.95 m | Use in model |
|---|---|---|---|---|
| Biacromial (shoulder bone to bone) | 0.231 | 0.237 | 45 cm | 0.230 |
| Bideltoid (across deltoids) | 0.277 | 0.291 | 54 cm | 0.28–0.29 for a muscular build |
| Chest breadth | 0.158 | 0.165 | 31 cm | 0.155 |
| Chest depth | 0.135 | 0.145 | 26 cm | 0.130–0.135 |
| Waist breadth | 0.175 | 0.186 | 34 cm | 0.160–0.170 [E, lean athlete] |
| Waist depth | 0.122 | 0.136 | 24 cm | 0.115–0.12 [E] |
| Hip bone breadth (bicristal) | 0.154 | 0.157 | 30 cm | 0.150 |
| Biceps circumference, flexed | 0.191 | 0.204 | 37 cm | 0.18 relaxed [E] |
| Forearm circumference, flexed | 0.168 | 0.177 | 33 cm | 0.160 |
| Wrist circumference | 0.098 | 0.100 | 19 cm | 0.095 |
| Thigh circumference (at gluteal fold) | 0.341 | 0.356 | 66 cm | 0.33 |
| Calf circumference | 0.214 | 0.224 | 42 cm | 0.21 |
| Ankle circumference | 0.129 | 0.131 | 25 cm | 0.125 |
| Neck circumference | 0.213 | 0.227 | 41 cm | 0.21 |
| Acromial (shoulder) height | 0.821 | 0.820 | 160 cm | 0.82 |
| Crotch height | 0.488 | 0.482 | 95 cm | 0.49–0.50; basketball players are long-legged, but I have no sourced number [E] |
| Knee height (mid-patella) | 0.280 | 0.278 | 55 cm | 0.28 |
| Wrist height | 0.480 | 0.483 | 94 cm | 0.48 |
| Elbow to fingertip (forearm plus hand) | 0.273 | 0.273 | 53 cm | 0.275 |
| Foot length (barefoot) | 0.153 | 0.154 | 29.8 cm | 0.153 |
| Foot breadth | 0.057 | 0.058 | 11 cm | 0.057 |
| Lateral malleolus (ankle bone) height | 0.0413 | 0.0415 | 8.1 cm | 0.041 |

### Arm span and hands

| Measure | Value | Source |
|---|---|---|
| Arm span / H, general young men | 1.033 (SD 0.027) | ANSUR II, computed [S] |
| Arm span / H, NBA combine sample | 1.064 (SD 0.023, n=20) | theScore 2014, computed [S] |
| Arm span / H by position (combine averages) | PG 1.065, SG 1.059, SF 1.061, PF 1.066, C 1.064 | DraftExpress, computed [S] |
| Arm span / H, league (current players) | about 1.05 | Berkeley [S] |
| 2023 combine sample, wingspan minus height | mean 4.2 in, range 1.75–7.5 in | [nbadraft.net](https://www.nbadraft.net/2023-nba-draft-combine-anthro-measurements/), n=17 [S] |
| **Use** | **1.06 of H** (range 1.03–1.09). At 1.95 m the span is 2.07 m, not 2.01 m. Put the extra into the arms, not the shoulders. |  |
| Hand length (wrist crease to middle fingertip) / H | Combine 0.112 (SD 0.004), mean 8.6 in = 21.9 cm; ANSUR 0.109–0.110 | computed [S] |
| **Use** | **0.110–0.112 of H**, about 21.5–21.8 cm at 1.95 m. Basketball players have long arms but hands in normal proportion to height. |  |
| Hand breadth (across the palm at the knuckles) / H | 0.049–0.050 (ANSUR) = 9.5–9.7 cm at 1.95 m; breadth/length about 0.45 | computed [S] |
| Combine "hand width" | 8.6–10 in by position: PG 8.6, SG 9.3, SF 8.6, PF 9.8, C 10 | DraftExpress [S] |

Notes on the combine hand figures:
- Combine "hand width" is, as I understand it, the fully spread hand from thumb tip to little-finger tip, not palm breadth, because 9–10 in is far larger than any palm [E]. That gives a spread of about 1.07–1.10 times hand length (computed from the DraftExpress rows).
- The DraftExpress hand-length column is not monotonic by position (SG 8.7 in, SF 8.1 in), so use the 20-player sample for hand length.
- Top combine hands in 2025 reach 10 in length and 11.25–11.75 in width ([topendsports](https://www.topendsports.com/sport/basketball/testing-draft-results-2025.htm)).

### Finger lengths relative to hand length

| Segment of the middle finger | Share of hand length | How derived |
|---|---|---|
| Proximal phalanx | about 22% | Radiograph ratios to humerus from [PMC6760092](https://pmc.ncbi.nlm.nih.gov/articles/PMC6760092) Table 1 (MC3 0.22, PP 0.14, MP 0.094, DP 0.062; metacarpal plus carpal 0.33), divided by their sum, my arithmetic [S, derived] |
| Middle phalanx | about 15% | same |
| Distal phalanx | about 10% | same |
| Three phalanges together | about 47% | same |
| Metacarpal plus carpus | about 53% | same |

- The phalanges run in the ratio 1 : 0.67 : 0.44 (proximal : middle : distal), the "x, 1.5x, 2.3x" series that the same paper found in 30 skeletons [S].
- Bone length is longer than the visible finger. Skin finger length from the palm crease is about 0.40–0.45 of hand length [E]. Index and ring are about 0.90–0.95 of the middle finger and the little finger about 0.75–0.80 [E]. The thumb tip reaches about the first knuckle of the index finger when adducted [E].
- Finger width: about 1.9–2.1 cm at the proximal segment on a 21.8 cm hand, tapering to about 1.5 cm at the tip [E].

---

## 3. Basketball sneakers

**Measured data are thin.** RunRepeat's lab-tested stack heights across its basketball range run from about 23–35 mm at the heel and 15–30 mm at the forefoot ([guide](https://runrepeat.com/guides/best-mens-basketball-shoes)). Examples from that page: Nike G.T. Hustle 3 32.8 / 26.8 mm, adidas D.O.N. Issue 7 28.4 / 19.4 mm, Harden Volume 10 16 / 20 mm (the forefoot figure is probably a typo). The page gives no collar heights.

### Side-profile proportions (foot length L, bare foot about 0.153 H)

| Feature | Value | Basis |
|---|---|---|
| Heel stack (sole thickness at heel) | 28–35 mm, about 0.015–0.018 H | RunRepeat range [S] |
| Forefoot stack | 18–27 mm, about 0.010–0.014 H | RunRepeat range [S] |
| Heel-to-toe drop | 6–10 mm | Shoemakers Academy says normal sports shoes lift the heel 6–8 mm [S]; RunRepeat data above gives 6–9 mm |
| Toe spring (sole rises up at the toe tip) | about 10–15 mm; casual shoes about 5 mm, stiff boots about 15 mm | [Shoemakers Academy](https://shoemakersacademy.com/wp-content/uploads/2023/01/Sneaker_Construction_101.pdf) [S]; basketball value is my interpolation [E] |
| Shoe length vs bare foot | shoe outsole about 1.08–1.12 x foot length (adds toe room) | [E] |
| Shoe width | about 1.15 x foot breadth at the ball, midsole flared a few mm wider than the upper | [E] |
| Collar height, low top | topline below the ankle bone: about 6–8 cm above ground | ankle bone is 0.0413 H = 8.1 cm at 1.95 m [S]; heights [E] |
| Collar height, mid top | topline at or just over the ankle bone: about 9–11 cm | [E] |
| Collar height, high top | topline 3–6 cm above the ankle bone: about 12–16 cm | [E] |
| Heel counter | rises to about 60–70% of the collar height, with a slight forward rake at the back | [E] |
| Tongue | stands 1–2 cm above the topline on high-tops | [E] |

Use L in shoe-space: heel stack about 1/9–1/10 of L at 30 cm. The midsole should be visibly thicker than the upper's leather layer, and the outsole is a thin 2–4 mm band under it [E].

### Panels and what reads at game distance

Parts (definitions from [Nike](https://www.nike.com/a/parts-of-shoe-anatomy) and the Shoemakers Academy PDF): toe box, toe cap, vamp, mudguard, eyestay, throat, tongue, quarter, heel counter, topline and collar, midsole, outsole, foxing on vulcanised soles.

| Part | Reads at game distance? | Where to put it |
|---|---|---|
| Midsole colour block (usually white or contrast) | Yes, strongest cue: a bright band against a dark court | Geometry (thickness, flare) plus albedo |
| Overall wedge profile, toe spring, heel flare | Yes, the silhouette | Geometry |
| Heel counter and toe cap as colour blocks | Yes, if they contrast with the quarter | Albedo; edge step 0.5–1 mm in geometry |
| Collar padding, tongue top, topline | Yes: a thick roll catches light | Geometry |
| Eyestay and lace zig-zag | Partly: a lighter band along the top; individual laces appear at close-up only | Laces: a flat band in geometry with a normal-map zig-zag; bows as small extruded loops |
| Logo or stripe on the quarter | Yes, one big shape | Albedo |
| Vamp and quarter seams, stitch lines, perforations, overlay edges | Only in close-up or replay | Normal map and AO |
| Outsole tread | Rarely visible; only on jump shots from below | Normal map (herringbone or pivot-circle pattern), no geometry |

Suggested budget: about 1,200–2,000 tris per shoe including laces (my estimate, scaled down from the 8.5k basketball sneaker in section 1, row 4 [E]).

---

## 4. Relaxed hands

### Joint angles (flexion positive)

| Source | Posture | Index | Middle | Ring | Little |
|---|---|---|---|---|---|
| [Kamper et al. 2003](https://www.ece.uvic.ca/~bctill/papers/mocap/Kamper_etal_2003.pdf), n=10, hand resting on the thigh [S] | near-extended starting pose | MCP 5 / PIP 11 / DIP 1 | MCP -1 / PIP 8 / DIP 2 | MCP 1 / PIP 7 / DIP 2 | MCP 4 / PIP 3 / DIP 1 |
| [Neff and Seidel 2006](https://www.cs.ucdavis.edu/~neff/papers/amdo_06_NeffSeidel.pdf), one subject, rest pose for animation [S] | relaxed, fingers curled | 40 / 50 / 35 | 42 / 50 / 38 | 42 / 50 / 38 | 29 / 42 / 40 |
| **Suggested: arm hanging** [E, between the two rows above] | loose curl, increasing toward the little finger | 20 / 25 / 10 | 25 / 30 / 12 | 30 / 35 / 15 | 35 / 40 / 15 |
| **Suggested: dribbling hand** [E] | pad of hand cupped over the ball, fingers spread | 15 / 30 / 15 | 15 / 35 / 20 | 15 / 35 / 20 | 15 / 30 / 15 |

- The numbers in the suggested rows are MCP / PIP / DIP in degrees. The two sourced rows bracket the answer: one is nearly straight (supported hand), the other a deliberate curl. A hanging hand sits between them.
- Neff and Seidel's rest pose gives DIP/PIP of about 0.70–0.76 for the first three fingers (my arithmetic). They cite the common rule that DIP follows PIP at about 2/3 [S]. Use DIP = 0.5–0.7 x PIP so the tips are not hooked.
- Thumb at rest: slightly flexed and adducted, tip level with the index middle phalanx. The Neff and Seidel subject has thumb MCP 36 and IP 24, CMC abduction 42 and flexion 28 [S].
- Finger abduction at rest: about 5–10° between fingers, widening to 15–25° when spread over a ball [E].
- Cascade: flexion rises smoothly from index to little finger, and the fingertips all point near the thenar base [E].
- Wrist: 0° at rest in the sourced data; add 10–15° extension for a catching hand [E].

### Modelling at our budget

| Approach | Cost per hand | Reads at game distance | Notes |
|---|---|---|---|
| Mitten (one lump with a thumb) plus finger grooves in the normal map | 150–300 tris [E] | At 10+ m a mitten is fine; at replay distance it looks like a boxing glove | What we have now. |
| Mitten with four short ridge tips, sculpted valleys, thumb separate | 300–500 [E] | Reads as fingers at medium range, cheap | A good middle step. |
| Four separate fingers, 3 segments each, 6–8 sides around, plus palm and thumb | 500–900 [E] | Holds up in close-ups | The [VR hands pack](https://sketchfab.com/3d-models/free-pack-vr-hands-rigged-b3b8309e59c748e3956531c8f57dd233) is about 1.5k tris per hand [S, derived]. |

Practical points for an SDF mesher:
- A finger capsule is about 0.9–1.0 cm in radius with a 2–3 mm gap between relaxed fingers. Voxel size must be about half the gap or smaller (1–1.5 mm) in a hand region, or the fingers fuse. Use a finer sub-region for hands only, then decimate.
- Blend fingers into the palm with a small smooth-union radius (3–5 mm). Do not use a large one, or the webbing swallows the finger roots.
- Knuckle creases and nail beds go into the normal map; the PIP and MCP bumps are 1–2 mm of geometry.
- The sources describe 2K or 4K textures for hero characters; a hand takes only a small area of the atlas, so give hands their own texel density boost if the UV layout allows [E].

---

## 5. Jersey and shorts folds

The web gave only general principles, so the layout below is mostly my own synthesis of how fabric behaves [E]. What I could source:
- A normal map fakes fine detail but cannot change the silhouette, cast real shadows or alter physics; deep folds and repeatable features such as collar rolls and waistbands belong in geometry, baked to a normal map on the low mesh ([Style3D](https://www.style3d.com/blog/?p=13034)). 2K is the baseline texture size [S].
- Folds shift as the body moves. Some games blend between normal maps to handle it; otherwise "pick your folds wisely", and painted folds need a strong light to read ([Polycount, texturing folds](https://polycount.com/discussion/84717/texturing-folds)). Cloth sims handle hanging and dangling but struggle with wrinkling and bunching ([Polycount, FIFA creases](https://polycount.com/discussion/100729/how-do-they-do-the-creases-movement-on-games-like-fifa)) [S].
- A baked fold also stretches with bad UVs: wrinkles stretch at the shoulder and grow at the hem if texel density varies [S].

| Region | What happens | Geometry | Normal map and AO |
|---|---|---|---|
| Armhole opening (sleeveless jersey) | The edge stands off the shoulder, with a trim band 1–2 cm wide; it gaps under the arm and pulls tight over the deltoid. | Armhole edge as a rounded lip 2–3 mm thick; a gap under the arm when the arm is down | Trim ribbing, stitch line, a short tension crease running to the side from the shoulder point |
| Side seams | A straight vertical line from the armpit to the hem; fabric bunches into a few soft vertical folds beside it when the torso twists. | Slight offset of the side panel (1–2 mm) | Seam line, topstitch, 2–3 soft vertical folds beside it |
| Chest and back | Hangs in broad vertical drape from the shoulders; goes taut over pecs and lats; a loose jersey stands off the waist by 2–4 cm. | The loose A-line silhouette: this is the main thing geometry does | Faint drape lines under the pecs, number embossing |
| Armpit | Radial folds fanning from the armpit when the arm is raised (shooting, rebound). | Gap and drop of the armhole when the arm is up (skinning, not texture) | Radial crease set, switched on by arm height if you blend two maps [E] |
| Neckline | Rib collar 1.5–2 cm wide with a slight roll. | Collar thickness | Rib pattern |
| Hem (jersey) | Straight, falls loose over the waistband of the shorts; the side slits tug it up on one side when the hip flexes. | Hem thickness 1–2 mm and flare | Hem stitch line; tuck creases where it meets the shorts |
| Shorts waistband | Elastic gathers into fine vertical pleats at 2–3 cm pitch with a drawcord tunnel; sits at or just below the iliac crest. | Waistband thickness (3–5 mm raised ridge) and drawcord loop | Pleats, topstitch rows |
| Shorts legs | Wide tubes that hang free of the thigh; hem circumference about 1.5–1.8 x thigh; the hem ends above the knee when standing and swings forward when the leg lifts. | The whole tube and hem flare; the pocket sits flat | Diagonal creases from the hip fork when the hip flexes; vertical drape folds; mesh perforation grid |
| Shorts side vents and trim | A contrast stripe down the outer leg; a notch at the hem. | Notch shape | Stripe edge, stitch |

Drape for mesh jersey and shorts: lightweight, high drape and low stiffness, so folds are many, soft and shallow; heavy-cotton sharp creases will look wrong [E].

**Rule of thumb for the split [E]:** anything that changes the outline at 10 m (the A-line, hem flare, shorts leg width, collar roll, waistband thickness) goes in geometry. Anything under about 3 mm of relief (seams, stitching, pleats, perforation, small creases, ribbing) goes in the normal map. AO carries the dark armpit, under-collar and waistband shadow.

---

## 6. Hair at low poly

### Technique choices

| Style | Best technique | Cost | Notes |
|---|---|---|---|
| Afro | Clumped dome mesh (our SDF union of many blobs) plus a baked curl normal map; add a few alpha cards for fuzz at the rim | 1.5–3k tris [E] | Cards-only afros need three card layers (base, twisted tubes, silhouette) per the 80.lv article, which is expensive and looks flat from the side |
| Short crop | Thin shell hugging the skull (1–3 mm offset) with a directional strand normal map, plus a sharp hairline | 500–1,200 [E] | Hairline shape does most of the work; add a few cards at the nape and temples |
| Buzz cut | Head mesh only: darken the albedo on the scalp zone, add a fine noise normal map, no extra geometry | 0 extra | A 0.5 mm shell is optional, mostly to catch rim light |
| Waves | Shell with a wave normal or height map (rows of 3–5 cm) and ridge geometry in the top 20% | 800–2,000 [E] | Brush direction bakes into the map |
| Cornrows and braids | Geometry rows: extruded tubes 5–8 mm in diameter, about 1.2 cm between rows, 8–12 rows | 1–2.5k [E] | For distance, a normal-map version on a shell. The yelzkizi article suggests wrapping cards round a low-poly braid or baking a groom into a strip texture [S] |

Budgets from sources: hair cards 1k–10k tris by style ([3D Artist's Handbook](https://sidney-eliot.github.io/3d-artists-handbook/mesh/hair)); 5k–20k typical and 20k–40k high-end, with 2K atlases for mains and 1K or 512 for background characters (yelzkizi). The 80.lv article calls a 40k hair "quite heavy". Our whole body is 14.6k, so hair should stay at roughly 1.5–3k [E].

Method differences:
- **Cards:** cheapest for long, flowing hair; poor for tight curls seen from the side; alpha sorting and flicker; strands should be a few pixels wide to avoid aliasing [S].
- **Shells (offset meshes with a strand normal map):** best for short hair and buzz cuts; no transparency issues; silhouette stays smooth, so add breakup separately.
- **Normal map only:** valid for buzz cuts and tight waves at distance; the silhouette cannot change [S, general rule].

### Irregular afro silhouette, cheaply

1. **Union of clumps.** Build the dome from 25–60 ellipsoids or spheres, radius 3–7 cm, centres jittered on a 1.2–1.5 x head radius shell; use a small smooth-union radius (0.5–1 cm) so scallops between clumps remain. This is "thick clumps for volume, thin for variation" from the Games Artist breakdown, done in SDF [E].
2. **Low-frequency noise on the radius**, wavelength 8–15 cm, amplitude about 4–6%, so the outline varies across the whole head. Then break symmetry: the 80.lv afro artist worked one side, mirrored it, then ran a curl modifier on the mirrored side [S].
3. **High-frequency displacement** for coils: wavelength 1–2 cm, amplitude 2–4 mm, either in the SDF or in the bake.
4. **Bake the curl detail** into normal and AO maps, with AO strong in the gaps between clumps; bake AO into vertex colour too, as the 80.lv tips article does layer by layer [S].
5. **Flyaway layer:** 20–40 thin alpha cards (or small spikes) along the rim and crown, rotated off-angle, with tapered tips. Both yelzkizi and Games Artist recommend sparse thin cards for the outline halo [S].
6. **Hairline:** keep a distinct hairline on the forehead and temples with a soft transition (a few short cards or a gradient in the albedo); leave a little scalp showing between curls so the volume reads [S].
7. **Shading cues:** rim light and a darker interior (AO) make clumps read; an edge mask on the shader that keeps volume on back-facing cards helps [S, Games Artist].

---

## Not opened, or blocked

- Quaternius pack pages ([Ultimate Modular Men](https://quaternius.com/packs/ultimatemodularmen.html), [Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html)), [Kenney Animated Characters](https://kenney.nl/assets/animated-characters-1), [Wikipedia, Body proportions](https://en.wikipedia.org/wiki/Body_proportions): blocked by permission prompts. Row 1 comes from the itch.io listing instead.
- [OpenGameArt](https://opengameart.org/content/lowpoly-rpg-characters) and the [ANSUR II overview PDF](https://ph.health.mil/PHC%20Resource%20Library/ANSURIIDatabasesOverview.pdf): the sites disallow automated access. I used the public ANSUR II CSV instead.
- Several Sketchfab pages returned empty (lowpoly basketball players court, Kevin Durant, a Nike high-top scan, "free pack hands" aside), and the PMC finger-length table showed only a captcha page.
- No numeric proportion table from MakeHuman, no collar-height numbers from RunRepeat, no published figures on the 2K models' triangle counts.

## Sources

- ANSUR II: [Penn State Open Lab](https://www.openlab.psu.edu/ansur2/); male data [CSV](https://tools.openlab.psu.edu/publicData/ANSUR_II_MALE_Public.csv)
- NBA combine: [DraftExpress averages](https://www.draftexpress.com/average-measurements-by-position/all/NBA+Draft+Combine/all/60/); [theScore 2014 measurements](https://www.thescore.com/nba/news/502954); [nbadraft.net 2023](https://www.nbadraft.net/2023-nba-draft-combine-anthro-measurements/); [topendsports 2025](https://www.topendsports.com/sport/basketball/testing-draft-results-2025.htm)
- Wingspan: [Berkeley Sports Analytics](https://sportsanalytics.studentorg.berkeley.edu/articles/hands_up.html); [DOAJ, J. Anthropology of Sport and Physical Education 2018](https://doaj.org/article/c40514df450346fd88db7b1c5dfe26e7)
- Hand: [Kamper et al. 2003](https://www.ece.uvic.ca/~bctill/papers/mocap/Kamper_etal_2003.pdf); [Neff and Seidel 2006](https://www.cs.ucdavis.edu/~neff/papers/amdo_06_NeffSeidel.pdf); [PMC6760092 (finger bone ratios)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6760092)
- Sneakers: [RunRepeat](https://runrepeat.com/guides/best-mens-basketball-shoes); [Nike, parts of a shoe](https://www.nike.com/a/parts-of-shoe-anatomy); [Shoemakers Academy, Sneaker Construction 101](https://shoemakersacademy.com/wp-content/uploads/2023/01/Sneaker_Construction_101.pdf)
- Clothing: [Style3D](https://www.style3d.com/blog/?p=13034); [Polycount, texturing folds](https://polycount.com/discussion/84717/texturing-folds); [Polycount, FIFA creases](https://polycount.com/discussion/100729/how-do-they-do-the-creases-movement-on-games-like-fifa)
- Hair: [80.lv, techniques](https://80.lv/articles/techniques-for-game-character-hair-creation); [80.lv, tips](https://80.lv/articles/tips-tricks-on-hair-for-games/); [80.lv, afro in FiberShop](https://80.lv/articles/creating-real-time-afro-in-fibershop-marmoset-toolbag/); [80.lv, hair for real-time characters](https://80.lv/articles/creating-hair-for-real-time-game-characters/); [Games Artist, curly hair](https://gamesartist.co.uk/curly-hair-character-breakdown-thomas-sykutera/); [yelzkizi, real-time hair](https://yelzkizi.org/?p=36574); [3D Artist's Handbook, hair](https://sidney-eliot.github.io/3d-artists-handbook/mesh/hair)
- 2K pipeline: [Operation Sports, NBA 2K18](https://www.operationsports.com/nba-2k18-captures-many-details-gets-done); [SLAM, The Sole of 2K](https://slamonline.com/?p=836621)
- Free model sources: [Quaternius on itch](https://quaternius.itch.io/universal-base-characters); [cinevva guide to free rigged characters](https://app.cinevva.com/guides/free-rigged-3d-character-models); Sketchfab pages linked in section 1
- Body modelling docs: [MakeHuman, modeling the body](https://static.makehumancommunity.org/makehuman/docs/modeling_the_body.html)
