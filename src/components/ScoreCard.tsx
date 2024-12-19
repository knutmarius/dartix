import {
  NumberInput,
  Table,
  Text,
  Stack,
  Paper,
  Tooltip,
  Box,
  ActionIcon,
  Group,
  Modal,
  Button,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useGame } from "../context/GameContext";
import { ROUNDS } from "../types/game";
import { useState } from "react";

function getRoundHelp(roundId: string): string {
  switch (roundId) {
    case "D":
      return "Enter the sum of the numbers you hit in doubles (e.g., for 3xD20, enter 60 to score 120 points)";
    case "T":
      return "Enter the sum of the numbers you hit in triples (e.g., for 3xT20, enter 60 to score 180 points)";
    case "41":
      return "Enter 1 if you hit exactly 41 with three darts, 0 if you missed (scores 41 or 0 points)";
    case "B":
      return "Enter number of bulls hit (2 for green + red = 75 points, 3 for green + 2 red = 125 points)";
    default:
      return `Enter number of ${roundId}s hit (1 hit = ${Number(
        roundId
      )} points, max 9 hits = ${Number(roundId) * 9} points)`;
  }
}

export function ScoreCard() {
  const { state, dispatch } = useGame();
  const [playerToRemove, setPlayerToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

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
              "& thead th:not(:first-child)": {
                "& .mantine-Group-root": {
                  width: "80px",
                  margin: "0 auto",
                },
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
                <th style={{ width: "120px", textAlign: "left" }}>Round</th>
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
              {ROUNDS.map((round, roundIndex) => (
                <tr key={round.id}>
                  <td>
                    <Tooltip
                      label={getRoundHelp(round.id)}
                      position="right"
                      multiline
                      width={300}
                    >
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
                    </Tooltip>
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
                    Total
                  </Text>
                </td>
                {state.players.map((player) => (
                  <td key={player.id} style={{ width: "80px" }}>
                    <div
                      style={{
                        width: "80px",
                        margin: "0 auto",
                        textAlign: "center",
                      }}
                    >
                      <Text weight="bold" size="lg" color="blue">
                        {player.totalScore}
                      </Text>
                    </div>
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
