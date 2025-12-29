const db = require('../config/db');
const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

/**
 * File Cache Model
 * Handles caching of file processing results
 * Works with both SQLite and PostgreSQL
 */
class FileCache {
    /**
     * Find cached file by hash and version
     * @param {string} hash - SHA-256 hash of file
     * @param {number} version - Processing version
     * @returns {Promise<object|null>} - Cached data or null
     */
    static async findByHash(hash, version) {
        if (USE_POSTGRES) {
            // PostgreSQL async query
            const result = await db.query(
                `SELECT * FROM file_cache 
                 WHERE file_hash = $1 AND processing_version = $2`,
                [hash, version]
            );
            
            if (result.rows.length > 0) {
                // Update last accessed time
                await this.updateLastAccessed(hash, version);
                
                const row = result.rows[0];
                // Parse JSON fields (PostgreSQL returns JSONB as objects)
                return {
                    ...row,
                    departmental_summaries: typeof row.departmental_summaries === 'string' 
                        ? JSON.parse(row.departmental_summaries) 
                        : row.departmental_summaries,
                    metadata: row.metadata ? (
                        typeof row.metadata === 'string' 
                            ? JSON.parse(row.metadata) 
                            : row.metadata
                    ) : null
                };
            }
            
            return null;
        } else {
            // SQLite sync query
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
    }

    /**
     * Create new cache entry
     * @param {object} data - Cache data
     * @returns {Promise<object>} - Created entry
     */
    static async create(data) {
        const { fileHash, processingVersion, originalFilename, extractedText, departmentalSummaries, metadata } = data;
        
        if (USE_POSTGRES) {
            // PostgreSQL async query
            const result = await db.query(
                `INSERT INTO file_cache (
                    file_hash,
                    processing_version,
                    original_filename, 
                    extracted_text, 
                    departmental_summaries, 
                    metadata
                ) VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *`,
                [
                    fileHash,
                    processingVersion,
                    originalFilename,
                    extractedText,
                    JSON.stringify(departmentalSummaries),
                    metadata ? JSON.stringify(metadata) : null
                ]
            );
            
            console.log(`✅ Cached file: ${originalFilename} (hash: ${fileHash.substring(0, 8)}..., v${processingVersion})`);
            
            return { id: result.rows[0].id, ...data };
        } else {
            // SQLite sync query
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
    }

    /**
     * Update last accessed timestamp
     * @param {string} hash - File hash
     * @param {number} version - Processing version
     */
    static async updateLastAccessed(hash, version) {
        if (USE_POSTGRES) {
            // PostgreSQL async query
            await db.query(
                `UPDATE file_cache 
                 SET last_accessed_at = CURRENT_TIMESTAMP 
                 WHERE file_hash = $1 AND processing_version = $2`,
                [hash, version]
            );
        } else {
            // SQLite sync query
            const stmt = db.prepare(`
                UPDATE file_cache 
                SET last_accessed_at = CURRENT_TIMESTAMP 
                WHERE file_hash = ? AND processing_version = ?
            `);
            
            stmt.run(hash, version);
        }
    }

    /**
     * Get cache statistics
     * @returns {Promise<object>} - Cache stats
     */
    static async getStats() {
        if (USE_POSTGRES) {
            // PostgreSQL async queries
            const countResult = await db.query('SELECT COUNT(*) as count FROM file_cache');
            const sizeResult = await db.query('SELECT SUM(LENGTH(extracted_text::text)) as size FROM file_cache');
            
            const count = parseInt(countResult.rows[0].count);
            const size = parseInt(sizeResult.rows[0].size || 0);
            
            return {
                totalEntries: count,
                totalSize: size,
                totalSizeMB: (size / (1024 * 1024)).toFixed(2)
            };
        } else {
            // SQLite sync queries
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
}

module.exports = FileCache;
