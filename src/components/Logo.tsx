import { Group, Text, useMantineColorScheme } from "@mantine/core";
import { IconTarget } from "@tabler/icons-react";

export function Logo() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Group gap={6} align="center">
      <Text
        size="28px"
        fw={800}
        style={(theme) => ({
          fontFamily: theme.headings.fontFamily,
          background: isDark
            ? `linear-gradient(135deg, ${theme.colors.blue[3]} 0%, ${theme.colors.red[3]} 100%)`
            : `linear-gradient(135deg, ${theme.colors.blue[5]} 0%, ${theme.colors.red[5]} 100%)`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          position: "relative",
          letterSpacing: "0.5px",
          filter: isDark ? "brightness(1.2)" : "none",
        })}
      >
        Dart
        <Text
          component="span"
          inherit
          style={{
            position: "relative",
            "&::after": {
              content: '""',
              position: "absolute",
              right: "-6px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "currentColor",
            },
          }}
        >
          i
        </Text>
        X
      </Text>
      <IconTarget
        size={36}
        style={{
          color: isDark ? "#ff6b6b" : "#e03131",
          transform: "rotate(-45deg)",
          filter: isDark ? "brightness(1.2)" : "none",
        }}
      />
    </Group>
  );
}
