# Research notes — Bangkok plot tool

Working notes from the research session (19 Nov 2026). These are reference notes, not the write-up. Write the doc in your own words.

## 1. Which law applies

Two layers of rules apply, and the stricter one wins.

1. **Bangkok Comprehensive Plan B.E. 2556 (2013).** Ministerial Regulation, Royal Gazette vol. 130, part 41 Kor, 16 May 2013. It sets the zone, the allowed uses, FAR and OSR. It is **still in force**: the 4th revision is only a draft. Its public objection period closed on 9 Nov 2026 with about 5,000 petitions, and it is expected to take effect in mid-to-late 2027.
   - **Decision:** use the 2013 plan and mention the draft as future work.
2. **Building Control Act B.E. 2522 and its ministerial regulations (MR):**
   - **MR 55 (2000):** setbacks, open space and the road-based height limit.
   - **MR 33 (1992, amended):** high-rise buildings (23 m or taller) and extra-large buildings (10,000 m² or more).
3. **Bangkok Building Control Ordinance B.E. 2544 (2001).** Checked from the ASA copy (see section 3b). Published in the Royal Gazette vol. 118, special part 75 Ngor, 3 Aug 2001.
   - **Amendment check (19 Nov 2026):**
     - **No amendment found** to this general ordinance.
     - The ASA law index still lists this file as the current copy.
     - The lawplayer consolidated copy ("updated 2569") shows no amendment notes.
     - The 2023 BMA repeal ordinance (Gazette vol. 140, special part 68 Ngor, 22 Mar 2023) cancels only old **area-ban** ordinances, not this one.
   - **Royal Gazette check done (19 Nov 2026).** The user searched ratchakitcha.soc.go.th by title for "ข้อบัญญัติกรุงเทพมหานคร เรื่อง ควบคุมอาคาร" and got **2 results only**:
     1. The original ordinance B.E. 2544: vol. 118, special part 75 Ngor, p. 18, 3 Aug 2001. Same as our copy.
     2. An ordinance on the brightness of lit signs, B.E. 2569 (vol. 143, special part 152 Ngor, p. 22, 18 Jun 2026). It covers signs only and does not affect the building envelope.
   - **There is no "(No. 2)" or later amendment in the Gazette**, so the 2001 text is current.
4. **Area-specific BMA ordinances (ข้อบัญญัติกำหนดบริเวณห้ามก่อสร้าง…).** These are separate ordinances for named sub-districts. They set height caps or bans, for example:
   - Rattanakosin old town, and the Thonburi bank opposite it (amended 2020).
   - Samphanthawong / Pom Prap (1999).
   - A 2022 "(No. 2)" ordinance with height ceilings by area.
   - **None of these cover the Sukhumvit / ย.9 area we plan to use.** The tool should still say "site not in a special height-control area" and name this as a check that an architect would do.

## 2. FAR and OSR by zone (from the Gazette text, verified)

Notes on the definitions:

- **OSR** is open space as a **% of total floor area**, not of the plot. Open space = OSR × GFA.
- In zones ย.8–ย.10, at least 50% of that open space must be permeable ground for planting.

| Zone    | Meaning                                                      | FAR                | OSR %               |
| ------- | ------------------------------------------------------------ | ------------------ | ------------------- |
| ย.1–ย.4 | Low-density residential (yellow)                             | 1 / 1.5 / 2.5 / 3  | 40 / 20 / 12.5 / 10 |
| ย.5–ย.7 | Medium-density residential (orange)                          | 4 / 4.5 / 5        | 7.5 / 6.5 / 6       |
| ย.8     | High-density residential (brown)                             | 6                  | 5                   |
| **ย.9** | High-density residential, inner city, served by mass transit | **7**              | **4.5**             |
| ย.10    | High-density residential, next to the CBD                    | 8                  | 4                   |
| พ.1–พ.5 | Commercial (red)                                             | 5 / 6 / 7 / 8 / 10 | 6 / 5 / 4.5 / 4 / 3 |
| อ.1–อ.3 | Industrial / warehouse                                       | 2 / 1.5 / 1        | 15 / 20 / 40        |
| ก.1–ก.5 | Rural / agricultural (green)                                 | 0.5–1              | 40–100              |
| ศ.1–ศ.2 | Thai cultural conservation                                   | 3 / 4              | 10 / 7.5            |

