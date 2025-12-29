/**
 * UNIVERSAL EXACT TEXT MATCHING SERVICE
 * 
 * Deterministic, word-for-word matching for ANY PDF document
 * NO semantic similarity, NO embeddings, NO vector DBs
 */

/**
 * Normalize text for exact matching
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text
 */
function normalizeText(text) {
    if (!text || typeof text !== 'string') return '';
    
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')  // Collapse multiple spaces
        .replace(/[^\w\s₹$%.,\d]/g, '')  // Remove punctuation except: ₹ $ % . ,
        .trim();
}

/**
 * Extract atomic units (sentences, lines, bullet points) from text
 * @param {string} text - Text to split
 * @returns {Array<string>} - Array of atomic text units
 */
function extractAtomicUnits(text) {
    if (!text || typeof text !== 'string') return [];
    
    const units = [];
    const seen = new Set();
    
    // Strategy 1: Split by sentence endings (., !, ?)
    const sentences = text.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
    
    // Strategy 2: Split by line breaks (for lists, bullet points, tables)
    const lines = text.split(/\n+/).filter(l => l.trim().length > 0);
    
    // Strategy 3: Split by common list markers (bullet points, numbered lists)
    const listItems = text.split(/(?:^|\n)\s*(?:[•\-\*]\s+|\d+[\.\)]\s+)/gm).filter(l => l.trim().length > 0);
    
    // Combine all strategies
    const allUnits = [...sentences, ...lines, ...listItems];
    
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
 * Calculate word overlap percentage between two texts
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} - Overlap percentage (0-1)
 */
function calculateWordOverlap(text1, text2) {
    const words1 = new Set(normalizeText(text1).split(/\s+/).filter(w => w.length > 0));
    const words2 = new Set(normalizeText(text2).split(/\s+/).filter(w => w.length > 0));
    
    if (words1.size === 0 || words2.size === 0) return 0;
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
}

/**
 * Extract numbers, currency, percentages from text
 * @param {string} text - Text to analyze
 * @returns {Array<string>} - Array of numeric patterns
 */
function extractNumericPatterns(text) {
    const patterns = [];
    
    // Currency amounts: ₹5000, ₹1.41 Cr, 5000/-, etc.
    const currencyMatches = text.match(/₹?\s*[\d,]+\.?\d*\s*(?:lakhs?|crore?|cr|lacs?|\/-)?/gi);
    if (currencyMatches) patterns.push(...currencyMatches);
    
    // Percentages: 50%, 0.5%
    const percentMatches = text.match(/\d+\.?\d*%/g);
    if (percentMatches) patterns.push(...percentMatches);
    
    // Numbers: 2, 3, 12, 2025, etc.
    const numberMatches = text.match(/\b\d+\b/g);
    if (numberMatches) patterns.push(...numberMatches);
    
    // Dates: 2025, 2023-2025, etc.
    const dateMatches = text.match(/\d{4}(?:-\d{4})?/g);
    if (dateMatches) patterns.push(...dateMatches);
    
    return patterns.map(p => normalizeText(p));
}

/**
 * Find exact match for a query in page-by-page text
 * @param {string} query - Text to find (from UI)
 * @param {Array<Object>} pageTexts - Array of {pageNumber, text, sentences}
 * @returns {Object|null} - Match result or null
 */
