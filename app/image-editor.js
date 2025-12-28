/**
 * Image Editor Module
 * プロフェッショナル画像編集 - Cropper.js統合 + CSSフィルター
 */

class ImageEditor {
    constructor() {
        this.cropper = null;
        this.originalImage = null;
        this.currentFilters = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            hue: 0,
            blur: 0,
            sharpen: 0
        };
        this.isFlippedH = false;
        this.isFlippedV = false;
        this.rotationAngle = 0;
        this.cropMode = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        console.log('[ImageEditor] Initialized');
    }

    setupEventListeners() {
        // Crop button
        const cropBtn = document.getElementById('tool-crop');
        if (cropBtn) {
            cropBtn.addEventListener('click', () => this.toggleCropMode());
        }

        // Rotate button
        const rotateBtn = document.getElementById('tool-rotate');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', () => this.rotate(90));
        }

        // Flip button
        const flipBtn = document.getElementById('tool-flip');
        if (flipBtn) {
            flipBtn.addEventListener('click', () => this.flipHorizontal());
        }

        // Reset button
        const resetBtn = document.getElementById('image-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetAll());
        }

        // Sliders
        this.setupSliders();

        // Apply button
        const applyBtn = document.getElementById('apply-image-to-draft');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => this.applyToDraft());
        }
    }

    setupSliders() {
        const sliders = [
            { id: 'adjust-brightness', filter: 'brightness', valueId: 'brightness-value' },
            { id: 'adjust-contrast', filter: 'contrast', valueId: 'contrast-value' },
            { id: 'adjust-saturation', filter: 'saturation', valueId: 'saturation-value' }
        ];

        sliders.forEach(({ id, filter, valueId }) => {
            const slider = document.getElementById(id);
            const valueSpan = document.getElementById(valueId);

            if (slider) {
                slider.addEventListener('input', () => {
                    const value = parseInt(slider.value);
                    if (valueSpan) valueSpan.textContent = value;
                    this.currentFilters[filter] = value;
                    this.applyFilters();
                });
            }
        });
    }

    // ========================================
    // Image Loading
    // ========================================

    loadImage(base64OrUrl) {
        this.originalImage = base64OrUrl;
        const img = document.getElementById('editor-image');
        const placeholder = document.getElementById('editor-image-placeholder');

        if (img) {
            img.src = base64OrUrl;
            img.style.display = 'block';
            img.onload = () => {
                if (placeholder) placeholder.style.display = 'none';
            };
        }

        // Reset filters when loading new image
        this.resetFilters();
    }

    // ========================================
    // Cropping (Cropper.js)
    // ========================================

    toggleCropMode() {
        const img = document.getElementById('editor-image');
        const cropBtn = document.getElementById('tool-crop');

        if (!img || !img.src) {
            if (window.showToast) {
                window.showToast('先に画像を読み込んでください', 'warning');
            }
            return;
        }

        if (this.cropMode) {
            this.exitCropMode();
            if (cropBtn) cropBtn.classList.remove('active');
        } else {
            this.enterCropMode();
            if (cropBtn) cropBtn.classList.add('active');
        }
    }

    enterCropMode() {
        const img = document.getElementById('editor-image');
        if (!img) return;

        // Check if Cropper.js is loaded
        if (typeof Cropper === 'undefined') {
            console.error('[ImageEditor] Cropper.js not loaded');
            if (window.showToast) {
                window.showToast('画像編集ライブラリの読み込みに失敗しました', 'error');
            }
            return;
        }

        // Destroy existing cropper if any
        if (this.cropper) {
            this.cropper.destroy();
        }

        // Initialize Cropper
        this.cropper = new Cropper(img, {
            aspectRatio: NaN, // Free crop
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.8,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: true,
            background: true,
            responsive: true
        });

        this.cropMode = true;

        // Show crop action buttons
        this.showCropActions();
    }

    exitCropMode() {
        if (this.cropper) {
            this.cropper.destroy();
            this.cropper = null;
        }
        this.cropMode = false;
        this.hideCropActions();
    }

    showCropActions() {
        // Add confirm/cancel buttons for crop
        const container = document.getElementById('image-preview-container');
        if (!container) return;

        let cropActions = container.querySelector('.crop-actions');
        if (!cropActions) {
            cropActions = document.createElement('div');
            cropActions.className = 'crop-actions';
            cropActions.innerHTML = `
                <button class="btn btn-primary btn-small" id="crop-confirm">✓ 切り抜き確定</button>
                <button class="btn btn-ghost btn-small" id="crop-cancel">✕ キャンセル</button>
            `;
            container.appendChild(cropActions);

            // Event listeners
            cropActions.querySelector('#crop-confirm').addEventListener('click', () => {
                this.confirmCrop();
            });
            cropActions.querySelector('#crop-cancel').addEventListener('click', () => {
                this.toggleCropMode();
            });
        }
        cropActions.style.display = 'flex';
    }

    hideCropActions() {
        const cropActions = document.querySelector('.crop-actions');
        if (cropActions) {
            cropActions.style.display = 'none';
        }
    }

    confirmCrop() {
        if (!this.cropper) return;

        // Get cropped canvas
        const canvas = this.cropper.getCroppedCanvas({
            maxWidth: 4096,
            maxHeight: 4096,
            fillColor: '#fff',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });

        if (canvas) {
            const croppedBase64 = canvas.toDataURL('image/jpeg', 0.95);
            this.exitCropMode();
            this.loadImage(croppedBase64);

            if (window.showToast) {
                window.showToast('画像を切り抜きました', 'success');
            }
        }
    }

    // ========================================
    // Rotation and Flip
    // ========================================

    rotate(degrees) {
        const img = document.getElementById('editor-image');
        if (!img) return;

        if (this.cropper) {
            // Use Cropper's rotate
            this.cropper.rotate(degrees);
        } else {
            // CSS rotation
            this.rotationAngle = (this.rotationAngle + degrees) % 360;
            this.applyTransform();
        }
    }

    flipHorizontal() {
        const img = document.getElementById('editor-image');
        if (!img) return;

        if (this.cropper) {
            // Use Cropper's scale
            const currentScaleX = this.cropper.getData().scaleX || 1;
            this.cropper.scaleX(-currentScaleX);
        } else {
            this.isFlippedH = !this.isFlippedH;
            this.applyTransform();
        }
    }

    flipVertical() {
        const img = document.getElementById('editor-image');
        if (!img) return;

        if (this.cropper) {
            const currentScaleY = this.cropper.getData().scaleY || 1;
            this.cropper.scaleY(-currentScaleY);
        } else {
            this.isFlippedV = !this.isFlippedV;
            this.applyTransform();
        }
    }

    applyTransform() {
        const img = document.getElementById('editor-image');
        if (!img) return;

        const scaleX = this.isFlippedH ? -1 : 1;
        const scaleY = this.isFlippedV ? -1 : 1;
        img.style.transform = `rotate(${this.rotationAngle}deg) scale(${scaleX}, ${scaleY})`;
    }

    // ========================================
    // Filters
    // ========================================

    applyFilters() {
        const img = document.getElementById('editor-image');
        if (!img) return;

        const { brightness, contrast, saturation, hue, blur } = this.currentFilters;

        // Convert slider values (-100 to 100) to CSS filter values
        const brightnessVal = 1 + (brightness / 100);
        const contrastVal = 1 + (contrast / 100);
        const saturateVal = 1 + (saturation / 100);
        const hueRotateVal = (hue / 100) * 180; // -180 to 180 degrees
        const blurVal = Math.max(0, blur / 10); // 0 to 10px

        let filterString = `brightness(${brightnessVal}) contrast(${contrastVal}) saturate(${saturateVal})`;

        if (hueRotateVal !== 0) {
            filterString += ` hue-rotate(${hueRotateVal}deg)`;
        }
        if (blurVal > 0) {
            filterString += ` blur(${blurVal}px)`;
        }

        img.style.filter = filterString;

        // Also update media preview in text editor
        this.updateMediaPreview();
    }

    resetFilters() {
        this.currentFilters = {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            hue: 0,
            blur: 0,
            sharpen: 0
        };

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

        this.applyFilters();
    }

    resetAll() {
        // Reset filters
        this.resetFilters();

        // Reset transform
        this.rotationAngle = 0;
        this.isFlippedH = false;
        this.isFlippedV = false;

        const img = document.getElementById('editor-image');
        if (img) {
            img.style.transform = '';
            img.style.filter = '';
        }

        // Exit crop mode if active
        if (this.cropMode) {
            this.exitCropMode();
            const cropBtn = document.getElementById('tool-crop');
            if (cropBtn) cropBtn.classList.remove('active');
        }

        // Reload original image
        if (this.originalImage) {
            this.loadImage(this.originalImage);
        }

        if (window.showToast) {
            window.showToast('画像をリセットしました', 'info');
        }
    }

    // ========================================
    // Export
    // ========================================

    updateMediaPreview() {
        const img = document.getElementById('editor-image');
        const mediaContainer = document.getElementById('x-post-media');

        if (img && img.src && mediaContainer) {
            mediaContainer.innerHTML = `<img src="${img.src}" alt="投稿画像" style="${img.style.cssText}">`;
        }
    }

    getProcessedImage() {
        const img = document.getElementById('editor-image');
        if (!img || !img.src) return null;

        // Create canvas to apply filters
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        // Apply CSS filter to canvas
        ctx.filter = img.style.filter || 'none';

        // Handle rotation and flip
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.translate(centerX, centerY);
        ctx.rotate((this.rotationAngle * Math.PI) / 180);
        ctx.scale(this.isFlippedH ? -1 : 1, this.isFlippedV ? -1 : 1);
        ctx.translate(-centerX, -centerY);

        // Draw image
        ctx.drawImage(img, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.95);
    }

    applyToDraft() {
        const processedImage = this.getProcessedImage();

        if (!processedImage) {
            if (window.showToast) {
                window.showToast('処理する画像がありません', 'warning');
            }
            return;
        }

        // Update current post if preview editor is open
        if (window.previewEditor && window.previewEditor.currentPostIndex !== null) {
            const post = window.AppState?.postQueue[window.previewEditor.currentPostIndex];
            if (post) {
                post.imageBase64 = processedImage;
                if (window.renderPostQueue) {
                    window.renderPostQueue();
                }
            }
        }

        // Update media preview
        const mediaContainer = document.getElementById('x-post-media');
        if (mediaContainer) {
            mediaContainer.innerHTML = `<img src="${processedImage}" alt="投稿画像">`;
        }

        if (window.showToast) {
            window.showToast('画像をドラフトに適用しました', 'success');
        }
    }
}

// Create global instance
const imageEditor = new ImageEditor();

// Export for use in other modules
export { ImageEditor, imageEditor };

// Browser global
if (typeof window !== 'undefined') {
    window.ImageEditor = ImageEditor;
    window.imageEditor = imageEditor;
}
