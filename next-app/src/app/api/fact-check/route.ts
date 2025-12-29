/**
 * Fact Check API - Google画像検索でcamko.net結果を検証
 * POST /api/fact-check
 */

import { NextRequest, NextResponse } from 'next/server';
import { factCheckWithGoogleImages, fetchImageAsBase64 } from '@/utils/factCheckService';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { personName, originalImageBase64, fetchImages } = body;

        if (!personName) {
            return NextResponse.json(
                { success: false, error: 'personName is required' },
                { status: 400 }
            );
        }

        console.log(`[API] Starting fact check for: ${personName}`);

        // Google画像検索を実行
        const result = await factCheckWithGoogleImages(personName, originalImageBase64);

        // 画像のBase64も取得する場合
        if (fetchImages && result.success && result.matchedImages.length > 0) {
            console.log('[API] Fetching images as base64...');

            const imagesWithBase64 = await Promise.all(
                result.matchedImages.map(async (img) => {
                    const base64 = await fetchImageAsBase64(img.url);
                    return {
                        ...img,
                        base64: base64 || undefined
                    };
                })
            );

            return NextResponse.json({
                ...result,
                matchedImages: imagesWithBase64.filter(img => img.base64)
            });
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[API] Fact check error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
