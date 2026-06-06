// Team-season visual identity for card theming.
export interface TeamTheme {
  primary: string;
  accent: string;
}

const THEMES: Record<string, TeamTheme> = {
  NE: { primary: "#002244", accent: "#C60C30" },
  CHI: { primary: "#0B162A", accent: "#C83803" },
  STL: { primary: "#13264B", accent: "#C9A14A" },
  SEA: { primary: "#002244", accent: "#69BE28" },
  KC: { primary: "#9B1C2E", accent: "#FFB81C" },
  TB: { primary: "#A8120B", accent: "#FF7900" },
  SF: { primary: "#7A0010", accent: "#C8AA76" },
  BAL: { primary: "#241773", accent: "#9E7C0C" },
};

const FALLBACK: TeamTheme = { primary: "#1f2937", accent: "#60a5fa" };

export function teamTheme(teamCode: string): TeamTheme {
  return THEMES[teamCode] ?? FALLBACK;
}
