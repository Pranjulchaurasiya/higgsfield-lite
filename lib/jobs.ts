import { supabase, DEMO_USER_ID } from './supabase';
import { reserveCredit, refundCredit, getCreditBalance } from './credits';
import { runCloudflareInference } from './cloudflare';

export interface GenerationJob {
  id: string;
  demo_user_id: string;
  idempotency_key: string;
  prompt: string;
  aspect_ratio: string;
  state: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  provider: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  processing_lease_until: string | null;
  safe_error_summary: string | null;
  retry_parent_id: string | null;
  forced_failure: boolean;
  resulting_asset_id: string | null;
  asset?: {
    id: string;
    storage_object_key: string;
    width: number;
    height: number;
    is_sample: boolean;
    data_url?: string;
  } | null;
}

export interface StoredAsset {
  id: string;
  job_id: string | null;
  user_id: string;
  storage_object_key: string;
  prompt: string;
  aspect_ratio: string;
  width: number;
  height: number;
  is_sample: boolean;
  data_url?: string;
  url?: string;
  created_at: string;
}

const isDev = process.env.NODE_ENV !== 'production';

// Global in-memory fallback store (dev-only for local offline testing)
const globalJobStore = globalThis as unknown as {
  _mockJobs?: Map<string, GenerationJob>;
  _mockAssets?: Map<string, StoredAsset>;
};

if (!globalJobStore._mockJobs) {
  globalJobStore._mockJobs = new Map();
}
if (!globalJobStore._mockAssets) {
  globalJobStore._mockAssets = new Map();
}

const mockJobs = globalJobStore._mockJobs;
const mockAssets = globalJobStore._mockAssets;

