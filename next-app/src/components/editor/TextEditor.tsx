"use client";

import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/utils/cn";
import {
    Maximize2, Minimize2, Type, Hash, AtSign, Smile,
    Bold, Italic, Sparkles, ChevronDown, ChevronUp, User, Building2
} from "lucide-react";
import { useState, useRef } from "react";
import { EmojiPicker } from "./EmojiPicker";

const PERSON_ROLES = [
    'モデル',
    'RQ',
    'レースクイーン',
    'コンパニオン',
    'コスプレイヤー',
    'アンバサダー',
    'タレント',
    'アイドル',
    'その他'
];

const EXPRESSION_TYPES = [
    '笑顔',
    'クール',
    '柔らか',
    '華やか',
    '自然',
    '力強い'
];

export function TextEditor() {
    const { postQueue, currentEditIndex, updateQueueItem } = useAppStore();
    const [isZenMode, setIsZenMode] = useState(false);
    const [showMetadata, setShowMetadata] = useState(true);
    const [showPersonInfo, setShowPersonInfo] = useState(true);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [emojiPickerPosition, setEmojiPickerPosition] = useState({ top: 100, left: 100 });
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);

    // Metadata handlers
    const handleMetadataChange = (key: string, value: string) => {
        if (!postQueue[currentEditIndex!]) return;
        const currentEvent = postQueue[currentEditIndex!].eventInfo || {};
        updateQueueItem(currentEditIndex!, {
            eventInfo: { ...currentEvent, [key]: value }
        });
    };

    const handlePostFieldChange = (key: string, value: string) => {
        if (!postQueue[currentEditIndex!]) return;
        updateQueueItem(currentEditIndex!, { [key]: value });
    };

    if (currentEditIndex === null || !postQueue[currentEditIndex]) return null;
    const post = postQueue[currentEditIndex];

    const toUnicodeBold = (text: string) => {
        const UP_A = 0x1D400; // 𝐁
        const LOW_A = 0x1D41A; // 𝐛
        const DIGIT_0 = 0x1D7CE; // 𝟎

        return text.split('').map(char => {
            const code = char.codePointAt(0);
            if (!code) return char;
            if (code >= 65 && code <= 90) return String.fromCodePoint(UP_A + (code - 65));
            if (code >= 97 && code <= 122) return String.fromCodePoint(LOW_A + (code - 97));
            if (code >= 48 && code <= 57) return String.fromCodePoint(DIGIT_0 + (code - 48));
            return char;
        }).join('');
    };

    const applyBold = () => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        if (start === end) return;

        const text = post.aiComment;
        const selected = text.substring(start, end);
        const bolded = toUnicodeBold(selected);

        const newText = text.substring(0, start) + bolded + text.substring(end);
        updateQueueItem(currentEditIndex!, { aiComment: newText });
    };

    const insertText = (textToInsert: string) => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const text = post.aiComment;
        const newText = text.substring(0, start) + textToInsert + text.substring(end);
        updateQueueItem(currentEditIndex!, { aiComment: newText });

        // Refocus and set cursor position
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                const newPos = start + textToInsert.length;
                textareaRef.current.setSelectionRange(newPos, newPos);
            }
        }, 0);
    };

    const handleEmojiButtonClick = () => {
        if (emojiButtonRef.current) {
            const rect = emojiButtonRef.current.getBoundingClientRect();
            setEmojiPickerPosition({
                top: rect.bottom + 8,
                left: Math.max(10, rect.left - 150)
            });
        }
        setIsEmojiPickerOpen(true);
    };

    const handleEmojiSelect = (emoji: string) => {
        insertText(emoji);
        setIsEmojiPickerOpen(false);
    };

    return (
        <div className={cn(
            "flex flex-col transition-all duration-500",
            isZenMode ? "fixed inset-0 z-50 bg-[var(--bg-primary)] p-0" : "h-full"
        )}>
            {/* Toolbar */}
            <div className={cn(
                "flex items-center justify-between p-4 border-b border-white/10 bg-[var(--bg-secondary)]",
                isZenMode && "px-20"
            )}>
                <div className="flex items-center gap-2">
                    <button onClick={applyBold} className="p-2 hover:bg-white/10 rounded-lg text-white" title="Bold (Unicode)">
                        <Bold className="w-4 h-4" />
                    </button>
                    {/* Placeholder for Italic */}
                    <button className="p-2 hover:bg-white/10 rounded-lg text-white opacity-50 cursor-not-allowed" title="Italic (Coming Soon)">
                        <Italic className="w-4 h-4" />
                    </button>
                    <div className="w-px h-6 bg-white/10 mx-2" />

                    {/* Emoji Picker Button */}
                    <button
                        ref={emojiButtonRef}
                        onClick={handleEmojiButtonClick}
                        className="p-2 hover:bg-white/10 rounded-lg text-white"
                        title="絵文字ピッカー"
                    >
                        <Smile className="w-4 h-4" />
                    </button>
                    <button onClick={() => insertText('#')} className="p-2 hover:bg-white/10 rounded-lg text-white" title="Hashtag">
                        <Hash className="w-4 h-4" />
                    </button>
                    <button onClick={() => insertText('@')} className="p-2 hover:bg-white/10 rounded-lg text-white" title="Mention">
                        <AtSign className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {/* Character Count */}
                    <div className="text-xs text-[var(--text-muted)]">
                        {post.aiComment.length} / 280
                    </div>

                    <div className="w-px h-6 bg-white/10" />

                    <button
                        onClick={() => setIsZenMode(!isZenMode)}
                        className="p-2 hover:bg-white/10 rounded-lg text-[var(--text-secondary)]"
                        title={isZenMode ? "Exit Zen Mode" : "Zen Mode"}
                    >
                        {isZenMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            {/* Editor Area & Metadata Form */}
            <div className={cn(
                "flex-1 relative flex flex-col overflow-y-auto",
                isZenMode ? "bg-[var(--bg-primary)] items-center" : "bg-[var(--bg-card)]"
            )}>
                {!isZenMode && (
                    <>
                        {/* イベント情報セクション */}
                        <div className="border-b border-white/5 bg-[var(--bg-tertiary)]/30">
                            <button
                                onClick={() => setShowMetadata(!showMetadata)}
                                className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5"
                            >
                                <span className="flex items-center gap-2">
                                    <Building2 className="w-4 h-4" />
                                    イベント・ブース情報
                                </span>
                                {showMetadata ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {showMetadata && (
                                <div className="p-4 pt-0 grid grid-cols-2 gap-3">
                                    <input
                                        placeholder="Event Name (EN)"
                                        className="bg-transparent border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={post.eventInfo?.eventEn || ''}
                                        onChange={(e) => handleMetadataChange('eventEn', e.target.value)}
                                    />
                                    <input
                                        placeholder="イベント名 (日本語)"
                                        className="bg-transparent border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={post.eventInfo?.eventJp || ''}
                                        onChange={(e) => handleMetadataChange('eventJp', e.target.value)}
                                    />
                                    <input
                                        placeholder="Date (e.g. 2024.12.30)"
                                        className="bg-transparent border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={post.eventInfo?.date || ''}
                                        onChange={(e) => handleMetadataChange('date', e.target.value)}
                                    />
                                    <input
                                        placeholder="会場 / Venue"
                                        className="bg-transparent border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={post.eventInfo?.venue || ''}
                                        onChange={(e) => handleMetadataChange('venue', e.target.value)}
                                    />
                                    <input
                                        placeholder="ブース名 / Booth Name"
                                        className="bg-transparent border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={post.boothName || ''}
                                        onChange={(e) => handlePostFieldChange('boothName', e.target.value)}
                                    />
                                    <input
                                        placeholder="ブース公式@ / Booth Account"
                                        className="bg-transparent border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={post.boothAccount || ''}
                                        onChange={(e) => handlePostFieldChange('boothAccount', e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* 人物情報セクション */}
                        <div className="border-b border-white/5 bg-[var(--bg-tertiary)]/30">
                            <button
                                onClick={() => setShowPersonInfo(!showPersonInfo)}
                                className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-[var(--text-secondary)] hover:bg-white/5"
                            >
                                <span className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    人物情報
                                </span>
                                {showPersonInfo ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            {showPersonInfo && (
                                <div className="p-4 pt-0 grid grid-cols-2 gap-3">
                                    <select
                                        className="bg-[var(--bg-tertiary)] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={post.personRole || 'モデル'}
                                        onChange={(e) => handlePostFieldChange('personRole', e.target.value)}
                                    >
                                        {PERSON_ROLES.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                    <input
                                        placeholder="名前 / Name"
                                        className="bg-transparent border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={post.personName || ''}
                                        onChange={(e) => handlePostFieldChange('personName', e.target.value)}
                                    />
                                    <input
                                        placeholder="Xアカウント @account"
                                        className="bg-transparent border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none col-span-2"
                                        value={post.personAccount || ''}
                                        onChange={(e) => handlePostFieldChange('personAccount', e.target.value)}
                                    />
                                </div>
                            )}
                        </div>

                        {/* ハッシュタグ・表情セクション */}
                        <div className="p-4 border-b border-white/5 bg-[var(--bg-tertiary)]/20">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-[var(--text-muted)] mb-1 block">ハッシュタグ</label>
                                    <input
                                        placeholder="#イベント #撮影"
                                        className="w-full bg-transparent border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={post.eventInfo?.hashtags || ''}
                                        onChange={(e) => handleMetadataChange('hashtags', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-[var(--text-muted)] mb-1 block">表情タイプ</label>
                                    <select
                                        className="w-full bg-[var(--bg-tertiary)] border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[var(--accent-primary)] outline-none"
                                        value={(post as any).expressionType || '笑顔'}
                                        onChange={(e) => handlePostFieldChange('expressionType', e.target.value)}
                                    >
                                        {EXPRESSION_TYPES.map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Main Text Area */}
                <div className={cn("flex-1 flex flex-col", isZenMode && "max-w-3xl w-full")}>
                    <label className="px-4 pt-3 text-xs text-[var(--text-muted)]">一言コメント / Caption</label>
                    <textarea
                        ref={textareaRef}
                        value={post.aiComment}
                        onChange={(e) => updateQueueItem(currentEditIndex!, { aiComment: e.target.value })}
                        placeholder="一言コメントを入力してください..."
                        className={cn(
                            "w-full flex-1 resize-none outline-none text-[var(--text-primary)] bg-transparent p-4 placeholder:text-[var(--text-muted)]",
                            isZenMode
                                ? "text-xl leading-relaxed py-10 font-serif"
                                : "text-base leading-relaxed min-h-[120px]"
                        )}
                    />
                </div>
            </div>

            {/* Emoji Picker */}
            <EmojiPicker
                isOpen={isEmojiPickerOpen}
                onClose={() => setIsEmojiPickerOpen(false)}
                onSelect={handleEmojiSelect}
                position={emojiPickerPosition}
            />
        </div>
    );
}
