const db = require('../config/db');

/**
 * File Cache Model
 * Handles caching of file processing results
 */
class FileCache {
    /**
     * Find cached file by hash and version
     * @param {string} hash - SHA-256 hash of file
     * @param {number} version - Processing version
     * @returns {object|null} - Cached data or null
     */
    static findByHash(hash, version) {
        const stmt = db.prepare(`
            SELECT * FROM file_cache 
            WHERE file_hash = ? AND processing_version = ?
        `);
        
        const result = stmt.get(hash, version);
        
        if (result) {
            // Update last accessed time
            this.updateLastAccessed(hash, version);
            
            // Parse JSON fields
            return {
                ...result,
                departmental_summaries: JSON.parse(result.departmental_summaries),
                metadata: result.metadata ? JSON.parse(result.metadata) : null
            };
        }
        
        return null;
    }

    /**
     * Create new cache entry
     * @param {object} data - Cache data
     * @returns {object} - Created entry
     */
    static create(data) {
        const { fileHash, processingVersion, originalFilename, extractedText, departmentalSummaries, metadata } = data;
        
        const stmt = db.prepare(`
            INSERT INTO file_cache (
                file_hash,
                processing_version,
                original_filename, 
                extracted_text, 
                departmental_summaries, 
                metadata
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        const result = stmt.run(
            fileHash,
            processingVersion,
            originalFilename,
            extractedText,
            JSON.stringify(departmentalSummaries),
            metadata ? JSON.stringify(metadata) : null
        );
        
        console.log(`✅ Cached file: ${originalFilename} (hash: ${fileHash.substring(0, 8)}..., v${processingVersion})`);
        
        return { id: result.lastInsertRowid, ...data };
    }

    /**
     * Update last accessed timestamp
     * @param {string} hash - File hash
     * @param {number} version - Processing version
     */
    static updateLastAccessed(hash, version) {
        const stmt = db.prepare(`
            UPDATE file_cache 
            SET last_accessed_at = CURRENT_TIMESTAMP 
            WHERE file_hash = ? AND processing_version = ?
        `);
        
        stmt.run(hash, version);
    }

    /**
     * Get cache statistics
     * @returns {object} - Cache stats
     */
    static getStats() {
        const countStmt = db.prepare('SELECT COUNT(*) as count FROM file_cache');
        const sizeStmt = db.prepare('SELECT SUM(LENGTH(extracted_text)) as size FROM file_cache');
        
        const count = countStmt.get().count;
        const size = sizeStmt.get().size || 0;
        
        return {
            totalEntries: count,
            totalSize: size,
            totalSizeMB: (size / (1024 * 1024)).toFixed(2)
        };
    }
}

module.exports = FileCache;
