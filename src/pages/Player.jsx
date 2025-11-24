import { useState, useEffect, useRef } from 'react';
import { 
  socket, 
  connectSocket,  // Add this import
  storePlayerData, 
  clearPlayerData 
} from '../socket';
import defaultQuestions from '../data/defaultQuestions.json';
import { sanitizeForDisplay } from '../utils/sanitize';
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
  const [isDefaultQuestion, setIsDefaultQuestion] = useState(false);
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
  const timeoutRef = useRef(null);
  const [submissionEnd, setSubmissionEnd] = useState(null);
  const [votingEnd, setVotingEnd] = useState(null);
  const [gameEndData, setGameEndData] = useState(null);
  const [defaultQuestionUsed, setDefaultQuestionUsed] = useState(false);

  useEffect(() => {
    console.log("[Player] Component mounted");

    socket.on('join_success', () => {
      console.log('[Player] Successfully joined room:', roomCode);
      // Read from localStorage to ensure we have the latest values
      try {
        const savedRoom = localStorage.getItem('roomCode');
        const savedName = localStorage.getItem('playerName');
        if (savedRoom && !roomCode) setRoomCode(savedRoom);
        if (savedName && !playerName) setPlayerName(savedName);
      } catch (error) {
        console.error('Error reading localStorage:', error);
      }
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

    socket.on('voting_phase', ({ questions, votingEnd }) => {
      // Voting payload from server should already be filtered per-player
      setGameState('voting');
      console.log('=== Voting Phase Debug (client) ===');
      console.log('Voting questions payload (already filtered):', questions);
      setAllQuestions(questions);
      setDisplayedQuestions(questions);
      setHasVoted(false);
      if (votingEnd) setVotingEnd(votingEnd);
    });

    socket.on('submission_countdown_started', ({ endTime }) => {
      setSubmissionEnd(endTime);
    });

    socket.on('submission_countdown_canceled', () => {
      setSubmissionEnd(null);
    });

    socket.on('game_ended', ({ players, finalScores, bonuses }) => {
      setGameState('finished');
      setPlayers(players);
      setGameEndData({ finalScores, bonuses });
    });

    socket.on('room_closed', (msg) => {
      setGameState('closed');
      setError(msg || 'Room closed');
    });

    socket.on('guessing_phase', ({ question, targetPlayer, authorId }) => {
      // Short, deterministic guessing-phase handling
      setGameState('guessing');
      setSelectedQuestion(question);
      setTargetPlayer(targetPlayer);
      setShowGuessPrompt(false);
      setShowPlayerSelection(false);
      setGuessedPlayer('');

      // Compute local flags to avoid stale state closures
      const thisIsAnswerer = socket.id === targetPlayer?.id;
      const thisIsOwnQuestion = authorId === socket.id;

      setIsAnswering(thisIsAnswerer);
      setIsOwnQuestion(thisIsOwnQuestion);

      // Clear any existing timeout for safety
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // If this client is the answerer
      if (thisIsAnswerer) {
        // Show "Reading the question..." for 7 seconds, then reveal prompt.
        // IMPORTANT: Do NOT auto-skip here. Progression to the next round must only
        // happen when the answerer explicitly chooses to skip or submits a guess.
        timeoutRef.current = setTimeout(() => {
          setShowGuessPrompt(true);
        }, 7000);
      }
    });

    socket.on('vote_received', ({ votesCount }) => {
      setTotalVotes(votesCount);
    });

    socket.on('vote_error', (errorMessage) => {
      console.log('[Player] Vote error:', errorMessage);
      setError(errorMessage);
      // Reset voted state so user can try again (if not truly voted)
      setHasVoted(false);
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
  setIsDefaultQuestion(false);
      setHasVoted(false);  // Reset voting state for new round
      setQuestion('');
      setSelectedTarget('');
      setError(null);
      setGameState('playing');  // Make sure we set the game state back to 'playing'
      setShowTransitionScreen(false);  // Reset transition screen
      setShowPlayerSelection(false);   // Reset player selection
      setShowGuessPrompt(false);      // Reset guess prompt
      setGuessedPlayer('');           // Reset guessed player
      setIsAnswering(false);  // Reset answering state (will be recalculated in guessing_phase)
      setSelectedQuestion(null);  // Clear previous question
      setDefaultQuestionUsed(false);  // Allow default question to be used again
      setSubmissionEnd(null);  // CRITICAL: Clear leftover submission timer from previous round
      setVotingEnd(null);  // Also clear voting timer

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
      console.log('[Player] hasSubmitted from server:', gameState.hasSubmitted);
      console.log('[Player] hasVoted from server:', gameState.hasVoted);
      console.log('[Player] currentPhase:', gameState.currentPhase);
      console.log('[Player] gameState:', gameState.gameState);
      // Read from localStorage to ensure we have the latest values
      try {
        const savedRoom = localStorage.getItem('roomCode');
        const savedName = localStorage.getItem('playerName');
        if (savedRoom) setRoomCode(savedRoom);
        if (savedName) setPlayerName(savedName);
      } catch (error) {
        console.error('Error reading localStorage:', error);
      }
      setJoined(true);
      
      // Set game state based on current phase
      if (gameState.currentPhase === 'voting') {
        setGameState('voting');
        // Set voting questions if provided (always set them, even if already voted)
        if (gameState.votingQuestions) {
          setAllQuestions(gameState.votingQuestions);
          const filteredQuestions = gameState.votingQuestions.filter(q => q.authorId !== socket.id);
          setDisplayedQuestions(filteredQuestions);
        }
      } else if (gameState.currentPhase === 'guessing') {
        setGameState('guessing');
        // Restore guessing phase state
        if (gameState.selectedQuestion) {
          setSelectedQuestion(gameState.selectedQuestion);
        }
        if (gameState.targetPlayer) {
          setTargetPlayer(gameState.targetPlayer);
          // Calculate if this player is answering
          const isAnsweringPlayer = gameState.targetPlayer.id === socket.id;
          setIsAnswering(isAnsweringPlayer);
          console.log('[Player] Reconnect - isAnswering:', isAnsweringPlayer, 'targetPlayer.id:', gameState.targetPlayer.id, 'socket.id:', socket.id);
          
          // Check if it's their own question
          if (gameState.questionAuthorId) {
            const isOwnQuestion = gameState.questionAuthorId === socket.id;
            setIsOwnQuestion(isOwnQuestion);
            console.log('[Player] Reconnect - isOwnQuestion:', isOwnQuestion, 'questionAuthorId:', gameState.questionAuthorId);
          }
        }
      } else if (gameState.currentPhase === 'question') {
        setGameState('playing');
      } else {
        setGameState(gameState.gameState);
      }
      
      setCurrentRound(gameState.currentRound);
      setPlayers(gameState.players);
      
      // Restore hasSubmitted state if provided by server
      if (gameState.hasSubmitted !== undefined) {
        console.log('[Player] Setting hasSubmitted to:', gameState.hasSubmitted);
        setHasSubmitted(gameState.hasSubmitted);
      } else {
        console.log('[Player] WARNING: hasSubmitted not provided by server!');
      }
      
      // Restore hasVoted state if provided by server
      if (gameState.hasVoted !== undefined) {
        console.log('[Player] Setting hasVoted to:', gameState.hasVoted);
        setHasVoted(gameState.hasVoted);
      }
      
      // Set joinStatus if game hasn't started yet
      if (gameState.gameState === 'waiting') {
        setJoinStatus('You\'re in! Waiting for game to start');
      }
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
      
      // Restore hasSubmitted state if provided by server
      if (gameData.hasSubmitted !== undefined) {
        setHasSubmitted(gameData.hasSubmitted);
      } else {
        // Fallback: Set appropriate phase-specific states
        if (gameData.currentPhase === 'question') {
          setHasSubmitted(false);
        } else if (gameData.currentPhase === 'voting' || gameData.currentPhase === 'guessing') {
          setHasSubmitted(true); // Past question phase means they submitted
        }
      }
      
      if (gameData.currentPhase === 'voting') {
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

    socket.on('question_error', (error) => {
      console.log('[Player] Question error:', error);
      setError(error);
      // Reset hasSubmitted if server rejected the submission
      setHasSubmitted(false);
      setIsDefaultQuestion(false);
    });

    return () => {
      console.log("[Player] Component unmounting");
      socket.off('join_error');
      socket.off('question_error');
      socket.off('join_success');
      socket.off('player_joined');
      socket.off('game_started');
      socket.off('voting_phase');
      socket.off('guessing_phase');
      socket.off('vote_received');
      socket.off('vote_error');
      socket.off('new_round');
      socket.off('player_choice');
      socket.off('reconnect_success');
      socket.off('player_disconnected');
      socket.off('player_reconnected');
      socket.off('rejoin_game_in_progress');
      socket.off('reconnect_failed');
      
      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
    }, [roomCode]);

  const handleJoin = async (e) => {
    e.preventDefault();
    const trimmedRoomCode = roomCode.trim().toUpperCase();
    const trimmedPlayerName = playerName.trim();
    
    // Room code validation
    if (!trimmedRoomCode) {
      setError('Please enter a room code');
      return;
    }
    if (trimmedRoomCode.length !== 4) {
      setError('Room code must be exactly 4 characters');
      return;
    }
    if (!/^[A-Z]{4}$/.test(trimmedRoomCode)) {
      setError('Room code must contain only letters');
      return;
    }
    
    // Name validation (matches server MAX_NAME_LENGTH = 10)
    if (!trimmedPlayerName) {
      setError('Please enter your name');
      return;
    }
    if (trimmedPlayerName.length > 15) {
      setError('Name must be 15 characters or less');
      return;
    }
    // Check if name contains numbers
    if (/\d/.test(trimmedPlayerName)) {
      setError('Name cannot contain numbers');
      return;
    }

    try {
      await connectSocket();
      storePlayerData(trimmedPlayerName, trimmedRoomCode);
      socket.emit('join_room', { 
        roomCode: trimmedRoomCode, 
        playerName: trimmedPlayerName 
      });
    } catch (error) {
      setError('Failed to connect to server');
    }
  };

  const handleSubmitQuestion = (e) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (hasSubmitted) {
      setError('You have already submitted a question for this round');
      return;
    }
    
    if (!question.trim() || !selectedTarget) {
      setError('Please fill in both the question and select a target player');
      return;
    }
    if (question.length > 150) {
      setError('Question must be 150 characters or less');
      return;
    }

    socket.emit('submit_question', {
      roomCode,
      question: question.trim(),
      targetPlayer: selectedTarget,
      authorId: socket.id,
      isDefault: !!isDefaultQuestion
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
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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
          {submissionEnd && !hasSubmitted && (
            <div style={{ marginBottom: '12px', color: '#FFFFFF', textAlign: 'center' }}>
              <SubmissionCountdown endTime={submissionEnd} />
            </div>
          )}
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
            <div className="flex flex-col" style={{ width: '100%'}}>
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
                maxLength={150}
                className="bg-white text-[#B96759] focus:outline-none focus:ring-2 focus:ring-white transition-all resize-none"
                readOnly={isDefaultQuestion}
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
              <span className="block text-right text-xs mt-1" style={{ color: '#FFFFFF', fontFamily: 'MADE Gentle, sans-serif' }}>{question.length}/150</span>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <span
                role="button"
                tabIndex={defaultQuestionUsed ? -1 : 0}
                onClick={() => {
                  if (!defaultQuestionUsed) {
                    const dq = defaultQuestions[Math.floor(Math.random() * defaultQuestions.length)];
                    setQuestion(dq);
                    setIsDefaultQuestion(true);
                    setDefaultQuestionUsed(true);
                  }
                }}
                onKeyDown={(e) => {
                  if (!defaultQuestionUsed && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    const dq = defaultQuestions[Math.floor(Math.random() * defaultQuestions.length)];
                    setQuestion(dq);
                    setIsDefaultQuestion(true);
                    setDefaultQuestionUsed(true);
                  }
                }}
                style={{
                  color: '#FFFFFF',
                  cursor: defaultQuestionUsed ? 'default' : 'pointer',
                  alignSelf: 'flex-start',
                  fontFamily: 'MADE Gentle, sans-serif',
                  fontSize: '18px',
                  paddingTop: '6px',
                  paddingBottom: '4px',
                  textDecoration: 'underline',
                  opacity: defaultQuestionUsed ? 0.5 : 1,
                  transition: 'opacity 0.2s ease'
                }}
              >
                Give me a question
              </span>
              {isDefaultQuestion && (
                <div style={{ alignSelf: 'center', color: '#FFFFFF' }}>Default question locked</div>
              )}
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
                    <option key={player.id} value={player.id}>{sanitizeForDisplay(player.name)}</option>
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
                disabled={hasSubmitted}
                className="bg-white rounded-full text-[#B96759] font-bold hover:bg-opacity-90 transition-all focus:outline-none focus:ring-2 focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed"
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
                  cursor: hasSubmitted ? 'not-allowed' : 'pointer',
                  opacity: hasSubmitted ? 0.5 : 1
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

  const SubmissionCountdown = ({ endTime }) => {
    const [, force] = useState(0);
    useEffect(() => {
      const iv = setInterval(() => force(n => n + 1), 500);
      return () => clearInterval(iv);
    }, []);
    const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    return (
      <div style={{ color: '#FFFFFF', fontFamily: 'MADE Gentle, sans-serif', fontSize: '18px' }}>
        Submission auto-fill in: <strong>{remaining}s</strong>
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
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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
    // Defensive check: ensure the player is not voting for their own question
    const votedQuestion = displayedQuestions.find(q => q.id === questionId);
    if (votedQuestion && votedQuestion.authorId === socket.id) {
      console.warn('[Player] Attempted to vote for own question (should be filtered by UI)');
      setError('You cannot vote for your own question');
      return;
    }
    
    // Only allow vote if not already voted
    if (!hasVoted) {
      socket.emit('submit_vote', { roomCode, questionId });
      setHasVoted(true);
    }
  };

  const renderVoting = () => {
    if (gameState !== 'voting') return null;

    const formatQuestion = (text) => {
      const trimmedText = text.trim();
      return trimmedText.endsWith('?') ? trimmedText : `${trimmedText}?`;
    };

    const VotingCountdown = ({ endTime }) => {
      const [, force] = useState(0);
      useEffect(() => {
        const iv = setInterval(() => force(n => n + 1), 500);
        return () => clearInterval(iv);
      }, []);
      const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      return (
        <div style={{ color: '#FFFFFF', marginBottom: '8px', fontFamily: 'MADE Gentle, sans-serif', fontSize: '18px' }}>
          Voting ends in: <strong>{remaining}s</strong>
        </div>
      );
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
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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
            {votingEnd && !hasVoted && <VotingCountdown endTime={votingEnd} />}
          </div>

          {!hasVoted && (
            <div className="bg-white rounded-xl p-6 mt-2">
              {displayedQuestions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {displayedQuestions.map((question) => {
                    // Use the questionNumber from server payload if available
                    const questionNumber = question.questionNumber || 1;
                    
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

    // Clear any pending reading timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

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
      // Clear both main and auto-skip timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
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
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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
                    <>

                    </>
                  ) : (
                    <>
                      <div className="bg-white rounded-lg p-6" style={{ marginBottom: '16px' }}>
                        <p 
                          style={{ 
                            fontFamily: 'MADE Gentle, sans-serif', 
                            fontSize: '20px',
                            color: '#B96759',
                            margin: 0,
                            wordWrap: 'break-word'
                          }}
                        >
                          {sanitizeForDisplay(selectedQuestion)}
                        </p>
                      </div>
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
                  {!showGuessPrompt && (
                    <>

                    </>
                  )}
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
                              {sanitizeForDisplay(player.name)}
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
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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

  const renderGameOver = () => {
    if (gameState !== 'finished' || !gameEndData) return null;
    
    // Find the current player's score
    const currentPlayer = players.find(p => p.id === socket.id);
    const playerScore = currentPlayer?.score || 0;

    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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
              marginBottom: '24px',
              padding: 0
            }}
          >
            Game Over
          </h2>
          <div 
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              padding: '16px',
              width: '100%',
              marginTop: '16px'
            }}
          >
            <p 
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '24px',
                color: '#FFFFFF',
                textAlign: 'center',
                margin: 0
              }}
            >
              Your Score: <span style={{ fontWeight: 'bold' }}>{playerScore}</span>
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderRoomClosed = () => {
    if (gameState !== 'closed') return null;
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#D67C6D]">
        <div className="text-center max-w-2xl w-full">
          <h1 className="text-5xl mb-6 text-red-500 font-bold">Room Closed</h1>
          <p className="text-2xl text-white mb-8">
            {error || 'The room has been closed due to inactivity (5 minutes after game ended).'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-blue-600 px-8 py-4 rounded-lg text-xl font-bold hover:bg-blue-700 transition text-white"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    // Check for stored data on mount
    try {
      const savedName = localStorage.getItem('playerName');
      const savedRoom = localStorage.getItem('roomCode');
      
      if (savedName && savedRoom) {
        setHasStoredData(true);
        setStoredRoom(savedRoom);
        setStoredName(savedName);
      }
    } catch (error) {
      console.error('Error accessing localStorage:', error);
      // Continue without stored data
    }
  }, []);

  // Add reload warning when player is in a game
  useEffect(() => {
    // Only warn if player has joined and game is active (not finished or closed)
    const shouldWarn = joined && gameState !== 'finished' && gameState !== 'closed';
    
    if (shouldWarn) {
      const handleBeforeUnload = (e) => {
        // Modern browsers require returnValue to be set
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? You will be disconnected from the game.';
        return e.returnValue;
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [joined, gameState]);

  // Render reconnection choice if there's stored data
  if (hasStoredData && !joined && !isReconnecting) {
    return (
      <div 
        className="flex justify-center bg-[#D67C6D]"
        style={{
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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
              onClick={async () => {
                setIsReconnecting(true);
                // Set roomCode and playerName from stored values so they display correctly
                setRoomCode(storedRoom);
                setPlayerName(storedName);
                // Set joinStatus so it shows immediately when waiting lobby appears
                setJoinStatus('You\'re in! Waiting for game to start');
                try {
                  await connectSocket();
                  socket.emit('attempt_reconnect', {
                    playerName: storedName,
                    roomCode: storedRoom
                  });
                } catch (error) {
                  setError('Failed to connect to server');
                  setIsReconnecting(false);
                }
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
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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
              Room Code: <span style={{ fontFamily: 'MADE Gentle, sans-serif', fontWeight: 'bold' }}>{sanitizeForDisplay(roomCode)}</span>
            </p>
            <p 
              style={{ 
                fontFamily: 'MADE Gentle, sans-serif', 
                fontSize: '18px',
                color: '#FFFFFF'
              }}
            >
              Your Name: <span style={{ fontWeight: 'bold' }}>{sanitizeForDisplay(playerName)}</span>
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
          width: '100dvw',
          height: '100dvh',
          maxHeight: '100dvh',
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
      {/* Room Closed - highest priority */}
      {renderRoomClosed()}
      
      {/* Game Over - next priority */}
      {renderGameOver()}
      
      {/* Normal Game Flow */}
      {gameState !== 'finished' && gameState !== 'closed' && (
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
      )}
    </div>
  );
}

export default Player;
