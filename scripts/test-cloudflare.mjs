// Exactly one inference request; environment is loaded by Node, never printed.
const model = '@cf/black-forest-labs/flux-1-schnell';
const required = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(JSON.stringify({ ok: false, reason: 'Missing environment variable', names: missing }));
  process.exit(1);
}

function jpegDimensions(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  for (let offset = 2; offset + 9 < bytes.length;) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

const started = performance.now();
try {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID)}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'A single orange on a cream tabletop, soft daylight, centered still life.', steps: 4 }),
    signal: AbortSignal.timeout(40_000),
  });
  const result = await response.json().catch(() => null);
  const image = typeof result?.result?.image === 'string' ? Buffer.from(result.result.image, 'base64') : null;
  const dimensions = image ? jpegDimensions(image) : null;
  const ok = response.ok && result?.success === true && !!dimensions && dimensions.width <= 1024 && dimensions.height <= 1024;
  // Never print an arbitrary provider error body: it could echo request details.
  const codes = Array.isArray(result?.errors) ? result.errors.map((e) => e.code).filter(Number.isFinite) : [];
  const reason = ok ? 'JPEG received within size and time budget'
    : response.status === 401 || response.status === 403 ? 'Provider rejected credentials or account permissions'
    : response.status === 429 ? 'Provider rate or daily usage limit'
    : !response.ok ? 'Provider returned a non-success HTTP status'
    : 'Missing/invalid JPEG or output dimensions exceed 1024';
  console.log(JSON.stringify({ ok, timestamp: new Date().toISOString(), model, steps: 4, status: response.status, elapsedMs: Math.round(performance.now() - started), imageBytes: image?.length ?? 0, dimensions, providerErrorCodes: codes, reason }));
  if (!ok) process.exitCode = 1;
} catch (error) {
  const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
  const code = error?.cause?.code;
  const allowed = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'];
  console.error(JSON.stringify({ ok: false, timestamp: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started), reason: timedOut ? 'Provider call exceeded 40-second deadline' : 'Transport or response parsing failure', code: allowed.includes(code) ? code : undefined }));
  process.exitCode = 1;
}
