#version 120

uniform sampler2D stencilTexture, targetTexture;
uniform float alpha;

void main() {
    float stencilAlpha = texture2D(stencilTexture, gl_TexCoord[0].st).a;

    if (stencilAlpha == 0.0) discard;

    vec4 targetColor = texture2D(targetTexture, gl_TexCoord[0].st);

    vec3 finalRGB = targetColor.rgb * stencilAlpha * alpha;

    float finalAlpha = targetColor.a * stencilAlpha * alpha;

    gl_FragColor = vec4(finalRGB, finalAlpha);
}