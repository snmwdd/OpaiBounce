#version 120

uniform vec2 location, rectSize;
uniform float alpha;
uniform float radius;
uniform sampler2D textureIn;
uniform bool blur;
uniform vec4 corner;

float roundSDF(vec2 p, vec2 b, float r) {
    return length(max(abs(p) - b, 0.0)) - r;
}

void main() {
    vec2 rectHalf = rectSize * .5;
    vec2 uv = gl_TexCoord[0].st * rectSize;
    if ((uv.x < radius && uv.y < radius && corner.z == 0.0) ||
        (uv.x >= rectSize.x - radius && uv.y < radius && corner.y == 0.0) ||
        (uv.x < radius && uv.y >= rectSize.y - radius && corner.x == 0.0) ||
        (uv.x >= rectSize.x - radius && uv.y >= rectSize.y - radius && corner.w == 0.0)) {
        float smoothedAlpha = (1.0 - smoothstep(0.0, 1.0, roundSDF(rectHalf - uv, rectHalf - 0.1 - 1., 0.1))) * alpha;
        gl_FragColor = vec4(texture2D(textureIn, gl_TexCoord[0].st).rgb, smoothedAlpha);
    } else {
        float smoothedAlpha = (1.0 - smoothstep(0.0, 1.0, roundSDF(rectHalf - uv, rectHalf - radius - 1., radius))) * alpha;
        gl_FragColor = vec4(texture2D(textureIn, gl_TexCoord[0].st).rgb, smoothedAlpha);
    }
}
