const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  // Allow all origins in development so phones on the local network can connect.
  // In production, restrict this to your deployed origin.
  cors: {
    origin: "*",
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
    // Validate player name
    if (!playerName || !playerName.trim()) {
        socket.emit("reconnect_failed", "Invalid player name");
        return;
    }
    
    if (playerName.length > MAX_NAME_LENGTH) {
        socket.emit("reconnect_failed", "Name must be 15 characters or less");
        return;
    }
    
    // Check if name contains numbers
    if (/\d/.test(playerName)) {
        socket.emit("reconnect_failed", "Name cannot contain numbers");
        return;
    }
    
    const room = rooms.get(roomCode);
    const playerScore = room?.scores[socket.id] || 0;
    console.log(`[Server] Reconnection attempt:`, { 
        playerName, 
        roomCode,
        score: playerScore,
        allScores: room?.scores // This will show all scores for debugging
    });
    
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
    const oldSocketId = existingPlayer.id;
    existingPlayer.id = socket.id;
    room.scores[socket.id] = room.scores[oldSocketId] || 0;
    
    // Clean up old socket ID from scores if it exists
    if (oldSocketId !== socket.id && room.scores[oldSocketId]) {
      delete room.scores[oldSocketId];
    }
    
    // Update targetPlayer socket ID if it matches the reconnecting player
    if (room.targetPlayer && room.targetPlayer.id === oldSocketId) {
      room.targetPlayer.id = socket.id;
      console.log(`[Server] Updated targetPlayer socket ID from ${oldSocketId} to ${socket.id}`);
    }
    
    // Update questions with new socket ID FIRST - check by authorName (case-insensitive) to handle reconnections
    // This must happen before checking hasSubmitted to ensure we catch duplicates
    room.questions.forEach(q => {
      if (q.authorId === oldSocketId || 
          (q.authorName && q.authorName.toLowerCase() === playerName.toLowerCase())) {
        q.authorId = socket.id;
        // Ensure authorName is set correctly
        if (!q.authorName || q.authorName.toLowerCase() !== playerName.toLowerCase()) {
          q.authorName = playerName;
        }
      }
    });
    
    // Update votes map with new socket ID (votes are stored by socket ID)
    // IMPORTANT: Do this BEFORE checking hasVoted
    if (oldSocketId !== socket.id && room.votes[oldSocketId]) {
      room.votes[socket.id] = room.votes[oldSocketId];
      delete room.votes[oldSocketId];
      console.log(`[Server] Updated vote from old socket ${oldSocketId} to new socket ${socket.id}, vote: ${room.votes[socket.id]}`);
    }
    
    // Join the socket to the room
    socket.join(roomCode);
    
    // Store the player data again
    playerData.set(socket.id, { playerName, roomCode });

    // Check if player has already submitted a question for current round
    // If we're past the question phase, they've definitely submitted
    // If we're in question phase, check if their question exists (by player name, more reliable than socket ID)
    // IMPORTANT: Check AFTER updating questions array above
    let hasSubmitted = false;
    const normalizedPlayerName = playerName.toLowerCase().trim();
    
    console.log(`[Server] ===== RECONNECT HASSUBMITTED CHECK =====`);
    console.log(`[Server] Player: "${playerName}" (normalized: "${normalizedPlayerName}")`);
    console.log(`[Server] Current Phase: ${room.currentPhase}`);
    console.log(`[Server] Current Questions:`, room.questions.map(q => ({
      authorName: q.authorName || 'MISSING',
      normalizedAuthorName: q.authorName ? q.authorName.toLowerCase().trim() : 'MISSING',
      authorId: q.authorId,
      matches: q.authorName ? q.authorName.toLowerCase().trim() === normalizedPlayerName : false
    })));
    
    if (room.currentPhase === 'voting' || room.currentPhase === 'guessing') {
      hasSubmitted = true; // Past question phase means they submitted
      console.log(`[Server] Phase is ${room.currentPhase}, setting hasSubmitted = true`);
    } else if (room.currentPhase === 'question') {
      // Check by player name (case-insensitive) - this is more reliable than socket ID
      hasSubmitted = room.questions.some(q => {
        if (!q.authorName) return false;
        const normalizedAuthorName = q.authorName.toLowerCase().trim();
        const matches = normalizedAuthorName === normalizedPlayerName;
        if (matches) {
          console.log(`[Server] FOUND MATCH: Question by "${q.authorName}" matches player "${playerName}"`);
        }
        return matches;
      });
      console.log(`[Server] Final hasSubmitted value: ${hasSubmitted}`);
    }
    console.log(`[Server] ==========================================`);

    // Check if player has voted (for voting phase)
    // IMPORTANT: Check AFTER updating votes map above
    let hasVoted = false;
    if (room.currentPhase === 'voting') {
      // Check both new and old socket ID to be safe
      hasVoted = !!(room.votes[socket.id] || (oldSocketId !== socket.id && room.votes[oldSocketId]));
      console.log(`[Server] ===== VOTING PHASE RECONNECT CHECK =====`);
      console.log(`[Server] Player: ${playerName}, Socket: ${socket.id}, Old Socket: ${oldSocketId}`);
      console.log(`[Server] Votes map:`, room.votes);
      console.log(`[Server] Vote for new socket (${socket.id}):`, room.votes[socket.id]);
      console.log(`[Server] Vote for old socket (${oldSocketId}):`, oldSocketId !== socket.id ? room.votes[oldSocketId] : 'N/A');
      console.log(`[Server] Final hasVoted: ${hasVoted}`);
      console.log(`[Server] =========================================`);
    }
    
    // Prepare voting questions if in voting phase
    // Always send questions, even if player has already voted (needed for display)
    let votingQuestions = null;
    if (room.currentPhase === 'voting' && room.displayedQuestions && room.displayedQuestions.length > 0) {
      // Filter out player's own question (displayedQuestions contains all questions, not filtered per player)
      votingQuestions = room.displayedQuestions
        .filter(q => q.authorId !== socket.id)
        .map(q => ({
          id: q.id,
          text: q.text,
          targetPlayer: q.targetPlayer,
          authorId: q.authorId,
          authorName: q.authorName
        }));
      console.log(`[Server] Sending voting questions to reconnected player:`, votingQuestions.length, 'questions (filtered from', room.displayedQuestions.length, 'total)');
    } else if (room.currentPhase === 'voting') {
      console.log(`[Server] WARNING: Voting phase but no displayedQuestions found!`);
    }
    
    // Prepare selectedQuestion with authorId for guessing phase
    let questionAuthorId = null;
    if (room.currentPhase === 'guessing' && room.selectedQuestion) {
      questionAuthorId = room.selectedQuestion.authorId;
      console.log(`[Server] Guessing phase - Question authorId: ${questionAuthorId}, Player socket: ${socket.id}`);
    }
    
    // Send current game state to reconnected player
    const reconnectData = {
      gameState: room.gameState,
      currentRound: room.currentRound,
      currentPhase: room.currentPhase,
      players: room.players,
      scores: room.scores,
      selectedQuestion: room.selectedQuestion,
      questionAuthorId: questionAuthorId, // Add authorId separately for easier access
      targetPlayer: room.targetPlayer,
      hasSubmitted: hasSubmitted,
      hasVoted: hasVoted,
      votingQuestions: votingQuestions
    };
    
    console.log(`[Server] Sending reconnect_success to ${playerName}:`, {
      ...reconnectData,
      hasSubmitted: reconnectData.hasSubmitted,
      hasVoted: reconnectData.hasVoted,
      votingQuestionsCount: votingQuestions ? votingQuestions.length : 0,
      players: reconnectData.players.map(p => ({ name: p.name, id: p.id })),
      scores: reconnectData.scores
    });
    
    socket.emit("reconnect_success", reconnectData);

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
        socket.emit("join_error", "Room code is required");
        return;
    }

    // Validate player name
    if (!playerName || !playerName.trim()) {
        socket.emit("join_error", "Please enter your name");
        return;
    }
    
    if (playerName.length > MAX_NAME_LENGTH) {
        socket.emit("join_error", "Name must be 15 characters or less");
        return;
    }
    
    // Check if name contains numbers
    if (/\d/.test(playerName)) {
        socket.emit("join_error", "Name cannot contain numbers");
        return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
        socket.emit("join_error", "Room not found");
        return;
    }

    // Check for reconnection attempt FIRST (before checking game state)
    // This allows disconnected players to reconnect even if game has started
    const disconnectedPlayer = room.players.find(p => 
        p.name.toLowerCase() === playerName.toLowerCase() && p.disconnected
    );

    // Prevent NEW players from joining after game has started
    // Only allow reconnections
    if (room.gameState !== "waiting" && !disconnectedPlayer) {
        socket.emit("join_error", "Game has already started. New players cannot join.");
        return;
    }

    // Count active players
    const activePlayers = room.players.filter(p => !p.disconnected);
    console.log('[Server] Active players:', activePlayers.length);

    // Check for duplicate names (excluding disconnected players)
    // This prevents duplicate names among active players
    const duplicateName = activePlayers.some(p => 
        p.name.toLowerCase() === playerName.toLowerCase() && !p.disconnected
    );

    if (duplicateName) {
        socket.emit("join_error", "Name already taken");
        return;
    }

    // Enforce player limit
    if (activePlayers.length >= MAX_PLAYERS && !disconnectedPlayer) {
        socket.emit("join_error", "Room is full (max 10 players)");
        return;
    }

    if (disconnectedPlayer) {
        // Handle reconnection
        disconnectedPlayer.id = socket.id;
        disconnectedPlayer.disconnected = false;
        socket.join(roomCode);
        playerData.set(socket.id, { playerName, roomCode });
        io.to(roomCode).emit("player_joined", { players: room.players });
        socket.emit("join_success");
        return;
    }

    // Handle new player join
    try {
        socket.join(roomCode);
        const player = {
            id: socket.id,
            name: playerName,
            score: 0,
            disconnected: false
        };
        
        room.players.push(player);
        room.scores[socket.id] = 0;
        playerData.set(socket.id, { playerName, roomCode });
        
        io.to(roomCode).emit("player_joined", { players: room.players });
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
    console.log(`[Server] ===== SUBMIT_QUESTION EVENT =====`);
    console.log(`[Server] Room exists: ${!!room}, Phase: ${room?.currentPhase}`);
    
    if (room && room.currentPhase === "question") {
      // Find player by socket ID first
      let playerName = room.players.find(p => p.id === socket.id)?.name;
      console.log(`[Server] Initial playerName lookup by socket ID ${socket.id}: ${playerName || 'NOT FOUND'}`);
      
      // If player not found by socket ID, try to find by checking if this socket just reconnected
      // This handles race condition where submit_question arrives before attempt_reconnect completes
      if (!playerName) {
        // Check if there's a player data entry for this socket
        const playerDataEntry = playerData.get(socket.id);
        if (playerDataEntry) {
          // Find player by name from playerData
          const playerByName = room.players.find(p => 
            p.name.toLowerCase() === playerDataEntry.playerName.toLowerCase()
          );
          if (playerByName) {
            // Update the player's socket ID immediately
            playerByName.id = socket.id;
            playerName = playerByName.name;
            console.log(`[Server] Updated player socket ID during submit_question: ${playerName} -> ${socket.id}`);
          }
        }
      }
      
      if (!playerName) {
        console.log(`[Server] Player not found for socket ${socket.id} in room ${roomCode}`);
        socket.emit("question_error", "Player not found in room");
        return;
      }
      
      const targetPlayerName = room.players.find(p => p.id === targetPlayer)?.name;
      
      // CRITICAL: Check if this player has already submitted a question for this round
      // Check by player name (case-insensitive) to handle reconnections
      // Update any questions with matching authorName to use current socket ID
      const normalizedPlayerName = playerName.toLowerCase().trim();
      let alreadySubmitted = false;
      
      for (const q of room.questions) {
        if (q.authorName) {
          const normalizedAuthorName = q.authorName.toLowerCase().trim();
          if (normalizedAuthorName === normalizedPlayerName) {
            // Found a question by this player - update socket ID and mark as duplicate
            q.authorId = socket.id;
            alreadySubmitted = true;
            break;
          }
        }
      }
      
      console.log(`[Server] ===== DUPLICATE CHECK =====`);
      console.log(`[Server] Player: "${playerName}" (normalized: "${normalizedPlayerName}")`);
      console.log(`[Server] Socket ID: ${socket.id}`);
      console.log(`[Server] Already Submitted: ${alreadySubmitted}`);
      console.log(`[Server] Questions in room:`, room.questions.map(q => ({
        authorName: q.authorName || 'MISSING',
        normalizedAuthorName: q.authorName ? q.authorName.toLowerCase().trim() : 'MISSING',
        authorId: q.authorId,
        text: q.text ? q.text.substring(0, 30) + '...' : 'MISSING'
      })));
      console.log(`[Server] ==========================`);
      
      if (alreadySubmitted) {
        console.log(`[Server] *** REJECTING DUPLICATE SUBMISSION ***`);
        socket.emit("question_error", "You have already submitted a question for this round");
        return;
      }
      
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

  // Client may request a filtered voting payload (exclude their own question)
  socket.on("voting_phase", ({ roomCode, questions }) => {
    const room = rooms.get(roomCode);
    if (room && Array.isArray(questions)) {
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
  // Generate a 4-letter room code (A-Z) to keep codes short and easy to type on phones
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
