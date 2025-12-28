/**
 * Focus Manager
 * スマートフォーカス管理 - オートコンプリート選択後の次フィールド移動、
 * Enter押下での次フィールド移動、モーダル開時の最初の空フィールドフォーカス
 * Requirements: 13.1, 13.2, 13.3
 */

/**
 * FocusManager クラス
 * フォーカス管理とフィールド間のナビゲーションを制御
 */
class FocusManager {
    constructor() {
        this.fieldOrder = [
            'edit-booth-name',
            'edit-booth-account',
            'edit-person-role',
            'edit-person-name',
            'edit-person-account',
            'edit-expression-type',
            'edit-ai-comment'
        ];

        this.textareaFields = ['edit-ai-comment'];
        this.initialized = false;
    }

    /**
     * フォーカス管理を初期化
     */
    initialize() {
        if (this.initialized) return;

        this._setupEnterKeyNavigation();
        this._setupAutocompleteListeners();

        this.initialized = true;
        console.log('[FocusManager] Initialized');
    }

    /**
     * Enterキーでの次フィールド移動を設定
     * @private
     */
    _setupEnterKeyNavigation() {
        this.fieldOrder.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;

            // textareaは除外（複数行入力が必要）
            if (this.textareaFields.includes(fieldId)) return;

            field.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.moveToNextField(fieldId);
                }
            });
        });
    }

    /**
     * オートコンプリート選択後のフォーカス移動を設定
     * @private
     */
    _setupAutocompleteListeners() {
        this.fieldOrder.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field) return;

            // オートコンプリート選択イベントをリッスン
            field.addEventListener('autocomplete:select', (e) => {
                // 少し遅延させて、値が確実に設定された後に移動
                setTimeout(() => {
                    this.moveToNextField(fieldId);
                }, 50);
            });
        });
    }

    /**
     * 次のフィールドにフォーカスを移動
     * @param {string} currentFieldId - 現在のフィールドID
     */
    moveToNextField(currentFieldId) {
        const currentIndex = this.fieldOrder.indexOf(currentFieldId);
        if (currentIndex === -1 || currentIndex === this.fieldOrder.length - 1) {
            return; // 最後のフィールドまたは不明なフィールド
        }

        // 次の空フィールドを探す
        for (let i = currentIndex + 1; i < this.fieldOrder.length; i++) {
            const nextFieldId = this.fieldOrder[i];
            const nextField = document.getElementById(nextFieldId);

            if (nextField && this._isEmpty(nextField)) {
                this._focusField(nextField);
                return;
            }
        }

        // 空フィールドがない場合は、単純に次のフィールドにフォーカス
        const nextFieldId = this.fieldOrder[currentIndex + 1];
        const nextField = document.getElementById(nextFieldId);
        if (nextField) {
            this._focusField(nextField);
        }
    }

    /**
     * モーダルが開いたときに最初の空フィールドにフォーカス
     */
    focusFirstEmptyField() {
        for (const fieldId of this.fieldOrder) {
            const field = document.getElementById(fieldId);

            if (field && this._isEmpty(field)) {
                // 少し遅延させてモーダルのアニメーションが完了してからフォーカス
                setTimeout(() => {
                    this._focusField(field);
                }, 100);
                return;
            }
        }

        // 全てのフィールドが埋まっている場合は、最初のフィールドにフォーカス
        const firstField = document.getElementById(this.fieldOrder[0]);
        if (firstField) {
            setTimeout(() => {
                this._focusField(firstField);
            }, 100);
        }
    }

    /**
     * フィールドが空かどうかをチェック
     * @private
     * @param {HTMLElement} field - チェックするフィールド
     * @returns {boolean} 空の場合true
     */
    _isEmpty(field) {
        if (!field) return true;

        if (field.tagName === 'SELECT') {
            // selectの場合、値が空文字列または未選択
            return !field.value || field.value === '';
        } else if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
            // input/textareaの場合、値が空またはホワイトスペースのみ
            return !field.value || field.value.trim() === '';
        }

        return true;
    }

    /**
     * フィールドにフォーカスを設定
     * @private
     * @param {HTMLElement} field - フォーカスするフィールド
     */
    _focusField(field) {
        if (!field) return;

        field.focus();

        // inputまたはtextareaの場合、カーソルを末尾に移動
        if (field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
            const length = field.value.length;
            field.setSelectionRange(length, length);
        }

        // フィールドをスクロールして表示
        field.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
    }

    /**
     * 特定のフィールドにフォーカス
     * @param {string} fieldId - フィールドID
     */
    focusField(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            this._focusField(field);
        }
    }

    /**
     * クリーンアップ
     */
    destroy() {
        this.initialized = false;
        console.log('[FocusManager] Destroyed');
    }
}

// Export for use in other modules
export { FocusManager };

// Browser global
if (typeof window !== 'undefined') {
    window.FocusManager = FocusManager;
}
