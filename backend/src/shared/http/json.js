// Date.toJSON supplies ISO 8601 before JSON.stringify calls this replacer.
// This is a final guard; repositories must still select only public attributes.
export function jsonReplacer(key, value) {
  if (key === "password_hash" || key === "passwordHash") return undefined;
  return typeof value === "bigint" ? value.toString(10) : value;
}

export function configureJsonSerialization(app) {
  app.set("json replacer", jsonReplacer);
  return app;
}
