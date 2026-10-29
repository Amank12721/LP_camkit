import { NextRequest, NextResponse } from 'next/server';
import { loginWithCredentials } from '../../../lib/crp-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { username, password, role } = await request.json();
    await loginWithCredentials({
      username: String(username || ''),
      password: String(password || ''),
      role: String(role || 'internal'),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'CRP login failed.' },
      { status: 401 },
    );
  }
}

