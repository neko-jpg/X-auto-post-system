"use client";

/**
 * Vector Store - IndexedDB based image similarity database
 * 画像のEmbedding、pHash、アカウント情報を保存・検索
 */

import { cosineSimilarity } from './clipEmbedding';

// --- Types ---

export interface ImageRecord {
    id: string;
    embedding: number[];      // 512d CLIP vector
    pHash: string;            // 64bit perceptual hash
    accountName: string;
    accountHandle: string;    // @handle形式
    eventName?: string;
    imageUrl?: string;        // 参照用（オプション）
    createdAt: number;
}

export interface SearchResult extends ImageRecord {
    clipScore: number;
}

// --- Constants ---

const DB_NAME = 'image_similarity_db';
const DB_VERSION = 1;
const STORE_NAME = 'images';

// --- VectorStore Class ---

class VectorStore {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    /**
     * IndexedDBを初期化
     */
    async init(): Promise<void> {
        if (this.db) return;

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[VectorStore] Database initialized');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('accountHandle', 'accountHandle', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                    console.log('[VectorStore] Object store created');
                }
            };
        });

        return this.initPromise;
    }

    /**
     * 画像レコードを追加
     */
    async add(record: Omit<ImageRecord, 'id' | 'createdAt'>): Promise<string> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const fullRecord: ImageRecord = {
            ...record,
            id,
            createdAt: Date.now()
        };

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.add(fullRecord);

            request.onsuccess = () => {
                console.log('[VectorStore] Record added:', id);
                resolve(id);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 全レコードを取得
     */
    async getAll(): Promise<ImageRecord[]> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Embeddingによる類似検索（コサイン類似度）
     * @param queryEmbedding - 検索クエリの512次元ベクトル
     * @param topN - 返す候補数
     * @returns スコア付きの候補リスト
     */
    async searchByEmbedding(queryEmbedding: number[], topN: number = 10): Promise<SearchResult[]> {
        const all = await this.getAll();

        if (all.length === 0) {
            return [];
        }

        const scored = all.map(record => ({
            ...record,
            clipScore: cosineSimilarity(queryEmbedding, record.embedding)
        }));

        return scored
            .sort((a, b) => b.clipScore - a.clipScore)
            .slice(0, topN);
    }

    /**
     * アカウントハンドルで検索
     */
    async getByAccountHandle(handle: string): Promise<ImageRecord[]> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const index = store.index('accountHandle');
            const request = index.getAll(handle);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * レコード数を取得
     */
    async count(): Promise<number> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * レコードを削除
     */
    async delete(id: string): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 全データを削除
     */
    async clear(): Promise<void> {
        await this.init();
        if (!this.db) throw new Error('Database not initialized');

        return new Promise((resolve, reject) => {
            const tx = this.db!.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                console.log('[VectorStore] All records cleared');
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * ユニークなアカウント一覧を取得
     */
    async getUniqueAccounts(): Promise<{ name: string; handle: string; count: number }[]> {
        const all = await this.getAll();

        const accountMap = new Map<string, { name: string; handle: string; count: number }>();

        for (const record of all) {
            const key = record.accountHandle;
            const existing = accountMap.get(key);
            if (existing) {
                existing.count++;
            } else {
                accountMap.set(key, {
                    name: record.accountName,
                    handle: record.accountHandle,
                    count: 1
                });
            }
        }

        return Array.from(accountMap.values())
            .sort((a, b) => b.count - a.count);
    }
}

// シングルトンインスタンス
export const vectorStore = new VectorStore();
