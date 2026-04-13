export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(405).json({ error: 'Method not allowed. Use POST to create POI or DELETE /api/pois/[id] to delete.' });
}
