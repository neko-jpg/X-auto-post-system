"use client";

/**
 * Image Similarity Service
 * CLIP Embedding + pHash + メタデータを統合したスコアリングシステム
 */

import { getImageEmbedding, initCLIP, isCLIPReady, cosineSimilarity } from './clipEmbedding';
import { computePHash, pHashSimilarity } from './pHashService';
import { vectorStore, ImageRecord, SearchResult } from './vectorStore';

// --- Types ---

export interface ScoredCandidate {
    accountName: string;
    accountHandle: string;
    scores: {
        clip: number;       // 0-1: CLIP埋め込みのコサイン類似度
        pHash: number;      // 0-1: pHash類似度
        metadata: number;   // 0-0.2: メタデータ一致ボーナス
        frequency: number;  // 0-0.1: 使用頻度ボーナス
    };
    totalScore: number;     // 0-1.3: 重み付け合計
    matchedImages: {
        id: string;
        score: number;
    }[];
    imageCount: number;     // このアカウントの登録画像数
}

export interface SearchProgress {
    status: 'initializing' | 'extracting_embedding' | 'searching' | 'scoring' | 'done';
    progress: number;       // 0-100
    message: string;
}

export type ProgressCallback = (progress: SearchProgress) => void;

// --- Constants ---

const WEIGHTS = {
    clip: 0.50,      // CLIP類似度の重み
    pHash: 0.30,     // pHash類似度の重み
    metadata: 0.15,  // メタデータ一致の重み
    frequency: 0.05  // 使用頻度の重み
};

const TOP_N_SEARCH = 50;  // ベクトル検索でのTop-N

// --- Main Service ---

/**
 * 画像から類似アカウント候補を検索
 * @param imageBase64 - 検索する画像（Base64）
 * @param eventName - 現在のイベント名（メタデータボーナス用）
 * @param onProgress - 進捗コールバック
 * @returns スコア付きアカウント候補リスト
 */
export async function findSimilarAccounts(
    imageBase64: string,
    eventName?: string,
    onProgress?: ProgressCallback
): Promise<ScoredCandidate[]> {
    const report = (status: SearchProgress['status'], progress: number, message: string) => {
        onProgress?.({ status, progress, message });
    };

    try {
        // 1. CLIPモデル初期化
        report('initializing', 0, 'AIモデルを準備中...');
        if (!isCLIPReady()) {
            await initCLIP();
        }
        report('initializing', 20, 'AIモデル準備完了');

        // 2. Embedding抽出
        report('extracting_embedding', 30, '画像特徴を抽出中...');
        const embedding = await getImageEmbedding(imageBase64);
        report('extracting_embedding', 50, '画像特徴抽出完了');

        // 3. pHash計算
        const queryHash = await computePHash(imageBase64);
        report('searching', 55, '類似画像を検索中...');

        // 4. ベクトル検索
        const candidates = await vectorStore.searchByEmbedding(embedding, TOP_N_SEARCH);

        if (candidates.length === 0) {
            report('done', 100, '候補なし');
            return [];
        }
        report('searching', 70, `${candidates.length}件の候補を発見`);

        // 5. スコアリング
        report('scoring', 75, 'スコアを計算中...');
        const scored = await scoreAndAggregate(candidates, embedding, queryHash, eventName);
        report('done', 100, '完了');

        return scored;
    } catch (error) {
        console.error('[ImageSimilarity] Search failed:', error);
        throw error;
    }
}

/**
 * 候補をスコアリングしてアカウント単位で集約
 */
