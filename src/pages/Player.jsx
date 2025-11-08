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
      setJoinStatus('Successfully joined! Waiting for game to start...');
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
    if (question.length > 150) {  // Changed from 200 to 150
      setError('Question must be 150 characters or less');
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
      <div className="flex flex-col items-center justify-center min-h-screen px-2 py-6 bg-[#F8F4F0]">
        <div className="w-full max-w-md mx-auto rounded-2xl shadow-lg bg-[#B96759] p-4">
          <h2 className="text-2xl font-bold text-white text-center mb-4">Round {currentRound}</h2>
          <form onSubmit={handleSubmitQuestion} className="space-y-4">
            <div>
              <label className="block mb-2 text-white">Question:</label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Enter your question..."
                className="w-full p-3 rounded-lg bg-white text-[#B96759] text-lg focus:outline-none focus:ring-2 focus:ring-[#B96759]"
                maxLength={150}
              />
              <span className="block text-right text-xs text-white mt-1">{question.length}/150</span>
            </div>
            <div>
              <label className="block mb-2 text-white">Ask this question to:</label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full p-3 rounded-lg bg-white text-[#B96759] text-lg focus:outline-none"
              >
                <option value="">Select a player...</option>
                {availablePlayers.map(player => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-500 text-center">{error}</p>}
            <button 
              type="submit"
              className="w-full py-3 mt-2 rounded-xl bg-white text-[#B96759] font-bold text-lg shadow hover:bg-[#F8F4F0] transition"
            >
              Submit Question
            </button>
          </form>
        </div>
      </div>
    );
  };

  const renderWaitingForOthers = () => {
    if (!hasSubmitted || gameState !== 'playing') return null;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-2 py-6 bg-[#F8F4F0]">
        <div className="w-full max-w-md mx-auto rounded-2xl shadow-lg bg-[#B96759] p-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Round {currentRound}</h2>
          <div className="bg-white rounded-xl p-6 mt-2">
            <h3 className="text-xl font-semibold text-[#B96759] mb-2">Question Submitted!</h3>
            <p className="text-[#B96759]">Waiting for other players to submit their questions...</p>
          </div>
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

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-2 py-6 bg-[#F8F4F0]">
        <div className="w-full max-w-md mx-auto rounded-2xl shadow-lg bg-[#B96759] p-4">
          <h2 className="text-2xl font-bold text-white text-center mb-4">Round {currentRound}</h2>
          <div className="bg-white rounded-xl p-6 mt-2">
            {!hasVoted ? (
              <>
                <h3 className="text-xl font-semibold text-[#B96759] mb-2">Vote for Your Favorite Question!</h3>
                {displayedQuestions.length > 0 ? (
                  <div className="space-y-3">
                    {displayedQuestions.map((question) => (
                      <button
                        key={question.id}
                        onClick={() => handleVote(question.id)}
                        className="w-full py-3 px-2 rounded-lg bg-[#B96759] text-white font-bold text-left shadow hover:bg-[#98483A] transition"
                      >
                        <span className="block text-lg">{question.targetPlayer}, {formatQuestion(question.text)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[#B96759]">No questions available to vote on</p>
                )}
              </>
            ) : (
              <div>
                <h3 className="text-xl font-semibold text-[#B96759] mb-2">Vote Submitted!</h3>
                <p className="text-[#B96759]">
                  Waiting for other players to vote... ({totalVotes} of {players.length} votes)
                </p>
              </div>
            )}
          </div>
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

    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-2 py-6 bg-[#F8F4F0]">
        <div className="w-full max-w-md mx-auto rounded-2xl shadow-lg bg-[#B96759] p-4">
          <h2 className="text-2xl font-bold text-white text-center mb-4">Round {currentRound}</h2>
          {isAnswering ? (
            <div className="bg-white rounded-xl p-6 mt-2">
              <h3 className="text-xl font-semibold text-[#B96759] mb-2">Answer your question</h3>
              <p className="text-[#B96759] text-lg mb-4">{selectedQuestion}</p>
              {isOwnQuestion ? (
                <div className="mt-2">
                  {!showGuessPrompt ? (
                    <p className="text-[#B96759] text-lg mb-2">Reading the question...</p>
                  ) : (
                    <>
                      <p className="text-[#B96759] text-lg mb-2">You wrote this question! No guessing!</p>
                      <button 
                        onClick={() => {
                          socket.emit('skip_guess', { roomCode });
                          setShowTransitionScreen(true);
                        }}
                        className="w-full py-3 mt-2 rounded-xl bg-[#B96759] text-white font-bold text-lg shadow hover:bg-[#98483A] transition"
                      >
                        Next
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <>
                  {showGuessPrompt && !showPlayerSelection && (
                    <div className="mt-2">
                      <p className="text-[#B96759] text-lg mb-2">Would you like to guess who asked you this question?</p>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleGuessChoice(true)}
                          className="w-1/2 py-3 rounded-xl bg-[#B96759] text-white font-bold text-lg shadow hover:bg-[#98483A] transition"
                        >
                          Yes
                        </button>
                        <button 
                          onClick={() => handleGuessChoice(false)}
                          className="w-1/2 py-3 rounded-xl bg-[#B96759] text-white font-bold text-lg shadow hover:bg-[#98483A] transition"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                  {showPlayerSelection && (
                    <div className="mt-2">
                      <select
                        value={guessedPlayer}
                        onChange={(e) => setGuessedPlayer(e.target.value)}
                        className="w-full p-3 rounded-lg bg-[#B96759] text-white text-lg mb-2"
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
                      <button 
                        onClick={handleGuessSubmit}
                        disabled={!guessedPlayer}
                        className="w-full py-3 mt-2 rounded-xl bg-[#B96759] text-white font-bold text-lg shadow hover:bg-[#98483A] transition disabled:opacity-50"
                      >
                        Submit Guess
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            !showTransitionScreen && (
              <div className="bg-white rounded-xl p-6 mt-2 text-center">
                <h3 className="text-xl font-semibold text-[#B96759] mb-2">Question being answered</h3>
                <p className="text-[#B96759] text-lg mb-2">{targetPlayer?.name || "Another player"} is answering their question...</p>
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
      <div className="flex flex-col items-center justify-center min-h-screen px-2 py-6 bg-[#F8F4F0]">
        <div className="w-full max-w-md mx-auto rounded-2xl shadow-lg bg-[#B96759] p-4 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Round {currentRound}</h2>
          <div className="bg-white rounded-xl p-6 mt-2">
            <h3 className="text-xl font-semibold text-[#B96759] mb-2">Please Look at the Main Screen</h3>
            <p className="text-[#B96759]">Waiting for next round to begin...</p>
          </div>
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
      <div className="p-8">
        <h2 className="text-2xl mb-4">Previous Session Found</h2>
        <div className="bg-gray-800 p-4 rounded mb-4">
          <p>Room Code: <span className="font-mono font-bold">{storedRoom}</span></p>
          <p>Player Name: <span className="font-bold">{storedName}</span></p>
        </div>
        <div className="space-y-4">
          <button
            onClick={() => {
              setIsReconnecting(true);
              connectSocket();  // Connect socket before attempting reconnection
              socket.emit('attempt_reconnect', {
                playerName: storedName,
                roomCode: storedRoom
              });
            }}
            className="w-full bg-blue-600 px-6 py-2 rounded"
          >
            Rejoin Previous Game
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
            className="w-full bg-gray-600 px-6 py-2 rounded"
          >
            Join New Game
          </button>
        </div>
        {error && <p className="text-red-500 mt-4">{error}</p>}
      </div>
    );
  }

  // Show join form if no stored data or user chose to join new game
  if (!joined && !isReconnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <form onSubmit={handleJoin} className="flex flex-col items-center" style={{ width: '100%' }}>
          <div className="w-full flex flex-col items-center">
            <label
              className="self-start"
              style={{ fontFamily: 'MADE Gentle, sans-serif', fontSize: 32, marginLeft: '8vw' }}
            >
              Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder=""
              maxLength={15}
              className="mt-2"
              style={{
                width: '50vw',
                background: '#FFFFFF',
                borderRadius: 15,
                padding: '12px',
                boxSizing: 'border-box'
              }}
            />

            <label
              className="self-start"
              style={{ fontFamily: 'MADE Gentle, sans-serif', fontSize: 32, marginLeft: '8vw', marginTop: 20 }}
            >
              Code
            </label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Enter the room code"
              maxLength={4}
              className="mt-2"
              style={{
                width: '50vw',
                background: '#FFFFFF',
                borderRadius: 15,
                padding: '12px',
                boxSizing: 'border-box',
                textTransform: 'uppercase'
              }}
            />

            {error && <p className="text-red-500 mt-3">{error}</p>}

            <button
              type="submit"
              className="mt-6"
              style={{
                width: '33.333vw',
                borderRadius: 20,
                fontFamily: 'Momentz, sans-serif',
                fontSize: 20,
                color: '#B96759',
                background: 'white',
                padding: '10px 0'
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
    return (
      <div className="p-8">
        <h2 className="text-2xl mb-4">Game Lobby</h2>
        <p className="text-green-500 mb-4">{joinStatus}</p>
        <div className="bg-gray-800 p-4 rounded">
          <p>Room Code: <span className="font-mono font-bold">{roomCode}</span></p>
          <p>Your Name: <span className="font-bold">{playerName}</span></p>
        </div>
      </div>
    );
  }

  // Add a loading state for reconnection
  if (isReconnecting) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl mb-4">Reconnecting...</h2>
        <p>Attempting to rejoin the game...</p>
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