function findExactMatch(query, pageTexts) {
    if (!query || !pageTexts || pageTexts.length === 0) {
        return null;
    }
    
    const normalizedQuery = normalizeText(query);
    const queryNumericPatterns = extractNumericPatterns(query);
    
    let bestMatch = null;
    let bestScore = 0;
    
    // Try matching strategies in order
    for (const pageData of pageTexts) {
        const { pageNumber, sentences = [] } = pageData;
        
        // Extract sentences if not already extracted
        const pageSentences = sentences.length > 0 
            ? sentences 
            : extractAtomicUnits(pageData.text || '');
        
        for (const sentence of pageSentences) {
            const normalizedSentence = normalizeText(sentence);
            
            // Strategy 1: Full substring match (highest confidence)
            if (normalizedSentence.includes(normalizedQuery) || 
                normalizedQuery.includes(normalizedSentence)) {
                const matchLength = Math.min(normalizedQuery.length, normalizedSentence.length);
                const score = matchLength / Math.max(normalizedQuery.length, normalizedSentence.length);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        matchedText: sentence,
                        page: pageNumber,
                        confidence: score >= 0.95 ? 1.0 : 0.9,  // 95%+ = exact match
                        matchType: 'full_substring'
                    };
                }
            }
            
            // Strategy 2: Longest phrase match (>= 70% word overlap)
            const wordOverlap = calculateWordOverlap(query, sentence);
            if (wordOverlap >= 0.7 && wordOverlap > bestScore) {
                // Check numeric pattern overlap (important for amounts, dates)
                const sentenceNumericPatterns = extractNumericPatterns(sentence);
                const numericOverlap = queryNumericPatterns.length > 0
                    ? queryNumericPatterns.filter(p => sentenceNumericPatterns.includes(p)).length / queryNumericPatterns.length
                    : 0;
                
                // Combined score: word overlap + numeric overlap
                const combinedScore = (wordOverlap * 0.7) + (numericOverlap * 0.3);
                
                if (combinedScore > bestScore) {
                    bestScore = combinedScore;
                    bestMatch = {
                        matchedText: sentence,
                        page: pageNumber,
                        confidence: combinedScore >= 0.9 ? 0.95 : combinedScore,
                        matchType: 'phrase_overlap'
                    };
                }
            }
            
            // Strategy 3: Regex match using numbers and domain keywords
            if (queryNumericPatterns.length > 0) {
                const sentenceNumericPatterns = extractNumericPatterns(sentence);
                const numericMatch = queryNumericPatterns.every(p => 
                    sentenceNumericPatterns.some(sp => sp.includes(p) || p.includes(sp))
                );
                
                if (numericMatch && wordOverlap >= 0.5) {
                    const regexScore = (wordOverlap * 0.5) + 0.5;  // Boost for numeric match
                    if (regexScore > bestScore) {
                        bestScore = regexScore;
                        bestMatch = {
                            matchedText: sentence,
                            page: pageNumber,
                            confidence: regexScore >= 0.85 ? 0.9 : regexScore,
                            matchType: 'regex_numeric'
                        };
                    }
                }
            }
        }
    }
    
    // Only return if confidence >= 0.85 (high confidence threshold)
    if (bestMatch && bestMatch.confidence >= 0.85) {
        return bestMatch;
    }
    
    return null;
}

/**
 * Find all exact matches (for multiple references)
 * @param {string} query - Text to find
 * @param {Array<Object>} pageTexts - Array of page data
 * @param {number} maxResults - Maximum number of results
 * @returns {Array<Object>} - Array of match results
 */
function findAllExactMatches(query, pageTexts, maxResults = 3) {
    if (!query || !pageTexts || pageTexts.length === 0) {
        return [];
    }
    
    const normalizedQuery = normalizeText(query);
    const queryNumericPatterns = extractNumericPatterns(query);
    const matches = [];
    const seenPages = new Set();
    
    for (const pageData of pageTexts) {
        const { pageNumber, sentences = [] } = pageData;
        const pageSentences = sentences.length > 0 
            ? sentences 
            : extractAtomicUnits(pageData.text || '');
        
        for (const sentence of pageSentences) {
            const normalizedSentence = normalizeText(sentence);
            const wordOverlap = calculateWordOverlap(query, sentence);
            
            // Check for matches
            const isFullMatch = normalizedSentence.includes(normalizedQuery) || 
                               normalizedQuery.includes(normalizedSentence);
            const isPhraseMatch = wordOverlap >= 0.7;
            
            if (isFullMatch || isPhraseMatch) {
                // Calculate confidence
                let confidence = 0;
                if (isFullMatch) {
                    const matchLength = Math.min(normalizedQuery.length, normalizedSentence.length);
                    confidence = matchLength / Math.max(normalizedQuery.length, normalizedSentence.length);
                    confidence = confidence >= 0.95 ? 1.0 : 0.9;
                } else {
                    const sentenceNumericPatterns = extractNumericPatterns(sentence);
                    const numericOverlap = queryNumericPatterns.length > 0
                        ? queryNumericPatterns.filter(p => sentenceNumericPatterns.includes(p)).length / queryNumericPatterns.length
                        : 0;
                    confidence = (wordOverlap * 0.7) + (numericOverlap * 0.3);
                }
                
                if (confidence >= 0.85) {
                    // Avoid duplicates on same page
                    const pageKey = `${pageNumber}_${normalizedSentence.substring(0, 50)}`;
                    if (!seenPages.has(pageKey)) {
                        seenPages.add(pageKey);
                        matches.push({
                            matchedText: sentence,
                            page: pageNumber,
                            confidence: confidence,
                            matchType: isFullMatch ? 'full_substring' : 'phrase_overlap'
                        });
                    }
                }
            }
        }
    }
    
    // Sort by confidence (highest first), then by page number
    matches.sort((a, b) => {
        if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence;
        }
        return a.page - b.page;
    });
    
    return matches.slice(0, maxResults);
}

