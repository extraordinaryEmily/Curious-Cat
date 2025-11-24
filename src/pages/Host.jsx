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
                    disabled={players.length < 2}
                    className={`
                      start-button
                      w-full px-6 py-3
                      text-xl font-bold
                      rounded-xl
                      transition-all
                      ${players.length < 2 
                        ? 'bg-white/20 cursor-not-allowed' 
                        : 'bg-white text-[#B96759] hover:bg-white/90'}
                    `}
                  >
                    {players.length < 2 ? 'Waiting for Players...' : 'Start Game'}
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
          <h2 className="player-list-title text-center" style={{ fontFamily: 'MADE Gentle, sans-serif' }}>Round {currentRound}</h2>
          <div className="p-6 rounded-lg mt-4 shadow" style={{ background: '#B96759', fontFamily: 'MADE Gentle, sans-serif' }}>
            <h3 className="text-2xl mb-4">Players Submitting Questions</h3>
            <div className="flex flex-col gap-3">
              {players.map(player => (
                <div 
                  key={player.id} 
                  className={`p-3 rounded-lg flex items-center justify-between ${
                    submittedPlayers.has(player.name) 
                      ? 'bg-green-800' 
                      : 'bg-gray-700'
                  }`}
                  style={{ fontFamily: 'MADE Gentle, sans-serif' }}
                >
                  <span className="text-lg">{sanitizeForDisplay(player.name)}</span>
                  {submittedPlayers.has(player.name) && (
                    <span className="text-2xl ml-2">✓</span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-lg">
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
          <h2 className="player-list-title text-center" style={{ fontFamily: 'MADE Gentle, sans-serif' }}>Round {currentRound}</h2>
          <div className="p-6 rounded-lg mt-4 shadow" style={{ background: '#B96759', fontFamily: 'MADE Gentle, sans-serif' }}>
            <h3 className="text-2xl mb-4">Vote for Your Favorite Question!</h3>
            <div className="flex flex-col gap-4">
              {displayedQuestions.map((question) => (
                <div key={question.id} className="bg-gray-700 p-4 rounded-lg flex items-center" style={{ fontFamily: 'MADE Gentle, sans-serif' }}>
                  <p className="text-xl mb-0 font-bold">
                    Question {question.questionNumber || 1}: <span className="text-lg font-normal">{sanitizeForDisplay(question.targetPlayer)}, {sanitizeForDisplay(formatQuestion(question.text))}</span>
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
          <div className="bg-[#B96759] p-6 rounded-lg mt-4 shadow" style={{ flex: '1', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {targetPlayer && selectedQuestion && (
              <div className="text-center" style={{ width: '100%', flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
                <p 
                  className="mb-3"
                  style={{ 
                    fontSize: 'clamp(28px, 4vw, 48px)',
                    fontFamily: 'MADE Gentle, sans-serif',
                    textAlign: 'center',
                    color: '#FFFFFF',
                    lineHeight: '1.2',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 8,
                    WebkitBoxOrient: 'vertical'
                  }}
                >
                  {sanitizeForDisplay(addQuotations(`${typeof targetPlayer === 'string' ? targetPlayer : targetPlayer.name}, ${formatQuestion(selectedQuestion)}`))}
                </p>
              </div>
            )}
            {guessStatus && (
              <div className="text-center" style={{ width: '100%', marginTop: '16px', flexShrink: 0 }}>
                <p 
                  className="text-xl text-yellow-400 text-center"
                  style={{
                    margin: 0,
                    fontFamily: 'MADE Gentle, sans-serif'
                  }}
                >
                  {guessStatus}
                </p>
              </div>
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
          <h2 className="player-list-title text-center" style={{ fontFamily: 'MADE Gentle, sans-serif' }}>Game Over</h2>
          
          {/* Winner Section */}
          <div className="p-6 rounded-lg mt-4 shadow" style={{ background: '#B96759', fontFamily: 'MADE Gentle, sans-serif' }}>
            <h3 className="text-2xl mb-4 text-white">Winner</h3>
            <div className="bg-yellow-800 p-6 rounded-lg mb-4">
              <p className="text-3xl font-bold text-yellow-400 mb-2">{sanitizeForDisplay(winner?.name || 'N/A')}</p>
              <p className="text-xl text-yellow-300">{winner?.score || 0} points</p>
            </div>
          </div>

          {/* All Players Scoreboard */}
          <div className="p-6 rounded-lg mt-4 shadow" style={{ background: '#B96759', fontFamily: 'MADE Gentle, sans-serif' }}>
            <h3 className="text-2xl mb-4 text-white">Final Scoreboard</h3>
            <div className="flex flex-col gap-3">
            {sortedPlayers.map((player, index) => (
              <div 
                key={player.id} 
                className={`p-4 rounded-lg flex items-center justify-between ${
                  index === 0 ? 'bg-yellow-800/50' : 'bg-gray-700'
                }`}
                style={{ fontFamily: 'MADE Gentle, sans-serif' }}
              >
                <div className="flex items-center">
                  <span className="text-xl font-bold mr-2 text-white">
                    #{index + 1} {sanitizeForDisplay(player.name)}
                  </span>
                </div>
                <span className="text-lg font-bold text-yellow-400">{player.score} points</span>
              </div>
            ))}
            </div>
          </div>

          {/* Bonuses Breakdown */}
          {bonuses && bonuses.length > 0 && (
            <div className="p-6 rounded-lg mt-4 shadow" style={{ background: '#B96759', fontFamily: 'MADE Gentle, sans-serif' }}>
              <h3 className="text-2xl mb-4 text-white">Bonuses Awarded</h3>
              <div className="flex flex-col gap-2">
                {bonuses.map((b, i) => {
                  const bonusPlayer = players.find(p => p.id === b.playerId);
                  const bonusName = b.type.replace(/_/g, ' ').charAt(0).toUpperCase() + b.type.replace(/_/g, ' ').slice(1);
                  return (
                    <div key={i} className="bg-gray-700 p-3 rounded-lg">
                      <p className="text-lg text-yellow-300">
                        <strong>{bonusName}</strong>: +{b.amount} pts to <strong>{sanitizeForDisplay(bonusPlayer?.name || 'N/A')}</strong>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Play Again Button */}
          {/* Play Again Button */}
          <div className="mt-6">
            <button 
              onClick={() => window.location.reload()}
              className={`
                start-button
                w-full px-6 py-3
                text-xl font-bold
                rounded-xl
                transition-all
                bg-white text-[#B96759] hover:bg-white/90
              `}
              style={{ fontFamily: 'MADE Gentle, sans-serif' }}
            >
              Play Again
            </button>
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

  // Add reload warning when game is active
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

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
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
