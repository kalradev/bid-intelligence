/**
 * Normalize and deduplicate compliance documents
 * Handles case-insensitive deduplication and applies consistent capitalization
 */

/**
 * Normalize document name to title case
 * @param {string} docName - Document name to normalize
 * @returns {string} - Normalized document name
 */
const normalizeDocumentName = (docName) => {
    if (!docName || typeof docName !== 'string') return docName;
    
    // Trim whitespace
    let normalized = docName.trim();
    
    // Convert to title case (first letter of each word capitalized)
    normalized = normalized.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
    
    // Handle common abbreviations that should be uppercase
    const upperCaseWords = ['ISO', 'GST', 'PAN', 'EMD', 'MII', 'BIS', 'RoHS', 'MSME', 'PF', 'ESI', 'IT', 'TDS', 'NSIC', 'UAM'];
    upperCaseWords.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        normalized = normalized.replace(regex, word);
    });
    
    return normalized;
};

/**
 * Deduplicate array of compliance documents (case-insensitive)
 * @param {Array<string>} documents - Array of document names
 * @returns {Array<string>} - Deduplicated and normalized array
 */
const deduplicateDocuments = (documents) => {
    if (!Array.isArray(documents)) return documents;
    
    const seen = new Map(); // Use Map to track lowercase versions
    const result = [];
    
    documents.forEach(doc => {
        if (!doc || typeof doc !== 'string') return;
        
        const normalized = normalizeDocumentName(doc);
        const lowerKey = normalized.toLowerCase();
        
        // Only add if we haven't seen this document (case-insensitive)
        if (!seen.has(lowerKey)) {
            seen.set(lowerKey, true);
            result.push(normalized);
        }
    });
    
    return result;
};

/**
 * Apply deduplication to legal.requiredDocuments in summaries
 * @param {Object} summaries - Departmental summaries object
 * @returns {Object} - Summaries with deduplicated documents
 */
const deduplicateLegalDocuments = (summaries) => {
    if (!summaries || typeof summaries !== 'object') return summaries;
    
    // Deduplicate legal.requiredDocuments
    if (summaries.legal && Array.isArray(summaries.legal.requiredDocuments)) {
        summaries.legal.requiredDocuments = deduplicateDocuments(summaries.legal.requiredDocuments);
    }
    
    return summaries;
};

module.exports = {
    normalizeDocumentName,
    deduplicateDocuments,
    deduplicateLegalDocuments
};
