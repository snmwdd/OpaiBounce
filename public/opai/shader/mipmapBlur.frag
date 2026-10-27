#version 120

#ifdef GL_ARB_shader_texture_lod
#extension GL_ARB_shader_texture_lod : enable
#endif

#define PI 3.14159265


uniform vec2 iResolution;
uniform float iTime;
uniform sampler2D textureIn;
uniform float gamma;

float weight(float t, float log2radius, float gamma) {
    return exp(-gamma * pow(log2radius - t, 2.0));
}

vec4 sample_blured(vec2 uv, float radius, float gamma) {
    vec4 pix = vec4(0.0);
    float norm = 0.0;
    //weighted integration over mipmap levels
    for (float i = 0.0; i < 10.0; i += 0.5) {
        float k = weight(i, log2(radius), gamma);
        pix += k * texture2DLod(textureIn, clamp(uv, 0.0, 1.0), i);
        norm += k;
    }
    //nomalize, and a bit of brigtness hacking
    return pix * pow(norm, -0.95);
}

void main() {
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = gl_FragCoord.xy / iResolution.xy;

//    float blur_radius = 1.0 + 50.0 * (0.5 * sin(1.8 * iTime + 0.000 * gl_FragCoord.x) + 0.5);
    float blur_radius = iTime;


    // Output to screen
    gl_FragColor = sample_blured(uv, blur_radius, gamma );
}
