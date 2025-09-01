import { useState, useEffect } from 'react';
import { socket } from './socket';

import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
import { Game } from './components/Game';
import { GameOver } from './components/GameOver';
import { motion, AnimatePresence } from 'framer-motion';

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

    const onGameUpdate = (data) => { setGameData(data); setView('game'); };
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
    <AnimatePresence mode="wait">
      {/* The "key" is crucial for AnimatePresence to track which component is on screen */}
      
      {view === 'home' && (
        <motion.div
          key="home"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Home error={error} setError={setError} />
        </motion.div>
      )}

      {view === 'lobby' && gameData && (
        <motion.div
          key="lobby"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.5 }}
        >
          <Lobby roomData={gameData} myId={myId} messages={messages} />
        </motion.div>
      )}

      {/* --- ADDED ANIMATIONS FOR GAME AND GAMEOVER --- */}
      {view === 'game' && gameData && (
        <motion.div
          key="game"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
        >
          <Game roomData={gameData} myId={myId} roundWinnerInfo={roundWinnerInfo} firstCardPlayed={firstCardPlayed} notification={notification} messages={messages} error={error} setError={setError} />
        </motion.div>
      )}

      {view === 'gameover' && (
        <motion.div
          key="gameover"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.5 }}
        >
          <GameOver
            finalWinner={finalWinner}
            players={gameData.players}
            roomCode={gameData.roomCode}
            myId={myId}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}