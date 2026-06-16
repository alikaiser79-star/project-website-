import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Points, PointMaterial, Float } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useKaiPulse } from '../hooks/useKaiPulse';
import type { Accent } from '../types';

const ACCENT_HEX: Record<Accent, string> = {
  amber: '#FFB300',
  cyan:  '#5FE3FF',
  emerald: '#7AE6A8',
};

function Orb({ accent }: { accent: Accent }) {
  const { speaking, pulseTick, listening } = useKaiPulse();
  const targetHex = ACCENT_HEX[accent];
  const ref = useRef<THREE.Mesh>(null!);
  const matRef = useRef<any>(null!);
  const pulseRef = useRef(0);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;

    // Slow breathing rotation
    ref.current.rotation.y += dt * 0.18;
    ref.current.rotation.x = Math.sin(t * 0.25) * 0.12;

    // Breathing scale + speaking pulse
    pulseRef.current = THREE.MathUtils.damp(pulseRef.current, 0, 3.5, dt);
    const breath = 1 + Math.sin(t * 1.05) * 0.025;
    const speakBoost = speaking ? (1 + Math.sin(t * 11) * 0.05) : 1;
    const scale = breath * speakBoost * (1 + pulseRef.current * 0.12);
    ref.current.scale.setScalar(scale);

    if (matRef.current) {
      matRef.current.distort = 0.32 + Math.sin(t * 0.7) * 0.06 + (speaking ? 0.10 : 0) + pulseRef.current * 0.15;
      matRef.current.speed = speaking ? 4 : 1.2;
      matRef.current.emissiveIntensity = 1.1 + Math.sin(t * 1.2) * 0.15
        + (speaking ? 0.5 : 0) + pulseRef.current * 0.6;
      if (listening) matRef.current.color.lerp(new THREE.Color('#5FE3FF'), 0.04);
      else           matRef.current.color.lerp(new THREE.Color(targetHex), 0.04);
      matRef.current.emissive.lerp(new THREE.Color(targetHex), 0.05);
    }
  });

  // Trigger pulse on command tick
  const lastTick = useRef(0);
  useFrame(() => {
    if (pulseTick !== lastTick.current) {
      pulseRef.current = 1;
      lastTick.current = pulseTick;
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.4}>
      <mesh ref={ref}>
        <sphereGeometry args={[1, 96, 96]} />
        <MeshDistortMaterial
          ref={matRef}
          color="#FFB300"
          emissive="#FFB300"
          emissiveIntensity={1.1}
          roughness={0.25}
          metalness={0.2}
          distort={0.32}
          speed={1.2}
        />
      </mesh>
    </Float>
  );
}

function Particles({ color = '#FFB300' }: { color?: string }) {
  const count = 900;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.6 + Math.random() * 1.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      arr[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      arr[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      arr[i*3+2] = r * Math.cos(phi);
    }
    return arr;
  }, []);
  const ref = useRef<THREE.Points>(null!);
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.06;
      ref.current.rotation.x += dt * 0.02;
    }
  });
  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial transparent color={color} size={0.015} sizeAttenuation depthWrite={false} opacity={0.85} />
    </Points>
  );
}

function Ring({ radius, color, tilt, speed, dashed }: { radius: number; color: string; tilt: number; speed: number; dashed?: boolean }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * speed; });
  return (
    <mesh ref={ref} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, dashed ? 0.004 : 0.006, 8, 256]} />
      <meshBasicMaterial color={color} transparent opacity={dashed ? 0.4 : 0.6} />
    </mesh>
  );
}

export default function KaiCore({ size = 460, accent = 'amber' as Accent }: { size?: number; accent?: Accent }) {
  const hex = ACCENT_HEX[accent];
  const rgba = (a: number) => hex + Math.floor(a * 255).toString(16).padStart(2, '0');
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${rgba(0.25)} 0%, ${rgba(0.08)} 30%, transparent 65%)`, filter: 'blur(8px)' }}
      />
      <Canvas camera={{ position: [0, 0, 3.6], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.3} />
        <pointLight position={[3, 2, 4]}  intensity={1.8} color={hex} />
        <pointLight position={[-3, -2, 2]} intensity={0.8} color="#5FE3FF" />
        <Orb accent={accent} />
        <Particles color={hex} />
        <Ring radius={1.55} color={hex} tilt={Math.PI/2.2} speed={0.04} />
        <Ring radius={1.78} color="#5FE3FF" tilt={Math.PI/1.6} speed={-0.03} dashed />
        <Ring radius={2.05} color={hex} tilt={Math.PI/3}   speed={0.02} dashed />
        <EffectComposer>
          <Bloom intensity={0.9} luminanceThreshold={0.2} luminanceSmoothing={0.7} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
