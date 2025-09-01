import { useState, useEffect } from 'react';
import prompts from '../../../server/prompts_ge.json';
import answers from '../../../server/answers_ge.json';
import { motion } from 'framer-motion';

const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function BackgroundCards({ cardCount = 8, className = '', variants }) {
  const [backgroundCards, setBackgroundCards] = useState([]);

  const cardVariants = {
    hidden: (isLeft) => ({
      x: isLeft ? '-100vw' : '100vw', // Come in from left or right
      opacity: 0,
    }),
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 50,
        damping: 15,
      },
    },
  };

  useEffect(() => {
    const cards = [];
    const finalCardCount = cardCount || 10;

    // A more detailed 3x3 grid of zones that overlap and cover the screen
    const zones = [
      { topMin: -5, topMax: 35, leftMin: -5, leftMax: 35 },  // Top-Left
      { topMin: -5, topMax: 35, leftMin: 30, leftMax: 70 },  // Top-Center
      { topMin: -5, topMax: 35, leftMin: 65, leftMax: 105 }, // Top-Right
      { topMin: 30, topMax: 70, leftMin: -5, leftMax: 35 },  // Mid-Left
      { topMin: 30, topMax: 70, leftMin: 65, leftMax: 105 }, // Mid-Right
      { topMin: 65, topMax: 105, leftMin: -5, leftMax: 35 },  // Bottom-Left
      { topMin: 65, topMax: 105, leftMin: 30, leftMax: 70 },  // Bottom-Center
      { topMin: 65, topMax: 105, leftMin: 65, leftMax: 105 }, // Bottom-Right
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
    <motion.div
      className={`background-cards-container ${className}`}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      {backgroundCards.map(card => {
        // Determine if the card is on the left or right side of the screen
        const isLeft = parseFloat(card.style.left) < 50;

        return (
          // --- VVV 5. Make each card a motion component VVV ---
          <motion.div
            key={card.id}
            className={`background-card visible`} // "visible" class is still needed for initial styles
            style={card.style}
            variants={cardVariants}
            custom={isLeft} // Pass the "isLeft" boolean to the variants
          >
            <div className={`card ${card.isPrompt ? 'prompt-card' : ''}`}>
              {card.text}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}