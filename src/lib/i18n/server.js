import { cookies } from "next/headers";
import { createTranslator } from "./messages.mjs";

export async function getServerLocale() {
  return (await cookies()).get("novely-locale")?.value === "en" ? "en" : "vi";
}

export async function getServerI18n() {
  const locale = await getServerLocale();
  return { locale, t: createTranslator(locale) };
}
