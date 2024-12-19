import {
  Container,
  AppShell,
  MantineProvider,
  createTheme,
  Stack,
} from "@mantine/core";
import { PlayerRegistration } from "./components/PlayerRegistration";
import { ScoreCard } from "./components/ScoreCard";
import { GameProvider } from "./context/GameContext";
import { AppBar } from "./components/AppBar";
import "@fontsource/inter";

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

export default function App() {
  return (
    <MantineProvider theme={theme}>
      <GameProvider>
        <AppShell header={{ height: 60 }} padding="md">
          <AppShell.Header>
            <AppBar />
          </AppShell.Header>

          <AppShell.Main>
            <Container size="xs" py={80}>
              <Stack gap="xl">
                <PlayerRegistration />
                <ScoreCard />
              </Stack>
            </Container>
          </AppShell.Main>
        </AppShell>
      </GameProvider>
    </MantineProvider>
  );
}
