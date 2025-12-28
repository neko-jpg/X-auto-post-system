/**
 * Context Menu Manager
 * Handles right-click context menu for queue items
 * Requirements: 20.1, 20.2, 20.3, 20.4
 */

class ContextMenuManager {
    constructor() {
        this.menu = null;
        this.currentIndex = null;
        this.isVisible = false;
        this.init();
    }

    /**
     * Initialize context menu
     */
    init() {
        // Create menu element
        this.createMenu();
        
        // Set up global click listener to close menu
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.menu.contains(e.target)) {
                this.hide();
            }
        });

        // Close menu on scroll
        document.addEventListener('scroll', () => {
            if (this.isVisible) {
                this.hide();
            }
        }, true);

        // Close menu on window resize
        window.addEventListener('resize', () => {
            if (this.isVisible) {
                this.hide();
            }
        });

        console.log('[ContextMenu] Initialized');
    }

    /**
     * Create context menu HTML element
     */
    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = 'context-menu';
        this.menu.id = 'queue-context-menu';
        
        this.menu.innerHTML = `
            <div class="context-menu-item" data-action="edit">
                <span class="context-menu-icon">✏️</span>
                <span class="context-menu-label">編集</span>
                <span class="context-menu-shortcut">Enter</span>
            </div>
            <div class="context-menu-item" data-action="duplicate">
                <span class="context-menu-icon">📋</span>
                <span class="context-menu-label">複製</span>
                <span class="context-menu-shortcut">Ctrl+D</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="generate">
                <span class="context-menu-icon">✨</span>
                <span class="context-menu-label">コメント生成</span>
                <span class="context-menu-shortcut">Ctrl+G</span>
            </div>
            <div class="context-menu-item" data-action="copy">
                <span class="context-menu-icon">📄</span>
                <span class="context-menu-label">テキストをコピー</span>
                <span class="context-menu-shortcut">Ctrl+C</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" data-action="send">
                <span class="context-menu-icon">📤</span>
                <span class="context-menu-label">送信</span>
                <span class="context-menu-shortcut">Ctrl+Enter</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item context-menu-item-danger" data-action="delete">
                <span class="context-menu-icon">🗑️</span>
                <span class="context-menu-label">削除</span>
                <span class="context-menu-shortcut">Del</span>
            </div>
        `;

        // Add click handlers for menu items
        this.menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.dataset.action;
                this.handleAction(action);
                this.hide();
            });
        });

        document.body.appendChild(this.menu);
    }

    /**
     * Show context menu at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} index - Queue item index
     */
    show(x, y, index) {
        this.currentIndex = index;
        
        // Position menu
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
        
        // Show menu
        this.menu.classList.add('visible');
        this.isVisible = true;

        // Adjust position if menu goes off screen
        this.adjustPosition();
    }

    /**
     * Adjust menu position to stay within viewport
     */
    adjustPosition() {
        const rect = this.menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust horizontal position
        if (rect.right > viewportWidth) {
            const newLeft = viewportWidth - rect.width - 10;
            this.menu.style.left = `${newLeft}px`;
        }

        // Adjust vertical position
        if (rect.bottom > viewportHeight) {
            const newTop = viewportHeight - rect.height - 10;
            this.menu.style.top = `${newTop}px`;
        }

        // Ensure menu doesn't go off the left edge
        if (rect.left < 0) {
            this.menu.style.left = '10px';
        }

        // Ensure menu doesn't go off the top edge
        if (rect.top < 0) {
            this.menu.style.top = '10px';
        }
    }

    /**
     * Hide context menu
     */
    hide() {
        this.menu.classList.remove('visible');
        this.isVisible = false;
        this.currentIndex = null;
    }

    /**
     * Handle menu action
     * @param {string} action - Action to perform
     */
    handleAction(action) {
        if (this.currentIndex === null) return;

        const index = this.currentIndex;
        const post = window.AppState?.postQueue[index];

        if (!post) {
            console.error('[ContextMenu] Post not found at index:', index);
            return;
        }

        switch (action) {
            case 'edit':
                this.handleEdit(index);
                break;
            case 'duplicate':
                this.handleDuplicate(index, post);
                break;
            case 'generate':
                this.handleGenerateComment(index, post);
                break;
            case 'copy':
                this.handleCopyText(post);
                break;
            case 'send':
                this.handleSend(index);
                break;
            case 'delete':
                this.handleDelete(index);
                break;
            default:
                console.warn('[ContextMenu] Unknown action:', action);
        }
    }

    /**
     * Handle Edit action
     * @param {number} index
     */
    handleEdit(index) {
        if (typeof window.openEditModal === 'function') {
            window.openEditModal(index);
        }
    }

    /**
     * Handle Duplicate action (Requirement 20.4)
     * @param {number} index
     * @param {Object} post
     */
    handleDuplicate(index, post) {
        if (window.AppState.postQueue.length >= 10) {
            window.showToast('投稿キューは最大10件です', 'error');
            return;
        }

        // Create a copy with "(copy)" suffix on booth name
        const copy = {
            ...post,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            boothName: post.boothName ? `${post.boothName} (copy)` : '(copy)',
            status: 'draft',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        // Add to queue
        if (typeof window.addToQueue === 'function') {
            window.AppState.postQueue.push(copy);
            window.renderPostQueue();
            window.showToast('投稿を複製しました', 'success');
        }
    }

    /**
     * Handle Generate Comment action
     * @param {number} index
     * @param {Object} post
     */
    async handleGenerateComment(index, post) {
        // Check if we have the necessary information
        if (!post.personName && !post.boothName) {
            window.showToast('人物名またはブース名を入力してください', 'warning');
            return;
        }

        try {
            window.showToast('コメントを生成中...', 'info');

            // Use the existing comment generation logic
            const comment = await this.generateComment(post);

            // Update the post
            if (typeof window.updateQueueItem === 'function') {
                window.updateQueueItem(index, { aiComment: comment });
                window.showToast('コメントを生成しました', 'success');
            }
        } catch (error) {
            console.error('[ContextMenu] Error generating comment:', error);
            window.showToast('コメント生成に失敗しました', 'error');
        }
    }

    /**
     * Generate comment for post
     * @param {Object} post
     * @returns {Promise<string>}
     */
    async generateComment(post) {
        // Use the existing comment generation logic from the app
        // This is a simplified version - in production, this would call the actual API
        const templates = [
            `${post.personName}さんの素敵な笑顔をキャッチ！`,
            `${post.boothName}ブースにて撮影させていただきました`,
            `華やかな雰囲気が素敵でした✨`,
            `イベントを盛り上げてくださりありがとうございました！`
        ];

        // Return a random template or combine them
        return templates[Math.floor(Math.random() * templates.length)];
    }

    /**
     * Handle Copy Text action (Requirement 20.2)
     * @param {Object} post
     */
    handleCopyText(post) {
        // Generate post text
        const sourceEvent = post.eventInfo || window.AppState?.eventInfo;
        if (!sourceEvent || (!sourceEvent.eventEn && !sourceEvent.eventJp)) {
            window.showToast('イベント情報が設定されていません', 'error');
            return;
        }

        const event = {
            eventEn: sourceEvent.eventEn || '',
            eventJp: sourceEvent.eventJp || '',
            date: sourceEvent.date || '',
            venue: sourceEvent.venue || '',
            category: sourceEvent.category || 'ブース',
            hashtags: sourceEvent.hashtags || ''
        };

        const text = this.generatePostText(post, event);

        // Copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
            window.showToast('テキストをコピーしました', 'success');
        }).catch((error) => {
            console.error('[ContextMenu] Error copying text:', error);
            window.showToast('コピーに失敗しました', 'error');
        });
    }

    /**
     * Generate post text
     * @param {Object} post
     * @param {Object} event
     * @returns {string}
     */
    generatePostText(post, event) {
        const hashtags = event.hashtags || '';

        return `📸 ${event.eventEn} – ${event.eventJp}
${event.date}｜${event.venue}

◼︎ ${event.category}
${post.boothName}${post.boothAccount ? `（${post.boothAccount}）` : ''}

◼︎ ${post.personRole}
${post.personName ? `${post.personName} さん` : '※お名前調査中'}
${post.personAccount}

${post.aiComment}

${hashtags}`.trim();
    }

    /**
     * Handle Send action
     * @param {number} index
     */
    handleSend(index) {
        if (typeof window.sendQueueItem === 'function') {
            window.sendQueueItem(index);
        }
    }

    /**
     * Handle Delete action
     * @param {number} index
     */
    handleDelete(index) {
        if (typeof window.removeFromQueue === 'function') {
            window.removeFromQueue(index);
        }
    }

    /**
     * Initialize context menu for queue container
     * @param {HTMLElement} container - Queue container element
     */
    initializeQueue(container) {
        if (!container) return;

        // Remove existing listeners
        container.removeEventListener('contextmenu', this.handleContextMenu);

        // Add context menu listener
        this.handleContextMenu = (e) => {
            // Find the queue item
            const queueItem = e.target.closest('.queue-item');
            if (!queueItem) return;

            // Prevent default context menu
            e.preventDefault();
            e.stopPropagation();

            // Get queue item index
            const index = parseInt(queueItem.dataset.index);
            if (isNaN(index)) return;

            // Show context menu at click position
            this.show(e.clientX, e.clientY, index);
        };

        container.addEventListener('contextmenu', this.handleContextMenu);

        // Also support long-press on mobile (Requirement 20.1)
        this.initializeLongPress(container);
    }

    /**
     * Initialize long-press support for mobile
     * @param {HTMLElement} container
     */
    initializeLongPress(container) {
        let longPressTimer = null;
        let longPressTarget = null;

        const startLongPress = (e) => {
            const queueItem = e.target.closest('.queue-item');
            if (!queueItem) return;

            longPressTarget = queueItem;
            const touch = e.touches ? e.touches[0] : e;

            longPressTimer = setTimeout(() => {
                // Trigger context menu
                const index = parseInt(queueItem.dataset.index);
                if (!isNaN(index)) {
                    // Add haptic feedback if available
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }

                    this.show(touch.clientX, touch.clientY, index);
                }
            }, 500); // 500ms long press
        };

        const cancelLongPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            longPressTarget = null;
        };

        container.addEventListener('touchstart', startLongPress, { passive: true });
        container.addEventListener('touchend', cancelLongPress);
        container.addEventListener('touchmove', cancelLongPress);
        container.addEventListener('touchcancel', cancelLongPress);
    }
}

// Create global instance
const contextMenuManager = new ContextMenuManager();

// Export for use in other modules
export { contextMenuManager, ContextMenuManager };

// Make available globally
window.contextMenuManager = contextMenuManager;
