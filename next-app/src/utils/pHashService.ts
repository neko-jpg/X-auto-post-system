"use client";

/**
 * Perceptual Hash (pHash) Service
 * 画像の知覚的ハッシュを計算し、類似度を比較
 * 
 * アルゴリズム:
 * 1. 画像を32x32にリサイズ
 * 2. グレースケール変換
 * 3. DCT (離散コサイン変換) 計算
 * 4. 8x8の低周波成分から64bitハッシュ生成
 */

/**
 * 画像からpHashを計算
 * @param imageBase64 - Base64エンコードされた画像
 * @returns 64文字の16進数ハッシュ（256bit）
 */
export async function computePHash(imageBase64: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // 32x32にリサイズ
                const size = 32;
                canvas.width = size;
                canvas.height = size;
                ctx.drawImage(img, 0, 0, size, size);

                // グレースケール変換
                const imageData = ctx.getImageData(0, 0, size, size);
                const grayPixels: number[][] = [];

                for (let y = 0; y < size; y++) {
                    grayPixels[y] = [];
                    for (let x = 0; x < size; x++) {
                        const idx = (y * size + x) * 4;
                        // Luminance formula
                        const gray = 0.299 * imageData.data[idx] +
                            0.587 * imageData.data[idx + 1] +
                            0.114 * imageData.data[idx + 2];
                        grayPixels[y][x] = gray;
                    }
                }

                // 簡易DCT（8x8の低周波成分を抽出）
                const dctResult = computeDCT(grayPixels, size);

                // 8x8の低周波成分を取得（DC成分を除く）
                const lowFreq: number[] = [];
                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        if (y === 0 && x === 0) continue; // DC成分をスキップ
                        lowFreq.push(dctResult[y][x]);
                    }
                }

                // 中央値を計算
                const sorted = [...lowFreq].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)];

                // ハッシュ生成（中央値より大きい場合は1）
                let hash = '';
                for (const val of lowFreq) {
                    hash += val > median ? '1' : '0';
                }

                // 64bitを16進数に変換（16文字）
                const hexHash = binaryToHex(hash.padEnd(64, '0').slice(0, 64));
                resolve(hexHash);
            } catch (error) {
                reject(error);
            }
        };

        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageBase64;
    });
}

/**
 * 2つのpHashのHamming距離を計算
 * @returns 0-64の整数（0が完全一致）
 */
export function hammingDistance(hash1: string, hash2: string): number {
    const bin1 = hexToBinary(hash1);
    const bin2 = hexToBinary(hash2);

    let distance = 0;
    const len = Math.max(bin1.length, bin2.length);

    for (let i = 0; i < len; i++) {
        if ((bin1[i] || '0') !== (bin2[i] || '0')) {
            distance++;
        }
    }

    return distance;
}

/**
 * pHash類似度スコアを計算
 * @returns 0-1の値（1が完全一致）
 */
export function pHashSimilarity(hash1: string, hash2: string): number {
    const distance = hammingDistance(hash1, hash2);
    return 1 - (distance / 64);
}

// --- 内部ヘルパー関数 ---

/**
 * 2D DCT (離散コサイン変換) を計算
 */
function computeDCT(pixels: number[][], size: number): number[][] {
    const result: number[][] = [];

    for (let u = 0; u < size; u++) {
        result[u] = [];
        for (let v = 0; v < size; v++) {
            let sum = 0;
            for (let x = 0; x < size; x++) {
                for (let y = 0; y < size; y++) {
                    sum += pixels[x][y] *
                        Math.cos((2 * x + 1) * u * Math.PI / (2 * size)) *
                        Math.cos((2 * y + 1) * v * Math.PI / (2 * size));
                }
            }

            const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
            const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
            result[u][v] = 0.25 * cu * cv * sum;
        }
    }

    return result;
}

/**
 * バイナリ文字列を16進数に変換
 */
function binaryToHex(binary: string): string {
    let hex = '';
    for (let i = 0; i < binary.length; i += 4) {
        const chunk = binary.slice(i, i + 4).padEnd(4, '0');
        hex += parseInt(chunk, 2).toString(16);
    }
    return hex;
}

/**
 * 16進数をバイナリ文字列に変換
 */
function hexToBinary(hex: string): string {
    let binary = '';
    for (const char of hex) {
        binary += parseInt(char, 16).toString(2).padStart(4, '0');
    }
    return binary;
}
