#version 120

uniform vec2 location, rectSize;
uniform vec4 color1, color2, color3, color4;
uniform float radius;

#define NOISE .5/255.0

float roundSDF(vec2 p, vec2 b, float r) {
    return length(max(abs(p) - b , 0.0)) - r;
}

vec3 createGradient(vec2 coords, vec3 color1, vec3 color2, vec3 color3, vec3 color4){
    vec3 color = mix(mix(color1, color2, coords.y), mix(color3, color4, coords.y), coords.x);
    color += mix(NOISE, -NOISE, fract(sin(dot(coords.xy, vec2(12.9898, 78.233))) * 43758.5453));
    return color;
}

void main() {
    vec2 st = gl_TexCoord[0].st;
    vec2 halfSize = rectSize * 0.5;

    float sdf = roundSDF(halfSize - (st * rectSize), halfSize - radius - 1.0, radius);
    float alphaFactor = 1.0 - smoothstep(0.0, 2.0, sdf);

    vec3 finalColor = createGradient(st, color1.rgb, color2.rgb, color3.rgb, color4.rgb);
    float finalAlpha = mix(mix(color1.a, color2.a, st.y), mix(color3.a, color4.a, st.y), st.x) * alphaFactor;

    gl_FragColor = vec4(finalColor, finalAlpha);
}
