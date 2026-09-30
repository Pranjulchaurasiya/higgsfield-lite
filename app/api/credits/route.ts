import { NextResponse } from 'next/server';
import { getCreditLedger } from '@/lib/credits';
import { DEMO_USER_ID } from '@/lib/supabase';

export async function GET() {
  try {
    const data = await getCreditLedger(DEMO_USER_ID);
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
