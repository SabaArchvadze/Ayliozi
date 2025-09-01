const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
const cors = require('cors');

const prompts = require('./prompts_ge.json');
const answers = require('./answers_ge.json');

const PORT = 3001;
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const RECONNECT_TIMEOUT_MS = 10000;
const gameRooms = {};
const roomTimeouts = {};
const originalSettingsState = {};

// Helper function to shuffle an array
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function terminateGame(roomCode, reason) {
  const room = gameRooms[roomCode];
  if (!room) return;

  console.log(`Game in room ${roomCode} terminated. Reason: ${reason}`);
  // Reset the room state back to a lobby
  room.gameState = 'lobby';
  room.submissions = [];
  room.revealedSubmissions = [];
  room.phase = null;
  room.players.forEach(p => { p.score = 0; p.hand = []; });
  room.currentCzar = room.players[0];

  // Send the specific 'gameTerminated' event
  io.to(roomCode).emit('gameTerminated', {
    room: { ...room, roomCode: roomCode },
    reason: reason
  });
}

function startNewRound(roomCode, systemMessage, shouldRotateCzar = true, isReset = false) {
  const room = gameRooms[roomCode];
  if (!room) return;

  console.log(`Starting new round. Rotate: ${shouldRotateCzar}, Is Reset: ${isReset}`);
  io.to(roomCode).emit('newMessage', { type: 'system', message: systemMessage });

  // --- FIX #1: Only remove submitted cards if it's NOT a reset ---
  if (!isReset) {
    room.submissions.forEach(submission => {
      const player = room.players.find(p => p.playerId === submission.playerId);
      if (player) {
        player.hand = player.hand.filter(handCard =>
          !submission.cards.some(submittedCard => submittedCard.id === handCard.id)
        );
      }
    });
  }

  // Top-up all hands
  room.players.forEach(player => {
    const cardsToDraw = room.settings.handSize - player.hand.length;
    if (cardsToDraw > 0) {
      if (room.answerDeck.length < cardsToDraw) room.answerDeck.push(...shuffle([...answers]));
      const newCards = room.answerDeck.splice(0, cardsToDraw);
      player.hand.push(...newCards);
    }
  });

  // Reset round state
  room.submissions = [];
  room.revealedSubmissions = [];
  room.phase = 'submitting';

  // --- FIX #2: Force a new Czar if the old one is gone ---
  const czarStillExists = room.players.some(p => p.playerId === room.currentCzar.playerId);
  if (shouldRotateCzar || !czarStillExists) {
    const currentCzarIndex = room.players.findIndex(p => p.playerId === room.currentCzar.playerId);
    const nextCzarIndex = (currentCzarIndex >= 0 ? currentCzarIndex + 1 : 0) % room.players.length;
    room.currentCzar = room.players[nextCzarIndex];
    console.log(`New Czar assigned: ${room.currentCzar.username}`);
  }

  // Deal new prompt
  if (room.promptDeck.length === 0) room.promptDeck = shuffle([...prompts]);
  room.currentPrompt = room.promptDeck.pop();

  // Notify clients
  io.to(roomCode).emit('newRound', { ...room, roomCode: roomCode });
}

const createPlayer = (socketId, username) => ({
  socketId: socketId,
  playerId: uuidv4(), // The permanent ID for the session
  username: username,
  score: 0,
  hand: [],
  disconnected: false
});

app.post('/api/report-bug', async (req, res) => {
  const { report } = req.body;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!report || !webhookUrl) {
    return res.status(400).json({ message: 'Report content or webhook is missing.' });
  }

  // The content to send to Discord
  const content = {
    username: 'Game Bug Reporter',
    content: `**A new bug report has been submitted!**\n\n---\n\n${report}`
  };

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    });
    res.status(200).json({ message: 'Report sent successfully!' });
  } catch (error) {
    console.error('Error sending to Discord:', error);
    res.status(500).json({ message: 'Failed to send the report.' });
  }
});

