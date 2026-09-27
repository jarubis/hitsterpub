import { useTexture } from "@react-three/drei";
import { mockSongs } from "../mockSongs";

// Side-effect import (see App.jsx). Real art is only ever drawn by
// AnimatedTimelineCard when a card is revealed; preloading here means
// that fetch has already happened by then, so the reveal flip never
// stalls on the network.
mockSongs.forEach((song) => {
  if (song.image) useTexture.preload(song.image);
});
