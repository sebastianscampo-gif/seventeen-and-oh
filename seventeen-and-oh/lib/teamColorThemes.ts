// Centralized team-inspired color palettes for the Team × Season lottery and the
// selected-roster panel. These are *team-inspired UI palettes only* — no official
// logos, no league imagery. The main site stays dark navy; only the selected team
// card, the locked-in badge, and the draft section pick up these colors.
//
// Requested path in the spec was `src/data/teamColorThemes.ts`; this project has no
// `src/` dir and uses the `@/*` → repo-root alias, so the module lives at
// `lib/teamColorThemes.ts` and is imported as `@/lib/teamColorThemes`.

export type TeamColorTheme = {
  teamCode: string;
  teamName: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  mutedText: string;
  border: string;
  glow: string;
  gradient: string;
};

export const DEFAULT_TEAM_THEME: TeamColorTheme = {
  teamCode: "DEFAULT",
  teamName: "Default",
  primary: "#020617",
  secondary: "#0F172A",
  accent: "#38BDF8",
  text: "#FFFFFF",
  mutedText: "#CBD5E1",
  border: "#38BDF8",
  glow: "rgba(56, 189, 248, 0.35)",
  gradient: "linear-gradient(135deg, #020617 0%, #0F172A 55%, #1E3A8A 100%)",
};

