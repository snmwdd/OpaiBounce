#version 430 compatibility
precision highp float;
uniform vec4 u_InnerRect;
uniform float u_Spread;
uniform vec4 u_Color;
// blend two color by alpha
vec4 blend(vec4 src, vec4 append) {
  	return vec4(src.rgb + append.rgb,
              1.0 - (1.0 - (src.a)) * (1.0 - append.a));
}

// approximation to the gaussian integral [x, infty)
float gi(float x) {
	float i6 = 1.0 / 6.0;
	float i4 = 1.0 / 4.0;
	float i3 = 1.0 / 3.0;

    if (x > 1.5) return 0.0;
    if (x < -1.5) return 1.0;

    float x2 = x * x;
    float x3 = x2 * x;

    if (x >  0.5) return .5625  - ( x3 * i6 - 3. * x2 * i4 + 1.125 * x);
    if (x > -0.5) return 0.5    - (0.75 * x - x3 * i3);
    return 0.4375 + (-x3 * i6 - 3. * x2 * i4 - 1.125 * x);
}

// create a line shadow mask
float lineShadow(vec2 border, float pos , float sigma) {
    float t = (border.y - border.x) / sigma;

    float pos1 = ((border.x - pos) / sigma) * 1.5;
    float pos2 = ((pos - border.y) / sigma) * 1.5;

  	return 1.0 - abs(gi(pos1) - gi(pos2));
}

// create a rect shadow by two line shadow
float rectShadow(vec4 rect, vec2 point, float sigma) {

    float lineV = lineShadow(vec2(rect.x, rect.x + rect.z), point.x, sigma);
    float lineH = lineShadow(vec2(rect.y, rect.y + rect.w), point.y, sigma);

  	return lineV * lineH;
}

// draw shadow
vec4 drawRectShadow(vec2 pos, vec4 rect, vec4 color, float sigma) {
    vec4 result = color;

    float shadowMask = rectShadow(rect, pos, sigma);

    result.a *= shadowMask;

	return result;
}

in vec2 f_Position;
out vec4 fragColor;
void main() {
    float sigma = u_Spread;

    vec4 rect = u_InnerRect;
    vec4 shadowRect = vec4(vec2(rect.x , rect.y), vec2(rect.z, rect.w));
    vec4 shadowColor = u_Color;

  	vec4 result = drawRectShadow(f_Position, shadowRect, shadowColor, sigma);
    gl_FragColor = result;
}