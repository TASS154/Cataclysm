/** Conta com permissão de mestre (login começa com "mestre", case-insensitive). */
export function isMestreAccount(username) {
  if (!username || typeof username !== "string") return false;
  return username.trim().toLowerCase().startsWith("mestre");
}
