import { NextRequest, NextResponse } from 'next/server';
import { getGenerationJob, reconcileExpiredLeases } from '@/lib/jobs';
import { DEMO_USER_ID } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await reconcileExpiredLeases(DEMO_USER_ID);

    const job = await getGenerationJob(id);

    if (!job) {
      return NextResponse.json({ success: false, error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
