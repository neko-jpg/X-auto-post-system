/**
 * Batch Processor
 * 一括操作を実行するモジュール
 * Requirements: 6.1, 6.2, 6.3, 6.4, 12.1, 12.2, 12.3, 12.4, 12.5, 16.1, 16.2, 16.3, 16.4
 */

/**
 * バッチ処理の進捗情報
 * @typedef {Object} BatchProgress
 * @property {number} total - 総数
 * @property {number} completed - 完了数
 * @property {number} failed - 失敗数
 * @property {number} current - 現在処理中のインデックス
 */

/**
 * バッチ処理の結果
 * @typedef {Object} BatchResult
 * @property {number} success - 成功数
 * @property {number} failed - 失敗数
 * @property {Array<{index: number, error: string}>} errors - エラー情報
 */

class BatchProcessor {
    constructor() {
        // キャンセルフラグ
        this.cancelled = false;
        
        // 現在実行中の処理
        this.currentOperation = null;
    }

    /**
     * 一括コメント生成
     * @param {Array<number>} indices - 処理対象のインデックス配列
     * @param {Function} onProgress - 進捗コールバック
     * @param {Object} options - オプション
     * @returns {Promise<BatchResult>}
     */
    async generateComments(indices, onProgress, options = {}) {
        this.cancelled = false;
        this.currentOperation = 'generateComments';

        const result = {
            success: 0,
            failed: 0,
            errors: []
        };

        const total = indices.length;

        for (let i = 0; i < indices.length; i++) {
            // キャンセルチェック
            if (this.cancelled) {
                console.log('[BatchProcessor] Comment generation cancelled');
                break;
            }

            const index = indices[i];
            const progress = {
                total,
                completed: i,
                failed: result.failed,
                current: index
            };

            // 進捗を通知
            if (onProgress) {
                onProgress(progress);
            }

            try {
                // コメント生成を実行
                await this.generateSingleComment(index, options);
                result.success++;
            } catch (error) {
                console.error(`[BatchProcessor] Failed to generate comment for index ${index}:`, error);
                result.failed++;
                result.errors.push({
                    index,
                    error: error.message || 'コメント生成に失敗しました'
                });
                // エラーが発生しても継続
            }

            // 最終進捗を通知
            if (i === indices.length - 1) {
                const finalProgress = {
                    total,
                    completed: i + 1,
                    failed: result.failed,
                    current: -1
                };
                if (onProgress) {
                    onProgress(finalProgress);
                }
            }
        }

        this.currentOperation = null;
        return result;
    }

