export const TIMELINE_SPACING = 0.95;

/**
 * Left edge x-coordinate for a row of `count` items, centered on x=0.
 */
export function timelineStartX(count) {
  return -((Math.max(count, 1) - 1) * TIMELINE_SPACING) / 2;
}

/**
 * World-space x for insertion slot `index` in a timeline that currently
 * has `timelineLength` cards. There are timelineLength+1 possible slots
 * (before the first card, between each pair, after the last) — this
 * centers on that WIDENED count, not the current card count, so a
 * hovering/snapped card lines up with where PlayerTimeline opens its
 * gap instead of landing slightly off from it.
 */
export function slotX(index, timelineLength) {
  return timelineStartX(timelineLength + 1) + index * TIMELINE_SPACING;
}

/**
 * Closest valid insertion slot to a raw x position.
 */
export function nearestSlot(x, timelineLength) {
  let bestIndex = 0;
  let bestDistance = Infinity;

  for (let i = 0; i <= timelineLength; i += 1) {
    const candidateX = slotX(i, timelineLength);
    const distance = Math.abs(x - candidateX);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return { index: bestIndex, x: slotX(bestIndex, timelineLength) };
}
