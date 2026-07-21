# Game UI Full Redraw — Design QA

- Source visual truth: `docs/superpowers/specs/assets/2026-07-18-game-ui-graphic-arcade-reference.png`
- Full comparison evidence: `/private/tmp/game-ui-redraw-qa/comparison.png`
- Focused comparison evidence:
  - `/private/tmp/game-ui-redraw-qa/focused-day1.png`
  - `/private/tmp/game-ui-redraw-qa/focused-day4.png`
  - `/private/tmp/game-ui-redraw-qa/focused-day5.png`
- Implementation screenshots:
  - `/private/tmp/game-ui-redraw-qa/day1-play.png`
  - `/private/tmp/game-ui-redraw-qa/day4-fight.png`
  - `/private/tmp/game-ui-redraw-qa/day5-play.png`
  - `/private/tmp/little-fighter-sprite-qa/title.png`
  - `/private/tmp/little-fighter-sprite-qa/deliverable-select.png`
  - `/private/tmp/little-fighter-sprite-qa/fight.png`
  - `/private/tmp/little-fighter-sprite-qa/attack.png`
  - `/private/tmp/little-fighter-sprite-qa/2p.png`
  - `/private/tmp/little-fighter-sprite-qa/2v2.png`
  - `/private/tmp/little-fighter-sprite-qa/responsive-844x390.png`
- Desktop viewport: 1280 × 720
- Responsive viewport: 844 × 390 landscape
- States checked:
  - Day 1: title, active level, chapter selector
  - Day 4: title, fighter select, active fight
  - Day 5: mission briefing, active mission

## Full-view comparison

The selected source is an art-direction board for three distinct games, not a literal
pixel-for-pixel viewport. The redraw carries its Graphic Arcade language into the real games:
oversized editorial type, hard-edged poster panels, screenprint texture, high-contrast command
rails, world-specific palettes, and clear arcade-state hierarchy. HUD blocks remain deliberately
more compact than the board so they do not obstruct playable space, matching the approved
full-screen-menu plus non-obstructive-gameplay-HUD layout.

## Focused comparison

Each focused comparison places the source treatment and matching implementation state together.
The comparison confirms that all three games now read as one designed anthology while keeping
their own identities:

- Day 1: midnight violet, acid yellow, paper-white mission tickets, dream-route typography.
- Day 4: red-versus-blue fight poster, angular health bars, central timer, ringside command rail.
- Day 5: polar navy, safety orange, operation-board hierarchy, squad and mission-status strips.

## Required fidelity surfaces

- Fonts and typography: passed. Oversized condensed-style display copy and compact functional
  labels reproduce the source hierarchy without sacrificing Traditional Chinese legibility.
- Spacing and layout rhythm: passed. Edge-aligned rails, sharp panels, deliberate overlap, and
  strong negative space replace the previous card-like UI.
- Colors and visual tokens: passed. Each game uses its source-specific palette while sharing
  paper, ink, warning, border, and keycap behavior.
- Image and asset fidelity: passed. Generated screenprint texture assets are fitted to each
  game's frame. Day 4 now uses five original transparent `4 x 3` Sprite Atlases with consistent
  foot anchors, thick silhouette lines, readable faces, clothing, gloves, and footwear.
- Copy and content: passed. Objective, control, selection, status, and result copy matches the
  implemented interactions.
- Border and radius fidelity: passed. The redraw uses hard corners and poster cuts instead of
  the rounded dashboard treatment rejected in the prior iteration.

## Interaction and browser checks

- Day 1: Space and primary CTA start play; chapter selector opens and closes; live objective and
  command HUD render correctly.
- Day 4: mode selection, fighter selection, 1P, 2P, 2v2, battle start, attack poses, health bars,
  timer, and result treatment render correctly. All five original roster assets load without a
  fallback or transparent-edge artifact.
- Day 5: mission briefing starts play; squad selection, objective status, mission banner, and
  command rail render correctly.
- Browser console: no warnings or errors in the checked states.
- Responsive check: Day 1 and Day 4 reflow cleanly at 844 × 390. Day 5 keeps its native 3:2
  canvas centered at 573 × 382 with no clipping.

## Comparison history

1. The first Day 5 gameplay comparison lacked a dominant current-state signal.
   - Severity: P2.
   - Fix: added the orange `任務進行中` poster banner when no alert is active.
   - Post-fix evidence: `/private/tmp/game-ui-redraw-qa/day5-play.png`.
2. The first Day 1 title capture occurred before its texture asset finished loading and appeared
   too dark.
   - Fix: verified the stable post-load state and responsive state; the paper and violet poster
     treatment renders correctly without a code change.
3. The first normalized Day 4 Sprite Atlases lost alpha and rendered as white rectangles.
   - Severity: P1.
   - Fix: repeated normalization with an explicit transparent canvas, then checked every PNG is
     RGBA, every corner is transparent, and every dimension is divisible by the `4 x 3` grid.
   - Post-fix evidence: `/private/tmp/little-fighter-sprite-qa/deliverable-select.png` and
     `/private/tmp/little-fighter-sprite-qa/2v2.png`.

## Findings

- No actionable P0, P1, or P2 issues remain.

## Intentional constraints and P3 follow-ups

- P3: Day 1 uses a compact top objective ticket instead of the source's large left mission panel
  to preserve the platforming sightline.
- P3: Day 5 keeps its native 3:2 gameplay ratio on short landscape phones, so secondary copy is
  smaller than Day 1 and Day 4; the canvas remains centered and fully visible.

final result: passed