**Uses in ย.9 (clause 16).** A condo (residential) is allowed and is not tied to road width by the plan. Other uses are limited:

- Hotels over 80 rooms need a road at least 12 m wide, or must be within 500 m of a rail station.
- Commerce over 5,000 m² needs a 12 m road (up to 10,000 m²) or a 16 m road (above that), or must be within 500 m of a station.
- Offices over 10,000 m² need a 16 m road, or must be within 500 m of a station.

**Road frontage (clause 36).** Wherever a use requires an "X m road", the plot must have at least 12 m of frontage on that road (16 m or 30 m frontage for 16 m or 30 m roads). The road must connect through to the wider road network.

## 3. Building Control rules (verified from the MR texts)

**MR 55, clause 41: building line setback from the road**

- Road narrower than 6 m: the building line is at least 3 m from the road centreline.
- This applies to buildings over 2 storeys or 8 m, and to commercial and other building types:
  - Road narrower than 10 m: **6 m from the road centreline**.
  - Road 10–20 m: **1/10 of the road width**, measured from the road edge.
  - Road over 20 m: **2 m** from the road edge.

**MR 55, clause 44: height from the road**

- At every point, height ≤ 2 × the horizontal distance to the **far edge** of the nearest public road. This gives a sloped plane rising from the road, not a flat cap.
- Clauses 45 and 46 cover plots between two roads, or at a corner of two roads of different widths. There, the wider road is used, with 60 m length limits. Possible stretch goal.

**MR 55, clause 50: walls with windows**

- Height ≤ 9 m: at least 2 m from the plot boundary.
- Height 9–23 m: at least 3 m.
- A blank wall may be closer: at least 0.5 m from the boundary, or built right on it up to 15 m with the neighbour's written consent.

**MR 55, clause 33: open space for residential buildings**

- At least **30% of the largest floor plate** must be left open.

**MR 33: high-rise (23 m or taller) and extra-large (10,000 m² or more) buildings**

- **Clause 2, road access:**
  - GFA up to 30,000 m²: at least 12 m of plot frontage on a public road **at least 10 m wide**.
  - GFA over 30,000 m²: the road must be **at least 18 m wide**.
- **Clause 3:** a 6 m fire-truck road all around the building.
- **Clause 4:** the outer edge of the building, above and below ground, must be at least **6 m from neighbours' land and from public roads**.
- **Clause 5:** FAR at most 10 (the zone FAR is stricter here anyway).
- **Clause 6:** residential buildings need open space of at least **30% of the plot**.

**Thresholds the tool should react to**

- 23 m height: high-rise rules switch on.
- 10,000 m² GFA: extra-large building rules switch on.
- 30,000 m² GFA: the road must be 18 m wide or more.

**Mixed sources to note.** Several secondary websites misstate these rules. Examples: "30 m road for 10,000 m²", and "10,000 m² cap on narrow roads" (Bangkok Post, 2019). These were checked against the primary texts above. This is good material for the "what the AI missed" note.

## 3b. Bangkok Building Control Ordinance 2544 (verified from the text)

In Bangkok this ordinance sits on top of MR 55. Where it is stricter, it wins.

- **Clause 49: height from the road.** Same 2× rule as MR 55.
  - **Extra for Bangkok:** if the plot is on, or within 100 m of, a road **at least 80 m wide**, with a 12 m access route to it, the height is worked out from that wide road. This is rare and is a stretch goal.
- **Clause 50: building line setback.** Same tiers as MR 55: under 6 m road → 3 m from the centreline; under 10 m → 6 m from the centreline; 10–20 m → 1/10 of the width; over 20 m → 2 m.
  - It explicitly covers large buildings.
  - **Exempt:** homes up to 3 storeys / 10 m and up to 1,000 m².
