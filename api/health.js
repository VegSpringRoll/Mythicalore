export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  const payload = {
    status: 'ok',
    service: 'Mythicalore Roleplay Proxy (JavaScript ESM)',
    timestamp: Date.now(),
  };
  if (res.json) {
    return res.status(200).json(payload);
  }
  res.statusCode = 200;
  res.end(JSON.stringify(payload));
}
