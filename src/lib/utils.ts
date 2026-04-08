/** Generate a random alphanumeric code of given length (uppercase + digits). */
export function generateCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/1/I to avoid confusion
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const AVATAR_COLORS = [
  "#00D4FF", "#FF6B6B", "#4ECDC4", "#FFE66D", "#A8E6CF",
  "#FF8A5C", "#D4A5FF", "#FF5DA0", "#56E39F", "#5CC9F5",
  "#FF7EB3", "#7EC8E3", "#C3F584", "#FFB347", "#87CEEB",
];

export function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}
