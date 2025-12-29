/**
 * Google Lens Reverse Image Search Worker
 * 
 * Cloudflare WorkerでGoogle Lens検索をプロキシ
 * 
 * 使用方法:
 * 1. Workers & Pages > Create Worker
 * 2. このコードをペースト
 * 3. Deploy
 * 4. 環境変数 ALLOWED_ORIGINS に許可するオリジンを設定
 */

export default {
    async fetch(request, env) {
        // CORS
        const corsHeaders = {
            'Access-Control-Allow-Origin': env.ALLOWED_ORIGINS || '*',
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
            const { imageBase64 } = await request.json();

            if (!imageBase64) {
                return new Response(JSON.stringify({ error: 'No image provided' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // 方法1: Google Lens Upload URL を生成
            // Google Lensは直接的なAPIを提供していないため、
            // 検索URLを生成してクライアントに返す

            // 画像をR2にアップロードして一時URLを取得（オプション）
            let imageUrl = null;
            if (env.R2_BUCKET) {
                const key = `lens-search/${Date.now()}.jpg`;
                const imageData = Uint8Array.from(atob(imageBase64.split(',').pop()), c => c.charCodeAt(0));
                await env.R2_BUCKET.put(key, imageData, {
                    httpMetadata: { contentType: 'image/jpeg' }
                });
                imageUrl = `${env.R2_PUBLIC_URL}/${key}`;

                // 5分後に削除（一時ファイル）
                // Note: R2 TTL or Cron Trigger で処理
            }

            // Google Lens URL
            const lensUrl = imageUrl
                ? `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`
                : 'https://lens.google.com/';

            return new Response(JSON.stringify({
                success: true,
                lensUrl: lensUrl,
                imageUrl: imageUrl,
                instructions: imageUrl
                    ? 'このURLをクリックするとGoogle Lens検索が開きます'
                    : 'Google Lensで手動で画像をアップロードしてください'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

        } catch (error) {
            console.error('Worker error:', error);
            return new Response(JSON.stringify({
                error: 'Internal error',
                details: error.message
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    }
};
