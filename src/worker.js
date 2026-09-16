// src/worker.js

export default {
  async fetch(request, env, ctx) {
    try {
      // 1. Semak kaedah atau laluan request jika perlu
      const url = new URL(request.url);

      // Contoh logik carian pangkalan data D1 anda
      const result = await env.DB.prepare(
        "SELECT * FROM companies"
      ).all();

      // 2. Pulangkan respon berjaya
      return new Response(JSON.stringify({
        success: true,
        data: result.results
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (err) {
      // 3. Tangkap sebarang ralat
      return new Response(JSON.stringify({ 
        success: false, 
        error: err.message 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
