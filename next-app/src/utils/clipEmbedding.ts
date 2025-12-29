"use client";

/**
 * CLIP Embedding Service
 * ブラウザ内でtransformers.jsを使用して画像の512次元Embeddingを生成
 *
 * Note: transformers.jsはクライアントサイドでのみ動作するため、
 * 動的インポートを使用しています。
 */

// シングルトンパイプライン (型はanyで柔軟に対応)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embeddingPipeline: any = null;
let isLoading = false;
let loadingPromise: Promise<void> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transformersModule: any = null;

/**
 * transformers.jsモジュールを動的にロード
 */
async function loadTransformers() {
    if (transformersModule) return transformersModule;

    // クライアントサイドでのみ実行
    if (typeof window === 'undefined') {
        throw new Error('transformers.js can only be used in browser environment');
    }

    transformersModule = await import('@xenova/transformers');

    // モデルキャッシュの設定
    transformersModule.env.allowLocalModels = false;
    transformersModule.env.useBrowserCache = true;

    return transformersModule;
}

/**
 * CLIPモデルの初期化（初回のみダウンロード）
 */
export async function initCLIP(): Promise<void> {
    if (embeddingPipeline) return;

    if (isLoading && loadingPromise) {
        return loadingPromise;
    }

    isLoading = true;
    loadingPromise = (async () => {
        try {
            console.log('[CLIP] Loading model (first time may take a while)...');

            const { pipeline } = await loadTransformers();

            // 量子化モデルを使用（87MB → ~23MB compressed）
            embeddingPipeline = await pipeline(
                'image-feature-extraction',
                'Xenova/clip-vit-base-patch32',
                {
                    quantized: true,
                    progress_callback: (progress: any) => {
                        if (progress.status === 'progress') {
                            console.log(`[CLIP] Download: ${Math.round(progress.progress)}%`);
                        }
                    }
                }
            );
            console.log('[CLIP] Model loaded successfully');
        } catch (error) {
            console.error('[CLIP] Failed to load model:', error);
            throw error;
        } finally {
            isLoading = false;
        }
    })();

    return loadingPromise;
}

/**
 * モデルが読み込まれているかどうか
 */
export function isCLIPReady(): boolean {
    return embeddingPipeline !== null;
}

/**
 * 画像からEmbeddingを取得
 * @param imageSource - Base64画像、URL、またはBlobURL
 * @returns 512次元の正規化されたベクトル
 */
export async function getImageEmbedding(imageSource: string): Promise<number[]> {
    if (!embeddingPipeline) {
        await initCLIP();
    }

    if (!embeddingPipeline) {
        throw new Error('CLIP pipeline not initialized');
    }

    try {
        const { RawImage } = await loadTransformers();

        // RawImageで画像を読み込み
        const image = await RawImage.fromURL(imageSource);

        // Embedding取得
        const result = await embeddingPipeline(image, { pooling: 'mean', normalize: true });

        // Float32Arrayから通常の配列に変換
        return Array.from(result.data as Float32Array);
    } catch (error) {
        console.error('[CLIP] Embedding extraction failed:', error);
        throw error;
    }
}

/**
 * 2つのEmbeddingのコサイン類似度を計算
 * @returns 0-1の値（1が完全一致）
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error('Vectors must have the same length');
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dot / denominator;
}
