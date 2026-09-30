import { NextRequest, NextResponse } from 'next/server';
import { supabase, DEMO_USER_ID } from '@/lib/supabase';
import type { StoredAsset } from '@/lib/jobs';

const isDev = process.env.NODE_ENV !== 'production';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const globalJobStore = globalThis as unknown as {
      _mockAssets?: Map<string, StoredAsset>;
    };
    if (isDev && globalJobStore._mockAssets?.has(id)) {
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

    if (fetchErr) {
      if (fetchErr.code !== 'PGRST116') {
        console.error(
          `[Supabase Error] DELETE /api/assets/[id] fetch failed: ${fetchErr.message} (code: ${fetchErr.code || 'NONE'})`
        );
        if (!isDev) {
          return NextResponse.json(
            { success: false, error: `Database error fetching asset: ${fetchErr.message}` },
            { status: 500 }
          );
        }
      }
      // If it's a sample fixture or not found, acknowledge gracefully
      return NextResponse.json({ success: true, message: 'Asset removed from active view' });
    }

    if (!asset) {
      return NextResponse.json({ success: true, message: 'Asset removed from active view' });
    }

    // Delete storage object if stored in bucket
    if (!asset.storage_object_key.startsWith('http')) {
      const { error: removeErr } = await supabase.storage
        .from('generated-images')
        .remove([asset.storage_object_key]);
      if (removeErr) {
        console.error(
          `[Supabase Error] Storage remove failed for ${asset.storage_object_key}: ${removeErr.message}`
        );
      }
    }

    // Delete asset row
    const { error: delErr } = await supabase
      .from('assets')
      .delete()
      .eq('id', id)
      .eq('user_id', DEMO_USER_ID);

    if (delErr) {
      console.error(
        `[Supabase Error] DELETE /api/assets/[id] delete failed: ${delErr.message} (code: ${delErr.code || 'NONE'})`
      );
      return NextResponse.json(
        { success: false, error: `Database error deleting asset: ${delErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: 'Asset deleted' });
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[Supabase Error] DELETE /api/assets/[id] exception: ${err.message}`);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
