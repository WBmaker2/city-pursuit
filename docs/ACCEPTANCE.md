# Acceptance review

## Functional gates
- A cold visit shows rendered 3D city and a clear start action; no loading dead end.
- Start begins a bounded chase with ordered checkpoint progression and readable next objective.
- Real keyboard input accelerates, steers both ways, brakes, reverses or permits recovery, and boosts.
- Traffic moves on streets; police meaningfully pursue around building blocks rather than phasing through them.
- Solid boundaries/buildings and traffic collisions cause visible response/damage without trapping the player irrecoverably.
- Checkpoint rewards apply once and only to the next checkpoint.
- Escape requires completing checkpoints and meeting pursuit separation/time criteria.
- Failure produces an actionable restart; restart fully resets cars, score, clock, health and checkpoint state.
- Pause and focus loss freeze simulation and clear held inputs; resume works.
- Mobile HUD and touch controls fit within viewport without blocking essential objectives.
- Score/progress remain readable while driving. Reduced motion respects UI preferences.

## Evidence separation
1. Automated simulation tests exercise arithmetic, progression, AI and collision contracts.
2. Browser input verifies integration of UI, actual held keys, simulation and rendering.
3. Explicit diagnostic setup may position vehicles to cover rare states; mark those tests as diagnostic, not a full keyboard-only mission.
4. Public URL must independently load deployed assets and accept driving input.
5. No VoiceOver verification. No claim of physical device testing without one.

## Asset constraint
Higgsfield texture/reference generation was attempted and failed due to insufficient workspace credits. Pending user credit restoration, ship original procedural textures with truthful provenance. This is a partial requirement, not Higgsfield completion.

## Updated asset acceptance
User approved ChatGPT built-in image generator replacing Higgsfield. Verify generated atlas is included in source and deployed files, and road/facade/car maps reference actual generated pixels. Earlier credit constraint is superseded by this provider change.
