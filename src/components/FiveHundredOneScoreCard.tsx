import {
  NumberInput,
  Table,
  Text,
  Stack,
  Paper,
  Box,
  ActionIcon,
  Group,
  Modal,
  Button,
  Tooltip,
  Center,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useGame } from "../context/GameContext";
import { FIVEHUNDREDONE_ROUNDS, CHECKOUT_SUGGESTIONS } from "../types/game";
import { useState, useMemo } from "react";

function getCheckoutSuggestion(remaining: number): string {
  if (remaining > 170) return "";
  if (remaining < 2) return "";
  if (remaining in CHECKOUT_SUGGESTIONS) {
    return CHECKOUT_SUGGESTIONS[remaining].join(" → ");
  }
  // For numbers without predefined checkouts, provide a simple suggestion
  if (remaining <= 40 && remaining % 2 === 0) {
    return `D${remaining / 2}`;
  }
  return "";
}

export function FiveHundredOneScoreCard() {
  const { state, dispatch } = useGame();
  const [playerToRemove, setPlayerToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Calculate the number of rounds needed based on filled inputs
  const rounds = useMemo(() => {
    const maxFilledRound = state.players.reduce((maxRound, player) => {
      const lastFilledIndex = player.inputs.reduce(
        (lastIndex, input, index) => {
          return input !== null ? index : lastIndex;
        },
        -1
      );
      return Math.max(maxRound, lastFilledIndex);
    }, -1);

    // Always show at least one round, and add one more if all current rounds are filled
    const numRounds = Math.max(1, maxFilledRound + 2);
    return Array.from({ length: numRounds }, (_, i) =>
      FIVEHUNDREDONE_ROUNDS.createRound(i)
    );
  }, [state.players]);

  const handleScoreChange = (
    playerId: string,
    roundIndex: number,
    playerIndex: number,
    input: number | undefined
  ) => {
    dispatch({
      type: "UPDATE_SCORE",
      payload: { playerId, roundIndex, input: input ?? null },
    });
  };

  const handleRemovePlayer = () => {
    if (playerToRemove) {
      dispatch({ type: "REMOVE_PLAYER", payload: playerToRemove.id });
      setPlayerToRemove(null);
    }
  };

  if (state.players.length === 0) {
    return (
      <Paper>
        <Center>
          <Text size="lg" c="dimmed">
            Add at least one player to start the game. Change game mode in
            settings.
          </Text>
        </Center>
      </Paper>
    );
  }

  return (
    <Stack spacing="xl">
      <Paper>
        <Box sx={{ overflowX: "auto" }}>
          <Table
            striped
            highlightOnHover
            withBorder
            withColumnBorders
            fontSize="md"
            sx={(theme) => ({
              "& thead th": {
                backgroundColor: theme.colors.gray[0],
                fontWeight: 600,
                fontSize: "1.1rem",
                padding: "1rem",
                textAlign: "center",
                whiteSpace: "nowrap",
                minWidth: "130px",
              },
              "& thead th:first-child": {
                textAlign: "left",
              },
              "& tbody td": {
                padding: "0.75rem 1rem",
                textAlign: "center",
              },
              "& tbody td:first-child": {
                textAlign: "left",
              },
              "& tbody tr:hover": {
                backgroundColor: theme.colors.blue[0],
              },
            })}
          >
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Round</th>
                {state.players.map((player) => (
                  <th key={player.id}>
                    <Group
                      justify="space-between"
                      align="center"
                      style={{
                        width: "80px",
                        margin: "0 auto",
                      }}
                    >
                      <Text
                        style={{
                          flex: 1,
                          textAlign: "center",
                          marginRight: "4px",
                          maxWidth: "calc(100% - 24px)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        truncate
                      >
                        {player.name}
                      </Text>
                      <ActionIcon
                        color="red"
                        variant="subtle"
                        onClick={() =>
                          setPlayerToRemove({
                            id: player.id,
                            name: player.name,
                          })
                        }
                        size="sm"
                        style={{
                          flexShrink: 0,
                          width: "20px",
                          height: "20px",
                        }}
                      >
                        <IconTrash size="1rem" />
                      </ActionIcon>
                    </Group>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rounds.map((round, roundIndex) => (
                <tr key={round.id}>
                  <td>
                    <Text
                      weight={
                        roundIndex === state.currentRound ? "bold" : "normal"
                      }
                      size="md"
                      color={
                        roundIndex === state.currentRound ? "blue" : "inherit"
                      }
                    >
                      {round.label}
                    </Text>
                  </td>
                  {state.players.map((player, playerIndex) => (
                    <td key={player.id}>
                      <NumberInput
                        value={player.inputs[roundIndex] ?? null}
                        onChange={(value) =>
                          handleScoreChange(
                            player.id,
                            roundIndex,
                            playerIndex,
                            value
                          )
                        }
                        min={0}
                        max={round.maxInput}
                        placeholder=""
                        hideControls
                        allowDecimal={false}
                        clampBehavior="strict"
                        styles={(theme) => ({
                          input: {
                            width: "80px",
                            backgroundColor:
                              player.inputs[roundIndex] === null ||
                              player.inputs[roundIndex] === undefined
                                ? undefined
                                : player.inputs[roundIndex] === 0
                                ? theme.colors.red[1]
                                : theme.colors.green[1],
                            border:
                              roundIndex === state.currentRound
                                ? `2px solid ${theme.colors.blue[6]}`
                                : undefined,
                            fontSize: "1.1rem",
                            textAlign: "center",
                            padding: "0.5rem",
                            margin: "0 auto",
                            color:
                              player.inputs[roundIndex] !== null &&
                              player.inputs[roundIndex] !== undefined
                                ? theme.black
                                : undefined,
                            "&:focus": {
                              backgroundColor: "#fff",
                              borderColor: theme.colors.blue[6],
                              color: theme.black,
                            },
                          },
                          wrapper: {
                            width: "80px",
                            margin: "0 auto",
                          },
                        })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>
                  <Text weight="bold" size="lg">
                    Remaining
                  </Text>
                </td>
                {state.players.map((player) => (
                  <td key={player.id}>
                    <Stack spacing={4} align="center">
                      <Text weight="bold" size="lg" color="blue">
                        {501 - player.totalScore}
                      </Text>
                      {getCheckoutSuggestion(501 - player.totalScore) && (
                        <Tooltip
                          label="Suggested checkout"
                          position="bottom"
                          withArrow
                        >
                          <Text size="xs" color="dimmed">
                            {getCheckoutSuggestion(501 - player.totalScore)}
                          </Text>
                        </Tooltip>
                      )}
                    </Stack>
                  </td>
                ))}
              </tr>
            </tbody>
          </Table>
        </Box>
      </Paper>

      {state.isGameComplete && (
        <Paper bg="teal.0">
          <Text size="xl" weight="bold" color="teal" align="center">
            🎯 Game Complete! Winner:{" "}
            {
              state.players.reduce((prev, current) =>
                prev.totalScore > current.totalScore ? prev : current
              ).name
            }
          </Text>
        </Paper>
      )}

      <Modal
        opened={!!playerToRemove}
        onClose={() => setPlayerToRemove(null)}
        title="Remove Player"
        centered
      >
        <Stack>
          <Text>Are you sure you want to remove {playerToRemove?.name}?</Text>
          <Group position="right">
            <Button variant="subtle" onClick={() => setPlayerToRemove(null)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleRemovePlayer}>
              Remove
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
