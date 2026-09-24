import { FormEvent, useEffect, useMemo, useState } from 'react';
import { socket } from './socket';
import CanvasBoard from './CanvasBoard';
import type { RoomState, Settings, ChatMessage } from './types';

const defaultSettings: Settings = { maxPlayers: 8, rounds: 3, drawTime: 60, wordCount: 3, hints: 2, private: true };

type Screen = 'home' | 'lobby' | 'game' | 'result';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [name, setName] = useState(localStorage.getItem('scribble_name') || '');
  const [roomCode, setRoomCode] = useState(new URLSearchParams(window.location.search).get('room') || '');
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [toast, setToast] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [guess, setGuess] = useState('');
  const [remaining, setRemaining] = useState(60);
  const [roundEndWord, setRoundEndWord] = useState('');
  const [winner, setWinner] = useState<{ name: string; score: number } | null>(null);

  const me = room?.players.find((p) => p.id === socket.id);
  const isDrawer = !!room && room.game.drawerId === socket.id;
  const sortedPlayers = useMemo(() => [...(room?.players || [])].sort((a, b) => b.score - a.score), [room?.players]);

  useEffect(() => {
    const onConnect = () => { setConnected(true); setError(''); };
    const onDisconnect = () => setConnected(false);
    const onError = ({ message }: { message: string }) => { setError(message); setToast(message); setTimeout(() => setToast(''), 3000); };
    const onRoomState = (state: RoomState) => {
      setRoom(state);
      setMessages(state.chat || []);
      setRemaining(state.game.remaining || state.settings.drawTime);
      if (state.game.phase === 'lobby') setScreen('lobby');
      else if (state.game.phase === 'game_over') setScreen('result');
      else setScreen('game');
    };
    const onChat = (message: ChatMessage) => setMessages((prev) => [...prev.slice(-49), message]);
    const onTimer = ({ remaining }: { remaining: number }) => setRemaining(remaining);
    const onRoundStart = (data: any) => {
      setRemaining(data.drawTime);
      setRoundEndWord('');
      setScreen('game');
      if (data.wordOptions?.length) setToast('Choose your word');
    };
    const onRoundEnd = ({ word }: { word: string }) => { setRoundEndWord(word); setToast(`Round ended — the word was “${word}”`); };
    const onGameOver = ({ winner, leaderboard }: any) => {
      setWinner(winner ? { name: winner.name, score: winner.score } : leaderboard?.[0] || null);
      setScreen('result');
    };
    const onPlayerLeft = () => setToast('A player left the room.');

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('app_error', onError);
    socket.on('room_state', onRoomState);
    socket.on('chat_message', onChat);
    socket.on('timer', onTimer);
    socket.on('round_start', onRoundStart);
    socket.on('round_end', onRoundEnd);
    socket.on('game_over', onGameOver);
    socket.on('player_left', onPlayerLeft);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('app_error', onError);
      socket.off('room_state', onRoomState);
      socket.off('chat_message', onChat);
      socket.off('timer', onTimer);
      socket.off('round_start', onRoundStart);
      socket.off('round_end', onRoundEnd);
      socket.off('game_over', onGameOver);
      socket.off('player_left', onPlayerLeft);
    };
  }, []);

  useEffect(() => {
    if (room?.game.phase === 'drawing' && room.game.startedAt) {
      setRemaining(room.game.remaining);
    }
  }, [room?.game.phase, room?.game.startedAt, room?.game.remaining]);

  const cleanName = () => {
    const value = name.trim().slice(0, 20);
    if (!value) { setError('Please enter your name.'); return ''; }
    localStorage.setItem('scribble_name', value);
    return value;
  };

  const createRoom = () => {
    const value = cleanName();
    if (!value) return;
    if (!socket.connected) socket.connect();
    socket.emit('create_room', { hostName: value, settings });
  };

  const joinRoom = () => {
    const value = cleanName();
    const code = roomCode.trim().toUpperCase();
    if (!value) return;
    if (!code) { setError('Enter a room code.'); return; }
    if (!socket.connected) socket.connect();
    socket.emit('join_room', { roomId: code, playerName: value });
  };

  const startGame = () => socket.emit('start_game');
  const chooseWord = (word: string) => socket.emit('word_chosen', { word });

  const sendGuess = (e: FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;
    socket.emit('guess', { text: guess.trim() });
    setGuess('');
  };

  const sendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!guess.trim()) return;
    socket.emit('chat', { text: guess.trim() });
    setGuess('');
  };

  const copyInvite = async () => {
    if (!room) return;
    const url = `${window.location.origin}/?room=${room.id}`;
    try { await navigator.clipboard.writeText(url); setToast('Invite link copied!'); }
    catch { setToast(url); }
    setTimeout(() => setToast(''), 2500);
  };

  const leave = () => {
    window.location.href = window.location.origin;
  };

  if (screen === 'home' || !room) {
    return <Home name={name} setName={setName} roomCode={roomCode} setRoomCode={setRoomCode} settings={settings} setSettings={setSettings} createRoom={createRoom} joinRoom={joinRoom} error={error} connected={connected} />;
  }

  if (screen === 'lobby') {
    return <Lobby room={room} me={me} startGame={startGame} copyInvite={copyInvite} leave={leave} error={error} />;
  }

  if (screen === 'result') {
    return <Result room={room} sortedPlayers={sortedPlayers} winner={winner} leave={leave} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">✦</span> Scribble Party</div>
        <div className="room-pill">Room <strong>{room.id}</strong> <button onClick={copyInvite}>Copy invite</button></div>
        <button className="ghost-btn" onClick={leave}>Leave</button>
      </header>
      {toast && <div className="toast">{toast}</div>}
      <main className="game-layout">
        <aside className="players-panel card">
          <div className="panel-title"><span>Players</span><span className="count">{room.players.length}/{room.settings.maxPlayers}</span></div>
          <div className="player-list">
            {sortedPlayers.map((p, index) => <div className={`player-row ${p.id === socket.id ? 'me' : ''} ${p.id === room.game.drawerId ? 'drawer' : ''}`} key={p.id}>
              <div className="avatar">{p.name.charAt(0).toUpperCase()}</div>
              <div className="player-info"><strong>{p.name}{p.id === socket.id ? ' (You)' : ''}</strong><span>{p.id === room.game.drawerId ? '🎨 Drawing' : `#${index + 1}`}</span></div>
              <b>{p.score}</b>
            </div>)}
          </div>
        </aside>

        <section className="center-panel">
          <div className="game-status card">
            <div><span className="eyebrow">Round</span><strong>{room.game.round} / {room.game.totalRounds}</strong></div>
            <div className="timer"><span>⏱</span><strong>{remaining}s</strong></div>
            <div className="word-display">
              {isDrawer && room.game.phase === 'drawing' ? <><span className="eyebrow">Your word</span><strong>{room.game.word || 'Selected'}</strong></> : <><span className="eyebrow">Guess the word</span><strong>{room.game.hints || '—  —  —'}</strong></>}
            </div>
          </div>

          {room.game.phase === 'choosing' ? (
            <div className="choose-card card">
              {isDrawer ? <>
                <span className="eyebrow">Your turn to draw</span>
                <h2>Choose a word</h2>
                <div className="word-options">{room.game.wordOptions.map((option) => <button key={option.word} onClick={() => chooseWord(option.word)}><b>{option.word}</b><span>{option.category}</span></button>)}</div>
              </> : <><div className="big-spinner">✎</div><h2>{room.players.find((p) => p.id === room.game.drawerId)?.name || 'The drawer'} is choosing a word…</h2><p>Get ready to guess!</p></>}
            </div>
          ) : (
            <CanvasBoard canDraw={isDrawer && room.game.phase === 'drawing'} initialStrokes={room.game.strokes} />
          )}
        </section>

        <aside className="chat-panel card">
          <div className="panel-title"><span>Chat & Guess</span><span className="online-dot">● Live</span></div>
          <div className="chat-messages">
            {messages.map((m) => <div key={m.id} className={`chat-line ${m.system ? 'system' : ''}`}><strong>{m.playerName}</strong><span>{m.text}</span></div>)}
          </div>
          <form className="chat-form" onSubmit={sendGuess}>
            <input value={guess} onChange={(e) => setGuess(e.target.value)} placeholder={isDrawer ? 'Chat with players…' : 'Type your guess…'} maxLength={160} />
            <button type="submit">➤</button>
          </form>
          <button type="button" className="chat-mode" onClick={sendChat}>Send as chat</button>
        </aside>
      </main>
      {roundEndWord && room.game.phase === 'round_end' && <div className="round-banner">Round complete! The word was <strong>{roundEndWord}</strong>.</div>}
      {error && <div className="error-banner">{error}</div>}
    </div>
  );
}

