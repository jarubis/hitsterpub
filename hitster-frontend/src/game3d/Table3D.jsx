import { Suspense, useMemo, useState,useEffect  } from "react";
import { Canvas } from "@react-three/fiber";
import { EffectComposer, Bloom, Vignette,SSAO } from "@react-three/postprocessing";
import { OrbitControls, Environment, AccumulativeShadows, RandomizedLight, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import Room, { TABLE_WIDTH, TABLE_DEPTH } from "./Room";
import PlayerTimeline from "./PlayerTimeline";
import CardPile from "./CardPile";
import DraggableCard from "./DraggableCard";
import RemoteCard from "./RemoteCard";
import HeldCard from "./HeldCard";
import { computeSeats, localToWorld } from "./seating";
import PartyLights from "./PartyLights";

const TABLE_BOUNDS = {
  minX: -TABLE_WIDTH / 2 + 0.7,
  maxX: TABLE_WIDTH / 2 - 0.7,
  minZ: -TABLE_DEPTH / 2 + 0.6,
  maxZ: TABLE_DEPTH / 2 - 0.3,
};

/**
 * `phase` only matters for the active player's own screen:
 *   "idle" -> "flying" -> "held" -> "descending" -> "placing"
 * `drawn` is the generic flag everyone (including spectators) sees —
 * true from the moment the active player clicks the pile.
 */
export default function Table3D({
  players,
  myId,
  currentTurnPlayerId,
  isMyTurn,
  activeHoverIndex,
  remoteDragPosition,
  onDragMove,
  disabled,
  drawn,
  phase,
  selfFlightPosition,
  heldControls,
  onDrawCard,
  showActiveCard,
  audioLevelRef,
  musicPlaying,
}) {
  const seats = useMemo(
    () => computeSeats(players, myId, TABLE_WIDTH, TABLE_DEPTH),
    [players, myId]
  );

  const me = players.find((p) => p.id === myId);
  const others = players.filter((p) => p.id !== myId);
  const [isDraggingCard, setIsDraggingCard] = useState(false);

  const myTimeline = me?.timeline ?? [];
  const mySeat = seats.get(myId);
  const activeSeat = currentTurnPlayerId ? seats.get(currentTurnPlayerId) : null;

  const isSelfGhosting = isMyTurn && (phase === "flying" || phase === "descending");
  const isSpectatorGhosting = !isMyTurn && drawn && !!currentTurnPlayerId;

  const ghostSource = isSelfGhosting ? selfFlightPosition : isSpectatorGhosting ? remoteDragPosition : null;
  const ghostWorld = activeSeat && ghostSource ? localToWorld(activeSeat, ghostSource.lx, ghostSource.loutward) : null;

  const showGhost = showActiveCard && (isSelfGhosting || isSpectatorGhosting);
  const showHeld = showActiveCard && isMyTurn && phase === "held" && mySeat;
  const showDraggable = showActiveCard && isMyTurn && phase === "placing" && mySeat;

  useEffect(() => {
    if (!showDraggable && isDraggingCard) setIsDraggingCard(false);
  }, [showDraggable, isDraggingCard]);

  const heldWorldXZ = showHeld ? localToWorld(mySeat, 0, heldControls.loutward) : null;

  const handlePositionChange = (lx, loutward, y, index) => {
    onDragMove?.({ lx, loutward, y, index });
  };

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas
        shadows="soft"
        dpr={[1, 1.5]}
        camera={{ position: [0, 10.5, 12], fov: 45 }}
        gl={{ toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
      <fog attach="fog" args={["#080d12", 14, 34]} />

      <hemisphereLight args={["#7fa8a3", "#2a1f16", 0.3]} />
      <ambientLight intensity={0.12} />
      <directionalLight position={[5, 9, 4]} intensity={0.35} color="#cdeee6" castShadow shadow-mapSize={[2048, 2048]} />
      <Environment preset="night" environmentIntensity={0.4} />
      <AccumulativeShadows temporal frames={60} scale={22} position={[0, -0.01, 0]} opacity={0.75} color="#05090c" alphaTest={0.9}>
        <RandomizedLight amount={6} radius={4} ambient={0.5} intensity={1} position={[5, 9, 4]} bias={0.0015} />
      </AccumulativeShadows>

        <Room />
        
        <ContactShadows
          position={[0, -0.02, 0]}
          opacity={0.35}
          scale={22}
          blur={2.4}
          far={4.5}
          resolution={1024}
          color="#000000"
        />
        <PartyLights audioLevelRef={audioLevelRef} enabled={musicPlaying} />

        <OrbitControls
          enabled={!isDraggingCard}
          target={[0, 0.3, 0]}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={6}
          maxDistance={18}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.15}
        />
        <Suspense fallback={null}>
          {me && mySeat && (
            <PlayerTimeline
              cards={myTimeline}
              position={mySeat.position}
              rotation={mySeat.rotation}
              label={`${me.name} (you)`}
              active={me.id === currentTurnPlayerId}
              hoverIndex={me.id === currentTurnPlayerId ? activeHoverIndex : null}
            />
          )}

          {others.map((player) => {
            const seat = seats.get(player.id);
            if (!seat) return null;
            return (
              <PlayerTimeline
                key={player.id}
                cards={player.timeline}
                position={seat.position}
                rotation={seat.rotation}
                label={player.name}
                active={player.id === currentTurnPlayerId}
                hoverIndex={player.id === currentTurnPlayerId ? activeHoverIndex : null}
              />
            );
          })}

          <CardPile interactive={isMyTurn && phase === "idle" && showActiveCard} onDraw={onDrawCard} />

          {showDraggable && (
            <DraggableCard
              tableBounds={TABLE_BOUNDS}
              rowZ={mySeat.position[2]}
              timelineLength={myTimeline.length}
              onPositionChange={handlePositionChange}
              disabled={disabled}
              onDragStateChange={setIsDraggingCard}
            />
          )}

          {showHeld && (
            <HeldCard position={[heldWorldXZ[0], heldControls.y, heldWorldXZ[1]]} />
          )}

          {showGhost && !showHeld && (
            <RemoteCard x={ghostWorld?.[0]} y={ghostSource?.y} z={ghostWorld?.[1]} />
          )}
        </Suspense>

        <EffectComposer multisampling={2}>
          <SSAO samples={20} radius={0.4} intensity={12} luminanceInfluence={0.5} />
          <Bloom luminanceThreshold={0.55} luminanceSmoothing={0.25} intensity={0.45} mipmapBlur />
          <Vignette eskil={false} offset={0.15} darkness={0.6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
