import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { BackgroundCards } from './BackgroundCards'
import { IoArrowBack } from "react-icons/io5"
import { LobbySpotlight } from './LobbySpotlight';
import { Vignette } from './Vignette';
import { Particles } from './Particles';
import { FaCog, FaUsers, FaTimes } from 'react-icons/fa';
import { useMediaQuery } from '../hooks/useMediaQuery';

function SettingsModal({ settings, isOwner, onSettingsChange, onClose }) {
  return (
    <div className="confirmation-overlay">
      <div className="confirmation-box settings-modal">
        <h3>Game Settings</h3>
        <div className="settings-modal-content">
          <div className="settings-group">
            <label htmlFor="pointsToWin">Points to Win</label>
            <input
              type="number"
              name="pointsToWin"
              id="pointsToWin"
              value={settings?.pointsToWin || 5}
              onChange={onSettingsChange}
              disabled={!isOwner}
              min="3"
              max="20"
            />
          </div>
          <div className="settings-group">
            <label htmlFor="maxPlayers">Max Players</label>
            <input
              type="number"
              name="maxPlayers"
              id="maxPlayers"
              value={settings?.maxPlayers || 8}
              onChange={onSettingsChange}
              disabled={!isOwner}
              min="3"
              max="12"
            />
          </div>
          <div className="settings-group">
            <label htmlFor="handSize">Cards in Hand</label>
            <input
              type="number"
              name="handSize"
              id="handSize"
              value={settings?.handSize || 10}
              onChange={onSettingsChange}
              disabled={!isOwner}
              min="5"
              max="15"
            />
          </div>
        </div>
        <div className="confirmation-buttons">
          <button onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function PlayerListModal({ players, isOwner, myId, onKick, onClose }) {
  return (
    <div className="confirmation-overlay">
      <div className="confirmation-box player-list-modal">
        <h3>Players ({players.length})</h3>
        <ul className="kick-player-list">
          {players.map((player, index) => (
            <li key={player.playerId}>
              <span>{player.username}</span>
              {/* Show kick button if you're the owner AND it's not you */}
              {isOwner && index !== 0 && (
                <button className="kick-button-in-modal" onClick={() => onKick(player.playerId)}>
                  <FaTimes />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="confirmation-buttons">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export function Lobby(props) {
  const { roomData, myId, messages } = props;
  const { roomCode, players, settings } = roomData;
  const isOwner = myId === players[0]?.socketId;
  const canStart = players.length >= 3;
  const [chatInput, setChatInput] = useState('');
  const chatContainerRef = useRef(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');


  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }, [messages]);

  const handleStartGame = () => { socket.emit('startGame', { roomCode }); };

  const handleSettingsChange = (e) => {
    socket.emit('changeSettings', {
      roomCode,
      newSettings: { [e.target.name]: parseInt(e.target.value, 10) } // Removed {...settings, ...}
    });
  };

  const handleLeaveLobby = () => {
    socket.emit('leaveLobby', { roomCode });
  };

  const handleSendMessage = (e) => {
    if (e.key === 'Enter' && chatInput.trim() !== '') {
      const me = players.find(p => p.socketId === myId);

      // This check is important!
      if (me) {
        socket.emit('sendMessage', {
          roomCode,
          message: chatInput,
          username: me.username
        });
      }

      setChatInput('');
    }
  };

  const handleKickPlayer = (playerId) => {
    socket.emit('kickPlayer', { roomCode, playerIdToKick: playerId });
  };

  return (
    <div className="lobby-screen">

      <LobbySpotlight />
      <Vignette />
      <Particles />
      {showSettingsModal && (
        <SettingsModal
          settings={settings}
          isOwner={isOwner}
          onSettingsChange={handleSettingsChange}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
      {showPlayerModal && (
        <PlayerListModal
          players={players}
          isOwner={isOwner}
          myId={myId}
          onKick={handleKickPlayer}
          onClose={() => setShowPlayerModal(false)}
        />
      )}

      <button onClick={handleLeaveLobby} className="back-button" title="Back to Home">
        <IoArrowBack />
      </button>
      <BackgroundCards cardCount={30} className="lobby-background" />
      <div className="lobby-grid-container">
        <div className="lobby-container" style={{ position: 'relative', overflow: 'hidden' }}>
          {isMobile && (
            <button className="settings-button" onClick={() => setShowSettingsModal(true)}>
              <FaCog />
            </button>
          )}
          <div className="lobby-details">
            <h1>Lobby</h1>
            <div className="settings-group">
              <label>Room Code</label>
              <p>{roomCode}</p>
            </div>
            {!isMobile && (
              <div className="settings-div">
                <div className="settings-group">
                  <label htmlFor="pointsToWin">Points to Win</label>
                  <input
                    type="number"
                    name="pointsToWin"
                    id="pointsToWin"
                    value={settings?.pointsToWin || 5}
                    onChange={handleSettingsChange}
                    disabled={!isOwner}
                    min="3" max="20"
                  />
                </div>
                <div className="settings-group">
                  <label htmlFor="maxPlayers">Max Players</label>
                  <input
                    type="number"
                    name="maxPlayers"
                    id="maxPlayers"
                    value={settings?.maxPlayers || 8}
                    onChange={handleSettingsChange}
                    disabled={!isOwner}
                    min="3" max="12"
                  />
                </div>
                <div className="settings-group">
                  <label htmlFor="handSize">Cards in Hand</label>
                  <input
                    type="number"
                    name="handSize"
                    id="handSize"
                    value={settings?.handSize || 10}
                    onChange={handleSettingsChange}
                    disabled={!isOwner}
                    min="5" max="15"
                  />
                </div>
              </div>
            )}
            <hr />
            {isOwner && (
              <div className="start-game-section">
                <button onClick={handleStartGame} disabled={!canStart}>Start Game</button>
                {!canStart && <p style={{ marginTop: '10px', opacity: 0.7 }}>Need at least 3 players to start.</p>}
              </div>
            )}

            {isMobile && (
              <button className="player-list-trigger" onClick={() => setShowPlayerModal(true)}>
                <FaUsers /> Players ({players.length})
              </button>
            )}
          </div>
          {/* --- Internal Right Column --- */}
          {!isMobile && (
            <div className="lobby-players">
              <div className="player-list">
                <h4>Players ({players.length})</h4>
                <ul>
                  {players.map((player) => (
                    <li key={player.playerId}>
                      <span className="player-name">{player.username}</span>
                      {isOwner && myId !== player.playerId && (
                        <button className="kick-button" onClick={() => handleKickPlayer(player.playerId)}>Kick</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
        {/* --- Item 2: Right-Side Chat Box --- */}
        <div className="chat-container" style={{ position: 'relative', overflow: 'hidden' }}>
          <h4>Chat</h4>
          <div className="chat-messages" ref={chatContainerRef} style={{ flexGrow: 1, fontStyle: 'italic' }}>
            {messages.map((msg, index) => (
              <div key={index} className={msg.type === 'system' ? 'system-message' : 'player-message'}>
                {msg.type === 'player' && <strong>{msg.sender}: </strong>}
                {msg.message}
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Type a message..."
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleSendMessage}
          />
        </div>
        {/* --- Item 3: Bottom-Left Card Counts --- */}
        <div className="card-count-container">
          <div className="card count-display">
            <span className="count">{roomData.answerCount || 0}</span>
            <span>Answer Cards</span>
          </div>
          <div className="card prompt-card count-display">
            <span className="count">{roomData.promptCount || 0}</span>
            <span>Prompt Cards</span>
          </div>
        </div>
      </div>
    </div>
  );
}