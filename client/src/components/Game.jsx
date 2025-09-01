import { useState, useEffect, useRef } from 'react';
import { socket } from '../socket';
import { FaCrown, FaCheck, FaTimes, FaTrophy, FaUsers, FaLayerGroup, FaUserSlash } from 'react-icons/fa';
import { IoChatbubblesSharp, IoInformationCircleSharp, IoArrowBack, IoArrowForward, IoArrowBackCircle, IoArrowForwardCircle } from "react-icons/io5";
import { CountdownTimer } from './CountdownTimer';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

function Scoreboard({ players, czarId, submissions = [], isOwner, myId, onKickPlayer, isMobile }) {
  const rankedPlayers = [...players].sort((a, b) => b.score - a.score);

  // On mobile, show Top 2. On desktop, show Top 3.
  const topCount = isMobile ? 2 : 3;
  const topPlayers = rankedPlayers.slice(0, topCount);

  const me = rankedPlayers.find(p => p.socketId === myId);
  const myRank = rankedPlayers.findIndex(p => p.socketId === myId) + 1;
  const amInTop = me && (myRank <= topCount);

  return (
    <div className="scoreboard">
      <h3>Scores</h3>
      <ul>
        {topPlayers.map((p, index) => {
          const isCzar = p.playerId === czarId;
          const hasSubmitted = !isCzar && submissions.some(s => s.playerId === p.playerId);
          return (
            <li key={p.playerId}>
              {/* We move the rank outside the icon div for alignment */}
              <span className="player-rank">{index + 1}.</span>
              <div className="player-status-icons">
                {isCzar && <FaCrown className="czar-icon" title="Card Czar" />}
                {hasSubmitted && <FaCheck className="submitted-icon" title="Submitted" />}
              </div>
              <span className="player-name" title={p.username}>{p.username}</span>
              <span className="player-score">{p.score}</span>
            </li>
          );
        })}
      </ul>

      {isMobile && amInTop && players.length > topCount && (
        <div style={{ textAlign: 'center', color: '#888', letterSpacing: '3px' }}>
          ...
        </div>
      )}
      {!amInTop && me && (
        <>
          <div className="line-separator"></div>
          <ul className="your-score">
            <li>
              <span className="player-rank">{myRank}.</span>
              {/* Empty div for status icon alignment */}
              <div className="player-status-icons"></div>
              <span className="player-name-ingame" title={me.username}>{me.username}</span>
              <span className="player-score">{me.score}</span>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}

function KickPlayerModal({ players, ownerId, onKick, onClose }) {
  return (
    <div className="confirmation-overlay">
      <div className="confirmation-box kick-modal">
        <h3>Kick a Player</h3>
        <ul className="kick-player-list">
          {players.map(player => (
            // Only show players who are NOT the owner
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
          <button onClick={onClose}>Back</button>
        </div>
      </div>
    </div>
  );
}

// The Winner Annoucement Overlay
function RoundWinner({ winnerInfo, prompt }) {
  useEffect(() => {
    if (winnerInfo) {
      // Fire the confetti when the component appears!
      confetti({
        particleCount: 150,
        spread: 180,
        origin: { y: 0.6 }
      });
    }
  }, [winnerInfo]);



  if (!winnerInfo) return null;

  const { winner, winningCards } = winnerInfo;
  return (
    <div className="round-winner-overlay">
      <h2>{winner.username} won the round!</h2>

      {/* We'll add the prompt card for context */}
      <div className="card prompt-card round-winner-prompt">
        {prompt.text}
      </div>

      <h4>with the card(s):</h4>
      <div className="card-container">
        {winningCards.map((card, index) => (
          <div key={card.id || index} className={`card winner-card animated-card ${card.type === 'image' ? 'image-card' : ''}`}>
            {card.type === 'image' ? (
              <img src={card.content} alt="Winning Card" />
            ) : (
              card.text
            )}
          </div>
        ))}
      </div>
      <CountdownTimer duration={5} />
    </div>
  );
}

function GameNotification({ message }) {
  if (!message) return null;

  return (
    <div className="game-notification-overlay">
      <p>{message}</p>
    </div>
  );
}

function InGameChat({ roomCode, players, myId, messages }) {
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    if (e.key === 'Enter' && chatInput.trim() !== '') {
      const me = players.find(p => p.socketId === myId);
      socket.emit('sendMessage', { roomCode, message: chatInput, username: me.username });
      setChatInput('');
    }
  };

  return (
    <div className="in-game-chat">
      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={index} className={msg.type === 'system' ? 'system-message' : 'player-message'}>
            {msg.type === 'player' && <strong>{msg.sender}: </strong>}
            {msg.message}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <input
        type="text"
        placeholder="Type a message..."
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        onKeyDown={handleSendMessage}
      />
    </div>
  );
}

function GameInfoDisplay({ settings, roomCode, owner }) {
  if (!settings || !owner) return null;

  return (
    <div className="game-info-display">
      <h4>ოთახის კოდი</h4>
      <p className="room-code">{roomCode}</p>
      <div className="line-separator"></div>
      <div className="setting-item">
        <span><FaCrown /> Owner</span>
        <span>{owner.username}</span>
      </div>
      <div className="setting-item">
        <span><FaTrophy /> Points to Win</span>
        <span>{settings.pointsToWin}</span>
      </div>
      <div className="setting-item">
        <span><FaUsers /> Max Players</span>
        <span>{settings.maxPlayers}</span>
      </div>
      <div className="setting-item">
        <span><FaLayerGroup /> Hand Size</span>
        <span>{settings.handSize}</span>
      </div>
    </div>
  );
}

export function Game(props) {
  console.log(`--- GAME STATE ---`, { myId: props.myId, roomData: props.roomData });
  const { roomData, myId, roundWinnerInfo, firstCardPlayed, notification, messages, setError } = props;
  const { roomCode, currentCzar, currentPrompt, players, revealedSubmissions, submissions = [], phase, settings } = roomData;

  const isMobile = useMediaQuery('(max-width: 768px)');

  const owner = players ? players[0] : null;
  const me = players.find(p => p.socketId === myId);
  const isCzar = currentCzar?.socketId === myId;
  const isSpectator = !me?.hand || me.hand.length === 0;
  const isOwner = myId === players[0]?.socketId

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [imageUrl, setImageUrl] = useState('');
  const [hiddenImages, setHiddenImages] = useState([]);
  const [localHand, setLocalHand] = useState([]);
  const [imageCreationsLeft, setImageCreationsLeft] = useState(3);
  const [isValidating, setIsValidating] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [activeTab, setActiveTab] = useState('scores');
  const [showKickModal, setShowKickModal] = useState(false);

  useEffect(() => {
    setLocalHand(me?.hand || []);
    setHasSubmitted(false);
    setSelectedCards([]);
    setImageCreationsLeft(3);
  }, [currentPrompt, me]);

  const handleSelectCard = (card) => {
    if (selectedCards.some(sc => sc.id === card.id)) {
      setSelectedCards(selectedCards.filter(sc => sc.id !== card.id));
    } else if (selectedCards.length < (currentPrompt.blanks || 1)) {
      setSelectedCards([...selectedCards, card]);
    }
  };

  const handleConfirmSubmission = () => {
    setHasSubmitted(true);
    socket.emit('submitCards', { roomCode, cards: selectedCards });

    setLocalHand(prevHand => prevHand.filter(card => !selectedCards.some(sc => sc.id === card.id)));
  };

  const handleRevealNextCard = () => { socket.emit('revealNextCard', { roomCode }); };
  const handleSelectWinner = (submission) => {
    // Prevent spamming by checking if a winner has already been announced this round
    if (!roundWinnerInfo) {
      socket.emit('selectWinner', { roomCode, winningSubmission: submission });
    }
  };

  const handleSkipPrompt = () => {
    socket.emit('skipPrompt', { roomCode });
  };

  const handleKickPlayer = (playerId) => {
    socket.emit('kickPlayer', { roomCode, playerIdToKick: playerId });
    setShowKickModal(false);
  };

  const handleLeaveGame = () => {
    setShowLeaveConfirm(false); // Close the modal
    socket.emit('leaveGame', { roomCode });
  };

  const handleImageSubmit = () => {
    if (imageUrl.trim() === '' || imageCreationsLeft <= 0 || isValidating) return;

    setIsValidating(true);
    setError(''); // Clear previous errors

    // Create an image in memory to test the URL
    const img = new Image();
    img.src = imageUrl;

    img.onload = () => {
      // If the image loads successfully...
      const newImageCard = {
        id: `image-${Date.now()}`,
        type: 'image',
        content: imageUrl
      };
      setLocalHand(prevHand => [newImageCard, ...prevHand]);
      setImageUrl('');
      setImageCreationsLeft(prev => prev - 1);
      setIsValidating(false);
    };

    img.onerror = () => {
      // If the image fails to load...
      setError("Invalid or non-working image URL.");
      setIsValidating(false);
    };
  };

  const toggleImageVisibility = (cardId) => {
    if (hiddenImages.includes(cardId)) {
      setHiddenImages(hiddenImages.filter(id => id !== cardId));
    } else {
      setHiddenImages([...hiddenImages, cardId]);
    }
  };

  function PlayerHand({
    hand = [],
    isMobile,
    isCzar = false,
    hasSubmitted = false,
    selectedCards = [],
    onSelectCard = () => { },
    imageSubmitterProps = null
  }) {
    const [[currentPage, direction], setCurrentPage] = useState([0, 0]);

    const imageSubmitterCard = { id: 'image-submitter', type: 'submitter' };
    const displayHand = !isCzar && imageSubmitterProps ? [imageSubmitterCard, ...hand] : hand;

    const CARDS_PER_PAGE = isMobile ? 6 : 12;
    const totalPages = Math.ceil(displayHand.length / CARDS_PER_PAGE);

    // --- CHANGE: The pagination functions now also set a direction for the animation ---
    const paginate = (newDirection) => {
      const newPage = currentPage + newDirection;
      // Loop around if you go past the last or first page
      const newCurrentPage = (newPage + totalPages) % totalPages;
      setCurrentPage([newCurrentPage, newDirection]);
    };

    const cardsToRender = isMobile ? displayHand.slice(
      currentPage * CARDS_PER_PAGE,
      (currentPage + 1) * CARDS_PER_PAGE
    ) : displayHand;

    // --- CHANGE: Animation variants for the sliding effect ---
    const slideVariants = {
      enter: (direction) => ({
        x: direction > 0 ? '100%' : '-100%',
        opacity: 0,
      }),
      center: {
        zIndex: 1,
        x: 0,
        opacity: 1,
      },
      exit: (direction) => ({
        zIndex: 0,
        x: direction < 0 ? '100%' : '-100%',
        opacity: 0,
      }),
    };

    return (
      <>
        <div className="hand-pagination">
          {isMobile && totalPages > 1 && (
            <button onClick={() => paginate(-1)} className="page-arrow left"><IoArrowBackCircle /></button>
          )}

          {/* --- CHANGE: The animation logic is now on a container outside the map --- */}
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentPage} // This tells Framer Motion to animate when the page changes
              className="card-container"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 20 },
                opacity: { duration: 0.1 },
              }}
            >
              {cardsToRender.map(card => {
                // The logic for rendering each card remains the same as before
                if (card.type === 'submitter') {
                  const { imageUrl, setImageUrl, handleImageSubmit, imageCreationsLeft, isValidating } = imageSubmitterProps;
                  return (
                    <div key={card.id} className="card image-submit-card">
                      <input type="text" placeholder="Paste image URL..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={imageCreationsLeft <= 0 || isValidating} onClick={(e) => e.stopPropagation()} />
                      <button className="submit-image-card-button" onClick={handleImageSubmit} disabled={imageCreationsLeft <= 0 || isValidating}>{isValidating ? 'Checking' : 'Add to Hand'}</button>
                      <span className="image-creations-left">{imageCreationsLeft} left</span>
                    </div>
                  );
                }
                if (isCzar) { return <div key={card.id} className="card czar-hand-card">{card.text}</div>; }
                const isSelected = selectedCards.some(sc => sc.id === card.id);
                const isImage = card.type === 'image';
                const cardVariants = {
                  // The state when the card is not selected and not hovered
                  initial: {
                    y: 0,
                    scale: 1,
                    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)"
                  },
                  // The state for hovering over an unselected card
                  hover: {
                    y: -10,
                    scale: 1.05,
                    boxShadow: "0px 6px 12px rgba(0, 0, 0, 0.3)"
                  },
                  // The state for a selected card (this will override the hover state)
                  selected: {
                    y: -25,
                    scale: 1.1,
                    boxShadow: "0px 8px 16px rgba(143, 60, 136, 0.4)",
                    border: "3px solid #8963BA",
                    borderRadius: "15px"
                  }
                };

                // --- VVV This is the new, final version of the card component VVV ---
                return (
                  <motion.div
                    key={card.id}
                    // "variants" tells the component about our animation states
                    variants={cardVariants}
                    // This chooses which variant to display based on the card's state
                    animate={isSelected ? "selected" : "initial"}
                    // This tells it to use the "hover" variant when the mouse is over it
                    whileHover="hover"
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    // The onClick handler is now on the motion.div itself
                    onClick={() => !hasSubmitted && onSelectCard(card)}
                  >
                    {/* The button is now just for display and has no click handler of its own */}
                    <button className={`card ${isImage ? 'image-card' : ''}`} disabled={hasSubmitted}>
                      {isImage ? <img src={card.content} alt="Custom Card" /> : card.text}
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>

          {isMobile && totalPages > 1 && (
            <button onClick={() => paginate(1)} className="page-arrow right"><IoArrowForwardCircle /></button>
          )}
        </div>
        {isMobile && totalPages > 1 && (
          <div className="page-indicator">Page {currentPage + 1} of {totalPages}</div>
        )}
      </>
    );
  }

  const numBlanks = currentPrompt?.blanks || 1;
  const canConfirmSubmission = selectedCards.length === numBlanks;

  //RETURN STATEMENT
  return (
    <div className="game-layout">
      <button className="back-button" onClick={() => setShowLeaveConfirm(true)} title="Leave Game">
        <IoArrowBack />
      </button>

      {showLeaveConfirm && (
        <div className="confirmation-overlay">
          <div className="confirmation-box">
            <h3>Leave Game?</h3>
            <p>Are you sure you want to leave? The current round will be reset for everyone.</p>
            <div className="confirmation-buttons">
              <button onClick={() => setShowLeaveConfirm(false)}>Cancel</button>
              <button className="danger" onClick={handleLeaveGame}>Leave</button>
            </div>
          </div>
        </div>
      )}

      {showKickModal && (
        <KickPlayerModal
          players={players}
          ownerId={owner?.playerId}
          onKick={handleKickPlayer}
          onClose={() => setShowKickModal(false)}
        />
      )}

      {isOwner && (
        <button className="open-kick-modal-button" onClick={() => setShowKickModal(true)} title="Kick Player">
          <FaUserSlash />
        </button>
      )}

      <GameNotification message={notification} />
      <RoundWinner winnerInfo={roundWinnerInfo} prompt={currentPrompt} />

      <div className="game-board">
        <div className="card-container">
          {/* --- THE CHANGE IS INSIDE THIS BLOCK --- */}
          {currentPrompt && (
            <div className="card prompt-card">
              <h3>{currentPrompt.text}</h3>
              {/* This is the new button, visible only to the Czar during the submitting phase */}
              {isCzar && phase === 'submitting' && !firstCardPlayed && (
                <button
                  onClick={handleSkipPrompt}
                  className="skip-button"
                  title="გამოცვალე შავი კარტი"
                >
                  X
                </button>
              )}
            </div>
          )}
          {/* --- END OF CHANGE --- */}
        </div>
        <p>უსტაბაში: <strong>{currentCzar?.username || '...'}</strong></p>
        <hr />

        {(phase === 'revealing' || phase === 'judging') && (
          <div>
            <h4>Submissions:</h4>
            <div className="card-container">
              {revealedSubmissions.map((submission) => {
                // Check if this submission contains an image card
                const containsImage = submission.cards.some(c => c.type === 'image');

                return (
                  <div
                    key={submission.playerId}
                    className={`submission-group ${isCzar ? 'czar-view' : ''}`}
                    onClick={() => isCzar && phase === 'judging' && handleSelectWinner(submission)}
                    style={{ position: 'relative' }} // For the toggle button
                  >
                    {/* --- NEW, CORRECTED RENDER LOGIC --- */}
                    {/* We now map over every card within the submission */}
                    {submission.cards.map((card, index) => {
                      const isImageCard = card.type === 'image';
                      const isHidden = hiddenImages.includes(card.id)

                      if (isImageCard) {
                        return (
                          // The relative positioning is now on the card's container
                          <div key={card.id || index} style={{ position: 'relative' }}>
                            <div className="card image-card revealed-card">
                              {isHidden ? (
                                <p className="image-url-text">{card.content}</p>
                              ) : (
                                <img src={card.content} alt="Submitted Card" />
                              )}
                            </div>
                            {/* The toggle is now attached to each image */}
                            <button
                              className="toggle-image-button"
                              onClick={(e) => { e.stopPropagation(); toggleImageVisibility(card.id); }}
                            >
                              {isHidden ? 'Show' : 'Hide'}
                            </button>
                          </div>
                        )
                      } else {
                        return (
                          <div key={card.id || index} className="card revealed-card">
                            {card.text}
                          </div>
                        )
                      }
                    })}
                  </div>
                );
              })}

              {isCzar && phase === 'revealing' && (
                <div className="card-deck" onClick={handleRevealNextCard}>
                  Reveal Next
                </div>
              )}
            </div>
          </div>
        )}

        {phase === 'submitting' && (
          <div>
            <h4>Your Hand:</h4>
            <p className="error-message">{props.error}</p>

            {isCzar ? (
              // --- CZAR'S HAND ---
              <PlayerHand
                hand={me?.hand}
                isMobile={isMobile}
                isCzar={true}
              />
            ) :
              isSpectator ? (
                <p>You are spectating.</p>
              ) : (
                // --- REGULAR PLAYER'S HAND ---
                <>
                  <PlayerHand
                    hand={localHand}
                    isMobile={isMobile}
                    isCzar={false}
                    hasSubmitted={hasSubmitted}
                    selectedCards={selectedCards}
                    onSelectCard={handleSelectCard}
                    imageSubmitterProps={{
                      imageUrl, setImageUrl, handleImageSubmit, imageCreationsLeft, isValidating
                    }}
                  />
                  {canConfirmSubmission && !hasSubmitted && (<button className="submit-button" onClick={handleConfirmSubmission}>Confirm Submission</button>)}
                  {hasSubmitted && <p>You submitted your card(s)!</p>}
                </>
              )}
          </div>
        )}
      </div>

      <div className="game-sidebar">
        {isMobile ? (
          // --- RENDER THIS FOR MOBILE ---
          <>
            <div className="sidebar-nav">
              {/* We create an array for our tabs to make it easier to manage */}
              {[{ id: 'scores', icon: <FaCrown />, label: 'Scores' },
              { id: 'info', icon: <IoInformationCircleSharp />, label: 'Info' },
              { id: 'chat', icon: <IoChatbubblesSharp />, label: 'Chat' }
              ].map(tab => (
                <motion.button
                  key={tab.id}
                  className={`sidebar-tab ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {/* This is the animated indicator. The "layoutId" is the magic part. */}
                  {activeTab === tab.id && (
                    <motion.div
                      className="active-tab-indicator"
                      layoutId="active-tab-indicator"
                    />
                  )}

                  {tab.icon} {tab.label}
                </motion.button>
              ))}
            </div>
            <div className="sidebar-content">
              <AnimatePresence mode="wait">
                {activeTab === 'scores' && (
                  <motion.div
                    key="scores" // Unique key for AnimatePresence
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Scoreboard players={players} czarId={currentCzar?.playerId} submissions={submissions} myId={myId} isMobile={isMobile} />
                  </motion.div>
                )}
                {activeTab === 'info' && (
                  <motion.div
                    key="info" // Unique key for AnimatePresence
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <GameInfoDisplay settings={settings} roomCode={roomCode} owner={owner} />
                  </motion.div>
                )}
                {activeTab === 'chat' && (
                  <motion.div
                    key="chat" // Unique key for AnimatePresence
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <InGameChat roomCode={roomCode} players={players} myId={myId} messages={messages} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          // --- RENDER THIS FOR DESKTOP ---
          <>
            <Scoreboard players={players} czarId={currentCzar?.playerId} submissions={submissions} isOwner={isOwner} myId={myId} onKickPlayer={handleKickPlayer} isMobile={isMobile} onOpenKickModal={() => setShowKickModal(true)} />
            <GameInfoDisplay settings={settings} roomCode={roomCode} owner={owner} />
            <InGameChat roomCode={roomCode} players={players} myId={myId} messages={messages} />
          </>
        )}
      </div>
    </div>
  );
}