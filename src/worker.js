export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      // GET /api/entries?clientId=xxx
      if (path === '/api/entries' && method === 'GET') {
        const clientId = url.searchParams.get('clientId');
        if (!clientId) {
          return new Response(JSON.stringify([]), { headers });
        }
        const { results } = await env.DB.prepare(
          'SELECT id, client_id as clientId, entry_date as date, description, lines_json FROM journal_entries WHERE client_id = ? ORDER BY entry_date ASC'
        ).bind(clientId).all();

        const formatted = results.map(r => ({
          id: r.id,
          clientId: r.clientId,
          date: r.date,
          description: r.description,
          lines: JSON.parse(r.lines_json || '[]')
        }));

        return new Response(JSON.stringify(formatted), { headers });
      }

      // POST /api/entries (Bulk save/sync entries for a client)
      if (path === '/api/entries' && method === 'POST') {
        const body = await request.json();
        const { clientId, entries } = body;
        if (!clientId) {
          return new Response(JSON.stringify({ error: 'Missing clientId' }), { status: 400, headers });
        }

        // Delete existing entries for client and re-insert
        await env.DB.prepare('DELETE FROM journal_entries WHERE client_id = ?').bind(clientId).run();

        if (Array.isArray(entries) && entries.length > 0) {
          const stmts = entries.map(e => {
            return env.DB.prepare(
              'INSERT INTO journal_entries (id, client_id, entry_date, description, lines_json) VALUES (?, ?, ?, ?, ?)'
            ).bind(
              e.id || ('je-' + clientId + '-' + Date.now()),
              clientId,
              e.date || '',
              e.description || '',
              JSON.stringify(e.lines || [])
            );
          });
          await env.DB.batch(stmts);
        }

        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // GET /api/clients
      if (path === '/api/clients' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT client_id as clientId, name, code, type, tax_rate as taxRate, year_end as yearEnd FROM clients'
        ).all();
        return new Response(JSON.stringify(results || []), { headers });
      }

      // POST /api/clients
      if (path === '/api/clients' && method === 'POST') {
        const client = await request.json();
        if (!client || !client.clientId) {
          return new Response(JSON.stringify({ error: 'Missing client ID' }), { status: 400, headers });
        }

        await env.DB.prepare(
          `INSERT INTO clients (client_id, name, code, type, tax_rate, year_end) 
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(client_id) DO UPDATE SET 
             name=excluded.name, code=excluded.code, type=excluded.type, tax_rate=excluded.tax_rate, year_end=excluded.year_end`
        ).bind(
          client.clientId,
          client.name || '',
          client.code || '',
          client.type || 'sdn_bhd_normal',
          client.taxRate || 24,
          client.yearEnd || new Date().getFullYear()
        ).run();

        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // Pass-through for static assets
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }
};
