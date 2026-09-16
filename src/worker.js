if (url.pathname === "/api/save" && request.method === "POST") {
  try {
    const body = await request.json();
    const { clientId, entries, company_meta } = body;
    
    if (!clientId) {
      return new Response(JSON.stringify({ success: false, error: "Missing clientId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    
    // Ensure entries is valid JSON string
    const entriesJson = Array.isArray(entries) ? JSON.stringify(entries) : '[]';
    const companyMeta = company_meta ? JSON.stringify(company_meta) : '{}';
    
    // UPSERT: Insert or Update
    const result = await env.DB.prepare(
      `INSERT INTO client_entries (client_id, entries_json, company_meta, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(client_id) 
       DO UPDATE SET entries_json = excluded.entries_json, 
                     company_meta = excluded.company_meta,
                     updated_at = datetime('now')`
    ).bind(clientId, entriesJson, companyMeta).run();
    
    return new Response(JSON.stringify({ 
      success: true, 
      rowsAffected: result.meta.changes 
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
