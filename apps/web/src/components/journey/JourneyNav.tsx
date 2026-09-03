import { Badge, CalendarDays, CheckSquare2, Clock3, Compass, Crown, Flag, ListTodo, ScrollText, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";
import styles from "../../styles/journey/JourneyNav.module.css";

const destinations = [
  { to: "/journey", label: "Overview", icon: Compass, end: true },
  { to: "/journey/quests", label: "Quests", icon: ListTodo },
  { to: "/journey/bounties", label: "Bounties", icon: CheckSquare2 },
  { to: "/journey/season", label: "Season", icon: Sparkles },
  { to: "/journey/guardian-rank", label: "Guardian Rank", icon: Badge },
  { to: "/journey/titles", label: "Titles & Seals", icon: Crown },
  { to: "/journey/triumphs", label: "Triumphs", icon: ScrollText },
  { to: "/journey/weekly", label: "Weekly", icon: CalendarDays },
  { to: "/journey/history", label: "History & Guide", icon: Clock3 },
  { to: "/challenges", label: "Challenges", icon: Flag }
] as const;

export function JourneyNav() {
  return <nav className={styles.nav} aria-label="Journey trackers">
    {destinations.map(({ to, label, icon: Icon, ...link }) => <NavLink
      key={to}
      to={to}
      end={"end" in link ? link.end : undefined}
      className={({ isActive }) => isActive ? styles.active : undefined}
    ><Icon /><span>{label}</span></NavLink>)}
  </nav>;
}
