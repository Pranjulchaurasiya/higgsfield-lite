export interface CloudflareGenerationResult {
  ok: boolean;
  imageBuffer?: Buffer;
  mimeType?: string;
  width?: number;
  height?: number;
  error?: string;
}

export function parseJpegDimensions(bytes: Buffer): { width: number; height: number } | null {
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

export function getCropDimensions(aspectRatio: string): { width: number; height: number } {
  switch (aspectRatio) {
    case '9:16':
      return { width: 576, height: 1024 };
    case '16:9':
      return { width: 1024, height: 576 };
    case '1:1':
    default:
      return { width: 1024, height: 1024 };
  }
}

export async function runCloudflareInference(
  prompt: string,
  aspectRatio: string = '1:1'
): Promise<CloudflareGenerationResult> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    return { ok: false, error: 'Cloudflare credentials not configured in environment' };
  }

  const model = '@cf/black-forest-labs/flux-1-schnell';
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt.slice(0, 2048),
        steps: 4,
      }),
      signal: AbortSignal.timeout(40_000), // 40-second bounded timeout per TECH_SPEC
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { ok: false, error: 'Provider authentication or account access rejected' };
      }
      if (response.status === 429) {
        return { ok: false, error: 'Daily inference quota or rate limit exceeded' };
      }
      return { ok: false, error: `Inference failed with status ${response.status}` };
    }

    const data = await response.json();
    if (!data.success || !data.result?.image) {
      return { ok: false, error: 'Provider response did not contain image data' };
    }

    const imageBuffer = Buffer.from(data.result.image, 'base64');
    const cropDims = getCropDimensions(aspectRatio);

    return {
      ok: true,
      imageBuffer,
      mimeType: 'image/jpeg',
      width: cropDims.width,
      height: cropDims.height,
    };
  } catch (err: unknown) {
    const error = err as Error;
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return { ok: false, error: 'Provider execution exceeded 40-second timeout' };
    }
    return { ok: false, error: error.message || 'Network error during provider call' };
  }
}
