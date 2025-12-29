"use client";

import { useState, useRef, useEffect } from "react";
import { X, Search, Clock } from "lucide-react";
import { emojiCategories, EmojiCategory } from "@/utils/emojiData";
import { cn } from "@/utils/cn";

interface EmojiPickerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (emoji: string) => void;
    position?: { top: number; left: number };
}

const RECENT_EMOJIS_KEY = "recentEmojis";
const MAX_RECENT = 24;

export function EmojiPicker({ isOpen, onClose, onSelect, position }: EmojiPickerProps) {
    const [activeCategory, setActiveCategory] = useState<string>("frequent");
    const [searchQuery, setSearchQuery] = useState("");
    const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Load recent emojis from localStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
            if (stored) {
                try {
                    setRecentEmojis(JSON.parse(stored));
                } catch {
                    setRecentEmojis([]);
                }
            }
        }
    }, [isOpen]);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onClose]);

    const handleEmojiClick = (emoji: string) => {
        onSelect(emoji);

        // Update recent emojis
        const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, MAX_RECENT);
        setRecentEmojis(updated);
        if (typeof window !== "undefined") {
            localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
        }
    };

    const getFilteredEmojis = (): string[] => {
        if (!searchQuery.trim()) {
            if (activeCategory === "recent") {
                return recentEmojis;
            }
            const category = emojiCategories.find(c => c.id === activeCategory);
            return category?.emojis || [];
        }

        // Search across all categories
        const query = searchQuery.toLowerCase();
        const results: string[] = [];
        for (const category of emojiCategories) {
            if (
                category.name.toLowerCase().includes(query) ||
                category.nameJp.includes(searchQuery) ||
                category.id.includes(query)
            ) {
                results.push(...category.emojis);
            }
        }
        return [...new Set(results)];
    };

    if (!isOpen) return null;

    const filteredEmojis = getFilteredEmojis();
    const activeCategoryData = emojiCategories.find(c => c.id === activeCategory);

    return (
        <div
            ref={pickerRef}
            className="fixed z-[100] bg-[var(--bg-secondary)] border border-white/10 rounded-2xl shadow-2xl w-[340px] max-h-[400px] flex flex-col overflow-hidden"
            style={position ? { top: position.top, left: position.left } : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
        >
            {/* Header */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-semibold text-sm">絵文字ピッカー</h3>
                <button onClick={onClose} className="p-1 hover:bg-white/10 rounded">
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-white/10">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="検索..."
                        className="w-full pl-9 pr-3 py-2 bg-[var(--bg-tertiary)] border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-1 p-2 border-b border-white/10 overflow-x-auto scrollbar-hide">
                {/* Recent */}
                <button
                    onClick={() => setActiveCategory("recent")}
                    className={cn(
                        "p-2 rounded-lg text-lg shrink-0 transition-colors",
                        activeCategory === "recent" ? "bg-[var(--accent-primary)]" : "hover:bg-white/10"
                    )}
                    title="最近使った"
                >
                    <Clock className="w-4 h-4" />
                </button>

                {emojiCategories.map((category) => (
                    <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={cn(
                            "p-2 rounded-lg text-lg shrink-0 transition-colors",
                            activeCategory === category.id ? "bg-[var(--accent-primary)]" : "hover:bg-white/10"
                        )}
                        title={category.nameJp}
                    >
                        {category.icon}
                    </button>
                ))}
            </div>

            {/* Category Name */}
            <div className="px-3 py-1 text-xs text-[var(--text-muted)]">
                {activeCategory === "recent" ? "最近使った" : activeCategoryData?.nameJp || ""}
            </div>

            {/* Emoji Grid */}
            <div className="flex-1 overflow-y-auto p-2">
                {filteredEmojis.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                        {activeCategory === "recent" ? "最近使った絵文字はありません" : "絵文字が見つかりません"}
                    </div>
                ) : (
                    <div className="grid grid-cols-8 gap-1">
                        {filteredEmojis.map((emoji, index) => (
                            <button
                                key={`${emoji}-${index}`}
                                onClick={() => handleEmojiClick(emoji)}
                                className="p-2 text-xl hover:bg-white/10 rounded-lg transition-colors active:scale-90"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
