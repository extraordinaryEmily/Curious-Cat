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
  }
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log(`[Server] New socket connection: ${socket.id}`);

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
    console.log(`[Server] Join room attempt:`);
    console.log(`- Room Code: ${roomCode}`);
    console.log(`- Player Name: ${playerName}`);
    console.log(`- Socket ID: ${socket.id}`);
    
    if (!roomCode) {
      console.log('[Server] Join failed: No room code provided');
      socket.emit("join_error", "Room code is required");
      return;
    }

    const room = rooms.get(roomCode);
    console.log(`[Server] Room found:`, room ? 'Yes' : 'No');
    
    if (!room) {
      console.log('[Server] Join failed: Room not found');
      socket.emit("join_error", "Room not found");
      return;
    }

    if (room.gameState !== "waiting") {
      console.log('[Server] Join failed: Game in progress');
      socket.emit("join_error", "Game already in progress");
      return;
    }

    try {
      socket.join(roomCode);
      const player = {
        id: socket.id,
        name: playerName,
        score: 0
      };
      
      room.players.push(player);
      room.scores[socket.id] = 0;
      
      console.log(`[Server] Player joined successfully:`);
      console.log(`- Room: ${roomCode}`);
      console.log(`- Player Name: ${playerName}`);
      console.log(`- Current players:`, room.players);
      
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
    const room = rooms.get(roomCode);
    if (room && socket.id === room.host) {
      room.gameState = "playing";
      room.currentRound = 1;
      room.currentPhase = "question";
      // Remove target player selection here since it will be determined by the chosen question
      
      io.to(roomCode).emit("game_started", {
        round: room.currentRound
      });
    }
  });

  socket.on("submit_question", ({ roomCode, question, targetPlayer, authorId }) => {
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

      // Notify that a vote was received
      io.to(roomCode).emit("vote_received", { votesCount: Object.keys(room.votes).length });

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
    const room = rooms.get(roomCode);
    if (room && room.currentPhase === "guessing" && socket.id === room.targetPlayer.id) {
      const correct = guessedPlayerId === room.selectedQuestion.authorId;
      
      // Update scores
      if (correct) {
        room.scores[socket.id] += 2; // Target player gets 2 points for correct guess
      } else {
        room.scores[room.selectedQuestion.authorId] += 1; // Question author gets 1 point
      }

      // Update player scores in the players array
      room.players = room.players.map(player => ({
        ...player,
        score: room.scores[player.id]
      }));

      // Check if game should end based on number of rounds
      if (room.currentRound >= room.numberOfRounds) {
        room.gameState = "finished";
        io.to(roomCode).emit("game_ended", {
          players: room.players,
          finalScores: room.scores
        });
      } else {
        // Start next round
        room.currentRound++;
        room.currentPhase = "question";
        room.questions = [];
        room.votes = {};
        room.targetPlayer = room.players[Math.floor(Math.random() * room.players.length)];
        room.selectedQuestion = null;

        io.to(roomCode).emit("round_results", {
          correct,
          authorId: room.selectedQuestion.authorId,
          players: room.players
        });

        io.to(roomCode).emit("new_round", {
          round: room.currentRound,
          targetPlayer: room.targetPlayer
        });
      }
    }
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    rooms.forEach((room, roomCode) => {
      if (room.host === socket.id) {
        io.to(roomCode).emit("game_ended", "Host disconnected");
        rooms.delete(roomCode);
        console.log(`Room ${roomCode} deleted - host disconnected`);
      } else {
        room.players = room.players.filter(p => p.id !== socket.id);
        if (room.scores) {
          delete room.scores[socket.id];
        }
        io.to(roomCode).emit("player_left", {
          players: room.players
        });
        console.log(`Player ${socket.id} left room ${roomCode}`);
      }
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

























