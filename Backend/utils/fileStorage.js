/**
 * File Storage Utility
 * Stores uploaded files temporarily for document viewing
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Store file buffer to disk
 * @param {Buffer} buffer - File buffer
 * @param {string} fileHash - File hash (used as filename)
 * @param {string} originalName - Original filename
 * @returns {string} - Stored file path
 */
function storeFile(buffer, fileHash, originalName) {
    try {
        // Preserve original file extension
        const ext = path.extname(originalName).toLowerCase();
        // If no extension, try to determine from mimetype or default to .pdf
        const finalExt = ext || '.pdf';
        const filename = `${fileHash}${finalExt}`;
        const filePath = path.join(UPLOAD_DIR, filename);
        
        // Ensure directory exists
        if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
        }
        
        // Write file
        fs.writeFileSync(filePath, buffer);
        console.log(`✅ File stored: ${filename} (${(buffer.length / 1024).toFixed(2)} KB)`);
        console.log(`   Original name: ${originalName}`);
        console.log(`   Full path: ${filePath}`);
        
        return filePath;
    } catch (error) {
        console.error('Error storing file:', error);
        throw error;
    }
}

/**
 * Get stored file path
 * @param {string} fileHash - File hash
 * @param {string} originalName - Original filename (for extension)
 * @returns {string|null} - File path or null if not found
 */
function getStoredFilePath(fileHash, originalName) {
    if (!fileHash) {
        return null;
    }
    
    // Try with original extension first
    const ext = originalName ? path.extname(originalName).toLowerCase() : '';
    const filename = `${fileHash}${ext || '.pdf'}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    
    if (fs.existsSync(filePath)) {
        return filePath;
    }
    
    // If not found, try common extensions
    const commonExts = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'];
    for (const ext of commonExts) {
        const altPath = path.join(UPLOAD_DIR, `${fileHash}${ext}`);
        if (fs.existsSync(altPath)) {
            console.log(`✅ Found file with alternative extension: ${ext}`);
            return altPath;
        }
    }
    
    // List all files with this hash prefix for debugging
    if (fs.existsSync(UPLOAD_DIR)) {
        const files = fs.readdirSync(UPLOAD_DIR);
        const matchingFiles = files.filter(f => f.startsWith(fileHash));
        if (matchingFiles.length > 0) {
            console.log(`⚠️ Found files with hash prefix: ${matchingFiles.join(', ')}`);
            // Return the first matching file
            return path.join(UPLOAD_DIR, matchingFiles[0]);
        }
    }
    
    console.warn(`⚠️ File not found: ${filename}`);
    return null;
}

/**
 * Delete stored file
 * @param {string} fileHash - File hash
 * @param {string} originalName - Original filename
 */
function deleteStoredFile(fileHash, originalName) {
    try {
        const ext = path.extname(originalName) || '.pdf';
        const filename = `${fileHash}${ext}`;
        const filePath = path.join(UPLOAD_DIR, filename);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✅ File deleted: ${filename}`);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

module.exports = {
    storeFile,
    getStoredFilePath,
    deleteStoredFile,
    UPLOAD_DIR
};

