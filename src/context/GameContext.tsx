import { createContext, useContext, useReducer, ReactNode } from "react";
import {
  GameState,
  GameAction,
  Player,
  MIN_PLAYERS,
  MAX_PLAYERS,
  HALFIT_ROUNDS,
  CRICKET_TARGETS,
  CRICKET_POINTS,
} from "../types/game";

const initialState: GameState = {
  players: [],
  currentRound: 0,
  isGameComplete: false,
  gameMode: "halfit",
};

function calculateHalfItScore(
  inputs: (number | null)[],
  roundIndex: number
): number {
  if (inputs[roundIndex] === null) return 0;
  const round = HALFIT_ROUNDS[roundIndex];
  const input = inputs[roundIndex]!;

  switch (round.type) {
    case "number":
      return input * Number(round.id);
    case "doubles":
      return input * 2;
    case "triples":
      return input * 3;
    case "exact":
      return input === 1 ? 41 : 0;
    case "bull":
      return input * 25;
    default:
      return 0;
  }
}

function calculateCricketScore(player: Player, allPlayers: Player[]): number {
  if (!player.cricketScores) return 0;

  let totalScore = 0;

  // Calculate points for each target
  for (const target of CRICKET_TARGETS) {
    const marks = player.cricketScores[target] || 0;
    if (marks >= 3) {
      // Check if any other player hasn't closed this number
      const isOpen = allPlayers.some(
        (p) =>
          p.id !== player.id &&
          (!p.cricketScores || (p.cricketScores[target] || 0) < 3)
      );

      if (isOpen) {
        // Calculate points for marks beyond 3
        const extraMarks = player.cricketScores[target] - 3;
        if (extraMarks > 0) {
          totalScore += extraMarks * CRICKET_POINTS[target];
        }
      }
    }
  }

  return totalScore;
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ADD_PLAYER": {
      if (state.players.length >= MAX_PLAYERS) return state;

      const newPlayer: Player = {
        id: crypto.randomUUID(),
        name: action.payload,
        inputs: Array(
          state.gameMode === "halfit"
            ? HALFIT_ROUNDS.length
            : CRICKET_TARGETS.length
        ).fill(null),
        totalScore: 0,
        cricketScores: state.gameMode === "cricket" ? {} : undefined,
      };

      return {
        ...state,
        players: [...state.players, newPlayer],
      };
    }

    case "REMOVE_PLAYER": {
      if (state.players.length <= MIN_PLAYERS) return state;

      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.payload),
      };
    }

    case "UPDATE_SCORE": {
      const { playerId, roundIndex, input } = action.payload;
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) return state;

      const updatedPlayers = [...state.players];
      const player = { ...updatedPlayers[playerIndex] };
      player.inputs[roundIndex] = input;

      // Calculate total score based on game mode
      if (state.gameMode === "halfit") {
        player.totalScore = player.inputs.reduce(
          (total, _, index) =>
            total + calculateHalfItScore(player.inputs, index),
          0
        );
      } else {
        // Update cricket scores
        if (!player.cricketScores) player.cricketScores = {};
        const target = CRICKET_TARGETS[roundIndex];
        player.cricketScores[target] = input ?? 0;

        // Recalculate scores for all players
        updatedPlayers[playerIndex] = player;
        updatedPlayers.forEach((p) => {
          p.totalScore = calculateCricketScore(p, updatedPlayers);
        });
      }

      // Check if game is complete
      const isComplete =
        state.gameMode === "halfit"
          ? player.inputs.every((input) => input !== null)
          : Object.values(player.cricketScores).every((marks) => marks >= 3);

      return {
        ...state,
        players: updatedPlayers,
        isGameComplete: isComplete,
      };
    }

    case "RESET_GAME":
      return initialState;

    case "SET_GAME_MODE":
      return {
        ...initialState,
        gameMode: action.payload,
      };

    default:
      return state;
  }
}

const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
} | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
}
