export const config = {
  // Typography
  fontSize: 32, // px
  fontFamily: 'Georgia, "Times New Roman", serif',
  textColor: "#000000",

  // Physics
  gravity: 0.3, // px added to vy each frame
  damping: 0.9, // 0–1; 1 = no drag, 0 = instant stop
  constraintIterations: 10, // solver passes per frame; higher = stiffer chain
  linkRestLength: 12, // px between adjacent chain points
  pointRadius: 10, // collision radius; ~half fontSize keeps chars from overlapping

  // Circle obstacle
  circleFriction: 0.1, // 0–1 velocity kept after circle contact; 1 = frictionless
  circleDiameter: 96, // px
  circleColor: "#ff0000",

  // Scene layout (all fractions of screen dimension unless noted)
  textStartY: 0.08, // top of first line
  lineSpacingY: 0.035, // vertical gap between lines
  circleX: 0.5, // horizontal center
  circleY: 0.45, // vertical center
  textMarginX: 0.08, // left/right margin
  floorY: 0.92, // chains settle here

  // Rendering
  backgroundColor: "#ffffff",
  floorColor: "#ff0000",
};
