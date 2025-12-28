/**
 * Preview Editor Module
 * SNSプレビューエディター - 画像編集とXスタイルテキスト編集
 */

class PreviewEditor {
    constructor() {
        this.modal = null;
        this.panels = null;
        this.currentMode = 'both';
        this.currentPostIndex = null;
        this.originalImage = null;
        this.editedImage = null;
        this.adjustments = {
            brightness: 0,
            contrast: 0,
            saturation: 0
        };
        this.maxChars = 280;

        this.init();
    }

    init() {
        // DOM elements
        this.modal = document.getElementById('preview-editor-modal');
        this.panels = document.querySelector('.preview-editor-panels');

        if (!this.modal) {
            console.warn('[PreviewEditor] Modal not found');
            return;
        }

        this.setupModeButtons();
        this.setupImageEditor();
        this.setupTextEditor();
        this.setupModalControls();

        console.log('[PreviewEditor] Initialized');
    }

    // ========================================
    // Mode Switching
    // ========================================

    setupModeButtons() {
        const modeButtons = document.querySelectorAll('.preview-editor-modes .mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.setMode(mode);

                // Update active state
                modeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    setMode(mode) {
        this.currentMode = mode;
        if (this.panels) {
            this.panels.dataset.activeMode = mode;
        }
    }

    // ========================================
    // Modal Controls
    // ========================================

    setupModalControls() {
        // Close button
        const closeBtn = document.getElementById('close-preview-editor');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-preview-editor');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }

        // Save button
        const saveBtn = document.getElementById('save-preview-editor');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.save());
        }
    }

    open(postIndex = null) {
        this.currentPostIndex = postIndex;

        // Load post data if index provided
        if (postIndex !== null && window.AppState?.postQueue[postIndex]) {
            this.loadPostData(window.AppState.postQueue[postIndex]);
        }

        if (this.modal) {
            this.modal.classList.add('active');
        }
    }

    close() {
        if (this.modal) {
            this.modal.classList.remove('active');
        }
        this.resetEditor();
    }

    resetEditor() {
        this.currentPostIndex = null;
        this.originalImage = null;
        this.editedImage = null;
        this.adjustments = { brightness: 0, contrast: 0, saturation: 0 };

        // Reset sliders
        const sliders = ['adjust-brightness', 'adjust-contrast', 'adjust-saturation'];
        sliders.forEach(id => {
            const slider = document.getElementById(id);
            if (slider) slider.value = 0;
        });

        // Reset value displays
        ['brightness-value', 'contrast-value', 'saturation-value'].forEach(id => {
            const span = document.getElementById(id);
            if (span) span.textContent = '0';
        });

        // Reset text editor
        const textEditor = document.getElementById('x-post-text-editor');
        if (textEditor) textEditor.textContent = '';

        // Reset image
        const editorImage = document.getElementById('editor-image');
        const placeholder = document.getElementById('editor-image-placeholder');
        if (editorImage) {
            editorImage.style.display = 'none';
            editorImage.src = '';
        }
        if (placeholder) placeholder.style.display = 'flex';
    }

    loadPostData(post) {
        // Load image
        if (post.imageBase64) {
            this.setImage(post.imageBase64);
        }

        // Load text - generate template
        const templates = window.generatePostTemplatesForItem ?
            window.generatePostTemplatesForItem(post) :
            { x1: '' };

        const textEditor = document.getElementById('x-post-text-editor');
        if (textEditor) {
            textEditor.textContent = templates.x1 || templates.draft || '';
            this.updateCharCount();
        }

        // Update media preview
        this.updateMediaPreview(post.imageBase64);
    }

    save() {
        if (this.currentPostIndex === null) {
            this.close();
            return;
        }

        const post = window.AppState?.postQueue[this.currentPostIndex];
        if (!post) {
            this.close();
            return;
        }

        // Save edited image
        if (this.editedImage) {
            post.imageBase64 = this.editedImage;
        }

        // Note: Text updates would need additional logic to parse back into fields
        // For now, we'll just close and render

        if (window.renderPostQueue) {
            window.renderPostQueue();
        }

        if (window.showToast) {
            window.showToast('変更を保存しました', 'success');
        }

        this.close();
    }

    // ========================================
    // Image Editor
    // ========================================

