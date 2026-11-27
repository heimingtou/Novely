import bcrypt from "bcryptjs";

// Ported from src/server/auth/password.js without its Next server-only marker.
const ROUNDS = 10;
let dummyHash;
export const hashPassword = (password) => bcrypt.hash(password, ROUNDS);
export async function verifyPassword(password, hash) {
  dummyHash ??= await bcrypt.hash("novely-dummy-password", ROUNDS);
  const ok = await bcrypt.compare(password, hash || dummyHash);
  return Boolean(hash) && ok;
}
