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

function computeBracket(players, winners){
  const out = {
    r16: { a:[], b:[], wn:[] },
    qf:  { a:[], b:[], wn:[] },
    sf:  { a:[], b:[], wn:[] },
    f:   { a:[], b:[], wn:[] }
  };

  for (let i=0;i<8;i++){
    const a = sTrim(players[i*2] || "");
    const b = sTrim(players[i*2+1] || "");
    out.r16.a[i]=a; out.r16.b[i]=b;
    const w = winners.r16[i];
    out.r16.wn[i] = (w===0) ? a : ((w===1) ? b : "");
  }
  for (let i=0;i<4;i++){
    const a = out.r16.wn[i*2] || "";
    const b = out.r16.wn[i*2+1] || "";
    out.qf.a[i]=a; out.qf.b[i]=b;
    const w = winners.qf[i];
    out.qf.wn[i] = (w===0) ? a : ((w===1) ? b : "");
  }
  for (let i=0;i<2;i++){
    const a = out.qf.wn[i*2] || "";
    const b = out.qf.wn[i*2+1] || "";
    out.sf.a[i]=a; out.sf.b[i]=b;
    const w = winners.sf[i];
    out.sf.wn[i] = (w===0) ? a : ((w===1) ? b : "");
  }
  {
    const a = out.sf.wn[0] || "";
    const b = out.sf.wn[1] || "";
    out.f.a[0]=a; out.f.b[0]=b;
    const w = winners.f[0];
    out.f.wn[0] = (w===0) ? a : ((w===1) ? b : "");
  }
  return out;
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
    const winner = body && typeof body.winner === "number" ? body.winner : parseInt(body && body.winner, 10);

    if (!(round === "r16" || round === "qf" || round === "sf" || round === "f")) return json({ ok:false, error:"bad_request" }, 400);
    if (!(winner === 0 || winner === 1)) return json({ ok:false, error:"bad_request" }, 400);

    const max = (round === "r16") ? 8 : (round === "qf") ? 4 : (round === "sf") ? 2 : 1;
    if (!(match >= 0 && match < max)) return json({ ok:false, error:"bad_request" }, 400);

    const players = (st.players && st.players.length===16) ? st.players : Array(16).fill("");
    const winnersObj = cloneWinners(st.winners);
    const timesObj = cloneTimes(st.times);

    const br = computeBracket(players, winnersObj);
    const a = br[round].a[match] || "";
    const b = br[round].b[match] || "";
    if (!sTrim(a) || !sTrim(b)) return json({ ok:false, error:"incomplete_match" }, 400);

    const prev = winnersObj[round][match];
    winnersObj[round][match] = winner;
    if (prev !== winner) cascadeClear(winnersObj, round, match);

    const updated = await saveState(client, players, winnersObj, timesObj);
    return json({ ok:true, updated_at: updated });
  });
};
