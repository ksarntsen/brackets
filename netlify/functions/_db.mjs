// netlify/functions/_db.mjs
import pg from "pg";

function corsHeaders(){
  return {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type"
  };
}

export function json(obj, status){
  return new Response(JSON.stringify(obj), { status: status || 200, headers: corsHeaders() });
}

export function noContent(){
  return new Response("", { status: 204, headers: corsHeaders() });
}

export function methodNotAllowed(){
  return json({ ok:false, error:"method_not_allowed" }, 405);
}

export async function withClient(fn){
  const conn = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!conn) return json({ ok:false, error:"missing_database_url", message:"Set DATABASE_URL (or NEON_DATABASE_URL)." }, 500);

  const client = new pg.Client({
    connectionString: conn,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function blankPlayers(){
  const a = [];
  for (let i=0;i<16;i++) a.push("");
  return a;
}

function blankWinners(){
  return {
    r16: [null,null,null,null,null,null,null,null],
    qf:  [null,null,null,null],
    sf:  [null,null],
    f:   [null]
  };
}

export async function ensureSchema(client){
  await client.query(`
    CREATE TABLE IF NOT EXISTS bracket_state (
      id text PRIMARY KEY,
      players jsonb NOT NULL,
      winners jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await client.query(
    `INSERT INTO bracket_state (id, players, winners)
     VALUES ('main', $1::jsonb, $2::jsonb)
     ON CONFLICT (id) DO NOTHING;`,
    [JSON.stringify(blankPlayers()), JSON.stringify(blankWinners())]
  );
}

export async function loadState(client){
  await ensureSchema(client);
  const r = await client.query("SELECT players, winners, updated_at FROM bracket_state WHERE id='main' LIMIT 1;");
  const row = r.rows[0];
  return { players: row.players, winners: row.winners, updated_at: row.updated_at };
}

export async function saveState(client, players, winners){
  await client.query(
    "UPDATE bracket_state SET players=$1::jsonb, winners=$2::jsonb, updated_at=now() WHERE id='main';",
    [JSON.stringify(players), JSON.stringify(winners)]
  );
  const r = await client.query("SELECT updated_at FROM bracket_state WHERE id='main' LIMIT 1;");
  return r.rows[0].updated_at;
}
