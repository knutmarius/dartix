import {
  NumberInput,
  Table,
  Title,
  Text,
  Stack,
  Paper,
  Tooltip,
  Box,
} from "@mantine/core";
import { useGame } from "../context/GameContext";
import { ROUNDS } from "../types/game";
import { useRef } from "react";

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
  const inputRefs = useRef<(HTMLInputElement | null)[][]>(
    Array(ROUNDS.length)
      .fill(null)
      .map(() => Array(state.players.length).fill(null))
  );

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

    // Auto-tab for single-digit inputs (all rounds except doubles and triples)
    const round = ROUNDS[roundIndex];
    if (
      input !== undefined &&
      round.type !== "doubles" &&
      round.type !== "triples"
    ) {
      // Find next input position
      let nextRound = roundIndex;
      let nextPlayer = playerIndex + 1;

      // If we're at the last player, move to next round
      if (nextPlayer >= state.players.length) {
        nextPlayer = 0;
        nextRound++;
      }

      // If we have a next input, focus it
      if (nextRound < ROUNDS.length) {
        const nextInput = inputRefs.current[nextRound]?.[nextPlayer];
        if (nextInput) {
          nextInput.focus();
        }
      }
    }
  };

  return (
    <Stack spacing="xl">
      <Paper>
        <Stack spacing="lg">
          <Title order={2} align="center">
            Score Card
          </Title>

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
                },
                "& tbody td": {
                  padding: "0.75rem 1rem",
                  textAlign: "center",
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
                    <th key={player.id}>{player.name}</th>
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
                            roundIndex === state.currentRound
                              ? "bold"
                              : "normal"
                          }
                          size="md"
                          color={
                            roundIndex === state.currentRound
                              ? "blue"
                              : "inherit"
                          }
                        >
                          {round.label}
                        </Text>
                      </Tooltip>
                    </td>
                    {state.players.map((player, playerIndex) => (
                      <td key={player.id}>
                        <NumberInput
                          ref={(el) => {
                            if (el) {
                              inputRefs.current[roundIndex][playerIndex] =
                                el.querySelector("input");
                            }
                          }}
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
                              backgroundColor: theme.colors.gray[0],
                              border:
                                roundIndex === state.currentRound
                                  ? `2px solid ${theme.colors.blue[6]}`
                                  : undefined,
                              fontSize: "1.1rem",
                              textAlign: "center",
                              padding: "0.5rem",
                              margin: "0 auto",
                              "&:focus": {
                                backgroundColor: "#fff",
                                borderColor: theme.colors.blue[6],
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
        </Stack>
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
    </Stack>
  );
}
