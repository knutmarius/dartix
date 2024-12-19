import { useState } from "react";
import {
  TextInput,
  Button,
  Group,
  Stack,
  Title,
  Text,
  Paper,
  ActionIcon,
  Box,
} from "@mantine/core";
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

  const handleRemovePlayer = (playerId: string) => {
    dispatch({ type: "REMOVE_PLAYER", payload: playerId });
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

  const canStartGame = state.players.length >= MIN_PLAYERS;

  return (
    <Paper shadow="sm" p="xl" radius="md" withBorder>
      <Stack spacing="lg">
        <Title order={2} align="center" mb="md">
          Half-It Dart Game
        </Title>

        <Box>
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
              disabled={
                !playerName.trim() || state.players.length >= MAX_PLAYERS
              }
              style={{ marginBottom: "1px" }}
            >
              Add Player
            </Button>
          </Group>

          {!canStartGame && (
            <Text color="red" size="sm" mt="xs">
              Add at least {MIN_PLAYERS} player{MIN_PLAYERS > 1 ? "s" : ""} to
              start the game
            </Text>
          )}
        </Box>

        {state.players.length > 0 && (
          <Paper withBorder p="md" radius="md">
            <Title order={4} mb="md">
              Players
            </Title>
            <Stack spacing="xs">
              {state.players.map((player) => (
                <Group
                  key={player.id}
                  position="apart"
                  p="xs"
                  style={{ backgroundColor: "#f8f9fa", borderRadius: "4px" }}
                >
                  <Text size="lg">{player.name}</Text>
                  <Button
                    variant="subtle"
                    color="red"
                    onClick={() => handleRemovePlayer(player.id)}
                    compact
                  >
                    Remove
                  </Button>
                </Group>
              ))}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
}
