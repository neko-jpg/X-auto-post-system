import { NextRequest, NextResponse } from 'next/server';

/**
 * Temporary Image Upload API
 * 
 * 画像を一時的にBase64データURLとして返す
 * （実際のプロダクション環境ではCloudflare R2などにアップロード推奨）
 */

// メモリ内一時ストレージ（開発用）
const tempImages = new Map<string, { data: string; expires: number }>();

// 古い画像をクリーンアップ
function cleanup() {
    const now = Date.now();
    for (const [id, img] of tempImages) {
        if (img.expires < now) {
            tempImages.delete(id);
        }
    }
}

export async function POST(request: NextRequest) {
    try {
        cleanup();

        const { imageBase64 } = await request.json();

        if (!imageBase64) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        // ユニークIDを生成
        const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // 5分後に期限切れ
        const expires = Date.now() + 5 * 60 * 1000;

        // 保存
        tempImages.set(id, { data: imageBase64, expires });

        // このアプリのURL（開発環境用）
        const baseUrl = request.nextUrl.origin;
        const imageUrl = `${baseUrl}/api/temp-image?id=${id}`;

        return NextResponse.json({
            success: true,
            imageId: id,
            imageUrl: imageUrl,
            expiresIn: '5 minutes'
        });

    } catch (error) {
        console.error('[TempImage API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'No id provided' }, { status: 400 });
    }

    const img = tempImages.get(id);

    if (!img || img.expires < Date.now()) {
        tempImages.delete(id);
        return NextResponse.json({ error: 'Image not found or expired' }, { status: 404 });
    }

    // Base64をデコードして画像として返す
    try {
        const base64Data = img.data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'no-store, max-age=0'
            }
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to decode image' }, { status: 500 });
    }
}
