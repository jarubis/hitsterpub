import { useState } from "react";
import Card3D, { CARD_WIDTH, CARD_DEPTH } from "./Card3D";
import GlowFrame from "./GlowFrame";

const PILE_CARD_COUNT = 7;
const PILE_SPACING_Y = 0.045;

export default function CardPile({ interactive, onDraw }) {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={[0, 0, 0]}>
      {Array.from({ length: PILE_CARD_COUNT }).map((_, i) => {
        const isTop = i === PILE_CARD_COUNT - 1;
        const jitterX = ((i * 37) % 7) / 100 - 0.03;
        const jitterZ = ((i * 53) % 7) / 100 - 0.03;
        const jitterRot = ((i * 19) % 11) / 100 - 0.05;
        const canInteract = isTop && interactive;

        return (
          <group
            key={i}
            position={[jitterX, i * PILE_SPACING_Y, jitterZ]}
            rotation={[0, jitterRot, 0]}
            onPointerDown={
              canInteract
                ? (event) => {
                    event.stopPropagation();
                    onDraw?.();
                  }
                : undefined
            }
            onPointerOver={canInteract ? () => setHovered(true) : undefined}
            onPointerOut={canInteract ? () => setHovered(false) : undefined}
          >
            <Card3D position={[0, 0, 0]} backLabel="?" />

            {canInteract && hovered && (
              <GlowFrame
                width={CARD_WIDTH + 0.14}
                depth={CARD_DEPTH + 0.14}
                color="#35f0c0"
                y={0.045}
                thickness={0.05}
                baseIntensity={2.2}
                pulseAmount={0.9}
              />
            )}
          </group>
        );
      })}
    </group>
  );
}
