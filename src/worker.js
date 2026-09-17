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