export async function createGenerationJob(params: {
  prompt: string;
  aspectRatio: string;
  idempotencyKey: string;
  forcedFailure?: boolean;
  retryParentId?: string;
  userId?: string;
}): Promise<{ success: boolean; job?: GenerationJob; error?: string }> {
  const userId = params.userId || DEMO_USER_ID;

  // 1. Check idempotency in Supabase first
  const { data: existing, error: idempErr } = await supabase
    .from('generation_jobs')
    .select('*, asset:resulting_asset_id(*)')
    .eq('idempotency_key', params.idempotencyKey)
    .maybeSingle();

  if (idempErr) {
    console.error(`[Supabase Error] Idempotency check failed: ${idempErr.message} (code: ${idempErr.code})`);
    if (!isDev) {
      return { success: false, error: `Database error checking idempotency: ${idempErr.message}` };
    }
  }

  if (existing) {
    return { success: true, job: existing };
  }

  if (isDev) {
    for (const job of mockJobs.values()) {
      if (job.idempotency_key === params.idempotencyKey) {
        return { success: true, job };
      }
    }
  }

  // 2. Pre-generate job ID to link with atomic reservation
  const jobId = crypto.randomUUID();

  // 3. Pre-flight credit balance check
  const currentBalance = await getCreditBalance(userId);
  if (currentBalance < 1) {
    return { success: false, error: 'Insufficient demo credits. Minimum 1 credit required.' };
  }

  // 4. Insert queued job into Supabase first (so credit_transactions foreign key job_id references valid job)
  const newJob: GenerationJob = {
    id: jobId,
    demo_user_id: userId,
    idempotency_key: params.idempotencyKey,
    prompt: params.prompt.trim(),
    aspect_ratio: params.aspectRatio,
    state: 'queued',
    provider: '@cf/black-forest-labs/flux-1-schnell',
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    processing_lease_until: null,
    safe_error_summary: null,
    forced_failure: Boolean(params.forcedFailure),
    retry_parent_id: params.retryParentId || null,
    resulting_asset_id: null,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('generation_jobs')
    .insert(newJob)
    .select()
    .single();

  if (insertErr || !inserted) {
    console.error(`[Supabase Error] createGenerationJob insert failed: ${insertErr?.message || 'Unknown database insert error'} (code: ${insertErr?.code || 'NONE'})`);
    if (!isDev) {
      return { success: false, error: `Database error saving generation job: ${insertErr?.message || 'Insert failed'}` };
    }

    // Dev-only fallback
    mockJobs.set(jobId, { ...newJob });
  }

  // 5. Atomically reserve 1 credit and record ledger transaction
  const reservation = await reserveCredit(jobId, userId);
  if (!reservation.success) {
    // If reservation fails, clean up the queued job
    await supabase.from('generation_jobs').delete().eq('id', jobId);
    if (isDev) {
      mockJobs.delete(jobId);
    }
    return { success: false, error: reservation.error || 'Failed to reserve credit' };
  }

  const savedJob = inserted || newJob;
  if (isDev) {
    mockJobs.set(jobId, { ...savedJob });
  }

  return { success: true, job: savedJob };
}

export async function processJob(jobId: string): Promise<void> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 60_000).toISOString();

  // 1. Atomic claim: transition from 'queued' to 'processing' with a 60-second lease
  const { data: dbJob, error: claimErr } = await supabase
    .from('generation_jobs')
    .update({
      state: 'processing',
      started_at: now.toISOString(),
      processing_lease_until: leaseUntil,
    })
    .eq('id', jobId)
    .eq('state', 'queued')
    .select()
    .single();

  let job: GenerationJob | undefined = dbJob || undefined;

  if (claimErr || !job) {
    if (claimErr) {
      console.error(`[Supabase Error] processJob claim failed: ${claimErr.message} (code: ${claimErr.code})`);
    }

    if (!isDev) {
      // In production, another worker claimed or database is unreachable
      return;
    }

    // Dev-only fallback
    job = mockJobs.get(jobId);
    if (!job) return;
    job.state = 'processing';
    job.started_at = now.toISOString();
    job.processing_lease_until = leaseUntil;
    mockJobs.set(jobId, { ...job });
  }

  // 2. Check for forced failure simulation (deterministic MOCK path)
  if (job.forced_failure) {
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Visible simulation step
    const completedAt = new Date().toISOString();
    const errorSummary = 'MOCK failure simulation triggered by user';

    const { error: failErr } = await supabase
      .from('generation_jobs')
      .update({
        state: 'failed',
        completed_at: completedAt,
        safe_error_summary: errorSummary,
      })
      .eq('id', jobId);

    if (failErr) {
      console.error(`[Supabase Error] update failed state error: ${failErr.message} (code: ${failErr.code})`);
    }

    if (isDev) {
      job.state = 'failed';
      job.completed_at = completedAt;
      job.safe_error_summary = errorSummary;
      mockJobs.set(jobId, { ...job });
    }

    await refundCredit(jobId, 'Simulated MOCK failure', job.demo_user_id);
    return;
  }

  // 3. Call Cloudflare Workers AI FLUX.1 Schnell
  const inference = await runCloudflareInference(job.prompt, job.aspect_ratio);

  if (!inference.ok || !inference.imageBuffer) {
    const completedAt = new Date().toISOString();
    const errMsg = inference.error || 'Provider generation failed';

    const { error: failErr } = await supabase
      .from('generation_jobs')
      .update({
        state: 'failed',
        completed_at: completedAt,
        safe_error_summary: errMsg,
      })
      .eq('id', jobId);

    if (failErr) {
      console.error(`[Supabase Error] update inference failure state error: ${failErr.message} (code: ${failErr.code})`);
    }

    if (isDev) {
      job.state = 'failed';
      job.completed_at = completedAt;
      job.safe_error_summary = errMsg;
      mockJobs.set(jobId, { ...job });
    }

    await refundCredit(jobId, errMsg, job.demo_user_id);
    return;
  }

  // 4. Save image to Supabase Storage bucket
  const fileKey = `${job.demo_user_id}/${job.id}.jpg`;
  const base64Data = `data:image/jpeg;base64,${inference.imageBuffer.toString('base64')}`;

  let { error: uploadErr } = await supabase.storage
    .from('generated-images')
    .upload(fileKey, inference.imageBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (uploadErr) {
    console.error(`[Supabase Error] Storage upload failed: ${uploadErr.message}`);

    // If bucket was missing, attempt automatic creation once
    if (uploadErr.message.includes('not found') || (uploadErr as unknown as { code?: string }).code === 'NoSuchBucket') {
      const { error: createBucketErr } = await supabase.storage.createBucket('generated-images', { public: false });
      if (!createBucketErr) {
        // Retry upload
        const retry = await supabase.storage
          .from('generated-images')
          .upload(fileKey, inference.imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });
        uploadErr = retry.error;
      }
    }
  }

  if (uploadErr) {
    console.error(`[Supabase Error] Storage persistence failed: ${uploadErr.message}`);
    if (!isDev) {
      // In production, storage failure must mark job as failed and refund
      await supabase
        .from('generation_jobs')
        .update({
          state: 'failed',
          completed_at: new Date().toISOString(),
          safe_error_summary: `Storage persistence error: ${uploadErr.message}`,
        })
        .eq('id', jobId);

      await refundCredit(jobId, `Storage upload error: ${uploadErr.message}`, job.demo_user_id);
      return;
    }
  }

  // 5. Create Asset row in Supabase
  const assetId = crypto.randomUUID();
  const { error: assetErr } = await supabase.from('assets').insert({
    id: assetId,
    job_id: job.id,
    user_id: job.demo_user_id,
    storage_object_key: fileKey,
    prompt: job.prompt,
    aspect_ratio: job.aspect_ratio,
    width: inference.width || 1024,
    height: inference.height || 1024,
    is_sample: false,
    created_at: new Date().toISOString(),
  });

  if (assetErr) {
    console.error(`[Supabase Error] Asset insertion failed: ${assetErr.message} (code: ${assetErr.code})`);
    if (!isDev) {
      await supabase
        .from('generation_jobs')
        .update({
          state: 'failed',
          completed_at: new Date().toISOString(),
          safe_error_summary: `Database asset error: ${assetErr.message}`,
        })
        .eq('id', jobId);

      await refundCredit(jobId, `Asset row creation error: ${assetErr.message}`, job.demo_user_id);
      return;
    }
  }

  // 6. Complete job in Supabase
  const completedAt = new Date().toISOString();
  const { error: completeErr } = await supabase
    .from('generation_jobs')
    .update({
      state: 'completed',
      completed_at: completedAt,
      resulting_asset_id: assetId,
    })
    .eq('id', jobId);

  if (completeErr) {
    console.error(`[Supabase Error] Job completion update failed: ${completeErr.message} (code: ${completeErr.code})`);
  }

  if (isDev) {
    job.state = 'completed';
    job.completed_at = completedAt;
    job.resulting_asset_id = assetId;
    job.asset = {
      id: assetId,
      storage_object_key: fileKey,
      width: inference.width || 1024,
      height: inference.height || 1024,
      is_sample: false,
      data_url: base64Data,
    };
    mockJobs.set(jobId, { ...job });
    mockAssets.set(assetId, {
      id: assetId,
      job_id: job.id,
      user_id: job.demo_user_id,
      storage_object_key: fileKey,
      prompt: job.prompt,
      aspect_ratio: job.aspect_ratio,
      width: inference.width || 1024,
      height: inference.height || 1024,
      is_sample: false,
      data_url: base64Data,
      created_at: completedAt,
    });
  }
}

