import { useState } from "react";
import { TextInput, Button, Group } from "@mantine/core";
import { useGame } from "../context/GameContext";
import { MAX_PLAYERS, MIN_PLAYERS } from "../types/game";

export function PlayerRegistration() {
  const [playerName, setPlayerName] = useState("");
  const { state, dispatch } = useGame();

  const handleAddPlayer = () => {
    if (playerName.trim() && state.players.length < MAX_PLAYERS) {
      dispatch({ type: "ADD_PLAYER", payload: playerName.trim() });
      setPlayerName("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      playerName.trim() &&
      state.players.length < MAX_PLAYERS
    ) {
      handleAddPlayer();
    }
  };

  return (
    <Group align="flex-end" grow>
      <TextInput
        label="Player Name"
        placeholder="Enter player name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
        onKeyPress={handleKeyPress}
        disabled={state.players.length >= MAX_PLAYERS}
        styles={{
          input: {
            fontSize: "1rem",
          },
          label: {
            fontSize: "1rem",
          },
        }}
      />
      <Button
        onClick={handleAddPlayer}
        disabled={!playerName.trim() || state.players.length >= MAX_PLAYERS}
        style={{ marginBottom: "1px" }}
      >
        Add Player
      </Button>
    </Group>
  );
}
