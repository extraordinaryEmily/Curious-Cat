import { useState, useEffect } from 'react';
import { socket, storePlayerData, clearPlayerData } from '../socket';

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
      socket.off('reconnect_failed');
      socket.off('player_disconnected');
      socket.off('player_reconnected');
      socket.off('rejoin_game_in_progress');
    };
  }, [roomCode, isAnswering]);

  const handleJoin = (e) => {
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

    // Store player data when joining
    storePlayerData(playerName.trim(), roomCode.toUpperCase());
    
    socket.emit('join_room', { 
      roomCode: roomCode.toUpperCase(), 
      playerName: playerName.trim() 
    });
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
      <div className="text-center">
        <h1 className="text-4xl mb-8">Round {currentRound}</h1>
        <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
          <h2 className="text-2xl mb-6">Submit Your Question</h2>
          <form onSubmit={handleSubmitQuestion} className="space-y-6">
            <div>
              <label className="block mb-2">Question:</label>
              <div className="relative">
                <input
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Enter your question..."
                  className="w-full p-3 bg-gray-700 rounded"
                  maxLength={150}  // Changed from 200 to 150
                />
                <span className="absolute right-2 bottom-2 text-sm text-gray-400">
                  {question.length}/150  {/* Changed from 200 to 150 */}
                </span>
              </div>
            </div>
            <div>
              <label className="block mb-2">Ask this question to:</label>
              <select
                value={selectedTarget}
                onChange={(e) => setSelectedTarget(e.target.value)}
                className="w-full p-3 bg-gray-700 rounded"
              >
                <option value="">Select a player...</option>
                {availablePlayers.map(player => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            {error && <p className="text-red-500">{error}</p>}
            <button 
              type="submit"
              className="bg-blue-600 px-6 py-3 rounded-lg w-full hover:bg-blue-700 transition"
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
      <div className="text-center">
        <h1 className="text-4xl mb-8">Round {currentRound}</h1>
        <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
          <h2 className="text-2xl mb-4">Question Submitted!</h2>
          <p className="text-gray-400">Waiting for other players to submit their questions...</p>
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
      <div className="text-center">
        <h1 className="text-4xl mb-8">Round {currentRound}</h1>
        <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
          {!hasVoted ? (
            <>
              <h2 className="text-2xl mb-6">Vote for Your Favorite Question!</h2>
              {displayedQuestions.length > 0 ? (
                <div className="space-y-4">
                  {displayedQuestions.map((question) => (
                    <button
                      key={question.id}
                      onClick={() => handleVote(question.id)}
                      className="w-full p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-left"
                    >
                      <p className="text-lg">
                        {question.targetPlayer}, {formatQuestion(question.text)}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No questions available to vote on</p>
              )}
            </>
          ) : (
            <div>
              <h2 className="text-2xl mb-4">Vote Submitted!</h2>
              <p className="text-gray-400">
                Waiting for other players to vote... ({totalVotes} of {players.length} votes)
              </p>
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

    return (
      <div className="text-center">
        <h1 className="text-4xl mb-8">Round {currentRound}</h1>
        {isAnswering ? (
          <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
            <h2 className="text-2xl mb-4">Answer your question</h2>
            <p className="text-xl mb-6">{selectedQuestion}</p>
            
            {isOwnQuestion ? (
              <div className="mt-6">
                {!showGuessPrompt ? (
                  <p className="text-xl mb-4">Reading the question...</p>
                ) : (
                  <>
                    <p className="text-xl mb-4">You wrote this question! No guessing!</p>
                    <button 
                      onClick={() => {
                        socket.emit('skip_guess', { roomCode });
                        setShowTransitionScreen(true);
                      }}
                      className="bg-blue-600 px-6 py-2 rounded-lg hover:bg-blue-700 transition"
                    >
                      Next
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {showGuessPrompt && !showPlayerSelection && (
                  <div className="mt-6">
                    <p className="text-xl mb-4">Would you like to guess who asked you this question?</p>
                    <div className="space-x-4">
                      <button 
                        onClick={() => handleGuessChoice(true)}
                        className="bg-green-600 px-6 py-2 rounded-lg hover:bg-green-700 transition"
                      >
                        Yes
                      </button>
                      <button 
                        onClick={() => handleGuessChoice(false)}
                        className="bg-red-600 px-6 py-2 rounded-lg hover:bg-red-700 transition"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}

                {showPlayerSelection && (
                  <div className="mt-6">
                    <select
                      value={guessedPlayer}
                      onChange={(e) => setGuessedPlayer(e.target.value)}
                      className="w-full p-3 bg-gray-700 rounded mb-4"
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
                      className="bg-blue-600 px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      Submit Guess
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          // Only show this if transition screen is not showing
          !showTransitionScreen && (
            <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
              <h2 className="text-2xl mb-4">Question being answered</h2>
              <p className="text-xl mb-4">
                {targetPlayer?.name || "Another player"} is answering their question...
              </p>
            </div>
          )
        )}
      </div>
    );
  };

  const renderTransitionScreen = () => {
    if (!showTransitionScreen) return null;

    return (
      <div className="text-center">
        <h1 className="text-4xl mb-8">Round {currentRound}</h1>
        <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
          <h2 className="text-2xl mb-4">Please Look at the Main Screen</h2>
          <p className="text-gray-400">Waiting for next round to begin...</p>
        </div>
      </div>
    );
  };

  if (!joined) {
    return (
      <div className="p-8">
        <h1 className="text-3xl mb-6">Join Game</h1>
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block mb-2">Room Code:</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full p-2 bg-gray-800 rounded"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block mb-2">Your Name:</label>
            <div className="relative">
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full p-2 bg-gray-800 rounded"
                maxLength={15}
              />
              <span className="absolute right-2 bottom-2 text-sm text-gray-400">
                {playerName.length}/15
              </span>
            </div>
          </div>
          {error && <p className="text-red-500">{error}</p>}
          <button 
            type="submit" 
            className="bg-blue-600 px-6 py-2 rounded"
          >
            Join Game
          </button>
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