    setupImageEditor() {
        // Image select button
        const selectBtn = document.getElementById('editor-image-select');
        const fileInput = document.getElementById('editor-image-input');

        if (selectBtn && fileInput) {
            selectBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.loadImageFile(e.target.files[0]);
                }
            });
        }

        // Reset button
        const resetBtn = document.getElementById('image-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetImageAdjustments());
        }

        // Adjustment sliders
        this.setupSlider('adjust-brightness', 'brightness-value', 'brightness');
        this.setupSlider('adjust-contrast', 'contrast-value', 'contrast');
        this.setupSlider('adjust-saturation', 'saturation-value', 'saturation');

        // Apply to draft button
        const applyBtn = document.getElementById('apply-image-to-draft');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyImageToDraft());
        }

        // Tool buttons (basic placeholders for Phase 3)
        const rotateBtn = document.getElementById('tool-rotate');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', () => this.rotateImage());
        }

        const flipBtn = document.getElementById('tool-flip');
        if (flipBtn) {
            flipBtn.addEventListener('click', () => this.flipImage());
        }

        // Drag and drop on image container
        const container = document.getElementById('image-preview-container');
        if (container) {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.classList.add('dragover');
            });
            container.addEventListener('dragleave', () => {
                container.classList.remove('dragover');
            });
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.loadImageFile(e.dataTransfer.files[0]);
                }
            });
        }
    }

    setupSlider(sliderId, valueId, adjustmentName) {
        const slider = document.getElementById(sliderId);
        const valueSpan = document.getElementById(valueId);

        if (slider && valueSpan) {
            slider.addEventListener('input', () => {
                const value = parseInt(slider.value);
                valueSpan.textContent = value;
                this.adjustments[adjustmentName] = value;
                this.applyAdjustments();
            });
        }
    }

    loadImageFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.setImage(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    setImage(base64) {
        this.originalImage = base64;
        this.editedImage = base64;

        const editorImage = document.getElementById('editor-image');
        const placeholder = document.getElementById('editor-image-placeholder');

        if (editorImage) {
            editorImage.src = base64;
            editorImage.style.display = 'block';
        }
        if (placeholder) {
            placeholder.style.display = 'none';
        }

        // Also load into imageEditor if available
        if (window.imageEditor) {
            window.imageEditor.loadImage(base64);
        }

        this.updateMediaPreview(base64);
    }

    applyAdjustments() {
        const editorImage = document.getElementById('editor-image');
        if (!editorImage) return;

        // Apply CSS filters for real-time preview
        const { brightness, contrast, saturation } = this.adjustments;
        const brightnessVal = 1 + (brightness / 100);
        const contrastVal = 1 + (contrast / 100);
        const saturateVal = 1 + (saturation / 100);

        editorImage.style.filter =
            `brightness(${brightnessVal}) contrast(${contrastVal}) saturate(${saturateVal})`;
    }

    resetImageAdjustments() {
        this.adjustments = { brightness: 0, contrast: 0, saturation: 0 };

        // Reset sliders
        ['adjust-brightness', 'adjust-contrast', 'adjust-saturation'].forEach(id => {
            const slider = document.getElementById(id);
            if (slider) slider.value = 0;
        });

        // Reset value displays
        ['brightness-value', 'contrast-value', 'saturation-value'].forEach(id => {
            const span = document.getElementById(id);
            if (span) span.textContent = '0';
        });

        // Reset filter
        const editorImage = document.getElementById('editor-image');
        if (editorImage) {
            editorImage.style.filter = 'none';
        }
    }

    rotateImage() {
        // Use imageEditor if available
        if (window.imageEditor) {
            window.imageEditor.rotate(90);
        } else if (window.showToast) {
            window.showToast('画像エディターを読み込み中...', 'info');
        }
    }

    flipImage() {
        // Use imageEditor if available
        if (window.imageEditor) {
            window.imageEditor.flipHorizontal();
        } else {
            const editorImage = document.getElementById('editor-image');
            if (!editorImage) return;

            // Toggle flip using CSS transform
            const currentTransform = editorImage.style.transform || '';
            if (currentTransform.includes('scaleX(-1)')) {
                editorImage.style.transform = currentTransform.replace('scaleX(-1)', '');
            } else {
                editorImage.style.transform = `${currentTransform} scaleX(-1)`;
            }
        }
    }

    applyImageToDraft() {
        // Use imageEditor if available for processing
        let processedImage = null;
        if (window.imageEditor) {
            processedImage = window.imageEditor.getProcessedImage();
        }

        if (processedImage) {
            this.editedImage = processedImage;
        } else if (this.originalImage) {
            this.editedImage = this.originalImage;
        }

        if (this.editedImage) {
            this.updateMediaPreview(this.editedImage);

            // Update the actual post in the queue
            if (this.currentPostIndex !== null) {
                const post = window.AppState?.postQueue[this.currentPostIndex];
                if (post) {
                    post.imageBase64 = this.editedImage;
                }
            }

            if (window.showToast) {
                window.showToast('画像をドラフトに適用しました', 'success');
            }
        }
    }

    updateMediaPreview(base64) {
        const mediaContainer = document.getElementById('x-post-media');
        if (mediaContainer && base64) {
            mediaContainer.innerHTML = `<img src="${base64}" alt="投稿画像">`;
        }
    }

    // ========================================
    // Text Editor
    // ========================================

    setupTextEditor() {
        const textEditor = document.getElementById('x-post-text-editor');

        if (textEditor) {
            // Character count
            textEditor.addEventListener('input', () => this.updateCharCount());

            // Prevent paste with formatting
            textEditor.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
            });
        }

        // Copy button
        const copyBtn = document.getElementById('copy-post-text');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyText());
        }

        // Save button
        const saveBtn = document.getElementById('save-post-text');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveText());
        }

        // Tool buttons
        const emojiBtn = document.getElementById('insert-emoji');
        if (emojiBtn) {
            emojiBtn.addEventListener('click', () => this.insertEmoji());
        }

        const hashtagBtn = document.getElementById('insert-hashtag');
        if (hashtagBtn) {
            hashtagBtn.addEventListener('click', () => this.insertHashtag());
        }

        const mentionBtn = document.getElementById('insert-mention');
        if (mentionBtn) {
            mentionBtn.addEventListener('click', () => this.insertMention());
        }

        const templateBtn = document.getElementById('insert-template');
        if (templateBtn) {
            templateBtn.addEventListener('click', () => this.insertTemplate());
        }
    }

    updateCharCount() {
        const textEditor = document.getElementById('x-post-text-editor');
        const charCount = document.getElementById('char-count');
        const charWarning = document.getElementById('char-warning');

        if (textEditor && charCount) {
            const length = textEditor.textContent.length;
            charCount.textContent = length;

            // Update warning
            if (charWarning) {
                charWarning.style.display = length > this.maxChars ? 'inline' : 'none';
            }

            // Update color
            if (length > this.maxChars) {
                charCount.style.color = 'var(--error)';
            } else if (length > this.maxChars * 0.9) {
                charCount.style.color = 'var(--warning)';
            } else {
                charCount.style.color = 'var(--text-primary)';
            }
        }
    }

    copyText() {
        const textEditor = document.getElementById('x-post-text-editor');
        if (textEditor) {
            navigator.clipboard.writeText(textEditor.textContent).then(() => {
                if (window.showToast) {
                    window.showToast('テキストをコピーしました', 'success');
                }
            });
        }
    }

    saveText() {
        // Save text back to post - would need parsing logic
        if (window.showToast) {
            window.showToast('テキストを保存しました', 'success');
        }
    }

    insertEmoji() {
        // Simple emoji insertion - Phase 4 will add full picker
        const emojis = ['😊', '✨', '📸', '🎮', '🏎️', '💫', '🌟', '🎉'];
        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
        this.insertAtCursor(randomEmoji);
    }

    insertHashtag() {
        this.insertAtCursor('#');
    }

    insertMention() {
        this.insertAtCursor('@');
    }

    insertTemplate() {
        // Insert event hashtags if available
        const hashtags = window.AppState?.eventInfo?.hashtags || '#イベント';
        this.insertAtCursor(hashtags);
    }

    insertAtCursor(text) {
        const textEditor = document.getElementById('x-post-text-editor');
        if (!textEditor) return;

        textEditor.focus();
        document.execCommand('insertText', false, text);
        this.updateCharCount();
    }
}

// Create global instance
const previewEditor = new PreviewEditor();

// Export for use in other modules
export { PreviewEditor, previewEditor };

// Browser global
if (typeof window !== 'undefined') {
    window.PreviewEditor = PreviewEditor;
    window.previewEditor = previewEditor;

    // Convenience function to open editor
    window.openPreviewEditor = (postIndex) => {
        previewEditor.open(postIndex);
    };
}
