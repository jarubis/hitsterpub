import * as THREE from "three";
import "./VarnishMaterial";
import { MeshReflectorMaterial } from "@react-three/drei";

export const TABLE_WIDTH = 12;  
export const TABLE_DEPTH = 9;   
export const ROOM_WIDTH = 20;    
export const ROOM_DEPTH = 18;    
export const ROOM_HEIGHT = 5.4;


const TOP_THICKNESS = 0.15;
const LEG_HEIGHT = 0.75;

// const ROOM_WIDTH = 16;
// const ROOM_DEPTH = 15;
// const ROOM_HEIGHT = 5.4;
const FLOOR_Y = -(TOP_THICKNESS + LEG_HEIGHT);

const NEON_CYAN = "#35f0c0";
const NEON_CYAN_SOFT = "#6dfbe0";
const AMBER = "#ffcf5c";

function TableLeg({ x, z }) {
  return (
    <mesh position={[x, -TOP_THICKNESS - LEG_HEIGHT / 2, z]} castShadow>
      <boxGeometry args={[0.35, LEG_HEIGHT, 0.35]} />
      <meshStandardMaterial color="#12161c" roughness={0.6} metalness={0.15} />
    </mesh>
  );
}

// Thin emissive frame sitting just under the tabletop lip, slightly
// wider than the top itself — reads as underglow trim from any seat.
function TableUnderglow() {
  return (
    <mesh position={[0, -TOP_THICKNESS - 0.015, 0]}>
      <boxGeometry args={[TABLE_WIDTH + 0.05, 0.02, TABLE_DEPTH + 0.05]} />
      <meshStandardMaterial
        color={NEON_CYAN}
        emissive={NEON_CYAN}
        emissiveIntensity={1.4}
        toneMapped={false}
      />
    </mesh>
  );
}

// Low emissive strip along a wall's base — quiet accent, not a light source.
function WallStrip({ position, rotation, length }) {
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[length, 0.035]} />
      <meshStandardMaterial
        color={NEON_CYAN}
        emissive={NEON_CYAN}
        emissiveIntensity={0.9}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CornerLamp({ x, z }) {
  return (
    <group position={[x, FLOOR_Y, z]}>
      <mesh position={[0, 1.1, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.05, 2.2, 8]} />
        <meshStandardMaterial color="#161c22" roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.15, 0]}>
        <coneGeometry args={[0.4, 0.55, 16, 1, true]} />
        <meshStandardMaterial
          color={NEON_CYAN_SOFT}
          emissive={NEON_CYAN}
          emissiveIntensity={0.75}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, 2.0, 0]} intensity={0.5} color={NEON_CYAN_SOFT} distance={7} decay={2} />
    </group>
  );
}

export default function Room() {
  const legInset = TABLE_WIDTH / 2 - 0.4;

  return (
    <group>
      <mesh position={[0, FLOOR_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_DEPTH]} />
        <meshStandardMaterial color="#0d1319" roughness={0.95} metalness={0.02} />
      </mesh>

      <mesh position={[0, FLOOR_Y + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 48]} />
        <MeshReflectorMaterial
          color="#0b2420"
          roughness={0.8}
          blur={[300, 100]}
          mixBlur={0.7}
          mixStrength={0.55}
          resolution={512}
          mirror={0}
        />
      </mesh>

      <mesh position={[0, FLOOR_Y + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.6, 48]} />
        <meshStandardMaterial color="#0b2420" roughness={0.95} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, FLOOR_Y + ROOM_HEIGHT / 2, -ROOM_DEPTH / 2]} receiveShadow>
        <planeGeometry args={[ROOM_WIDTH, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#0a1119" roughness={0.95} />
      </mesh>
      <mesh position={[-ROOM_WIDTH / 2, FLOOR_Y + ROOM_HEIGHT / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_DEPTH, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#0a141c" roughness={0.95} />
      </mesh>
      <mesh position={[ROOM_WIDTH / 2, FLOOR_Y + ROOM_HEIGHT / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[ROOM_DEPTH, ROOM_HEIGHT]} />
        <meshStandardMaterial color="#0a141c" roughness={0.95} />
      </mesh>

      {/* Quiet neon seam where each wall meets the floor */}
      <WallStrip position={[0, FLOOR_Y + 0.04, -ROOM_DEPTH / 2 + 0.02]} rotation={[0, 0, 0]} length={ROOM_WIDTH} />
      <WallStrip position={[-ROOM_WIDTH / 2 + 0.02, FLOOR_Y + 0.04, 0]} rotation={[0, Math.PI / 2, 0]} length={ROOM_DEPTH} />
      <WallStrip position={[ROOM_WIDTH / 2 - 0.02, FLOOR_Y + 0.04, 0]} rotation={[0, Math.PI / 2, 0]} length={ROOM_DEPTH} />

      {/* Table top — dark lacquer instead of wood, top face at y=0 */}
      <mesh position={[0, -TOP_THICKNESS / 2, 0]} receiveShadow castShadow>
        <boxGeometry args={[TABLE_WIDTH, TOP_THICKNESS, TABLE_DEPTH]} />
        <meshPhysicalMaterial color="#171b24" roughness={0.32} clearcoat={0.7} clearcoatRoughness={0.2} reflectivity={0.45} />
      </mesh>

      <TableUnderglow />

      {/* Varnish clear-coat overlay — fresnel/specular sheen layer */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <planeGeometry args={[TABLE_WIDTH - 0.1, TABLE_DEPTH - 0.1]} />
        <varnishMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      <TableLeg x={-legInset} z={-legInset} />
      <TableLeg x={legInset} z={-legInset} />
      <TableLeg x={-legInset} z={legInset} />
      <TableLeg x={legInset} z={legInset} />

      {/* Pendant light — kept amber; it's already your "active turn" color in the UI */}
      <mesh position={[0, 3.6, 0]}>
        <coneGeometry args={[0.6, 0.4, 24, 1, true]} />
        <meshStandardMaterial color="#3a2f22" roughness={0.6} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 3.3, 0]} intensity={1.05} color={AMBER} distance={12} decay={2} castShadow />

      <CornerLamp x={-ROOM_WIDTH / 2 + 1.2} z={-ROOM_DEPTH / 2 + 1.2} />
      <CornerLamp x={ROOM_WIDTH / 2 - 1.2} z={-ROOM_DEPTH / 2 + 1.2} />
    </group>
  );
}