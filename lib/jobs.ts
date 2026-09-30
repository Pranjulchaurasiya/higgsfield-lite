import { supabase, DEMO_USER_ID } from './supabase';
import { reserveCredit, refundCredit } from './credits';
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

// Global in-memory fallback store when Supabase tables are unmigrated
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

  // 1. Check idempotency: if key exists in memory or Supabase, return existing
  for (const job of mockJobs.values()) {
    if (job.idempotency_key === params.idempotencyKey) {
      return { success: true, job };
    }
  }

  try {
    const { data: existing } = await supabase
      .from('generation_jobs')
      .select('*, asset:resulting_asset_id(*)')
      .eq('idempotency_key', params.idempotencyKey)
      .maybeSingle();

    if (existing) {
      return { success: true, job: existing };
    }
  } catch {
    // Continue to creation
  }

  // 2. Pre-generate job ID to link with atomic reservation
  const jobId = crypto.randomUUID();

  // 3. Atomically reserve 1 credit
  const reservation = await reserveCredit(jobId, userId);
  if (!reservation.success) {
    return { success: false, error: reservation.error || 'Failed to reserve credit' };
  }

  // 4. Insert queued job
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

  mockJobs.set(jobId, { ...newJob });

  try {
    const { data: inserted, error: insertErr } = await supabase
      .from('generation_jobs')
      .insert(newJob)
      .select()
      .single();

    if (!insertErr && inserted) {
      return { success: true, job: inserted };
    }
  } catch {
    // Supabase table not present, continue with mockJobs
  }

  return { success: true, job: newJob };
}

export async function processJob(jobId: string): Promise<void> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + 60_000).toISOString();

  // 1. Try Supabase claim first, fallback to memory
  let job = mockJobs.get(jobId);

  try {
    const { data: dbJob } = await supabase
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

    if (dbJob) {
      job = dbJob;
    }
  } catch {
    // Ignore db failure
  }

  if (!job) {
    return;
  }

  // Transition state to processing
  job.state = 'processing';
  job.started_at = now.toISOString();
  job.processing_lease_until = leaseUntil;
  mockJobs.set(jobId, { ...job });

  // 2. Check for forced failure simulation (deterministic MOCK path)
  if (job.forced_failure) {
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Visible simulation step
    const completedAt = new Date().toISOString();
    job.state = 'failed';
    job.completed_at = completedAt;
    job.safe_error_summary = 'MOCK failure simulation triggered by user';
    mockJobs.set(jobId, { ...job });

    try {
      await supabase
        .from('generation_jobs')
        .update({
          state: 'failed',
          completed_at: completedAt,
          safe_error_summary: 'MOCK failure simulation triggered by user',
        })
        .eq('id', jobId);
    } catch {
      // Ignore
    }

    await refundCredit(jobId, 'Simulated MOCK failure', job.demo_user_id);
    return;
  }

  // 3. Call Cloudflare Workers AI FLUX.1 Schnell
  const inference = await runCloudflareInference(job.prompt, job.aspect_ratio);

  if (!inference.ok || !inference.imageBuffer) {
    const completedAt = new Date().toISOString();
    const errMsg = inference.error || 'Provider generation failed';
    job.state = 'failed';
    job.completed_at = completedAt;
    job.safe_error_summary = errMsg;
    mockJobs.set(jobId, { ...job });

    try {
      await supabase
        .from('generation_jobs')
        .update({
          state: 'failed',
          completed_at: completedAt,
          safe_error_summary: errMsg,
        })
        .eq('id', jobId);
    } catch {
      // Ignore
    }

    await refundCredit(jobId, errMsg, job.demo_user_id);
    return;
  }

  // 4. Save image: try Supabase storage or fall back to base64 Data URL
  const fileKey = `${job.demo_user_id}/${job.id}.jpg`;
  const base64Data = `data:image/jpeg;base64,${inference.imageBuffer.toString('base64')}`;

  try {
    await supabase.storage
      .from('generated-images')
      .upload(fileKey, inference.imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });
  } catch {
    // Bucket not created yet, base64 data URL will be used
  }

  // 5. Create Asset record
  const assetId = crypto.randomUUID();
  const assetRecord = {
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
    created_at: new Date().toISOString(),
  };

  mockAssets.set(assetId, assetRecord);

  try {
    await supabase.from('assets').insert({
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
  } catch {
    // Ignore
  }

  // 6. Complete job
  const completedAt = new Date().toISOString();
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

  try {
    await supabase
      .from('generation_jobs')
      .update({
        state: 'completed',
        completed_at: completedAt,
        resulting_asset_id: assetId,
      })
      .eq('id', jobId);
  } catch {
    // Ignore
  }
}

export async function getGenerationJob(jobId: string): Promise<GenerationJob | null> {
  const memoryJob = mockJobs.get(jobId);
  try {
    const { data: dbJob, error } = await supabase
      .from('generation_jobs')
      .select('*, asset:resulting_asset_id(*)')
      .eq('id', jobId)
      .single();

    if (!error && dbJob) {
      return dbJob;
    }
  } catch {
    // Fall back to memory
  }
  return memoryJob || null;
}

export async function listGenerationJobs(userId: string = DEMO_USER_ID): Promise<GenerationJob[]> {
  try {
    const { data, error } = await supabase
      .from('generation_jobs')
      .select('*, asset:resulting_asset_id(*)')
      .eq('demo_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch {
    // Fall back to memory
  }

  const jobsList = Array.from(mockJobs.values())
    .filter((j) => j.demo_user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return jobsList;
}

export async function reconcileExpiredLeases(userId: string = DEMO_USER_ID): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();

  // Check memory jobs
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

  try {
    const { data: expiredJobs } = await supabase
      .from('generation_jobs')
      .select('id, demo_user_id')
      .eq('demo_user_id', userId)
      .eq('state', 'processing')
      .lt('processing_lease_until', nowIso);

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
  } catch {
    // Ignore
  }
}
