import {
  Container,
  AppShell,
  MantineProvider,
  createTheme,
  Stack,
  ColorSchemeScript,
} from "@mantine/core";
import { PlayerRegistration } from "./components/PlayerRegistration";
import { ScoreCard } from "./components/ScoreCard";
import { CricketScoreCard } from "./components/CricketScoreCard";
import { FiveHundredOneScoreCard } from "./components/FiveHundredOneScoreCard";
import { GameProvider, useGame } from "./context/GameContext";
import { AppBar } from "./components/AppBar";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
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
  switch (state.gameMode) {
    case "halfit":
      return <ScoreCard />;
    case "cricket":
      return <CricketScoreCard />;
    case "501":
      return <FiveHundredOneScoreCard />;
  }
}

export default function App() {
  const [isDark, setIsDark] = useState(false);

  return (
    <>
      <ColorSchemeScript />
      <MantineProvider
        theme={{
          ...theme,
          colorScheme: isDark ? "dark" : "light",
        }}
        defaultColorScheme="light"
      >
        <GameProvider>
          <AppShell header={{ height: 60 }} padding="md">
            <AppShell.Header>
              <AppBar
                onToggleTheme={() => setIsDark((d) => !d)}
                isDark={isDark}
              />
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
