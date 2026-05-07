export const config = {
  // Typography
  fontSize: 28, // px
  fontFamily: 'Georgia, "Times New Roman", serif',
  // fontFamily: 'Arial, "Times New Roman", serif',
  textColor: "#000000",

  // Physics
  gravity: 0.7, // px added to vy each frame
  damping: 0.95, // 0–1; 1 = no drag, 0 = instant stop
  constraintIterations: 12, // solver passes per frame; higher = stiffer chain
  linkRestLength: 12, // px between adjacent chain points
  pointRadius: 8, // collision radius; ~half fontSize keeps chars from overlapping

  // Circle obstacle
  circleFriction: 0, // 0–1 velocity kept after circle contact; 1 = frictionless
  circleDiameter: 48, // px
  circleColor: "#ff0000",

  // Scene layout (all fractions of screen dimension unless noted)
  textStartY: 0.15, // top of first line
  lineSpacingY: 0.04, // vertical gap between lines
  circleX: 0.5, // horizontal center
  circleY: 0.45, // vertical center
  textMarginX: 0.1, // left/right margin
  floorY: 0.95, // chains settle here

  // Rendering
  backgroundColor: "#ffffff",
  floorColor: "#ff0000",
};
