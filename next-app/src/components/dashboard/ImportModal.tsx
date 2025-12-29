"use client";

import { useState } from "react";
import { X, Upload, FileText, Check, AlertCircle, Hash } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { parse, ParsedEntry } from "@/utils/bulkTextParser";
import { parseUniversal } from "@/utils/universalParser";
import { parseEventText, generateHashtags } from "@/utils/eventParser";
import { cn } from "@/utils/cn";

interface ImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
    const { addToQueue } = useAppStore();
    const [inputText, setInputText] = useState("");
    const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
    const [step, setStep] = useState<"input" | "preview">("input");
    const [warnings, setWarnings] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleParse = () => {
        // ... imports removed
        if (!inputText.trim()) {
            setError("Please enter some text to import.");
            return;
        }



        const result = parseUniversal(inputText);

        if (result.entries.length === 0) {
            setError("Could not parse any entries. Please check the format.");
            return;
        }

        if (result.entries.length > 10) {
            setError(`Too many entries (${result.entries.length}). Maximum is 10.`);
            return;
        }

        setParsedEntries(result.entries);
        setWarnings(result.warnings);
        setError(null);
        setStep("preview");
    };

    const handleImport = () => {
        parsedEntries.forEach(entry => {
            addToQueue({
                imageFile: null,
                imageBase64: null,
                boothName: entry.boothName,
                boothAccount: entry.boothAccount,
                personRole: entry.role || 'モデル',
                personName: entry.personName,
                personAccount: entry.personAccount,
                aiComment: '',
                status: 'draft',
                eventInfo: (entry as any).eventInfo || {
                    eventEn: '',
                    eventJp: '',
                    date: '',
                    venue: '',
                    category: 'ブース',
                    hashtags: ''
                }
            });
        });

        onClose();
        setInputText("");
        setParsedEntries([]);
        setStep("input");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[var(--bg-secondary)] rounded-2xl w-full max-w-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 text-white">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Upload className="w-5 h-5 text-[var(--accent-primary)]" />
                        Import Posts
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === "input" ? (
                        <div className="space-y-4">
                            <p className="text-[var(--text-secondary)] text-sm">
                                Paste your text here. Supported formats: Numbered lists, Bullet points, Paragraphs (double newline).
                                <br />Max 10 entries allowed.
                            </p>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Example:&#10;1. Company Name&#10;Model Name (@account)&#10;&#10;2. Another Company&#10;..."
                                className="w-full h-64 bg-[var(--bg-tertiary)] border border-white/10 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] resize-none font-mono text-sm"
                            />
                            {error && (
                                <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {error}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between font-semibold flex-wrap">
                                <span>Preview ({parsedEntries.length} items)</span>
                                {warnings.length > 0 && (
                                    <span className="text-yellow-400 text-sm flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        {warnings.length} warnings
                                    </span>
                                )}
                            </div>

                            <div className="space-y-3">
                                {parsedEntries.map((entry, i) => (
                                    <div key={i} className="bg-[var(--bg-tertiary)] p-4 rounded-xl border border-white/5">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="bg-white/10 text-xs px-2 py-1 rounded text-[var(--text-secondary)]">
                                                #{i + 1}
                                            </span>
                                            {entry.confidence < 50 && (
                                                <span className="text-yellow-400 text-xs">Low Confidence</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-[var(--text-muted)] text-xs block">Name</span>
                                                {entry.personName || "-"}
                                            </div>
                                            <div>
                                                <span className="text-[var(--text-muted)] text-xs block">Account</span>
                                                {entry.personAccount ? `@${entry.personAccount}` : "-"}
                                            </div>
                                            <div className="col-span-2 space-y-1">
                                                <span className="text-[var(--text-muted)] text-xs block">Booth</span>
                                                <div className="font-medium">{entry.boothName || "-"}</div>
                                            </div>
                                            {(entry as any).eventInfo && (
                                                <div className="col-span-2 pt-2 border-t border-white/5 mt-2">
                                                    <span className="text-[var(--text-muted)] text-xs block mb-1">Detected Info</span>
                                                    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-secondary)]">
                                                        <div>📅 {(entry as any).eventInfo.date || "-"}</div>
                                                        <div>📍 {(entry as any).eventInfo.venue || "-"}</div>
                                                        <div className="col-span-2">🎪 {(entry as any).eventInfo.eventEn || (entry as any).eventInfo.eventJp || "-"}</div>
                                                        {(entry as any).eventInfo.hashtags && (
                                                            <div className="col-span-2 flex items-center gap-1">
                                                                <Hash className="w-3 h-3" />
                                                                <span className="text-[var(--accent-primary)] truncate">{(entry as any).eventInfo.hashtags}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-3 text-white">
                    {step === "input" ? (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleParse}
                                className="px-4 py-2 bg-[var(--accent-primary)] hover:bg-indigo-500 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4" />
                                Parse Text
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => setStep("input")}
                                className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={parsedEntries.length === 0}
                                className="px-4 py-2 bg-[var(--success)] hover:bg-emerald-600 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-4 h-4" />
                                Import {parsedEntries.length} Items
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
