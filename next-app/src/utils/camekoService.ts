/**
 * Cameko Service - camko.netを使った画像解析自動化
 * Puppeteerを可視モード（headful）で使用し、実際のブラウザタブを開く
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface CamekoSearchResult {
    success: boolean;
    personName?: string;
    confidence?: number;
    error?: string;
    rawResults?: string[];
    tabUrl?: string;
}

export interface BatchSearchResult {
    index: number;
    imageId: string;
    result: CamekoSearchResult;
}

/**
 * Base64画像を一時ファイルに保存
 */
async function saveBase64ToTempFile(base64Data: string, index: number): Promise<string> {
    const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Image, 'base64');

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `cameko_${Date.now()}_${index}.jpg`);

    fs.writeFileSync(tempFilePath, buffer);
    return tempFilePath;
}

/**
 * 一時ファイルを削除
 */
function cleanupTempFile(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error('[Cameko] Failed to cleanup temp file:', error);
    }
}

/**
 * 単一の画像をタブで解析（ブラウザとページを外部から受け取る）
 */
async function processImageInTab(
    page: Page,
    tempFilePath: string,
    imageIndex: number
): Promise<CamekoSearchResult> {
    try {
        console.log(`[Cameko Tab ${imageIndex}] Navigating to camko.net...`);
        await page.goto('https://camko.net/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // ファイル入力要素を待機
        const fileInputSelector = 'input[name="select-picture"]';
        await page.waitForSelector(fileInputSelector, { timeout: 10000 });

        // ファイルをアップロード
        console.log(`[Cameko Tab ${imageIndex}] Uploading image...`);
        const fileInput = await page.$(fileInputSelector);
        if (!fileInput) {
            throw new Error('File input not found');
        }
        await fileInput.uploadFile(tempFilePath);

        // UI更新を待つ
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 「解析開始」ボタンを待機してクリック
        console.log(`[Cameko Tab ${imageIndex}] Waiting for analyze button...`);
        await page.waitForFunction(
            () => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.some(btn => btn.textContent?.includes('解析開始') && !btn.disabled);
            },
            { timeout: 10000 }
        );

        console.log(`[Cameko Tab ${imageIndex}] Clicking analyze button...`);
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const analyzeBtn = buttons.find(btn => btn.textContent?.includes('解析開始') && !btn.disabled);
            if (analyzeBtn) {
                (analyzeBtn as HTMLButtonElement).click();
            }
        });

        // 解析完了を待機（「結果を確認」ボタンが表示されるまで）
        console.log(`[Cameko Tab ${imageIndex}] Waiting for analysis to complete...`);
        await page.waitForFunction(
            () => {
                const buttons = Array.from(document.querySelectorAll('button'));
                return buttons.some(btn => btn.textContent?.includes('結果を確認'));
            },
            { timeout: 120000 }
        );

        // 「結果を確認」ボタンをクリック
        console.log(`[Cameko Tab ${imageIndex}] Clicking results button...`);
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const resultsBtn = buttons.find(btn => btn.textContent?.includes('結果を確認'));
            if (resultsBtn) {
                (resultsBtn as HTMLButtonElement).click();
            }
        });

        // ページ遷移を待機
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => { });

        // 結果ページから人物名と信頼度を抽出
        console.log(`[Cameko Tab ${imageIndex}] Extracting results...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        const extractedData = await page.evaluate(() => {
            // ページ内のテキストから「名前 [XX.XX%]」パターンを探す
            const bodyText = document.body.innerText;
            const match = bodyText.match(/([^\[\]\n]+?)\s*\[(\d+\.?\d*)%\]/);

            // 結果画像のURLを探す（S3のURLを探す）
            const images = Array.from(document.querySelectorAll('img'));
            const resultImage = images.find(img =>
                img.src.includes('s3.ap-northeast-1.amazonaws.com') ||
                img.src.includes('detector-request')
            );

            return {
                personName: match ? match[1].trim() : null,
                confidence: match ? parseFloat(match[2]) : null,
                resultImageUrl: resultImage?.src || null
            };
        });

        const tabUrl = page.url();
        console.log(`[Cameko Tab ${imageIndex}] Results:`, extractedData);

        return {
            success: true,
            tabUrl,
            personName: extractedData.personName || undefined,
            confidence: extractedData.confidence || undefined,
            rawResults: extractedData.resultImageUrl ? [extractedData.resultImageUrl] : undefined
        };

    } catch (error: any) {
        console.error(`[Cameko Tab ${imageIndex}] Error:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 複数画像を別々のタブで並列解析（可視モード）
 * ブラウザウィンドウを開いて、各タブで解析を実行
 * 全て完了してもブラウザは閉じない（ユーザーが結果を確認できるように）
 */
export async function batchSearchWithCamekoVisible(
    images: Array<{ id: string; imageBase64: string }>
): Promise<{ success: boolean; totalTabs: number; completedTabs: number; error?: string }> {
    const limitedImages = images.slice(0, 10);
    const total = limitedImages.length;

    console.log(`[Cameko] Opening ${total} visible browser tabs for analysis...`);

    let browser: Browser | null = null;
    const tempFiles: string[] = [];

    try {
        // 可視モードでブラウザを起動（headless: false）
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null, // ブラウザのデフォルトサイズを使用
            args: [
                '--start-maximized',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        // 最初に全てのタブを順次作成（並列だとProtocolErrorが発生する）
        const tabsData: Array<{ page: Page; tempFilePath: string; index: number }> = [];

        for (let i = 0; i < limitedImages.length; i++) {
            const image = limitedImages[i];

            // 一時ファイルを保存
            const tempFilePath = await saveBase64ToTempFile(image.imageBase64, i);
            tempFiles.push(tempFilePath);

            // 新しいタブを作成（順次）
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });

            tabsData.push({ page, tempFilePath, index: i });
            console.log(`[Cameko] Created tab ${i + 1}/${total}`);
        }

        // 最初のデフォルトタブを閉じる
        const pages = await browser.pages();
        const defaultPage = pages.find(p => !tabsData.some(t => t.page === p));
        if (defaultPage) {
            await defaultPage.close();
        }

        // 全タブで解析を並列実行
        console.log(`[Cameko] Starting analysis on ${total} tabs...`);
        const analysisPromises = tabsData.map(({ page, tempFilePath, index }) =>
            processImageInTab(page, tempFilePath, index)
        );

        // 全タブの解析完了を待機
        const results = await Promise.all(analysisPromises);
        const completedCount = results.filter(r => r.success).length;

        console.log(`[Cameko] All ${total} tabs completed. Success: ${completedCount}/${total}`);
        console.log(`[Cameko] Browser windows left open for user to review results.`);

        // 一時ファイルをクリーンアップ
        tempFiles.forEach(cleanupTempFile);

        return {
            success: true,
            totalTabs: total,
            completedTabs: completedCount
        };

    } catch (error: any) {
        console.error('[Cameko] Batch visible search error:', error);

        // エラー時は一時ファイルをクリーンアップ
        tempFiles.forEach(cleanupTempFile);

        // エラー時もブラウザは閉じない（デバッグ用）

        return {
            success: false,
            totalTabs: total,
            completedTabs: 0,
            error: error.message
        };
    }
}

/**
 * 単一画像を可視モードで解析
 */
export async function searchWithCamekoVisible(imageBase64: string): Promise<CamekoSearchResult> {
    let browser: Browser | null = null;
    let tempFilePath: string | null = null;

    try {
        console.log('[Cameko] Starting visible search...');

        tempFilePath = await saveBase64ToTempFile(imageBase64, 0);

        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        const result = await processImageInTab(page, tempFilePath, 0);

        // 成功しても閉じない - ユーザーが結果を見られるように
        console.log('[Cameko] Search complete. Browser left open for review.');

        return result;

    } catch (error: any) {
        console.error('[Cameko] Visible search error:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        if (tempFilePath) {
            cleanupTempFile(tempFilePath);
        }
    }
}

// 従来のヘッドレスモード（後方互換性のため残す）
export async function searchWithCameko(imageBase64: string): Promise<CamekoSearchResult> {
    return searchWithCamekoVisible(imageBase64);
}

export async function batchSearchWithCameko(
    images: Array<{ id: string; imageBase64: string }>
): Promise<{ success: boolean; totalTabs: number; completedTabs: number; error?: string }> {
    return batchSearchWithCamekoVisible(images);
}
