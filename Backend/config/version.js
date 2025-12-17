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

const PROCESSING_VERSION = 31; // Transposed table support - Added detection and transformation for specification tables (Model 1, Model 2, etc. in columns)

module.exports = {
    PROCESSING_VERSION
};
