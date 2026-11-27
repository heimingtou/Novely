// Test-only import substitutes. No environment files, credentials or network.
let client;
export const setWriterTestClient = (value) => { client = value; };
export function createAdminClient() {
  if (!client) throw new Error("Writer test client was not configured");
  return client;
}
export const removeImage = () => { throw new Error("Unexpected storage operation"); };
export const uploadImage = removeImage;
