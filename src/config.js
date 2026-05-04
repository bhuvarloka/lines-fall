export const config = {
  // Typography
  fontSize: 32,
  fontFamily: 'Georgia, "Times New Roman", serif',
  textColor: "#000000",

  // Physics
  gravity: 0.3,
  damping: 0.9, // velocity multiplier per frame (1 = no damping)
  constraintIterations: 10, // Jakobsen passes per frame — higher = stiffer chain
  linkRestLength: 12, // px distance between chain particles
  pointRadius: 14, // collision radius per point — should be ~half the font size to prevent overlap

  // Circle obstacle
  circleColor: "#000000",
  circleDiameter: 96, // px

  // Scene layout
  textStartY: 0.08, // fraction of screen height where first line starts
  lineSpacingY: 0.05, // vertical gap between lines as fraction of screen height
  circleX: 0.5, // fraction of screen width
  circleY: 0.5, // fraction of screen height
  textMarginX: 0.08, // horizontal margin as fraction of screen width
  floorY: 0.92, // fraction of screen height — chains rest here

  // Rendering
  backgroundColor: "#ffffff",
};
