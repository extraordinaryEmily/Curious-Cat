import { useState, useEffect } from 'react';
import '../logo-animation.css';
import '../loading-screen.css';
import '../rules-screen.css';
import logoImage from '../LOGO.png';
import { socket } from '../socket';

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

    socket.on('player_joined', ({ players }) => {
      console.log('[Host] Players updated:', players);
      console.log('[Host] Player names:', players.map(p => p.name));
      setPlayers(players);
    });

    socket.on('player_left', ({ players }) => {
      setPlayers(players);
    });

    socket.on('game_started', ({ round }) => {
      setGameState('playing');
      setCurrentRound(round);
      setCurrentPhase('question');
      setTargetPlayer(null); // Clear target player as it will be set later
    });

    socket.on('voting_phase', ({ questions }) => {
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

    socket.on('game_ended', ({ players, finalScores }) => {
      setGameState('finished');
      setPlayers(players);
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
    console.log('[Host] Emitting start_game event:', roomCode);
    socket.emit('start_game', { roomCode });
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

  const handleCreateRoom = () => {
    if (isCreatingRoom || roomCode) {
      console.log('[Host] Room creation already in progress or room exists');
      return;
    }

    console.log('[Host] Attempting to create room with number of rounds:', numberOfRounds);
    setIsCreatingRoom(true);
    socket.emit('create_room', { numberOfRounds });
  };

  const handleRulesComplete = () => {
    setShowRules(false);
    setShowGameSetup(true);
  };

  const renderGameSetup = () => {
    return (
      <div className="p-4 sm:p-6 md:p-8 lg:p-12">
        <div className="max-w-2xl mx-auto rounded-2xl shadow-xl p-6 sm:p-8 md:p-10 bg-gray-800 fade-in">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-8 text-center">
            Host a New Game
          </h1>
          
          <div className="space-y-8">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-white">
                Select Number of Rounds
              </h2>
              <div className="flex items-center gap-4 p-4 rounded-xl">
                <input 
                  type="range" 
                  min="3" 
                  max="20" 
                  value={numberOfRounds}
                  onChange={(e) => setNumberOfRounds(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-2xl font-bold text-white min-w-[3rem]">
                  {numberOfRounds}
                </span>
              </div>
            </div>

            <div className="bg-gray-700 p-6 rounded-lg mb-6">
              <h2 className="text-2xl mb-2">Room Code:</h2>
              <p className="text-4xl font-mono font-bold text-green-500">{roomCode}</p>
            </div>

            <div className="mb-6">
              <h2 className="text-2xl mb-4">Players ({players.length}):</h2>
              <div className="grid grid-cols-2 gap-4">
                {players.map(player => (
                  <div key={player.id} className="bg-gray-700 p-4 rounded-lg">
                    <p>Name: {player.name}</p>
                    <p>Score: {player.score}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartGame}
              disabled={players.length < 2}
              className={`
                w-full
                px-8 py-4
                text-xl
                font-semibold
                rounded-xl
                transition-all
                transform
                hover:scale-105
                focus:outline-none
                focus:ring-4
                focus:ring-opacity-50
                ${players.length < 2 
                  ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                  : 'bg-green-600 hover:bg-green-700'}
              `}
            >
              {players.length < 2 ? 'Waiting for Players...' : 'Start Game'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionPhase = () => {
    if (currentPhase !== 'question') return null;

    return (
      <div className="text-center">
        <h1 className="text-4xl mb-8">Round {currentRound}</h1>
        <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
          <h2 className="text-2xl mb-6">Players Submitting Questions</h2>
          <div className="grid grid-cols-2 gap-4">
            {players.map(player => (
              <div 
                key={player.id} 
                className={`p-4 rounded-lg ${
                  submittedPlayers.has(player.name) 
                    ? 'bg-green-800' 
                    : 'bg-gray-700'
                }`}
              >
                <p className="text-lg">{player.name}</p>
                {submittedPlayers.has(player.name) && (
                  <span className="text-2xl">✓</span>
                )}
              </div>
            ))}
          </div>
          <p className="mt-6 text-xl">
            {submittedPlayers.size} of {players.length} players have submitted
          </p>
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
      <div className="text-center">
        <h1 className="text-4xl mb-8">Round {currentRound}</h1>
        <div className="bg-gray-800 p-8 rounded-lg">
          <h2 className="text-2xl mb-6">Vote for Your Favorite Question!</h2>
          <div className="grid grid-cols-2 gap-6">
            {displayedQuestions.map((question, index) => (
              <div key={question.id} className="bg-gray-700 p-6 rounded-lg">
                <p className="text-xl mb-3">Question {index + 1}</p>
                <p className="text-lg mb-2">
                  {question.targetPlayer}, {formatQuestion(question.text)}
                </p>
              </div>
            ))}
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

    return (
      <div className="text-center">
        <h1 className="text-4xl mb-8">Round {currentRound}</h1>
        <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
          <p className="text-lg mb-4">
            {targetPlayer && selectedQuestion && (
              <>
                {typeof targetPlayer === 'string' ? targetPlayer : targetPlayer.name}, {formatQuestion(selectedQuestion)}
              </>
            )}
          </p>
          {/* Add status message */}
          {guessStatus && (
            <p className="text-xl mt-4 text-yellow-400">
              {guessStatus}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderGameOver = () => {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
  
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-4xl w-full">
          <h1 className="text-6xl mb-8 text-yellow-500 font-bold">Game Over!</h1>
        
          {/* Winner Section */}
          <div className="mb-12">
            <div className="bg-yellow-800 p-8 rounded-lg mb-8">
              <h2 className="text-3xl mb-2">Winner</h2>
              <p className="text-4xl font-bold text-yellow-400">{winner.name}</p>
              <p className="text-2xl text-yellow-300">{winner.score} points</p>
            </div>
          </div>

          {/* All Players Scoreboard */}
          <div className="bg-gray-800 p-8 rounded-lg">
            <h2 className="text-3xl mb-6">Final Scoreboard</h2>
            <div className="space-y-4 max-w-2xl mx-auto">
              {sortedPlayers.map((player, index) => (
                <div 
                  key={player.id} 
                  className={`p-6 rounded-lg flex items-center justify-between
                    ${index === 0 ? 'bg-yellow-800/50' : 'bg-gray-700'}
                    ${index === 1 ? 'bg-gray-600' : ''}
                    ${index === 2 ? 'bg-gray-500' : ''}`}
                >
                  <div className="flex items-center">
                    <span className="text-2xl font-bold mr-4">#{index + 1}</span>
                    <span className="text-xl">{player.name}</span>
                  </div>
                  <span className="text-xl font-bold">{player.score} points</span>
                </div>
              ))}
            </div>
          </div>

          {/* Play Again Button */}
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 bg-green-600 px-8 py-4 rounded-lg text-xl hover:bg-green-700 transition"
          >
            Play Again
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (showGameSetup && !roomCode) {
      socket.emit('create_room', { numberOfRounds });
    }
  }, [showGameSetup]);

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
              Welcome to Curious Cats! Here's a quick guide to get you started:
              
              1. Create a room and share the code with your friends
              2. Each round, players submit questions about other players
              3. Everyone votes on their favorite questions
              4. Selected players must answer truthfully
              5. Points are awarded for good questions and correct guesses
              
              Remember to keep questions fun and appropriate. The goal is to learn interesting things about each other while having a great time!
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
