/* ============================================================
   KAI Core — galaxy sphere
   Single smooth high-res sphere with a fresnel rim that blends
   sun-gold → galaxy violet → moon silver around the equator.
   Body is deep space dark with a faint nebula swirl. Reacts to
   speak / listen / command pulses by brightening the rim.
   ============================================================ */

import type { CSSProperties } from 'react';
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Color, MathUtils, ShaderMaterial } from 'three';
import type { Mesh as ThreeMesh } from 'three';
import { useKaiPulse } from '../hooks/useKaiPulse';
import type { Accent } from '../types';

/* ── Shader sources ──────────────────────────────────────── */

const VERT = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

void main() {
  vLocalPos = position;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const FRAG = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vLocalPos;

uniform float uTime;
uniform float uRimIntensity;
uniform float uRimPower;
uniform vec3  uRimGold;
uniform vec3  uRimViolet;
uniform vec3  uRimSilver;
uniform vec3  uBodyDeep;
uniform vec3  uBodyNebula;
uniform float uListenMix;

/* Lightweight 3D value noise + FBM for the nebula swirl */
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  /* Fresnel — 0 at facing, 1 at silhouette */
  float ndv = max(dot(normalize(vNormal), normalize(vViewDir)), 0.0);
  float fresnel = pow(1.0 - ndv, uRimPower);

  /* Rim gradient around the sphere: gold (one side) → violet (centre) → silver (other side).
     Using vWorldNormal.x so the gradient is anchored in world space — the
     rim colors stay put while the sphere rotates underneath. */
  float t = clamp(vWorldNormal.x * 0.5 + 0.5, 0.0, 1.0);
  vec3 rimColor = t < 0.5
    ? mix(uRimGold,   uRimViolet, smoothstep(0.0, 0.5, t))
    : mix(uRimViolet, uRimSilver, smoothstep(0.5, 1.0, t));

  /* Listening cools the entire rim toward a moon-blue */
  rimColor = mix(rimColor, vec3(0.55, 0.78, 1.0), uListenMix * 0.55);

  /* Body — deep space with a faint nebula swirl. Sampled in LOCAL
     space so the swirl rotates with the sphere (no swimming). */
  vec3 n3 = vLocalPos * 1.6 + vec3(uTime * 0.04, uTime * 0.03, 0.0);
  float n  = fbm(n3);
  float n2 = fbm(n3 + vec3(2.4, -1.7, 0.9));
  vec3 body = mix(uBodyDeep, uBodyNebula, smoothstep(0.30, 0.78, n) * 0.75);
  body += uRimViolet * 0.08 * smoothstep(0.55, 0.95, n2);

  vec3 final = mix(body, rimColor * uRimIntensity, fresnel);
  gl_FragColor = vec4(final, 1.0);
}
`;

/* ── Material factory ────────────────────────────────────── */

function makeMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime:         { value: 0 },
      uRimIntensity: { value: 1.0 },
      uRimPower:     { value: 2.4 },
      /* Sun gold ──── galaxy violet ──── moon silver */
      uRimGold:      { value: new Color('#FF9B3D') },
      uRimViolet:    { value: new Color('#6B3FB8') },
      uRimSilver:    { value: new Color('#D6DAE5') },
      /* Deep space body + dim nebula swirl */
      uBodyDeep:     { value: new Color('#040712') },
      uBodyNebula:   { value: new Color('#1A1A44') },
      uListenMix:    { value: 0 },
    },
  });
}

/* ── Orb mesh ────────────────────────────────────────────── */

function Orb() {
  const { speaking, listening, pulseTick } = useKaiPulse();
  const meshRef = useRef<ThreeMesh>(null!);
  const material = useMemo(makeMaterial, []);
  const pulseRef = useRef(0);
  const lastTick = useRef(0);

  useFrame((state, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;

    /* Calm rotation — slow Y, gentle X wobble */
    mesh.rotation.y += dt * 0.06;
    mesh.rotation.x = Math.sin(t * 0.08) * 0.04;

    /* Command pulse — decays back to zero */
    pulseRef.current = MathUtils.damp(pulseRef.current, 0, 3.0, dt);
    if (pulseTick !== lastTick.current) {
      pulseRef.current = 1;
      lastTick.current = pulseTick;
    }

    const u = material.uniforms;
    u.uTime.value = t;

    /* Rim brightens on speak, with a small shimmer; pulse adds a burst */
    const speakBoost = speaking ? 1.55 + Math.sin(t * 9.0) * 0.18 : 1.0;
    const target = speakBoost + pulseRef.current * 0.7;
    u.uRimIntensity.value = MathUtils.lerp(u.uRimIntensity.value, target, 0.18);

    /* Listening cools the rim toward moonlight */
    u.uListenMix.value = MathUtils.lerp(u.uListenMix.value, listening ? 1 : 0, 0.06);
  });

  return (
    <mesh ref={meshRef} material={material}>
      <sphereGeometry args={[1, 128, 128]} />
    </mesh>
  );
}

/* ── Public component ───────────────────────────────────── */

/* `accent` is accepted for API compatibility but the orb is now a
   fixed galaxy palette by design. */
export default function KaiCore({ size, accent: _accent = 'amber' as Accent }: { size?: number; accent?: Accent }) {
  const wrap: CSSProperties = size ? { width: size, height: size } : { width: '100%', height: '100%' };
  return (
    <div className="relative" style={wrap}>
      {/* Soft violet halo — sits behind the orb so the rim reads against a faint nebula glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(107,63,184,0.22) 0%, rgba(40,30,90,0.10) 36%, transparent 72%)',
          filter: 'blur(14px)',
        }}
      />
      <Canvas
        camera={{ position: [0, 0, 3.5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Orb />
        {/* Faint slow starfield drifting behind the sphere */}
        <Stars
          radius={14}
          depth={10}
          count={320}
          factor={1.0}
          saturation={0}
          fade
          speed={0.25}
        />
        <EffectComposer>
          <Bloom
            intensity={0.7}
            luminanceThreshold={0.35}
            luminanceSmoothing={0.85}
            mipmapBlur
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
