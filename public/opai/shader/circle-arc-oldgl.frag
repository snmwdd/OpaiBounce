#version 120

uniform float u_Inner;
uniform float u_Radius;
uniform float u_Feather;
uniform vec2  u_CenterPos;
uniform float u_MiddleAngle;
uniform float u_SweepAngle;

varying vec2 f_Position;

void main() {
    vec2 v = f_Position - u_CenterPos;
    float r = length(v);

    float strokeRadius = u_Radius - u_Inner;
    float d1 = abs(r - u_Radius) - strokeRadius;
    float a1 = smoothstep(-u_Feather, 0.0, d1);

    float a2 = 1.0;

    if (u_SweepAngle < 360.0 && u_SweepAngle > -360.0) {
        float f = u_MiddleAngle * 0.01745329252;
        vec2  up = vec2(cos(f), sin(f));
        vec2 dir = (r > 0.0) ? (v / r) : vec2(0.0);
        float c = cos(abs(u_SweepAngle) * 0.00872664626);
        float dirDot = dot(up, dir);

        float w = u_Feather * fwidth(dirDot);

        float gap = 1.0 + c;
        if (gap <= w) {
            a2 = 1.0;
        } else {
            float d2 = dirDot - c;
            a2 = smoothstep(-w, w, d2);
        }
    }

    float a = (1.0 - a1) * a2;

    gl_FragColor = gl_Color * vec4(1.0, 1.0, 1.0, a);
}