function Home({ name, setName, roomCode, setRoomCode, settings, setSettings, createRoom, joinRoom, error, connected }: any) {
  return (
    <div className="landing">
      <div className="landing-glow glow-one" /><div className="landing-glow glow-two" />
      <header className="landing-header"><div className="brand"><span className="brand-mark">✦</span> Scribble Party</div><div className={connected ? 'connection good' : 'connection bad'}>{connected ? '● Connected' : '● Connecting…'}</div></header>
      <main className="landing-main">
        <section className="hero-copy"><span className="hero-kicker">ONLINE MULTIPLAYER DRAWING GAME</span><h1>Draw it.<br /><span>Guess it.</span><br />Win it.</h1><p>Create a room, invite friends, take turns drawing, and race to the top of the leaderboard.</p><div className="feature-pills"><span>⚡ Real-time</span><span>🎨 Live canvas</span><span>🏆 Leaderboard</span></div></section>
        <section className="home-card card">
          <div className="tabs"><button className="tab active">Play</button></div>
          <label>YOUR NAME<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" maxLength={20} /></label>
          <div className="home-actions"><button className="primary-btn" onClick={createRoom}>Create room <span>→</span></button><div className="or"><i />or<i /></div><div className="join-row"><input value={roomCode} onChange={(e) => setRoomCode(e.target.value.toUpperCase())} placeholder="ROOM CODE" maxLength={6} /><button className="secondary-btn" onClick={joinRoom}>Continue</button></div></div>
          <details className="settings-details"><summary>Room settings</summary><div className="settings-grid"><label>Max players<select value={settings.maxPlayers} onChange={(e) => setSettings({ ...settings, maxPlayers: Number(e.target.value) })}>{[2,4,6,8,10,15,20].map(n => <option key={n}>{n}</option>)}</select></label><label>Rounds<select value={settings.rounds} onChange={(e) => setSettings({ ...settings, rounds: Number(e.target.value) })}>{[2,3,4,5,6,8,10].map(n => <option key={n}>{n}</option>)}</select></label><label>Draw time<select value={settings.drawTime} onChange={(e) => setSettings({ ...settings, drawTime: Number(e.target.value) })}>{[30,45,60,90,120,180,240].map(n => <option key={n}>{n}s</option>)}</select></label><label>Words<select value={settings.wordCount} onChange={(e) => setSettings({ ...settings, wordCount: Number(e.target.value) })}>{[1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></label><label>Hints<select value={settings.hints} onChange={(e) => setSettings({ ...settings, hints: Number(e.target.value) })}>{[0,1,2,3,4,5].map(n => <option key={n}>{n}</option>)}</select></label><label className="toggle-label">Private room<input type="checkbox" checked={settings.private} onChange={(e) => setSettings({ ...settings, private: e.target.checked })} /><span className="toggle" /></label></div></details>
          {error && <div className="inline-error">{error}</div>}
        </section>
      </main>
      <footer>Built with React + TypeScript + Node.js + Socket.IO</footer>
    </div>
  );
}

function Lobby({ room, me, startGame, copyInvite, leave, error }: any) {
  return <div className="simple-page"><header className="topbar"><div className="brand"><span className="brand-mark">✦</span> Scribble Party</div><div className="room-pill">Room <strong>{room.id}</strong> <button onClick={copyInvite}>Copy invite</button></div><button className="ghost-btn" onClick={leave}>Leave</button></header><main className="lobby-card card"><div className="lobby-head"><div><span className="hero-kicker">ROOM LOBBY</span><h1>Ready to draw?</h1><p>Share the invite link or room code with your friends.</p></div><div className="room-code-large">{room.id}</div></div><div className="lobby-grid"><section><h3>Players <span>{room.players.length}/{room.settings.maxPlayers}</span></h3><div className="lobby-players">{room.players.map((p: any) => <div className="lobby-player" key={p.id}><div className="avatar">{p.name[0]}</div><strong>{p.name}</strong>{p.isHost && <span className="host-badge">HOST</span>}</div>)}</div></section><section className="rules"><h3>Room settings</h3><p>🎯 {room.settings.rounds} rounds</p><p>⏱ {room.settings.drawTime} seconds per drawing</p><p>📝 {room.settings.wordCount} word choices</p><p>💡 {room.settings.hints} hints</p><p>{room.private ? '🔒 Private room' : '🌐 Public room'}</p></section></div><div className="lobby-bottom">{me?.isHost ? <button className="primary-btn large" onClick={startGame} disabled={room.players.length < 2}>Start game <span>→</span></button> : <div className="waiting">⌛ Waiting for the host to start the game…</div>}<button className="secondary-btn" onClick={copyInvite}>Copy invite link</button></div>{room.players.length < 2 && me?.isHost && <p className="hint">Add at least one more player before starting.</p>}{error && <div className="inline-error">{error}</div>}</main></div>;
}

function Result({ room, sortedPlayers, winner, leave }: any) {
  return <div className="simple-page"><main className="result-card card"><div className="trophy">🏆</div><span className="hero-kicker">GAME COMPLETE</span><h1>{winner ? `${winner.name} wins!` : 'Game over!'}</h1><p>Final leaderboard</p><div className="leaderboard">{sortedPlayers.map((p: any, i: number) => <div className={`leader-row ${i === 0 ? 'first' : ''}`} key={p.id}><span>{i + 1}</span><strong>{p.name}</strong><b>{p.score} pts</b></div>)}</div><button className="primary-btn large" onClick={leave}>Back to home</button></main></div>;
}
