export default {
  async fetch(request, env, ctx) {
    return new Response("Kira Enterprise V4 Worker API Active!", {
      headers: { "content-type": "text/plain" },
    });
  },
};
