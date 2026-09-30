import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createGenerationJob, processJob, reconcileExpiredLeases, listGenerationJobs } from '@/lib/jobs';
import { DEMO_USER_ID } from '@/lib/supabase';

export const maxDuration = 60; // 60-second execution allowance on Vercel Hobby

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, aspectRatio = '1:1', forcedFailure = false, idempotencyKey, retryParentId } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    if (prompt.length > 2000) {
      return NextResponse.json({ success: false, error: 'Prompt exceeds 2000 characters' }, { status: 400 });
    }

    const key = idempotencyKey || crypto.randomUUID();

    const result = await createGenerationJob({
      prompt,
      aspectRatio,
      idempotencyKey: key,
      forcedFailure: Boolean(forcedFailure),
      retryParentId,
    });

    if (!result.success || !result.job) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    const job = result.job;

    // Dispatch background execution if newly queued
    if (job.state === 'queued') {
      try {
        after(async () => {
          await processJob(job.id);
        });
      } catch {
        // Fallback for runtimes where after() is not active
        processJob(job.id).catch((err) => console.error('Background process error:', err));
      }
    }

    return NextResponse.json({ success: true, job });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Reconcile any expired jobs on read
    await reconcileExpiredLeases(DEMO_USER_ID);

    const jobs = await listGenerationJobs(DEMO_USER_ID);

    return NextResponse.json({ success: true, jobs });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message || 'Internal server error' }, { status: 500 });
  }
}
