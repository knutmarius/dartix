import { Group, Container, AppShell } from "@mantine/core";
import { Logo } from "./Logo";

export function AppBar() {
  return (
    <AppShell.Header height={60}>
      <Container fluid style={{ height: "100%" }}>
        <Group justify="center" align="center" style={{ height: "100%" }}>
          <Logo />
        </Group>
      </Container>
    </AppShell.Header>
  );
}
