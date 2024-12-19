export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 8;

export type GameMode = "halfit" | "cricket";

export interface Player {
  id: string;
  name: string;
  inputs: (number | null)[];
  totalScore: number;
  cricketScores?: {
    [target: string]: number; // Number of marks (1-3)
  };
}

export interface GameState {
  players: Player[];
  currentRound: number;
  isGameComplete: boolean;
  gameMode: GameMode;
}

export type GameAction =
  | { type: "ADD_PLAYER"; payload: string }
  | { type: "REMOVE_PLAYER"; payload: string }
  | {
      type: "UPDATE_SCORE";
      payload: { playerId: string; roundIndex: number; input: number | null };
    }
  | { type: "RESET_GAME" }
  | { type: "SET_GAME_MODE"; payload: GameMode };

// Half-It rounds
export const HALFIT_ROUNDS = [
  { id: "13", label: "13", type: "number", maxInput: 9 },
  { id: "14", label: "14", type: "number", maxInput: 9 },
  { id: "D", label: "Doubles", type: "doubles", maxInput: 180 },
  { id: "15", label: "15", type: "number", maxInput: 9 },
  { id: "16", label: "16", type: "number", maxInput: 9 },
  { id: "T", label: "Triples", type: "triples", maxInput: 180 },
  { id: "17", label: "17", type: "number", maxInput: 9 },
  { id: "18", label: "18", type: "number", maxInput: 9 },
  { id: "41", label: "41", type: "exact", maxInput: 1 },
  { id: "19", label: "19", type: "number", maxInput: 9 },
  { id: "20", label: "20", type: "number", maxInput: 9 },
  { id: "B", label: "Bull", type: "bull", maxInput: 3 },
] as const;

// Cricket targets
export const CRICKET_TARGETS = [
  "20",
  "19",
  "18",
  "17",
  "16",
  "15",
  "B",
] as const;

export type CricketTarget = (typeof CRICKET_TARGETS)[number];

export interface CricketScore {
  marks: number; // 0-3 marks
  points: number; // Points scored on this target
}

export const CRICKET_POINTS: Record<CricketTarget, number> = {
  "20": 20,
  "19": 19,
  "18": 18,
  "17": 17,
  "16": 16,
  "15": 15,
  B: 25,
};
