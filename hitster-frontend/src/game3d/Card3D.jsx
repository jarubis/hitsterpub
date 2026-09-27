import { useTexture, Text } from "@react-three/drei";

export const CARD_WIDTH = 0.72;      
export const CARD_THICKNESS = 0.035; 
export const CARD_DEPTH = 0.72;      
const BLANK_TEXTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/**
 * A flat 3D card with BOTH faces permanently baked: `backLabel` (e.g.
 * "?") on the top (+Y) face, album art + optional `frontLabel` (e.g.
 * the year) on the bottom (-Y) face. Which one is visible is entirely
 * up to whatever rotation the parent applies — rotate 180° around X
 * and the art face (with its label) swings up together, correctly
 * oriented, since both are children of the same transform.
 */
export default function Card3D({ position = [0, 0, 0], rotation = [0, 0, 0], albumUrl, backLabel, frontLabel }) {
  const texture = useTexture(albumUrl || BLANK_TEXTURE);

  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CARD_WIDTH, CARD_THICKNESS, CARD_DEPTH]} />
        <meshStandardMaterial attach="material-0" color="#1c1c28" />
        <meshStandardMaterial attach="material-1" color="#1c1c28" />
        <meshStandardMaterial attach="material-2" color="#2b2b3d" />
        <meshStandardMaterial attach="material-3" map={albumUrl ? texture : null} color={albumUrl ? "white" : "#0e0e16"} roughness={0.35} />        <meshStandardMaterial attach="material-4" color="#1c1c28" />
        <meshStandardMaterial attach="material-5" color="#1c1c28" />
      </mesh>

      {backLabel && (
        <Text
          position={[0, CARD_THICKNESS / 2 + 0.02, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.28}
          color="#8a8aa0"
          anchorX="center"
          anchorY="middle"
        >
          {backLabel}
        </Text>
      )}

      {frontLabel && (
        <Text
          position={[0, -CARD_THICKNESS / 2 - 0.02, 0.26]}
          rotation={[Math.PI / 2, 0, 0]}
          fontSize={0.16}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {frontLabel}
        </Text>
      )}
    </group>
  );
}
