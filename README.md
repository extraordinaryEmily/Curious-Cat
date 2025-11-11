# WIP; CURSOR AI TEST

This is a test project for Cursor AI. It is a simple trivia game where players can create a room, join a room, and play trivia with friends. The game is built with React, Socket.IO, and Node.js. Party game meant for me to play with friends but also experiment with Socket.IO and AI coding.

## Augment Observations

- Has difficulty debugging multiple files and unable to trace which file is causing the error
- Poor CSS decisions
- Does better when instructed to make print statements
- Not straightforward to prep user with installment instrucitons
- 'Apply changes' doesn't seem to SHOW all changes (ie when there are no changes there actually is and when you save, some action has changed but since you didn't see it, you don't know what exactly changed; created a git for this reason so I can save things more clearly)

## All Previous Bugs
- Vote jumps ahead to calculate best question too early
- You are allowed to vote for your own question on the UI
- authorId and isAnswering issue
- targetPlayer is suddenly missing value
- Pages mesh instead of transition
- Question display formatting with spacing and letter cases(broken again)
- Resetting values for new round with 'No' and 'Next' options
- Issue with disconnecting server at authorId
- Scoring was half the points

## TODO
- CSS
- Phone vs desktop; reload warning
- Duplicate names
- Host pages are kinda broken

## How to run (dev)

1. From the repo root, install frontend deps:

	```powershell
	npm install
	```

2. Install server deps:

	```powershell
	cd server; npm install
	```

3. Start the backend first (required). The backend listens on port 3000 and provides the Socket.IO API the frontend needs:

	```powershell
	# Run this in the project root
	node server/index.js
	```

	Wait for the server to report "Server running on port 3000" before starting the frontend.

4. Start the frontend and expose it to your local network so phones can connect. Run this from the repo root:

	```powershell
	npm run dev -- --host
	```

	When Vite starts it will print both the local and network URLs, for example:

	- Local: http://localhost:5173/
	- Network: http://192.168.1.22:5173/

	Use the Network URL from your phone's browser (while on the same Wi‑Fi) to join from mobile devices.

Notes & troubleshooting

- The server must be running first. If you start the frontend before the backend, the client will fail to connect to Socket.IO and some UI actions (creating/joining rooms) will not work properly.
- If you don't see a "Network" URL from Vite, make sure you used `--host` and that your machine's firewall allows incoming connections to port 5173.
- Find your computer's local IP on Windows by running `ipconfig` and looking for the IPv4 address of the active adapter.
- Room codes are now 4 uppercase letters (e.g. `ABCD`) to make typing on phones easier.

## Changes made during this pass

- Fixed a bug in `server/index.js` where the `voting_phase` socket handler referenced an undefined `roomCode` variable; it now accepts `{ roomCode, questions }` and safely filters questions for the requesting socket.
- Installed project dependencies and verified the dev server starts (Vite) and the Node backend listens on port 3000.

## Notes & next steps

- There are several TODOs remaining in the codebase (CSS, host page fixes, duplicate-name UX) — I'll start with safe, high-impact fixes next: prevent voting for your own question on the UI (already filtered on client, but server-side checks exist), ensure host pages render correctly, and add more input validation and graceful reconnection flows.
- If you'd like, I can continue by applying small UI fixes and adding a short test harness or automated smoke test for the main socket flows.

## Things to note as Augment warns
- Possibly players haven't submitted questions but round proceeds
- Proper clearing of previous round's data
- Screen orientation changes
- Different screen sizes
- Special characters in inputs
- Rapid button clicking
- Double question submissions
- Final scoreboard on ties
- Score preservation during reconnection
- Multiple players submitting or voting simultaneously

## Things to note as Cursor warns

### Socket & State Management
- **Duplicate socket event listeners**: `Player.jsx` has duplicate `socket.off('join_error')` calls in cleanup (lines 242 and 256) - ensure all event listeners are properly cleaned up to prevent memory leaks
- **Socket event listener dependencies**: The `useEffect` in `Player.jsx` depends on `[roomCode, isAnswering]` but uses many socket events - be careful when modifying dependencies as missing dependencies can cause stale closures
- **State synchronization**: Server state (`room.gameState`, `room.currentPhase`) must stay in sync with client state - race conditions can occur if multiple players act simultaneously
- **Reconnection complexity**: Reconnection logic involves multiple state updates and localStorage operations - test thoroughly as state can become inconsistent if reconnection happens mid-game

### Memory Leaks & Cleanup
- **setTimeout not cleared**: In `Player.jsx` lines 123-129, nested `setTimeout` calls are used but not stored/cleared - if component unmounts before timeout fires, this can cause memory leaks and state updates on unmounted components
- **Socket cleanup**: Ensure all socket event listeners added in `useEffect` are removed in cleanup function - missing cleanup can cause duplicate handlers and unexpected behavior

### Input Validation & Security
- **Client-side validation mismatch**: Client validates question length at 120 chars (`Player.jsx` line 293) but server validates at 150 chars (`server/index.js` line 35) - this inconsistency can cause confusion
- **Name validation**: Server checks `MAX_NAME_LENGTH` (15) but ensure client validation matches exactly
- **Special characters**: No sanitization visible for XSS prevention in user inputs (names, questions) - consider sanitizing before displaying
- **Room code validation**: Room codes are generated server-side but ensure they're validated on client before use

### Race Conditions & Concurrency
- **Simultaneous submissions**: Multiple players submitting questions/votes at the same time can cause race conditions - server handles this but ensure UI doesn't show stale state
- **Voting phase timing**: Questions are filtered client-side for voting, but if a player disconnects/reconnects during voting, their view might be inconsistent
- **Score updates**: Score updates happen asynchronously - ensure scores are properly synchronized when players reconnect

### Mobile-Specific Issues
- **Viewport height**: Using `100vh` can cause issues on mobile browsers due to address bar - consider using `dvh` (dynamic viewport height) or JavaScript-based height calculation
- **Touch events**: No explicit touch event handling - ensure buttons/inputs work well on mobile (adequate touch targets, no accidental double-taps)
- **Keyboard behavior**: Mobile keyboards can resize viewport - ensure UI adapts properly when keyboard appears/disappears
- **Scrolling prevention**: `overflow: hidden` is set globally in `index.css` - ensure this doesn't break functionality on pages that need scrolling

### CSS & Responsive Design
- **Hardcoded viewport units**: Many `vh`, `vw` units used - test on various screen sizes as these can cause layout issues
- **Font loading**: Custom fonts (MADE Gentle, Heyam) loaded via CSS - ensure fallbacks work if fonts fail to load
- **Color contrast**: Verify white text on `#D67C6D` background meets accessibility standards
- **Container width**: Using percentage widths (`85%`, `66.666%`) - ensure these work well across all device sizes

### Error Handling
- **Network failures**: Socket connection errors are logged but user feedback could be improved - consider showing user-friendly error messages
- **Server errors**: Server-side errors may not always propagate to client - ensure all error cases are handled gracefully
- **Room not found**: Handle case where room is deleted while players are still connected

### Data Persistence
- **localStorage usage**: Multiple components use localStorage for reconnection - ensure data is cleared appropriately to prevent stale data
- **localStorage quota**: No error handling for localStorage quota exceeded - add try-catch around localStorage operations

### Game Logic Edge Cases
- **Empty questions array**: If all questions are filtered out (e.g., only 1 player), voting phase might break
- **Player count**: Minimum player count not enforced - game might break with < 2 players
- **Round transitions**: Ensure all state is properly reset between rounds - previous round data can leak into new round
- **Game end conditions**: Final round and game end logic needs thorough testing - ensure scores are finalized correctly
