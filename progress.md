Original prompt: Implement the planned wanted behavior in city-pursuit and verify it without committing or deploying.

2026-09-08
- Added peaceful-start wanted state, delayed overspeed episode latch, moving-player crash offense, 42m/10s escape timer, independent checkpoint completion, parked police, debug fields, and responsive wanted HUD.
- `npm test` passes 19 tests; `npm run build` passes. Parent agent should run production preview and browser QA at port 5188.

2026-09-08
- Player power pass: ordinary acceleration 28 / cap 25 reaches above police cruise 15; Shift boost uses acceleration 36 / cap 34.
- Vehicle contact now preserves forward player momentum and transfers a capped, decaying `impact` vector (12 NPC / 15 police) for 0.55 seconds. Impact movement runs after AI and validates road/building boundaries; AI movement is suspended during impact and police waypoints reset after a shove.
- Added speed comparison and multi-frame NPC/police push plus world-boundary regression coverage. `npm test -- --run` passes 38 tests. Parent agent should run browser QA and preview at port 5188.
- Added low-speed held-throttle head-on coverage for NPC and police, plus building-side separation coverage. Collision separation now validates both half and full player displacement against road/buildings/boundaries before assigning positions.
