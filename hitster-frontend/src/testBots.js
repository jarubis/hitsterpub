import { io } from "socket.io-client";

const SERVER_URL = "http://localhost:3000";
const BOT_NAMES = ["Bot Ada", "Bot Grace", "Bot Alan"];

function createBotSocket() {
  return io(SERVER_URL);
}

function wireBotAutoplay(botSocket, gameId) {
  botSocket.on("new_song", ({ currentTurnPlayerId }) => {
    if (currentTurnPlayerId !== botSocket.id) return;

    const thinkDelay = 900 + Math.random() * 1400;

    setTimeout(() => {
      botSocket.emit("card_drawn", { gameId });

      const guessIndex = Math.floor(Math.random() * 4);

      botSocket.emit("card_drag", { gameId, lx: -1.4, loutward: 1.1, y: 0.4, index: guessIndex });

      setTimeout(() => {
        botSocket.emit("card_drag", { gameId, lx: 0, loutward: 0, y: 0.16, index: guessIndex });
        botSocket.emit("submit_placement", { gameId, index: guessIndex }, () => {});
      }, 550);
    }, thinkDelay);
  });
}

export function startTestGame(mainSocket, songs, onReady, onError) {
  mainSocket.emit("create_game", ({ success, gameId, message }) => {
    if (!success) return onError?.(message || "Could not create test game");

    mainSocket.emit("set_host_name", { gameId, username: "You" }, () => {
      mainSocket.emit(
        "set_songs",
        { gameId, songs },
        ({ success: songsOk, message: songsMsg }) => {
          if (!songsOk) return onError?.(songsMsg || "Could not set songs");

          const bots = BOT_NAMES.map(() => createBotSocket());
          let joined = 0;

          bots.forEach((botSocket, i) => {
            botSocket.on("connect", () => {
              botSocket.emit(
                "join_game",
                { gameId, username: BOT_NAMES[i] },
                ({ success: joinOk, message: joinMsg }) => {
                  if (!joinOk) {
                    onError?.(joinMsg || `${BOT_NAMES[i]} could not join`);
                    return;
                  }

                  wireBotAutoplay(botSocket, gameId);
                  joined += 1;

                  if (joined === bots.length) {
                    mainSocket.emit(
                      "start_game",
                      { gameId },
                      ({ success: startOk, message: startMsg }) => {
                        if (!startOk) return onError?.(startMsg || "Could not start test game");
                        onReady?.(gameId, bots);
                      }
                    );
                  }
                }
              );
            });
          });
        }
      );
    });
  });
}