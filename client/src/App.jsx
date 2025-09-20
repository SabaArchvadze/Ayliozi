import { useState, useEffect } from 'react';
import { socket } from './socket';

import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { GameOver } from './components/GameOver';
import { motion, AnimatePresence } from 'framer-motion';
import { IoPhoneLandscapeOutline, IoChatbubblesSharp, IoInformationCircleSharp } from "react-icons/io5";
import { FaTimes, FaTrophy } from 'react-icons/fa'
import { InGameChat } from './components/InGameChat';
import { GameInfoDisplay } from './components/GameInfoDisplay';
import { Scoreboard } from './components/Scoreboard';
import { Spotlight } from './components/Spotlight';
import { KickPlayerModal } from './components/KickPlayerModal';

function RotateDeviceOverlay() {
  return (
    <div className="rotate-device-overlay">
      <IoPhoneLandscapeOutline className="rotate-device-icon" />
      <p>Please rotate your device to play</p>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState('home');
  const [myId, setMyId] = useState('');
  const [me, setMe] = useState(null); // New state to hold my own player data
  const [gameData, setGameData] = useState(null);
  const [roundWinnerInfo, setRoundWinnerInfo] = useState(null);
  const [finalWinner, setFinalWinner] = useState(null);
  const [error, setError] = useState('');
  const [firstCardPlayed, setFirstCardPlayed] = useState(false);
  const [notification, setNotification] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isReconnecting, setIsReconnecting] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isScoreboardOpen, setIsScoreboardOpen] = useState(false);
  const [showKickModal, setShowKickModal] = useState(false);

  const handleOpenOverlay = (overlayName) => {
    setIsChatOpen(overlayName === 'chat');
    setIsInfoOpen(overlayName === 'info');
    setIsScoreboardOpen(overlayName === 'scoreboard');
  };

  const handleKickPlayer = (playerId) => {
    const roomCode = gameData?.roomCode;
    if (roomCode) {
      socket.emit('kickPlayer', { roomCode, playerIdToKick: playerId });
    }
    setShowKickModal(false);
  };

  useEffect(() => {
    const session = JSON.parse(localStorage.getItem('game_session'));
    if (session && session.playerId && session.roomCode) {
      socket.emit('reconnectPlayer', session);
    } else {
      setIsReconnecting(false);
      setView('home')
    }
  }, []);

  useEffect(() => {
    if (view === 'game') {
      document.body.classList.remove('no-scroll');
    } else {
      document.body.classList.add('no-scroll');
    }
  }, [view]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    function onConnected(data) { setMyId(data.id); }
    function onError(message) {
      setError(message)
    }

    // This is the key corrected handler
    function onJoinSuccess(data) {
      setMessages([])
      setGameData(data);
      // It checks the gameState to decide which view to show
      if (data.gameState === 'lobby') {
        setView('lobby');
      } else {
        setView('game');
      }
    }

    function onLobbyUpdate(data) {
      if (data.view !== 'game') {
        setMessages([])
      }
      setGameData(prev => ({ ...prev, ...data }));
      setView('lobby');
    }

    const handleSuccessfulJoin = (data) => {
      setMyId(data.me.socketId);
      setMe(data.me);

      const session = {
        playerId: data.me.playerId,
        roomCode: data.roomCode,
        username: data.me.username
      };
      localStorage.setItem('game_session', JSON.stringify(session));
      setGameData(data);
      if (data.gameState === 'lobby') setView('lobby');
      else setView('game');
    };

    const handleReconnectSuccess = (data) => {
      setIsReconnecting(false);
      handleSuccessfulJoin(data);
    };
    const handleReconnectFailed = () => {
      localStorage.removeItem('game_session');
      setIsReconnecting(false);
    };

    const handleGameOver = (data) => {
      localStorage.removeItem('game_session');
      setFinalWinner(data.winner);
      setView('gameover');
    };
    const handleKicked = () => {
      localStorage.removeItem('game_session');
      alert("You have been kicked from the room.");
      setView('home');
      setGameData(null);
    };

    const handleLeaveSuccess = () => {
      localStorage.removeItem('game_session');
      setView('home');
      setGameData(null);
      setMessages([]);
    };

    const handleRoomTerminated = (data) => {
      alert(data.reason); // Or a nicer notification component
      handleLeaveSuccess(); // Reuse the same cleanup logic
    };

    const handlePlayerLeft = (data) => {
      // Update the player list from the server's data
      setGameData(prev => ({ ...prev, players: data.players }));

      // Add the system message to the chat if it exists
      if (data.message) {
        setMessages(prev => [...prev, { type: 'system', message: data.message }]);
      }
    };

    const onGameUpdate = (data) => {
      setGameData(data);
      setView('game');
    };
    const onPartialGameUpdate = (data) => { setGameData(prev => ({ ...prev, ...data })); };
    const onNewMessage = (newMessage) => { setMessages(prev => [...prev, newMessage]); };
    const onNewRound = (data) => {
      setRoundWinnerInfo(null);
      setGameData(data);
      setFirstCardPlayed(false);
      setView('game');
    };

    function onRoundOver(data) {
      // Set the data for the RoundWinner overlay
      setRoundWinnerInfo(data);

      // CRITICAL FIX: Also update the main gameData state with the new scores
      // so the GameOver screen has the correct information.
      if (data.players) {
        setGameData(prev => ({ ...prev, players: data.players }));
      }
    }


    function onGameOver(data) {
      setFinalWinner(data.winner);
      setView('gameover');
    }

    function onBackToLobby(data) {
      setFinalWinner(null);
      setRoundWinnerInfo(null);
      setMessages([]);
      setGameData(data);
      setView('lobby');
    }

    function onFirstCardPlayed() {
      setFirstCardPlayed(true);
    }

    function onGameTerminated(data) {
      setNotification(data.reason + '. Returning to lobby...');
      setTimeout(() => {
        setNotification(null);
        setGameData(data.room);
        setView('lobby');
      }, 3000);
    }

    socket.on('connected', onConnected);
    socket.on('error', onError);
    socket.on('gameCreated', handleSuccessfulJoin);
    socket.on('joinSuccess', handleSuccessfulJoin); // This now points to the correct handler
    socket.on('playerJoined', onPartialGameUpdate);
    socket.on('gameStarted', onGameUpdate);
    socket.on('newRound', onNewRound);
    socket.on('submissionsComplete', onPartialGameUpdate);
    socket.on('cardRevealed', onPartialGameUpdate);
    socket.on('playerDisconnected', onPartialGameUpdate);
    socket.on('newPromptDealt', onPartialGameUpdate);
    socket.on('roundOver', onRoundOver);
    socket.on('firstCardPlayed', onFirstCardPlayed);
    socket.on('gameOver', onGameOver);
    socket.on('backToLobby', onBackToLobby);
    socket.on('settingsUpdated', onPartialGameUpdate);
    socket.on('gameTerminated', onGameTerminated);
    socket.on('newMessage', onNewMessage);
    socket.on('playerKicked', onPartialGameUpdate);
    socket.on('submissionsUpdated', onPartialGameUpdate);
    socket.on('gameCreated', handleSuccessfulJoin);
    socket.on('joinSuccess', handleSuccessfulJoin);
    socket.on('reconnectSuccess', handleReconnectSuccess);
    socket.on('reconnectFailed', handleReconnectFailed);
    socket.on('gameOver', handleGameOver);
    socket.on('youWereKicked', handleKicked);
    socket.on('playerReconnected', onPartialGameUpdate);
    socket.on('youLeftLobby', handleLeaveSuccess);
    socket.on('roomTerminated', handleRoomTerminated);
    socket.on('playerLeft', handlePlayerLeft);

    return () => {
      socket.off('connected'); socket.off('firstCardPlayed'); socket.off('error'); socket.off('gameCreated'); socket.off('joinSuccess'); socket.off('gameStarted'); socket.off('newRound'); socket.off('playerJoined'); socket.off('submissionsComplete'); socket.off('cardRevealed'); socket.off('playerDisconnected'); socket.off('roundOver'); socket.off('newPromptDealt'); socket.off('gameOver'); socket.off('backToLobby'); socket.off('settingsUpdated'); socket.off('gameTerminated'); socket.off('newMessage'); socket.off('youWereKicked'); socket.off('playerKicked'); socket.off('submissionsUpdated'); socket.off('youLeftLobby'); socket.off('roomTerminated'); socket.off('playerLeft');
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', 'ping');
      }
    }, 25000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (view === 'game') {
      document.body.classList.add('in-game');
    } else {
      document.body.classList.remove('in-game');
    }
    // cleanup just in case:
    return () => document.body.classList.remove('in-game');
  }, [view]);

  if (isReconnecting) {
    return (
      <div className="app-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh'
      }}>
        <div>Reconnecting...</div>
      </div>
    );
  }

  return (
    <>
      <RotateDeviceOverlay />

      {/* This container now ONLY handles switching between the main views */}
      <AnimatePresence mode="wait">
        {view === 'home' && (
          <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
            <Home error={error} setError={setError} />
          </motion.div>
        )}

        {view === 'lobby' && gameData && (
          <motion.div key="lobby" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.5 }}>
            <Lobby roomData={gameData} myId={myId} messages={messages} />
          </motion.div>
        )}

        {view === 'game' && gameData && (
          <motion.div key="game" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.5 }}>
            <Game
              roomData={gameData} myId={myId} roundWinnerInfo={roundWinnerInfo}
              firstCardPlayed={firstCardPlayed} notification={notification}
              messages={messages} error={error} setError={setError}
              setShowKickModal={setShowKickModal}
              setIsChatOpen={setIsChatOpen} setIsInfoOpen={setIsInfoOpen} me={me}
            />
          </motion.div>
        )}

        {view === 'gameover' && (
          <motion.div key="gameover" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.5 }}>
            <GameOver finalWinner={finalWinner} players={gameData.players} roomCode={gameData.roomCode} myId={myId} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- NEW: This is a dedicated container for ALL mobile UI overlays and buttons --- */}
      {/* It sits on top of everything else and is only active during the game view. */}
      {view === 'game' && gameData && (
        <div className="mobile-ui-container">
          <div className="mobile-action-buttons">
            <button onClick={() => handleOpenOverlay('scoreboard')} title="Scores"><FaTrophy /></button>
            <button onClick={() => handleOpenOverlay('chat')} title="Open Chat"><IoChatbubblesSharp /></button>
            <button onClick={() => handleOpenOverlay('info')} title="Game Info"><IoInformationCircleSharp /></button>
          </div>

          <AnimatePresence>
            {isScoreboardOpen && (
              <>
                <motion.div
                  className="overlay-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                <motion.div
                  className="mobile-overlay-container"
                  initial={{ opacity: 0, scale: 0.8 }} // Animate from center
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <Spotlight className="overlay-spotlight" fill="white" />
                  <button onClick={() => handleOpenOverlay(null)}><FaTimes /></button>
                  <Scoreboard players={gameData.players} czarId={gameData.currentCzar?.playerId} submissions={gameData.submissions} myId={myId} />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isChatOpen && (
              <>
                <motion.div
                  className="overlay-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                <motion.div
                  className="mobile-overlay-container"
                  initial={{ opacity: 0, scale: 0.8 }} // Animate from center
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <Spotlight className="overlay-spotlight" fill="white" />
                  <button onClick={() => handleOpenOverlay(null)}><FaTimes /></button>
                  <InGameChat roomCode={gameData.roomCode} players={gameData.players} me={me} messages={messages} />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isInfoOpen && (
              <>
                <motion.div
                  className="overlay-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                <motion.div
                  className="mobile-overlay-container"
                  initial={{ opacity: 0, scale: 0.8 }} // Animate from center
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <Spotlight className="overlay-spotlight" fill="white" />
                  <button onClick={() => handleOpenOverlay(null)}><FaTimes /></button>
                  <GameInfoDisplay settings={gameData.settings} roomCode={gameData.roomCode} owner={gameData.players[0]} />
                </motion.div>
              </>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showKickModal && (
              <>
                <motion.div
                  className="overlay-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
                <motion.div
                  className="mobile-overlay-container" // We reuse this class for consistent styling
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <Spotlight className="overlay-spotlight" fill="white" />
                  {/* We pass the original modal component inside our new styled container */}
                  <KickPlayerModal
                    players={gameData.players}
                    ownerId={gameData.players[0]?.playerId}
                    onKick={handleKickPlayer}
                    onClose={() => setShowKickModal(false)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}