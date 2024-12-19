export type Player = {
  id: string;
  name: string;
  inputs: number[];
  scores: number[];
  totalScore: number;
};

export type GameState = {
  players: Player[];
  currentRound: number;
  isGameComplete: boolean;
};

export type RoundType = "number" | "doubles" | "triples" | "fortyOne" | "bull";

export const ROUNDS = [
  {
    id: "13",
    label: "13",
    type: "number" as RoundType,
    value: 13,
    maxInput: 9,
  },
  {
    id: "14",
    label: "14",
    type: "number" as RoundType,
    value: 14,
    maxInput: 9,
  },
  {
    id: "D",
    label: "Doubles",
    type: "doubles" as RoundType,
    value: 2,
    maxInput: 60,
  },
  {
    id: "15",
    label: "15",
    type: "number" as RoundType,
    value: 15,
    maxInput: 9,
  },
  {
    id: "16",
    label: "16",
    type: "number" as RoundType,
    value: 16,
    maxInput: 9,
  },
  {
    id: "T",
    label: "Triples",
    type: "triples" as RoundType,
    value: 3,
    maxInput: 60,
  },
  {
    id: "17",
    label: "17",
    type: "number" as RoundType,
    value: 17,
    maxInput: 9,
  },
  {
    id: "18",
    label: "18",
    type: "number" as RoundType,
    value: 18,
    maxInput: 9,
  },
  {
    id: "41",
    label: "41",
    type: "fortyOne" as RoundType,
    value: 41,
    maxInput: 1,
  },
  {
    id: "19",
    label: "19",
    type: "number" as RoundType,
    value: 19,
    maxInput: 9,
  },
  {
    id: "20",
    label: "20",
    type: "number" as RoundType,
    value: 20,
    maxInput: 9,
  },
  { id: "B", label: "Bull", type: "bull" as RoundType, value: 25, maxInput: 6 },
] as const;

export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 1;

export function calculateRoundScore(
  round: (typeof ROUNDS)[number],
  hits: number
): number {
  switch (round.type) {
    case "number":
      return hits * round.value;
    case "doubles":
      return hits * 2;
    case "triples":
      return hits * 3;
    case "fortyOne":
      return hits === 1 ? 41 : 0;
    case "bull":
      return hits * 25;
    default:
      return 0;
  }
}
