const SUPABASE_URL = "https://czxhavedloklkyqhjvpz.supabase.co";
const SUPABASE_KEY = "sb_publishable_AxknLEzD-VAetyqpzIU0TQ_zVL-QKmm";
const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Accept: "application/json" };
async function getColumns(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`, { headers });
  const data = await res.json();
  return data.length ? Object.keys(data[0]) : [];
}
async function main() {
  for (const t of ["tools", "categories", "tool_categories"]) {
    const cols = await getColumns(t);
    console.log(`\n--- ${t} ---\n`, JSON.stringify(cols, null, 2));
  }
  const tools = await (await fetch(`${SUPABASE_URL}/rest/v1/tools?select=id,name&order=id`, { headers })).json();
  console.log("\n--- tools (id + name) ---\n", JSON.stringify(tools, null, 2));
}
main().catch(console.error);
