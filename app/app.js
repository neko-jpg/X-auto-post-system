/**
 * イベント写真自動投稿システム
 * メインアプリケーションロジック
 */

// ========================================
// State Management
// ========================================

const AppState = {
    currentStep: 1,
    eventInfo: {
        eventEn: '',
        eventJp: '',
        date: '',
        venue: '',
        category: 'ブース',
        hashtags: ''
    },
    photoData: {
        imageFile: null,
        imageBase64: null,
        boothName: '',
        boothAccount: '',
        personRole: 'モデル',
        personName: '',
        personAccount: '',
        aiComment: ''
    },
    settings: {
        makeWebhookUrl: ''
    }
};

// ========================================
// DOM Elements
// ========================================

const DOM = {
    // Step indicators
    step1Indicator: document.getElementById('step1-indicator'),
    step2Indicator: document.getElementById('step2-indicator'),

    // Step panels
    step1Panel: document.getElementById('step1-panel'),
    step2Panel: document.getElementById('step2-panel'),

    // Event drop zone
    eventDropZone: document.getElementById('event-drop-zone'),
    eventFileInput: document.getElementById('event-file-input'),

    // Event form
    eventForm: document.getElementById('event-form'),
    eventEn: document.getElementById('event-en'),
    eventJp: document.getElementById('event-jp'),
    eventDate: document.getElementById('event-date'),
    eventVenue: document.getElementById('event-venue'),
    eventCategory: document.getElementById('event-category'),
    eventHashtags: document.getElementById('event-hashtags'),

    // Event summary
    eventSummary: document.getElementById('event-summary'),
    summaryEventName: document.getElementById('summary-event-name'),
    summaryEventMeta: document.getElementById('summary-event-meta'),
    changeEventBtn: document.getElementById('change-event-btn'),

    // Photo section
    photoDropZone: document.getElementById('photo-drop-zone'),
    photoFileInput: document.getElementById('photo-file-input'),
    photoPreview: document.getElementById('photo-preview'),
    clearInputBtn: document.getElementById('clear-input-btn'),

    // Photo form
    boothName: document.getElementById('booth-name'),
    boothAccount: document.getElementById('booth-account'),
    personRole: document.getElementById('person-role'),
    personName: document.getElementById('person-name'),
    personAccount: document.getElementById('person-account'),

    // Comment generation inputs
    expressionType: document.getElementById('expression-type'),
    focusPoint: document.getElementById('focus-point'),
    contextMatch: document.getElementById('context-match'),
    aiComment: document.getElementById('ai-comment'),
    generateCommentBtn: document.getElementById('generate-comment-btn'),
    regenerateBtn: document.getElementById('regenerate-btn'),

    // Preview
    previewX1: document.getElementById('preview-x1'),
    previewX2: document.getElementById('preview-x2'),
    previewIg: document.getElementById('preview-ig'),

    // Actions
    sendMakeBtn: document.getElementById('send-make-btn'),
    nextPhotoBtn: document.getElementById('next-photo-btn'),

    // Settings
    settingsModal: document.getElementById('settings-modal'),
    openSettingsBtn: document.getElementById('open-settings'),
    closeSettingsBtn: document.getElementById('close-settings'),
    makeWebhookUrl: document.getElementById('make-webhook-url'),
    saveSettingsBtn: document.getElementById('save-settings-btn'),

    // Toast
    toast: document.getElementById('toast')
};

// ========================================
// Initialization
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initEventListeners();
    updatePreview();
});

function loadSettings() {
    const savedSettings = localStorage.getItem('autoPostSettings');
    if (savedSettings) {
        AppState.settings = JSON.parse(savedSettings);
        DOM.makeWebhookUrl.value = AppState.settings.makeWebhookUrl || '';
    }
}

function saveSettings() {
    AppState.settings.makeWebhookUrl = DOM.makeWebhookUrl.value;
    localStorage.setItem('autoPostSettings', JSON.stringify(AppState.settings));
    showToast('設定を保存しました', 'success');
    DOM.settingsModal.classList.remove('active');
}

// ========================================
// Event Listeners
// ========================================

