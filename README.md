

## TODO
- CSS
- Phone vs desktop; reload warning
- Duplicate names
- Host pages are kinda broken
- When game almost done dev, change min players to 4

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

	Wait for the server to report "Server running on port 3000" before starting the frontend. The server will also print available connection URLs, including your local network IP (e.g., `http://192.168.1.22:3000`). The server listens on all network interfaces (`0.0.0.0`) to accept connections from devices on your local network.

4. Start the frontend and expose it to your local network so phones can connect. Run this from the repo root:

	```powershell
	npm run dev -- --host
	```

	When Vite starts it will print both the local and network URLs, for example:

	- Local: http://localhost:5173/
	- Network: http://192.168.1.22:5173/

	Use the Network URL from your phone's browser (while on the same Wi‑Fi) to join from mobile devices.