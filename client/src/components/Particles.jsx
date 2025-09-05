import React, { useMemo } from 'react';

const random = (min, max) => Math.random() * (max - min) + min;
const randomCentered = () => (random(0, 100) + random(0, 100)) / 2;

export function Particles({ count = 50 }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const size = random(1, 3);
      const style = {
        top: `${randomCentered()}%`,
        left: `${randomCentered()}%`,
        width: `${size}px`,
        height: `${size}px`,
        animationDelay: `${random(0, 10)}s`,
        animationDuration: `${random(10, 30)}s`,
      };
      return <div key={i} className="particle" style={style} />;
    });
  }, [count]);

  return <div className="particle-container">{particles}</div>;
}