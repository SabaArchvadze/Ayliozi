import { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../socket';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {FaTimes, FaUserSlash } from 'react-icons/fa';
import {IoArrowBack, IoArrowBackCircle, IoArrowForwardCircle } from "react-icons/io5";
import { CountdownTimer } from './CountdownTimer';
import { motion, AnimatePresence } from 'framer-motion';
import { InGameChat } from './InGameChat';
import { GameInfoDisplay } from './GameInfoDisplay';
import { Scoreboard } from './Scoreboard';
import confetti from 'canvas-confetti';
import imageCompression from 'browser-image-compression';

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
      <CountdownTimer duration={3} />
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

export function Game(props) {

 const { roomData, myId, roundWinnerInfo, firstCardPlayed, notification, messages, setError, setShowKickModal } = props;

  const { roomCode, currentCzar, currentPrompt, players, revealedSubmissions, submissions = [], phase, settings } = roomData;

  const isMobile = useMediaQuery('(max-width: 1023px)');


  const me = players.find(p => p.socketId === myId);
  const owner = players ? players[0] : null;
  const isCzar = currentCzar?.socketId === myId;
  const isSpectator = !me?.hand || me.hand.length === 0;
  const isOwner = myId === players[0]?.socketId

  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [hiddenImages, setHiddenImages] = useState([]);
  const [localHand, setLocalHand] = useState([]);
  const [imageCreationsLeft, setImageCreationsLeft] = useState(3);
  const [isValidating, setIsValidating] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [[submissionPage, submissionDirection], setSubmissionPage] = useState([0, 0]);


  const handleDeleteImageCard = useCallback((cardId) => {
    setLocalHand(prevHand => prevHand.filter(card => card.id !== cardId));
    setImageCreationsLeft(prev => prev + 1);
  }, []); // No dependencies needed as it uses functional updates

  const uploadImage = useCallback(async (file) => {
    if (!file) return;

    if (imageCreationsLeft <= 0) {
      setError("No image creations left for this round.");
      return;
    }

    setIsValidating(true);
    setError('');

    console.log(`Original image size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 800,
      useWebWorker: true,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      console.log(`Compressed image size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);

      const formData = new FormData();
      formData.append('image', compressedFile);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/upload-image`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'Upload failed.');

      const newImageCard = { id: `image-${Date.now()}`, type: 'image', content: data.url };
      setLocalHand(prevHand => [newImageCard, ...prevHand]);
      setImageCreationsLeft(prev => prev - 1);

    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setIsValidating(false);
    }
  }, [imageCreationsLeft]);

  const handleGlobalPaste = useCallback((event) => {
    const items = event.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const file = item.getAsFile();
        uploadImage(file);
        event.preventDefault();
        return;
      }
    }
  }, [uploadImage]);

  useEffect(() => {
    const canPlayerPaste = phase === 'submitting' && !isCzar && !isSpectator;

    if (canPlayerPaste) {
      window.addEventListener('paste', handleGlobalPaste);
    }
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [phase, isCzar, isSpectator, handleGlobalPaste]);

  useEffect(() => {
    setLocalHand(me?.hand || []);
    setHasSubmitted(false);
    setSelectedCards([]);
    setImageCreationsLeft(3);
  }, [currentPrompt, me]);

  useEffect(() => {
    // This effect only runs during the reveal phase on mobile
    if (isMobile && (phase === 'revealing' || phase === 'judging')) {
      const submissionsPerPage = 6;
      // Calculate which page the newest revealed card is on
      const newCardIndex = revealedSubmissions.length - 1;
      const targetPage = Math.floor(newCardIndex / submissionsPerPage);

      // If we are not on that page, go to it
      if (targetPage >= 0 && targetPage !== submissionPage) {
        // Determine direction for the animation (always forward for reveals)
        setSubmissionPage([targetPage, 1]);
      }
    }
  }, [revealedSubmissions.length, isMobile, phase]);

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

  const handleLeaveGame = () => {
    setShowLeaveConfirm(false); // Close the modal
    socket.emit('leaveGame', { roomCode });
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
    imageSubmitterProps = null,
    onDeleteImageCard,
    onImageUpload
  }) {
    const [[currentPage, direction], setCurrentPage] = useState([0, 0]);
    const fileInputRef = useRef(null);

    const onFileSelected = (e) => {
      if (e.target.files && e.target.files.length > 0) {
        onImageUpload(e.target.files[0]);
      }
    };

    const imageSubmitterCard = { id: 'image-submitter', type: 'submitter' };
    const displayHand = !isCzar && imageSubmitterProps ? [imageSubmitterCard, ...hand] : hand;

    // All pagination and animation logic remains the same...
    const CARDS_PER_PAGE = isMobile ? 6 : 12;
    const totalPages = Math.ceil(displayHand.length / CARDS_PER_PAGE);
    const paginate = (newDirection) => {
      const newPage = currentPage + newDirection;
      const newCurrentPage = (newPage + totalPages) % totalPages;
      setCurrentPage([newCurrentPage, newDirection]);
    };
    const cardsToRender = isMobile ? displayHand.slice(currentPage * CARDS_PER_PAGE, (currentPage + 1) * CARDS_PER_PAGE) : displayHand;
    const slideVariants = { enter: (direction) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }), center: { zIndex: 1, x: 0, opacity: 1 }, exit: (direction) => ({ zIndex: 0, x: direction < 0 ? '100%' : '-100%', opacity: 0 }) };

    return (
      <>
        <div className="hand-pagination">
          {isMobile && totalPages > 1 && <button onClick={() => paginate(-1)} className="page-arrow left"><IoArrowBackCircle /></button>}
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div key={currentPage} className="card-container" custom={direction} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ x: { type: "spring", stiffness: 300, damping: 20 }, opacity: { duration: 0.1 } }}>
              {cardsToRender.map(card => {
                if (card.type === 'submitter') {
                  return (
                    <div key={card.id} className="card image-submit-card" onClick={() => fileInputRef.current?.click()}>
                      {imageSubmitterProps.isUploading ? <div className="loader">Uploading...</div> : (
                        <>
                          <div className="upload-instructions">Click to select file</div>
                          <input type="file" ref={fileInputRef} onChange={onFileSelected} accept="image/png, image/jpeg, image/gif" style={{ display: 'none' }} disabled={imageSubmitterProps.isUploading || imageSubmitterProps.imageCreationsLeft <= 0} />
                          <span className="image-creations-left">{imageSubmitterProps.imageCreationsLeft} left</span>
                        </>
                      )}
                    </div>
                  );
                }
                if (isCzar) { return <div key={card.id} className="card czar-hand-card">{card.text}</div>; }

                const isSelected = selectedCards.some(sc => sc.id === card.id);
                const isImage = card.type === 'image';
                const cardVariants = { initial: { y: 0, scale: 1, boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.2)" }, hover: { y: -10, scale: 1.05, boxShadow: "0px 6px 12px rgba(0, 0, 0, 0.3)" }, selected: { y: -25, scale: 1.1, boxShadow: "0px 8px 16px rgba(143, 60, 136, 0.4)", border: "3px solid #8963BA", borderRadius: "15px" } };

                return (
                  <motion.div key={card.id} variants={cardVariants} animate={isSelected ? "selected" : "initial"} whileHover="hover" transition={{ type: 'spring', stiffness: 400, damping: 25 }} onClick={() => !hasSubmitted && onSelectCard(card)} style={{ position: 'relative' }}>
                    {isImage && !hasSubmitted && (
                      <button className="delete-image-button" onClick={(e) => { e.stopPropagation(); onDeleteImageCard(card.id); }}>
                        <FaTimes />
                      </button>
                    )}
                    <button className={`card ${isImage ? 'image-card' : ''}`} disabled={hasSubmitted}>
                      {isImage ? <img src={card.content} alt="Custom Card" /> : card.text}
                    </button>
                  </motion.div>
                );
              })}
            </motion.div>
          </AnimatePresence>
          {isMobile && totalPages > 1 && <button onClick={() => paginate(1)} className="page-arrow right"><IoArrowForwardCircle /></button>}
        </div>
        {isMobile && totalPages > 1 && <div className="page-indicator">Page {currentPage + 1} of {totalPages}</div>}
      </>
    );
  }

  const numBlanks = currentPrompt?.blanks || 1;
  const canConfirmSubmission = selectedCards.length === numBlanks;

  //RETURN STATEMENT
  return (
    <div className="game-layout">
      {/* These modals and overlays are common to both layouts */}
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
      {isOwner && (
        <button className="open-kick-modal-button" onClick={() => setShowKickModal(true)} title="Kick Player">
          <FaUserSlash />
        </button>
      )}
      <GameNotification message={notification} />
      <RoundWinner winnerInfo={roundWinnerInfo} prompt={currentPrompt} />

      {/* --- VVV THIS IS THE NEW CONDITIONAL LAYOUT LOGIC VVV --- */}
      {isMobile ? (
        // --- THIS IS THE MOBILE-ONLY LAYOUT (for landscape) ---
        <div className="game-board">
          <div className="mobile-prompt-area">
            {currentPrompt && <div className="card prompt-card"><h3>{currentPrompt.text}</h3></div>}
            <p>უსტაბაში: <strong>{currentCzar?.username || '...'}</strong></p>
          </div>
          <div className="mobile-main-area">
            {(phase === 'revealing' || phase === 'judging') && (() => {
              // --- PAGINATION LOGIC ---
              const submissionsPerPage = 6;
              const totalSubmissionPages = Math.ceil(revealedSubmissions.length / submissionsPerPage);

              const paginateSubmissions = (newDirection) => {
                const newPage = submissionPage + newDirection;
                // This makes the pagination loop around
                const newCurrentPage = (newPage + totalSubmissionPages) % totalSubmissionPages;
                setSubmissionPage([newCurrentPage, newDirection]);
              };

              const paginatedSubmissions = revealedSubmissions.slice(
                submissionPage * submissionsPerPage,
                (submissionPage + 1) * submissionsPerPage
              );

              // --- "FROZEN" SCALING LOGIC ---
              // We tell the CSS to calculate the scale based on a max of 6 cards.
              const displayCountForScaling = Math.min(revealedSubmissions.length, 6);

              // Animation variants for the sliding effect
              const slideVariants = {
                enter: (direction) => ({ x: direction > 0 ? '100%' : '-100%', opacity: 0 }),
                center: { zIndex: 1, x: 0, opacity: 1 },
                exit: (direction) => ({ zIndex: 0, x: direction < 0 ? '100%' : '-100%', opacity: 0 }),
              };

              return (
                <div className="revealed-cards-container">
                  <h4>Submissions:</h4>
                  <div className="submission-pagination">
                    {totalSubmissionPages > 1 && <button onClick={() => paginateSubmissions(-1)} className="page-arrow left"><IoArrowBackCircle /></button>}

                    <AnimatePresence initial={false} custom={submissionDirection} mode="wait">
                      <motion.div
                        key={submissionPage}
                        className="card-container revealed-cards-area"
                        style={{ '--submission-count': displayCountForScaling }} // This freezes the scale
                        custom={submissionDirection}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ x: { type: "spring", stiffness: 300, damping: 25 }, opacity: { duration: 0.2 } }}
                      >
                        {paginatedSubmissions.map((submission) => (
                          <div key={submission.playerId} className={`submission-group ${isCzar ? 'czar-view' : ''}`} onClick={() => isCzar && phase === 'judging' && handleSelectWinner(submission)}>
                            {submission.cards.map((card) => (
                              <div key={card.id} className="card revealed-card">{card.type === 'image' ? <img src={card.content} alt="Submitted Card" /> : card.text}</div>
                            ))}
                          </div>
                        ))}
                      </motion.div>
                    </AnimatePresence>

                    {totalSubmissionPages > 1 && <button onClick={() => paginateSubmissions(1)} className="page-arrow right"><IoArrowForwardCircle /></button>}
                  </div>

                  {/* Show Reveal Next button only if there are more cards on other pages */}
                  {isCzar && phase === 'revealing' && revealedSubmissions.length < submissions.length && (
                    <div className="card-deck" onClick={handleRevealNextCard}>Reveal Next</div>
                  )}
                </div>
              );
            })()}
            {phase === 'submitting' && (
              <div className="player-hand-container">
                <h4>Your Hand:</h4>
                <p className="error-message">{props.error}</p>

                {/* --- THIS IS THE NEW, CORRECTED LOGIC --- */}
                {isCzar ? (
                  // --- CZAR'S HAND (Mobile) ---
                  <PlayerHand
                    hand={me?.hand}
                    isMobile={false} // Use false to show all cards
                    isCzar={true}
                  />
                ) : isSpectator ? (
                  // --- SPECTATOR VIEW (Mobile) ---
                  <p>You are spectating.</p>
                ) : (
                  // --- REGULAR PLAYER'S HAND (Mobile) ---
                  <>
                    <PlayerHand
                      hand={localHand}
                      isMobile={false} // Use false to show all cards
                      isCzar={false}
                      hasSubmitted={hasSubmitted}
                      selectedCards={selectedCards}
                      onSelectCard={handleSelectCard}
                      imageSubmitterProps={{ imageCreationsLeft, isUploading: isValidating }}
                      onDeleteImageCard={handleDeleteImageCard}
                      onImageUpload={uploadImage}
                    />
                    {canConfirmSubmission && !hasSubmitted && (
                      <button className="submit-button" onClick={handleConfirmSubmission}>
                        Confirm Submission
                      </button>
                    )}
                    {hasSubmitted && <p>You submitted your card(s)!</p>}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        // --- THIS IS YOUR ORIGINAL DESKTOP LAYOUT ---
        <>
          <div className="game-board">
            <div className="card-container">
              {currentPrompt && (
                <div className="card prompt-card">
                  <h3>{currentPrompt.text}</h3>
                  {isCzar && phase === 'submitting' && !firstCardPlayed && (
                    <button onClick={handleSkipPrompt} className="skip-button" title="გამოცვალე შავი კარტი">X</button>
                  )}
                </div>
              )}
            </div>
            <p>უსტაბაში: <strong>{currentCzar?.username || '...'}</strong></p>
            <hr />
            {(phase === 'revealing' || phase === 'judging') && (
              <div>
                <h4>Submissions:</h4>
                <div className="card-container revealed-cards-area">
                  {revealedSubmissions.map((submission) => (
                    <div key={submission.playerId} className={`submission-group ${isCzar ? 'czar-view' : ''}`} onClick={() => isCzar && phase === 'judging' && handleSelectWinner(submission)} style={{ position: 'relative' }}>
                      {submission.cards.map((card, index) => {
                        const isImageCard = card.type === 'image';
                        const isHidden = hiddenImages.includes(card.id);
                        if (isImageCard) {
                          return (
                            <div key={card.id || index} style={{ position: 'relative' }}>
                              <div className="card image-card revealed-card">{isHidden ? <p className="image-url-text">{card.content}</p> : <img src={card.content} alt="Submitted Card" />}</div>
                              <button className="toggle-image-button" onClick={(e) => { e.stopPropagation(); toggleImageVisibility(card.id); }}>{isHidden ? 'Show' : 'Hide'}</button>
                            </div>
                          );
                        } else {
                          return <div key={card.id || index} className="card revealed-card">{card.text}</div>;
                        }
                      })}
                    </div>
                  ))}
                  {isCzar && phase === 'revealing' && <div className="card-deck" onClick={handleRevealNextCard}>Reveal Next</div>}
                </div>
              </div>
            )}
            {phase === 'submitting' && (
              <div className="player-hand-container">
                <h4>Your Hand:</h4>
                <p className="error-message">{props.error}</p>
                {isCzar ? (
                  <PlayerHand hand={me?.hand} isMobile={isMobile} isCzar={true} />
                ) : isSpectator ? (
                  <p>You are spectating.</p>
                ) : (
                  <>
                    <PlayerHand hand={localHand} isMobile={isMobile} isCzar={false} hasSubmitted={hasSubmitted} selectedCards={selectedCards} onSelectCard={handleSelectCard} imageSubmitterProps={{ imageCreationsLeft, isUploading: isValidating, }} onDeleteImageCard={handleDeleteImageCard} onImageUpload={uploadImage} setError={setError} />
                    {canConfirmSubmission && !hasSubmitted && (<button className="submit-button" onClick={handleConfirmSubmission}>Confirm Submission</button>)}
                    {hasSubmitted && <p>You submitted your card(s)!</p>}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="game-sidebar">
            <Scoreboard players={players} czarId={currentCzar?.playerId} submissions={submissions} myId={myId} />
            <GameInfoDisplay settings={settings} roomCode={roomCode} owner={owner} />
            <InGameChat roomCode={roomCode} players={players} me={me} messages={messages} />
          </div>
        </>
      )}
    </div>
  );
}