/**
 * Find text position in page for highlighting
 * @param {string} pageText - Full page text
 * @param {string} sentence - Sentence containing the match
 * @param {string} query - Original query text
 * @returns {Object} - Position info with context
 */
function findTextPosition(pageText, sentence, query) {
    if (!pageText || !sentence || !query) {
        return { start: 0, end: 0, contextBefore: '', contextAfter: '' };
    }
    
    // Case-insensitive search
    const lowerPageText = pageText.toLowerCase();
    const lowerSentence = sentence.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    // Find sentence in page (case-insensitive)
    let sentenceIndex = lowerPageText.indexOf(lowerSentence);
    
    if (sentenceIndex === -1) {
        // Try to find partial match using first few words
        const words = sentence.split(/\s+/).filter(w => w.length > 3);
        if (words.length > 0) {
            const firstWords = words.slice(0, 3).join(' ').toLowerCase();
            sentenceIndex = lowerPageText.indexOf(firstWords);
        }
    }
    
    if (sentenceIndex === -1) {
        // Last resort: find query directly in page
        const queryIndex = lowerPageText.indexOf(lowerQuery);
        if (queryIndex !== -1) {
            return {
                start: queryIndex,
                end: queryIndex + query.length,
                contextBefore: pageText.substring(Math.max(0, queryIndex - 100), queryIndex),
                contextAfter: pageText.substring(queryIndex + query.length, Math.min(pageText.length, queryIndex + query.length + 100))
            };
        }
        return { start: 0, end: Math.min(query.length, pageText.length), contextBefore: '', contextAfter: '' };
    }
    
    // Find query within sentence
    const sentenceText = pageText.substring(sentenceIndex, sentenceIndex + sentence.length);
    const lowerSentenceText = sentenceText.toLowerCase();
    const queryIndex = lowerSentenceText.indexOf(lowerQuery);
    
    if (queryIndex !== -1) {
        const start = sentenceIndex + queryIndex;
        const end = start + query.length;
        
        return {
            start: start,
            end: end,
            contextBefore: pageText.substring(Math.max(0, sentenceIndex - 100), sentenceIndex),
            contextAfter: pageText.substring(sentenceIndex + sentence.length, Math.min(pageText.length, sentenceIndex + sentence.length + 100))
        };
    }
    
    // Fallback: return sentence boundaries
    return {
        start: sentenceIndex,
        end: sentenceIndex + sentence.length,
        contextBefore: pageText.substring(Math.max(0, sentenceIndex - 100), sentenceIndex),
        contextAfter: pageText.substring(sentenceIndex + sentence.length, Math.min(pageText.length, sentenceIndex + sentence.length + 100))
    };
}

module.exports = {
    normalizeText,
    extractAtomicUnits,
    calculateWordOverlap,
    extractNumericPatterns,
    findExactMatch,
    findAllExactMatches,
    findTextPosition
};

