const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const prompts = require('./prompts_ge.json');
const answers = require('./answers_ge.json');

const PORT = 3001;
const app = express();
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const RECONNECT_TIMEOUT_MS = 10000;
const gameRooms = {};


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

function startNewRound(roomCode, systemMessage) {
  const room = gameRooms[roomCode];
  if (!room) return;

  console.log(`Starting new round for room ${roomCode}. Reason: ${systemMessage}`);
  
  // Announce why the round is starting/resetting
  io.to(roomCode).emit('newMessage', { type: 'system', message: systemMessage });

  // Reset submissions from the previous round
  room.submissions = [];
  room.revealedSubmissions = [];
  room.phase = 'submitting';

  // First, deal a full hand to any spectators who are joining the game
  room.players.forEach(player => {
    if (player.hand.length === 0) {
      if (room.answerDeck.length < room.settings.handSize) {
        room.answerDeck.push(...shuffle([...answers]));
      }
      player.hand = room.answerDeck.splice(0, room.settings.handSize);
      io.to(roomCode).emit('newMessage', { type: 'system', message: `${player.username} has joined the game for this round!` });
    }
  });

  // Rotate the Czar to the next player
  const currentCzarIndex = room.players.findIndex(p => p.playerId === room.currentCzar.playerId);
  const nextCzarIndex = (currentCzarIndex + 1) % room.players.length;
  room.currentCzar = room.players[nextCzarIndex];
  
  // Deal a new prompt card
  if (room.promptDeck.length === 0) room.promptDeck = shuffle([...prompts]);
  room.currentPrompt = room.promptDeck.pop();

  // Finally, emit the 'newRound' event. The client already knows how to handle this.
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

    if (room && room.currentCzar.socketId === socket.id) {
      const { pointsToWin, maxPlayers, handSize } = newSettings;
      if (
        (pointsToWin && (pointsToWin < 3 || pointsToWin > 20)) ||
        (maxPlayers && (maxPlayers < 3 || maxPlayers > 12)) ||
        (handSize && (handSize < 5 || handSize > 15)) ||
        (maxPlayers && maxPlayers < room.players.length)
      ) {
        console.log(`[SERVER] Rejected invalid settings for room ${roomCode}`);
        return;
      }

      if (room.settingsChangeTimeout) {
        clearTimeout(room.settingsChangeTimeout)
      }

      room.settingsChangeTimeout = setTimeout(() => {
        let changeMessage = 'Owner has updated the game settings.';
        const oldSettings = room.settings;

        const settingNames = {
          pointsToWin: 'Points to Win',
          maxPlayers: 'Max Players',
          handSize: 'Cards in Hand'
        };

        for (const key in newSettings) {
          if (newSettings[key] !== oldSettings[key]) {
            const friendlyName = settingNames[key] || key;
            changeMessage = `Owner changed ${friendlyName} to ${newSettings[key]}.`;
            break;
          }
        }

        io.to(roomCode).emit('newMessage', {
          type: 'system',
          message: changeMessage
        });

        room.settings = newSettings;
        io.to(roomCode).emit('settingsUpdated', { settings: room.settings });

      }, 2000);

      room.settings = newSettings;
      io.to(roomCode).emit('settingsUpdated', { settings: room.settings });
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
  // Only the owner (player 0) can kick
  if (room && room.players[0].socketId === socket.id && playerIdToKick !== room.players[0].playerId) {
    const playerIndex = room.players.findIndex(p => p.playerId === playerIdToKick);
    
    if (playerIndex > -1) {
      const kickedPlayer = room.players.splice(playerIndex, 1)[0];
      const wasCzar = kickedPlayer.playerId === room.currentCzar.playerId;

      // Tell the kicked player they were kicked
      const kickedSocket = io.sockets.sockets.get(kickedPlayer.socketId);
      if (kickedSocket) {
        kickedSocket.emit('youWereKicked');
        kickedSocket.leave(roomCode);
      }

      io.to(roomCode).emit('newMessage', { type: 'system', message: `${room.players[0].username} kicked ${kickedPlayer.username}.` });

      // If the player count drops below 3, terminate the game.
      if (room.gameState === 'in-game' && room.players.length < 3) {
        terminateGame(roomCode, 'Not enough players to continue.');
      } 
      // If the Czar was kicked, we must reset the round.
      else if (room.gameState === 'in-game' && wasCzar) {
        startNewRound(roomCode, "The Czar was kicked! Resetting the round...");
      }
      // If a regular player was kicked, we can just update the player list.
      else {
        io.to(roomCode).emit('playerKicked', { players: room.players, submissions: room.submissions });
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
    if (room && room.currentCzar.socketId === socket.id) {
      const winner = room.players.find(p => p.playerId === winningSubmission.playerId);

      if (winner) {
        winner.score += 1;
        io.to(roomCode).emit('newMessage', {
          type: 'system',
          message: `${room.currentCzar.username} chose ${winner.username}'s card!`
        });
      }

      const winningCardText = winningSubmission.cards[0].type === 'image'
        ? winningSubmission.cards[0].content
        : winningSubmission.cards.map(c => c.text).join(' | ');

      io.to(roomCode).emit('roundOver', {
        winner,
        winningCards: winningSubmission.cards,
        winningCardText: winningCardText // We now send a clean text version
      });

      const WINNING_SCORE = room.settings.pointsToWin;
      if (winner && winner.score >= WINNING_SCORE) {
        console.log(`${winner.username} wins the game!`);
        io.to(roomCode).emit('gameOver', { winner });
        setTimeout(() => {
          const roomToReset = gameRooms[roomCode];
          if (roomToReset) {
            console.log(`Resetting room ${roomCode} back to lobby.`);
            roomToReset.gameState = 'lobby';
            roomToReset.submissions = [];
            roomToReset.revealedSubmissions = [];
            roomToReset.answerDeck = [];
            roomToReset.promptDeck = [];
            roomToReset.currentPrompt = null;
            roomToReset.phase = null;
            roomToReset.players.forEach(p => { p.score = 0; p.hand = []; });
            roomToReset.currentCzar = roomToReset.players[0];
            io.to(roomCode).emit('backToLobby', { ...roomToReset, roomCode: roomCode });
          }
        }, 5000);
        return;
      }

      setTimeout(() => {
        room.players.forEach(player => {
          if (player.hand.length === 0) {
            // If the deck is low, reshuffle it before dealing
            if (room.answerDeck.length < room.settings.handSize) {
              room.answerDeck.push(...shuffle([...answers]));
            }

            // Deal a full hand to the new player
            player.hand = room.answerDeck.splice(0, room.settings.handSize);
            console.log(`Dealt a new hand to former spectator: ${player.username}`);

            // Announce in chat that they've joined the game
            io.to(roomCode).emit('newMessage', {
              type: 'system',
              message: `${player.username} has joined the game for the next round!`
            });
          }
        });

        room.submissions.forEach(submission => {
          const player = room.players.find(p => p.playerId === submission.playerId);
          if (player) {
            player.hand = player.hand.filter(handCard => !submission.cards.some(submittedCard => submittedCard.id === handCard.id));
          }
        });
        room.players.forEach(player => {
          if (player.playerId !== room.currentCzar.playerId) {
            const cardsToDraw = room.settings.handSize - player.hand.length;
            if (room.answerDeck.length < cardsToDraw) room.answerDeck = shuffle([...answers]);
            if (room.answerDeck.length > 0) {
              const newCards = room.answerDeck.splice(0, cardsToDraw);
              player.hand.push(...newCards);
            }
          }
        });
        room.submissions = [];
        room.revealedSubmissions = [];
        room.phase = 'submitting';
        const currentCzarIndex = room.players.findIndex(p => p.playerId === room.currentCzar.playerId);
        room.currentCzar = room.players[(currentCzarIndex + 1) % room.players.length];
        if (room.promptDeck.length === 0) room.promptDeck = shuffle([...prompts]);
        room.currentPrompt = room.promptDeck.pop();
        io.to(roomCode).emit('newRound', { ...room, roomCode: roomCode });
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
  if (playerIndex === -1) return;

  room.players.splice(playerIndex, 1)[0];
  socket.leave(roomCode);
  socket.emit('youLeftLobby');

  // Check player count first
  if (room.players.length < 3) {
    terminateGame(roomCode, 'Not enough players to continue.');
  } else {
    // If enough players remain, just start a new round.
    startNewRound(roomCode, "A player left the game. Resetting the round...");
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