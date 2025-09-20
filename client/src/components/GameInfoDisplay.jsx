import { FaCrown, FaTrophy, FaUsers, FaLayerGroup } from 'react-icons/fa';

export function GameInfoDisplay({ settings, roomCode, owner }) {
  if (!settings || !owner) return null;

  return (
    <div className="game-info-display">
      <h4>ოთახის კოდი</h4>
      <p className="room-code">{roomCode}</p>
      <div className="line-separator"></div>
      <div className="setting-item">
        <span><FaCrown /> Owner</span>
        <span>{owner.username}</span>
      </div>
      <div className="setting-item">
        <span><FaTrophy /> Points to Win</span>
        <span>{settings.pointsToWin}</span>
      </div>
      <div className="setting-item">
        <span><FaUsers /> Max Players</span>
        <span>{settings.maxPlayers}</span>
      </div>
      <div className="setting-item">
        <span><FaLayerGroup /> Hand Size</span>
        <span>{settings.handSize}</span>
      </div>
    </div>
  );
}