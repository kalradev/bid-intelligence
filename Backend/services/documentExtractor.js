const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const textract = require('textract');
const { promisify } = require('util');

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
 * Main extraction function that routes to appropriate extractor
 * @param {Buffer} buffer - File buffer
 * @param {String} mimetype - File MIME type
 * @param {String} filename - Original filename
 * @returns {Promise<Object>} - Extracted text and metadata
 */
const extractText = async (buffer, mimetype, filename) => {
    let result;

    if (mimetype === 'application/pdf') {
        result = await extractFromPDF(buffer);
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        result = await extractFromDOCX(buffer);
    } else if (mimetype === 'application/msword') {
        result = await extractFromDOC(buffer, filename);
    } else {
        throw new Error('Unsupported file type');
    }

    // Clean up and format text
    const cleanedText = cleanText(result.text);

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
    extractFromDOC
};
