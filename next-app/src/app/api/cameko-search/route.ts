/**
 * Cameko Search API - 可視ブラウザモード
 * POST /api/cameko-search
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchWithCameko, batchSearchWithCameko } from '@/utils/camekoService';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 一括検索の場合（可視モード）
        if (body.images && Array.isArray(body.images)) {
            console.log('[API] Starting batch Cameko search (visible mode) for', body.images.length, 'images');

            const result = await batchSearchWithCameko(body.images);

            return NextResponse.json({
                success: result.success,
                totalTabs: result.totalTabs,
                completedTabs: result.completedTabs,
                error: result.error
            });
        }

        // 単一画像検索の場合
        const { imageBase64 } = body;

        if (!imageBase64) {
            return NextResponse.json(
                { success: false, error: 'imageBase64 is required' },
                { status: 400 }
            );
        }

        console.log('[API] Starting single Cameko search (visible mode)...');
        const result = await searchWithCameko(imageBase64);

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[API] Cameko search error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
