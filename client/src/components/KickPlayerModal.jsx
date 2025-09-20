import { FaTimes } from "react-icons/fa";

export function KickPlayerModal({ players, ownerId, onKick, onClose }) {
  return (
      <div className="confirmation-box kick-modal">
        <h3>Kick a Player</h3>
        <ul className="kick-player-list">
          {players.map(player => (
            player.playerId !== ownerId && (
              <li key={player.playerId}>
                <span>{player.username}</span>
                <button className="kick-button-in-modal" onClick={() => onKick(player.playerId)}>
                  <FaTimes />
                </button>
              </li>
            )
          ))}
        </ul>
        <div className="confirmation-buttons">
          <button onClick={onClose}>X</button>
        </div>
      </div>
  );
}