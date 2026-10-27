#version 430 compatibility
uniform float u_Radius;
uniform float u_Feather;
uniform vec2 u_CenterPos;
in vec2 f_Position;

void main() {
    float v = length(f_Position - u_CenterPos);
    float a = 1.0 - smoothstep(u_Radius - u_Feather, u_Radius, v);
    gl_FragColor = gl_Color * vec4(1.0, 1.0, 1.0, a);
}