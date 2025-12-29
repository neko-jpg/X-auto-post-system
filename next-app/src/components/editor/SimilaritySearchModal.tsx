"use client";

import { useState, useEffect } from 'react';
import { X, Search, User, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { findSimilarAccounts, ScoredCandidate, SearchProgress } from "@/utils/imageSimilarityService";

interface SimilaritySearchModalProps {
    imageBase64: string;
    eventName?: string;
    onSelect: (candidate: ScoredCandidate) => void;
    onClose: () => void;
}

export function SimilaritySearchModal({
    imageBase64,
    eventName,
    onSelect,
    onClose
}: SimilaritySearchModalProps) {
    const [candidates, setCandidates] = useState<ScoredCandidate[]>([]);
    const [progress, setProgress] = useState<SearchProgress>({
        status: 'initializing',
        progress: 0,
        message: '準備中...'
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const search = async () => {
            try {
                const results = await findSimilarAccounts(
                    imageBase64,
                    eventName,
                    setProgress
                );
                setCandidates(results);
            } catch (err) {
                console.error('Search failed:', err);
                setError(err instanceof Error ? err.message : '検索に失敗しました');
            }
        };

        search();
    }, [imageBase64, eventName]);

    const isLoading = progress.status !== 'done' && !error;
    const isEmpty = !isLoading && !error && candidates.length === 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative z-10 w-full max-w-lg mx-4 bg-[var(--bg-card)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10">
                            <Search className="w-5 h-5 text-[var(--accent-primary)]" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-[var(--text-primary)]">
                                アカウント候補検索
                            </h2>
                            <p className="text-xs text-[var(--text-muted)]">
                                類似画像からアカウントを推定
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                        <X className="w-5 h-5 text-[var(--text-muted)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                    {/* Progress */}
                    {isLoading && (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <Loader2 className="w-8 h-8 text-[var(--accent-primary)] animate-spin" />
                            <div className="text-center">
                                <p className="text-sm text-[var(--text-primary)]">
                                    {progress.message}
                                </p>
                                <div className="mt-2 w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                                        style={{ width: `${progress.progress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                            <AlertCircle className="w-5 h-5 text-red-400" />
                            <div>
                                <p className="text-sm font-medium text-red-400">
                                    エラーが発生しました
                                </p>
                                <p className="text-xs text-red-400/70 mt-0.5">
                                    {error}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {isEmpty && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <div className="p-3 rounded-full bg-white/5">
                                <User className="w-6 h-6 text-[var(--text-muted)]" />
                            </div>
                            <div>
                                <p className="text-sm text-[var(--text-primary)]">
                                    候補が見つかりませんでした
                                </p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                    データベースに類似画像が登録されていません。<br />
                                    投稿を作成すると自動的にデータが蓄積されます。
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Results */}
                    {!isLoading && !error && candidates.length > 0 && (
                        <div className="space-y-2">
                            {candidates.map((candidate, index) => (
                                <button
                                    key={candidate.accountHandle}
                                    onClick={() => onSelect(candidate)}
                                    className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors text-left group border border-transparent hover:border-[var(--accent-primary)]/30"
                                >
                                    {/* Rank */}
                                    <div className={`
                                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                                        ${index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                                            index === 1 ? 'bg-gray-400/20 text-gray-300' :
                                                index === 2 ? 'bg-orange-600/20 text-orange-400' :
                                                    'bg-white/5 text-[var(--text-muted)]'}
                                    `}>
                                        {index + 1}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-[var(--text-primary)] truncate">
                                                {candidate.accountName}
                                            </span>
                                            <span className="text-xs text-[var(--text-muted)]">
                                                {candidate.accountHandle}
                                            </span>
                                        </div>

                                        {/* Score breakdown */}
                                        <div className="flex items-center gap-3 mt-1">
                                            <ScoreBadge label="CLIP" value={candidate.scores.clip} />
                                            <ScoreBadge label="pHash" value={candidate.scores.pHash} />
                                            <span className="text-xs text-[var(--text-muted)]">
                                                {candidate.imageCount}枚登録
                                            </span>
                                        </div>
                                    </div>

                                    {/* Total Score */}
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-[var(--accent-primary)]">
                                            {Math.round(candidate.totalScore * 100)}%
                                        </div>
                                        <div className="text-xs text-[var(--text-muted)]">
                                            一致度
                                        </div>
                                    </div>

                                    {/* Select indicator */}
                                    <CheckCircle2 className="w-5 h-5 text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/10 bg-[var(--bg-secondary)]">
                    <p className="text-xs text-[var(--text-muted)] text-center">
                        クリックで選択 → 名前・アカウントが自動入力されます
                    </p>
                </div>
            </div>
        </div>
    );
}

// Score badge component
function ScoreBadge({ label, value }: { label: string; value: number }) {
    const percentage = Math.round(value * 100);
    const color = percentage >= 80 ? 'text-green-400' :
        percentage >= 50 ? 'text-yellow-400' :
            'text-red-400';

    return (
        <span className={`text-xs ${color}`}>
            {label}: {percentage}%
        </span>
    );
}