io.on('connection', (socket) => {
  console.log(`User Connected: ${socket.id}`);
  socket.emit('connected', { id: socket.id });

  socket.on('createGame', (data) => {
    const roomCode = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newPlayer = createPlayer(socket.id, data.username);
    gameRooms[roomCode] = {
      players: [newPlayer],
      gameState: 'lobby',
      currentCzar: newPlayer,
      settings: { pointsToWin: 5, maxPlayers: 8, handSize: 10 },

      promptCount: prompts.length,
      answerCount: answers.length
    };
    socket.join(roomCode);
    socket.emit('gameCreated', { ...gameRooms[roomCode], roomCode: roomCode, me: newPlayer });
  });

  socket.on('changeSettings', (data) => {
    const { roomCode, newSettings } = data;
    const room = gameRooms[roomCode];

    if (room && room.players[0].socketId === socket.id) {
      if (!roomTimeouts[roomCode]) {
        originalSettingsState[roomCode] = { ...room.settings };
      }

      room.settings = { ...room.settings, ...newSettings };
      io.to(roomCode).emit('settingsUpdated', { settings: room.settings });

      clearTimeout(roomTimeouts[roomCode]);

      roomTimeouts[roomCode] = setTimeout(() => {
        const originalState = originalSettingsState[roomCode];
        const finalState = room.settings;
        const changes = []; // An array to hold all the summary messages

        const settingNames = {
          pointsToWin: 'Points to Win',
          maxPlayers: 'Max Players',
          handSize: 'Cards in Hand'
        };

        for (const key in finalState) {
          if (originalState[key] !== finalState[key]) {
            const friendlyName = settingNames[key] || key;
            changes.push(`${friendlyName} from ${originalState[key]} to ${finalState[key]}`);
          }
        }

        if (changes.length > 0) {
          const fullMessage = `Owner updated settings: ${changes.join(', ')}.`;
          io.to(roomCode).emit('newMessage', {
            type: 'system',
            message: fullMessage
          });
        }

        delete roomTimeouts[roomCode];
        delete originalSettingsState[roomCode];

      }, 2000); // 2-second delay
    }
  });

  socket.on('joinGame', (data) => {
    const { roomCode, username } = data;
    const room = gameRooms[roomCode];
    if (room) {
      if (room.players.length >= room.settings.maxPlayers) { socket.emit('error', 'Room is full.'); return; }
      const nameExists = room.players.some(p => p.username.toLowerCase() === username.toLowerCase());
      if (nameExists) { socket.emit('error', 'A player with that name is already in the room.'); return; }

      const newPlayer = createPlayer(socket.id, username);
      room.players.push(newPlayer);
      socket.join(roomCode);
      socket.emit('joinSuccess', { ...room, roomCode: roomCode, me: newPlayer, promptCount: prompts.length, answerCount: answers.length });
      io.to(roomCode).emit('newMessage', { type: 'system', message: `${username} has joined.` });
      io.to(roomCode).emit('playerJoined', { players: room.players });
    } else { socket.emit('error', 'Room not found.'); }
  });

  socket.on('reconnectPlayer', (data) => {
    const { roomCode, playerId } = data;
    const room = gameRooms[roomCode];
    if (room) {
      const playerIndex = room.players.findIndex(p => p.playerId === playerId);

      if (playerIndex > -1) {
        const player = room.players[playerIndex];

        // --- NEW TIMEOUT LOGIC ---
        if (player.disconnected && player.disconnectTimestamp) {
          const timeElapsed = Date.now() - player.disconnectTimestamp;

          if (timeElapsed > RECONNECT_TIMEOUT_MS) {
            // Timeout exceeded, so we reject the reconnect and remove the player permanently.
            console.log(`Player ${player.username}'s reconnect attempt timed out.`);
            room.players.splice(playerIndex, 1); // Remove from players array

            socket.emit('reconnectFailed');
            io.to(roomCode).emit('newMessage', { type: 'system', message: `${player.username} left the game.` });
            io.to(roomCode).emit('playerDisconnected', { players: room.players }); // Update list for others
            return; // Stop further execution
          }
        }
        // --- END OF NEW LOGIC ---

        // If the code reaches here, the reconnect is valid.
        const wasDisconnected = player.disconnected;
        player.disconnected = false;
        player.socketId = socket.id;
        delete player.disconnectTimestamp; // Clean up the timestamp

        socket.join(roomCode);
        socket.emit('reconnectSuccess', { ...room, roomCode: roomCode, me: player, promptCount: prompts.length, answerCount: answers.length });

        if (wasDisconnected) {
          io.to(roomCode).emit('newMessage', { type: 'system', message: `${player.username} has reconnected.` });
        }
        io.to(roomCode).emit('playerReconnected', { players: room.players });

      } else {
        socket.emit('reconnectFailed');
      }
    } else {
      socket.emit('reconnectFailed');
    }
  });

  socket.on('kickPlayer', (data) => {
    const { roomCode, playerIdToKick } = data;
    const room = gameRooms[roomCode];
    if (room && room.players[0].socketId === socket.id && playerIdToKick !== room.players[0].playerId) {
      const playerIndex = room.players.findIndex(p => p.playerId === playerIdToKick);

      if (playerIndex > -1) {
        const wasCzar = room.players[playerIndex].playerId === room.currentCzar.playerId;
        const kickedPlayer = room.players.splice(playerIndex, 1)[0];

        const kickedSocket = io.sockets.sockets.get(kickedPlayer.socketId);
        if (kickedSocket) {
          kickedSocket.emit('youWereKicked');
          kickedSocket.leave(roomCode);
        }
        io.to(roomCode).emit('newMessage', { type: 'system', message: `${room.players[0].username} kicked ${kickedPlayer.username}.` });

        if (room.gameState === 'in-game' && room.players.length < 3) {
          terminateGame(roomCode, 'Not enough players to continue.');
        }
        else if (room.gameState === 'in-game' && wasCzar) {
          // --- THIS IS THE NEW LOGIC ---
          // The Czar was kicked. Manually assign the next player in line.
          // The new Czar is the player who took the kicked Czar's spot in the array.
          const newCzarIndex = playerIndex % room.players.length;
          room.currentCzar = room.players[newCzarIndex];
          // Now call startNewRound, telling it NOT to rotate since we just set the new Czar.
          startNewRound(roomCode, "The Czar was kicked! Resetting the round...", false, true);
        }
        else if (room.gameState === 'in-game') {
          startNewRound(roomCode, "A player was kicked. Resetting the round...", false, true);
        }
        else { // This handles kicks from the lobby
          io.to(roomCode).emit('playerKicked', { players: room.players });
        }
      }
    }
  });

  socket.on('startGame', (data) => {
    const { roomCode } = data;
    const room = gameRooms[roomCode];
    if (room && room.players[0].socketId === socket.id) {
      room.gameState = 'in-game';
      room.submissions = [];
      room.revealedSubmissions = [];
      room.phase = 'submitting';
      room.currentCzar = room.players[0];
      room.answerDeck = shuffle([...answers]);
      room.promptDeck = shuffle([...prompts]);
      room.currentPrompt = room.promptDeck.pop();
      room.players.forEach(player => {
        player.hand = room.answerDeck.splice(0, room.settings.handSize);
      });
      io.to(roomCode).emit('gameStarted', { ...room, roomCode: roomCode });
    }
  });

  socket.on('skipPrompt', (data) => {
    const { roomCode } = data;
    const room = gameRooms[roomCode];

    // Security check: Only the current Czar can skip, and only during submission phase
    if (room && room.currentCzar.socketId === socket.id && room.phase === 'submitting') {
      console.log(`Czar in room ${roomCode} skipped the prompt.`);

      // Draw a new prompt card
      if (room.promptDeck.length === 0) {
        room.promptDeck = shuffle([...prompts]); // Reshuffle if deck is empty
      }
      room.currentPrompt = room.promptDeck.pop();

      // Broadcast the new prompt to everyone in the room
      io.to(roomCode).emit('newPromptDealt', { currentPrompt: room.currentPrompt });
    }
  });

  socket.on('submitCards', (data) => {
    const { roomCode, cards } = data;
    const room = gameRooms[roomCode];
    if (room && room.phase === 'submitting') {
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return; // Player not found

      // Check if this player has already submitted using their permanent ID
      if (room.submissions.some(s => s.playerId === player.playerId)) return;

      // Push the submission with the permanent playerId
      room.submissions.push({ playerId: player.playerId, cards: cards });

      // The player object is already found, so we can use it directly
      io.to(roomCode).emit('newMessage', {
        type: 'system',
        message: `${player.username} has submitted their card(s).`
      });
      if (player) {
        io.to(roomCode).emit('newMessage', {
          type: 'system',
          message: `${player.username} has submitted their card(s).`
        });
      }

      io.to(roomCode).emit('submissionsUpdated', { submissions: room.submissions });

      if (room.submissions.length === 1) {
        io.to(roomCode).emit('firstCardPlayed');
      }

      const requiredSubmissions = room.players.filter(p => p.playerId !== room.currentCzar.playerId && p.hand?.length > 0).length;
      if (room.submissions.length >= requiredSubmissions) {
        room.submissions = shuffle(room.submissions);
        room.phase = 'revealing';
        io.to(roomCode).emit('submissionsComplete', { phase: room.phase });
      }
    }
  });

  socket.on('revealNextCard', (data) => {
    const { roomCode } = data;
    const room = gameRooms[roomCode];
    if (room && room.currentCzar.socketId === socket.id && room.phase === 'revealing') {
      const nextCard = room.submissions[room.revealedSubmissions.length];
      if (nextCard) {
        room.revealedSubmissions.push(nextCard);
        if (room.revealedSubmissions.length === room.submissions.length) {
          room.phase = 'judging';
        }
        io.to(roomCode).emit('cardRevealed', { revealedSubmissions: room.revealedSubmissions, phase: room.phase });
      }
    }
  });

  socket.on('selectWinner', (data) => {
    const { roomCode, winningSubmission } = data;
    const room = gameRooms[roomCode];

    // Permission check
    if (!room || room.currentCzar.socketId !== socket.id || room.phase !== 'judging') {
      return;
    }

    const winner = room.players.find(p => p.playerId === winningSubmission.playerId);

    if (winner) {
      // 1. Increment the score immediately. The 'players' array is now up-to-date.
      winner.score += 1;
      io.to(roomCode).emit('newMessage', {
        type: 'system',
        message: `${room.currentCzar.username} chose ${winner.username}'s card!`
      });
    }

    // 2. Check if this score increment ends the game.
    const isGameEnding = winner && winner.score >= room.settings.pointsToWin;

    // 3. Emit ONE consolidated 'roundOver' event with all the correct, fresh data.
    io.to(roomCode).emit('roundOver', {
      winner,
      winningCards: winningSubmission.cards,
      players: room.players, // Always sends the updated scores
      isGameOver: isGameEnding
    });

    // 4. Handle what happens next based on whether the game is over.
    if (isGameEnding) {
      // ----- GAME IS OVER -----
      console.log(`${winner.username} wins the game in room ${roomCode}!`);

      // After 5s (for the RoundWinner overlay), tell clients to show the GameOver screen.
      setTimeout(() => {
        io.to(roomCode).emit('gameOver', { winner });
      }, 5000);

      // After 15s total, send everyone back to the lobby.
      setTimeout(() => {
        const roomToReset = gameRooms[roomCode];
        if (roomToReset) {
          console.log(`Auto-resetting room ${roomCode} back to lobby.`);
          roomToReset.gameState = 'lobby';
          roomToReset.players.forEach(p => { p.score = 0; p.hand = []; });
          roomToReset.currentCzar = roomToReset.players[0];
          io.to(roomCode).emit('backToLobby', { ...roomToReset, roomCode: roomCode });
        }
      }, 15000);

    } else {
      // ----- GAME IS NOT OVER -----
      // After 5s, start the next round normally.
      setTimeout(() => {
        startNewRound(roomCode, "Starting the next round...", true, false);
      }, 5000);
    }
  });

  socket.on('disconnect', () => {
    console.log(`User Disconnected: ${socket.id}`);
    for (const roomCode in gameRooms) {
      const room = gameRooms[roomCode];
      const player = room.players.find(p => p.socketId === socket.id);
      if (player) {
        player.disconnected = true;
        player.disconnectTimestamp = Date.now();
        console.log(`Player ${player.username} marked as disconnected.`);
        io.to(roomCode).emit('newMessage', { type: 'system', message: `${player.username} has disconnected.` });

        // The termination logic is now handled at the end of the round, which is more stable
        io.to(roomCode).emit('playerDisconnected', { players: room.players });
        break;
      }
    }
  });

  socket.on('leaveLobby', (data) => {
    const { roomCode } = data;
    const room = gameRooms[roomCode];
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex === -1) return;

    const wasOwner = playerIndex === 0;
    const leavingPlayer = room.players.splice(playerIndex, 1)[0];

    // Let the leaving player go home
    socket.leave(roomCode);
    socket.emit('youLeftLobby');

    // If the room is now empty, delete it
    if (room.players.length === 0) {
      console.log(`Lobby ${roomCode} is now empty. Deleting room.`);
      delete gameRooms[roomCode];
      return;
    }

    // If the owner left, the next person in the array is the new owner.
    // We'll build a message to inform the remaining players.
    let message = `${leavingPlayer.username} has left the lobby.`;
    if (wasOwner) {
      const newOwner = room.players[0]; // The new owner is now at the start of the array
      message += ` ${newOwner.username} is the new owner.`;
      console.log(`Owner left lobby ${roomCode}. New owner: ${newOwner.username}`);
    }

    // Send the updated player list and the message to everyone still in the room.
    io.to(roomCode).emit('playerLeft', {
      players: room.players,
      message: message
    });
  });

  socket.on('leaveGame', (data) => {
    const { roomCode } = data;
    const room = gameRooms[roomCode];
    if (!room || room.gameState !== 'in-game') return;

    const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIndex > -1) {
      const wasCzar = room.players[playerIndex].playerId === room.currentCzar.playerId;
      room.players.splice(playerIndex, 1);

      socket.leave(roomCode);
      socket.emit('youLeftLobby');

      if (room.players.length < 3) {
        terminateGame(roomCode, 'Not enough players to continue.');
      }
      else if (wasCzar) {
        // --- THIS IS THE NEW LOGIC ---
        // The Czar left. Manually assign the next player in line.
        const newCzarIndex = playerIndex % room.players.length;
        room.currentCzar = room.players[newCzarIndex];
        startNewRound(roomCode, "The Czar left the game. Resetting the round...", false, true);
      }
      else {
        // A regular player left.
        startNewRound(roomCode, "A player left the game. Resetting the round...", false, true);
      }
    }
  });

  socket.on('sendMessage', (data) => {
    const { roomCode, message, username } = data;
    const room = gameRooms[roomCode];

    // Make sure the room exists and the sender is in it
    if (room && room.players.some(p => p.socketId === socket.id)) {
      // Broadcast the new message to everyone in the room
      io.to(roomCode).emit('newMessage', {
        type: 'player',
        sender: username,
        message: message,
      });
    }
  });
});

server.listen(PORT, () => { console.log(`✅ Server is running on port ${PORT}`); });