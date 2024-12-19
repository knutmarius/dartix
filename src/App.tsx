import {
  MantineProvider,
  Container,
  Stack,
  Button,
  createTheme,
  MantineColorsTuple,
} from "@mantine/core";
import { GameProvider, useGame } from "./context/GameContext";
import { PlayerRegistration } from "./components/PlayerRegistration";
import { ScoreCard } from "./components/ScoreCard";
import "@fontsource/inter";

const myColor: MantineColorsTuple = [
  "#E3F2FD",
  "#BBDEFB",
  "#90CAF9",
  "#64B5F6",
  "#42A5F5",
  "#2196F3",
  "#1E88E5",
  "#1976D2",
  "#1565C0",
  "#0D47A1",
];

const theme = createTheme({
  primaryColor: "blue",
  colors: {
    blue: myColor,
  },
  fontFamily: "Inter, sans-serif",
  defaultRadius: "md",
  components: {
    Button: {
      defaultProps: {
        size: "md",
      },
      styles: {
        root: {
          fontWeight: 600,
        },
      },
    },
    Container: {
      defaultProps: {
        size: "lg",
      },
    },
    Paper: {
      defaultProps: {
        p: "xl",
        radius: "md",
        withBorder: true,
      },
    },
    Title: {
      styles: {
        root: {
          fontWeight: 700,
        },
      },
    },
    Table: {
      styles: {
        root: {
          "& thead th": {
            fontWeight: 600,
            fontSize: "1.1rem",
            padding: "1rem",
            textAlign: "center",
            backgroundColor: "var(--mantine-color-gray-0)",
          },
          "& tbody td": {
            padding: "0.75rem 1rem",
            textAlign: "center",
          },
          "& tbody tr:hover": {
            backgroundColor: "var(--mantine-color-blue-0)",
          },
        },
      },
    },
  },
});

function GameContent() {
  const { state, dispatch } = useGame();

  return (
    <Stack spacing="xl">
      <Container size="md" py="xl">
        <Stack spacing={40}>
          <PlayerRegistration />
          {state.players.length > 0 && <ScoreCard />}
          {(state.players.length > 0 || state.isGameComplete) && (
            <Button
              color="red"
              variant="light"
              onClick={() => dispatch({ type: "RESET_GAME" })}
              fullWidth
            >
              Reset Game
            </Button>
          )}
        </Stack>
      </Container>
    </Stack>
  );
}

export default function App() {
  return (
    <MantineProvider theme={theme}>
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "var(--mantine-color-gray-0)",
          paddingTop: "2rem",
          paddingBottom: "2rem",
        }}
      >
        <GameProvider>
          <GameContent />
        </GameProvider>
      </div>
    </MantineProvider>
  );
}
