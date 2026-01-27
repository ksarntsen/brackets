// netlify/functions/get-bracket.mjs
import { withClient, json, noContent, methodNotAllowed, loadState } from "./_db.mjs";

export default async (req) => {
  if (req.method === "OPTIONS") return noContent();
  if (req.method !== "GET") return methodNotAllowed();

  return await withClient(async (client) => {
    const st = await loadState(client);
    return json({ ok:true, state: st });
  });
};
