# City Pursuit — implementation plan

Date: 2026-09-08

## Outcome
A browser-playable 3D city pursuit game, complete source and public deployment. Keep existing parent project untouched; own city-pursuit/ only.

## Play loop
Start → drive through city grid → collect ordered checkpoints → lose pursuing police → escape result; collisions damage vehicle and timeout/damage cause failure. Restart must reset everything.

## Design
Warm dusk, stylized architectural city, teal sports coupe, black/white police with flashing lights, amber checkpoint gates. Full-bleed Three.js playfield with restrained DOM HUD: speed, score, damage, checkpoint count, timer, pursuit distance, minimap, pause/help/update controls. Keyboard WASD/arrows, Space handbrake, Shift boost, P/Escape pause, R restart. Responsive touch steering/pedals. Korean primary UI. Visible update history. No voice features/testing.

## Architecture
Vite + TypeScript + Three.js; simulation independent of rendering. Fixed-step responsive arcade vehicle dynamics; Rapier collision bridge if feasible, street-aware police routing and traffic driving. Roads form traversable interconnected city grid, solid buildings and boundaries. Smooth follow camera, visible checkpoint direction and minimap. Modules stay below 500 lines. Debug/test hooks gated to development or explicit test query.

## Visual assets
Higgsfield nano_banana_pro requested four-quadrant road/building/car texture and visual reference atlas. Request rejected: Out of credits on free (null) plan in Private workspace. Do not claim generated assets exist. User clarification pending; implement procedural materials so game remains playable. Record exact provenance and later replace textures if credits are restored.

## Implementation ownership
Planning/orchestration/review: parent. Code, test fixes and release: gpt-5.6-luna delegated agent, per user AGENTS.md.

## Verification and release
Meaningful simulation tests for acceleration/braking/steering, collision, pursuit routing, checkpoints order, score, victory/failure/restart. Build and browser playtest using ego-browser. Test actual keyboard driving, traffic/building collision, progression, pause/restart, mobile layout and console errors. Include forced-state diagnostic tests separately from manual driving evidence. Resolve observed problems; no VoiceOver test. Inspect deployment auth and publish to existing authorized GitHub account via isolated repo/Pages or available deployment provider. Source README, credits, verification report, source ZIP, playable URL. Do not claim deployment if blocked.

## Approved asset provider change
User explicitly requested ChatGPT built-in image generation instead of Higgsfield. Atlas generated successfully using image_gen on 2026-09-08, including asphalt, window facade, teal paint and car-chase concept quadrants. Implementation must copy the original PNG into public/assets and use the three textures in the 3D renderer. Higgsfield retry is no longer required.
