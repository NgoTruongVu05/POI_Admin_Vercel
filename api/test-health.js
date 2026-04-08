function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export default function handler(req, res) {
  if (req.method === 'GET') return json(res, 200, { ok: true, route: '/api/test-health' });
  res.setHeader('Allow', 'GET');
  return json(res, 405, { error: 'Method Not Allowed' });
}
