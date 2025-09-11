import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { FaTrophy } from 'react-icons/fa';
import { CountdownTimer } from './CountdownTimer';

export function GameOver({ finalWinner, players, myId }) {
  useEffect(() => {
    confetti({ particleCount: 250, spread: 360, startVelocity: 30, ticks: 100 });
  }, []);

  // Sort players by score for the final ranking
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);
  const topThree = rankedPlayers.slice(0, 3);

  // Find the current player's data and rank
  const me = rankedPlayers.find(p => p.playerId === myId);
  const myRank = rankedPlayers.findIndex(p => p.playerId === myId) + 1;

  // Check if the current player is already in the top 3
  const amInTopThree = myRank > 0 && myRank <= 3;

  return (
    <div className="game-over-overlay">
      <div className="final-winner-info">
        <FaTrophy className="trophy-icon" />
        <h2>{finalWinner.username} is the winner!</h2>
      </div>

      <h3>Final Scores:</h3>
      <ul className="final-scores">
        {topThree.map((p, index) => (
          <li key={p.playerId} className={p.playerId === finalWinner.playerId ? 'is-winner' : ''}>
            <span className="player-rank">{index + 1}. {p.username}</span>
            <span className="player-score">{p.score}</span>
          </li>
        ))}
      </ul>

      {/* If you are not in the top 3, show your score separately */}
      {!amInTopThree && me && (
        <>
          <div className="score-separator">...</div>
          <ul className="final-scores your-score">
            <li>
              <span className="player-rank">{myRank}. {me.username}</span>
              <span className="player-score">{me.score}</span>
            </li>
          </ul>
        </>
      )}

      <p className="returning-text">Returning to lobby...</p>
      <CountdownTimer duration={7} />
    </div>
  );
}