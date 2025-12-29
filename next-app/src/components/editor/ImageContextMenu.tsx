"use client";

import { X, Search, Calendar, Sparkles, Bot, ShieldCheck } from "lucide-react";

interface ImageContextMenuProps {
    position: { x: number; y: number };
    onClose: () => void;
    onSearchAccount: () => void;
    onSearchWithAI: () => void;
    onExtractMetadata: () => void;
    onGenerateComment: () => void;
    onFactCheck?: () => void;
}

export function ImageContextMenu({
    position,
    onClose,
    onSearchAccount,
    onSearchWithAI,
    onExtractMetadata,
    onGenerateComment,
    onFactCheck
}: ImageContextMenuProps) {
    const menuItems = [
        {
            icon: Bot,
            label: 'camekoで検索',
            description: 'camko.netでAI画像解析',
            onClick: onSearchWithAI,
            highlight: true
        },
        {
            icon: Search,
            label: 'ローカルDB検索',
            description: '蓄積データからアカウントを推定',
            onClick: onSearchAccount
        },
        {
            icon: Calendar,
            label: '撮影日時・イベント情報を抽出',
            description: 'EXIF/投稿情報から推測',
            onClick: onExtractMetadata
        },
        {
            icon: Sparkles,
            label: 'AIコメント生成',
            description: '画像からコメントを生成',
            onClick: onGenerateComment
        },
        ...(onFactCheck ? [{
            icon: ShieldCheck,
            label: '検証 (Fact Check)',
            description: 'Google画像検索で人物を検証',
            onClick: onFactCheck
        }] : [])
    ];


    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-50"
                onClick={onClose}
            />

            {/* Menu */}
            <div
                className="fixed z-50 bg-[var(--bg-card)] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[280px]"
                style={{
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    transform: 'translate(-50%, 0)'
                }}
            >
                <div className="p-2">
                    {menuItems.map((item, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                item.onClick();
                                onClose();
                            }}
                            className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors text-left group"
                        >
                            <div className="p-2 rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] group-hover:bg-[var(--accent-primary)]/20 transition-colors">
                                <item.icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-[var(--text-primary)]">
                                    {item.label}
                                </div>
                                <div className="text-xs text-[var(--text-muted)] mt-0.5">
                                    {item.description}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="border-t border-white/5 p-2">
                    <button
                        onClick={onClose}
                        className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-[var(--text-muted)] text-xs"
                    >
                        <X className="w-3 h-3" />
                        閉じる
                    </button>
                </div>
            </div>
        </>
    );
}
