import {
  Group,
  Container,
  AppShell,
  ActionIcon,
  Popover,
  Stack,
  Switch,
  useMantineColorScheme,
} from "@mantine/core";
import { IconSettings, IconSun, IconMoon } from "@tabler/icons-react";
import { Logo } from "./Logo";
import { useState } from "react";

export function AppBar() {
  const [opened, setOpened] = useState(false);
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  return (
    <AppShell.Header height={60}>
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
                <Stack gap="sm">
                  <Group gap="sm">
                    <IconSun size="1.2rem" />
                    <Switch
                      checked={colorScheme === "dark"}
                      onChange={() => toggleColorScheme()}
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
