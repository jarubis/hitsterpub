import { useState, useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import Card3D from "./Card3D";
import { nearestSlot } from "./placement";


const BOB_AMPLITUDE = 0.05;
const BOB_SPEED = 2.2;
const TABLE_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.03);
const FREE_LIFT_HEIGHT = 0.4;
const SNAPPED_LIFT_HEIGHT = 0.16;
const REST_HEIGHT = 0.16;
const SNAP_Z_THRESHOLD = 1.6;

export default function DraggableCard({ tableBounds, rowZ, timelineLength, onPositionChange, disabled, onDragStateChange }) {
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState([0, REST_HEIGHT, 2.6]);
  const { camera, raycaster, pointer } = useThree();
  const groupRef = useRef();
  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const [x, y, z] = position;
    const bob = dragging ? 0 : Math.sin(clock.elapsedTime * BOB_SPEED) * BOB_AMPLITUDE;
    group.position.set(x, y + bob, z);
  });
  useEffect(() => {
    return () => {
      if (dragging) onDragStateChange?.(false);
    };
  }, [dragging, onDragStateChange]);

  const projectToTable = () => {
    raycaster.setFromCamera(pointer, camera);
    const point = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(TABLE_PLANE, point);
    return hit ? point : null;
  };

  const resolve = (rawX, rawZ) => {
    const distanceToRow = Math.abs(rawZ - rowZ);
    const { index, x: snappedX } = nearestSlot(rawX, timelineLength);

    if (distanceToRow <= SNAP_Z_THRESHOLD) {
      return { x: snappedX, y: SNAPPED_LIFT_HEIGHT, z: rowZ, index };
    }
    return { x: rawX, y: FREE_LIFT_HEIGHT, z: rawZ, index };
  };

  const report = (resolved) => {
    onPositionChange?.(resolved.x, resolved.z - rowZ, resolved.y, resolved.index);
  };

  const handlePointerDown = (event) => {
    if (disabled) return;
    event.stopPropagation();
    event.target.setPointerCapture(event.pointerId);
    setDragging(true);
    onDragStateChange?.(true);
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    event.stopPropagation();

    const hit = projectToTable();
    if (!hit) return;

    const rawX = THREE.MathUtils.clamp(hit.x, tableBounds.minX, tableBounds.maxX);
    const rawZ = THREE.MathUtils.clamp(hit.z, tableBounds.minZ, tableBounds.maxZ);
    const resolved = resolve(rawX, rawZ);

    setPosition([resolved.x, resolved.y, resolved.z]);
    report(resolved);
  };

  const handlePointerUp = (event) => {
    if (!dragging) return;
    event.stopPropagation();
    setDragging(false);
    onDragStateChange?.(false);

    const [x, , z] = position;
    const resolved = resolve(x, z);
    report(resolved);
    setPosition([resolved.x, resolved.y, resolved.z]); // keep the hover height resolve() computed
  };
  return (
    <group
      ref={groupRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Card3D position={[0, 0, 0]} backLabel="?" />
    </group>
  );
}
