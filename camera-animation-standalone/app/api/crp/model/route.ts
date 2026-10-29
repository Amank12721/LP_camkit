import { NextRequest, NextResponse } from 'next/server';
import { getModel } from '../../../lib/crp-server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { model_id: modelId } = await request.json();
    if (!modelId) return NextResponse.json({ error: 'model_id is required.' }, { status: 400 });
    const payload = await getModel(String(modelId));
    const data = payload?.data || payload;
    const cameraUrl = data?.meta_data?.dynamicCameraFile?.signed_url;
    let cameraData = null;
    if (typeof cameraUrl === 'string' && cameraUrl.startsWith('https://')) {
      const cameraResponse = await fetch(cameraUrl, { cache: 'no-store' });
      if (cameraResponse.ok) cameraData = await cameraResponse.json();
    }
    return NextResponse.json({ ...payload, cameraData });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'CRP model fetch failed.' },
      { status: 500 },
    );
  }
}

