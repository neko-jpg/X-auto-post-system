import { NextRequest, NextResponse } from 'next/server';

/**
 * Google Lens Proxy API Route
 * 
 * CORSの制限を回避するため、サーバーサイドでGoogle Lens検索を実行
 * 
 * 方式: SerpAPIのGoogle Lens APIを使用するか、
 * 手動でGoogle Lensの検索URLを開くよう促す
 */

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { image, extractTwitter } = body;

        if (!image) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        // Google Lensへの直接スクレイピングはGoogle ToSに違反する可能性があるため、
        // 代替手段を提供：
        // 1. SerpAPI（有料）を使う
        // 2. ユーザーに手動検索を促す

        // 方式2: 手動検索URL生成
        // Base64画像をデータURLに変換して返す
        const lensUrl = 'https://lens.google.com/';

        return NextResponse.json({
            success: true,
            method: 'manual',
            lensUrl: lensUrl,
            message: 'Google Lensを開いて画像をアップロードしてください。結果からTwitterアカウントを探してください。',
            // 画像はクリップボードにコピーする（クライアント側で処理）
            results: []
        });

    } catch (error) {
        console.error('[GoogleLens API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

// SerpAPIを使う場合の実装例（要APIキー）
async function searchWithSerpAPI(imageBase64: string): Promise<any[]> {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
        throw new Error('SERPAPI_KEY not configured');
    }

    // SerpAPIのGoogle Lens API
    // https://serpapi.com/google-lens-api
    const response = await fetch('https://serpapi.com/search.json', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        // Note: SerpAPIは画像URLが必要なため、画像を一時的にホストする必要がある
    });

    const data = await response.json();
    return data.visual_matches || [];
}
