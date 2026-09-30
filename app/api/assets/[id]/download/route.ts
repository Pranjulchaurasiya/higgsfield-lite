import { NextRequest, NextResponse } from 'next/server';
import { supabase, DEMO_USER_ID } from '@/lib/supabase';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: asset, error } = await supabase
      .from('assets')
      .select('*')
      .eq('id', id)
      .eq('user_id', DEMO_USER_ID)
      .single();

    if (error || !asset) {
      return new NextResponse('Asset not found', { status: 404 });
    }

    if (asset.storage_object_key.startsWith('http')) {
      return NextResponse.redirect(asset.storage_object_key);
    }

    const { data, error: downloadErr } = await supabase.storage
      .from('generated-images')
      .download(asset.storage_object_key);

    if (downloadErr || !data) {
      return new NextResponse('Storage file not found', { status: 404 });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="higgsfield-lite-${asset.id.slice(0, 8)}.jpg"`,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    return new NextResponse(err.message, { status: 500 });
  }
}
