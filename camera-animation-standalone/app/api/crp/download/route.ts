import { NextRequest, NextResponse } from 'next/server';
import { findExactModel } from '../../../lib/crp-server';

export const dynamic = 'force-dynamic';

const safeFileName = (value: string) => {
  const name = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '');
  return name.toLowerCase().endsWith('.glb') ? name : `${name}.glb`;
};

export async function GET(request: NextRequest) {
  const requestedName = request.nextUrl.searchParams.get('file_name')?.trim();
  const inline = request.nextUrl.searchParams.get('inline') === '1';
  if (!requestedName) {
    return NextResponse.json({ error: 'file_name is required.' }, { status: 400 });
  }

  try {
    const fileName = safeFileName(requestedName);
    const model = await findExactModel(fileName);
    const assetUrl = model?.download_url || model?.signed_url;
    if (!assetUrl) {
      return NextResponse.json({ error: 'GLB download URL was not found.' }, { status: 404 });
    }
    const assetResponse = await fetch(assetUrl, { cache: 'no-store' });
    if (!assetResponse.ok || !assetResponse.body) {
      throw new Error(`GLB download failed (${assetResponse.status}).`);
    }
    return new NextResponse(assetResponse.body, {
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'GLB download failed.' },
      { status: 500 },
    );
  }
}