function initEventListeners() {
    // ========================================
    // Tab Navigation for Event Input
    // ========================================
    document.querySelectorAll('.input-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active from all tabs and contents
            document.querySelectorAll('.input-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Activate clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.dataset.tab + '-tab';
            document.getElementById(tabId)?.classList.add('active');
        });
    });

    // Parse paste button
    const parsePasteBtn = document.getElementById('parse-paste-btn');
    if (parsePasteBtn) {
        parsePasteBtn.addEventListener('click', () => {
            const pasteInput = document.getElementById('paste-input');
            const parseResult = document.getElementById('parse-result');

            if (!pasteInput.value.trim()) {
                showToast('テキストを入力してください', 'error');
                return;
            }

            // Parse the text using event-patterns.js
            const result = parseEventText(pasteInput.value);

            // Apply to form
            applyParsedData(result);

            // Show result feedback
            if (result.confidence > 30) {
                parseResult.innerHTML = `<span class="success">✓ ${result.matched.length}項目を検出しました</span>`;
                showToast('イベント情報を解析しました', 'success');

                // Switch to manual tab to show filled form
                document.querySelectorAll('.input-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.querySelector('[data-tab="manual"]')?.classList.add('active');
                document.getElementById('manual-tab')?.classList.add('active');
            } else {
                parseResult.innerHTML = `<span class="warning">⚠ 一部の項目のみ検出されました</span>`;
                showToast('一部の情報を解析しました。手動で確認してください', 'warning');
            }
        });
    }

    // Event file drop zone
    setupDropZone(DOM.eventDropZone, DOM.eventFileInput, handleEventFile);
    DOM.eventFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleEventFile(e.target.files[0]);
    });

    // Event form submission
    DOM.eventForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveEventInfo();
        goToStep(2);
    });

    // Change event button
    DOM.changeEventBtn.addEventListener('click', () => goToStep(1));

    // Photo drop zone
    setupDropZone(DOM.photoDropZone, DOM.photoFileInput, handlePhotoFile);
    DOM.photoFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handlePhotoFile(e.target.files[0]);
    });

    // Clear input button
    DOM.clearInputBtn.addEventListener('click', clearPhotoInput);

    // Form input listeners for live preview
    const photoFormInputs = [
        DOM.boothName, DOM.boothAccount, DOM.personRole,
        DOM.personName, DOM.personAccount, DOM.aiComment
    ];
    photoFormInputs.forEach(input => {
        input.addEventListener('input', updatePreview);
    });

    // Comment generation (rule-based)
    DOM.generateCommentBtn.addEventListener('click', generateComment);
    DOM.regenerateBtn.addEventListener('click', generateComment);

    // Copy buttons
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', () => copyToClipboard(btn));
    });

    // Send to Make.com
    DOM.sendMakeBtn.addEventListener('click', sendToMake);

    // Next photo
    DOM.nextPhotoBtn.addEventListener('click', nextPhoto);

    // Settings modal
    DOM.openSettingsBtn.addEventListener('click', () => {
        DOM.settingsModal.classList.add('active');
    });
    DOM.closeSettingsBtn.addEventListener('click', () => {
        DOM.settingsModal.classList.remove('active');
    });
    DOM.saveSettingsBtn.addEventListener('click', saveSettings);

    // Close modal on background click
    DOM.settingsModal.addEventListener('click', (e) => {
        if (e.target === DOM.settingsModal) {
            DOM.settingsModal.classList.remove('active');
        }
    });
}

// ========================================
// Drop Zone Setup
// ========================================

function setupDropZone(dropZone, fileInput, handler) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file) handler(file);
    });

    dropZone.addEventListener('click', () => fileInput.click());
}

// ========================================
// Step Navigation
// ========================================

function goToStep(step) {
    AppState.currentStep = step;

    // Update indicators
    DOM.step1Indicator.classList.toggle('active', step === 1);
    DOM.step1Indicator.classList.toggle('completed', step > 1);
    DOM.step2Indicator.classList.toggle('active', step === 2);

    // Update panels
    DOM.step1Panel.classList.toggle('active', step === 1);
    DOM.step2Panel.classList.toggle('active', step === 2);

    // Update event summary
    if (step === 2) {
        updateEventSummary();
    }
}

// ========================================
// Event Info Handling
// ========================================

function handleEventFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        parseEventInfo(e.target.result);
    };
    reader.readAsText(file);
}

function parseEventInfo(content) {
    const lines = content.split('\n');
    const data = {};

    lines.forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
            const value = valueParts.join(':').trim();
            data[key.trim().toLowerCase().replace(/_/g, '')] = value;
        }
    });

    // Map parsed data to form fields
    if (data.eventen) DOM.eventEn.value = data.eventen;
    if (data.eventjp) DOM.eventJp.value = data.eventjp;
    if (data.date) DOM.eventDate.value = data.date;
    if (data.venue) DOM.eventVenue.value = data.venue;
    if (data.category) {
        const categorySelect = DOM.eventCategory;
        for (let option of categorySelect.options) {
            if (option.value === data.category) {
                categorySelect.value = data.category;
                break;
            }
        }
    }
    if (data.hashtags) DOM.eventHashtags.value = data.hashtags;

    showToast('イベント情報を読み込みました', 'success');
}

function saveEventInfo() {
    AppState.eventInfo = {
        eventEn: DOM.eventEn.value,
        eventJp: DOM.eventJp.value,
        date: DOM.eventDate.value,
        venue: DOM.eventVenue.value,
        category: DOM.eventCategory.value,
        hashtags: DOM.eventHashtags.value
    };
}

