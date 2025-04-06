import { useEffect, useState } from 'react';
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
      setCurrentRound(round);
      setTargetPlayer(targetPlayer);
      setCurrentPhase('question');
      setSelectedQuestion(null);
    });

    socket.on('game_ended', ({ players, finalScores }) => {
      setGameState('finished');
      setPlayers(players);
    });

    socket.on('question_submitted', ({ playerName }) => {
      setSubmittedPlayers(prev => new Set([...prev, playerName]));
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
    };
  }, []);

  const startGame = () => {
    if (players.length >= 2) {
      socket.emit('start_game', { roomCode });
    }
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

  console.log('[Host] Current players in render:', players);

  const renderWaitingRoom = () => {
    if (gameState !== 'waiting') return null;
    
    return (
      <>
        <div className="bg-gray-800 p-6 rounded-lg mb-6">
          <h2 className="text-2xl mb-2">Room Code:</h2>
          <p className="text-4xl font-mono font-bold text-green-500">{roomCode}</p>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl mb-4">Players ({players.length}):</h2>
          <div className="grid grid-cols-2 gap-4">
            {players.map(player => (
              <div key={player.id} className="bg-gray-800 p-4 rounded-lg">
                <p>Name: {player.name}</p>
                <p>Score: {player.score}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={startGame}
          disabled={players.length < 2}
          className="bg-green-600 px-6 py-3 rounded-lg disabled:opacity-50"
        >
          Start Game
        </button>
      </>
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

    // Add debug logging
    console.log('Target Player:', targetPlayer);
    console.log('Selected Question:', selectedQuestion);

    return (
      <div className="text-center">
        <h1 className="text-4xl mb-8">Round {currentRound}</h1>
        <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
          <p className="text-lg">
            {targetPlayer && selectedQuestion && (
              <>
                {typeof targetPlayer === 'string' ? targetPlayer : targetPlayer.name}, {formatQuestion(selectedQuestion)}
              </>
            )}
          </p>
        </div>
      </div>
    );
  };

  const renderGameOver = () => {
    if (gameState !== 'finished') return null;

    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    
    return (
      <div className="text-center">
        <h1 className="text-4xl mb-8">Game Over!</h1>
        <div className="bg-gray-800 p-8 rounded-lg max-w-2xl mx-auto">
          <h2 className="text-2xl mb-6">Final Scores</h2>
          <div className="space-y-4">
            {sortedPlayers.map((player, index) => (
              <div 
                key={player.id} 
                className={`p-4 rounded-lg ${index === 0 ? 'bg-yellow-800' : 'bg-gray-700'}`}
              >
                <p className="text-xl">
                  {index + 1}. {player.name} - {player.score} points
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-8">
      {!roomCode && (
        <div className="mb-6">
          <h2 className="text-2xl mb-4">Select Number of Rounds</h2>
          <div className="flex items-center gap-4">
            <input 
              type="range" 
              min="3" 
              max="20" 
              value={numberOfRounds}
              onChange={(e) => setNumberOfRounds(parseInt(e.target.value))}
              className="w-full"
            />
            <span className="text-xl font-bold min-w-[3rem]">{numberOfRounds}</span>
          </div>
          <p className="text-gray-400 mt-2">Each round includes question submission, voting, and guessing phases</p>
          <button 
            onClick={handleCreateRoom}
            className="bg-green-600 px-6 py-3 rounded-lg mt-4 hover:bg-green-700 transition"
          >
            Create Room
          </button>
        </div>
      )}
      
      {renderWaitingRoom()}
      {renderQuestionPhase()}
      {renderVotingPhase()}
      {renderGuessingPhase()}
      {renderGameOver()}
    </div>
  );
}

export default Host;















