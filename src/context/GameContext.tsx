import { createContext, useContext, useReducer, ReactNode } from "react";
import { GameState, Player, ROUNDS, calculateRoundScore } from "../types/game";

type GameAction =
  | { type: "ADD_PLAYER"; payload: string }
  | { type: "REMOVE_PLAYER"; payload: string }
  | {
      type: "UPDATE_SCORE";
      payload: { playerId: string; roundIndex: number; input: number | null };
    }
  | { type: "RESET_GAME" };

const initialState: GameState = {
  players: [],
  currentRound: 0,
  isGameComplete: false,
};

function calculatePlayerScore(
  inputs: (number | undefined)[],
  scores: number[]
): number {
  let currentTotal = 0;

  // Only process rounds that have inputs
  for (let i = 0; i < inputs.length; i++) {
    if (inputs[i] !== undefined) {
      if (inputs[i] === 0) {
        // If we hit a zero, halve the current total and continue
        currentTotal = Math.floor(currentTotal / 2);
      } else {
        // Add the score for this round
        currentTotal += scores[i];
      }
    }
  }

  return currentTotal;
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "ADD_PLAYER":
      const newPlayer: Player = {
        id: crypto.randomUUID(),
        name: action.payload,
        inputs: Array(ROUNDS.length).fill(undefined),
        scores: Array(ROUNDS.length).fill(0),
        totalScore: 0,
      };
      return {
        ...state,
        players: [...state.players, newPlayer],
      };

    case "REMOVE_PLAYER":
      return {
        ...state,
        players: state.players.filter((player) => player.id !== action.payload),
      };

    case "UPDATE_SCORE": {
      const updatedPlayers = state.players.map((player) => {
        if (player.id === action.payload.playerId) {
          const newInputs = [...player.inputs];
          const newScores = [...player.scores];

          // Update input and score for the changed round
          newInputs[action.payload.roundIndex] =
            action.payload.input ?? undefined;
          const roundScore =
            action.payload.input === null
              ? 0
              : calculateRoundScore(
                  ROUNDS[action.payload.roundIndex],
                  action.payload.input
                );
          newScores[action.payload.roundIndex] = roundScore;

          // Recalculate total score considering all rounds
          const finalScore = calculatePlayerScore(newInputs, newScores);

          return {
            ...player,
            inputs: newInputs,
            scores: newScores,
            totalScore: finalScore,
          };
        }
        return player;
      });

      // Check if all rounds have inputs
      const allRoundsComplete = updatedPlayers.every((player) =>
        player.inputs.every((input) => input !== undefined)
      );

      return {
        ...state,
        players: updatedPlayers,
        isGameComplete: allRoundsComplete,
      };
    }

    case "RESET_GAME":
      return initialState;

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
