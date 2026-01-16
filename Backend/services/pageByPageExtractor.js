/**
 * UNIVERSAL PAGE-BY-PAGE TEXT EXTRACTION SERVICE
 * 
 * Extracts text from ANY PDF document, page by page
 * Stores atomic units (sentences) for exact matching
 */

const { PDFParse } = require('pdf-parse');
const fs = require('fs');
<<<<<<< HEAD
const path = require('path');
=======
>>>>>>> convert

/**
 * Extract text from PDF page by page
 * Uses Python script for accurate page-by-page extraction
 * @param {Buffer} buffer - PDF file buffer
 * @param {string} fileHash - File hash for temporary storage
 * @returns {Promise<Array<Object>>} - Array of {pageNumber, text, sentences}
 */
async function extractPageByPage(buffer, fileHash = null) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    const path = require('path');
    const fs = require('fs');
    
    try {
        // Try Python-based extraction first (more accurate)
        const pythonScript = path.join(__dirname, 'pdfPageExtractor.py');
        
        if (fs.existsSync(pythonScript)) {
            // Save buffer to temp file
            const tempDir = path.join(__dirname, '../../data/temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const tempFilePath = path.join(tempDir, `${fileHash || 'temp'}.pdf`);
            fs.writeFileSync(tempFilePath, buffer);
            
            try {
                // Run Python script
                const { stdout, stderr } = await execAsync(`python "${pythonScript}" "${tempFilePath}"`);
                
                if (stderr && !stderr.includes('Warning')) {
                    console.warn('Python extraction warning:', stderr);
                }
                
                const result = JSON.parse(stdout);
                
                // Clean up temp file
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (e) {
                    // Ignore cleanup errors
                }
                
                if (result.success && result.pages) {
                    console.log(`✅ Python extraction: ${result.totalPages} pages`);
                    return result.pages;
                }
            } catch (pythonError) {
                console.warn('⚠️  Python extraction failed, falling back to Node.js method:', pythonError.message);
                // Fall through to Node.js method
            }
        }
        
        // Fallback: Use pdf-parse with intelligent splitting
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        
        // Get full text
        const fullText = await parser.getText();
        
        // Get page count
        let totalPages = 0;
        try {
            const pages = await parser.getPages();
            totalPages = pages.length;
        } catch (e) {
            // Estimate pages if not available
            const wordCount = fullText.split(/\s+/).length;
            totalPages = Math.max(1, Math.ceil(wordCount / 500)); // ~500 words per page
        }
        
        // Intelligent page splitting: look for page markers in text
        const pageMarkers = [];
        const pageMarkerRegex = /(?:^|\n)\s*(?:Page\s+(\d+)|^\s*(\d+)\s*$)/gmi;
        let match;
        while ((match = pageMarkerRegex.exec(fullText)) !== null) {
            const pageNum = parseInt(match[1] || match[2]);
            if (pageNum > 0 && pageNum <= totalPages) {
                pageMarkers.push({ position: match.index, page: pageNum });
            }
        }
        
        // Split text by page markers or evenly if no markers found
        const pageData = [];
        
        if (pageMarkers.length > 0) {
            // Use page markers for accurate splitting
            pageMarkers.sort((a, b) => a.position - b.position);
            
            for (let i = 0; i < pageMarkers.length; i++) {
                const startPos = pageMarkers[i].position;
                const endPos = i < pageMarkers.length - 1 ? pageMarkers[i + 1].position : fullText.length;
                const pageText = fullText.substring(startPos, endPos).trim();
                
                if (pageText.length > 0) {
                    const sentences = extractAtomicUnits(pageText);
                    pageData.push({
                        pageNumber: pageMarkers[i].page,
                        text: pageText,
                        sentences: sentences,
                        wordCount: pageText.split(/\s+/).length
                    });
                }
            }
        } else {
            // Even split as fallback
            const words = fullText.split(/\s+/);
            const wordsPerPage = Math.ceil(words.length / totalPages);
            
            for (let i = 0; i < totalPages; i++) {
                const startIdx = i * wordsPerPage;
                const endIdx = Math.min((i + 1) * wordsPerPage, words.length);
                const pageWords = words.slice(startIdx, endIdx);
                const pageText = pageWords.join(' ');
                
                if (pageText.trim().length > 0) {
                    const sentences = extractAtomicUnits(pageText);
                    pageData.push({
                        pageNumber: i + 1,
                        text: pageText,
                        sentences: sentences,
                        wordCount: pageWords.length
                    });
                }
            }
        }
        
        console.log(`✅ Extracted ${pageData.length} pages (Node.js fallback)`);
        
        return pageData;
    } catch (error) {
        throw new Error(`PDF page-by-page extraction failed: ${error.message}`);
    }
}

