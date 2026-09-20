const API = 'https://mzvlf6prc2.execute-api.ap-south-1.amazonaws.com';

const RETRY_STATUSES = new Set([502, 503, 504]);

export async function postJson(path, body, { retry = true } = {}) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (RETRY_STATUSES.has(res.status) && retry) {
    await new Promise((r) => setTimeout(r, 2000));
    return postJson(path, body, { retry: false });
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('The server returned an unreadable response.');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}