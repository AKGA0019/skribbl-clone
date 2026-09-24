# Scribble Party — skribbl.io Clone

A full-stack multiplayer drawing and guessing game built to match the internship assignment specification.

## Stack

- **Frontend:** React + TypeScript + Vite
- **Canvas:** HTML5 Canvas API with custom drawing logic
- **Backend:** Node.js + Express
- **Realtime:** Socket.IO
- **State:** Server-authoritative in-memory rooms/game state

The assignment asks for React + TypeScript + Vite, Node.js + Express and Socket.IO, with real-time drawing, guessing, chat and game state. This project follows that recommended stack. fileciteturn0file0L60-L75

## Implemented

### Room & Lobby
- Create room with configurable max players, rounds, draw time, word count and hints
- Join by six-character room code or invite URL
- Private/public room setting
- Host-only game start
- Live player list and host transfer if the host disconnects

### Game
- Server-controlled turn order
- 1 drawer per round
- 1–5 word choices
- Word categories
- Real-time canvas strokes through Socket.IO
- Pen, multiple colors, brush size, eraser, undo and clear
- Guess checking with normalized case/whitespace matching
- Speed-based scoring
- Hint blanks
- Round timer
- Automatic next drawer
- Final leaderboard and winner
- Live chat

The assignment specifically requires multiplayer rooms, turn-based drawing, real-time canvas synchronization, word selection, scoring/leaderboard and WebSockets. fileciteturn0file0L11-L17

## Run locally

### Requirements

- Node.js 18+
- npm 9+

### Install

From the project root:

```bash
npm install
```

### Start both frontend and backend

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

The backend runs at:

```text
http://localhost:3001
```

### Test multiplayer

1. Open `http://localhost:5173` in Chrome.
2. Enter a name and click **Create room**.
3. Copy the room code or invite link.
4. Open a second browser tab/incognito window.
5. Enter a different name and the same room code.
6. Host clicks **Start game**.
7. Drawer selects a word.
8. Drawer draws; the other player sees strokes live.
9. Guess the word in chat.
10. Continue through the configured rounds and view the final leaderboard.

## Production deployment

The assignment asks for a publicly accessible deployment and recommends platforms such as Render or Railway for WebSocket support. fileciteturn0file0L187-L196

### Option A — Render, one service

1. Push this repository to GitHub.
2. Create a Render **Web Service**.
3. Build command:

```bash
npm install && npm run build
```

4. Start command:

```bash
npm start
```

5. Set:

```text
NODE_VERSION=20
CLIENT_ORIGIN=https://YOUR-RENDER-DOMAIN.onrender.com
```

The Express server serves `client/dist` after the frontend build, so one Render service hosts both the UI and Socket.IO backend.

## Architecture

```text
React UI
   |
   | Socket.IO events
   v
Node + Express + Socket.IO
   |
   +-- RoomManager
   |     +-- Room
   |          +-- Player[]
   |          +-- Game
   |
   +-- Server-authoritative game rules
         +-- turns
         +-- word selection
         +-- scoring
         +-- timer
         +-- hints
         +-- round/game end
```

## Important Socket.IO events

The event model follows the assignment's suggested room, game, drawing and guessing events. fileciteturn0file0L76-L84 fileciteturn0file0L89-L116 fileciteturn0file0L117-L145

- `create_room`
- `join_room`
- `player_joined` / `player_left`
- `start_game`
- `round_start`
- `word_chosen`
- `draw_start` / `draw_move` / `draw_end`
- `draw_data`
- `canvas_clear`
- `draw_undo`
- `guess`
- `guess_result`
- `chat`
- `chat_message`
- `round_end`
- `game_over`

## Code walkthrough

### Drawing

The browser converts pointer coordinates to normalized `0..1` coordinates. The drawer emits `draw_start` and `draw_move`. The server validates that the sender is the current drawer and broadcasts safe stroke data to the room. Each client renders those normalized coordinates against its own canvas size.

### Game state

The server owns the `Game` instance for every room. The server decides the drawer, selected word, round, timer, score and game-end transition. Clients cannot choose a word unless they are the drawer and cannot draw unless they are the drawer.

### Guessing

Guesses are trimmed, converted to lowercase and whitespace-normalized before comparison. Correct guesses are scored and marked so a player cannot repeatedly score in the same round.

### Deployment constraint

WebSocket support needs to stay on the Node/Socket.IO backend. For a single-service deployment, this repository uses Express to serve the Vite production build from the same Node process.

## Assignment coverage

The project covers the required flow of create room → join → lobby → choose word → draw → guess → score → rotate turns → final leaderboard. The assignment also asks for a README, architecture explanation and readiness to explain WebSocket/canvas/game-state choices. fileciteturn0file0L204-L213

## Notes

This version uses in-memory rooms, which is ideal for an internship assignment/demo. For a multi-instance production deployment, move room/game state to a shared store such as Redis and use a Socket.IO adapter.
