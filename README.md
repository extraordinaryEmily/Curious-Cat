# WIP; AUGMENT AI TEST

This is a test project for Augment AI. It is a simple trivia game where players can create a room, join a room, and play trivia with friends. The game is built with React, Socket.IO, and Node.js. Party game meant for me to play with friends but also experiment with Socket.IO and AI coding.

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
