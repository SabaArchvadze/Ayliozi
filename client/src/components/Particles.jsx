const random = (min, max) => Math.random() * (max - min) + min;

// --- VVV NEW HELPER FUNCTION VVV ---
// This function generates random numbers that are biased towards the center (50)
// by averaging two random numbers together.
const randomCentered = () => (random(0, 100) + random(0, 100)) / 2;

export function Particles({ count = 50 }) {
  const particles = Array.from({ length: count }).map((_, i) => {
    const size = random(1, 3);
    const style = {
      // --- VVV CHANGED LINES VVV ---
      // We now use the new function to position the particles
      top: `${randomCentered()}%`,
      left: `${randomCentered()}%`,
      width: `${size}px`,
      height: `${size}px`,
      animationDelay: `${random(0, 10)}s`,
      animationDuration: `${random(10, 30)}s`,
    };
    return <div key={i} className="particle" style={style} />;
  });

  return <div className="particle-container">{particles}</div>;
}