"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { QueueItemCard } from "./QueueItemCard";
import { Ghost, Send, Loader2, CheckCircle, AlertCircle, Trash2, Search } from "lucide-react";
import { WebhookService } from "@/utils/webhook";
import { showToast, updateToast } from "@/components/ui/Toast";

export function QueueList() {
    const { postQueue, updateQueueItem, settings, clearQueue } = useAppStore();
    const [isSending, setIsSending] = useState(false);
    const [isCamekoSearching, setIsCamekoSearching] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
    const [camekoProgress, setCamekoProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Cameko一括解析（可視モード）
    const handleCamekoBatchSearch = async () => {
        const postsWithImages = postQueue
            .map((p, i) => ({ ...p, originalIndex: i }))
            .filter(p => p.imageBase64);

        if (postsWithImages.length === 0) {
            showToast({
                type: 'error',
                title: '画像がありません',
                message: '画像付きの投稿をキューに追加してください'
            });
            return;
        }

        const searchCount = Math.min(postsWithImages.length, 10);
        if (!confirm(`${searchCount}件の画像をCamekoで解析します。\n\n別ウィンドウでブラウザタブが開きます。\n結果はそのタブで確認してください。\n\n続行しますか？`)) {
            return;
        }

        setIsCamekoSearching(true);
        setCamekoProgress({ current: 0, total: searchCount, success: 0, failed: 0 });

        // ローディングトーストを表示
        const toastId = showToast({
            type: 'loading',
            title: 'Cameko解析中...',
            message: `${searchCount}件のタブを開いて解析しています`
        });

        try {
            const images = postsWithImages.slice(0, 10).map(p => ({
                id: p.id,
                imageBase64: p.imageBase64!
            }));

            const response = await fetch('/api/cameko-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ images })
            });

            const data = await response.json();

            if (data.success) {
                setCamekoProgress({
                    current: data.totalTabs,
                    total: data.totalTabs,
                    success: data.completedTabs,
                    failed: data.totalTabs - data.completedTabs
                });

                // 成功トーストに更新
                updateToast(toastId, {
                    type: 'success',
                    title: 'Cameko解析完了！',
                    message: `${data.completedTabs}/${data.totalTabs}件のタブで解析完了。結果をブラウザで確認してください。`
                });
            } else {
                updateToast(toastId, {
                    type: 'error',
                    title: '解析に失敗しました',
                    message: data.error || '不明なエラー'
                });
            }
        } catch (error: any) {
            console.error('[Cameko] Batch search error:', error);
            updateToast(toastId, {
                type: 'error',
                title: 'エラーが発生しました',
                message: error.message
            });
        } finally {
            setIsCamekoSearching(false);
        }
    };

    const handleClearAll = () => {
        if (showClearConfirm) {
            clearQueue();
            setShowClearConfirm(false);
        } else {
            setShowClearConfirm(true);
            // Auto-reset after 3 seconds
            setTimeout(() => setShowClearConfirm(false), 3000);
        }
    };

    const handleSendAll = async () => {
        if (!settings.makeWebhookUrl) {
            alert("Please set the Webhook URL in Settings first.");
            return;
        }

        setIsSending(true);
        const pendingPosts = postQueue.map((p, i) => ({ ...p, originalIndex: i }))
            .filter(p => p.status !== 'sent');

        setProgress({ current: 0, total: pendingPosts.length, success: 0, failed: 0 });

        const webhook = new WebhookService(settings.makeWebhookUrl);

        for (let i = 0; i < pendingPosts.length; i++) {
            const post = pendingPosts[i];
            const realIndex = post.originalIndex;

            updateQueueItem(realIndex, { status: 'sending' });
            setProgress(prev => ({ ...prev, current: i + 1 }));

            const success = await webhook.sendPost(post);

            if (success) {
                updateQueueItem(realIndex, { status: 'sent' });
                setProgress(prev => ({ ...prev, success: prev.success + 1 }));
            } else {
                updateQueueItem(realIndex, { status: 'failed' });
                setProgress(prev => ({ ...prev, failed: prev.failed + 1 }));
            }

            // Simple delay to avoid rate limits if needed, or just flow
            await new Promise(r => setTimeout(r, 500));
        }

        setIsSending(false);
    };

    if (postQueue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-[var(--bg-glass)] rounded-2xl border-2 border-dashed border-white/10">
                <Ghost className="w-16 h-16 text-[var(--text-muted)] mb-4" />
                <p className="text-[var(--text-secondary)] text-lg">Queue is empty</p>
                <p className="text-[var(--text-muted)] text-sm">Drag photos or paste text to start</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Batch Actions */}
            <div className="flex items-center justify-between bg-[var(--bg-secondary)] p-4 rounded-xl border border-white/10 sticky top-4 z-10 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-white">Queue ({postQueue.length})</h3>
                    {isSending && (
                        <div className="flex items-center gap-2 text-sm text-[var(--accent-primary)]">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Sending {progress.current}/{progress.total}</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Cameko Progress */}
                    {!isCamekoSearching && camekoProgress.total > 0 && (
                        <div className="flex items-center gap-3 mr-2 text-xs font-medium">
                            <span className="text-[var(--success)] flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> {camekoProgress.success}
                            </span>
                            <span className="text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {camekoProgress.failed}
                            </span>
                        </div>
                    )}

                    {/* Send Progress */}
                    {!isSending && progress.total > 0 && (
                        <div className="flex items-center gap-3 mr-4 text-xs font-medium">
                            <span className="text-[var(--success)] flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" /> {progress.success}
                            </span>
                            <span className="text-red-400 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> {progress.failed}
                            </span>
                        </div>
                    )}

                    {/* Cameko Batch Search Button */}
                    <button
                        onClick={handleCamekoBatchSearch}
                        disabled={isCamekoSearching || isSending}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
                    >
                        {isCamekoSearching ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                解析中...
                            </>
                        ) : (
                            <>
                                <Search className="w-4 h-4" />
                                Cameko一括解析
                            </>
                        )}
                    </button>

                    {/* Send All Button */}
                    <button
                        onClick={handleSendAll}
                        disabled={isSending || isCamekoSearching}
                        className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                    >
                        {isSending ? 'Sending...' : 'Send All'}
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* List */}
            <div className="space-y-4">
                {postQueue.map((post, index) => (
                    <QueueItemCard key={post.id} post={post} index={index} />
                ))}
            </div>
        </div>
    );
}