/**
 * Extract atomic units from text
 * @param {string} text - Text to split
 * @returns {Array<string>} - Array of sentences/lines
 */
function extractAtomicUnits(text) {
    if (!text) return [];
    
    const units = [];
    
    // Split by sentence endings
    const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
    
    // Split by line breaks (for lists, bullet points)
    const lines = text.split(/\n+/).filter(l => l.trim().length > 0);
    
    // Combine and deduplicate
    const allUnits = [...sentences, ...lines];
    const seen = new Set();
    
    for (const unit of allUnits) {
        const trimmed = unit.trim();
        // Minimum 10 chars, maximum 500 chars per unit
        if (trimmed.length >= 10 && trimmed.length <= 500 && !seen.has(trimmed)) {
            seen.add(trimmed);
            units.push(trimmed);
        }
    }
    
    return units;
}

/**
 * Store page-by-page data in a format suitable for exact matching
 * @param {string} fileHash - File hash identifier
 * @param {Array<Object>} pageData - Page data from extractPageByPage
 * @param {string} storagePath - Path to store the data
 * @returns {Promise<string>} - Path to stored data
 */
async function storePageByPageData(fileHash, pageData, storagePath) {
    try {
<<<<<<< HEAD
        const storageDir = storagePath || path.join(__dirname, '../data/pageTexts');
=======
        const storageDir = storagePath || './Backend/data/pageTexts';
>>>>>>> convert
        
        // Ensure directory exists
        if (!fs.existsSync(storageDir)) {
            fs.mkdirSync(storageDir, { recursive: true });
        }
        
<<<<<<< HEAD
        const filePath = path.join(storageDir, `${fileHash}.json`);
=======
        const filePath = `${storageDir}/${fileHash}.json`;
>>>>>>> convert
        
        const dataToStore = {
            fileHash: fileHash,
            extractedAt: new Date().toISOString(),
            totalPages: pageData.length,
            pages: pageData.map(page => ({
                pageNumber: page.pageNumber,
                text: page.text,
                sentences: page.sentences,
                wordCount: page.wordCount
            }))
        };
        
        fs.writeFileSync(filePath, JSON.stringify(dataToStore, null, 2));
        
        console.log(`✅ Stored page-by-page data: ${filePath} (${pageData.length} pages)`);
        
        return filePath;
    } catch (error) {
        throw new Error(`Failed to store page-by-page data: ${error.message}`);
    }
}

/**
 * Load page-by-page data from storage
 * @param {string} fileHash - File hash identifier
 * @param {string} storagePath - Path to stored data
 * @returns {Promise<Array<Object>|null>} - Page data or null if not found
 */
async function loadPageByPageData(fileHash, storagePath) {
    try {
<<<<<<< HEAD
        const storageDir = storagePath || path.join(__dirname, '../data/pageTexts');
        const filePath = path.join(storageDir, `${fileHash}.json`);
        
        console.log(`📂 Looking for page data at: ${filePath}`);
        
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  Page data file not found: ${filePath}`);
=======
        const storageDir = storagePath || './Backend/data/pageTexts';
        const filePath = `${storageDir}/${fileHash}.json`;
        
        if (!fs.existsSync(filePath)) {
>>>>>>> convert
            return null;
        }
        
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
<<<<<<< HEAD
        console.log(`✅ Loaded page data: ${data.pages?.length || 0} pages`);
        return data.pages || [];
    } catch (error) {
        console.error(`❌ Error loading page-by-page data: ${error.message}`);
=======
        return data.pages || [];
    } catch (error) {
        console.error(`Error loading page-by-page data: ${error.message}`);
>>>>>>> convert
        return null;
    }
}

module.exports = {
    extractPageByPage,
    extractAtomicUnits,
    storePageByPageData,
    loadPageByPageData
};

