Original prompt: Implement the planned wanted behavior in city-pursuit and verify it without committing or deploying.

2026-09-08
- Added peaceful-start wanted state, delayed overspeed episode latch, moving-player crash offense, 42m/10s escape timer, independent checkpoint completion, parked police, debug fields, and responsive wanted HUD.
- `npm test` passes 19 tests; `npm run build` passes. Parent agent should run production preview and browser QA at port 5188.
