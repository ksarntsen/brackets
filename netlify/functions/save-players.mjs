import { withClient, json, noContent, methodNotAllowed, loadState, saveState, blankWinnersState, blankTimesState } from "./_db.mjs";

function sTrim(s){
  return (s || "").replace(/^\s+|\s+$/g, "");
}

export default async (req) => {
  if (req.method === "OPTIONS") return noContent();
  if (req.method !== "POST") return methodNotAllowed();

  return await withClient(async (client) => {
    await loadState(client);

    let body = null;
    try { body = await req.json(); } catch(e){ body = null; }

    const players = body && body.players;
    if (!players || players.length !== 16) return json({ ok:false, error:"bad_request" }, 400);

    const p = [];
    for (let i=0;i<16;i++){
      p.push(sTrim(players[i]));
    }

    const updated = await saveState(client, p, blankWinnersState(), blankTimesState());
    return json({ ok:true, updated_at: updated });
  });
};
