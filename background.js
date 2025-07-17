// Background script for Web2MD extension

class Web2MDBackground {
    constructor() {
        this.init();
    }

    init() {
        // Handle extension installation
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        // Handle messages from popup and content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Handle extension icon click
        chrome.action.onClicked.addListener(async (tab) => {
            console.log('Extension icon clicked for tab:', tab.url);
        });
    }

    handleInstallation(details) {
        if (details.reason === 'install') {
            console.log('Web2MD extension installed');
            this.showWelcomeNotification();
        } else if (details.reason === 'update') {
            console.log('Web2MD extension updated to version', chrome.runtime.getManifest().version);
        }
    }

    showWelcomeNotification() {
        // Show a welcome notification (optional)
        if (chrome.notifications) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: 'Web2MD Installed',
                message: 'Click the extension icon to convert any webpage to Markdown!'
            });
        }
    }

    handleMessage(message, sender, sendResponse) {
        switch (message.type) {
            case 'downloadMarkdown':
                this.handleDownloadMarkdown(message, sendResponse);
                break;
                
            case 'getTabInfo':
                this.handleGetTabInfo(message, sendResponse);
                break;
                
            case 'logError':
                console.error('Web2MD Error:', message.error);
                break;
                
            default:
                console.log('Unhandled message type:', message.type);
        }
    }

    async handleDownloadMarkdown(message, sendResponse) {
        try {
            const { markdown, filename, title } = message;
            
            // Create blob URL
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            
            // Generate filename
            const sanitizedFilename = this.sanitizeFilename(filename || title || 'webpage') + '.md';
            
            // Start download
            const downloadId = await chrome.downloads.download({
                url: url,
                filename: sanitizedFilename,
                saveAs: true
            });
            
            // Clean up blob URL after download starts
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
            
            sendResponse({
                success: true,
                downloadId: downloadId
            });
            
        } catch (error) {
            console.error('Download failed:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }

    async handleGetTabInfo(message, sendResponse) {
        try {
            const [activeTab] = await chrome.tabs.query({ 
                active: true, 
                currentWindow: true 
            });
            
            sendResponse({
                success: true,
                tab: {
                    id: activeTab.id,
                    url: activeTab.url,
                    title: activeTab.title,
                    favIconUrl: activeTab.favIconUrl
                }
            });
            
        } catch (error) {
            console.error('Failed to get tab info:', error);
            sendResponse({
                success: false,
                error: error.message
            });
        }
    }

    handleContextMenuClick(info, tab) {
        // Handle context menu actions if we implement them
        switch (info.menuItemId) {
            case 'convert-page':
                this.convertCurrentPage(tab);
                break;
            case 'convert-selection':
                this.convertSelection(info, tab);
                break;
        }
    }

    async convertCurrentPage(tab) {
        try {
            // Send message to content script to convert page
            chrome.tabs.sendMessage(tab.id, {
                type: 'convertToMarkdown',
                options: {
                    includeImages: true,
                    includeLinks: true,
                    smartExtraction: true
                }
            });
        } catch (error) {
            console.error('Failed to convert page:', error);
        }
    }

    async convertSelection(info, tab) {
        try {
            // Send message to content script to convert selected text
            chrome.tabs.sendMessage(tab.id, {
                type: 'convertSelection',
                selectionText: info.selectionText
            });
        } catch (error) {
            console.error('Failed to convert selection:', error);
        }
    }

    sanitizeFilename(filename) {
        // Remove or replace invalid characters for filenames
        return filename
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 100)
            .toLowerCase()
            .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes
    }

    // Utility method to check if content script is ready
    async isContentScriptReady(tabId) {
        try {
            const response = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
            return response && response.ready;
        } catch (error) {
            return false;
        }
    }

    // Utility method to inject content script if needed
    async ensureContentScript(tabId) {
        const isReady = await this.isContentScriptReady(tabId);
        
        if (!isReady) {
            try {
                await chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    files: ['libs/readability.js', 'libs/turndown.js', 'content.js']
                });
            } catch (error) {
                console.error('Failed to inject content script:', error);
                throw error;
            }
        }
    }
}

// Initialize background script
new Web2MDBackground();