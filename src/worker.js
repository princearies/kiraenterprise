/**
 * Kira Enterprise V4 — Cloudflare Worker
 * API endpoints untuk simpan/muat data dari D1 Database (mykira).
 * 
 * Endpoints:
 *   POST /api/save  → simpan entries ke D1
 *   GET  /api/load  → muat entries dari D1 berdasarkan clientId
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for frontend access
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // API endpoints
    if (request.method === 'POST' && path === '/api/save') {
      return handleSave(request, env, corsHeaders);
    }

    if (request.method === 'GET' && path === '/api/load') {
      return handleLoad(request, env, corsHeaders);
    }

    // Health check
    if (path === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'kira-enterprise-v4' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};

/**
 * POST /api/save
 * Body: { clientId, entries, companyMeta }
 * Simpan entries ke D1 database.
 */
async function handleSave(request, env, corsHeaders) {
  try {
    const data = await request.json();
    const { clientId, entries, companyMeta } = data;

    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clientId wajib diisi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(entries)) {
      return new Response(
        JSON.stringify({ success: false, error: 'entries mesti array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ambil data existing dari D1 (kalau ada)
    let existing = null;
    try {
      existing = await env.DB.prepare(
        'SELECT entries_json, company_meta FROM client_entries WHERE client_id = ?'
      ).bind(clientId).first();
    } catch (e) {
      // Table mungkin belum wujud, ignore
      console.error('D1 query error:', e);
    }

    let newEntries;
    let newCompanyMeta;

    if (existing) {
      // Merge entries: append new entries, dedupe by id
      const oldEntries = JSON.parse(existing.entries_json || '[]');
      const existingIds = new Set(oldEntries.filter(e => e && e.id).map(e => e.id));
      
      newEntries = [...oldEntries];
      entries.forEach(entry => {
        if (entry && entry.id && !existingIds.has(entry.id)) {
          newEntries.push(entry);
        } else if (entry && !entry.id) {
          // Entry without id — append as new
          newEntries.push(entry);
        }
      });
      
      // Update companyMeta jika diberikan
      newCompanyMeta = companyMeta ? companyMeta : existing.company_meta;
    } else {
      // Data baru — masukkan semua entries
      newEntries = entries;
      newCompanyMeta = companyMeta || {};
    }

    // Simpan ke D1 (INSERT OR REPLACE)
    await env.DB.prepare(
      `INSERT OR REPLACE INTO client_entries 
       (client_id, entries_json, company_meta, updated_at) 
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(
      String(clientId),
      JSON.stringify(newEntries),
      JSON.stringify(newCompanyMeta || {})
    ).run();

    return new Response(
      JSON.stringify({ success: true, message: 'Data berjaya disimpan ke D1' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Save error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Ralat tidak diketahui' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * GET /api/load?clientId=xxx
 * Muat entries dari D1 berdasarkan clientId.
 */
async function handleLoad(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId');

    if (!clientId) {
      return new Response(
        JSON.stringify({ success: false, error: 'clientId wajib diisi (query param)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ambil data dari D1
    let row = null;
    try {
      row = await env.DB.prepare(
        'SELECT entries_json, company_meta FROM client_entries WHERE client_id = ?'
      ).bind(String(clientId)).first();
    } catch (e) {
      console.error('D1 query error:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'Ralat panggilan pangkalan data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!row) {
      // Tiada data — return empty
      return new Response(
        JSON.stringify({ success: true, entries: [], companyMeta: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const entries = JSON.parse(row.entries_json || '[]');
    const companyMeta = row.company_meta ? JSON.parse(row.company_meta) : null;

    return new Response(
      JSON.stringify({ success: true, entries, companyMeta }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Load error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Ralat tidak diketahui' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