function updateEventSummary() {
    const { eventEn, eventJp, date, venue } = AppState.eventInfo;
    DOM.summaryEventName.textContent = `${eventEn} – ${eventJp}`;
    DOM.summaryEventMeta.textContent = `${date}｜${venue}`;
}

// ========================================
// Photo Handling
// ========================================

/**
 * 画像を圧縮する
 * @param {string} dataUrl - Base64形式の画像データURL
 * @param {number} maxWidth - 最大幅
 * @param {number} quality - JPEG品質 (0-1)
 * @returns {Promise<string>} 圧縮後のBase64データURL
 */
async function compressImage(dataUrl, maxWidth = 1000, quality = 0.85) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // 圧縮が必要かチェック
            if (img.width <= maxWidth && img.height <= maxWidth) {
                resolve(dataUrl); // 既に小さい場合はそのまま
                return;
            }

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // アスペクト比を維持してリサイズ
            const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = dataUrl;
    });
}

function handlePhotoFile(file) {
    if (!file.type.startsWith('image/')) {
        showToast('画像ファイルを選択してください', 'error');
        return;
    }

    AppState.photoData.imageFile = file;

    // Create preview and compress
    const reader = new FileReader();
    reader.onload = async (e) => {
        // 大きな画像を圧縮
        const compressed = await compressImage(e.target.result);
        AppState.photoData.imageBase64 = compressed;
        DOM.photoPreview.innerHTML = `<img src="${compressed}" alt="Preview">`;

        // 圧縮情報を表示
        const originalSize = (e.target.result.length * 0.75 / 1024).toFixed(0);
        const compressedSize = (compressed.length * 0.75 / 1024).toFixed(0);
        if (compressed !== e.target.result) {
            showToast(`写真を読み込みました (${originalSize}KB → ${compressedSize}KB)`, 'success');
        } else {
            showToast('写真を読み込みました', 'success');
        }
    };
    reader.readAsDataURL(file);
}

function clearPhotoInput() {
    // Clear photo
    AppState.photoData.imageFile = null;
    AppState.photoData.imageBase64 = null;
    DOM.photoPreview.innerHTML = '<span class="photo-placeholder">写真をドロップ</span>';

    // Clear form (but keep booth info)
    DOM.personName.value = '';
    DOM.personAccount.value = '';
    DOM.aiComment.value = '';

    updatePreview();
    showToast('入力をクリアしました', 'success');
}

