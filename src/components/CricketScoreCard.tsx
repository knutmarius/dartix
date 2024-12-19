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
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useGame } from "../context/GameContext";
import { CRICKET_TARGETS } from "../types/game";
import { useState } from "react";

function getTargetHelp(target: string): string {
  if (target === "B") {
    return "Enter number of bulls hit (both inner and outer count as 1)";
  }
  return `Enter number of ${target}s hit (singles count as 1, doubles as 2, triples as 3)`;
}

export function CricketScoreCard() {
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
                <th style={{ width: "120px" }}>Target</th>
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
              {CRICKET_TARGETS.map((target, roundIndex) => (
                <tr key={target}>
                  <td>
                    <Tooltip
                      label={getTargetHelp(target)}
                      position="right"
                      multiline
                      width={300}
                    >
                      <Text size="md">{target === "B" ? "Bull" : target}</Text>
                    </Tooltip>
                  </td>
                  {state.players.map((player, playerIndex) => (
                    <td key={player.id}>
                      <NumberInput
                        value={player.cricketScores?.[target] ?? null}
                        onChange={(value) =>
                          handleScoreChange(
                            player.id,
                            roundIndex,
                            playerIndex,
                            value
                          )
                        }
                        min={0}
                        max={9}
                        placeholder=""
                        hideControls
                        allowDecimal={false}
                        clampBehavior="strict"
                        styles={(theme) => ({
                          input: {
                            width: "80px",
                            backgroundColor: !player.cricketScores?.[target]
                              ? undefined
                              : player.cricketScores[target] === 0
                              ? theme.colors.red[1]
                              : player.cricketScores[target] >= 3
                              ? theme.colors.green[1]
                              : theme.colors.yellow[1],
                            fontSize: "1.1rem",
                            textAlign: "center",
                            padding: "0.5rem",
                            margin: "0 auto",
                            color:
                              player.cricketScores?.[target] !== undefined
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
