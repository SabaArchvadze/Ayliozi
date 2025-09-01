import { useState, useEffect } from 'react';

const STROKE_WIDTH = 15;
const RADIUS = 55;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function CountdownTimer({ duration, onComplete }) {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (timeLeft <= 0) {
      if (onComplete) onComplete();
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);

    // Cleanup function to clear the interval when the component unmounts
    return () => clearInterval(interval);
  }, [timeLeft, onComplete]);

  const progress = timeLeft / duration;
  const strokeDashoffset = CIRCUMFERENCE * (1 + progress);

  return (
    <div className="countdown-timer">
      <svg width="100" height="100" viewBox="0 0 140 140">
        {/* Background Circle */}
        <circle
          cx="70" cy="70" r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          className="timer-background"
        />
        {/* Foreground Progress Circle */}
        <circle
          cx="70" cy="70" r={RADIUS}
          fill="none"
          strokeWidth={STROKE_WIDTH}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 70 70)"
          className="timer-progress"
        />
      </svg>
      <span className="timer-text">{timeLeft}</span>
    </div>
  );
}