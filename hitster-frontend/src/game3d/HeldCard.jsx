import Card3D from "./Card3D";

export default function HeldCard({ position }) {
  return (
    <group position={position}>
      <Card3D position={[0, 0, 0]} backLabel="?" />
    </group>
  );
}