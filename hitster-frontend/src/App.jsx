import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import Table3D from "./game3d/Table3D";
import { computeSeats, worldToLocal } from "./game3d/seating";
import { TABLE_WIDTH, TABLE_DEPTH } from "./game3d/Room";
import { mockSongs } from "./mockSongs";
import { startTestGame } from "./testBots";
import "./game3d/preloadArt";
import "./App.css";

const socket = io("http://localhost:3000");

const FLIGHT_STEPS = 14;
const FLIGHT_INTERVAL_MS = 35;
const HELD_LOCAL = { lx: 0, loutward: 2.0, y: 1.4 };
const REST_LOCAL = { lx: 0, loutward: -0.1, y: 0.16 }; 
const DRAG_EMIT_INTERVAL_MS = 40;

function runFlight({ from, to, gameId, onUpdate, onDone }) {
  let step = 0;
  const timer = setInterval(() => {
    step += 1;
    const t = step / FLIGHT_STEPS;
    const eased = 1 - Math.pow(1 - t, 3);
    const point = {
      lx: from.lx + (to.lx - from.lx) * eased,
      loutward: from.loutward + (to.loutward - from.loutward) * eased,
      y: from.y + (to.y - from.y) * eased,
      index: 0,
    };
    onUpdate(point);
    socket.emit("card_drag", { gameId, ...point });

    if (step >= FLIGHT_STEPS) {
      clearInterval(timer);
      onDone();
    }
  }, FLIGHT_INTERVAL_MS);
  return timer;
}

