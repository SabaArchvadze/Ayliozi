import { useState, useEffect } from 'react';
import prompts from '../../../server/prompts_ge.json';
import answers from '../../../server/answers_ge.json';

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function BackgroundCards({ cardCount = 8, className = '' }) {
  const [backgroundCards, setBackgroundCards] = useState([]);

   useEffect(() => {
    const cards = [];
    const finalCardCount = cardCount || 10;

    // A more detailed 3x3 grid of zones that overlap and cover the screen
    const zones = [
      { topMin: -5,  topMax: 35, leftMin: -5,  leftMax: 35 },  // Top-Left
      { topMin: -5,  topMax: 35, leftMin: 30,  leftMax: 70 },  // Top-Center
      { topMin: -5,  topMax: 35, leftMin: 65,  leftMax: 105 }, // Top-Right
      { topMin: 30,  topMax: 70, leftMin: -5,  leftMax: 35 },  // Mid-Left
      { topMin: 30,  topMax: 70, leftMin: 65,  leftMax: 105 }, // Mid-Right
      { topMin: 65,  topMax: 105, leftMin: -5,  leftMax: 35 },  // Bottom-Left
      { topMin: 65,  topMax: 105, leftMin: 30,  leftMax: 70 },  // Bottom-Center
      { topMin: 65,  topMax: 105, leftMin: 65,  leftMax: 105 }, // Bottom-Right
    ];

    for (let i = 0; i < finalCardCount; i++) {
      const isPrompt = Math.random() > 0.75;
      const cardData = isPrompt ? getRandom(prompts) : getRandom(answers);
      
      // Cycle through the zones to ensure even distribution
      const zone = zones[i % zones.length];
      
      const top = zone.topMin + (Math.random() * (zone.topMax - zone.topMin));
      const left = zone.leftMin + (Math.random() * (zone.leftMax - zone.leftMin));

      cards.push({
        id: i,
        text: cardData.text,
        isPrompt: isPrompt,
        visible: false,
        style: {
          top: `${top}%`,
          left: `${left}%`,
          transform: `rotate(${Math.random() * 50 - 25}deg) scale(${0.9 + Math.random() * 0.2})`,
        }
      });
    }
    setBackgroundCards(cards);

    setTimeout(() => {
      setBackgroundCards(currentCards => currentCards.map(c => ({
        ...c,
        visible: true
      })));
    }, 100);
  }, [cardCount]);

  return (
    <div className={`background-cards-container ${className}`}>
      {backgroundCards.map(card => (
        <div key={card.id} className={`background-card ${card.visible ? 'visible' : ''}`} style={card.style}>
          <div className={`card ${card.isPrompt ? 'prompt-card' : ''}`}>
            {card.text}
          </div>
        </div>
      ))}
    </div>
  );
}