- **Clause 52(1): residential open space ≥ 30% of the PLOT AREA.**
  - This is **stricter than MR 55**, which only asks for 30% of the largest floor.
  - **For a condo this sets the maximum footprint: 70% of the plot**, before setbacks. Non-residential buildings: 10%.
- **Clause 52(6) and clause 53: the "L/6 or L/8" fire-access rule.** This applies to buildings over 2 storeys or 8 m, commercial and public buildings.
  - **Option A (clause 53):** the building face along the public road is longer than **1/8 of the building's outer perimeter**, and that face is **no more than 20 m from the road**.
  - **Option B (clause 52(6)):** a front open space at least **6 m wide (12 m if over 3 storeys)**. It runs continuously for at least **1/6 of the building perimeter** and joins the public road through a **6 m internal road**.
  - **Decision for the tool:** check Option A, which is the normal case for a condo on a road, and show it in the checklist.
- **Clause 54: walls with openings.** Must be 2 m from the boundary (up to 9 m height or the 2nd floor) and 3 m above that. Same as MR 55.
- **Clause 55: clear space all around.** At least 1 m for buildings up to 15 m, and **2 m for buildings over 15 m**. MR 33's 6 m rule for high-rises is stricter anyway.
- **Clauses 83–86: parking.**
  - Condo or apartment with units of **60 m² or more: 1 space per unit**.
  - Large building: **1 space per 120 m²** of floor area.
  - **The higher figure applies** (clause 85).
  - Bay size: 2.4 × 5 m.
  - Parking floors above ground count toward GFA, so parking competes with sellable area.
  - **Decision:** show the parking count and an approximate parking area in each design. Do not model the ramps.
  - The draft 4th plan would allow up to a 25% cut near major stations. This is not in force.

**What this changes in the envelope calculation:**

1. Footprint ≤ 70% of the plot for residential (Bangkok clause 52(1)). For a high-rise condo, MR 33 clause 6 says the same.
2. Required open space = max(30% of the plot, OSR × GFA). In ย.9, OSR × GFA = 4.5% × 7 × plot = 31.5% of the plot at full FAR, so **the zone OSR is the binding rule at full FAR**, just above 30%. This is a useful finding: the two rules nearly meet.
3. Add the frontage check: road-facing wall > perimeter/8 and ≤ 20 m from the road.
4. Add parking spaces to the design summary.

## 4. Proposed scope decision

- **Zone:** ย.9, high-density residential, FAR 7, OSR 4.5%. It is the most common condo zone along BTS/MRT lines (Sukhumvit, Ratchada and others), so condo is the natural building type. Offer condo, plus hotel and office, to show the road-width rules changing.
- **Site:** northern Thong Lo, zone ย.9, confirmed with the zoning layer (section 5d). A sample plot is pre-loaded.
- **Envelope calculation:**
  1. **Road side:** the building line is the **larger** of two distances, never the two added together:
     - (a) the road setback from MR 55 clause 41 / BMA clause 50. Under 10 m road: 6 m from the centreline. 10–20 m: 1/10 of the width from the edge. Over 20 m: 2 m from the edge.
     - (b) for a high-rise only, **6 m from the road edge** (MR 33 clause 4).
     - Both are converted to a distance from the plot's road edge before comparing. Examples:
       - Thong Lo, 25 m wide: (a) = 2 m, (b) = 6 m → **6 m** for a high-rise, **2 m** for a mid-rise.
       - 8 m soi: (a) = 6 m from the centreline = **2 m** from the plot edge; (b) = 6 m → **6 m** for a high-rise, **2 m** for a mid-rise.
  2. **Other sides (neighbours):** see section 5f. High-rise: 6 m (MR 33 clause 4). Mid-rise: 2 m up to 9 m height, 3 m from 9 m to under 23 m (all walls have windows).
  3. Clip the height with the 2× road-distance plane (clause 44).
  4. Check GFA ≤ FAR × plot area, open space ≥ max(OSR × GFA, 30% of the plot) with half of it permeable, frontage ≥ 12 m, and road width ≥ 10 m or 18 m.

