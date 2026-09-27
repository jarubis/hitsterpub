import { useRef,useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROOM_WIDTH, ROOM_DEPTH, ROOM_HEIGHT } from "./Room";


export default function PartyLights({ audioLevelRef, enabled = true }) {
  return (
    <group>
      <DiscoBall audioLevelRef={audioLevelRef} enabled={enabled} />
      <MinimalAmbience />
    </group>
  );
}

function DiscoBall({ audioLevelRef, enabled }) {
  const ballGroupRef = useRef();
  const lightRefsRef = useRef([]);
  const timeRef = useRef(0);
  const peakRef = useRef(0);

  const facetGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(facetGeo), [facetGeo]);

  // Light positions around the disco ball (like a real lighting rig)
  const LIGHT_POSITIONS = [
    { pos: [4, ROOM_HEIGHT * 0.7, 4], color: "#ff2d95" },
    { pos: [-4, ROOM_HEIGHT * 0.7, 4], color: "#00e5ff" },
    { pos: [4, ROOM_HEIGHT * 0.7, -4], color: "#7cff4d" },
    { pos: [-4, ROOM_HEIGHT * 0.7, -4], color: "#ffb300" },
    { pos: [0, ROOM_HEIGHT * 0.9, 0], color: "#b34dff" },
  ];

  useFrame((_, delta) => {
    const level = enabled ? audioLevelRef?.current ?? 0 : 0;
    timeRef.current += delta;
    const t = timeRef.current;

    if (level > peakRef.current) peakRef.current = level;
    else peakRef.current *= 0.92;

    if (ballGroupRef.current) {
      const baseRotation = t * 0.8;
      const audioBoost = level * 1.02;
      ballGroupRef.current.rotation.y = baseRotation + audioBoost * t;
      ballGroupRef.current.rotation.x = Math.sin(t * 0.3) * 0.15;
      const scale = 1 + level * 0.08 + peakRef.current * 0.05;
      ballGroupRef.current.scale.set(scale, scale, scale);
    }

    lightRefsRef.current.forEach((light, i) => {
      if (!light) return;
      const pulse = Math.sin(t * 2 + i * Math.PI / 2.5) * 0.3 + 0.7;
      light.intensity = Math.max(0.4, pulse + level * 1.5 + peakRef.current * 1);
      light.distance = ROOM_WIDTH * (1.2 + level * 0.4);
    });
  });

  return (
    <group>
      <group ref={ballGroupRef} position={[0, ROOM_HEIGHT , 0]}>
        <mesh geometry={facetGeo}>
          <meshStandardMaterial
            color="#d8d8d8"
            metalness={3}
            roughness={0.08}
            flatShading
            emissive="#ecf0f4"
            emissiveIntensity={0.58}
          />
        </mesh>
        <lineSegments geometry={edgesGeo}>
          <lineBasicMaterial color="#000000" transparent opacity={0.55} />
        </lineSegments>
      </group>

      {LIGHT_POSITIONS.map((light, i) => (
        <pointLight
          key={`disco-light-${i}`}
          ref={(el) => (lightRefsRef.current[i] = el)}
          position={light.pos}
          color={light.color}
          intensity={1.5}
          distance={ROOM_WIDTH * 1.2}
          decay={1.3}
          castShadow={false}
        />
      ))}

      {/* <mesh position={[0, ROOM_HEIGHT / 2, 0]}>
        <icosahedronGeometry args={[1.9, 5]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.08} blending={THREE.AdditiveBlending} side={THREE.BackSide} />
      </mesh> */}
    </group>
  );
}

function MinimalAmbience() {
  return (
    <group>
      {/* Single soft ambient light */}
      <pointLight
        position={[0, ROOM_HEIGHT / 2, 0]}
        color="#ffffff"
        intensity={0.5}
        distance={ROOM_WIDTH * 2}
        decay={1}
      />
    </group>
  );
}
