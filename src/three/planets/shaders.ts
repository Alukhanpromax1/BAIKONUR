/** GLSL shared by the procedural planets. Written for this project. */
export const NOISE_GLSL = /* glsl */ `
float hash31(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}
float vnoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float a = hash31(i);
  float b = hash31(i + vec3(1.0, 0.0, 0.0));
  float c = hash31(i + vec3(0.0, 1.0, 0.0));
  float d = hash31(i + vec3(1.0, 1.0, 0.0));
  float e = hash31(i + vec3(0.0, 0.0, 1.0));
  float f1 = hash31(i + vec3(1.0, 0.0, 1.0));
  float g = hash31(i + vec3(0.0, 1.0, 1.0));
  float h = hash31(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < OCTAVES; i++) {
    v += a * vnoise(p);
    p = p * 2.03 + vec3(11.7, 5.3, 8.1);
    a *= 0.5;
  }
  return v / (1.0 - a * 2.0 + 0.0001);
}
vec3 bumpNormal(vec3 N, vec3 worldPos, float h, float strength) {
  vec3 dpdx = dFdx(worldPos);
  vec3 dpdy = dFdy(worldPos);
  float dhdx = dFdx(h);
  float dhdy = dFdy(h);
  vec3 r1 = cross(dpdy, N);
  vec3 r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * N - strength * grad);
}
`;

export const PLANET_VERTEX = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vObj = position;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const MARS_FRAGMENT = /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
uniform float uStorm;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  vec3 p = normalize(vObj);
  vec3 q = p * 2.1;
  float n1 = fbm(q + vec3(3.1, 1.7, 5.3));
  float n2 = fbm(q * 3.2 + n1 * 1.6);
  float n3 = fbm(q * 9.5 + 4.0);

  vec3 cDark = vec3(0.23, 0.11, 0.075);
  vec3 cRust = vec3(0.56, 0.235, 0.115);
  vec3 cOchre = vec3(0.77, 0.43, 0.22);
  vec3 cBright = vec3(0.89, 0.62, 0.40);

  vec3 col = mix(cRust, cOchre, smoothstep(0.32, 0.68, n2));
  col = mix(col, cBright, smoothstep(0.55, 0.9, n3) * 0.45);
  float darkRegion = smoothstep(0.47, 0.6, n1 * 0.72 + n2 * 0.28);
  col = mix(col, cDark, darkRegion * 0.78);

  // Fine ridges that read as canyon systems and crater rims.
  float ridge = 1.0 - abs(2.0 * fbm(q * 5.5 + 7.0) - 1.0);
  col *= mix(1.0, 0.78, smoothstep(0.86, 0.98, ridge));

  // Polar caps with ragged edges; the northern cap is a little larger.
  float capEdge = (n2 - 0.5) * 0.14 + (n3 - 0.5) * 0.05;
  float cap = max(smoothstep(0.84, 0.9, p.y + capEdge), smoothstep(0.88, 0.94, -p.y + capEdge));
  col = mix(col, vec3(0.94, 0.92, 0.9), cap);

  // Regional dust storm (gameplay event): a drifting bright haze.
  vec3 stormCentre = normalize(vec3(cos(uTime * 0.03), -0.25, sin(uTime * 0.03)));
  float stormMask = smoothstep(0.45, 0.95, dot(p, stormCentre) + (fbm(q * 2.5 + uTime * 0.05) - 0.5) * 0.6);
  col = mix(col, vec3(0.85, 0.62, 0.4), stormMask * uStorm * 0.85);

  vec3 N = normalize(vNormalW);
  #ifdef USE_BUMP
  float height = n2 * 0.55 + n3 * 0.3 - darkRegion * 0.1;
  N = bumpNormal(N, vWorld, height, 0.55 * (1.0 - uStorm * stormMask));
  #endif
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float day = smoothstep(-0.06, 0.28, dot(normalize(vNormalW), uSunDir));
  float diffuse = pow(max(ndl, 0.0), 0.85);
  vec3 lit = col * (diffuse * 1.35 + 0.012);
  // Warm light scattered along the terminator.
  lit += col * vec3(1.0, 0.45, 0.25) * (1.0 - day) * smoothstep(-0.25, 0.05, ndl) * 0.12;

  float fres = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 3.2);
  lit += vec3(0.95, 0.58, 0.36) * fres * (0.12 + 0.88 * day) * 0.5;

  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const EARTH_FRAGMENT = /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
