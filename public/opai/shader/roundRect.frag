#version 120

uniform vec2 location, rectSize;
uniform vec4 color;
uniform float radius;
uniform bool blur;
uniform vec4 corner;

float roundSDF(vec2 p, vec2 b, float r) {
    return length(max(abs(p) - b, 0.0)) - r;
}

void main() {
    vec2 halfSize = rectSize * 0.5;
    vec2 uv = gl_TexCoord[0].st * rectSize;
    vec2 local = uv - halfSize;
    vec2 absLocal = abs(local);
    vec2 maxCorner = halfSize - vec2(radius + 1.0);
    float enabled = 1.0;
    if (uv.x < radius && uv.y < radius && corner.z == 0.0) enabled = 0.0;
    if (uv.x >= rectSize.x - radius && uv.y < radius && corner.y == 0.0) enabled = 0.0;
    if (uv.x < radius && uv.y >= rectSize.y - radius && corner.x == 0.0) enabled = 0.0;
    if (uv.x >= rectSize.x - radius && uv.y >= rectSize.y - radius && corner.w == 0.0) enabled = 0.0;

    float r = mix(0.1, radius, enabled); // radius if enabled, else small smoothing
    vec2 bound = mix(halfSize - 1.1, halfSize - radius - 1.0, enabled);

    float dist = roundSDF(local, bound, r);
    float alpha = (1.0 - smoothstep(0.0, 1.0, dist)) * color.a;

    gl_FragColor = vec4(color.rgb, alpha);
}
