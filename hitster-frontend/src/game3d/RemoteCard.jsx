import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Card3D from "./Card3D";

const REST_POSITION = [0, 0.03, 2.6];
const DAMP_SPEED = 9;

/**
 * Non-interactive twin used for anything that isn't under MY direct
 * control — another player's drag, another player's draw-flight, or
 * my own flight/held/descend phases (rendered this way even on my own
 * screen, since those aren't interactive either).
 */
export default function RemoteCard({ x, y, z }) {
  const groupRef = useRef();
  const [initialPosition] = useState(() => [...REST_POSITION]);
  const targetRef = useRef({
    x: x ?? REST_POSITION[0],
    y: y ?? REST_POSITION[1],
    z: z ?? REST_POSITION[2],
  });

  useEffect(() => {
    targetRef.current = {
      x: x ?? REST_POSITION[0],
      y: y ?? REST_POSITION[1],
      z: z ?? REST_POSITION[2],
    };
  }, [x, y, z]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const target = targetRef.current;
    group.position.x = THREE.MathUtils.damp(group.position.x, target.x, DAMP_SPEED, delta);
    group.position.y = THREE.MathUtils.damp(group.position.y, target.y, DAMP_SPEED, delta);
    group.position.z = THREE.MathUtils.damp(group.position.z, target.z, DAMP_SPEED, delta);
  });

  return (
    <group ref={groupRef} position={initialPosition}>
      <Card3D position={[0, 0, 0]} backLabel="?" />
    </group>
  );
}
