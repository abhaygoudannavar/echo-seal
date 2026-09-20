/* Offline fallback: makes the local Lambda container look like API Gateway.
 *
 * The container exposes the Lambda Runtime Interface Emulator, which expects a
 * Lambda event envelope at a fixed path. The frontend speaks plain HTTP to
 * /verify and /generate. This translates between them so the whole demo can run
 * with no internet, which matters when the venue wifi dies.
 *
 *   docker run -d --rm --name echoseal-local -e ECHOSEAL_LOCAL=1 -p 9000:8080 echoseal-lambda
 *   node backend/local-proxy.mjs
 *   NEXT_PUBLIC_API_URL=http://localhost:8787 npm run dev   # in frontend/
 */
import { createServer } from 'node:http';

const PORT = 8787;
const RIE = 'http://localhost:9000/2015-03-31/functions/function/invocations';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }
  if (req.method !== 'POST') {
    res.writeHead(405, CORS);
    return res.end('POST only');
  }

  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = Buffer.concat(chunks).toString();

  const event = {
    rawPath: new URL(req.url, 'http://localhost').pathname,
    requestContext: { http: { method: 'POST' } },
    headers: { 'content-type': 'application/json' },
    body,
    isBase64Encoded: false,
  };

  try {
    const r = await fetch(RIE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const lambdaResponse = await r.json();

    // The RIE returns the handler's return value, so the real status and body are
    // nested inside it rather than being the HTTP response itself.
    const status = lambdaResponse.statusCode || 500;
    const payload =
      typeof lambdaResponse.body === 'string'
        ? lambdaResponse.body
        : JSON.stringify(lambdaResponse.body ?? { error: 'empty response' });

    res.writeHead(status, { ...CORS, 'Content-Type': 'application/json' });
    res.end(payload);
  } catch (err) {
    res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `local container unreachable: ${err.message}` }));
  }
}).listen(PORT, () => {
  console.log(`local API proxy on http://localhost:${PORT} -> ${RIE}`);
  console.log('point the frontend at it with NEXT_PUBLIC_API_URL=http://localhost:8787');
});
