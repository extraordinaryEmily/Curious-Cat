const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Vite's default port
    methods: ["GET", "POST"]
  },
  // Enable connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 1000 * 60 * 10, // 10 minutes
  }
});

io.engine.on("connection_error", (err) => {
  console.log("[Server] Connection error:", err);
});

const rooms = new Map();

// Add a map to store player data
const playerData = new Map(); // stores player name and room code

// Add this to store original players for each room
const originalPlayers = new Map();

const MAX_PLAYERS = 10;
const MAX_NAME_LENGTH = 15;
const MAX_QUESTION_LENGTH = 150;  // Changed from 200 to 150

io.on("connection", (socket) => {
  console.log(`[Server] New socket connection: ${socket.id}`);

  socket.on("error", (error) => {
    console.log("[Server] Socket error:", error);
  });

  socket.onAny((eventName, ...args) => {
    console.log(`[Server] Received event '${eventName}':`, args);
  });

  socket.on("store_player_data", ({ playerName, roomCode }) => {
    playerData.set(socket.id, { playerName, roomCode });
  });

  socket.on("attempt_reconnect", ({ playerName, roomCode }) => {
    console.log(`[Server] Reconnection attempt:`, { playerName, roomCode });
    
    const room = rooms.get(roomCode);
    if (!room) {
      socket.emit("reconnect_failed", "Room no longer exists");
      return;
    }

    // Check if player was in this room
    const existingPlayer = room.players.find(p => 
      p.name.toLowerCase() === playerName.toLowerCase()
    );

    if (!existingPlayer) {
      socket.emit("reconnect_failed", "Player not found in room");
      return;
    }

    // Update the player's new socket ID
    existingPlayer.id = socket.id;
    room.scores[socket.id] = room.scores[existingPlayer.id] || 0;
    
    // Join the socket to the room
    socket.join(roomCode);
    
    // Store the player data again
    playerData.set(socket.id, { playerName, roomCode });

    // Send current game state to reconnected player
    socket.emit("reconnect_success", {
      gameState: room.gameState,
      currentRound: room.currentRound,
      currentPhase: room.currentPhase,
      players: room.players,
      scores: room.scores,
      selectedQuestion: room.selectedQuestion,
      targetPlayer: room.targetPlayer
    });

    // Notify other players
    socket.to(roomCode).emit("player_reconnected", {
      playerName,
      players: room.players
    });
  });

  socket.on("create_room", ({ numberOfRounds }) => {
    console.log(`[Server] Create room request from socket: ${socket.id}`);
    const roomCode = generateRoomCode();
    console.log(`[Server] Generated room code: ${roomCode}`);
    
    const newRoom = {
      host: socket.id,
      players: [],
      gameState: "waiting",
      numberOfRounds: numberOfRounds,
      currentRound: 0,
      currentPhase: "waiting",
      questions: [],
      votes: {},
      scores: {},
      selectedPlayer: null,
      displayedQuestions: []
    };
    
    rooms.set(roomCode, newRoom);
    socket.join(roomCode);
    console.log(`[Server] Room created: ${roomCode} with ${numberOfRounds} rounds`);
    console.log(`[Server] Host ID: ${socket.id}`);
    socket.emit("room_created", roomCode);
  });

  socket.on("join_room", ({ roomCode, playerName }) => {
    console.log('\n[Server] === JOIN ROOM ===');
    console.log('[Server] Join attempt:', { roomCode, playerName, socketId: socket.id });
    
    if (!roomCode) {
        console.log('2. Error: No room code provided');
        socket.emit("join_error", "Room code is required");
        return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
        console.log('3. Error: Room not found');
        socket.emit("join_error", "Room not found");
        return;
    }

    console.log('[Server] Room state:', room.gameState);
    
    if (room.gameState !== "waiting") {
        const origPlayers = originalPlayers.get(roomCode);
        console.log('[Server] Game in progress, checking original players:', origPlayers);

        const wasOriginalPlayer = origPlayers && origPlayers.some(p => 
            p.name.toLowerCase() === playerName.toLowerCase()
        );

        console.log('[Server] Was original player?', wasOriginalPlayer);

        if (!wasOriginalPlayer) {
            console.log('[Server] Rejecting non-original player');
            socket.emit("join_error", "Game already in progress");
            return;
        }

        // Get original player data
        const originalPlayer = origPlayers.find(p => 
            p.name.toLowerCase() === playerName.toLowerCase()
        );

        // Remove existing player if any
        room.players = room.players.filter(p => 
            p.name.toLowerCase() !== playerName.toLowerCase()
        );

        // Add player back
        const rejoiningPlayer = {
            id: socket.id,
            name: originalPlayer.name,  // Preserve original name casing
            score: originalPlayer.score || 0
        };
        
        room.players.push(rejoiningPlayer);
        room.scores[socket.id] = rejoiningPlayer.score;
        
        socket.join(roomCode);
        playerData.set(socket.id, { playerName, roomCode });
        
        console.log('[Server] Player rejoined:', rejoiningPlayer);
        
        socket.emit("join_success");
        io.to(roomCode).emit("player_joined", { players: room.players });
        
        socket.emit("rejoin_game_in_progress", {
            gameState: room.gameState,
            currentRound: room.currentRound,
            currentPhase: room.currentPhase,
            players: room.players,
            targetPlayer: room.targetPlayer,
            selectedQuestion: room.selectedQuestion,
            displayedQuestions: room.displayedQuestions || []
        });

        return;
    }

    // Normal join logic for waiting room...
    try {
        socket.join(roomCode);
        const player = {
            id: socket.id,
            name: playerName,
            score: 0
        };
        
        room.players.push(player);
        room.scores[socket.id] = 0;
        
        console.log('[Server] Player joined successfully:', {
            room: roomCode,
            player: player,
            currentPlayers: room.players
        });
        
        io.to(roomCode).emit("player_joined", {
            players: room.players
        });
        
        socket.emit("join_success");
    } catch (error) {
        console.error('[Server] Error joining room:', error);
        socket.emit("join_error", "Failed to join room");
    }
  });

  socket.on("start_game", ({ roomCode }) => {
    console.log('\n[Server] === START GAME EVENT ===');
    console.log('[Server] Start game request:', { roomCode, socketId: socket.id });
    
    const room = rooms.get(roomCode);
    if (!room) {
        console.log('[Server] Room not found:', roomCode);
        return;
    }
    
    if (socket.id !== room.host) {
        console.log('[Server] Unauthorized start attempt:', {
            attemptingSocket: socket.id,
            hostSocket: room.host
        });
        return;
    }

    try {
        console.log('[Server] Pre-start game state:', {
            roomCode,
            currentPlayers: room.players,
            gameState: room.gameState
        });

        // Store original players BEFORE changing game state
        const origPlayers = JSON.parse(JSON.stringify(room.players));
        originalPlayers.set(roomCode, origPlayers);

        console.log('[Server] Stored original players:', {
            roomCode,
            players: origPlayers
        });

        // Update game state
        room.gameState = "playing";
        room.currentRound = 1;
        room.currentPhase = "question";

        // Randomly select first target player
        room.targetPlayer = room.players[Math.floor(Math.random() * room.players.length)];

        console.log('[Server] Post-start game state:', {
            roomCode,
            gameState: room.gameState,
            currentRound: room.currentRound,
            targetPlayer: room.targetPlayer,
            originalPlayers: originalPlayers.get(roomCode)
        });

        io.to(roomCode).emit("game_started", {
            round: room.currentRound,
            targetPlayer: room.targetPlayer
        });

        console.log('[Server] Game start complete');
    } catch (error) {
        console.error('[Server] Error in start_game:', error);
    }
  });

  socket.on("submit_question", ({ roomCode, question, targetPlayer, authorId }) => {
    // Add length validation
    if (question.length > MAX_QUESTION_LENGTH) {
      socket.emit("question_error", "Question must be 150 characters or less");
      return;
    }
    
    const room = rooms.get(roomCode);
    if (room && room.currentPhase === "question") {
      const playerName = room.players.find(p => p.id === socket.id)?.name;
      const targetPlayerName = room.players.find(p => p.id === targetPlayer)?.name;
      
      // Debug log 1: Initial receipt of question
      console.log('=== Question Submission Debug ===');
      console.log('1. Received data:', {
        socketId: socket.id,
        authorId,
        question,
        targetPlayer,
        playerName
      });

      // Create the question object
      const newQuestion = {
        id: uuidv4(),
        text: question,
        authorId: socket.id,  // Ensure we're setting authorId here
        authorName: playerName,
        targetPlayer: targetPlayerName
      };
      
      // Debug log 2: Question object creation
      console.log('2. Created question object:', newQuestion);
      
      room.questions.push(newQuestion);

      // Debug log 3: After adding to room.questions
      console.log('3. Room questions array:', room.questions);

      io.to(roomCode).emit("question_submitted", { playerName });

      if (room.questions.length === room.players.length) {
        room.currentPhase = "voting";
        
        let questionsToDisplay = room.questions;
        if (room.questions.length > 6) {
          questionsToDisplay = room.questions
            .sort(() => Math.random() - 0.5)
            .slice(0, 6);
        }
        
        room.displayedQuestions = questionsToDisplay;
        
        // Debug log 4: Questions being prepared for sending
        console.log('4. Questions being prepared for voting phase:');
        const mappedQuestions = questionsToDisplay.map(q => {
          const mapped = {
            id: q.id,
            text: q.text,
            targetPlayer: q.targetPlayer,
            authorId: q.authorId,
            authorName: q.authorName
          };
          console.log('Mapped question:', mapped);
          return mapped;
        });

        // Debug log 5: Final emission
        console.log('5. Final emission payload:', { questions: mappedQuestions });
        console.log('===========================');
        
        io.to(roomCode).emit("voting_phase", { questions: mappedQuestions });
      }
    }
  });

  socket.on("voting_phase", ({ questions }) => {
    const room = rooms.get(roomCode);
    if (room) {
      // Filter out the player's own question before sending
      const filteredQuestions = questions.filter(q => q.authorId !== socket.id);
      socket.emit("voting_phase", { questions: filteredQuestions });
    }
  });

  socket.on("submit_vote", ({ roomCode, questionId }) => {
    const room = rooms.get(roomCode);
    if (room && room.currentPhase === "voting") {
      // First check if this is the player's own question
      const isOwnQuestion = room.questions.find(q => q.id === questionId && q.authorId === socket.id);
      if (isOwnQuestion || room.votes[socket.id]) {
        return; // Don't allow voting for own question or voting twice
      }

      room.votes[socket.id] = questionId;

      // Find the author of the voted question and award them a point
      const votedQuestion = room.questions.find(q => q.id === questionId);
      if (votedQuestion) {
        room.scores[votedQuestion.authorId] = (room.scores[votedQuestion.authorId] || 0) + 1;
        
        // Update player scores immediately
        room.players = room.players.map(player => ({
          ...player,
          score: room.scores[player.id] || 0
        }));
        
        // Emit updated scores along with vote count
        io.to(roomCode).emit("vote_received", { 
          votesCount: Object.keys(room.votes).length,
          players: room.players 
        });
      }

      if (Object.keys(room.votes).length === room.players.length) {
        // Count votes and find winning question(s)
        const voteCount = {};
        Object.values(room.votes).forEach(id => {
          voteCount[id] = (voteCount[id] || 0) + 1;
        });
        
        const maxVotes = Math.max(...Object.values(voteCount));
        const winningQuestionIds = Object.entries(voteCount)
          .filter(([, votes]) => votes === maxVotes)
          .map(([id]) => id);
        
        const randomWinningId = winningQuestionIds[Math.floor(Math.random() * winningQuestionIds.length)];
        room.selectedQuestion = room.questions.find(q => q.id === randomWinningId);
        room.currentPhase = "guessing";

        // Add these debug logs
        console.log("Selected question:", room.selectedQuestion);
        console.log("Target player name:", room.selectedQuestion.targetPlayer);
        
        // Find the full player object
        const targetPlayerObj = room.players.find(p => p.name === room.selectedQuestion.targetPlayer);
        console.log("Found target player object:", targetPlayerObj); // Add this log

        io.to(roomCode).emit("guessing_phase", {
          question: room.selectedQuestion.text,
          targetPlayer: targetPlayerObj,
          authorId: room.selectedQuestion.authorId
        });
      }
    }
  });

  socket.on("make_guess", ({ roomCode, guessedPlayerId }) => {
    console.log('=== Make Guess Debug ===');
    const room = rooms.get(roomCode);
    
    if (!room || room.currentPhase !== 'guessing' || !room.selectedQuestion) {
        console.log('Error: Invalid game state for guessing');
        return;
    }

    // Store necessary data before any modifications
    const questionData = {
        authorId: room.selectedQuestion.authorId,
        text: room.selectedQuestion.text
    };

    const correct = guessedPlayerId === questionData.authorId;
    console.log('Guess result:', { correct, guessedPlayerId, authorId: questionData.authorId });

    // Immediately emit the guess result
    io.to(roomCode).emit("guess_result", { correct });

    // Wait before transitioning to next round
    setTimeout(() => {
        // Make sure room still exists after timeout
        const updatedRoom = rooms.get(roomCode);
        if (!updatedRoom) {
            console.log('Error: Room no longer exists after timeout');
            return;
        }

        // Update scores based on guess result
        if (correct) {
            // Answerer gets 5 points for correct guess
            updatedRoom.scores[socket.id] = (updatedRoom.scores[socket.id] || 0) + 5;
        } else {
            // Question author gets 2 points if answerer guesses wrong
            updatedRoom.scores[questionData.authorId] = (updatedRoom.scores[questionData.authorId] || 0) + 2;
        }

        // Update player scores
        updatedRoom.players = updatedRoom.players.map(player => ({
            ...player,
            score: updatedRoom.scores[player.id] || 0
        }));

        // Check if game should end
        if (updatedRoom.currentRound >= updatedRoom.numberOfRounds) {
            updatedRoom.gameState = "finished";
            io.to(roomCode).emit("game_ended", {
                players: updatedRoom.players,
                finalScores: updatedRoom.scores
            });
        } else {
            // Start next round
            updatedRoom.currentRound++;
            updatedRoom.currentPhase = "question";
            
            // Emit round results before clearing data
            io.to(roomCode).emit("round_results", {
                correct,
                authorId: questionData.authorId,
                players: updatedRoom.players
            });

            // Clear round data
            updatedRoom.questions = [];
            updatedRoom.votes = {};
            updatedRoom.selectedQuestion = null;
            updatedRoom.displayedQuestions = [];
            updatedRoom.targetPlayer = updatedRoom.players[Math.floor(Math.random() * updatedRoom.players.length)];

            // Start new round
            io.to(roomCode).emit("new_round", {
                round: updatedRoom.currentRound,
                targetPlayer: updatedRoom.targetPlayer
            });
        }
    }, 7000);
  });

  socket.on("skip_guess", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    if (room && room.currentPhase === "guessing") {
      // No points awarded for skipping
      io.to(roomCode).emit("player_choice", { choice: 'skip' });
      
      // Wait a bit before starting next round
      setTimeout(() => {
        const updatedRoom = rooms.get(roomCode);
        if (!updatedRoom) return;

        if (updatedRoom.currentRound >= updatedRoom.numberOfRounds) {
          updatedRoom.gameState = "finished";
          io.to(roomCode).emit("game_ended", {
            players: updatedRoom.players,
            finalScores: updatedRoom.scores
          });
        } else {
          // Start next round without modifying scores
          updatedRoom.currentRound++;
          updatedRoom.currentPhase = "question";
          
          // Clear round data
          updatedRoom.questions = [];
          updatedRoom.votes = {};
          updatedRoom.selectedQuestion = null;
          updatedRoom.displayedQuestions = [];
          updatedRoom.targetPlayer = updatedRoom.players[Math.floor(Math.random() * updatedRoom.players.length)];

          // Start new round
          io.to(roomCode).emit("new_round", {
            round: updatedRoom.currentRound,
            targetPlayer: updatedRoom.targetPlayer
          });
        }
      }, 7000);
    }
  });

  socket.on('player_choice', ({ roomCode, choice }) => {
    console.log('Player choice received:', choice); // Debug log
    io.to(roomCode).emit('player_choice', { choice });
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    const playerInfo = playerData.get(socket.id);
    if (playerInfo) {
      const { roomCode } = playerInfo;
      const room = rooms.get(roomCode);
      
      if (room) {
        if (room.host === socket.id) {
          io.to(roomCode).emit("game_ended", "Host disconnected");
          rooms.delete(roomCode);
          originalPlayers.delete(roomCode); // Clean up original players data
          console.log(`Room ${roomCode} deleted - host disconnected`);
        } else {
          // Mark player as disconnected but don't remove them
          const player = room.players.find(p => p.id === socket.id);
          if (player) {
            player.disconnected = true;
            io.to(roomCode).emit("player_disconnected", {
              playerName: player.name,
              players: room.players
            });
          }
        }
      }
    }
  });

  // Add a debug endpoint to check room state
  socket.on("debug_room_state", ({ roomCode }) => {
    const room = rooms.get(roomCode);
    const origPlayers = originalPlayers.get(roomCode);
    
    console.log('\n[Server] === ROOM STATE DEBUG ===');
    console.log({
        roomExists: !!room,
        gameState: room?.gameState,
        currentPlayers: room?.players,
        originalPlayers: origPlayers,
        currentRound: room?.currentRound,
        currentPhase: room?.currentPhase
    });
  });
});

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