export const TEAM_COLOR_THEMES: Record<string, TeamColorTheme> = {
  ARI: {
    teamCode: "ARI",
    teamName: "Arizona Cardinals",
    primary: "#97233F",
    secondary: "#000000",
    accent: "#FFB612",
    text: "#FFFFFF",
    mutedText: "#F4D6DF",
    border: "#FFB612",
    glow: "rgba(151, 35, 63, 0.45)",
    gradient: "linear-gradient(135deg, #97233F 0%, #3A0A18 60%, #000000 100%)",
  },

  ATL: {
    teamCode: "ATL",
    teamName: "Atlanta Falcons",
    primary: "#A71930",
    secondary: "#000000",
    accent: "#A5ACAF",
    text: "#FFFFFF",
    mutedText: "#E7C8CF",
    border: "#A5ACAF",
    glow: "rgba(167, 25, 48, 0.45)",
    gradient: "linear-gradient(135deg, #A71930 0%, #000000 65%, #A5ACAF 100%)",
  },

  BAL: {
    teamCode: "BAL",
    teamName: "Baltimore Ravens",
    primary: "#241773",
    secondary: "#000000",
    accent: "#9E7C0C",
    text: "#FFFFFF",
    mutedText: "#D8D2F0",
    border: "#9E7C0C",
    glow: "rgba(158, 124, 12, 0.45)",
    gradient: "linear-gradient(135deg, #241773 0%, #000000 60%, #9E7C0C 100%)",
  },

  BUF: {
    teamCode: "BUF",
    teamName: "Buffalo Bills",
    primary: "#00338D",
    secondary: "#C60C30",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#DCE8FF",
    border: "#C60C30",
    glow: "rgba(0, 51, 141, 0.45)",
    gradient: "linear-gradient(135deg, #00338D 0%, #001B4F 60%, #C60C30 100%)",
  },

  CAR: {
    teamCode: "CAR",
    teamName: "Carolina Panthers",
    primary: "#0085CA",
    secondary: "#101820",
    accent: "#BFC0BF",
    text: "#FFFFFF",
    mutedText: "#D7F1FF",
    border: "#0085CA",
    glow: "rgba(0, 133, 202, 0.45)",
    gradient: "linear-gradient(135deg, #0085CA 0%, #101820 60%, #000000 100%)",
  },

  CHI: {
    teamCode: "CHI",
    teamName: "Chicago Bears",
    primary: "#0B162A",
    secondary: "#C83803",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#FFD8C8",
    border: "#C83803",
    glow: "rgba(200, 56, 3, 0.45)",
    gradient: "linear-gradient(135deg, #0B162A 0%, #030711 60%, #C83803 100%)",
  },

  CIN: {
    teamCode: "CIN",
    teamName: "Cincinnati Bengals",
    primary: "#FB4F14",
    secondary: "#000000",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#FFE1D5",
    border: "#FB4F14",
    glow: "rgba(251, 79, 20, 0.45)",
    gradient: "linear-gradient(135deg, #FB4F14 0%, #000000 70%, #1A1A1A 100%)",
  },

  CLE: {
    teamCode: "CLE",
    teamName: "Cleveland Browns",
    primary: "#311D00",
    secondary: "#FF3C00",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#FFD9C7",
    border: "#FF3C00",
    glow: "rgba(255, 60, 0, 0.45)",
    gradient: "linear-gradient(135deg, #311D00 0%, #1A0E00 60%, #FF3C00 100%)",
  },

  DAL: {
    teamCode: "DAL",
    teamName: "Dallas Cowboys",
    primary: "#003594",
    secondary: "#041E42",
    accent: "#869397",
    text: "#FFFFFF",
    mutedText: "#DDE7F5",
    border: "#869397",
    glow: "rgba(134, 147, 151, 0.45)",
    gradient: "linear-gradient(135deg, #003594 0%, #041E42 65%, #869397 100%)",
  },

  DEN: {
    teamCode: "DEN",
    teamName: "Denver Broncos",
    primary: "#FB4F14",
    secondary: "#002244",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#FFE0D2",
    border: "#FB4F14",
    glow: "rgba(251, 79, 20, 0.45)",
    gradient: "linear-gradient(135deg, #002244 0%, #001226 60%, #FB4F14 100%)",
  },

  DET: {
    teamCode: "DET",
    teamName: "Detroit Lions",
    primary: "#0076B6",
    secondary: "#B0B7BC",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#D9F0FF",
    border: "#B0B7BC",
    glow: "rgba(0, 118, 182, 0.45)",
    gradient: "linear-gradient(135deg, #0076B6 0%, #003B5C 60%, #B0B7BC 100%)",
  },

  GB: {
    teamCode: "GB",
    teamName: "Green Bay Packers",
    primary: "#203731",
    secondary: "#FFB612",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#FFF0C2",
    border: "#FFB612",
    glow: "rgba(255, 182, 18, 0.45)",
    gradient: "linear-gradient(135deg, #203731 0%, #0B1F1A 60%, #FFB612 100%)",
  },

  HOU: {
    teamCode: "HOU",
    teamName: "Houston Texans",
    primary: "#03202F",
    secondary: "#A71930",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#D9ECF5",
    border: "#A71930",
    glow: "rgba(167, 25, 48, 0.45)",
    gradient: "linear-gradient(135deg, #03202F 0%, #000000 60%, #A71930 100%)",
  },

  IND: {
    teamCode: "IND",
    teamName: "Indianapolis Colts",
    primary: "#002C5F",
    secondary: "#A2AAAD",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#D9E9FF",
    border: "#A2AAAD",
    glow: "rgba(0, 44, 95, 0.45)",
    gradient: "linear-gradient(135deg, #002C5F 0%, #001B3B 65%, #A2AAAD 100%)",
  },

  JAX: {
    teamCode: "JAX",
    teamName: "Jacksonville Jaguars",
    primary: "#006778",
    secondary: "#101820",
    accent: "#D7A22A",
    text: "#FFFFFF",
    mutedText: "#D6F6FA",
    border: "#D7A22A",
    glow: "rgba(0, 103, 120, 0.45)",
    gradient: "linear-gradient(135deg, #006778 0%, #101820 65%, #D7A22A 100%)",
  },

  KC: {
    teamCode: "KC",
    teamName: "Kansas City Chiefs",
    primary: "#E31837",
    secondary: "#FFB81C",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#FFE3E8",
    border: "#FFB81C",
    glow: "rgba(227, 24, 55, 0.45)",
    gradient: "linear-gradient(135deg, #E31837 0%, #7A0C1D 60%, #FFB81C 100%)",
  },

  LV: {
    teamCode: "LV",
    teamName: "Las Vegas Raiders",
    primary: "#000000",
    secondary: "#A5ACAF",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#D8DEE1",
    border: "#A5ACAF",
    glow: "rgba(165, 172, 175, 0.45)",
    gradient: "linear-gradient(135deg, #000000 0%, #111111 70%, #A5ACAF 100%)",
  },

  LAC: {
    teamCode: "LAC",
    teamName: "Los Angeles Chargers",
    primary: "#0080C6",
    secondary: "#FFC20E",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#E1F5FF",
    border: "#FFC20E",
    glow: "rgba(0, 128, 198, 0.45)",
    gradient: "linear-gradient(135deg, #0080C6 0%, #004F7A 60%, #FFC20E 100%)",
  },

  LAR: {
    teamCode: "LAR",
    teamName: "Los Angeles Rams",
    primary: "#003594",
    secondary: "#FFA300",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#E0EAFF",
    border: "#FFA300",
    glow: "rgba(255, 163, 0, 0.45)",
    gradient: "linear-gradient(135deg, #003594 0%, #001B4A 60%, #FFA300 100%)",
  },

  MIA: {
    teamCode: "MIA",
    teamName: "Miami Dolphins",
    primary: "#008E97",
    secondary: "#FC4C02",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#D8FCFF",
    border: "#FC4C02",
    glow: "rgba(0, 142, 151, 0.45)",
    gradient: "linear-gradient(135deg, #008E97 0%, #00575C 60%, #FC4C02 100%)",
  },

  MIN: {
    teamCode: "MIN",
    teamName: "Minnesota Vikings",
    primary: "#4F2683",
    secondary: "#FFC62F",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#E9DDF8",
    border: "#FFC62F",
    glow: "rgba(79, 38, 131, 0.45)",
    gradient: "linear-gradient(135deg, #4F2683 0%, #210D39 60%, #FFC62F 100%)",
  },

  NE: {
    teamCode: "NE",
    teamName: "New England Patriots",
    primary: "#002244",
    secondary: "#C60C30",
    accent: "#B0B7BC",
    text: "#FFFFFF",
    mutedText: "#D7DEE8",
    border: "#C60C30",
    glow: "rgba(198, 12, 48, 0.45)",
    gradient: "linear-gradient(135deg, #002244 0%, #0B1F3A 55%, #C60C30 100%)",
  },

  NO: {
    teamCode: "NO",
    teamName: "New Orleans Saints",
    primary: "#101820",
    secondary: "#D3BC8D",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#F0E5CD",
    border: "#D3BC8D",
    glow: "rgba(211, 188, 141, 0.45)",
    gradient: "linear-gradient(135deg, #101820 0%, #000000 60%, #D3BC8D 100%)",
  },

  NYG: {
    teamCode: "NYG",
    teamName: "New York Giants",
    primary: "#0B2265",
    secondary: "#A71930",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#DDE5FF",
    border: "#A71930",
    glow: "rgba(11, 34, 101, 0.45)",
    gradient: "linear-gradient(135deg, #0B2265 0%, #04123A 60%, #A71930 100%)",
  },

  NYJ: {
    teamCode: "NYJ",
    teamName: "New York Jets",
    primary: "#125740",
    secondary: "#000000",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#D8F2E8",
    border: "#125740",
    glow: "rgba(18, 87, 64, 0.45)",
    gradient: "linear-gradient(135deg, #125740 0%, #06251B 65%, #000000 100%)",
  },

  PHI: {
    teamCode: "PHI",
    teamName: "Philadelphia Eagles",
    primary: "#004C54",
    secondary: "#A5ACAF",
    accent: "#ACC0C6",
    text: "#FFFFFF",
    mutedText: "#D8F3F5",
    border: "#A5ACAF",
    glow: "rgba(0, 76, 84, 0.45)",
    gradient: "linear-gradient(135deg, #004C54 0%, #001F23 60%, #A5ACAF 100%)",
  },

  PIT: {
    teamCode: "PIT",
    teamName: "Pittsburgh Steelers",
    primary: "#101820",
    secondary: "#FFB612",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#FFEFC2",
    border: "#FFB612",
    glow: "rgba(255, 182, 18, 0.45)",
    gradient: "linear-gradient(135deg, #101820 0%, #000000 65%, #FFB612 100%)",
  },

  SEA: {
    teamCode: "SEA",
    teamName: "Seattle Seahawks",
    primary: "#002244",
    secondary: "#69BE28",
    accent: "#A5ACAF",
    text: "#FFFFFF",
    mutedText: "#D9FFCA",
    border: "#69BE28",
    glow: "rgba(105, 190, 40, 0.45)",
    gradient: "linear-gradient(135deg, #002244 0%, #00101F 60%, #69BE28 100%)",
  },

  SF: {
    teamCode: "SF",
    teamName: "San Francisco 49ers",
    primary: "#AA0000",
    secondary: "#B3995D",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#F2E6C8",
    border: "#B3995D",
    glow: "rgba(179, 153, 93, 0.45)",
    gradient: "linear-gradient(135deg, #AA0000 0%, #5A0000 55%, #B3995D 100%)",
  },

  TB: {
    teamCode: "TB",
    teamName: "Tampa Bay Buccaneers",
    primary: "#D50A0A",
    secondary: "#34302B",
    accent: "#FF7900",
    text: "#FFFFFF",
    mutedText: "#FFE0E0",
    border: "#FF7900",
    glow: "rgba(213, 10, 10, 0.45)",
    gradient: "linear-gradient(135deg, #D50A0A 0%, #34302B 65%, #FF7900 100%)",
  },

  TEN: {
    teamCode: "TEN",
    teamName: "Tennessee Titans",
    primary: "#0C2340",
    secondary: "#4B92DB",
    accent: "#C8102E",
    text: "#FFFFFF",
    mutedText: "#D9ECFF",
    border: "#4B92DB",
    glow: "rgba(75, 146, 219, 0.45)",
    gradient: "linear-gradient(135deg, #0C2340 0%, #001122 60%, #4B92DB 100%)",
  },

  WAS: {
    teamCode: "WAS",
    teamName: "Washington",
    primary: "#5A1414",
    secondary: "#FFB612",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#FFEFC2",
    border: "#FFB612",
    glow: "rgba(255, 182, 18, 0.45)",
    gradient: "linear-gradient(135deg, #5A1414 0%, #260808 60%, #FFB612 100%)",
  },

  // Historical / alternate codes
  STL: {
    teamCode: "STL",
    teamName: "St. Louis Rams",
    primary: "#002244",
    secondary: "#B3995D",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#EADFC4",
    border: "#B3995D",
    glow: "rgba(179, 153, 93, 0.45)",
    gradient: "linear-gradient(135deg, #002244 0%, #001122 60%, #B3995D 100%)",
  },

  SD: {
    teamCode: "SD",
    teamName: "San Diego Chargers",
    primary: "#0080C6",
    secondary: "#FFC20E",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#E1F5FF",
    border: "#FFC20E",
    glow: "rgba(0, 128, 198, 0.45)",
    gradient: "linear-gradient(135deg, #0080C6 0%, #004F7A 60%, #FFC20E 100%)",
  },

  OAK: {
    teamCode: "OAK",
    teamName: "Oakland Raiders",
    primary: "#000000",
    secondary: "#A5ACAF",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#D8DEE1",
    border: "#A5ACAF",
    glow: "rgba(165, 172, 175, 0.45)",
    gradient: "linear-gradient(135deg, #000000 0%, #111111 70%, #A5ACAF 100%)",
  },

  LA: {
    teamCode: "LA",
    teamName: "Los Angeles Rams",
    primary: "#003594",
    secondary: "#FFA300",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#E0EAFF",
    border: "#FFA300",
    glow: "rgba(255, 163, 0, 0.45)",
    gradient: "linear-gradient(135deg, #003594 0%, #001B4A 60%, #FFA300 100%)",
  },

  PHX: {
    teamCode: "PHX",
    teamName: "Phoenix Cardinals",
    primary: "#97233F",
    secondary: "#000000",
    accent: "#FFB612",
    text: "#FFFFFF",
    mutedText: "#F4D6DF",
    border: "#FFB612",
    glow: "rgba(151, 35, 63, 0.45)",
    gradient: "linear-gradient(135deg, #97233F 0%, #3A0A18 60%, #000000 100%)",
  },

  HOUOILERS: {
    teamCode: "HOUOILERS",
    teamName: "Houston Oilers",
    primary: "#418FDE",
    secondary: "#C8102E",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#E1F2FF",
    border: "#C8102E",
    glow: "rgba(65, 143, 222, 0.45)",
    gradient: "linear-gradient(135deg, #418FDE 0%, #0C2340 60%, #C8102E 100%)",
  },

  TENHOU: {
    teamCode: "TENHOU",
    teamName: "Tennessee Oilers",
    primary: "#418FDE",
    secondary: "#C8102E",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#E1F2FF",
    border: "#C8102E",
    glow: "rgba(65, 143, 222, 0.45)",
    gradient: "linear-gradient(135deg, #418FDE 0%, #0C2340 60%, #C8102E 100%)",
  },

  WSH: {
    teamCode: "WSH",
    teamName: "Washington",
    primary: "#5A1414",
    secondary: "#FFB612",
    accent: "#FFFFFF",
    text: "#FFFFFF",
    mutedText: "#FFEFC2",
    border: "#FFB612",
    glow: "rgba(255, 182, 18, 0.45)",
    gradient: "linear-gradient(135deg, #5A1414 0%, #260808 60%, #FFB612 100%)",
  },
};

// Dedupe dev warnings so a 2s spin (which swaps the visible team ~30×) can't spam
// the console with the same missing-code line over and over.
const warnedCodes = new Set<string>();

export function getTeamColorTheme(teamCode: string): TeamColorTheme {
  const theme = TEAM_COLOR_THEMES[teamCode];
  if (theme) return theme;

  if (
    process.env.NODE_ENV !== "production" &&
    teamCode &&
    !warnedCodes.has(teamCode)
  ) {
    warnedCodes.add(teamCode);
    console.warn(`Missing team color theme for team code: ${teamCode}`);
  }
  return DEFAULT_TEAM_THEME;
}
