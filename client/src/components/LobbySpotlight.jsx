import React from "react";
import { motion } from "framer-motion"; // Use framer-motion

// Translated from TypeScript to JavaScript with default props
export function LobbySpotlight({
  gradientFirst = "radial-gradient(68.54% 68.72% at 55.02% 31.46%, hsla(240, 52%, 95%, 0.10) 0, hsla(240, 50%, 75%, .02) 50%, hsla(240, 50%, 65%, 0) 80%)",
  gradientSecond = "radial-gradient(50% 50% at 50% 50%, hsla(240, 52%, 95%, 0.18) 0, hsla(240, 50%, 75%, .02) 80%, transparent 100%)",
  gradientThird = "radial-gradient(50% 50% at 50% 50%, hsla(240, 52%, 95%, 0.23) 0, hsla(240, 50%, 65%, .02) 80%, transparent 100%)",
  translateY = -350,
  width = 860,
  height = 1480,
  smallWidth = 440,
  duration = 7,
  xOffset = 100,
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5 }}
      className="lobby-spotlight-wrapper"
    >
      {/* Left Spotlight */}
      <motion.div
        animate={{ x: [0, xOffset, 0] }}
        transition={{ duration, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        className="lobby-spotlight-beam-container left"
      >
        <div style={{ transform: `translateY(${translateY}px) rotate(-45deg)`, background: gradientFirst, width: `${width}px`, height: `${height}px` }} className="spotlight-gradient first" />
        <div style={{ transform: "rotate(-45deg) translate(5%, -50%)", background: gradientSecond, width: `${smallWidth}px`, height: `${height}px` }} className="spotlight-gradient second" />
        <div style={{ transform: "rotate(-45deg) translate(-180%, -70%)", background: gradientThird, width: `${smallWidth}px`, height: `${height}px` }} className="spotlight-gradient third" />
      </motion.div>

      {/* Right Spotlight */}
      <motion.div
        animate={{ x: [0, -xOffset, 0] }}
        transition={{ duration, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        className="lobby-spotlight-beam-container right"
      >
        <div style={{ transform: `translateY(${translateY}px) rotate(45deg)`, background: gradientFirst, width: `${width}px`, height: `${height}px` }} className="spotlight-gradient first" />
        <div style={{ transform: "rotate(45deg) translate(-5%, -50%)", background: gradientSecond, width: `${smallWidth}px`, height: `${height}px` }} className="spotlight-gradient second" />
        <div style={{ transform: "rotate(45deg) translate(180%, -70%)", background: gradientThird, width: `${smallWidth}px`, height: `${height}px` }} className="spotlight-gradient third" />
      </motion.div>
    </motion.div>
  );
};