    /**
     * 単一の投稿のコメントを生成
     * @param {number} index - 投稿インデックス
     * @param {Object} options - オプション
     * @returns {Promise<void>}
     */
    async generateSingleComment(index, options = {}) {
        // AppStateから投稿を取得
        if (!window.AppState || !window.AppState.postQueue) {
            throw new Error('AppState not available');
        }

        const post = window.AppState.postQueue[index];
        if (!post) {
            throw new Error(`Post at index ${index} not found`);
        }

        // 既にコメントがある場合はスキップ（オプションで上書き可能）
        if (post.aiComment && !options.overwrite) {
            console.log(`[BatchProcessor] Skipping index ${index} - comment already exists`);
            return;
        }

        // コメント生成パラメータ
        const expressionType = options.expressionType || '笑顔';
        const focusPoint = options.focusPoint || '表情';
        const contextMatch = options.contextMatch || 'ブースの雰囲気';

        // API経由でコメント生成
        const API_BASE_URL = '/.netlify/functions';
        
        try {
            const response = await fetch(`${API_BASE_URL}/generate-comment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    booth_name: post.boothName || '',
                    role: post.personRole || 'モデル',
                    category: (post.eventInfo?.category || window.AppState.eventInfo?.category || 'ブース'),
                    expression_type: expressionType,
                    focus_point: focusPoint,
                    context_match: contextMatch,
                    image_base64: post.imageBase64 || null
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            
            // コメントを更新
            if (typeof window.updateQueueItem === 'function') {
                window.updateQueueItem(index, { aiComment: data.comment });
            } else {
                post.aiComment = data.comment;
            }

        } catch (error) {
            console.error('[BatchProcessor] API call failed, using rule-based fallback:', error);
            
            // フォールバック: ルールベースでコメント生成
            const comment = this.generateRuleBasedComment({
                expressionType,
                focusPoint,
                contextMatch,
                role: post.personRole || 'モデル'
            });

            if (typeof window.updateQueueItem === 'function') {
                window.updateQueueItem(index, { aiComment: comment });
            } else {
                post.aiComment = comment;
            }
        }
    }

    /**
     * ルールベースでコメントを生成（フォールバック）
     * @param {Object} params - パラメータ
     * @returns {string} - 生成されたコメント
     */
    generateRuleBasedComment(params) {
        const { expressionType } = params;

        // comment-rules.jsが利用可能な場合はそれを使用
        if (typeof window.generateRuleBasedComment === 'function') {
            return window.generateRuleBasedComment(params);
        }

        // シンプルなフォールバック
        const expressions = {
            '笑顔': '素敵な笑顔',
            '真剣': '真剣な表情',
            'クール': 'クールな雰囲気',
            '元気': '元気いっぱいの表情'
        };

        const expression = expressions[expressionType] || '素敵な表情';
        return `${expression}が印象的な一枚です✨`;
    }

    /**
     * 一括送信
     * @param {Array<number>} indices - 処理対象のインデックス配列
     * @param {Function} onProgress - 進捗コールバック
     * @param {Object} options - オプション
     * @returns {Promise<BatchResult>}
     */
    async sendPosts(indices, onProgress, options = {}) {
        this.cancelled = false;
        this.currentOperation = 'sendPosts';

        const result = {
            success: 0,
            failed: 0,
            errors: []
        };

        const total = indices.length;

        // Webhook URLを取得
        const webhookUrl = window.AppState?.settings?.makeWebhookUrl;
        if (!webhookUrl) {
            throw new Error('Make.com Webhook URLが設定されていません');
        }

        for (let i = 0; i < indices.length; i++) {
            // キャンセルチェック
            if (this.cancelled) {
                console.log('[BatchProcessor] Batch send cancelled');
                break;
            }

            const index = indices[i];
            const progress = {
                total,
                completed: i,
                failed: result.failed,
                current: index
            };

            // 進捗を通知
            if (onProgress) {
                onProgress(progress);
            }

            try {
                // 送信を実行
                await this.sendSinglePost(index, webhookUrl);
                result.success++;
            } catch (error) {
                console.error(`[BatchProcessor] Failed to send post at index ${index}:`, error);
                result.failed++;
                result.errors.push({
                    index,
                    error: error.message || '送信に失敗しました'
                });
                // エラーが発生しても継続
            }

            // レート制限のため少し待機
            if (i < indices.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 最終進捗を通知
            if (i === indices.length - 1) {
                const finalProgress = {
                    total,
                    completed: i + 1,
                    failed: result.failed,
                    current: -1
                };
                if (onProgress) {
                    onProgress(finalProgress);
                }
            }
        }

        this.currentOperation = null;
        return result;
    }

    /**
     * 単一の投稿を送信
     * @param {number} index - 投稿インデックス
     * @param {string} webhookUrl - Webhook URL
     * @returns {Promise<void>}
     */
    async sendSinglePost(index, webhookUrl) {
        if (!window.AppState || !window.AppState.postQueue) {
            throw new Error('AppState not available');
        }

        const post = window.AppState.postQueue[index];
        if (!post) {
            throw new Error(`Post at index ${index} not found`);
        }

        // 既に送信済みの場合はスキップ
        if (post.status === 'sent') {
            console.log(`[BatchProcessor] Skipping index ${index} - already sent`);
            return;
        }

        // ステータスを送信中に更新
        if (typeof window.updateQueueItem === 'function') {
            window.updateQueueItem(index, { status: 'sending' });
        }

        // 投稿テンプレートを生成
        const templates = this.generatePostTemplatesForItem(post);
        const sourceEvent = post.eventInfo || window.AppState?.eventInfo || {};
        const event = {
            eventEn: sourceEvent.eventEn || '',
            eventJp: sourceEvent.eventJp || '',
            date: sourceEvent.date || '',
            venue: sourceEvent.venue || '',
            category: sourceEvent.category || 'ブース',
            hashtags: sourceEvent.hashtags || ''
        };

        const payload = {
            timestamp: new Date().toISOString(),
            event: event,
            photo: {
                base64: post.imageBase64
            },
            person: {
                name: post.personName,
                role: post.personRole,
                account: post.personAccount
            },
            booth: {
                name: post.boothName,
                account: post.boothAccount
            },
            posts: {
                x1: templates.x1,
                x2: templates.x2,
                instagram: templates.ig
            }
        };

        try {
            const response = await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Webhook request failed: ${response.status}`);
            }

            // ステータスを送信済みに更新
            if (typeof window.updateQueueItem === 'function') {
                window.updateQueueItem(index, { status: 'sent' });
            } else {
                post.status = 'sent';
            }

        } catch (error) {
            // ステータスを失敗に更新
            if (typeof window.updateQueueItem === 'function') {
                window.updateQueueItem(index, { status: 'failed' });
            } else {
                post.status = 'failed';
            }
            throw error;
        }
    }

    /**
     * 投稿テンプレートを生成
     * @param {Object} post - 投稿データ
     * @returns {Object} - テンプレート
     */
    generatePostTemplatesForItem(post) {
        const sourceEvent = post.eventInfo || window.AppState?.eventInfo || {};
        const event = {
            eventEn: sourceEvent.eventEn || '',
            eventJp: sourceEvent.eventJp || '',
            date: sourceEvent.date || '',
            venue: sourceEvent.venue || '',
            category: sourceEvent.category || 'ブース',
            hashtags: sourceEvent.hashtags || ''
        };
        const hashtags = event.hashtags || '';
        const hashtagsArray = hashtags.split(' ').filter(h => h.startsWith('#'));
        const mainHashtag = hashtagsArray[0] || '';

        const x1 = `📸 ${event.eventEn} – ${event.eventJp}
${event.date}｜${event.venue}

◼︎ ${event.category}
${post.boothName}${post.boothAccount ? `（${post.boothAccount}）` : ''}

◼︎ ${post.personRole}
${post.personName ? `${post.personName} さん` : '※お名前調査中'}
${post.personAccount}

${post.aiComment}

${hashtags}`.trim();

        const x2 = `📸 ${event.eventEn}
${event.date}｜${event.venue}

${post.boothName}
${post.personName ? `${post.personName} さん` : ''} ${post.personAccount}

${post.aiComment}

${mainHashtag}`.trim();

        const igHashtags = hashtags + ' #portrait #ポートレート #eventphoto';
        const ig = `📸 ${event.eventEn} – ${event.eventJp}

${post.boothName}
${post.personName ? `${post.personName} さん` : ''}

${post.aiComment}

${igHashtags}`.trim();

        return { x1, x2, ig };
    }

    /**
     * 一括ブース適用
     * @param {string} field - フィールド名 ('booth' | 'role')
     * @param {any} value - 適用する値
     * @param {Array<number>} indices - 対象インデックス（省略時は全て）
     */
    applyToAll(field, value, indices = null) {
        if (!window.AppState || !window.AppState.postQueue) {
            throw new Error('AppState not available');
        }

        // インデックスが指定されていない場合は全ての投稿を対象
        const targetIndices = indices || window.AppState.postQueue.map((_, i) => i);

        let appliedCount = 0;

        for (const index of targetIndices) {
            const post = window.AppState.postQueue[index];
            if (!post) continue;

            // フィールドに応じて更新
            if (field === 'booth') {
                // ブース情報を適用
                if (typeof window.updateQueueItem === 'function') {
                    window.updateQueueItem(index, {
                        boothName: value.boothName || '',
                        boothAccount: value.boothAccount || ''
                    });
                } else {
                    post.boothName = value.boothName || '';
                    post.boothAccount = value.boothAccount || '';
                }
                appliedCount++;
            } else if (field === 'role') {
                // 役割を適用
                if (typeof window.updateQueueItem === 'function') {
                    window.updateQueueItem(index, {
                        personRole: value
                    });
                } else {
                    post.personRole = value;
                }
                appliedCount++;
            }
        }

        console.log(`[BatchProcessor] Applied ${field} to ${appliedCount} posts`);
        return appliedCount;
    }

    /**
     * 処理をキャンセル
     */
    cancel() {
        this.cancelled = true;
        console.log('[BatchProcessor] Cancellation requested');
    }

    /**
     * キャンセル可能かチェック
     * @returns {boolean}
     */
    canCancel() {
        return this.currentOperation !== null;
    }
}

// シングルトンインスタンスをエクスポート
const batchProcessor = new BatchProcessor();

// Export for use in other modules
export { BatchProcessor, batchProcessor };

// グローバルに公開
if (typeof window !== 'undefined') {
    window.batchProcessor = batchProcessor;
}
