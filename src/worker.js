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
          'SELECT id, company_id as clientId, date, description, lines FROM journal_entries WHERE company_id = ? OR client_id = ? ORDER BY date ASC'
        ).bind(clientId, clientId).all();

        const formatted = (results || []).map(r => ({
          id: r.id,
          clientId: r.clientId,
          date: r.date,
          description: r.description,
          lines: typeof r.lines === 'string' ? JSON.parse(r.lines || '[]') : (r.lines || [])
        }));

        return new Response(JSON.stringify(formatted), { headers });
      }

      // POST /api/entries
      if (path === '/api/entries' && method === 'POST') {
        const body = await request.json();
        const { clientId, entries } = body;
        if (!clientId) {
          return new Response(JSON.stringify({ error: 'Missing clientId' }), { status: 400, headers });
        }

        await env.DB.prepare('DELETE FROM journal_entries WHERE company_id = ? OR client_id = ?').bind(clientId, clientId).run();

        if (Array.isArray(entries) && entries.length > 0) {
          const stmts = entries.map(e => {
            return env.DB.prepare(
              'INSERT INTO journal_entries (id, company_id, client_id, date, description, lines) VALUES (?, ?, ?, ?, ?, ?)'
            ).bind(
              e.id || ('je-' + clientId + '-' + Date.now()),
              clientId,
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
          'SELECT client_id, company_meta FROM client_entries'
        ).all();

        const clients = (results || []).map(r => {
          let meta = {};
          try {
            meta = typeof r.company_meta === 'string' ? JSON.parse(r.company_meta) : (r.company_meta || {});
          } catch (e) {
            meta = {};
          }
          return {
            clientId: r.client_id,
            name: meta.name || r.client_id,
            code: meta.code || r.client_id,
            type: meta.type || 'sdn_bhd_normal',
            taxRate: meta.taxRate !== undefined ? meta.taxRate : 24,
            yearEnd: meta.yearEnd || 2026
          };
        });

        return new Response(JSON.stringify(clients), { headers });
      }

      // POST /api/clients
      if (path === '/api/clients' && method === 'POST') {
        const client = await request.json();
        if (!client || !client.clientId) {
          return new Response(JSON.stringify({ error: 'Missing client ID' }), { status: 400, headers });
        }

        const metaJson = JSON.stringify({
          name: client.name || '',
          code: client.code || '',
          type: client.type || 'sdn_bhd_normal',
          taxRate: client.taxRate !== undefined ? client.taxRate : 24,
          yearEnd: client.yearEnd || 2026
        });

        await env.DB.prepare(
          `INSERT INTO client_entries (client_id, company_meta) 
           VALUES (?, ?)
           ON CONFLICT(client_id) DO UPDATE SET company_meta=excluded.company_meta`
        ).bind(client.clientId, metaJson).run();

        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // Serve static frontend assets
      return env.ASSETS ? env.ASSETS.fetch(request) : new Response('Not found', { status: 404 });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
    }
  }
};
