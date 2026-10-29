import { NextRequest, NextResponse } from 'next/server';
import { findExactModel, searchModels } from '../../../lib/crp-server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search')?.trim();
  if (!search) return NextResponse.json({ error: 'Enter a filename or search text.' }, { status: 400 });
  try {
    if (/\.glb$/i.test(search)) {
      const exact = await findExactModel(search);
      return NextResponse.json({ data: exact ? [exact] : [] });
    }
    return NextResponse.json(await searchModels(search));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'CRP search failed.' },
      { status: 500 },
    );
  }
}

