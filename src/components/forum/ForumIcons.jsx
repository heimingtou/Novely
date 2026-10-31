import { BookOpen, Brain, CircleHelp, MessageCircle, Megaphone, Palette, PenLine, Search } from "lucide-react";

const ICONS = { book: BookOpen, brain: Brain, help: CircleHelp, chat: MessageCircle, megaphone: Megaphone, palette: Palette, pen: PenLine, search: Search };
export default function ForumIcon({ name, size = 18 }) {
  const Icon = ICONS[name] || MessageCircle;
  return <Icon size={size} aria-hidden="true" />;
}

export function ForumAvatar({ name, small = false }) {
  const color = [...name].reduce((total, char) => total + char.codePointAt(0), 0) % 5;
  const initials = name.trim().split(/\s+/).slice(-2).map((word) => word[0]).join("");
  return <span className={`forum-avatar forum-avatar-${color}${small ? " forum-avatar-small" : ""}`} aria-hidden="true">{initials}</span>;
}