${NOISE_GLSL}
void main() {
  vec3 p = normalize(vObj);
  vec3 q = p * 1.7;
  float n1 = fbm(q + vec3(1.3, 9.2, 4.4));
  float n2 = fbm(q * 3.4 + n1 * 1.2);
  float land = smoothstep(0.515, 0.55, n1 * 0.8 + n2 * 0.2);

  vec3 deep = vec3(0.012, 0.055, 0.16);
  vec3 shallow = vec3(0.03, 0.2, 0.34);
  vec3 ocean = mix(deep, shallow, smoothstep(0.44, 0.53, n1 * 0.8 + n2 * 0.2));
  float arid = smoothstep(0.45, 0.7, n2) * (1.0 - smoothstep(0.35, 0.75, abs(p.y)));
  vec3 ground = mix(vec3(0.07, 0.2, 0.08), vec3(0.42, 0.34, 0.2), arid);
  ground = mix(ground, vec3(0.22, 0.2, 0.16), smoothstep(0.6, 0.8, n2) * 0.5);
  vec3 col = mix(ocean, ground, land);
  float ice = smoothstep(0.8, 0.88, abs(p.y) + (n2 - 0.5) * 0.12);
  col = mix(col, vec3(0.92, 0.95, 0.98), ice);

  // Cloud deck drifting slowly over the surface.
  vec3 cq = p * 3.0 + vec3(uTime * 0.012, 0.0, uTime * 0.007);
  float cl = fbm(cq + fbm(cq * 2.0) * 0.9);
  float clouds = smoothstep(0.5, 0.74, cl);

  vec3 N = normalize(vNormalW);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float day = smoothstep(-0.1, 0.3, ndl);
  float diffuse = max(ndl, 0.0);

  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 70.0) * (1.0 - land) * (1.0 - clouds) * 0.9;

  vec3 lit = col * (diffuse * 1.25 + 0.01) + vec3(1.0, 0.95, 0.85) * spec * day;
  lit = mix(lit, vec3(1.0) * (diffuse * 1.2 + 0.02), clouds * 0.92);

  // Night side: a few faint warm lights on land.
  float lights = smoothstep(0.72, 0.8, fbm(p * 22.0)) * land * (1.0 - ice);
  lit += vec3(1.0, 0.72, 0.38) * lights * (1.0 - day) * 0.5 * (1.0 - clouds);

  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  lit += vec3(0.25, 0.55, 1.0) * fres * (0.08 + 0.92 * day) * 0.9;
  // Reddened light along the terminator.
  lit += vec3(1.0, 0.4, 0.2) * fres * smoothstep(0.35, 0.0, abs(ndl)) * 0.25;

  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const HALO_VERTEX = /* glsl */ `
varying vec3 vN;
varying vec3 vView;
varying vec3 vNormalW;
void main() {
  vN = normalize(normalMatrix * normal);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

export const HALO_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uSunDir;
uniform float uLimb;
uniform float uStrength;
varying vec3 vN;
varying vec3 vView;
varying vec3 vNormalW;
void main() {
  // Back faces of a slightly larger sphere: brightest at the planet's limb, fading outward.
  float d = dot(normalize(vN), normalize(vView));
  float glow = pow(clamp(d / uLimb, 0.0, 1.0), 3.0);
  float lit = smoothstep(-0.55, 0.45, dot(-normalize(vNormalW), uSunDir));
  gl_FragColor = vec4(uColor * glow * lit * uStrength, glow * lit);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
