import {
  Group,
  Container,
  AppShell,
  ActionIcon,
  Popover,
  Stack,
  Switch,
  Select,
  Text,
} from "@mantine/core";
import { IconSettings, IconSun, IconMoon } from "@tabler/icons-react";
import { Logo } from "./Logo";
import { useState } from "react";
import { useGame } from "../context/GameContext";
import { GameMode } from "../types/game";

interface AppBarProps {
  onToggleTheme: () => void;
  isDark: boolean;
}

export function AppBar({ onToggleTheme, isDark }: AppBarProps) {
  const [opened, setOpened] = useState(false);
  const { state, dispatch } = useGame();

  const handleGameModeChange = (value: GameMode | null) => {
    if (value) {
      dispatch({ type: "SET_GAME_MODE", payload: value });
    }
  };

  return (
    <AppShell.Header>
      <Container fluid style={{ height: "100%" }}>
        <div style={{ position: "relative", height: "100%" }}>
          <Group justify="center" align="center" style={{ height: "100%" }}>
            <Logo />
          </Group>
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            <Popover
              opened={opened}
              onChange={setOpened}
              position="bottom-end"
              offset={5}
            >
              <Popover.Target>
                <ActionIcon
                  variant="subtle"
                  onClick={() => setOpened((o) => !o)}
                  size="xl"
                >
                  <IconSettings size="1.5rem" />
                </ActionIcon>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="md">
                  <div>
                    <Text size="sm" mb={4}>
                      Game Mode
                    </Text>
                    <Select
                      value={state.gameMode}
                      onChange={handleGameModeChange}
                      data={[
                        { value: "halfit", label: "Half-It" },
                        { value: "cricket", label: "Cricket" },
                        { value: "501", label: "501" },
                      ]}
                    />
                  </div>
                  <Group gap="sm">
                    <IconSun size="1.2rem" />
                    <Switch
                      checked={isDark}
                      onChange={onToggleTheme}
                      size="md"
                    />
                    <IconMoon size="1.2rem" />
                  </Group>
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </div>
        </div>
      </Container>
    </AppShell.Header>
  );
}
