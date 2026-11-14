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
// Fractal noise with level of detail: octaves finer than a pixel fade to their mean,
// so distant planets stay smooth instead of shimmering. px = pixel size in p-space.
float fbm(vec3 p, float px) {
  float v = 0.0;
  float a = 0.5;
  float norm = 0.0;
  float f = 1.0;
  for (int i = 0; i < OCTAVES; i++) {
    float w = 1.0 - smoothstep(0.3, 0.9, px * f);
    v += a * mix(0.5, vnoise(p), w);
    norm += a;
    p = p * 2.03 + vec3(11.7, 5.3, 8.1);
    f *= 2.03;
    a *= 0.5;
  }
  return v / norm;
}
float fbmLow(vec3 p, float px) {
  float v = 0.0;
  float a = 0.5;
  float norm = 0.0;
  float f = 1.0;
  for (int i = 0; i < 4; i++) {
    float w = 1.0 - smoothstep(0.3, 0.9, px * f);
    v += a * mix(0.5, vnoise(p), w);
    norm += a;
    p = p * 2.03 + vec3(11.7, 5.3, 8.1);
    f *= 2.03;
    a *= 0.5;
  }
  return v / norm;
}
`;

export const PLANET_VERTEX = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
varying mat3 vObjToWorld;
void main() {
  vObj = position;
  vObjToWorld = mat3(modelMatrix);
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
varying mat3 vObjToWorld;
${NOISE_GLSL}
float terrain(vec3 p, float px) {
  return fbmLow(p * 6.0 + vec3(2.0, 9.0, 4.0), px * 6.0);
}
void main() {
  vec3 p = normalize(vObj);
  float px = length(fwidth(vObj));
  vec3 q = p * 1.55;
  // Large albedo provinces, warped so their edges look wind-blown rather than blobby.
  vec3 warp = vec3(fbmLow(q * 1.3 + 4.1, px * 2.0), fbmLow(q * 1.3 + 9.7, px * 2.0), fbmLow(q * 1.3 + 1.3, px * 2.0)) - 0.5;
  float n1 = fbm(q + warp * 1.4 + vec3(3.1, 1.7, 5.3), px * 1.55);
  float n2 = fbm(q * 3.4 + warp * 2.2, px * 5.3);
  float n3 = fbm(q * 11.0 + 4.0, px * 17.0);

  vec3 cDark = vec3(0.13, 0.062, 0.045);
  vec3 cRust = vec3(0.42, 0.13, 0.05);
  vec3 cOchre = vec3(0.62, 0.28, 0.11);
  vec3 cBright = vec3(0.78, 0.47, 0.25);

  vec3 col = mix(cRust, cOchre, smoothstep(0.34, 0.66, n2));
  col = mix(col, cBright, smoothstep(0.5, 0.78, n1) * 0.55 + smoothstep(0.6, 0.9, n3) * 0.18);
  float darkRegion = smoothstep(0.44, 0.34, n1 + (n2 - 0.5) * 0.22);
  col = mix(col, cDark, darkRegion * 0.82);
  col *= 0.86 + 0.28 * n3;

  // Fine ridges that read as canyon systems and crater rims.
  float ridge = 1.0 - abs(2.0 * fbm(q * 4.2 + 7.0, px * 6.5) - 1.0);
  col *= mix(1.0, 0.7, smoothstep(0.9, 0.99, ridge));

  // Polar caps with ragged edges; the northern cap is a little larger.
  float capEdge = (n2 - 0.5) * 0.16 + (n3 - 0.5) * 0.05;
  float cap = max(smoothstep(0.86, 0.91, p.y + capEdge), smoothstep(0.9, 0.95, -p.y + capEdge));
  col = mix(col, vec3(0.9, 0.89, 0.88), cap);

  // Regional dust storm (gameplay event): a drifting bright haze.
  float stormMask = 0.0;
  if (uStorm > 0.001) {
    vec3 stormCentre = normalize(vec3(cos(uTime * 0.03), -0.25, sin(uTime * 0.03)));
    stormMask = smoothstep(0.45, 0.95, dot(p, stormCentre) + (fbmLow(q * 2.5 + uTime * 0.05, px * 4.0) - 0.5) * 0.6) * uStorm;
    col = mix(col, vec3(0.80, 0.58, 0.37), stormMask * 0.88);
  }

  vec3 Ng = normalize(vNormalW);
  vec3 N = Ng;
  #ifdef USE_BUMP
  // Finite-difference normal from a smooth height field (no screen-space derivative blocks).
  vec3 t1 = normalize(cross(p, vec3(0.0, 1.0, 0.001)));
  vec3 t2 = cross(p, t1);
  float e = 0.006;
  float h0 = terrain(p, px);
  float hx = terrain(p + t1 * e, px);
  float hy = terrain(p + t2 * e, px);
  vec3 grad = ((hx - h0) * t1 + (hy - h0) * t2) / e;
  vec3 nObj = normalize(p - grad * 0.085 * (1.0 - stormMask) * (1.0 - cap));
  N = normalize(vObjToWorld * nObj);
  #endif
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(N, uSunDir);
  float ndlG = dot(Ng, uSunDir);
  float day = smoothstep(-0.08, 0.3, ndlG);
  float diffuse = max(ndl, 0.0) * smoothstep(-0.02, 0.12, ndlG);
  vec3 lit = col * (diffuse * 1.3 + 0.006);
  // Warm light scattered along the terminator.
  lit += col * vec3(1.0, 0.4, 0.2) * (1.0 - day) * smoothstep(-0.3, 0.0, ndlG) * 0.1;

  float fres = pow(1.0 - max(dot(Ng, V), 0.0), 3.4);
  lit += vec3(0.92, 0.52, 0.3) * fres * (0.06 + 0.94 * day) * 0.42;

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
  float px = length(fwidth(vObj));
  vec3 q = p * 1.7;
  float n1 = fbm(q + vec3(1.3, 9.2, 4.4), px * 1.7);
  float n2 = fbm(q * 3.4 + n1 * 1.2, px * 5.8);
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
  float cl = fbm(cq + fbmLow(cq * 2.0, px * 6.0) * 0.9, px * 3.0);
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
  float lights = smoothstep(0.8, 0.93, vnoise(p * 140.0)) * smoothstep(0.52, 0.66, fbmLow(p * 9.0, px * 9.0)) * (1.0 - smoothstep(0.2, 0.6, px * 140.0)) * land * (1.0 - ice);
  lit += vec3(1.0, 0.72, 0.38) * lights * (1.0 - day) * 0.6 * (1.0 - clouds);

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
