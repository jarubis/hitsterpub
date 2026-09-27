import { useRef, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Card3D from "./Card3D";

const DAMP_SPEED = 9;
const FLIP_DAMP_SPEED = 6;
const DROP_START_Y = 0.5;
const REST_Y = 0.03;
const FLIPPED_ROTATION_X = Math.PI;

export default function AnimatedTimelineCard({ card, targetX }) {
  const groupRef = useRef();
  const targetXRef = useRef(targetX);
  const [initialPosition] = useState(() => [targetX, DROP_START_Y, 0]);

  useEffect(() => {
    targetXRef.current = targetX;
  }, [targetX]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    group.position.x = THREE.MathUtils.damp(group.position.x, targetXRef.current, DAMP_SPEED, delta);
    group.position.y = THREE.MathUtils.damp(group.position.y, REST_Y, DAMP_SPEED, delta);
    group.rotation.x = THREE.MathUtils.damp(group.rotation.x, FLIPPED_ROTATION_X, FLIP_DAMP_SPEED, delta);
  });

  return (
    <group ref={groupRef} position={initialPosition}>
      <Card3D position={[0, 0, 0]} albumUrl={card.image} backLabel="?" frontLabel={String(card.year)} />
    </group>
  );
}
