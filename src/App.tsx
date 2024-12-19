import {
  Container,
  AppShell,
  MantineProvider,
  createTheme,
  Stack,
  ColorSchemeScript,
  ColorScheme,
} from "@mantine/core";
import { PlayerRegistration } from "./components/PlayerRegistration";
import { ScoreCard } from "./components/ScoreCard";
import { CricketScoreCard } from "./components/CricketScoreCard";
import { GameProvider, useGame } from "./context/GameContext";
import { AppBar } from "./components/AppBar";
import "@fontsource/inter";
import { useState } from "react";

const theme = createTheme({
  fontFamily: "Inter, sans-serif",
  primaryColor: "blue",
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
    Paper: {
      defaultProps: {
        p: "xl",
        radius: "md",
        withBorder: true,
      },
    },
  },
});

function GameContent() {
  const { state } = useGame();
  return state.gameMode === "halfit" ? <ScoreCard /> : <CricketScoreCard />;
}

export default function App() {
  const [colorScheme, setColorScheme] = useState<ColorScheme>("light");

  const toggleColorScheme = (value?: ColorScheme) => {
    const nextColorScheme =
      value || (colorScheme === "dark" ? "light" : "dark");
    setColorScheme(nextColorScheme);
  };

  return (
    <>
      <ColorSchemeScript />
      <MantineProvider
        theme={{ ...theme, colorScheme }}
        defaultColorScheme="light"
      >
        <GameProvider>
          <AppShell header={{ height: 60 }} padding="md">
            <AppShell.Header>
              <AppBar />
            </AppShell.Header>

            <AppShell.Main>
              <Container size="xs" py={80}>
                <Stack gap="xl">
                  <PlayerRegistration />
                  <GameContent />
                </Stack>
              </Container>
            </AppShell.Main>
          </AppShell>
        </GameProvider>
      </MantineProvider>
    </>
  );
}
