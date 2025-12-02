/**
 * Processing Version Configuration
 * 
 * INCREMENT this version number whenever you change:
 * - AI prompts or instructions
 * - Processing logic
 * - Department categories
 * - Output format or structure
 * 
 * This ensures cached results are invalidated when logic changes.
 */

const PROCESSING_VERSION = 30; // Zero N/A products - Validation filters invalid product names (N/A, empty, generic)

module.exports = {
    PROCESSING_VERSION
};
