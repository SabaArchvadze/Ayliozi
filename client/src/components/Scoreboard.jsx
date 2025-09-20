import { FaCrown, FaCheck } from 'react-icons/fa';

export function Scoreboard({ players, czarId, submissions = [], myId }) {
  // 1. We always start by sorting all players by score.
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);

  // 2. Determine the CSS class based on player count for dynamic sizing.
  let scoreboardClass = '';
  if (players.length >= 7) {
    scoreboardClass = 'scoreboard-large';
  } else if (players.length > 4) {
    scoreboardClass = 'scoreboard-medium';
  }

  // 3. For large games, we need to split the players into two columns.
  const isLargeGame = players.length >= 7;
  const halfwayPoint = Math.ceil(rankedPlayers.length / 2);
  const leftColumnPlayers = isLargeGame ? rankedPlayers.slice(0, halfwayPoint) : [];
  const rightColumnPlayers = isLargeGame ? rankedPlayers.slice(halfwayPoint) : [];

  // This is a reusable function to render a single player row.
  const renderPlayerRow = (player, index, rankOffset = 0) => {
    const isCzar = player.playerId === czarId;
    const hasSubmitted = !isCzar && submissions.some(s => s.playerId === player.playerId);
    return (
      <li key={player.playerId} className={player.socketId === myId ? 'is-me' : ''}>
        <span className="player-rank">{rankOffset + index + 1}.</span>
        <div className="player-status-icons">
          {isCzar && <FaCrown className="czar-icon" title="Card Czar" />}
          {hasSubmitted && <FaCheck className="submitted-icon" title="Submitted" />}
        </div>
        <span className="player-name" title={player.username}>{player.username}</span>
        <span className="player-score">{player.score}</span>
      </li>
    );
  };

  return (
    <div className={`scoreboard ${scoreboardClass}`}>
      <h3>Scores</h3>
      {isLargeGame ? (
        // 4. If it's a large game, render the two-column grid.
        <div className="scoreboard-grid">
          <ul className="scoreboard-column">
            {leftColumnPlayers.map((p, index) => renderPlayerRow(p, index))}
          </ul>
          <ul className="scoreboard-column">
            {rightColumnPlayers.map((p, index) => renderPlayerRow(p, index, halfwayPoint))}
          </ul>
        </div>
      ) : (
        // 5. Otherwise, render the standard single-column list.
        <ul>
          {rankedPlayers.map((p, index) => renderPlayerRow(p, index))}
        </ul>
      )}
    </div>
  );
}