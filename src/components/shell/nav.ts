import {
  Archive,
  CalendarClock,
  CalendarDays,
  Dumbbell,
  FlaskConical,
  FolderKanban,
  History,
  Inbox,
  ListChecks,
  ListOrdered,
  CloudMoon,
  NotebookText,
  Settings,
  Sprout,
  Utensils,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type RoomGroup = "nova" | "plan" | "practice" | "self" | "quiet";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: RoomGroup;
}

/** Today, capture and the account pages; shown beside the wordmark on wide screens. */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: "/today", label: "Today", icon: CalendarDays, group: "nova" },
  { href: "/inbox", label: "Inbox", icon: Inbox, group: "nova" },
  { href: "/settings", label: "Settings", icon: Settings, group: "quiet" },
];

/** The life rooms, grouped by what the person is doing (docs/UI.md). */
export const ROOM_NAV: readonly NavItem[] = [
  { href: "/schedule", label: "Schedule", icon: CalendarClock, group: "plan" },
  { href: "/tasks", label: "Tasks", icon: ListChecks, group: "plan" },
  { href: "/projects", label: "Projects", icon: FolderKanban, group: "plan" },
  { href: "/habits", label: "Habits", icon: Sprout, group: "practice" },
  { href: "/routines", label: "Routines", icon: ListOrdered, group: "practice" },
  { href: "/fitness", label: "Fitness", icon: Dumbbell, group: "practice" },
  { href: "/diet", label: "Food", icon: Utensils, group: "self" },
  { href: "/mind", label: "Sleep & state", icon: CloudMoon, group: "self" },
  { href: "/review", label: "Review", icon: NotebookText, group: "nova" },
  { href: "/history", label: "History", icon: History, group: "nova" },
  { href: "/money", label: "Money", icon: Wallet, group: "quiet" },
  { href: "/archive", label: "Archive", icon: Archive, group: "quiet" },
  { href: "/sandbox", label: "Sandbox", icon: FlaskConical, group: "quiet" },
];

const GROUP_BY_ROOM: Record<string, RoomGroup> = Object.fromEntries(
  [...PRIMARY_NAV, ...ROOM_NAV].map((item) => [item.href.slice(1), item.group]),
);

/** The hue group for a room route such as "habits"; unknown rooms are quiet. */
export function roomGroup(room: string): RoomGroup {
  return GROUP_BY_ROOM[room] ?? "quiet";
}

/** Captures belong to Today, so the Today link stays lit while reviewing a note. */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/today" && pathname.startsWith("/captures")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
