"use client";

/**
 * Google Lens Reverse Image Search Service
 * 画像をGoogle Lensに送信して、類似画像やソース情報を取得
 * 
 * Note: これはスクレイピングベースの実装です。
 * Google Lensの検索URLを生成し、結果からTwitter/Xリンクを抽出します。
 */

export interface LensSearchResult {
    title: string;
    url: string;
    source: string;
    thumbnail?: string;
    isTwitter: boolean;
    twitterHandle?: string;
}

export interface LensSearchResponse {
    success: boolean;
    results: LensSearchResult[];
    lensUrl: string;
    error?: string;
}

/**
 * Base64画像からGoogle Lens検索URLを生成
 * ユーザーがブラウザで開いて結果を確認できる
 */
export function generateLensSearchUrl(imageBase64: string): string {
    // Google Lensは直接Base64を受け付けないため、
    // 画像をアップロードするか、URLベースで検索する必要がある
    // ここではGoogle Lens URLの生成方法を提供

    // 方法1: lens.google.com にリダイレクト（手動検索用）
    return 'https://lens.google.com/';
}

/**
 * 画像URLからGoogle Lens検索URLを生成
 */
export function generateLensSearchUrlFromUrl(imageUrl: string): string {
    const encodedUrl = encodeURIComponent(imageUrl);
    return `https://lens.google.com/uploadbyurl?url=${encodedUrl}`;
}

/**
 * Google Lensの検索を実行（サーバーサイドProxy経由）
 * 
 * Note: CORSの制限があるため、実際の検索は
 * - Next.js API Route経由
 * - またはCloudflare Worker経由
 * で行う必要があります
 */
export async function searchWithGoogleLens(
    imageBase64: string,
    proxyEndpoint?: string
): Promise<LensSearchResponse> {
    // プロキシエンドポイントが指定されていない場合
    if (!proxyEndpoint) {
        // フォールバック: 検索URLを返す（ユーザーが手動で開く）
        return {
            success: false,
            results: [],
            lensUrl: generateLensSearchUrl(imageBase64),
            error: 'プロキシエンドポイントが設定されていません。検索URLを使用してください。'
        };
    }

    try {
        const response = await fetch(proxyEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageBase64,
                extractTwitter: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            results: extractTwitterResults(data.results || []),
            lensUrl: data.lensUrl || ''
        };
    } catch (error) {
        console.error('[GoogleLens] Search failed:', error);
        return {
            success: false,
            results: [],
            lensUrl: generateLensSearchUrl(imageBase64),
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * 検索結果からTwitter/X関連のものを抽出
 */
function extractTwitterResults(results: any[]): LensSearchResult[] {
    return results.map(r => {
        const url = r.url || r.link || '';
        const isTwitter = isTwitterUrl(url);

        return {
            title: r.title || '',
            url: url,
            source: r.source || extractDomain(url),
            thumbnail: r.thumbnail,
            isTwitter,
            twitterHandle: isTwitter ? extractTwitterHandle(url) : undefined
        };
    }).filter(r => r.url); // URLがあるもののみ
}

/**
 * URLがTwitter/Xかどうか判定
 */
function isTwitterUrl(url: string): boolean {
    return url.includes('twitter.com') || url.includes('x.com');
}

/**
 * TwitterURLからハンドルを抽出
 */
function extractTwitterHandle(url: string): string | undefined {
    // https://twitter.com/username/status/123 or https://x.com/username
    const match = url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/);
    if (match && match[1] && !['status', 'intent', 'search', 'home', 'i'].includes(match[1])) {
        return `@${match[1]}`;
    }
    return undefined;
}

/**
 * URLからドメインを抽出
 */
function extractDomain(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace('www.', '');
    } catch {
        return '';
    }
}

/**
 * 新しいタブでGoogle Lens検索を開く（手動検索用）
 */
export function openGoogleLensSearch(imageBase64: string): void {
    // 画像をBlobに変換してダウンロード用URLを作成
    const byteCharacters = atob(imageBase64.split(',')[1] || imageBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    // Lens URLを開く（ユーザーが手動でアップロード）
    window.open('https://lens.google.com/', '_blank');

    // 画像をクリップボードにコピー（可能な場合）
    try {
        navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]).then(() => {
            console.log('[GoogleLens] Image copied to clipboard');
        }).catch(() => {
            console.log('[GoogleLens] Could not copy image to clipboard');
        });
    } catch {
        console.log('[GoogleLens] Clipboard API not available');
    }
}