function nextPhoto() {
    // Clear for next photo but keep event and booth info
    AppState.photoData.imageFile = null;
    AppState.photoData.imageBase64 = null;
    DOM.photoPreview.innerHTML = '<span class="photo-placeholder">写真をドロップ</span>';

    // Clear person info
    DOM.personName.value = '';
    DOM.personAccount.value = '';
    DOM.aiComment.value = '';

    updatePreview();
    showToast('次の写真の準備ができました', 'success');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========================================
// Comment Generation (Netlify Functions + Rule-Based Fallback)
// ========================================

// API URL (Netlify Functions経由)
// ローカル開発時: netlify dev で /.netlify/functions/ が利用可能
// 本番環境: /api/ が /.netlify/functions/ にリダイレクト
const API_BASE_URL = '/.netlify/functions';

/**
 * コメントを生成（FastAPI経由でGemini APIを呼び出し）
 * APIエラー時はルールベースにフォールバック
 */
async function generateComment() {
    // 入力値を取得
    const expressionType = DOM.expressionType?.value || '笑顔';
    const focusPoint = DOM.focusPoint?.value || '表情';
    const contextMatch = DOM.contextMatch?.value || 'ブースの雰囲気';
    const role = DOM.personRole?.value || 'モデル';
    const boothName = DOM.boothName?.value || 'ブース';
    const category = AppState.eventInfo?.category || 'ブース';
    const imageBase64 = AppState.photoData?.imageBase64 || null;

    console.log('Generating comment with:', { expressionType, focusPoint, contextMatch, role });

    // ボタンを無効化
    DOM.generateCommentBtn.disabled = true;
    DOM.regenerateBtn.disabled = true;
    DOM.generateCommentBtn.innerHTML = '<span class="btn-icon">⏳</span> 生成中...';

    try {
        // FastAPI バックエンドを呼び出し
        const response = await fetch(`${API_BASE_URL}/generate-comment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                booth_name: boothName,
                role: role,
                category: category,
                expression_type: expressionType,
                focus_point: focusPoint,
                context_match: contextMatch,
                image_base64: imageBase64
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        DOM.aiComment.value = data.comment;
        updatePreview();

        if (data.source === 'ai') {
            showToast('AIでコメントを生成しました', 'success');
        } else {
            showToast('ルールベースでコメントを生成しました', 'success');
        }

    } catch (error) {
        console.error('API call failed:', error);

        // フォールバック: ルールベースで生成
        const comment = generateRuleBasedComment({
            expressionType: expressionType,
            focusPoint: focusPoint,
            contextMatch: contextMatch,
            role: role
        });

        DOM.aiComment.value = comment;
        updatePreview();
        showToast('ルールベースでコメントを生成しました（API接続エラー）', 'warning');
    } finally {
        // ボタンを再有効化
        DOM.generateCommentBtn.disabled = false;
        DOM.regenerateBtn.disabled = false;
        DOM.generateCommentBtn.innerHTML = '<span class="btn-icon">✨</span> コメント生成';
    }
}

// ========================================
// Post Template Generation
// ========================================

function generatePostTemplates() {
    const event = AppState.eventInfo;
    const boothName = DOM.boothName.value || '';
    const boothAccount = DOM.boothAccount.value || '';
    const personRole = DOM.personRole.value || 'モデル';
    const personName = DOM.personName.value || '';
    const personAccount = DOM.personAccount.value || '';
    const aiComment = DOM.aiComment.value || '';
    const hashtags = event.hashtags || '';

    // Extract main hashtag for X2
    const hashtagsArray = hashtags.split(' ').filter(h => h.startsWith('#'));
    const mainHashtag = hashtagsArray[0] || '';

    // X Account 1 (Full template)
    const x1 = `📸 ${event.eventEn} – ${event.eventJp}
${event.date}｜${event.venue}

◼︎ ${event.category}
${boothName}${boothAccount ? `（${boothAccount}）` : ''}

◼︎ ${personRole}
${personName ? `${personName} さん` : '※お名前調査中'}
${personAccount}

${aiComment}

${hashtags}`.trim();

    // X Account 2 (Simplified)
    const x2 = `📸 ${event.eventEn}
${event.date}｜${event.venue}

${boothName}
${personName ? `${personName} さん` : ''} ${personAccount}

${aiComment}

${mainHashtag}`.trim();

    // Instagram (Visual focus, more hashtags)
    const igHashtags = hashtags + ' #portrait #ポートレート #eventphoto';
    const ig = `📸 ${event.eventEn} – ${event.eventJp}

${boothName}
${personName ? `${personName} さん` : ''}

${aiComment}

${igHashtags}`.trim();

    return { x1, x2, ig };
}

function updatePreview() {
    const templates = generatePostTemplates();
    DOM.previewX1.textContent = templates.x1;
    DOM.previewX2.textContent = templates.x2;
    DOM.previewIg.textContent = templates.ig;
}

// ========================================
// Copy to Clipboard
// ========================================

async function copyToClipboard(button) {
    const targetId = button.dataset.target;
    const content = document.getElementById(targetId).textContent;

    try {
        await navigator.clipboard.writeText(content);

        // Visual feedback
        const originalText = button.textContent;
        button.textContent = '✓ コピーしました';
        button.classList.add('copied');

        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);

    } catch (error) {
        showToast('コピーに失敗しました', 'error');
    }
}

// ========================================
// Make.com Integration
// ========================================

async function sendToMake() {
    const webhookUrl = AppState.settings.makeWebhookUrl;

    if (!webhookUrl) {
        showToast('Make.com Webhook URLを設定してください', 'error');
        DOM.settingsModal.classList.add('active');
        return;
    }

    const templates = generatePostTemplates();

    const payload = {
        timestamp: new Date().toISOString(),
        event: AppState.eventInfo,
        photo: {
            name: AppState.photoData.imageFile?.name || 'unknown',
            base64: AppState.photoData.imageBase64
        },
        person: {
            name: DOM.personName.value,
            role: DOM.personRole.value,
            account: DOM.personAccount.value
        },
        booth: {
            name: DOM.boothName.value,
            account: DOM.boothAccount.value
        },
        posts: {
            x1: templates.x1,
            x2: templates.x2,
            instagram: templates.ig
        }
    };

    DOM.sendMakeBtn.disabled = true;
    DOM.sendMakeBtn.innerHTML = '⏳ 送信中...';

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            showToast('Make.comに送信しました！', 'success');
        } else {
            throw new Error('Webhook request failed');
        }

    } catch (error) {
        console.error('Make.com error:', error);
        showToast('送信に失敗しました。Webhook URLを確認してください', 'error');
    } finally {
        DOM.sendMakeBtn.disabled = false;
        DOM.sendMakeBtn.innerHTML = '📤 Make.comへ送信';
    }
}

// ========================================
// Toast Notifications
// ========================================

function showToast(message, type = 'info') {
    DOM.toast.textContent = message;
    DOM.toast.className = `toast show ${type}`;

    setTimeout(() => {
        DOM.toast.classList.remove('show');
    }, 3000);
}
