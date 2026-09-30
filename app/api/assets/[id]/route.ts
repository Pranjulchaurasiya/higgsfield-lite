import { NextRequest, NextResponse } from 'next/server';
import { supabase, DEMO_USER_ID } from '@/lib/supabase';
import type { StoredAsset } from '@/lib/jobs';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const globalJobStore = globalThis as unknown as {
      _mockAssets?: Map<string, StoredAsset>;
    };
    if (globalJobStore._mockAssets?.has(id)) {
      globalJobStore._mockAssets.delete(id);
      return NextResponse.json({ success: true, message: 'Asset deleted' });
    }

    // Fetch asset to get storage key
    const { data: asset, error: fetchErr } = await supabase
      .from('assets')
      .select('storage_object_key')
      .eq('id', id)
      .eq('user_id', DEMO_USER_ID)
      .single();

    if (fetchErr || !asset) {
      // If it's a sample fixture, acknowledge gracefully
      return NextResponse.json({ success: true, message: 'Asset removed from active view' });
    }

    // Delete storage object if stored in bucket
    if (!asset.storage_object_key.startsWith('http')) {
      await supabase.storage.from('generated-images').remove([asset.storage_object_key]);
    }

    // Delete asset row
    const { error: delErr } = await supabase
      .from('assets')
      .delete()
      .eq('id', id)
      .eq('user_id', DEMO_USER_ID);

    if (delErr) {
      return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Asset deleted' });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
