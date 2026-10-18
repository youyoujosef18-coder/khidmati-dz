import bcrypt from "bcryptjs";

const COST = 11;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

let dummy: Promise<string> | null = null;
/** Compare against a dummy hash so unknown accounts take the same time as known ones. */
export async function burnPasswordCheck(password: string) {
  dummy ??= bcrypt.hash("khidmati-dummy-password", COST);
  await bcrypt.compare(password, await dummy);
}
