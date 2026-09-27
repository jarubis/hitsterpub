import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// Flat glowing rectangular border, sitting in the XZ plane (no rotation
// needed — width maps to local x, depth to local z, same convention as
// Card3D's boxGeometry). Used for the pile hover state and the active
// player's timeline indicator.
export default function GlowFrame({
  width,
  depth,
  color = "#35f0c0",
  y = 0.02,
  thickness = 0.045,
  barHeight = 0.02,
  pulse = true,
  baseIntensity = 1.6,
  pulseAmount = 0.6,
  opacity = 1,
}) {
  const matRefs = useRef([]);

  useFrame(({ clock }) => {
    if (!pulse) return;
    const intensity = baseIntensity + Math.sin(clock.elapsedTime * 3) * pulseAmount;
    matRefs.current.forEach((m) => {
      if (m) m.emissiveIntensity = Math.max(0.2, intensity);
    });
  });

  const halfW = width / 2;
  const halfD = depth / 2;

  const bars = [
    { pos: [0, 0, -halfD + thickness / 2], size: [width, barHeight, thickness] },
    { pos: [0, 0, halfD - thickness / 2], size: [width, barHeight, thickness] },
    { pos: [-halfW + thickness / 2, 0, 0], size: [thickness, barHeight, depth] },
    { pos: [halfW - thickness / 2, 0, 0], size: [thickness, barHeight, depth] },
  ];

  return (
    <group position={[0, y, 0]}>
      {bars.map((bar, i) => (
        <mesh key={i} position={bar.pos}>
          <boxGeometry args={bar.size} />
          <meshStandardMaterial
            ref={(el) => (matRefs.current[i] = el)}
            color={color}
            emissive={color}
            emissiveIntensity={baseIntensity}
            toneMapped={false}
            transparent={opacity < 1}
            opacity={opacity}
          />
        </mesh>
      ))}
    </group>
  );
}