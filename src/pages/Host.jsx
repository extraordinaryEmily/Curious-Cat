import { useState, useEffect } from 'react';
import '../logo-animation.css';
import '../loading-screen.css';
import '../rules-screen.css';
import '../styles/host-setup.css';
import logoImage from '../LOGO.png';
import { socket, connectSocket } from '../socket';
import { sanitizeForDisplay } from '../utils/sanitize';

function Host() {
  const [roomCode, setRoomCode] = useState(null);
  const [players, setPlayers] = useState([]);
  const [gameState, setGameState] = useState('waiting');
  const [currentRound, setCurrentRound] = useState(0);
  const [targetPlayer, setTargetPlayer] = useState(null);
  const [currentPhase, setCurrentPhase] = useState('waiting');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [numberOfRounds, setNumberOfRounds] = useState(6); // Default to 3 rounds
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false); // Add this state
  const [submittedPlayers, setSubmittedPlayers] = useState(new Set());
  const [displayedQuestions, setDisplayedQuestions] = useState([]);
  const [guessStatus, setGuessStatus] = useState(null);
  const [showLoading, setShowLoading] = useState(true);
  const [showRules, setShowRules] = useState(false);
  const [showGameSetup, setShowGameSetup] = useState(false);  // New state
  const [finalScores, setFinalScores] = useState(null);
  const [bonuses, setBonuses] = useState([]);

  useEffect(() => {
    const loadingTimer = setTimeout(() => {
      setShowLoading(false);
      setShowRules(true);
    }, 6000); // Show rules after loading animation (adjust timing as needed)

    return () => clearTimeout(loadingTimer);
  }, []);

  useEffect(() => {
    console.log("Host component mounted");

    socket.on('room_created', (code) => {
      console.log('[Host] Room created with code:', code);
      setRoomCode(code);
      setIsCreatingRoom(false); // Reset the flag after room is created
    });

    socket.on('room_creation_error', (msg) => {
      console.log('[Host] Room creation error:', msg);
      setError(msg);
      setIsCreatingRoom(false);
    });

    socket.on('player_joined', ({ players }) => {
      console.log('[Host] Players updated:', players);
      console.log('[Host] Player names:', players.map(p => p.name));
      setPlayers(players);
    });

    socket.on('player_left', ({ players }) => {
      setPlayers(players);
    });

    socket.on('game_started', ({ round, targetPlayer }) => {
      // When a game starts, leave the setup screen and show the question phase
      setShowGameSetup(false);
      setGameState('playing');
      setCurrentRound(round);
      setCurrentPhase('question');
      // If server provided a selected target player, set it
      if (targetPlayer) setTargetPlayer(targetPlayer);
      else setTargetPlayer(null);
    });

    socket.on('voting_phase', ({ questions }) => {
      console.log('[Host] Received voting_phase with questions:', questions);
      setDisplayedQuestions(questions);
      setCurrentPhase('voting');
    });

    socket.on('guessing_phase', ({ question, targetPlayer }) => {
      setCurrentPhase('guessing');
      setSelectedQuestion(question);
      // Make sure we're setting the full player object
      setTargetPlayer(targetPlayer);
    });

    socket.on('round_results', ({ correct, authorId, players }) => {
      setPlayers(players);
      // Display results briefly before moving to next round
    });

    socket.on('new_round', ({ round, targetPlayer }) => {
      console.log('=== Host New Round Debug ===', {
        round,
        targetPlayer,
        submittedPlayers: Array.from(submittedPlayers),
        selectedQuestion,
        displayedQuestions,
      });

      setCurrentRound(round);
      setTargetPlayer(targetPlayer);
      setCurrentPhase('question');
      setSelectedQuestion(null);
      setSubmittedPlayers(new Set()); // Clear submitted players
      setDisplayedQuestions([]); // Clear displayed questions
      setGuessStatus(null); // Clear guess status

      // Log state after clearing
      console.log('Host State After Clear:', {
        round,
        submittedPlayers: 'empty set',
        selectedQuestion: null,
        displayedQuestions: [],
      });
    });

    socket.on('game_ended', ({ players, finalScores, bonuses }) => {
      setGameState('finished');
      setPlayers(players);
      setFinalScores(finalScores || null);
      if (bonuses) setBonuses(bonuses);
    });

    socket.on('room_closed', (msg) => {
      setGameState('closed');
      console.log('Room closed by server:', msg);
    });

    socket.on('question_submitted', ({ playerName }) => {
      setSubmittedPlayers(prev => new Set([...prev, playerName]));
    });

    socket.on('player_choice', ({ choice }) => {
      console.log('Received player choice:', choice); // Debug log
      setGuessStatus(
        choice === 'skip' 
          ? "The answerer has chosen to skip their guess." 
          : "The answerer has chosen to guess!"
      );
    });

    socket.on('guess_result', ({ correct }) => {
      setGuessStatus(
        correct 
          ? "The answerer has found the curious cat!" 
          : "The answerer failed to find the curious cat!"
      );
    });

    return () => {
      console.log("Host component unmounting");
      socket.off('room_created');
      socket.off('player_joined');
      socket.off('player_left');
      socket.off('game_started');
      socket.off('voting_phase');
      socket.off('guessing_phase');
      socket.off('round_results');
      socket.off('new_round');
      socket.off('game_ended');
      socket.off('question_submitted');
      socket.off('player_choice');
      socket.off('guess_result');
    };
  }, [submittedPlayers]);

  const handleStartGame = () => {
    // Validate numberOfRounds before starting
    if (numberOfRounds < 3 || numberOfRounds > 20) {
      console.error('[Host] Invalid numberOfRounds:', numberOfRounds);
      return;
    }

    console.log('[Host] Emitting start_game event:', { 
      roomCode, 
      numberOfRounds 
    });
    console.log('[Host] handleStartGame() fired. Current numberOfRounds =', numberOfRounds);
    
    try {
      localStorage.setItem('numberOfRounds', numberOfRounds);
    } catch (error) {
      console.error('Error storing numberOfRounds to localStorage:', error);
    }
    
    socket.emit('start_game', { roomCode, numberOfRounds });
  };

  const renderQuestions = () => {
    if (currentPhase === 'voting' && selectedQuestions.length > 0) {
      return (
        <div className="mt-6">
          <h2 className="text-2xl mb-4">Questions to Vote On:</h2>
          <div className="grid grid-cols-2 gap-4">
            {selectedQuestions.slice(0, 6).map(q => (
              <div key={q.id} className="bg-gray-800 p-4 rounded-lg">
                <p>To: {q.targetPlayer}</p>
                <p>{q.text}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const handleCreateRoom = async () => {
    if (isCreatingRoom || roomCode) {
      console.log('[Host] Room creation already in progress or room exists');
      return;
    }

    try {
      setIsCreatingRoom(true);
      await connectSocket(true);
      // Don't send numberOfRounds when creating room - it will be sent when starting the game
      socket.emit('create_room', {});
    } catch (error) {
      console.error('[Host] Failed to create room:', error);
      setIsCreatingRoom(false);
    }
  };

  const handleRulesComplete = () => {
    setShowRules(false);
    setShowGameSetup(true);
  };

  const renderGameSetup = () => {
    return (
      <div className="host-setup-container">
        <div className="host-setup-box">
          <div className="host-setup-grid">
            {/* Left Column - Players */}
            <div className="players-container">
              <h2 className="player-list-title">Players:</h2>
              <div className="player-list">
                <div className="player-list-content">
                  {players.map(player => (
                    <div key={player.id} className="player-name">
                      {sanitizeForDisplay(player.name)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Game Settings */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="room-code">
                  {roomCode}
                </div>
                <div className="room-code-overflow">
                  {roomCode}
                </div>

                <div className="space-y-4">
                  <div>
                    <h2 className="rounds-title">
                      Number of Rounds: <span className="rounds-number">{numberOfRounds}</span>
                    </h2>
                    <input 
                      type="range" 
                      min="3" 
                      max="20" 
                      value={numberOfRounds}
                      onChange={(e) => setNumberOfRounds(parseInt(e.target.value))}
                      className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={handleStartGame}
                    disabled={players.length < 4}
                    className={`
                      start-button
                      w-full px-6 py-3
                      text-xl font-bold
                      rounded-xl
                      transition-all
                      ${players.length < 4 
                        ? 'bg-white/20 cursor-not-allowed' 
                        : 'bg-white text-[#B96759] hover:bg-white/90'}
                    `}
                  >
                    {players.length < 4 ? 'Waiting for Players...' : 'Start Game'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionPhase = () => {
    if (currentPhase !== 'question') return null;
    return (
      <div className="host-setup-container">
        <div className="host-setup-box">
          <h2 className="player-list-title text-center">Round {currentRound}</h2>
          <div className="question-phase-container">
            <h3 className="question-phase-title">Players Submitting Questions</h3>
            <div>
              {players.map(player => (
                <div 
                  key={player.id} 
                  className={`question-phase-submission-box ${
                    submittedPlayers.has(player.name) 
                      ? 'submitted' 
                      : 'pending'
                  }`}
                >
                </div>
              ))}
            </div>
            <p className="question-phase-count">
              {submittedPlayers.size} of {players.length} players have submitted
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderVotingPhase = () => {
    if (currentPhase !== 'voting') return null;

    const formatQuestion = (text) => {
      const trimmedText = text.trim();
      // Only convert first letter to lowercase, keep rest of the text as is
      const formattedText = trimmedText.charAt(0).toLowerCase() + trimmedText.slice(1);
      return formattedText.endsWith('?') ? formattedText : `${formattedText}?`;
    };

    return (
      <div className="host-setup-container">
        <div className="host-setup-box">
          <h2 className="player-list-title text-center">Round {currentRound}</h2>
          <div className="voting-phase-container">
            <h3 className="voting-phase-title">Vote for Your Favorite Question!</h3>
            <div className="voting-phase-questions-list">
              {displayedQuestions.map((question) => (
                <div key={question.id} className="voting-phase-question-box">
                  <p className="voting-phase-question-text">
                    Question {question.questionNumber || 1}: <span className="voting-phase-question-content">{sanitizeForDisplay(question.targetPlayer)}, {sanitizeForDisplay(formatQuestion(question.text))}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGuessingPhase = () => {
    if (currentPhase !== 'guessing') return null;

    const formatQuestion = (text) => {
      const trimmedText = text.trim();
      const formattedText = trimmedText.charAt(0).toLowerCase() + trimmedText.slice(1);
      return formattedText.endsWith('?') ? formattedText : `${formattedText}?`;
    };

    const addQuotations = (text) => {
      // Check if text already has quotation marks (straight quotes or curly quotes)
      const straightQuotes = text.startsWith('"') && text.endsWith('"');
      const curlyQuotes = text.startsWith('\u201C') && text.endsWith('\u201D');
      const singleQuotes = text.startsWith('\u2018') && text.endsWith('\u2019');
      const hasQuotes = straightQuotes || curlyQuotes || singleQuotes;
      return hasQuotes ? text : `"${text}"`;
    };

    return (
      <div className="host-setup-container">
        <div className="host-setup-box">
          <h2 className="player-list-title text-center">Round {currentRound}</h2>
          <div className="guessing-phase-container">
            {targetPlayer && selectedQuestion && (
              <div className="guessing-phase-question-text">
                {sanitizeForDisplay(addQuotations(`${typeof targetPlayer === 'string' ? targetPlayer : targetPlayer.name}, ${formatQuestion(selectedQuestion)}`))}
              </div>
            )}
            {guessStatus && (
              <p className="guessing-phase-status">
                {guessStatus}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderGameOver = () => {
    if (gameState !== 'finished') return null;
    
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
  
    return (
      <div className="host-setup-container">
        <div className="host-setup-box">
          <h2 className="player-list-title text-center">Game Over</h2>
          
          {/* Winner Section */}
          <div className="game-over-container">
            <h3 className="game-over-section-title text-center">Winner</h3>
            <div className="game-over-winner-box">
              <p className="game-over-winner-name">🏆 {sanitizeForDisplay(winner?.name || 'N/A')} 🏆</p>
              <p className="game-over-winner-score">{winner?.score || 0} points</p>
            </div>
          </div>

          {/* All Players Scoreboard */}
          <div className="game-over-container">
            <h3 className="game-over-section-title">Final Scoreboard</h3>
            <div className="game-over-scoreboard-list">
            {sortedPlayers.map((player, index) => (
              <div 
                key={player.id} 
                className={`game-over-scoreboard-item ${index === 0 ? 'winner' : 'other'}`}
              >
                <div>
                  <span className="game-over-scoreboard-rank">
                    #{index + 1}
                  </span>
                  <span className="game-over-scoreboard-name">
                    {sanitizeForDisplay(player.name)}
                  </span>
                </div>
                <span className="game-over-scoreboard-score">{player.score} points</span>
              </div>
            ))}
            </div>
          </div>


        </div>
      </div>
    );
  };

  useEffect(() => {
    if (showGameSetup && !roomCode && !isCreatingRoom) {
      handleCreateRoom();
    }
  }, [showGameSetup]);

  // Add reload warning when game is active (including back button)
  useEffect(() => {
    // Only warn if there's an active room or game in progress
    const shouldWarn = roomCode && (gameState === 'playing' || gameState === 'waiting');
    
    if (shouldWarn) {
      const handleBeforeUnload = (e) => {
        // Modern browsers require returnValue to be set
        e.preventDefault();
        e.returnValue = 'Are you sure you want to leave? You will be disconnected from the game.';
        return e.returnValue;
      };

      const handlePopState = (e) => {
        // Warn when user tries to go back
        const message = 'Are you sure you want to leave? You will be disconnected from the game.';
        if (!window.confirm(message)) {
          // Push state back if user cancels
          window.history.pushState(null, '', window.location.href);
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      // Push a state to detect back button
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [roomCode, gameState]);

  return (
    <div className="min-h-screen w-full">
      {showLoading ? (
        <div className="loading-container">
          <div className="loading-image-container">
            <img 
              src={logoImage}
              alt="Curious Cats Logo" 
              className="loading-image"
            />
          </div>
        </div>
      ) : showRules ? (
        <div className="rules-container">
          <div className="rules-box">
            <h2 className="rules-title">How to Play</h2>
            <div className="rules-content">
              <p>Welcome to Curious Cats! Here are the rules:</p>
              
              <ol>
                <li>Create a room and share the code with your friends</li>
                <li>Submit questions about other players each round</li>
                <li>Everyone votes on their favorite questions</li>
                <li>Selected players must answer truthfully</li>
                <li>Earn points for good questions and correct guesses</li>
              </ol>
              
              <p>Stay curious, be kind. The goal is to have fun <i>and</i> learn something new about each other.</p>
            </div>
            <button 
              onClick={handleRulesComplete}
              className="rules-button"
            >
              {'>'}Create Room{'<'}
            </button>
          </div>
        </div>
      ) : showGameSetup ? (
        renderGameSetup()
      ) : gameState === 'finished' ? (
        renderGameOver()
      ) : (
        <>
          {renderQuestionPhase()}
          {renderVotingPhase()}
          {renderGuessingPhase()}
        </>
      )}
    </div>
  );
}

export default Host;
