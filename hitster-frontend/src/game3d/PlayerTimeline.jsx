import { Suspense } from "react";
import { Text } from "@react-three/drei";
import AnimatedTimelineCard from "./AnimatedTimelineCard";
import { timelineStartX, TIMELINE_SPACING } from "./placement";
import GlowFrame from "./GlowFrame";

export default function PlayerTimeline({ cards, position, rotation, label, active, hoverIndex }) {
  const hasGap = hoverIndex !== null && hoverIndex !== undefined;
  const startX = timelineStartX(hasGap ? cards.length + 1 : cards.length);
  const rowWidth = (hasGap ? cards.length + 1 : Math.max(cards.length, 1)) * TIMELINE_SPACING + 0.8;

  return (
    <group position={position} rotation={rotation}>
      {active && (
        <GlowFrame
          width={rowWidth}
          depth={1.7}
          color="#ffcf5c"
          y={0.025}
          thickness={0.04}
          baseIntensity={1.3}
          pulseAmount={0.45}
          opacity={0.9}
        />
      )}

      <Text
        position={[startX - 1.1, 0.04, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.32}
        color={active ? "#ffd166" : "white"}
        anchorX="right"
        anchorY="middle"
      >
        {label}
      </Text>

      {cards.map((card, i) => {
        const slot = hasGap && i >= hoverIndex ? i + 1 : i;
        const targetX = startX + slot * TIMELINE_SPACING;
        const key = card.songId ?? `${card.name}-${i}`;

        return (
          <Suspense key={key} fallback={null}>
            <AnimatedTimelineCard card={card} targetX={targetX} />
          </Suspense>
        );
      })}
    </group>
  );
}
