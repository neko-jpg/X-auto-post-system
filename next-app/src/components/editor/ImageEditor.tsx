"use client";

import 'cropperjs/dist/cropper.css';
import { Cropper } from 'react-cropper';
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/utils/cn";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
    RotateCw, FlipHorizontal, FlipVertical, Image as ImageIcon,
    Square, RectangleHorizontal, RectangleVertical, Check
} from "lucide-react";
import { ImageContextMenu } from "./ImageContextMenu";
import type { ScoredCandidate } from "@/utils/imageSimilarityService";
import { showToast, updateToast } from "@/components/ui/Toast";

// 遅延ロード（SSR無効）でtransformers.jsのモジュール評価問題を回避
const SimilaritySearchModal = dynamic(
    () => import("./SimilaritySearchModal").then(mod => mod.SimilaritySearchModal),
    { ssr: false, loading: () => <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"><div className="text-white">Loading...</div></div> }
);

export function ImageEditor() {
    const { postQueue, currentEditIndex, updateQueueItem } = useAppStore();
    const cropperRef = useRef<HTMLImageElement>(null);
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [saturation, setSaturation] = useState(100);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
    // Similarity search modal state
    const [showSearchModal, setShowSearchModal] = useState(false);

    if (currentEditIndex === null || !postQueue[currentEditIndex]) return null;
    const post = postQueue[currentEditIndex];

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                updateQueueItem(currentEditIndex, { imageBase64: event.target.result as string });
            }
        };
        reader.readAsDataURL(file);
    };

    // Right-click handler
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    // Handle account selection from similarity search
    const handleAccountSelect = (candidate: ScoredCandidate) => {
        updateQueueItem(currentEditIndex, {
            personName: candidate.accountName,
            personAccount: candidate.accountHandle
        });
        setShowSearchModal(false);
    };

    if (!post.imageBase64) {
        return (
            <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center h-full bg-[var(--bg-tertiary)] text-[var(--text-muted)] rounded-2xl border-2 border-dashed border-white/10 cursor-pointer hover:bg-white/5 transition-colors hover:border-[var(--accent-primary)]/50 hover:text-[var(--accent-primary)]"
            >
                <ImageIcon className="w-12 h-12 mb-2" />
                <p>Click to Upload Image</p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                />
            </div>
        );
    }

    const onCropCheck = () => {
        const imageElement: any = cropperRef?.current;
        const cropper: any = imageElement?.cropper;
        if (cropper) {
            const croppedCanvas = cropper.getCroppedCanvas();
            // Only for final save, but here we might just want to track crop data
            // For now, we will just apply to CSS for display or something?
            // Actually we should save crop data.
            // But react-cropper is mainly for generating new images.
        }
    };

    const handleSaveCrop = () => {
        const imageElement: any = cropperRef?.current;
        const cropper: any = imageElement?.cropper;
        if (cropper) {
            const croppedCanvas = cropper.getCroppedCanvas();
            const croppedBase64 = croppedCanvas.toDataURL();
            updateQueueItem(currentEditIndex, { imageBase64: croppedBase64 });
        }
    };

    const getFilterString = () => {
        return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    };

    return (
        <div className="flex flex-col h-full bg-[var(--bg-card)] rounded-2xl overflow-hidden border border-white/10">
            {/* Toolbar */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-[var(--bg-secondary)]">
                <div className="flex items-center gap-2">
                    <button className="p-2 hover:bg-white/10 rounded" title="1:1" onClick={() => (cropperRef.current as any)?.cropper.setAspectRatio(1)}>
                        <Square className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded" title="4:5" onClick={() => (cropperRef.current as any)?.cropper.setAspectRatio(4 / 5)}>
                        <RectangleVertical className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded" title="16:9" onClick={() => (cropperRef.current as any)?.cropper.setAspectRatio(16 / 9)}>
                        <RectangleHorizontal className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSaveCrop}
                        className="px-3 py-1.5 bg-[var(--accent-primary)] hover:bg-indigo-500 rounded text-xs font-medium transition-colors flex items-center gap-1"
                    >
                        <Check className="w-3 h-3" />
                        Apply Crop
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded" onClick={() => (cropperRef.current as any)?.cropper.rotate(90)}>
                        <RotateCw className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded" onClick={() => (cropperRef.current as any)?.cropper.scaleX(-1)}>
                        <FlipHorizontal className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Area - with right-click support */}
            <div
                className="flex-1 relative bg-[#1a1a1a]"
                onContextMenu={handleContextMenu}
            >
                <Cropper
                    src={post.imageBase64}
                    style={{ height: '100%', width: '100%', filter: getFilterString() } as any}
                    initialAspectRatio={1}
                    guides={true}
                    ref={cropperRef}
                    viewMode={1}
                    background={false}
                    responsive={true}
                />
            </div>

            {/* Filter Sliders */}
            <div className="p-4 bg-[var(--bg-secondary)] border-t border-white/10 grid grid-cols-3 gap-4">
                <label className="text-xs">
                    Brightness
                    <input
                        type="range" min="50" max="150" value={brightness}
                        onChange={e => setBrightness(Number(e.target.value))}
                        className="w-full mt-1 accent-[var(--accent-primary)]"
                    />
                </label>
                <label className="text-xs">
                    Contrast
                    <input
                        type="range" min="50" max="150" value={contrast}
                        onChange={e => setContrast(Number(e.target.value))}
                        className="w-full mt-1 accent-[var(--accent-primary)]"
                    />
                </label>
                <label className="text-xs">
                    Saturation
                    <input
                        type="range" min="0" max="200" value={saturation}
                        onChange={e => setSaturation(Number(e.target.value))}
                        className="w-full mt-1 accent-[var(--accent-primary)]"
                    />
                </label>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <ImageContextMenu
                    position={contextMenu}
                    onClose={() => setContextMenu(null)}
                    onSearchWithAI={async () => {
                        if (!post.imageBase64) {
                            showToast({
                                type: 'error',
                                title: '画像がありません'
                            });
                            return;
                        }

                        const toastId = showToast({
                            type: 'loading',
                            title: 'Cameko解析中...',
                            message: 'ブラウザウィンドウが開きます'
                        });

                        try {
                            console.log('[Cameko] Starting visible search...');

                            const response = await fetch('/api/cameko-search', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ imageBase64: post.imageBase64 })
                            });

                            const result = await response.json();
                            console.log('[Cameko] Result:', result);

                            if (result.success) {
                                updateToast(toastId, {
                                    type: 'success',
                                    title: 'Cameko解析完了！',
                                    message: '結果をブラウザウィンドウで確認してください'
                                });
                            } else {
                                updateToast(toastId, {
                                    type: 'error',
                                    title: '解析に失敗しました',
                                    message: result.error || '不明なエラー'
                                });
                            }

                        } catch (error: any) {
                            console.error('[Cameko] Error:', error);
                            updateToast(toastId, {
                                type: 'error',
                                title: 'エラーが発生しました',
                                message: error.message
                            });
                        }
                    }}
                    onSearchAccount={() => setShowSearchModal(true)}
                    onExtractMetadata={() => {
                        // TODO: Implement metadata extraction
                        console.log('Extract metadata');
                    }}
                    onGenerateComment={() => {
                        // TODO: Integrate with existing AI comment generation
                        console.log('Generate AI comment');
                    }}
                    onFactCheck={post.personName ? async () => {
                        const personName = post.personName;
                        if (!personName || !post.imageBase64) {
                            showToast({
                                type: 'error',
                                title: '検証に必要な情報がありません',
                                message: '先にCamekoで解析を実行してください'
                            });
                            return;
                        }

                        const toastId = showToast({
                            type: 'loading',
                            title: '検証中...',
                            message: `${personName}をGoogle画像検索で検証しています`
                        });

                        try {
                            const response = await fetch('/api/fact-check', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    personName,
                                    originalImageBase64: post.imageBase64,
                                    fetchImages: false
                                })
                            });

                            const result = await response.json();
                            console.log('[FactCheck] Result:', result);

                            if (result.success && result.matchedImages.length > 0) {
                                updateToast(toastId, {
                                    type: 'success',
                                    title: '検証完了！',
                                    message: `${result.matchedImages.length}件の関連画像が見つかりました。結果はコンソールを確認してください。`
                                });

                                // 画像URLをコンソールに出力（将来的にモーダルで表示）
                                console.log('[FactCheck] Matched images:', result.matchedImages);
                            } else if (result.success) {
                                updateToast(toastId, {
                                    type: 'info',
                                    title: '検証完了',
                                    message: '関連画像が見つかりませんでした'
                                });
                            } else {
                                updateToast(toastId, {
                                    type: 'error',
                                    title: '検証に失敗しました',
                                    message: result.error || '不明なエラー'
                                });
                            }
                        } catch (error: any) {
                            console.error('[FactCheck] Error:', error);
                            updateToast(toastId, {
                                type: 'error',
                                title: 'エラーが発生しました',
                                message: error.message
                            });
                        }
                    } : undefined}
                />
            )}

            {/* Similarity Search Modal */}
            {showSearchModal && post.imageBase64 && (
                <SimilaritySearchModal
                    imageBase64={post.imageBase64}
                    eventName={post.eventInfo?.eventJp}
                    onSelect={handleAccountSelect}
                    onClose={() => setShowSearchModal(false)}
                />
            )}
        </div>
    );
}
