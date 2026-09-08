# Testing

## Automated

`npm test` — simulation tests 19/19 passed.

`npm run build` — TypeScript and Vite production build passed. The generated JavaScript bundle is about 2.6 MB (923 KB gzip); Vite reports this as a size warning.

## Browser integration

DOM, canvas geometry, state hooks, and browser input were verified in the built preview. W+Shift driving moved the player from `z=66` to `z=22.4`; checkpoint 1 advanced to `1/5` with score `535`. D+Space+W changed heading and position. P paused the simulation and froze time. A diagnostic collision applied 18 damage, timeout showed `BUSTED`, and restart reset state. A diagnostic ordered-checkpoint run reached `5/5` and showed `ESCAPED` after the required separation interval.

At 390×844, touch acceleration worked, no horizontal overflow was present, and pause, minimap, mission, and touch controls did not overlap. After resize, the canvas matched the viewport and reported four shared textures with `atlasReady=true`.

The production preview also verified the wanted contract: after 20 seconds without input, police positions remained unchanged and `wanted=false`; W+Shift activated speeding only after the 1.5-second threshold and exposed the speeding reason, alert, pursuit movement, and 10-second countdown. Pause froze `escapeTime` and `alertTime`; reapproach reset the countdown. With the player at `(66,66)` and police at `(-66,-66)`, wanted cleared before any checkpoint at 0/5, police stayed parked afterward, and the HUD showed `추격 해제`. A moving vehicle collision retriggered wanted with `vehicle-crash`; `R` cleared wanted, reason, timers, and the speeding latch. At 390×844 the wanted panel occupied `x=16,y=282,w=358,h=128` without overlapping the map, mission, or touch controls.

## Evidence boundaries

Diagnostic state injection was used only for collision, timeout, and complete-mission win states; it is recorded separately from manual keyboard and touch evidence. Native ego-browser raster screenshots were unavailable after repeated capture timeouts, so this release does not claim screenshot-based visual QA. VoiceOver verification was excluded by plan. The favicon is included to avoid a `/favicon.ico` 404.

## Assets

`public/assets/city-atlas.png` was generated with the ChatGPT built-in image generation model. The renderer crops its four quadrants in-browser and shares sRGB CanvasTextures for the road, facade, and vehicle paint materials.
