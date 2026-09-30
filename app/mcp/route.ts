import { NextRequest } from 'next/server';
import { GET as apiGet, POST as apiPost } from '../api/mcp/route';

export async function GET(req: NextRequest) {
  return apiGet(req);
}

export async function POST(req: NextRequest) {
  return apiPost(req);
}
