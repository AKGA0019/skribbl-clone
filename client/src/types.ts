export type Settings = {
  maxPlayers: number;
  rounds: number;
  drawTime: number;
  wordCount: number;
  hints: number;
  private: boolean;
};

export type Player = {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  ready: boolean;
};

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  system?: boolean;
};

export type StrokePoint = {
  x: number;
  y: number;
  px: number;
  py: number;
  color: string;
  size: number;
  tool: 'pen' | 'eraser';
  type: 'start' | 'move';
};

export type GameState = {
  phase: 'lobby' | 'choosing' | 'drawing' | 'round_end' | 'game_over';
  round: number;
  totalRounds: number;
  drawerId: string | null;
  word: string | null;
  hints: string;
  strokes: StrokePoint[];
  wordOptions: { word: string; category: string }[];
  drawTime: number;
  startedAt: number | null;
  remaining: number;
  scores: { id: string; name: string; score: number }[];
};

export type RoomState = {
  id: string;
  hostId: string;
  private: boolean;
  settings: Settings;
  players: Player[];
  game: GameState;
  chat: ChatMessage[];
};
