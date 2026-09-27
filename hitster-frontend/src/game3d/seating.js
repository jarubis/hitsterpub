export const SEAT_ROTATION = {
  front: 0,
  back: Math.PI,
  right: Math.PI / 2,
  left: -Math.PI / 2,
};

const EDGE_ORDER = ["back", "right", "left"];
const SEAT_OFFSET = 1.3;

export function computeSeats(players, myId, tableWidth, tableDepth) {
  const me = players.find((p) => p.id === myId);
  const others = players.filter((p) => p.id !== myId);

  const backXRange = tableWidth / 2 - 1.2;
  const sideZRange = tableDepth / 2 - 1.0;
  const myZ = tableDepth / 2 - 1.0;

  const seats = new Map();

  if (me) {
    seats.set(me.id, {
      position: [0, 0, myZ],
      rotation: [0, SEAT_ROTATION.front, 0],
      edge: "front",
    });
  }

  const perEdgeCounts = { back: 0, right: 0, left: 0 };
  const assigned = others.map((player, i) => {
    const edge = EDGE_ORDER[i % EDGE_ORDER.length];
    const seatIndex = perEdgeCounts[edge];
    perEdgeCounts[edge] += 1;
    return { player, edge, seatIndex };
  });

  assigned.forEach(({ player, edge, seatIndex }) => {
    const total = perEdgeCounts[edge];
    const t = total === 1 ? 0 : -1 + (2 * seatIndex) / (total - 1);

    let position;
    if (edge === "back") {
      position = [t * backXRange, 0, -(tableDepth / 2 + SEAT_OFFSET)];
    } else if (edge === "right") {
      position = [tableWidth / 2 + SEAT_OFFSET, 0, t * sideZRange];
    } else {
      position = [-(tableWidth / 2 + SEAT_OFFSET), 0, t * sideZRange];
    }

    seats.set(player.id, { position, rotation: [0, SEAT_ROTATION[edge], 0], edge });
  });

  return seats;
}

/**
 * Local (lx, loutward) -> world (x, z) for a given seat. Every seat
 * rotation is a multiple of 90°, so cos/sin round to exact -1/0/1.
 */
export function localToWorld(seat, lx, loutward) {
  const theta = seat.rotation[1];
  const cos = Math.round(Math.cos(theta));
  const sin = Math.round(Math.sin(theta));

  const worldX = seat.position[0] + lx * cos + loutward * sin;
  const worldZ = seat.position[2] - lx * sin + loutward * cos;

  return [worldX, worldZ];
}

/**
 * World (x, z) -> local (lx, loutward) for a given seat — the inverse
 * of localToWorld. Used to express a fixed world point (like the draw
 * pile at the table's center) in terms of "how far sideways / how far
 * outward from THIS seat" it is, so a draw animation can be computed
 * once in local terms and correctly transformed for every viewer.
 */
export function worldToLocal(seat, worldX, worldZ) {
  const theta = seat.rotation[1];
  const cos = Math.round(Math.cos(theta));
  const sin = Math.round(Math.sin(theta));

  const dx = worldX - seat.position[0];
  const dz = worldZ - seat.position[2];

  const lx = dx * cos - dz * sin;
  const loutward = dx * sin + dz * cos;

  return [lx, loutward];
}
