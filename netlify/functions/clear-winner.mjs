// netlify/functions/clear-winner.mjs
import { withClient, json, noContent, methodNotAllowed, loadState, saveState } from "./_db.mjs";

function cloneWinners(w){
  return {
    r16: (w && w.r16 && w.r16.length===8) ? w.r16.slice(0) : [null,null,null,null,null,null,null,null],
    qf:  (w && w.qf  && w.qf.length===4)  ? w.qf.slice(0)  : [null,null,null,null],
    sf:  (w && w.sf  && w.sf.length===2)  ? w.sf.slice(0)  : [null,null],
    f:   (w && w.f   && w.f.length===1)   ? w.f.slice(0)   : [null]
  };
}

function cascadeClear(winners, round, match){
  if (round === "r16") {
    const q = Math.floor(match/2);
    winners.qf[q] = null;
    const s = Math.floor(q/2);
    winners.sf[s] = null;
    winners.f[0] = null;
  } else if (round === "qf") {
    const s = Math.floor(match/2);
    winners.sf[s] = null;
    winners.f[0] = null;
  } else if (round === "sf") {
    winners.f[0] = null;
  }
}

export default async (req) => {
  if (req.method === "OPTIONS") return noContent();
  if (req.method !== "POST") return methodNotAllowed();

  return await withClient(async (client) => {
    const st = await loadState(client);

    let body = null;
    try { body = await req.json(); } catch(e){ body = null; }

    const round = body && body.round;
    const match = body && typeof body.match === "number" ? body.match : parseInt(body && body.match, 10);

    if (!(round === "r16" || round === "qf" || round === "sf" || round === "f")) return json({ ok:false, error:"bad_request" }, 400);

    const max = (round === "r16") ? 8 : (round === "qf") ? 4 : (round === "sf") ? 2 : 1;
    if (!(match >= 0 && match < max)) return json({ ok:false, error:"bad_request" }, 400);

    const players = (st.players && st.players.length===16) ? st.players : Array(16).fill("");
    const winnersObj = cloneWinners(st.winners);

    winnersObj[round][match] = null;
    cascadeClear(winnersObj, round, match);

    const updated = await saveState(client, players, winnersObj);
    return json({ ok:true, updated_at: updated });
  });
};