async function scoreAndAggregate(
    candidates: SearchResult[],
    queryEmbedding: number[],
    queryHash: string,
    eventName?: string
): Promise<ScoredCandidate[]> {
    // アカウント単位で集約
    const accountMap = new Map<string, {
        accountName: string;
        accountHandle: string;
        images: {
            id: string;
            clipScore: number;
            pHashScore: number;
            metadataBonus: number;
        }[];
    }>();

    // 全アカウントのレコード数を取得（頻度計算用）
    const uniqueAccounts = await vectorStore.getUniqueAccounts();
    const accountCountMap = new Map(uniqueAccounts.map(a => [a.handle, a.count]));
    const maxCount = Math.max(...uniqueAccounts.map(a => a.count), 1);

    for (const candidate of candidates) {
        const key = candidate.accountHandle;

        // pHash類似度を計算
        const pHashScore = pHashSimilarity(queryHash, candidate.pHash);

        // メタデータボーナス（イベント名一致）
        let metadataBonus = 0;
        if (eventName && candidate.eventName) {
            if (candidate.eventName === eventName) {
                metadataBonus = 0.2;
            } else if (candidate.eventName.includes(eventName) || eventName.includes(candidate.eventName)) {
                metadataBonus = 0.1;
            }
        }

        if (!accountMap.has(key)) {
            accountMap.set(key, {
                accountName: candidate.accountName,
                accountHandle: candidate.accountHandle,
                images: []
            });
        }

        accountMap.get(key)!.images.push({
            id: candidate.id,
            clipScore: candidate.clipScore,
            pHashScore,
            metadataBonus
        });
    }

    // 最終スコア計算
    const results: ScoredCandidate[] = [];

    for (const [handle, data] of accountMap) {
        // 最もスコアの高い画像のスコアを使用
        const bestImage = data.images.reduce((best, img) => {
            const score = img.clipScore * WEIGHTS.clip + img.pHashScore * WEIGHTS.pHash + img.metadataBonus * WEIGHTS.metadata;
            const bestScore = best.clipScore * WEIGHTS.clip + best.pHashScore * WEIGHTS.pHash + best.metadataBonus * WEIGHTS.metadata;
            return score > bestScore ? img : best;
        });

        // 頻度ボーナス（登録画像数が多いほどボーナス）
        const imageCount = accountCountMap.get(handle) || 1;
        const frequencyBonus = (imageCount / maxCount) * 0.1;

        const totalScore =
            bestImage.clipScore * WEIGHTS.clip +
            bestImage.pHashScore * WEIGHTS.pHash +
            bestImage.metadataBonus * WEIGHTS.metadata +
            frequencyBonus * WEIGHTS.frequency;

        results.push({
            accountName: data.accountName,
            accountHandle: data.accountHandle,
            scores: {
                clip: bestImage.clipScore,
                pHash: bestImage.pHashScore,
                metadata: bestImage.metadataBonus,
                frequency: frequencyBonus
            },
            totalScore,
            matchedImages: data.images.map(img => ({ id: img.id, score: img.clipScore })),
            imageCount
        });
    }

    // スコア順でソート
    return results.sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * 新しい画像+アカウント情報をDBに登録
 * 投稿作成時に呼び出してデータを蓄積
 */
export async function registerImage(
    imageBase64: string,
    accountName: string,
    accountHandle: string,
    eventName?: string
): Promise<string> {
    // Embedding取得
    if (!isCLIPReady()) {
        await initCLIP();
    }
    const embedding = await getImageEmbedding(imageBase64);

    // pHash計算
    const pHash = await computePHash(imageBase64);

    // DB登録
    const id = await vectorStore.add({
        embedding,
        pHash,
        accountName,
        accountHandle,
        eventName
    });

    console.log('[ImageSimilarity] Registered image:', { id, accountHandle });
    return id;
}

/**
 * データベースの統計情報を取得
 */
export async function getStats(): Promise<{
    totalImages: number;
    uniqueAccounts: number;
    isModelReady: boolean;
}> {
    const count = await vectorStore.count();
    const accounts = await vectorStore.getUniqueAccounts();

    return {
        totalImages: count,
        uniqueAccounts: accounts.length,
        isModelReady: isCLIPReady()
    };
}
