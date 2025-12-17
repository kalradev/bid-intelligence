/**
 * Clean and validate EMD value to prevent hallucinations
 * Removes any parenthetical additions like "(2%)" that weren't in the original document
 * @param {string} emdValue - Raw EMD value from AI
 * @returns {string} - Cleaned EMD value
 */
const cleanEMDValue = (emdValue) => {
    if (!emdValue || typeof emdValue !== 'string') return emdValue;
    
    const trimmed = emdValue.trim();
    
    // If it's just "N/A" or similar, return as-is
    if (/^(N\/A|n\/a|NA|Not Applicable|Not mentioned)$/i.test(trimmed)) {
        return 'N/A';
    }
    
    // Remove any parenthetical percentage additions that are hallucinations
    // Pattern: "₹5,000 (2%)" or "₹5,000 (Non-refundable) (2%)"
    // We want to keep: "₹5,000 (Non-refundable)" but remove: "(2%)"
    
    // Remove standalone percentage in parentheses at the end
    let cleaned = trimmed.replace(/\s*\([0-9.]+%\)\s*$/g, '');
    
    // If the result is empty or just whitespace, return N/A
    if (!cleaned || cleaned.trim() === '') {
        return 'N/A';
    }
    
    return cleaned.trim();
};

/**
 * Apply EMD cleaning to summaries object
 * @param {Object} summaries - Departmental summaries
 * @returns {Object} - Summaries with cleaned EMD
 */
const cleanEMDInSummaries = (summaries) => {
    if (!summaries || typeof summaries !== 'object') return summaries;
    
    // Clean projectOverview.emd
    if (summaries.projectOverview && summaries.projectOverview.emd) {
        summaries.projectOverview.emd = cleanEMDValue(summaries.projectOverview.emd);
    }
    
    return summaries;
};

module.exports = {
    cleanEMDValue,
    cleanEMDInSummaries
};
