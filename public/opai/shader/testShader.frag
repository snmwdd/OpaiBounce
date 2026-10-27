#version 120

uniform vec2 rectSize;

uniform vec2 inputXY;

uniform float rotation;

uniform float planeZ;

uniform sampler2D textureIn;


float plane(in vec3 n, in vec3 p0, in vec3 ro, in vec3 rd) {
    float d = dot(rd, n);
    d = sign(d) * max(abs(d), 0.001);
    return dot(p0 - ro, n) / d;
}

vec2 computeUV(in vec2 localCoord, in vec2 rectSize, in float rotation, in float planeZ) {

    vec2 center = rectSize * 0.5;

    vec2 fragNDC = (localCoord - center) / (rectSize.y * 0.5);


    vec3 rayOrigin = vec3(0.0, 0.0, 0.0);
    vec3 rayDir = normalize(vec3(fragNDC, 1.0));


    vec2 quadDim = vec2(rectSize.x / rectSize.y, 1.0);

    vec3 quadCenter = vec3(0.0, 0.0, planeZ);

    float c = cos(rotation);
    float s = sin(rotation);
    mat3 rotMat = mat3(
    c,   0.0,  s,
    0.0, 1.0, 0.0,
    -s,   0.0,  c
    );

    vec3 right = rotMat * vec3(quadDim.x, 0.0, 0.0);
    vec3 up    = rotMat * vec3(0.0, quadDim.y, 0.0);

    vec3 normal = normalize(cross(right, up));

    float t = plane(normal, quadCenter, rayOrigin, rayDir);
    vec3 hitPos = rayOrigin + rayDir * t;

    vec3 relPos = hitPos - quadCenter;

    float u = dot(relPos, right) / dot(right, right) + 0.5;
    float v = dot(relPos, up)    / dot(up, up)    + 0.5;

    return vec2(u, v);
}


void main() {

    vec2 localCoord = gl_TexCoord[0].st * rectSize;

    vec2 uv = computeUV(localCoord, rectSize, rotation, planeZ);

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0);
    } else {
        gl_FragColor = texture2D(textureIn, uv);
    }
}
