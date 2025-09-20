import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';

export function InGameChat({ roomCode, players, me, messages }) {
  const [chatInput, setChatInput] = useState('');
  const chatContainerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;
    const handleFocus = () => {
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    };
    inputElement.addEventListener('focus', handleFocus);
    return () => {
      inputElement.removeEventListener('focus', handleFocus);
    };
  }, []);

  const handleSendMessage = (e) => {
    if (e.key === 'Enter' && chatInput.trim() !== '') {
      if (me) {
        socket.emit('sendMessage', { roomCode, message: chatInput, username: me.username });
      }
      setChatInput('');
    }
  };

  return (
    <div className="in-game-chat">
      <div className="chat-messages" ref={chatContainerRef}>
        {messages.map((msg, index) => (
          <div key={index} className={msg.type === 'system' ? 'system-message' : 'player-message'}>
            {msg.type === 'player' && <strong>{msg.sender}: </strong>}
            {msg.message}
          </div>
        ))}
      </div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Type a message..."
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        onKeyDown={handleSendMessage}
      />
    </div>
  );
}