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

function blankTimes(){
  return {
    r16: ["","","","","","","",""],
    qf:  ["","","",""],
    sf:  ["",""],
    f:   [""]
  };
}

export async function ensureSchema(client){
  await client.query(`
    CREATE TABLE IF NOT EXISTS bracket_state (
      id text PRIMARY KEY,
      players jsonb NOT NULL,
      winners jsonb NOT NULL,
      times jsonb,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  // Backfill column if an older table exists without it (or if it's NULL)
  await client.query(`ALTER TABLE bracket_state ADD COLUMN IF NOT EXISTS times jsonb;`);

  await client.query(
    `INSERT INTO bracket_state (id, players, winners, times)
     VALUES ('main', $1::jsonb, $2::jsonb, $3::jsonb)
     ON CONFLICT (id) DO NOTHING;`,
    [JSON.stringify(blankPlayers()), JSON.stringify(blankWinners()), JSON.stringify(blankTimes())]
  );

  await client.query(
    `UPDATE bracket_state
     SET times = $1::jsonb
     WHERE id='main' AND (times IS NULL);`,
    [JSON.stringify(blankTimes())]
  );
}

export async function loadState(client){
  await ensureSchema(client);
  const r = await client.query("SELECT players, winners, times, updated_at FROM bracket_state WHERE id='main' LIMIT 1;");
  const row = r.rows[0];
  return { players: row.players, winners: row.winners, times: row.times, updated_at: row.updated_at };
}

export async function saveState(client, players, winners, times){
  await client.query(
    "UPDATE bracket_state SET players=$1::jsonb, winners=$2::jsonb, times=$3::jsonb, updated_at=now() WHERE id='main';",
    [JSON.stringify(players), JSON.stringify(winners), JSON.stringify(times)]
  );
  const r = await client.query("SELECT updated_at FROM bracket_state WHERE id='main' LIMIT 1;");
  return r.rows[0].updated_at;
}

export function blankTimesState(){
  return blankTimes();
}
export function blankWinnersState(){
  return blankWinners();
}
