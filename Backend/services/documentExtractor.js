const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');
const { promisify } = require('util');
const XLSX = require('xlsx');
const Tesseract = require('tesseract.js');

const textractFromBuffer = promisify(textract.fromBufferWithName);

/**
 * Extract text from PDF file with format preservation
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<Object>} - Extracted text and metadata
 */
const extractFromPDF = async (buffer) => {
    try {
        // pdf-parse v2 API: instantiate PDFParse with data (buffer)
        const parser = new PDFParse({ data: buffer });

        // Get text content
        const result = await parser.getText();

        // Get page count (if available)
        let pageCount = 0;
        try {
            const pages = await parser.getPages();
            pageCount = pages.length;
        } catch (e) {
            // Page count not critical
        }

        return {
            text: result.text,
            metadata: {
                pages: pageCount,
                info: {}
            }
        };
    } catch (error) {
        throw new Error(`PDF extraction failed: ${error.message}`);
    }
};

/**
 * Extract text from DOCX file with format preservation
 * @param {Buffer} buffer - DOCX file buffer
 * @returns {Promise<Object>} - Extracted text and metadata
 */
const extractFromDOCX = async (buffer) => {
    try {
        const result = await mammoth.extractRawText({ buffer });

        // Mammoth also provides HTML conversion for better structure
        const htmlResult = await mammoth.convertToHtml({ buffer });

        return {
            text: result.value,
            html: htmlResult.value,
            metadata: {
                messages: result.messages
            }
        };
    } catch (error) {
        throw new Error(`DOCX extraction failed: ${error.message}`);
    }
};

/**
 * Extract text from DOC file (legacy format)
 * @param {Buffer} buffer - DOC file buffer
 * @param {String} filename - Original filename
 * @returns {Promise<Object>} - Extracted text
 */
const extractFromDOC = async (buffer, filename) => {
    try {
        const text = await textractFromBuffer(filename, buffer);

        return {
            text: text.trim(),
            metadata: {
                format: 'legacy DOC'
            }
        };
    } catch (error) {
        throw new Error(`DOC extraction failed: ${error.message}`);
    }
};

/**
 * Extract text from Excel file (XLSX, XLS)
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Promise<Object>} - Extracted text and metadata
 */
const extractFromExcel = async (buffer) => {
    try {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetNames = workbook.SheetNames;
        let allText = [];
        let sheetData = [];

        // Extract text from all sheets
        for (const sheetName of sheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
            
            // Convert sheet to text format
            const sheetText = jsonData.map(row => 
                row.filter(cell => cell !== '').join(' | ')
            ).join('\n');
            
            allText.push(`=== Sheet: ${sheetName} ===\n${sheetText}`);
            sheetData.push({
                name: sheetName,
                rows: jsonData.length,
                text: sheetText
            });
        }

        return {
            text: allText.join('\n\n'),
            metadata: {
                sheets: sheetNames,
                sheetCount: sheetNames.length,
                sheetData: sheetData
            }
        };
    } catch (error) {
        throw new Error(`Excel extraction failed: ${error.message}`);
    }
};

/**
 * Extract text from image using OCR
 * @param {Buffer} buffer - Image file buffer
 * @param {String} filename - Original filename
 * @returns {Promise<Object>} - Extracted text and metadata
 */
const extractFromImage = async (buffer, filename) => {
    try {
        console.log(`🔍 Starting OCR for image: ${filename}`);
        
        // Use Tesseract.js for OCR
        const { data: { text, words, paragraphs } } = await Tesseract.recognize(buffer, 'eng', {
            logger: m => {
                if (m.status === 'recognizing text') {
                    console.log(`   OCR Progress: ${Math.round(m.progress * 100)}%`);
                }
            }
        });

        console.log(`✅ OCR completed. Extracted ${text.length} characters`);

        return {
            text: text.trim(),
            metadata: {
                format: 'image (OCR)',
                wordCount: words?.length || 0,
                paragraphCount: paragraphs?.length || 0,
                confidence: words?.length > 0 ? 
                    (words.reduce((sum, w) => sum + (w.confidence || 0), 0) / words.length).toFixed(2) : 
                    'N/A'
            }
        };
    } catch (error) {
        throw new Error(`Image OCR extraction failed: ${error.message}`);
    }
};

/**
 * Main extraction function that routes to appropriate extractor
 * @param {Buffer} buffer - File buffer
 * @param {String} mimetype - File MIME type
 * @param {String} filename - Original filename
 * @returns {Promise<Object>} - Extracted text and metadata
 */
const extractText = async (buffer, mimetype, filename) => {
    let result;

    // PDF files
    if (mimetype === 'application/pdf') {
        result = await extractFromPDF(buffer);
    } 
    // Word DOCX files
    else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        result = await extractFromDOCX(buffer);
    } 
    // Word DOC files (legacy)
    else if (mimetype === 'application/msword') {
        result = await extractFromDOC(buffer, filename);
    }
    // Excel XLSX files
    else if (mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        result = await extractFromExcel(buffer);
    }
    // Excel XLS files (legacy)
    else if (mimetype === 'application/vnd.ms-excel' || mimetype === 'application/excel') {
        result = await extractFromExcel(buffer);
    }
    // Image files (PNG, JPG, JPEG, etc.)
    else if (mimetype.startsWith('image/')) {
        result = await extractFromImage(buffer, filename);
    } 
    else {
        throw new Error(`Unsupported file type: ${mimetype}. Supported types: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, JPEG`);
    }

    // Clean up and format text
    const cleanedText = cleanText(result.text);

    // Estimate pages for non-PDF files (for page number references)
    let estimatedPages = result.metadata.pages || 1;
    if (!result.metadata.pages) {
        // Estimate: ~500 words per page
        const wordCount = countWords(cleanedText);
        estimatedPages = Math.max(1, Math.ceil(wordCount / 500));
        result.metadata.pages = estimatedPages;
    }

    return {
        text: cleanedText,
        originalText: result.text,
        html: result.html || null,
        metadata: result.metadata,
        wordCount: countWords(cleanedText)
    };
};

/**
 * Clean and normalize extracted text
 * @param {String} text - Raw extracted text
 * @returns {String} - Cleaned text
 */
const cleanText = (text) => {
    return text
        .replace(/\r\n/g, '\n')          // Normalize line endings
        .replace(/\n{3,}/g, '\n\n')      // Remove excessive blank lines
        .replace(/[ \t]+/g, ' ')         // Normalize spaces
        .trim();
};

/**
 * Count words in text
 * @param {String} text - Text to count
 * @returns {Number} - Word count
 */
const countWords = (text) => {
    return text.split(/\s+/).filter(word => word.length > 0).length;
};

module.exports = {
    extractText,
    extractFromPDF,
    extractFromDOCX,
    extractFromDOC,
    extractFromExcel,
    extractFromImage
};
