import { useState, useEffect } from 'react';
import { 
  socket, 
  connectSocket,  // Add this import
  storePlayerData, 
  clearPlayerData 
} from '../socket';
// Custom mobile-friendly styles for Player screens

function Player() {
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError] = useState('');
  const [joined, setJoined] = useState(false);
  const [joinStatus, setJoinStatus] = useState('');
  const [gameState, setGameState] = useState('waiting');
  const [currentRound, setCurrentRound] = useState(0);
  const [players, setPlayers] = useState([]);
  const [question, setQuestion] = useState('');
  const [selectedTarget, setSelectedTarget] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [displayedQuestions, setDisplayedQuestions] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]); // Store original questions array for numbering
  const [hasVoted, setHasVoted] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [targetPlayer, setTargetPlayer] = useState(null);
  const [showGuessPrompt, setShowGuessPrompt] = useState(false);
  const [showPlayerSelection, setShowPlayerSelection] = useState(false);
  const [guessedPlayer, setGuessedPlayer] = useState('');
  const [totalVotes, setTotalVotes] = useState(0);
  const [expectedVotes, setExpectedVotes] = useState(0);
  const [isOwnQuestion, setIsOwnQuestion] = useState(false);
  const [showTransitionScreen, setShowTransitionScreen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [hasStoredData, setHasStoredData] = useState(false);
  const [storedRoom, setStoredRoom] = useState('');
  const [storedName, setStoredName] = useState('');

  useEffect(() => {
    console.log("[Player] Component mounted");

    socket.on('join_error', (errorMessage) => {
      console.error('[Player] Join error:', errorMessage);
      setError(errorMessage);
      setJoined(false);
      setJoinStatus('Failed to join: ' + errorMessage);
    });

    socket.on('join_success', () => {
      console.log('[Player] Successfully joined room:', roomCode);
      setError('');
      setJoined(true);
      setJoinStatus('You\'re in! Waiting for game to start');
    });

    socket.on('player_joined', ({ players }) => {
      console.log('[Player] Current players in room:', players);
      setPlayers(players);
    });

    socket.on('game_started', ({ round }) => {
      console.log('[Player] Game started, round:', round);
      setGameState('playing');
      setCurrentRound(round);
      setHasSubmitted(false);
    });

    socket.on('voting_phase', ({ questions }) => {
      setGameState('voting');
      console.log('=== Voting Phase Debug ===');
      console.log('All questions received:', questions);
      console.log('Current socket ID:', socket.id);
      
      // Store original questions array for correct numbering
      setAllQuestions(questions);
      
      // Filter out the player's own question
      const filteredQuestions = questions.filter(question => {
        console.log('Processing question:', {
          questionId: question.id,
          questionAuthorId: question.authorId,
          currentSocketId: socket.id,
          isOwnQuestion: question.authorId === socket.id
        });
        return question.authorId !== socket.id;
      });
      
      console.log('Filtered questions:', filteredQuestions);
      console.log('========================');
      setDisplayedQuestions(filteredQuestions);
      setHasVoted(false);
    });

    socket.on('guessing_phase', ({ question, targetPlayer, authorId }) => {
      // Add detailed debugging
      console.log('=== Target Player Debug ===');
      console.log('targetPlayer:', targetPlayer);
      console.log('targetPlayer type:', typeof targetPlayer);
      console.log('targetPlayer properties:', Object.keys(targetPlayer));
      console.log('socket.id:', socket.id);
      console.log('========================');

      setGameState('guessing');
      setSelectedQuestion(question);
      setTargetPlayer(targetPlayer);
      // Use optional chaining to prevent errors
      setIsAnswering(socket.id === targetPlayer?.id);
      setShowGuessPrompt(false);
      setShowPlayerSelection(false);
      setGuessedPlayer('');
      setIsOwnQuestion(authorId === socket.id);

      // Add debug for isAnswering calculation
      console.log('=== isAnswering Calculation ===');
      console.log('socket.id:', socket.id);
      console.log('targetPlayer?.id:', targetPlayer?.id);
      console.log('isAnswering value:', socket.id === targetPlayer?.id);
      console.log('========================');

      // If this player is answering
      if (targetPlayer.id === socket.id) {
        setTimeout(() => {
          if (!isOwnQuestion) {
            // If it's their own question, show the "You wrote this!" message after 10s
            setShowGuessPrompt(true);
          } else {
            // If it's someone else's question, show the guess prompt after 30s
            setTimeout(() => {
              setShowGuessPrompt(true);
            }, 10000);
          }
        }, 10000);
      }
    });

    socket.on('vote_received', ({ votesCount }) => {
      setTotalVotes(votesCount);
    });

    socket.on('new_round', ({ round, targetPlayer }) => {
      console.log('=== Player New Round Debug ===', {
        round,
        targetPlayer,
        hasSubmitted,
        question,
        selectedTarget,
        gameState
      });

      setCurrentRound(round);
      setTargetPlayer(targetPlayer);
      setHasSubmitted(false);
      setQuestion('');
      setSelectedTarget('');
      setError(null);
      setGameState('playing');  // Make sure we set the game state back to 'playing'
      setShowTransitionScreen(false);  // Reset transition screen
      setShowPlayerSelection(false);   // Reset player selection
      setShowGuessPrompt(false);      // Reset guess prompt
      setGuessedPlayer('');           // Reset guessed player

      // Log state after clearing
      console.log('Player State After Clear:', {
        round,
        hasSubmitted: false,
        question: 'empty',
        selectedTarget: 'empty',
        gameState: 'playing'
      });
    });

    socket.on('player_choice', ({ choice }) => {
      // If this is not the answering player, show transition screen
      if (!isAnswering) {
        setShowTransitionScreen(true);
      }
    });

    socket.on('reconnect_success', (gameState) => {
      console.log('[Player] Reconnected successfully', gameState);
      setJoined(true);
      setGameState(gameState.gameState);
      setCurrentRound(gameState.currentRound);
      setPlayers(gameState.players);
      // ... update other relevant state ...
      setIsReconnecting(false);
    });

    socket.on('reconnect_failed', (error) => {
      console.log('[Player] Reconnection failed:', error);
      clearPlayerData();
      setError(error);
      setIsReconnecting(false);
    });

    socket.on('player_disconnected', ({ playerName, players }) => {
      setPlayers(players);
      // Show toast or notification that a player disconnected
    });

    socket.on('player_reconnected', ({ playerName, players }) => {
      setPlayers(players);
      // Show toast or notification that a player reconnected
    });

    socket.on('rejoin_game_in_progress', (gameData) => {
      console.log('[Player] Rejoining game in progress:', gameData);
      setGameState(gameData.gameState);
      setCurrentRound(gameData.currentRound);
      setPlayers(gameData.players);
      setTargetPlayer(gameData.targetPlayer);
      setSelectedQuestion(gameData.selectedQuestion);
      setDisplayedQuestions(gameData.displayedQuestions || []);
      
      // Set appropriate phase-specific states
      if (gameData.currentPhase === 'question') {
        setHasSubmitted(false);
      } else if (gameData.currentPhase === 'voting') {
        setHasVoted(false);
      }
    });

    socket.on('reconnect_failed', (error) => {
      console.log('[Player] Reconnection failed:', error);
      clearPlayerData();
      setIsReconnecting(false);
      setJoined(false); // Reset joined state
      setError('Failed to reconnect. Please join again.');
    });

    socket.on('join_error', (error) => {
      console.log('[Player] Join error:', error);
      clearPlayerData();
      setIsReconnecting(false);
      setJoined(false);
      setError(error);
    });

    return () => {
      console.log("[Player] Component unmounting");
      socket.off('join_error');
      socket.off('join_success');
      socket.off('player_joined');
      socket.off('game_started');
      socket.off('voting_phase');
      socket.off('guessing_phase');
      socket.off('vote_received');
      socket.off('new_round');
      socket.off('player_choice');
      socket.off('reconnect_success');
      socket.off('player_disconnected');
      socket.off('player_reconnected');
      socket.off('rejoin_game_in_progress');
      socket.off('reconnect_failed');
      socket.off('join_error');
    };
  }, [roomCode, isAnswering]);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (playerName.length > 15) {
      setError('Name must be 15 characters or less');
      return;
    }

    try {
      await connectSocket();
      storePlayerData(playerName.trim(), roomCode.toUpperCase());
      socket.emit('join_room', { 
        roomCode: roomCode.toUpperCase(), 
        playerName: playerName.trim() 
      });
    } catch (error) {
      setError('Failed to connect to server');
    }
  };

  const handleSubmitQuestion = (e) => {
    e.preventDefault();
    if (!question.trim() || !selectedTarget) {
      setError('Please fill in both the question and select a target player');
      return;
    }
    if (question.length > 120) {
      setError('Question must be 120 characters or less');
      return;
    }

    socket.emit('submit_question', {
      roomCode,
      question: question.trim(),
      targetPlayer: selectedTarget,
      authorId: socket.id
    });
    setHasSubmitted(true);
  };

  const renderQuestionSubmission = () => {
    if (gameState !== 'playing' || hasSubmitted) return null;

    // Remove the filter so players can select themselves
    const availablePlayers = players;

    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          padding: '16px',
          paddingTop: '10vh',
          boxSizing: 'border-box',
          alignItems: 'flex-start'
        }}
      >
        <div 
          className="flex flex-col"
          style={{
            width: '85%',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
          }}
        >
          {/* Header Container */}
          <div className="flex flex-col items-center" style={{ marginBottom: '16px' }}>
            <h2 
              className="text-white font-bold"
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '32px',
                textAlign: 'center',
                color: '#FFFFFF',
                margin: 0,
                padding: 0
              }}
            >
              Round {currentRound}
            </h2>
            <p 
              className="text-white"
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '24px',
                textAlign: 'center',
                color: '#FFFFFF',
                marginTop: '4px',
                marginBottom: 0,
                padding: 0
              }}
            >
              Ask your question
            </p>
          </div>

          {/* Form Container */}
          <form onSubmit={handleSubmitQuestion} className="flex flex-col">
            {/* Question Input */}
            <div className="flex flex-col" style={{ width: '100%', marginBottom: '24px' }}>
              <label
                className="font-bold mb-2"
                style={{ 
                  fontFamily: 'MADE Gentle, sans-serif', 
                  fontSize: '32px',
                  textAlign: 'left',
                  color: '#FFFFFF'
                }}
              >
                Question
              </label>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder=""
                maxLength={120}
                className="bg-white text-[#B96759] focus:outline-none focus:ring-2 focus:ring-white transition-all resize-none"
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  padding: '10px 10px',
                  borderRadius: '12px',
                  fontFamily: 'MADE Gentle, sans-serif',
                  fontSize: '18px',
                  border: 'none',
                  boxShadow: 'none',
                  WebkitAppearance: 'none',
                  MozAppearance: 'none',
                  appearance: 'none',
                  boxSizing: 'border-box',
                  minHeight: '60px',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}
              />
              <span className="block text-right text-xs mt-1" style={{ color: '#FFFFFF', fontFamily: 'MADE Gentle, sans-serif' }}>{question.length}/120</span>
            </div>

            {/* Responder Dropdown */}
            <div className="flex flex-col" style={{ width: '100%', marginBottom: '6px' }}>
              <label
                className="font-bold mb-2"
                style={{ 
                  fontFamily: 'MADE Gentle, sans-serif', 
                  fontSize: '32px',
                  textAlign: 'left',
                  color: '#FFFFFF'
                }}
              >
                Responder
              </label>
              <div style={{ position: 'relative', width: '100%' }}>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="bg-white text-[#B96759] focus:outline-none focus:ring-2 focus:ring-white transition-all"
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    padding: '10px 10px',
                    paddingRight: '40px',
                    borderRadius: '12px',
                    fontFamily: 'MADE Gentle, sans-serif',
                    fontSize: '18px',
                    border: 'none',
                    boxShadow: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    appearance: 'none',
                    boxSizing: 'border-box',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23B96759' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    backgroundSize: '12px'
                  }}
                >
                  <option value="">Select a player...</option>
                  {availablePlayers.map(player => (
                    <option key={player.id} value={player.id}>{player.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-white text-center text-sm rounded-full px-4 py-2 mb-4" style={{ color: '#FFFFFF' }}>
                {error}
              </p>
            )}

            {/* Submit Button */}
            <div className="flex justify-center" style={{ marginTop: '28px' }}>
              <button
                type="submit"
                className="bg-white rounded-full text-[#B96759] font-bold hover:bg-opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-white"
                style={{
                  width: '50%',
                  minWidth: '80px',
                  paddingTop: '12px',
                  paddingBottom: '10px',
                  paddingLeft: '5px',
                  paddingRight: '5px',
                  fontFamily: 'Heyam, sans-serif',
                  fontSize: '24px',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const renderWaitingForOthers = () => {
    if (!hasSubmitted || gameState !== 'playing') return null;

    // Animated ellipses component
    const AnimatedEllipses = () => {
      const [dots, setDots] = useState('.');

      useEffect(() => {
        const interval = setInterval(() => {
          setDots(prev => {
            if (prev === '.') return '..';
            if (prev === '..') return '...';
            return '.';
          });
        }, 500);
        return () => clearInterval(interval);
      }, []);

      return <span>{dots}</span>;
    };

    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          padding: '16px',
          paddingTop: '10vh',
          boxSizing: 'border-box',
          alignItems: 'flex-start'
        }}
      >
        <div 
          className="flex flex-col items-center"
          style={{
            width: '85%',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
          }}
        >
          <h2 
            className="font-bold"
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '32px',
              textAlign: 'center',
              color: '#FFFFFF',
              margin: 0,
              padding: 0
            }}
          >
            Round {currentRound}
          </h2>
          <p 
            className="mt-4"
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '18px',
              textAlign: 'center',
              color: '#FFFFFF',
              marginTop: '16px',
              marginBottom: 0,
              padding: 0
            }}
          >
            Question submitted!
          </p>
          <p 
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '18px',
              textAlign: 'center',
              color: '#FFFFFF',
              marginTop: '8px',
              marginBottom: 0,
              padding: 0
            }}
          >
            Waiting for others to submit<AnimatedEllipses />
          </p>
        </div>
      </div>
    );
  };

  const handleVote = (questionId) => {
    socket.emit('submit_vote', { roomCode, questionId });
    setHasVoted(true);
  };

  const renderVoting = () => {
    if (gameState !== 'voting') return null;

    const formatQuestion = (text) => {
      const trimmedText = text.trim();
      return trimmedText.endsWith('?') ? trimmedText : `${trimmedText}?`;
    };

    // Animated ellipses component
    const AnimatedEllipses = () => {
      const [dots, setDots] = useState('.');

      useEffect(() => {
        const interval = setInterval(() => {
          setDots(prev => {
            if (prev === '.') return '..';
            if (prev === '..') return '...';
            return '.';
          });
        }, 500);
        return () => clearInterval(interval);
      }, []);

      return <span>{dots}</span>;
    };

    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          padding: '16px',
          paddingTop: '10vh',
          boxSizing: 'border-box',
          alignItems: 'flex-start'
        }}
      >
        <div 
          className="flex flex-col"
          style={{
            width: '85%',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
          }}
        >
          {/* Header Container */}
          <div className="flex flex-col items-center" style={{ marginBottom: '16px' }}>
            <h2 
              className="text-white font-bold"
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '32px',
                textAlign: 'center',
                color: '#FFFFFF',
                margin: 0,
                padding: 0
              }}
            >
              Round {currentRound}
            </h2>
            <p 
              className="text-white"
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '24px',
                textAlign: 'center',
                color: '#FFFFFF',
                marginTop: '4px',
                marginBottom: 0,
                padding: 0
              }}
            >
              {hasVoted ? 'Vote submitted!' : 'Vote best question'}
            </p>
            {hasVoted && (
              <p 
                className="text-white"
                style={{ 
                  fontFamily: 'MADE Gentle, sans-serif', 
                  fontSize: '18px',
                  textAlign: 'center',
                  color: '#FFFFFF',
                  marginTop: '8px',
                  marginBottom: 0,
                  padding: 0
                }}
              >
                Waiting for others to vote<AnimatedEllipses />
              </p>
            )}
          </div>

          {!hasVoted && (
            <div className="bg-white rounded-xl p-6 mt-2">
              {displayedQuestions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {displayedQuestions.map((question) => {
                    // Find the question's original index in the full questions array
                    const originalIndex = allQuestions.findIndex(q => q.id === question.id);
                    const questionNumber = originalIndex !== -1 ? originalIndex + 1 : 0;
                    
                    return (
                      <button
                        key={question.id}
                        onClick={() => handleVote(question.id)}
                        className="w-full text-white font-bold text-left transition-all cursor-pointer"
                        style={{
                          border: 'none',
                          outline: 'none',
                          backgroundColor: '#B96759',
                          borderRadius: '12px',
                          padding: '8px 20px',
                          fontFamily: 'MADE Gentle, sans-serif',
                          fontSize: '32px',
                          color: '#FFFFFF',
                          boxShadow: 'none',
                          transform: 'scale(1)',
                          transition: 'all 0.2s ease'
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.outline = 'none';
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.outline = 'none';
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.outline = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.outline = 'none';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#98483A';
                          e.currentTarget.style.transform = 'scale(1.02)';
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.outline = 'none';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#B96759';
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.border = 'none';
                          e.currentTarget.style.outline = 'none';
                        }}
                      >
                        Question {questionNumber}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[#B96759]">No questions available to vote on</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleGuessChoice = (wantsToGuess) => {
    // First emit the choice to everyone - this will trigger transition screen for others
    socket.emit('player_choice', { 
      roomCode, 
      choice: wantsToGuess ? 'guess' : 'skip' 
    });

    if (wantsToGuess) {
      // If they want to guess, show player selection
      setShowPlayerSelection(true);
    } else {
      // If they don't want to guess, show transition and emit skip
      setShowTransitionScreen(true);
      socket.emit('skip_guess', { roomCode });
    }
  };

  const handleGuessSubmit = () => {
    if (guessedPlayer) {
      socket.emit('make_guess', { 
        roomCode, 
        guessedPlayerId: guessedPlayer 
      });
      setShowPlayerSelection(false);
      setShowTransitionScreen(true); // Show transition after submitting guess
    }
  };

  const renderGuessingPhase = () => {
    if (gameState !== 'guessing') return null;

    // If not the answerer and transition screen is showing, return null
    if (!isAnswering && showTransitionScreen) return null;

    // Animated ellipses component
    const AnimatedEllipses = () => {
      const [dots, setDots] = useState('.');

      useEffect(() => {
        const interval = setInterval(() => {
          setDots(prev => {
            if (prev === '.') return '..';
            if (prev === '..') return '...';
            return '.';
          });
        }, 500);
        return () => clearInterval(interval);
      }, []);

      return <span>{dots}</span>;
    };

    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          padding: '16px',
          paddingTop: '10vh',
          boxSizing: 'border-box',
          alignItems: 'flex-start'
        }}
      >
        <div 
          className="flex flex-col"
          style={{
            width: '85%',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
          }}
        >
          {/* Header Container */}
          <div className="flex flex-col items-center" style={{ marginBottom: '16px' }}>
            <h2 
              className="font-bold"
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '32px',
                textAlign: 'center',
                color: '#FFFFFF',
                margin: 0,
                padding: 0
              }}
            >
              Round {currentRound}
            </h2>
            {isAnswering && (
              <p 
                className="text-white"
                style={{ 
                  fontFamily: 'MADE Gentle, sans-serif', 
                  fontSize: '24px',
                  textAlign: 'center',
                  color: '#FFFFFF',
                  marginTop: '4px',
                  marginBottom: 0,
                  padding: 0
                }}
              >
                {showPlayerSelection ? 'Guess your curious cat!' : 'Answer the question on the screen'}
              </p>
            )}
          </div>

          {isAnswering ? (
            <div className="flex flex-col">
              {isOwnQuestion ? (
                <div>
                  {!showGuessPrompt ? (
                    <p 
                      style={{ 
                        fontFamily: 'MADE Gentle, sans-serif', 
                        fontSize: '18px',
                        color: '#FFFFFF',
                        marginBottom: '16px'
                      }}
                    >
                      Reading the question...
                    </p>
                  ) : (
                    <>
                      <p 
                        className="mb-4"
                        style={{ 
                          fontFamily: 'MADE Gentle, sans-serif', 
                          fontSize: '18px',
                          color: '#FFFFFF',
                          marginBottom: '16px'
                        }}
                      >
                        You wrote this question! No guessing!
                      </p>
                      <div className="flex justify-center" style={{ marginTop: '28px' }}>
                        <button 
                          onClick={() => {
                            socket.emit('skip_guess', { roomCode });
                            setShowTransitionScreen(true);
                          }}
                          className="bg-white rounded-full text-[#B96759] font-bold hover:bg-opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-white"
                          style={{
                            width: '50%',
                            minWidth: '80px',
                            paddingTop: '12px',
                            paddingBottom: '10px',
                            paddingLeft: '5px',
                            paddingRight: '5px',
                            fontFamily: 'Heyam, sans-serif',
                            fontSize: '24px',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Next
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {showGuessPrompt && !showPlayerSelection && (
                    <div>
                      <p 
                        className="mb-4"
                        style={{ 
                          fontFamily: 'MADE Gentle, sans-serif', 
                          fontSize: '18px',
                          color: '#FFFFFF',
                          marginBottom: '16px',
                          textAlign: 'center'
                        }}
                      >
                        Would you like to guess your curious cat?
                      </p>
                      <div className="flex justify-center" style={{ marginTop: '24px', gap: '10px' }}>
                        <button 
                          onClick={() => handleGuessChoice(true)}
                          className="bg-white rounded-full text-[#B96759] font-bold hover:bg-opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-white"
                          style={{
                            width: '25%',
                            paddingTop: '12px',
                            paddingBottom: '10px',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            fontFamily: 'Heyam, sans-serif',
                            fontSize: '24px',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          Yes
                        </button>
                        <button 
                          onClick={() => handleGuessChoice(false)}
                          className="bg-white rounded-full text-[#B96759] font-bold hover:bg-opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-white"
                          style={{
                            width: '25%',
                            paddingTop: '12px',
                            paddingBottom: '10px',
                            paddingLeft: '24px',
                            paddingRight: '24px',
                            fontFamily: 'Heyam, sans-serif',
                            fontSize: '24px',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                  {showPlayerSelection && (
                    <div>
                      <select
                        value={guessedPlayer}
                        onChange={(e) => setGuessedPlayer(e.target.value)}
                        className="bg-white text-[#B96759] focus:outline-none focus:ring-2 focus:ring-white transition-all"
                        style={{
                          width: '100%',
                          maxWidth: '100%',
                          padding: '10px 10px',
                          paddingRight: '40px',
                          borderRadius: '12px',
                          fontFamily: 'MADE Gentle, sans-serif',
                          fontSize: '18px',
                          border: 'none',
                          boxShadow: 'none',
                          WebkitAppearance: 'none',
                          MozAppearance: 'none',
                          appearance: 'none',
                          boxSizing: 'border-box',
                          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23B96759' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                          backgroundRepeat: 'no-repeat',
                          backgroundPosition: 'right 12px center',
                          backgroundSize: '12px',
                          marginBottom: '16px'
                        }}
                      >
                        <option value="">Select who you think asked the question...</option>
                        {players
                          .filter(player => player.id !== socket.id)
                          .map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name}
                            </option>
                          ))
                        }
                      </select>
                      <div className="flex justify-center" style={{ marginTop: '28px' }}>
                        <button 
                          onClick={handleGuessSubmit}
                          disabled={!guessedPlayer}
                          className="bg-white rounded-full text-[#B96759] font-bold hover:bg-opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50"
                          style={{
                            width: '50%',
                            minWidth: '80px',
                            paddingTop: '12px',
                            paddingBottom: '10px',
                            paddingLeft: '5px',
                            paddingRight: '5px',
                            fontFamily: 'Heyam, sans-serif',
                            fontSize: '24px',
                            border: 'none',
                            cursor: guessedPlayer ? 'pointer' : 'not-allowed'
                          }}
                        >
                          Submit
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            !showTransitionScreen && (
              <div className="flex flex-col items-center">
                <p 
                  style={{ 
                    fontFamily: 'MADE Gentle, sans-serif', 
                    fontSize: '18px',
                    color: '#FFFFFF',
                    textAlign: 'center'
                  }}
                >
                  {targetPlayer?.name || "Another player"} is answering their question<AnimatedEllipses />
                </p>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  const renderTransitionScreen = () => {
    if (!showTransitionScreen) return null;

    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          padding: '16px',
          paddingTop: '10vh',
          boxSizing: 'border-box',
          alignItems: 'flex-start'
        }}
      >
        <div 
          className="flex flex-col items-center"
          style={{
            width: '85%',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
          }}
        >
          <h2 
            className="font-bold"
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '32px',
              textAlign: 'center',
              color: '#FFFFFF',
              margin: 0,
              padding: 0
            }}
          >
            Round {currentRound}
          </h2>
          <p 
            className="mt-4"
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '18px',
              textAlign: 'center',
              color: '#FFFFFF',
              marginTop: '16px',
              marginBottom: 0,
              padding: 0
            }}
          >
            Please look at the main screen
          </p>
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Check for stored data on mount
    const savedName = localStorage.getItem('playerName');
    const savedRoom = localStorage.getItem('roomCode');
    
    if (savedName && savedRoom) {
      setHasStoredData(true);
      setStoredRoom(savedRoom);
      setStoredName(savedName);
    }
  }, []);

  // Render reconnection choice if there's stored data
  if (hasStoredData && !joined && !isReconnecting) {
    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          padding: '16px',
          paddingTop: '10vh',
          boxSizing: 'border-box',
          alignItems: 'flex-start'
        }}
      >
        <div 
          className="flex flex-col"
          style={{
            width: '85%',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
          }}
        >
          <h2 
            className="font-bold mb-6"
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '32px',
              textAlign: 'center',
              color: '#FFFFFF',
              margin: 0,
              marginBottom: '24px',
              padding: 0
            }}
          >
            Previous session found
          </h2>
          <div 
            className="mb-6"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px'
            }}
          >
            <p 
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '18px',
                color: '#FFFFFF',
                marginBottom: '8px'
              }}
            >
              Room Code: <span style={{ fontFamily: 'MADE Gentle, sans-serif', fontWeight: 'bold' }}>{storedRoom}</span>
            </p>
            <p 
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '18px',
                color: '#FFFFFF'
              }}
            >
              Player Name: <span style={{ fontWeight: 'bold' }}>{storedName}</span>
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: '16px' }}>
            <button
              onClick={() => {
                setIsReconnecting(true);
                connectSocket();
                socket.emit('attempt_reconnect', {
                  playerName: storedName,
                  roomCode: storedRoom
                });
              }}
              className="bg-white rounded-full text-[#B96759] font-bold hover:bg-opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-white"
              style={{
                width: '100%',
                paddingTop: '12px',
                paddingBottom: '10px',
                paddingLeft: '5px',
                paddingRight: '5px',
                fontFamily: 'Heyam, sans-serif',
                fontSize: '24px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Rejoin previous game
            </button>
            <button
              onClick={() => {
                clearPlayerData();
                setHasStoredData(false);
                setStoredRoom('');
                setStoredName('');
                setRoomCode('');
                setPlayerName('');
              }}
              className="bg-white rounded-full text-[#B96759] font-bold hover:bg-opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-white"
              style={{
                width: '100%',
                paddingTop: '12px',
                paddingBottom: '10px',
                paddingLeft: '5px',
                paddingRight: '5px',
                fontFamily: 'Heyam, sans-serif',
                fontSize: '24px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Join new game
            </button>
          </div>
          {error && (
            <p 
              className="mt-4 text-center"
              style={{ 
                color: '#FFFFFF',
                fontSize: '14px',
                borderRadius: '12px',
                padding: '8px'
              }}
            >
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Show join form if no stored data or user chose to join new game
  if (!joined && !isReconnecting) {
    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          padding: '16px',
          paddingTop: '10vh',
          boxSizing: 'border-box',
          alignItems: 'flex-start'
        }}
      >
        <form 
          onSubmit={handleJoin} 
          className="flex flex-col"
          style={{
            width: '85%',
            maxHeight: '100%',
            justifyContent: 'flex-start',
            boxSizing: 'border-box',
            padding: '20px',
            borderRadius: '10px'
          }}
        >
          {/* Name Input */}
          <div className="flex flex-col" style={{ width: '100%' }}>
            <label
              className="font-bold mb-2"
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '32px',
                textAlign: 'left',
                color: '#FFFFFF'
              }}
            >
              Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder=""
              maxLength={15}
              className="bg-white text-[#B96759] focus:outline-none focus:ring-2 focus:ring-white transition-all"
              style={{
                width: '100%',
                maxWidth: '100%',
                padding: '12px 10px',
                borderRadius: '12px',
                fontFamily: 'MADE Gentle, sans-serif',
                fontSize: '18px',
                border: 'none',
                boxShadow: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Room Code Input */}
          <div className="flex flex-col" style={{ marginTop: '28px', width: '100%' }}>
            <label
              className="font-bold mb-2"
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '32px',
                textAlign: 'left',
                color: '#FFFFFF'
              }}
            >
              Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder=""
              maxLength={4}
              className="bg-white text-[#B96759] uppercase focus:outline-none focus:ring-2 focus:ring-white transition-all"
              style={{
                width: '100%',
                maxWidth: '100%',
                padding: '12px 10px',
                borderRadius: '12px',
                fontFamily: 'MADE Gentle, sans-serif',
                fontSize: '18px',
                border: 'none',
                boxShadow: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                appearance: 'none',
                letterSpacing: '0.1em',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-white text-center text-sm rounded-full px-4 py-2 mt-4" style={{ color: '#FFFFFF' }}>
              {error}
            </p>
          )}

          {/* Join Button */}
          <div className="flex justify-center" style={{ marginTop: '28px' }}>
            <button
              type="submit"
              className="bg-white rounded-full text-[#B96759] font-bold hover:bg-opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-white"
              style={{
                width: '50%',
                minWidth: '80px',
                paddingTop: '12px',
                paddingBottom: '10px',
                paddingLeft: '5px',
                paddingRight: '5px',
                fontFamily: 'Heyam, sans-serif',
                fontSize: '24px',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Join
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (gameState === 'waiting') {
    // Animated ellipses component
    const AnimatedEllipses = () => {
      const [dots, setDots] = useState('.');

      useEffect(() => {
        const interval = setInterval(() => {
          setDots(prev => {
            if (prev === '.') return '..';
            if (prev === '..') return '...';
            return '.';
          });
        }, 500);
        return () => clearInterval(interval);
      }, []);

      return <span>{dots}</span>;
    };

    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          padding: '16px',
          paddingTop: '10vh',
          boxSizing: 'border-box',
          alignItems: 'flex-start'
        }}
      >
        <div 
          className="flex flex-col items-center"
          style={{
            width: '85%',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
          }}
        >
          <h2 
            className="font-bold mb-6"
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '32px',
              textAlign: 'center',
              color: '#FFFFFF',
              margin: 0,
              marginBottom: '24px',
              padding: 0
            }}
          >
            Game lobby
          </h2>
          <p 
            className="mb-6"
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '18px',
              textAlign: 'center',
              color: '#FFFFFF',
              marginBottom: '24px'
            }}
          >
            {joinStatus}<AnimatedEllipses />
          </p>
          <div 
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              width: '85%',
              margin: '0 auto'
            }}
          >
            <p 
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '18px',
                color: '#FFFFFF',
                marginBottom: '8px'
              }}
            >
              Room Code: <span style={{ fontFamily: 'MADE Gentle, sans-serif', fontWeight: 'bold' }}>{roomCode}</span>
            </p>
            <p 
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '18px',
                color: '#FFFFFF'
              }}
            >
              Your Name: <span style={{ fontWeight: 'bold' }}>{playerName}</span>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Add a loading state for reconnection
  if (isReconnecting) {
    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100vw',
          height: '100vh',
          maxHeight: '100vh',
          overflow: 'hidden',
          padding: '16px',
          paddingTop: '10vh',
          boxSizing: 'border-box',
          alignItems: 'flex-start'
        }}
      >
        <div 
          className="flex flex-col items-center"
          style={{
            width: '85%',
            justifyContent: 'flex-start',
            boxSizing: 'border-box'
          }}
        >
          <h2 
            className="font-bold"
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '32px',
              textAlign: 'center',
              color: '#FFFFFF',
              margin: 0,
              padding: 0
            }}
          >
            Reconnecting...
          </h2>
          <p 
            className="mt-4"
            style={{ 
              fontFamily: 'MADE Gentle, sans-serif', 
              fontSize: '18px',
              textAlign: 'center',
              color: '#FFFFFF',
              marginTop: '16px',
              marginBottom: 0,
              padding: 0
            }}
          >
            Attempting to rejoin the game...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="p-4 sm:p-6 md:p-8 lg:p-12">
        {!joined ? (
          <div className="p-8">
            <h1 className="text-3xl mb-6">Join Game</h1>
            {/* ... join form JSX ... */}
          </div>
        ) : (
          <>
            {showTransitionScreen && !showPlayerSelection ? (
              renderTransitionScreen()
            ) : (
              <>
                {renderQuestionSubmission()}
                {renderWaitingForOthers()}
                {renderVoting()}
                {renderGuessingPhase()}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Player;
