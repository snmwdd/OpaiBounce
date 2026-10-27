#version 120

uniform sampler2D textureIn;
uniform vec2 texelSize;
uniform vec2 direction;
uniform float radius;
uniform float weights[17];

uniform float strength;

#define offset (texelSize * direction)

void main() {
    vec2 uv = gl_TexCoord[0].st;
    vec3 color = texture2D(textureIn, uv).rgb * weights[0];

    for (int i = 1; i <= 16; ++i) {
        if (i > int(radius)) break;

        vec2 delta = offset * float(i);
        vec3 sample1 = texture2D(textureIn, uv + delta).rgb;
        vec3 sample2 = texture2D(textureIn, uv - delta).rgb;

        color += (sample1 + sample2) * weights[i];
    }

    gl_FragColor = vec4(color, strength);
}
