"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, Search } from 'lucide-react';

interface Toast {
    id: string;
    type: 'success' | 'error' | 'loading' | 'info';
    title: string;
    message?: string;
}

interface ToastContextValue {
    showToast: (toast: Omit<Toast, 'id'>) => string;
    hideToast: (id: string) => void;
    updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
}

// トースト表示用のグローバルストア
let toastListeners: ((toasts: Toast[]) => void)[] = [];
let toasts: Toast[] = [];

function notifyListeners() {
    toastListeners.forEach(listener => listener([...toasts]));
}

export function showToast(toast: Omit<Toast, 'id'>): string {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    toasts = [...toasts, { ...toast, id }];
    notifyListeners();

    // 自動で消える（loadingタイプ以外）
    if (toast.type !== 'loading') {
        setTimeout(() => {
            hideToast(id);
        }, 5000);
    }

    return id;
}

export function hideToast(id: string) {
    toasts = toasts.filter(t => t.id !== id);
    notifyListeners();
}

export function updateToast(id: string, updates: Partial<Omit<Toast, 'id'>>) {
    toasts = toasts.map(t => t.id === id ? { ...t, ...updates } : t);
    notifyListeners();

    // 更新後に自動で消える
    if (updates.type && updates.type !== 'loading') {
        setTimeout(() => {
            hideToast(id);
        }, 5000);
    }
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
    const icons = {
        success: <CheckCircle className="w-5 h-5 text-green-400" />,
        error: <AlertCircle className="w-5 h-5 text-red-400" />,
        loading: <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />,
        info: <Search className="w-5 h-5 text-purple-400" />
    };

    const bgColors = {
        success: 'bg-green-500/10 border-green-500/30',
        error: 'bg-red-500/10 border-red-500/30',
        loading: 'bg-blue-500/10 border-blue-500/30',
        info: 'bg-purple-500/10 border-purple-500/30'
    };

    return (
        <div className={`flex items-start gap-3 p-4 rounded-xl border backdrop-blur-lg shadow-xl ${bgColors[toast.type]} animate-slide-in`}>
            {icons[toast.type]}
            <div className="flex-1 min-w-0">
                <p className="font-medium text-white">{toast.title}</p>
                {toast.message && (
                    <p className="text-sm text-white/70 mt-0.5">{toast.message}</p>
                )}
            </div>
            {toast.type !== 'loading' && (
                <button
                    onClick={onClose}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                    <X className="w-4 h-4 text-white/50" />
                </button>
            )}
        </div>
    );
}

export function ToastContainer() {
    const [localToasts, setLocalToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const listener = (newToasts: Toast[]) => setLocalToasts(newToasts);
        toastListeners.push(listener);

        return () => {
            toastListeners = toastListeners.filter(l => l !== listener);
        };
    }, []);

    if (localToasts.length === 0) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
            {localToasts.map(toast => (
                <ToastItem
                    key={toast.id}
                    toast={toast}
                    onClose={() => hideToast(toast.id)}
                />
            ))}

            <style jsx global>{`
                @keyframes slide-in {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                .animate-slide-in {
                    animation: slide-in 0.3s ease-out;
                }
            `}</style>
        </div>
    );
}
