// Popup script for Web2MD extension

class Web2MDPopup {
    constructor() {
        this.currentMarkdown = '';
        this.currentTitle = '';
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateUI('ready');
    }

    bindEvents() {
        // Convert button
        document.getElementById('convertBtn').addEventListener('click', () => {
            this.convertToMarkdown();
        });

        // Copy button
        document.getElementById('copyBtn').addEventListener('click', () => {
            this.copyToClipboard();
        });

        // Download button
        document.getElementById('downloadBtn').addEventListener('click', () => {
            this.downloadMarkdown();
        });

        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'conversionComplete') {
                this.handleConversionComplete(message.data);
            } else if (message.type === 'conversionError') {
                this.handleConversionError(message.error);
            }
        });
    }

    async convertToMarkdown() {
        try {
            this.updateUI('loading');
            
            // Get current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                throw new Error('没有找到活动标签页');
            }

            // Get conversion options
            const options = this.getConversionOptions();
            
            // Send message to content script
            chrome.tabs.sendMessage(tab.id, {
                type: 'convertToMarkdown',
                options: options
            });

        } catch (error) {
            console.error('Conversion failed:', error);
            this.handleConversionError(error.message);
        }
    }

    getConversionOptions() {
        return {
            includeImages: document.getElementById('includeImages').checked,
            includeLinks: document.getElementById('includeLinks').checked,
            smartExtraction: document.getElementById('smartExtraction').checked
        };
    }

    handleConversionComplete(data) {
        this.currentMarkdown = data.markdown;
        this.currentTitle = data.title;
        
        this.updateUI('success');
        this.showPreview(data.markdown);
        this.showActionButtons();
    }

    handleConversionError(error) {
        console.error('Conversion error:', error);
        this.updateUI('error', error);
    }

    updateUI(state, message = '') {
        const statusEl = document.getElementById('status');
        const statusText = statusEl.querySelector('.status-text');
        const convertBtn = document.getElementById('convertBtn');

        // Reset status classes
        statusEl.className = 'status';
        
        switch (state) {
            case 'ready':
                statusText.textContent = '准备转换';
                convertBtn.disabled = false;
                convertBtn.innerHTML = '<span class="btn-icon">📄</span> 转换为 Markdown';
                break;
                
            case 'loading':
                statusEl.classList.add('loading');
                statusText.innerHTML = '<span class="loading-spinner"></span> 正在转换网页...';
                convertBtn.disabled = true;
                convertBtn.innerHTML = '<span class="btn-icon">⏳</span> 转换中...';
                break;
                
            case 'success':
                statusEl.classList.add('success');
                statusText.textContent = '转换成功完成！';
                convertBtn.disabled = false;
                convertBtn.innerHTML = '<span class="btn-icon">🔄</span> 再次转换';
                break;
                
            case 'error':
                statusEl.classList.add('error');
                statusText.textContent = message || '转换失败，请重试。';
                convertBtn.disabled = false;
                convertBtn.innerHTML = '<span class="btn-icon">📄</span> 转换为 Markdown';
                break;
        }
    }

    showPreview(markdown) {
        const previewEl = document.getElementById('preview');
        const contentEl = document.getElementById('markdownContent');
        
        // Show preview with truncated content
        const truncatedMarkdown = markdown.length > 500 
            ? markdown.substring(0, 500) + '...' 
            : markdown;
            
        contentEl.textContent = truncatedMarkdown;
        previewEl.style.display = 'block';
    }

    showActionButtons() {
        const actionButtonsEl = document.getElementById('actionButtons');
        actionButtonsEl.style.display = 'block';
    }

    async copyToClipboard() {
        const copyBtn = document.getElementById('copyBtn');
        const originalHTML = copyBtn.innerHTML;
        
        try {
            await navigator.clipboard.writeText(this.currentMarkdown);
            
            // 更新按钮显示成功状态
            copyBtn.innerHTML = '<span class="btn-icon">✅</span> 已复制！';
            copyBtn.classList.add('success');
            
            // 2秒后恢复原状
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.classList.remove('success');
            }, 2000);
            
            this.showTemporaryMessage('已复制到剪贴板！');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = this.currentMarkdown;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                // 同样显示成功状态
                copyBtn.innerHTML = '<span class="btn-icon">✅</span> 已复制！';
                copyBtn.classList.add('success');
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.classList.remove('success');
                }, 2000);
                
                this.showTemporaryMessage('已复制到剪贴板！');
            } catch (fallbackError) {
                // 显示错误状态
                copyBtn.innerHTML = '<span class="btn-icon">❌</span> 复制失败';
                copyBtn.classList.add('error');
                
                setTimeout(() => {
                    copyBtn.innerHTML = originalHTML;
                    copyBtn.classList.remove('error');
                }, 2000);
                
                this.showTemporaryMessage('复制到剪贴板失败', 'error');
            }
        }
    }

    downloadMarkdown() {
        try {
            // Create filename from page title
            const filename = this.sanitizeFilename(this.currentTitle || '网页') + '.md';
            
            // Create blob and download
            const blob = new Blob([this.currentMarkdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            
            chrome.downloads.download({
                url: url,
                filename: filename,
                saveAs: true
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error('Download failed:', chrome.runtime.lastError);
                    this.showTemporaryMessage('下载失败', 'error');
                } else {
                    this.showTemporaryMessage('开始下载！');
                }
                URL.revokeObjectURL(url);
            });
        } catch (error) {
            console.error('Download failed:', error);
            this.showTemporaryMessage('Download failed', 'error');
        }
    }

    sanitizeFilename(filename) {
        // Remove or replace invalid characters
        return filename
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 100)
            .toLowerCase();
    }

    showTemporaryMessage(message, type = 'success') {
        const originalState = document.getElementById('status').className;
        const originalText = document.getElementById('status').querySelector('.status-text').textContent;
        
        this.updateUI(type, message);
        
        setTimeout(() => {
            if (this.currentMarkdown) {
                this.updateUI('success');
            } else {
                this.updateUI('ready');
            }
        }, 2000);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Web2MDPopup();
});

// Handle popup closing
window.addEventListener('beforeunload', () => {
    // Cleanup if needed
});