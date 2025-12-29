/**
 * Fact Check Service - Google画像検索 + CLIP顔比較
 * camko.netの結果を検証するためのサービス
 */

import puppeteer, { Browser } from 'puppeteer';

export interface FactCheckResult {
    success: boolean;
    personName: string;
    verificationScore: number;  // 0-100
    matchedImages: {
        url: string;
        similarity: number;
    }[];
    error?: string;
}

/**
 * Google画像検索で人物名を検索し、上位画像のURLを取得
 */
async function searchGoogleImages(personName: string, maxImages: number = 5): Promise<string[]> {
    let browser: Browser | null = null;

    try {
        console.log(`[FactCheck] Searching Google Images for: ${personName}`);

        browser = await puppeteer.launch({
            headless: true,  // ヘッドレスモードでバックグラウンド実行
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // User-Agentを設定（ボット検出回避）
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Google画像検索
        const searchQuery = encodeURIComponent(personName);
        await page.goto(`https://www.google.com/search?q=${searchQuery}&tbm=isch`, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 画像URLを抽出
        const imageUrls = await page.evaluate((max) => {
            const urls: string[] = [];

            // サムネイル画像を取得
            const imgs = document.querySelectorAll('img[data-src], img[src]');

            for (const img of imgs) {
                if (urls.length >= max) break;

                const src = (img as HTMLImageElement).src || (img as HTMLImageElement).getAttribute('data-src');

                // 有効な画像URLかチェック
                if (src &&
                    src.startsWith('http') &&
                    !src.includes('google.com') &&
                    !src.includes('gstatic.com') &&
                    !src.includes('data:image')) {
                    urls.push(src);
                }
            }

            return urls;
        }, maxImages);

        console.log(`[FactCheck] Found ${imageUrls.length} images`);
        return imageUrls;

    } catch (error: any) {
        console.error('[FactCheck] Google Images search error:', error);
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 2つの画像のBase64データからCLIP埋め込みの類似度を計算
 * Note: このバージョンではサーバーサイドで直接比較するため、
 * 画像URLをそのまま返して、クライアント側でCLIP比較を行う
 */
export async function factCheckWithGoogleImages(
    personName: string,
    originalImageBase64: string
): Promise<FactCheckResult> {
    try {
        console.log(`[FactCheck] Starting fact check for: ${personName}`);

        // Google画像検索で画像を取得
        const imageUrls = await searchGoogleImages(personName, 5);

        if (imageUrls.length === 0) {
            return {
                success: false,
                personName,
                verificationScore: 0,
                matchedImages: [],
                error: '画像が見つかりませんでした'
            };
        }

        // 画像URLを返す（CLIP比較はクライアント側で実行）
        // サーバーサイドでCLIPを実行するのは重いため、URLのみ返す
        return {
            success: true,
            personName,
            verificationScore: -1,  // クライアントで計算
            matchedImages: imageUrls.map(url => ({
                url,
                similarity: -1  // クライアントで計算
            }))
        };

    } catch (error: any) {
        console.error('[FactCheck] Error:', error);
        return {
            success: false,
            personName,
            verificationScore: 0,
            matchedImages: [],
            error: error.message
        };
    }
}

/**
 * サーバーサイドで画像URLからBase64を取得
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) return null;

        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        return `data:${contentType};base64,${base64}`;
    } catch (error) {
        console.error('[FactCheck] Failed to fetch image:', error);
        return null;
    }
}