## 5. Site data

- **Zoning map:** the BMA publishes the 2013 zoning map through a public ArcGIS service (the DOL "LupDolWms" layer, EPSG:32647). An open-source project converted it to GeoJSON (498 zones, 1.4 MB). Tested and spot-checked in section 5c. An official per-district PDF map is on the BMA CPUD web portal.
- **Buildings:** OpenStreetMap through Overpass. In a test area around Phrom Phong / Sukhumvit (about 1.4 × 1.8 km): **2,095 buildings, but only 278 (13%) have height or levels tags**.
  - **Fallback needed:** Overture buildings, or Global Building Atlas / 3D-GloBFP modelled heights, or an estimate from footprint size.
  - The tool must show which heights are real and which are estimated.
- **Roads:** OSM roads with `width` / `lanes` tags. Road width must still be user-editable, because the legal road reserve width (เขตทาง) is not in OSM.

## 5a. How to count floor area, open space and height (definitions, MR 33 clause 1 as amended by MR 50)

- **Floor area (พื้นที่อาคาร):**
  - The floor area of every storey that people can enter or use, measured to the outer edge of the beams or walls.
  - It **includes balconies and verandas**, and therefore also enclosed parking floors.
  - It **excludes the open roof deck** and stairs above the roof.
  - **FAR = floor area of all storeys of all buildings / plot area.** The 2013 plan uses the same wording.
- **Open space (ที่ว่าง):** land with no roof or structure over it. It **can include outdoor parking, pools, wastewater tanks and refuse areas**, and anything built no higher than 1.20 m with nothing above it.
  - **Decision:** podium roof gardens above 1.2 m do NOT count as open space.
  - In ย.9, half of the open space must be permeable planting.
- **Height:**
  - For high-rise status (23 m), measure from ground to the **roof deck**.
  - For the MR 55 / BMA 2× road rule, measure to the **highest part** of the building, not counting rooftop structures.
  - **Decision:** use the roof slab for the 23 m test and the parapet top for the road rule.
- **Plot area:** the land in the title deed(s) used in the permit application. Several adjoining deeds can be combined.

## 5b. Other laws checked (affect the checklist, not the envelope shape)

- **Planned road widening lines (Comprehensive Plan clause 36, last paragraph).**
  - For roads listed as "Road Kor / Khor, existing road to be widened", the **planned** road boundary counts as the road line.
  - It is used for setbacks and distances.
  - **Decision:** the road width input means the legal or planned width. The tool notes this and does not model specific widening plans.
- **EIA (environmental impact assessment).**
  - Under the Environmental Quality Act and the MNRE notification, condos with **80 units or more, or 4,000 m² or more of usable area**, need an EIA, reviewed by ONEP (about 6 months).
  - Hotels: 80 rooms (one source says 60, which conflicts).
  - **Decision:** show this as a flag in the checklist ("EIA required"). It is not a pass/fail rule. Source: secondary (Lexology and others). The notification text itself was not read.
- **Airport height control (Air Navigation Act s.58, CAAT safety zones).**
  - Sukhumvit is about 20 km from both Don Mueang and Suvarnabhumi. The one old navigation-aid zone in Bangkok (Thung Maha Mek) has been removed.
  - **Decision:** out of scope for the chosen site. Mention it in "what's still wrong".
- **Not modelled:** accessibility rules (MR 2548), fire and lift systems, the energy code. They affect the inside of the building, not what can be built where.

## 5c. Zoning map data (tested 19 Nov 2026)

- **Official source:** BMA ArcGIS 10.0 service `http://3d-cpd.bangkok.go.th/ArcGIS/rest/services/DOL/LupDolWms/MapServer`.
  - Layer 1 = 2013 plan zones. Layer 0 = planned roads (ถนนสาย ก/ข with right-of-way widths).
  - **Not reachable from here:** the connection failed, maybe because it blocks traffic from outside Thailand.
  - It is plain http only, so an https web app could not call it live anyway.