export default function App() {
  const [screen, setScreen] = useState("menu");
  const [gameId, setGameId] = useState("");
  const [username, setUsername] = useState("");
  const [players, setPlayers] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedSongs, setSelectedSongs] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState("");
  const [roundResult, setRoundResult] = useState(null);

  const [pendingIndex, setPendingIndex] = useState(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [remoteDrag, setRemoteDrag] = useState(null);

  const [phase, setPhase] = useState("idle");
  const [drawn, setDrawn] = useState(false);
  const [selfFlight, setSelfFlight] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [gameEndData, setGameEndData] = useState(null);

  const lastEmitRef = useRef(0);
  const audioRef = useRef(null);
  const flightTimerRef = useRef(null);
  const botSocketsRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioLevelRef = useRef(0);
  const analyserRafRef = useRef(null);

  const isMyTurn = currentTurnPlayerId === socket.id;
  const activeHoverIndex = isMyTurn ? pendingIndex : remoteDrag?.index ?? null;
  const activePlayerName = players.find((p) => p.id === currentTurnPlayerId)?.name ?? "someone";

  useEffect(() => {
    const handlePlayersUpdated = (updatedPlayers) => setPlayers(updatedPlayers);

    const handleAudioPlay = ({ time }) => {
      const audio = audioRef.current;
      if (!audio) return;
      ensureAudioAnalyser();
      if (typeof time === "number") audio.currentTime = time;
      audio.play().catch(() => {});
      setIsPlaying(true);
    };

    const handleAudioPause = () => {
      audioRef.current?.pause();
      setIsPlaying(false);
    };

    const handleNewSong = ({ song, currentTurnPlayerId: turnId }) => {
      if (flightTimerRef.current) clearInterval(flightTimerRef.current);

      setCurrentSong(song);
      setCurrentTurnPlayerId(turnId);
      setPendingIndex(null);
      setHasSubmitted(false);
      setRoundResult(null);
      setRemoteDrag(null);
      setPhase("idle");
      setDrawn(false);
      setSelfFlight(null);
      setIsPlaying(false);
      setError("");

      // if (audioRef.current && song.audioUrl) {
      //   audioRef.current.pause();
      //   audioRef.current.src = song.audioUrl;
      //   audioRef.current.currentTime = 0;
      // }
    };

    const handleRoundResults = (data) => {
      audioRef.current?.pause();
      setIsPlaying(false);
      setRoundResult(data);
      setPlayers(data.players);
      setRemoteDrag(null);
      setPendingIndex(null);
    };

    const handleTurnUpdate = ({ currentTurnPlayerId: turnId, roundFinished }) => {
      setCurrentTurnPlayerId(turnId);
      setRemoteDrag(null);
      if (roundFinished) setHasSubmitted(true);
    };

    const handleCardDrag = ({ lx, loutward, y, index }) => {
      setRemoteDrag({ lx, loutward, y, index });
    };

    const handleCardDrawn = () => setDrawn(true);

    const handleHostChanged = ({ hostId }) => setIsHost(hostId === socket.id);
    const handleGameReady = () => {};

    const handleGameEnd = (data) => {
      audioRef.current?.pause();
      botSocketsRef.current.forEach((bot) => bot.disconnect());
      botSocketsRef.current = [];
      setGameEndData(data);
      setScreen("gameEnd");
    };

    socket.on("players_updated", handlePlayersUpdated);
    socket.on("new_song", handleNewSong);
    socket.on("round_results", handleRoundResults);
    socket.on("turn_update", handleTurnUpdate);
    socket.on("card_drag", handleCardDrag);
    socket.on("card_drawn", handleCardDrawn);
    socket.on("game_ready", handleGameReady);
    socket.on("host_changed", handleHostChanged);
    socket.on("game_end", handleGameEnd);
    socket.on("audio_play", handleAudioPlay);
    socket.on("audio_pause", handleAudioPause);

    return () => {
      socket.off("players_updated", handlePlayersUpdated);
      socket.off("new_song", handleNewSong);
      socket.off("round_results", handleRoundResults);
      socket.off("turn_update", handleTurnUpdate);
      socket.off("card_drag", handleCardDrag);
      socket.off("card_drawn", handleCardDrawn);
      socket.off("game_ready", handleGameReady);
      socket.off("host_changed", handleHostChanged);
      socket.off("game_end", handleGameEnd);
      socket.off("audio_play", handleAudioPlay);
      socket.off("audio_pause", handleAudioPause);
      if (flightTimerRef.current) clearInterval(flightTimerRef.current);
      if (analyserRafRef.current) cancelAnimationFrame(analyserRafRef.current);
    };
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong?.audioUrl) return;
    audio.pause();
    audio.src = currentSong.audioUrl;
    audio.currentTime = 0;
    }, [currentSong]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    setSearchResults(
      mockSongs.filter(
        (song) =>
          song.name.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query)
      )
    );
  };

  const toggleSong = (song) => {
    const alreadySelected = selectedSongs.some((s) => s.id === song.id);
    setSelectedSongs((prev) =>
      alreadySelected ? prev.filter((s) => s.id !== song.id) : [...prev, song]
    );
  };

  const createGame = () => {
    if (!username.trim()) return setError("Please enter your name.");
    if (selectedSongs.length === 0) return setError("Please add at least one song.");

    setError("");

    socket.emit("create_game", ({ success, gameId: newGameId, isHost, message }) => {
      if (!success) return setError(message || "Could not create game.");

      setGameId(newGameId);
      setIsHost(isHost);

      socket.emit(
        "set_host_name",
        { gameId: newGameId, username: username.trim() },
        ({ success: nameOk, message: nameMsg }) => {
          if (!nameOk) return setError(nameMsg || "Could not set host name.");

          socket.emit(
            "set_songs",
            { gameId: newGameId, songs: selectedSongs },
            ({ success: songsOk, message: songsMsg }) => {
              if (!songsOk) return setError(songsMsg || "Could not save songs.");
              setScreen("playing");
            }
          );
        }
      );
    });
  };

  const joinGame = () => {
    if (!gameId.trim()) return setError("Please enter a game ID.");
    if (!username.trim()) return setError("Please enter your name.");

    setError("");

    socket.emit(
      "join_game",
      { gameId: gameId.trim().toUpperCase(), username: username.trim() },
      ({ success, gameId: joinedGameId, isHost: joinedAsHost, message }) => {
        if (!success) return setError(message || "Failed to join game.");
        setGameId(joinedGameId);
        setIsHost(joinedAsHost);
        setScreen("playing");
      }
    );
  };

  const startGame = () => {
    setError("");
    socket.emit("start_game", { gameId }, ({ success, message }) => {
      if (!success) setError(message || "Could not start game.");
    });
  };

  const returnToMenu = () => {
    setScreen("menu");
    setGameId("");
    setPlayers([]);
    setCurrentSong(null);
    setCurrentTurnPlayerId(null);
    setRoundResult(null);
    setSelectedSongs([]);
    setIsHost(false);
    setError("");
    setGameEndData(null);
  };

  const startTestGame4P = () => {
    setError("");
    startTestGame(
      socket,
      mockSongs.slice(0, 12),
      (newGameId, bots) => {
        botSocketsRef.current = bots;
        setGameId(newGameId);
        setIsHost(true);
        setScreen("playing");
      },
      (message) => setError(message || "Could not start test game.")
    );
  };

  const handleDrawCard = () => {
    if (!isMyTurn || phase !== "idle") return;

    const seats = computeSeats(players, socket.id, TABLE_WIDTH, TABLE_DEPTH);
    const mySeat = seats.get(socket.id);
    if (!mySeat) return;

    const [pileLx, pileLoutward] = worldToLocal(mySeat, 0, 0);

    setDrawn(true);
    setPhase("flying");
    socket.emit("card_drawn", { gameId });

    if (flightTimerRef.current) clearInterval(flightTimerRef.current);
    flightTimerRef.current = runFlight({
      from: { lx: pileLx, loutward: pileLoutward, y: 0.3 },
      to: HELD_LOCAL,
      gameId,
      onUpdate: setSelfFlight,
      onDone: () => {
        setSelfFlight(null);
        setPhase("held");
      },
    });
  };
  const ensureAudioAnalyser = () => {
    if (analyserRef.current || !audioRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const source = ctx.createMediaElementSource(audioRef.current);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        audioLevelRef.current = avg / 255;
        analyserRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      // Cross-origin audio without CORS headers will throw here —
      // playback still works, we just won't get level data.
      console.warn("Audio analyser unavailable:", err);
    }
    audioContextRef.current?.resume?.();
  };

  const handlePlayPauseHeld = () => {
      if (!audioRef.current) return;
      ensureAudioAnalyser();
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        socket.emit("audio_pause", { gameId });
      } else {
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            socket.emit("audio_play", { gameId, time: audioRef.current.currentTime });
          })
          .catch((err) => {
            console.error("Playback failed:", err);
            setIsPlaying(false);
          });
      }
    };
  const handleVolumeChangeHeld = (delta) => {
    if (!audioRef.current) return;
    const next = Math.min(1, Math.max(0, Math.round((audioRef.current.volume + delta) * 10) / 10));
    audioRef.current.volume = next;
    setVolume(next);
  };

  const handleGuessFromHeld = () => {
    if (phase !== "held") return;

    audioRef.current?.pause();
    setIsPlaying(false);
    socket.emit("audio_pause", { gameId });

    setPhase("descending");

    if (flightTimerRef.current) clearInterval(flightTimerRef.current);
    flightTimerRef.current = runFlight({
      from: HELD_LOCAL,
      to: REST_LOCAL,
      gameId,
      onUpdate: setSelfFlight,
      onDone: () => {
        setSelfFlight(null);
        setPhase("placing");
      },
    });
  };
  const handleDragMove = ({ lx, loutward, y, index }) => {
    if (!isMyTurn || phase !== "placing" || hasSubmitted) return;

    setPendingIndex(index);

    const now = performance.now();
    if (now - lastEmitRef.current < DRAG_EMIT_INTERVAL_MS) return;
    lastEmitRef.current = now;

    socket.emit("card_drag", { gameId, lx, loutward, y, index });
  };

  const confirmPlacement = () => {
    if (pendingIndex === null) return setError("Drag the card into your timeline first.");

    setError("");

    socket.emit("submit_placement", { gameId, index: pendingIndex }, ({ success, message }) => {
      if (!success) return setError(message || "Could not submit placement.");
      setHasSubmitted(true);
    });
  };

  if (screen === "menu") {
    return (
      <div className="app-shell">
        <div className="hero">
          <div className="vinyl" aria-hidden="true"><span className="vinyl-label" /></div>
          <h1 className="hero-title">Hitster</h1>
          <p className="hero-tag">Guess the year, build your timeline, beat the room.</p>
        </div>

        <div className="panel panel-narrow">
          <div className="field">
            <label htmlFor="username">Your name</label>
            <input id="username" type="text" placeholder="e.g. Jamie" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          {error && <p className="error-banner">{error}</p>}

          <div className="btn-stack">
            <button className="btn btn-primary" onClick={() => { setError(""); setScreen("host"); }}>Host a game</button>
            <button className="btn btn-ghost" onClick={() => { setError(""); setScreen("join"); }}>Join a game</button>
          </div>

          {import.meta.env.DEV && (
            <button className="btn btn-dev" onClick={startTestGame4P}>Start test game (4 players)</button>
          )}
        </div>
      </div>
    );
  }

  if (screen === "host") {
    return (
      <div className="app-shell">
        <div className="panel panel-wide">
          <div className="panel-head">
            <h2>Build the playlist</h2>
            <p className="panel-sub">Search and add the tracks you want in play.</p>
          </div>

          <div className="field">
            <label htmlFor="host-name">Your name</label>
            <input id="host-name" type="text" placeholder="e.g. Jamie" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div className="search-row">
            <input
              type="text"
              placeholder="Search for a song or artist"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
            />
            <button className="btn btn-primary btn-inline" onClick={handleSearch}>Search</button>
          </div>

          {error && <p className="error-banner">{error}</p>}

          {searchResults.length > 0 && (
            <div className="song-results">
              {searchResults.map((song) => {
                const isSelected = selectedSongs.some((s) => s.id === song.id);
                return (
                  <div key={song.id} className={`song-row ${isSelected ? "is-selected" : ""}`}>
                    <img src={song.image} alt="" />
                    <div className="song-meta">
                      <p className="song-name">{song.name}</p>
                      <p className="song-sub">{song.artist} · {song.year}</p>
                    </div>
                    <button className={`btn btn-chip ${isSelected ? "is-selected" : ""}`} onClick={() => toggleSong(song)}>
                      {isSelected ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="selected-panel">
            <div className="selected-head">
              <h3>Selected tracks</h3>
              <span className="count-badge">{selectedSongs.length}</span>
            </div>
            {selectedSongs.length === 0 && <p className="empty-note">Nothing queued yet — search above to add songs.</p>}
            {selectedSongs.length > 0 && (
              <div className="selected-list">
                {selectedSongs.map((song) => (
                  <div key={song.id} className="selected-chip">
                    <span>{song.name} — {song.artist}</span>
                    <button className="chip-remove" onClick={() => toggleSong(song)} aria-label={`Remove ${song.name}`}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" onClick={createGame} disabled={!username.trim() || selectedSongs.length === 0}>Create room</button>
            <button className="btn btn-ghost" onClick={() => { setError(""); setScreen("menu"); }}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "join") {
    return (
      <div className="app-shell">
        <div className="panel panel-narrow">
          <div className="panel-head">
            <h2>Join a room</h2>
            <p className="panel-sub">Enter the code your host shared with you.</p>
          </div>

          <div className="field">
            <label htmlFor="join-code">Room code</label>
            <input id="join-code" className="code-input" type="text" placeholder="ABC123" value={gameId} onChange={(e) => setGameId(e.target.value.toUpperCase())} maxLength={6} />
          </div>

          <div className="field">
            <label htmlFor="join-name">Your name</label>
            <input id="join-name" type="text" placeholder="e.g. Jamie" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          {error && <p className="error-banner">{error}</p>}

          <div className="btn-row">
            <button className="btn btn-primary" onClick={joinGame} disabled={!gameId.trim() || !username.trim()}>Join room</button>
            <button className="btn btn-ghost" onClick={() => { setError(""); setScreen("menu"); }}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === "playing") {
    if (!currentSong) {
      return (
        <div className="app-shell">
          <div className="panel panel-wide lobby-panel">
            <div className="lobby-head">
              <p className="panel-sub">Room code</p>
              <div className="game-code">{gameId}</div>
              <p className="panel-sub">Share this code — up to 4 players can join.</p>
            </div>

            <div className="players-panel">
              <div className="selected-head">
                <h3>Players</h3>
                <span className="count-badge">{players.length}/4</span>
              </div>
              <div className="players-list">
                {players.map((player) => (
                  <div key={player.id} className={`player-row ${player.id === socket.id ? "is-you" : ""}`}>
                    <span className="player-dot" />
                    <span>{player.name}</span>
                    {player.id === socket.id && <span className="you-tag">you</span>}
                  </div>
                ))}
              </div>
            </div>

            {error && <p className="error-banner">{error}</p>}

            {isHost ? (
              <div className="lobby-actions">
                <p className="panel-sub">Everyone's in? Kick things off when ready.</p>
                <button className="btn btn-primary" onClick={startGame}>Start game</button>
              </div>
            ) : (
              <p className="waiting-note">Waiting for the host to start the game…</p>
            )}
          </div>
        </div>
      );
    }

    const topBannerText = isMyTurn
      ? phase === "idle"
        ? "Your turn — click the deck to draw a card"
        : phase === "placing"
        ? "Drag the card onto your timeline"
        : phase === "held"
        ? "Use the card's controls when you're ready"
        : ""
      : `${activePlayerName}'s turn`;

    return (
      <div className="game-screen">
        <audio
          ref={audioRef}
          crossOrigin="anonymous"
          onError={(e) => console.error("Audio element error:", e.target.error)}
        />

        <div className="game-topbar">
          <div className={`pill ${isMyTurn ? "pill-active" : ""}`}>{topBannerText}</div>
        </div>

        {error && (
          <div className="game-error">
            <span className="error-banner">{error}</span>
          </div>
        )}

        <div className="game-canvas-wrap">
          <Table3D
            players={players}
            myId={socket.id}
            currentTurnPlayerId={currentTurnPlayerId}
            isMyTurn={isMyTurn}
            activeHoverIndex={activeHoverIndex}
            remoteDragPosition={remoteDrag}
            onDragMove={handleDragMove}
            disabled={hasSubmitted || !!roundResult}
            drawn={drawn}
            phase={phase}
            selfFlightPosition={selfFlight}
            audioLevelRef={audioLevelRef}
            musicPlaying={isPlaying}
            heldControls={{
              loutward: HELD_LOCAL.loutward,
              y: HELD_LOCAL.y,
            }}
            onDrawCard={handleDrawCard}
            showActiveCard={!roundResult}
          />
        </div>

        {!roundResult && isMyTurn && phase === "held" && (
          <div className="now-playing-overlay">
            <div className="now-playing-card">
              <span className="now-playing-label">Mystery track</span>

              <button
                className={`play-vinyl ${isPlaying ? "is-spinning" : ""}`}
                onClick={handlePlayPauseHeld}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                <span className="play-vinyl-icon">{isPlaying ? "⏸" : "▶"}</span>
              </button>
              <div className="volume-row">
                <button className="vol-btn" onClick={() => handleVolumeChangeHeld(-0.1)} aria-label="Lower volume">🔉</button>
                <span className="vol-level">{Math.round(volume * 100)}%</span>
                <button className="vol-btn" onClick={() => handleVolumeChangeHeld(0.1)} aria-label="Raise volume">🔊</button>
              </div>

              <button className="btn btn-primary guess-btn" onClick={handleGuessFromHeld}>Guess</button>
            </div>
          </div>
        )}

        <div className="game-bottom">
          {!roundResult && isMyTurn && phase === "idle" && (
            <div className="pill">🃏 Click the deck to draw a card</div>
          )}

          {!roundResult && isMyTurn && phase === "placing" && !hasSubmitted && (
            <button className="btn btn-primary place-btn" onClick={confirmPlacement} disabled={pendingIndex === null}>
              Place card
            </button>
          )}

          {!roundResult && isMyTurn && hasSubmitted && <span className="submitted-note">Placement submitted...</span>}

          {!roundResult && !isMyTurn && (
            <div className="pill">
              {!drawn ? `Waiting for ${activePlayerName} to draw a card...` : `${activePlayerName} is deciding...`}
            </div>
          )}

          {roundResult && (
            <div className="round-result-card">
              <div className="round-result-track">
                <strong>{roundResult.song.name}</strong> by {roundResult.song.artist} — <strong>{roundResult.actualYear}</strong>
              </div>
              <div className={`round-result-verdict ${roundResult.result.correct ? "correct" : "wrong"}`}>
                {roundResult.result.playerName}: {roundResult.result.correct ? "✅ correct" : "❌ wrong"}
              </div>
              <div className="round-result-next">Next turn starting...</div>
            </div>
          )}
        </div>

        <div className="score-hud">
          {players.map((p) => (
            <div key={p.id} className={`score-row ${p.id === currentTurnPlayerId ? "is-turn" : ""}`}>
              <span>{p.name}</span><span>{p.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (screen === "gameEnd" && gameEndData) {
    const ranked = [...gameEndData.players].sort((a, b) => b.score - a.score);
    const [first, second, third] = gameEndData.winners;
    const medal = ["🥇", "🥈", "🥉"];

    return (
      <div className="app-shell">
        <div className="panel panel-wide gameend-panel">
          <div className="panel-head" style={{ alignItems: "center", textAlign: "center" }}>
            <h2>Game Over</h2>
            <p className="panel-sub">Here's how the room stacked up.</p>
          </div>

          <div className="podium">
            {second && (
              <div className="podium-slot podium-second">
                <span className="podium-medal">🥈</span>
                <span className="podium-name">{second.name}</span>
                <span className="podium-score">{second.score} pts</span>
              </div>
            )}
            {first && (
              <div className="podium-slot podium-first">
                <span className="podium-medal">🥇</span>
                <span className="podium-name">{first.name}</span>
                <span className="podium-score">{first.score} pts</span>
              </div>
            )}
            {third && (
              <div className="podium-slot podium-third">
                <span className="podium-medal">🥉</span>
                <span className="podium-name">{third.name}</span>
                <span className="podium-score">{third.score} pts</span>
              </div>
            )}
          </div>

          <div className="leaderboard-list">
            {ranked.map((player, i) => (
              <div key={player.id} className="leaderboard-row">
                <span className="leaderboard-rank">{medal[i] ?? `#${i + 1}`}</span>
                <span className="leaderboard-name">{player.name}</span>
                <span className="leaderboard-cards">{player.timeline?.length ?? 0} cards</span>
                <span className="leaderboard-score">{player.score} pts</span>
              </div>
            ))}
          </div>

          <button className="btn btn-primary" onClick={returnToMenu}>Back to menu</button>
        </div>
      </div>
    );
  }

  return null;
}