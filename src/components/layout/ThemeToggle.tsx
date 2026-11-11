import { Monitor, Moon, Sun } from "lucide-react";
import {
  nextThemePreference,
  useTheme,
  type ThemePreference,
} from "@/lib/theme";

const LABELS: Record<ThemePreference, string> = {
  light: "밝게",
  dark: "어둡게",
  system: "기기 설정",
};

const ICONS: Record<ThemePreference, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/** Cycles light → dark → system, matching the nav-item styling. */
export function ThemeToggle() {
  const theme = useTheme();
  const Icon = ICONS[theme.preference];

  return (
    <button
      type="button"
      onClick={theme.cycle}
      aria-label={`현재 화면 테마: ${LABELS[theme.preference]}. ${
        LABELS[nextThemePreference(theme.preference)]
      } 테마로 전환`}
      className="flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <Icon className="h-4 w-4" aria-hidden />
      화면 테마
      <span className="ml-auto text-xs">{LABELS[theme.preference]}</span>
    </button>
  );
}