- **Usable copy:** the GeoJSON conversion of that service in github.com/Kanesuan/KNS.MAP (PR #6).
  - `bkk-zoning-current.geojson`: 498 polygons, 1.4 MB, properties `{zone, category}`.
  - `bkk-planned-roads.geojson`: 136 lines, `{code, widthM, name}`.
  - Downloaded copies are in the session scratchpad.
  - The plan is a ministerial regulation, so it is not copyrighted (Copyright Act s.7).
- **Spot checks:**
  - Siam and Asok → พ.5 (commercial).
  - Phrom Phong, Thong Lo south, Ekkamai and Ari → ย.10.
  - Ratchada / Huai Khwang → ย.9.
  - On Thong Lo itself: **ย.10 from Sukhumvit Rd up to about lat 13.734 (around Soi 10), then ย.9 north to Phetchaburi**. This matches a land-sale listing on Soi 55 that says "ย.9", an independent check.
- **Planned roads near Thong Lo:** several ข-class 16 m projects on nearby sois. Thong Lo road itself is not one of them.
- **Decision:**
  - Ship both GeoJSON files as static assets.
  - Look up the zone by point-in-polygon on the plot's centroid.
  - **Flag plots that cross a zone boundary.** The plan applies each zone's rules to its own part; v1 only flags this.
  - Show "planned road widening" when a plot's road matches a planned-road line.
- **Lesson for the build:** the public Overpass API returned 502 errors twice, on the main server and on a mirror. **Do not call Overpass while the tool runs.** Fetch the buildings and roads once and ship them as a static file.

## 5d. Proposed site

- **Site: Thong Lo (Sukhumvit Soi 55), Watthana district, northern half, zone ย.9.** Around lat 13.737–13.741, lon 100.582–100.585.
  - Thong Lo road is **about 25 m wide** (Thai Wikipedia: widened from 5 m, now 25 m and 2,248 m long), so the setback is 2 m from the road edge (more than 20 m wide).
  - Side sois are narrow (under 10 m), giving a **6 m setback from the soi centreline**. Switching the frontage road between Thong Lo and a soi shows the rules changing live.
  - The ย.10 / ย.9 boundary nearby is a good test case: drag the plot south and the zone changes.
- **Plot outline:** Thai land parcel (cadastre) data from DOL LandsMaps is not open data. **Decision:** the user draws the plot. The tool pre-loads a sample irregular plot of about 3,000–5,000 m² on Thong Lo. A real listing on Soi 55 gives a sense of scale: 64 m frontage × 128 m deep, 4-3-71 rai ≈ 7,884 m².
- **Road width:** OSM almost never tags width here, so the user enters the legal width. Defaults: main road (Thong Lo) 25 m; soi 8 m.

## 5e. Condo design numbers (law where it exists, otherwise labelled assumptions)

**Legal minimums (MR 55, clauses 19–22):**

- Unit at least 20 m².
- Corridor in a residential block at least 1.50 m.
- Bedroom at least 8 m² and 2.5 m wide.
- **Floor to floor at least 2.60 m** for homes, 3.00 m for offices, 3.50 m for shops.

**Assumptions for the concept designs (to state in the write-up as assumptions, not sourced facts):**

- Typical residential floor-to-floor: **3.0 m**. Ground lobby/retail: **4.5 m**. Parking podium floors: **3.0 m**.
- Double-loaded slab tower: depth about **18–22 m** (units 7–9 m deep on each side of a 1.5–2 m corridor).
- Core (lifts, 2 fire stairs, services): about **10–12%** of the floor plate.
- Net sellable / GFA: about **60–70%**, after the core, corridors, walls, balconies, and parking and lobby in the GFA.
- **Unit mix (fixed for v1, so every count is an exact number):**
  - **70% 1-bed at 30 m²** and **30% 2-bed at 55 m²**, by number of units.
  - **Average unit = 0.7 × 30 + 0.3 × 55 = 37.5 m².**
  - Background: newer Bangkok condos have units of about 20–35 m² (IDEA Journal 2011). Both sizes are above the 20 m² legal minimum.
  - **Both unit types are under 60 m²**, so the "1 space per unit" rule never applies in v1 (BMA clause 83(3)).
- **Sellable efficiency:** sellable area = **75% of the residential floors' GFA**. The other 25% is the core, corridors and walls. Parking and lobby floors are counted separately and are not residential GFA.
- **Unit count** = floor(residential GFA × 0.75 / 37.5) = **floor(residential GFA / 50)**, i.e. one unit per 50 m² of residential floor.
  - 1-bed count = round(0.7 × units); 2-bed = units − 1-bed.
  - Example: 20,000 m² of residential GFA → 400 units (280 one-bed + 120 two-bed).
- **Condo parking** = **ceil(max(units with 60 m² or more → 0 in v1, non-parking GFA / 120))** (BMA clauses 84(3), 84(16), 85: the higher figure wins, and any fraction rounds up).
  - **Assumption:** the 120 m² base excludes the parking floors themselves, to avoid circular maths. Parking area per space (bay plus its share of driveway and ramp) = **30 m²**.
  - **Check against a real project:** Lumpini Din Daeng, 30 storeys, 491 units, 219 spaces, which fits the 1-per-120 m² rule. Car stackers are common but not modelled.
- **EIA flag** = units ≥ 80 **or** total GFA ≥ 4,000 m². **Assumption:** "usable area" is treated as total GFA, which is the cautious reading.
  - In practice almost any high-rise here sets off the flag. The tool shows it as information, not as a fail.

## 5f. Side walls, basements, and parking for hotels and offices (decisions)

- **Windows on side walls: decision = every wall of every design has windows.** Homes, hotel rooms and offices all need light and air, and a blank wall facing a neighbour is a design choice an architect would make later.
  - **Mid-rise (under 23 m):** side and rear setback = **2 m** for the part up to 9 m high, **3 m** for the part from 9 m to under 23 m (MR 55 clause 50, BMA clause 54). BMA clause 55's 1–2 m clear space is covered by this.
    - **Simplification:** the 3 m setback is applied to the whole mid-rise block, not stepped at 9 m.
  - **High-rise (23 m or more):** **6 m** from neighbours' land, above and below ground (MR 33 clause 4). The podium is part of the same building, so it also keeps 6 m.
  - **Not used:** the blank-wall option (0.5 m, or on the boundary up to 15 m with the neighbour's written consent). It is listed in "what's still wrong" as a way to gain footprint.
- **Basements: decision = no basements in v1. All parking is in an above-ground podium.**
  - **Why:** Bangkok sits on soft clay with a high water table, so basements are expensive and slow to build. Above-ground podium parking is the usual pattern for Bangkok condos.
  - **How they would count:** the MR 33 definition of floor area covers every storey people can use and does not exclude floors below ground. So **a basement would count toward GFA and FAR**, and MR 33 clause 4 also applies the 6 m setback below ground.
  - Basements are therefore not a loophole for extra floor area. Noted as future work.
- **Hotel parking (BMA clause 84(2)):**
  - Up to 100 rooms: **10 spaces for the first 30 rooms + 1 per 5 rooms above 30**.
  - Over 100 rooms: **24 spaces for the first 100 + 1 per 10 rooms above 100**.
  - Compare with the large-building rule (non-parking GFA / 120) and **use the higher figure** (clause 85). The lobby rule 84(17) (1 per 10 m² of lobby) is **not modelled**.
  - **Assumption:** **1 room per 50 m²** of hotel-floor GFA (about a 32 m² room plus corridor, core and back-of-house). Hotel floor-to-floor **3.2 m**.
  - **Flags:** hotel over 80 rooms needs a 12 m road or must be within 500 m of a station (plan clause 16). EIA at 80 rooms or more, a threshold that conflicts across sources (one says 60).
- **Office parking (BMA clause 84(6)):** **1 space per 60 m²** of office floor area. This is always higher than 1 per 120 m², so it wins.
  - **Assumption:** office floor area = non-parking GFA. Office floor-to-floor **3.6 m** (legal minimum 3.0 m).
  - **Flag:** office over 10,000 m² needs a 16 m road or must be within 500 m of a station (plan clause 16).
- The ground floor has a 4.5 m lobby for all three building types. Parking podium floors are 3.0 m.

**Two designs to generate:**

1. **Tower + podium:** a parking podium over most of the buildable footprint, with a slim tower above, set back further.
2. **Mid-rise slab(s):** under 23 m, so not a high-rise. It avoids the 6 m all-round rule and the extra high-rise requirements, but reaches a lower GFA.

This compares "maximum floor area" against "faster and cheaper to permit", which is a real decision for a developer.

## 6. Open questions (make a call and write it down)

All earlier open questions are now settled; the remaining items are known limits for the write-up.

- **Road width:** legal road width (เขตทาง) ≠ paved width. The user enters the legal width; defaults are Thong Lo 25 m and soi 8 m.
- **Bangkok Building Control Ordinance 2544:** settled — confirmed current by the Royal Gazette search (see section 1).
- **Area-specific height-ban ordinances:** not modelled. The tool states that the site is outside those areas.
- **Bonus FAR schemes** (affordable housing, open space, green building, near stations; up to +20%): not included in v1.
- **Basements:** settled — none in v1 (section 5f).
- **Parking for condo, hotel and office:** settled — modelled (sections 5e and 5f). Car stackers and the 25% cut proposed near stations are not modelled.
- **Not modelled:**
  - the blank-wall option on side walls
  - the stepped setback at 9 m for mid-rise blocks
  - the hotel lobby parking rule
  - corner plots and plots between two roads (MR 55 clauses 45–46)

## Sources

- Bangkok Comprehensive Plan 2556, Royal Gazette text: https://download.asa.or.th/03media/04law/cpa/mr56-bma.pdf
- MR 55 (with amendments to MR 68): https://download.asa.or.th/03media/04law/fubr/a1_bcmr55-63.pdf
- MR 33 (updated 2569): https://download.asa.or.th/03media/04law/cba/mr/mr35-33-upd69.pdf
- Bangkok Building Control Ordinance 2544 (ASA copy): https://download.asa.or.th/03media/04law/cba/bb/bb44-03.pdf
- ASA building-law index: https://asa.or.th/laws-and-regulations/cba/
- Consolidated ordinance text: https://lawplayer.com/th/act/pythainlp_913eb25903dfb0d1
- BMA repeal ordinance 2566: http://download.asa.or.th/03media/04law/cba/bb/bb66.pdf
- Area height-ban ordinances: https://download.asa.or.th/03media/04law/cba/bb/bb63(02).pdf , https://download.asa.or.th/03media/04law/cba/bb/bb42-upd(02).pdf
- Parking reform proposal (draft only): https://www.jll.com/en-au/insights/bangkoks-parking-reform-faces-market-reality , https://www.nationthailand.com/business/property/40068634
- 4th revision status: https://www.nationthailand.com/business/property/40073336 , https://thethaiger.com/news/bangkok/bangkoks-new-city-plan-expected-by-2027-amid-zoning-changes
- Bonus FAR overview: https://www.oecd.org/content/dam/oecd/en/publications/reports/2015/08/green-growth-in-bangkok-thailand_g1g5708b/9789264237087-en.pdf
- BMA district zoning maps: https://webportal.bangkok.go.th/cpud/page/sub/22628/
- Zoning GeoJSON conversion: https://github.com/Kanesuan/KNS.MAP/pull/6
- Thong Lo road (25 m wide): https://th.wikipedia.org/wiki/ถนนทองหล่อ
- Soi 55 land listing (ย.9, 64 × 128 m): https://www.teedin108.com/land/view/4029012/
- Small Bangkok condo units: https://journal.idea-edu.com/index.php/home/article/download/109/69/345
- Lumpini parking example: https://www.checkraka.com/condo/article/112543
- Overture buildings: https://docs.overturemaps.org/guides/buildings
- Bangkok building height research: https://mdpi.com/2072-4292/17/7/1204
- Global Building Atlas: https://un-spider.org/news-and-events/news/globalbuildingatlas-open-global-3d-buildings-data-digital-twins-and-disaster
