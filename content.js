// Content script for Web2MD extension

class Web2MDConverter {
    constructor() {
        this.turndownService = null;
        this.readability = null;
        this.init();
    }

    init() {
        // Initialize TurndownService when available
        if (typeof TurndownService !== 'undefined') {
            this.turndownService = new TurndownService({
                headingStyle: 'atx',
                hr: '---',
                bulletListMarker: '-',
                codeBlockStyle: 'fenced',
                fence: '```',
                emDelimiter: '*',
                strongDelimiter: '**',
                linkStyle: 'inlined',
                linkReferenceStyle: 'full',
                blankReplacement: function(content, node) {
                    return node.isBlock ? '\n\n' : '';
                }
            });
            
            // Add custom rules
            this.addCustomRules();
        }

        // Listen for messages from popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'convertToMarkdown') {
                // 直接调用转换方法，不使用sendResponse
                // 因为我们通过chrome.runtime.sendMessage发送结果
                this.convertPageToMarkdown(message.options);
                // 不返回true，因为我们不使用sendResponse
            } else if (message.type === 'ping') {
                sendResponse({ ready: true });
                // ping是同步的，不需要返回true
            }
        });
    }

    addCustomRules() {
        // 首先确保Turndown不会跳过表格
        const originalIsBlank = this.turndownService.isBlank;
        this.turndownService.isBlank = function(node) {
            if (node.nodeName === 'TABLE') {
                return false;
            }
            return originalIsBlank.call(this, node);
        };

        // 处理表格 - 最高优先级
        this.turndownService.addRule('tables', {
            filter: ['table'],
            replacement: function(content, node, options) {
                return '\n\n' + this.processTable(node) + '\n\n';
            }.bind(this)
        });

        // 忽略表格内部结构元素，让表格规则统一处理
        this.turndownService.addRule('tableStructure', {
            filter: ['thead', 'tbody', 'tfoot'],
            replacement: function(content) {
                return content;
            }
        });

        // 忽略tr元素，让表格规则统一处理
        this.turndownService.addRule('tableRow', {
            filter: ['tr'],
            replacement: function(content) {
                return content;
            }
        });

        // 忽略td/th元素，让表格规则统一处理
        this.turndownService.addRule('tableCell', {
            filter: ['td', 'th'],
            replacement: function(content) {
                return content;
            }
        });

        // Custom rule for code blocks
        this.turndownService.addRule('codeBlock', {
            filter: ['pre'],
            replacement: (content, node) => {
                const language = node.querySelector('code')?.className?.match(/language-(\w+)/)?.[1] || '';
                return `\n\`\`\`${language}\n${content}\n\`\`\`\n\n`;
            }
        });

        // Custom rule for images
        this.turndownService.addRule('images', {
            filter: 'img',
            replacement: (content, node) => {
                const alt = node.getAttribute('alt') || '';
                const src = node.getAttribute('src') || '';
                const title = node.getAttribute('title') || '';
                
                if (!src) return '';
                
                // Convert relative URLs to absolute
                const absoluteSrc = new URL(src, window.location.href).href;
                
                return title 
                    ? `![${alt}](${absoluteSrc} "${title}")` 
                    : `![${alt}](${absoluteSrc})`;
            }
        });
    }

    // 处理表格的核心方法
    processTable(tableNode) {
        // console.log('Processing table:', tableNode);
        const rows = Array.from(tableNode.querySelectorAll('tr'));
        if (rows.length === 0) return '';

        let result = '';
        let columnCount = 0;
        
        // 确定最大列数
        rows.forEach(row => {
            const cells = row.querySelectorAll('td, th');
            columnCount = Math.max(columnCount, cells.length);
        });

        // 处理每一行
        rows.forEach((row, rowIndex) => {
            const cells = Array.from(row.querySelectorAll('td, th'));
            if (cells.length === 0) return;
            
            // 构建行内容
            const rowData = [];
            for (let i = 0; i < columnCount; i++) {
                if (i < cells.length) {
                    // 处理单元格内容，包括嵌套的HTML
                    let cellContent = this.processCellContent(cells[i]);
                    // 清理换行和多余空格
                    cellContent = cellContent.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
                    // 转义管道符
                    cellContent = cellContent.replace(/\|/g, '\\|');
                    rowData.push(cellContent || ' ');
                } else {
                    rowData.push(' ');
                }
            }
            
            result += '| ' + rowData.join(' | ') + ' |\n';
            
            // 在第一行后添加分隔符
            if (rowIndex === 0) {
                const separator = new Array(columnCount).fill('---');
                result += '| ' + separator.join(' | ') + ' |\n';
            }
        });

        // console.log('Table result:', result);
        return result;
    }

    // 处理单元格内容，保留格式
    processCellContent(cell) {
        // 克隆单元格以避免修改原始DOM
        const cellClone = cell.cloneNode(true);
        
        // 如果单元格内有复杂内容（如嵌套的div、列表等），需要递归处理
        const hasComplexContent = cellClone.querySelector('div, p, ul, ol, h1, h2, h3, h4, h5, h6');
        
        if (hasComplexContent) {
            // 使用Turndown转换单元格内的HTML
            const cellHtml = cellClone.innerHTML;
            return this.turndownService.turndown(cellHtml);
        } else {
            // 简单文本内容
            return cellClone.textContent || '';
        }
    }
    
    // Helper method to extract text from elements with nested content
    getTextFromElement(element) {
        let text = '';
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        let node;
        while (node = walker.nextNode()) {
            text += node.textContent;
        }
        
        return text;
    }

    async convertPageToMarkdown(options = {}) {
        try {
            let contentToConvert;
            let title = document.title;

            // 强制使用手动提取，避免Readability过滤内容
            if (options.smartExtraction && typeof Readability !== 'undefined' && false) {
                // 暂时禁用Readability，因为它可能过滤掉表格
                contentToConvert = this.extractMainContent();
            } else {
                // 使用手动提取
                contentToConvert = this.extractContentManually();
            }

            if (!contentToConvert) {
                throw new Error('未找到可转换的内容');
            }

            // 调试代码（生产环境可注释）
            // const tables = contentToConvert.querySelectorAll('table');
            // console.log(`Found ${tables.length} tables in content`);

            // Apply options
            if (!options.includeImages) {
                this.removeImages(contentToConvert);
            }

            if (!options.includeLinks) {
                this.removeLinks(contentToConvert);
            }

            // Convert to markdown
            let markdown = '';
            
            if (this.turndownService) {
                // console.log('Converting with TurndownService');
                markdown = this.turndownService.turndown(contentToConvert);
            } else {
                // Fallback basic conversion
                // console.log('Using fallback conversion');
                markdown = this.basicHtmlToMarkdown(contentToConvert);
            }

            // Clean up markdown
            markdown = this.cleanMarkdown(markdown);

            // Add title if available
            if (title) {
                markdown = `# ${title}\n\n${markdown}`;
            }

            // Send result back to popup
            chrome.runtime.sendMessage({
                type: 'conversionComplete',
                data: {
                    markdown: markdown,
                    title: title,
                    url: window.location.href
                }
            });

        } catch (error) {
            console.error('Conversion failed:', error);
            chrome.runtime.sendMessage({
                type: 'conversionError',
                error: error.message
            });
        }
    }

    extractMainContent() {
        try {
            // Clone document to avoid modifying original
            const documentClone = document.cloneNode(true);
            
            // Use Readability to extract main content
            const reader = new Readability(documentClone);
            const article = reader.parse();
            
            if (article && article.content) {
                // Create a temporary div to hold the content
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = article.content;
                return tempDiv;
            }
        } catch (error) {
            console.warn('Readability extraction failed:', error);
        }
        
        // Fallback to manual extraction
        return this.extractContentManually();
    }

    extractContentManually() {
        // Try to find main content areas
        const selectors = [
            '.wiki-content',  // Confluence specific - 优先级最高
            '#main-content',  // Confluence specific  
            'main',
            'article',
            '.content',
            '.post-content',
            '.entry-content',
            '.article-content',
            '#content',
            '#main',
            '.main-content',
            'body'
        ];

        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element) {
                // console.log(`Using selector: ${selector}`);
                // Clone and clean the element
                const clone = element.cloneNode(true);
                this.removeUnwantedElements(clone);
                return clone;
            }
        }

        // If no content area found, use body but preserve tables
        const bodyClone = document.body.cloneNode(true);
        this.removeUnwantedElements(bodyClone);
        return bodyClone;
    }

    removeUnwantedElements(element) {
        // Remove unwanted elements but preserve tables
        const unwantedSelectors = [
            'script',
            'style',
            // 注释掉可能影响表格的选择器，调试用
            // 'nav:not(:has(table))',  
            // 'header:not(:has(table))',  
            // 'footer:not(:has(table))',  
            '.advertisement',
            '.ads',
            // '.sidebar:not(:has(table))',  
            '.menu',
            '.navigation',
            '.comments',
            '.comment',
            '.social-share',
            '.share-buttons',
            '.related-posts',
            '.popup',
            '.modal',
            '.cookie-notice',
            'iframe[src*="ads"]',
            'iframe[src*="doubleclick"]',
            // 确保不删除表格相关元素
            '.toc-macro', // 目录
            '#comments-section', // 评论区
            '.page-metadata', // 页面元数据
            '.labels-section', // 标签
            '.space-tools-section' // 空间工具
        ];

        // 先记录要删除的元素
        unwantedSelectors.forEach(selector => {
            try {
                const elements = element.querySelectorAll(selector);
                // if (elements.length > 0) {
                //     console.log(`Removing ${elements.length} elements matching: ${selector}`);
                // }
                elements.forEach(el => {
                    // 检查是否包含表格
                    const hasTables = el.querySelectorAll('table').length > 0;
                    if (hasTables) {
                        // console.warn(`Warning: Element with selector "${selector}" contains tables, skipping removal`);
                    } else {
                        el.remove();
                    }
                });
            } catch (e) {
                // console.error(`Error with selector ${selector}:`, e);
            }
        });
        
        // 确保table-wrap不被删除
        // const tableWraps = element.querySelectorAll('.table-wrap');
        // console.log(`Found ${tableWraps.length} table-wrap elements`);
    }

    removeImages(element) {
        const images = element.querySelectorAll('img');
        images.forEach(img => img.remove());
    }

    removeLinks(element) {
        const links = element.querySelectorAll('a');
        links.forEach(link => {
            // Replace link with its text content
            link.replaceWith(document.createTextNode(link.textContent));
        });
    }

    basicHtmlToMarkdown(element) {
        // Basic fallback conversion without turndown
        let markdown = '';
        
        // Handle tables first
        const tables = element.querySelectorAll('table');
        tables.forEach(table => {
            const tableMarkdown = this.processTable(table);
            if (tableMarkdown) {
                // Replace table in element with placeholder
                const placeholder = document.createElement('div');
                placeholder.textContent = `__TABLE_${Math.random().toString(36).substr(2, 9)}__`;
                placeholder.setAttribute('data-table-markdown', tableMarkdown);
                table.parentNode.replaceChild(placeholder, table);
            }
        });
        
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                    // Check if this is a table placeholder
                    if (text.startsWith('__TABLE_')) {
                        const parentDiv = node.parentElement;
                        if (parentDiv && parentDiv.hasAttribute('data-table-markdown')) {
                            markdown += '\n\n' + parentDiv.getAttribute('data-table-markdown') + '\n\n';
                            continue;
                        }
                    }
                    markdown += text + ' ';
                }
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                
                switch (tagName) {
                    case 'h1':
                        markdown += `\n# ${node.textContent.trim()}\n\n`;
                        break;
                    case 'h2':
                        markdown += `\n## ${node.textContent.trim()}\n\n`;
                        break;
                    case 'h3':
                        markdown += `\n### ${node.textContent.trim()}\n\n`;
                        break;
                    case 'p':
                        markdown += `\n${node.textContent.trim()}\n\n`;
                        break;
                    case 'br':
                        markdown += '\n';
                        break;
                    case 'strong':
                    case 'b':
                        markdown += `**${node.textContent.trim()}**`;
                        break;
                    case 'em':
                    case 'i':
                        markdown += `*${node.textContent.trim()}*`;
                        break;
                    case 'code':
                        markdown += `\`${node.textContent.trim()}\``;
                        break;
                    case 'a':
                        const href = node.getAttribute('href');
                        if (href) {
                            markdown += `[${node.textContent.trim()}](${href})`;
                        }
                        break;
                }
            }
        }
        
        return markdown;
    }

    cleanMarkdown(markdown) {
        return markdown
            // Remove excessive whitespace
            .replace(/\n{3,}/g, '\n\n')
            // Remove leading/trailing whitespace
            .trim()
            // Fix spacing around headers
            .replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2')
            // Fix list formatting
            .replace(/^\s*[-*+]\s*/gm, '- ')
            // Remove empty lines at start and end
            .replace(/^\n+|\n+$/g, '');
    }
}

// Initialize converter when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new Web2MDConverter();
    });
} else {
    new Web2MDConverter();
}