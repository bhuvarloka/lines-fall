export const config = {
  // ---- Typography ---- //
  fontSize: 32,
  // fontFamily: 'Georgia, "Times New Roman", serif',
  fontFamily: 'Arial, "Times New Roman", serif',
  textColor: "#000000",

  // ---- Circle Obstacle ---- //

  circleDiameter: 128,
  circleColor: "#ff0000",
  circleFriction: 0, // ↓ friction, ↑ frictionless, 0–1

  // ---- Scene Layout ---- //
  textStartY: 0.15,
  lineSpacingY: 0.05,
  circleX: 0.5,
  circleY: 0.7,
  textMarginX: 0.1,
  floorY: 0.9,

  // ---- Rendering ---- //
  backgroundColor: "#ffffff",
  floorColor: "#ff0000",

  // ---- Physics ---- //
  gravity: 0.7, // ↓ floaty/slow fall, ↑ fast fall, px/frame², no limit (try 0.1–3)
  damping: 0.96, // ↓ heavy drag/stops fast, ↑ fast animation, 0–1 (1 = no drag)
  constraintIterations: 32, // ↓ loose/stretchy chain, ↑ rigid/stiff chain, no limit (try 4–64)
  linkRestLength: 12, // ↓ tighter chain, ↑ looser chain, px, no limit
  pointRadius: 8, // ↓ chars overlap, ↑ chars spread apart, px,

  // ---- Lateral Drift ---- //
  noiseTimeScale: 0.002, // ↓ slow drift pattern, ↑ fast/chaotic drift, no limit (try 0.0001–0.01)
  noiseSpatialScale: 0.008, // ↓ uniform drift across lines, ↑ each line drifts differently, no limit
  noiseAmplitude: 0.5, // ↓ straight fall, ↑ wide sway, px/frame, no limit (try 0–5)
};
