export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. API: Simpan Data ke D1
    if (url.pathname === "/api/save" && request.method === "POST") {
      try {
        const body = await request.json();
        const { clientId, entries, companyMeta } = body;

        if (!clientId) {
          return new Response(JSON.stringify({ success: false, error: "Missing clientId" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        await env.DB.prepare(
          `INSERT INTO client_entries (client_id, entries_json, company_meta, updated_at) 
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(client_id) DO UPDATE SET 
             entries_json = excluded.entries_json,
             company_meta = excluded.company_meta,
             updated_at = CURRENT_TIMESTAMP`
        ).bind(clientId, JSON.stringify(entries || []), JSON.stringify(companyMeta || {})).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 2. API: Muat Data dari D1
    if (url.pathname === "/api/load" && request.method === "GET") {
      try {
        const clientId = url.searchParams.get("clientId");
        if (!clientId) {
          return new Response(JSON.stringify({ success: false, error: "Missing clientId" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        const row = await env.DB.prepare(
          "SELECT entries_json, company_meta FROM client_entries WHERE client_id = ?"
        ).bind(clientId).first();

        if (!row) {
          return new Response(JSON.stringify({ success: true, entries: [], companyMeta: null }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        return new Response(JSON.stringify({
          success: true,
          entries: JSON.parse(row.entries_json || "[]"),
          companyMeta: JSON.parse(row.company_meta || "{}")
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 3. API: Senarai Semua Syarikat (Mengambil terus dari D1)
    if (url.pathname === "/api/companies" && request.method === "GET") {
      try {
        const rows = await env.DB.prepare(
          "SELECT client_id, company_meta FROM client_entries"
        ).all();

        const companies = (rows.results || []).map(row => {
          const meta = JSON.parse(row.company_meta || "{}");
          return {
            clientId: row.client_id,
            name: meta.name || row.client_id,
            type: meta.type || "sdn_bhd_normal",
            taxRate: meta.taxRate || 24,
            code: meta.code || row.client_id
          };
        });

        return new Response(JSON.stringify({ success: true, companies: companies }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // 4. Paparan Laman Web (Static Assets)
    return env.ASSETS ? env.ASSETS.fetch(request) : new Response("Worker Active. Assets binding required.", { headers: corsHeaders });
  }
};
