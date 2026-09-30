import { NextResponse } from 'next/server';
import { supabase, DEMO_USER_ID } from '@/lib/supabase';

// Fixture sample assets for rich gallery exploration (labeled SAMPLE per PRD)
const SAMPLE_FIXTURES = [
  {
    id: 'sample-asset-01',
    job_id: 'sample-job-01',
    user_id: DEMO_USER_ID,
    storage_object_key: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1024&q=80',
    prompt: 'Warm terracotta ceramic vessels in natural diffused daylight, editorial still life, architectural composition',
    aspect_ratio: '1:1',
    width: 1024,
    height: 1024,
    is_sample: true,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1024&q=80',
  },
  {
    id: 'sample-asset-02',
    job_id: 'sample-job-02',
    user_id: DEMO_USER_ID,
    storage_object_key: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=576&q=80',
    prompt: 'Brutalist concrete courtyard with warm earth-toned shadows and wild pampas grass, portrait 9:16',
    aspect_ratio: '9:16',
    width: 576,
    height: 1024,
    is_sample: true,
    created_at: new Date(Date.now() - 14400000).toISOString(),
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=576&q=80',
  },
  {
    id: 'sample-asset-03',
    job_id: 'sample-job-03',
    user_id: DEMO_USER_ID,
    storage_object_key: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1024&q=80',
    prompt: 'Minimalist ochre plaster interior, raw timber dining table, sweeping panoramic daylight, 16:9',
    aspect_ratio: '16:9',
    width: 1024,
    height: 576,
    is_sample: true,
    created_at: new Date(Date.now() - 28800000).toISOString(),
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1024&q=80',
  },
];

export async function GET() {
  const globalJobStore = globalThis as unknown as {
    _mockAssets?: Map<string, any>;
  };
  const mockAssetsMap = globalJobStore._mockAssets || new Map();
  const memoryItems = Array.from(mockAssetsMap.values()).map((a) => ({
    ...a,
    url: a.data_url || a.storage_object_key,
  }));

  try {
    const { data: assets, error } = await supabase
      .from('assets')
      .select('*')
      .eq('user_id', DEMO_USER_ID)
      .order('created_at', { ascending: false });

    if (error || !assets || assets.length === 0) {
      // Fallback: Combine active session memory creations + PRD sample fixtures
      const combined = [...memoryItems, ...SAMPLE_FIXTURES];
      return NextResponse.json({ success: true, assets: combined });
    }

    // Attach signed URL for private bucket storage keys
    const items = await Promise.all(
      assets.map(async (asset) => {
        if (asset.storage_object_key.startsWith('http')) {
          return { ...asset, url: asset.storage_object_key };
        }
        const { data } = await supabase.storage
          .from('generated-images')
          .createSignedUrl(asset.storage_object_key, 3600);
        return {
          ...asset,
          url: data?.signedUrl || `/api/assets/${asset.id}/download`,
        };
      })
    );

    const combined = [...memoryItems, ...items, ...SAMPLE_FIXTURES];
    return NextResponse.json({ success: true, assets: combined });
  } catch {
    const combined = [...memoryItems, ...SAMPLE_FIXTURES];
    return NextResponse.json({ success: true, assets: combined });
  }
}
