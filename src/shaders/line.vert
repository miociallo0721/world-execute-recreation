in vec4 lineColor;
out vec4 vLineColor;

void main() {
  vLineColor = lineColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