export async function getGenerationJob(jobId: string): Promise<GenerationJob | null> {
  const { data: dbJob, error } = await supabase
    .from('generation_jobs')
    .select('*, asset:resulting_asset_id(*)')
    .eq('id', jobId)
    .single();

  if (error || !dbJob) {
    if (error) {
      console.error(`[Supabase Error] getGenerationJob failed: ${error.message} (code: ${error.code})`);
    }
    if (!isDev) {
      throw new Error(`Database error fetching job: ${error?.message || 'Job not found'}`);
    }
    return mockJobs.get(jobId) || null;
  }

  return dbJob;
}

export async function listGenerationJobs(userId: string = DEMO_USER_ID): Promise<GenerationJob[]> {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('*, asset:resulting_asset_id(*)')
    .eq('demo_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error(`[Supabase Error] listGenerationJobs failed: ${error.message} (code: ${error.code})`);
    if (!isDev) {
      throw new Error(`Database error listing generation jobs: ${error.message}`);
    }
    return Array.from(mockJobs.values())
      .filter((j) => j.demo_user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  return data || [];
}

export async function reconcileExpiredLeases(userId: string = DEMO_USER_ID): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: expiredJobs, error } = await supabase
    .from('generation_jobs')
    .select('id, demo_user_id')
    .eq('demo_user_id', userId)
    .eq('state', 'processing')
    .lt('processing_lease_until', nowIso);

  if (error) {
    console.error(`[Supabase Error] reconcileExpiredLeases query failed: ${error.message} (code: ${error.code})`);
    if (!isDev) return;
  }

  if (expiredJobs && expiredJobs.length > 0) {
    for (const exp of expiredJobs) {
      await supabase
        .from('generation_jobs')
        .update({
          state: 'failed',
          completed_at: nowIso,
          safe_error_summary: 'Execution lease timed out in background',
        })
        .eq('id', exp.id);

      await refundCredit(exp.id, 'Execution timeout lease expired', exp.demo_user_id);
    }
  }

  if (isDev) {
    for (const job of mockJobs.values()) {
      if (
        job.demo_user_id === userId &&
        job.state === 'processing' &&
        job.processing_lease_until &&
        new Date(job.processing_lease_until) < now
      ) {
        job.state = 'failed';
        job.completed_at = nowIso;
        job.safe_error_summary = 'Execution lease timed out in background';
        mockJobs.set(job.id, { ...job });
        await refundCredit(job.id, 'Execution timeout lease expired', userId);
      }
    }
  }
}
