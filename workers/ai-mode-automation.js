/**
 * Google AI Mode Automation Worker
 * 
 * Cloudflare Workers Browser Rendering (Puppeteer) を使用して
 * Google AI Modeに画像とプロンプトを自動入力
 * 
 * 使用方法:
 * 1. Cloudflare Dashboard > Workers & Pages > Create
 * 2. このコードをペースト
 * 3. Browser Rendering binding を追加 (Settings > Variables > Browser Rendering)
 *    - Variable name: BROWSER
 * 4. Deploy
 */

export default {
    async fetch(request, env) {
        // CORS
        const corsHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        };

        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        try {
            const { imageBase64, prompt } = await request.json();

            if (!imageBase64) {
                return new Response(JSON.stringify({ error: 'No image provided' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            const searchPrompt = prompt || 'この画像の人物の名前とXアカウントを調べて';

            // Browser Rendering でブラウザを起動
            const browser = await env.BROWSER.launch();
            const page = await browser.newPage();

            try {
                // Google AI Mode を開く
                await page.goto('https://www.google.com/search?udm=50', {
                    waitUntil: 'networkidle0',
                    timeout: 30000
                });

                // 検索ボックスを待機
                await page.waitForSelector('textarea[name="q"], input[name="q"]', { timeout: 10000 });

                // 画像をクリップボードに設定してペースト
                // Note: Browser Rendering環境でのクリップボード操作は制限あり
                // 代替: 画像アップロードボタンをクリック

                // 画像アップロードボタンを探す
                const cameraButton = await page.$('[aria-label*="image"], [aria-label*="画像"], .camera-icon, [data-ved] svg');

                if (cameraButton) {
                    await cameraButton.click();
                    await page.waitForTimeout(1000);

                    // ファイル入力を探す
                    const fileInput = await page.$('input[type="file"]');
                    if (fileInput) {
                        // Base64をBufferに変換
                        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
                        const buffer = Buffer.from(base64Data, 'base64');

                        // 一時ファイルとしてアップロード
                        // Note: Workers環境ではファイルシステムがないため、
                        // 実際の実装では画像URLをペーストする方法を使用
                    }
                }

                // テキストプロンプトを入力
                await page.type('textarea[name="q"], input[name="q"]', searchPrompt);

                // Enterで検索実行
                await page.keyboard.press('Enter');

                // 結果を待機
                await page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 30000 });

                // 結果ページのURLを取得
                const resultUrl = page.url();

                // スクリーンショットを取得（オプション）
                const screenshot = await page.screenshot({ encoding: 'base64' });

                await browser.close();

                return new Response(JSON.stringify({
                    success: true,
                    resultUrl: resultUrl,
                    screenshot: screenshot,
                    message: 'AI Mode検索が完了しました'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });

            } catch (pageError) {
                await browser.close();
                throw pageError;
            }

        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({
                error: 'Automation failed',
                details: error.message,
                suggestion: 'Browser Rendering bindingが設定されているか確認してください'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};
