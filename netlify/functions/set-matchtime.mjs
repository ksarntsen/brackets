import { withClient, json, noContent, methodNotAllowed, loadState, saveState } from "./_db.mjs";

function sTrim(s){
  return (s || "").replace(/^\s+|\s+$/g, "");
}

function cloneWinners(w){
  return {
    r16: (w && w.r16 && w.r16.length===8) ? w.r16.slice(0) : [null,null,null,null,null,null,null,null],
    qf:  (w && w.qf  && w.qf.length===4)  ? w.qf.slice(0)  : [null,null,null,null],
    sf:  (w && w.sf  && w.sf.length===2)  ? w.sf.slice(0)  : [null,null],
    f:   (w && w.f   && w.f.length===1)   ? w.f.slice(0)   : [null]
  };
}

function cloneTimes(t){
  return {
    r16: (t && t.r16 && t.r16.length===8) ? t.r16.slice(0) : ["","","","","","","",""],
    qf:  (t && t.qf  && t.qf.length===4)  ? t.qf.slice(0)  : ["","","",""],
    sf:  (t && t.sf  && t.sf.length===2)  ? t.sf.slice(0)  : ["",""],
    f:   (t && t.f   && t.f.length===1)   ? t.f.slice(0)   : [""]
  };
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
    const time = sTrim(body && body.time);

    if (!(round === "r16" || round === "qf" || round === "sf" || round === "f")) return json({ ok:false, error:"bad_request" }, 400);

    const max = (round === "r16") ? 8 : (round === "qf") ? 4 : (round === "sf") ? 2 : 1;
    if (!(match >= 0 && match < max)) return json({ ok:false, error:"bad_request" }, 400);

    const players = (st.players && st.players.length===16) ? st.players : Array(16).fill("");
    const winnersObj = cloneWinners(st.winners);
    const timesObj = cloneTimes(st.times);

    const safe = time.length > 60 ? time.substring(0, 60) : time;
    timesObj[round][match] = safe;

    const updated = await saveState(client, players, winnersObj, timesObj);
    return json({ ok:true, updated_at: updated });
  });
};
