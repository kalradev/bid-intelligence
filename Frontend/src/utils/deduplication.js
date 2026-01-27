// Helper function to normalize text for semantic comparison
export const normalizeForComparison = (text) => {
  if (!text) return '';
  let normalized = String(text).trim().toLowerCase();
  
  // Filter out N/A values
  if (normalized === 'n/a' || normalized === 'na' || normalized === 'none' || normalized === 'null') {
    return '';
  }
  
  // Remove common prefixes that don't change meaning
  normalized = normalized.replace(/^(risk of|potential|possible|chance of|threat of)\s+/i, '');
  
  // Normalize synonyms and common variations
  normalized = normalized.replace(/\b(payment delays|delayed payments|delay in payments)\b/g, 'payment_delays');
  normalized = normalized.replace(/\b(cash flow|cashflow)\b/g, 'cash_flow');
  normalized = normalized.replace(/\b(project execution|execution of project|project delivery|delivery of project)\b/g, 'project_execution');
  normalized = normalized.replace(/\b(meeting|meet|fulfill|fulfillment|compliance with|comply with)\b/g, 'meet');
  normalized = normalized.replace(/\b(disqualification|disqualify|rejection|reject)\b/g, 'disqualification');
  normalized = normalized.replace(/\b(non-compliance|noncompliance|non compliance)\b/g, 'non_compliance');
  normalized = normalized.replace(/\b(eligibility criteria|eligibility requirements|eligibility)\b/g, 'eligibility');
  normalized = normalized.replace(/\b(financial criteria|financial requirements|financial)\b/g, 'financial');
  normalized = normalized.replace(/\b(guarantee requirements|guarantee|bank guarantee)\b/g, 'guarantee');
  normalized = normalized.replace(/\b(emd|earnest money deposit)\b/g, 'emd');
  normalized = normalized.replace(/\b(turnover|annual turnover|revenue)\b/g, 'turnover');
  normalized = normalized.replace(/\b(proof of|provide proof|submit proof|evidence of)\b/g, 'proof');
  normalized = normalized.replace(/\b(minimum|min|at least)\b/g, 'minimum');
  normalized = normalized.replace(/\b(required|mandatory|must|should)\b/g, 'required');
  normalized = normalized.replace(/\b(certificate|cert|certification)\b/g, 'certificate');
  normalized = normalized.replace(/\b(performance security|performance bank guarantee|performance guarantee|pbg)\b/g, 'performance_security');
  normalized = normalized.replace(/\b(compliance with|comply with|meet|adhere to)\b/g, 'compliance');
  normalized = normalized.replace(/\b(technical specifications|technical specs|specifications|specs)\b/g, 'technical_specs');
  
  // Remove punctuation and extra spaces
  normalized = normalized.replace(/[.,;:!?]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
};

// Calculate similarity between two normalized strings
export const calculateSimilarity = (str1, str2) => {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0;
  
  // Extract key words (remove common stop words)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'due', 'during', 'affecting']);
  const words1 = str1.split(' ').filter(w => w && !stopWords.has(w));
  const words2 = str2.split(' ').filter(w => w && !stopWords.has(w));
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Count matching words
  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  // Jaccard similarity
  return intersection.size / union.size;
};

// Filter out N/A values from array
export const filterNA = (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.filter(item => {
    const str = String(item).trim().toLowerCase();
    return str && str !== 'n/a' && str !== 'na' && str !== 'none' && str !== 'null' && str !== '';
  });
};

// Filter out EMD-related entries to prevent showing incorrect EMD values in department summaries
export const filterEMD = (arr) => {
  if (!Array.isArray(arr)) return arr;
  return arr.filter(item => {
    const str = String(item).trim();
    const lowerStr = str.toLowerCase();
    
    // Skip if empty
    if (!str) return false;
    
    // Keep "EMD exemption" related items as those are valid
    const emdExemptionPattern = /\bemd\s+(exemption|exempt|waiver|waived)/i;
    if (emdExemptionPattern.test(str)) {
      return true; // Keep exemption info
    }
    
    // Filter out items that contain EMD values in various formats:
    // - "EMD: ₹5L", "EMD ₹5000", "EMD of ₹5L", "EMD ₹5L", "EMD: ₹5,000"
    // - "EMD of", "EMD:", "EMD " followed by currency symbols and numbers
    const emdValuePatterns = [
      /\bemd\s+(of|:)?\s*[₹$€£]?\s*\d+[,\d]*\s*[lcrkm]?/i,  // EMD of ₹5L, EMD: ₹5,000
      /\bemd\s+[₹$€£]\s*\d+[,\d]*/i,  // EMD ₹5000
      /^emd\s*:?\s*[₹$€£]?\s*\d+/i,  // EMD: 5000 or EMD 5000 at start
      /\bemd\s+of\s+[₹$€£]?\s*\d+/i,  // EMD of 5000
    ];
    
    // Check if any EMD value pattern matches
    for (const pattern of emdValuePatterns) {
      if (pattern.test(str)) {
        return false; // Filter out EMD values
      }
    }
    
    return true;
  });
};

// Smart deduplication that removes semantically similar items and filters N/A and EMD values
export const removeDuplicates = (arr) => {
  if (!Array.isArray(arr)) return arr;
  
  // First filter out N/A values and EMD values
  const filtered = filterEMD(filterNA(arr));
  
  const result = [];
  const seenMap = new Map(); // Map of normalized -> original item
  
  for (const item of filtered) {
    const normalized = normalizeForComparison(item);
    const itemStr = String(item);
    
    // Skip if normalized is empty (was N/A)
    if (!normalized) continue;
    
    // Check for exact normalized match
    if (seenMap.has(normalized)) {
      const existingItem = seenMap.get(normalized);
      // Keep the longer/more descriptive version
      if (itemStr.length > String(existingItem).length) {
        const index = result.indexOf(existingItem);
        if (index !== -1) {
          result[index] = item;
          seenMap.set(normalized, item);
        }
      }
      continue;
    }
    
    // Check for similar items (high similarity threshold)
    let isDuplicate = false;
    let bestMatch = null;
    let bestSimilarity = 0;
    
    for (const [seenNormalized, seenItem] of seenMap.entries()) {
      const similarity = calculateSimilarity(normalized, seenNormalized);
      // If similarity is high (>= 0.65), consider it a duplicate
      if (similarity >= 0.65 && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { normalized: seenNormalized, item: seenItem };
      }
    }
    
    if (bestMatch && bestSimilarity >= 0.65) {
      isDuplicate = true;
      // Keep the longer/more descriptive version
      if (itemStr.length > String(bestMatch.item).length) {
        const index = result.indexOf(bestMatch.item);
        if (index !== -1) {
          result[index] = item;
          seenMap.delete(bestMatch.normalized);
          seenMap.set(normalized, item);
        }
      }
    }
    
    if (!isDuplicate) {
      result.push(item);
      seenMap.set(normalized, item);
    }
  }
  
  return result;
};

// Helper function to deduplicate object structure (with categories)
export const deduplicateObjectStructure = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  Object.entries(obj).forEach(([category, items]) => {
    if (Array.isArray(items)) {
      // removeDuplicates already filters EMD values
      const uniqueItems = removeDuplicates(items);
      if (uniqueItems.length > 0) {
        result[category] = uniqueItems;
      }
    } else {
      result[category] = items;
    }
  });
  return result;
};

// Process department data to deduplicate and filter N/A
export const processDepartmentData = (data) => {
  if (!data) return data;
  
  const processed = { ...data };
  
  // Process keyPoints
  if (processed.keyPoints) {
    processed.keyPoints = typeof processed.keyPoints === 'object' && !Array.isArray(processed.keyPoints)
      ? deduplicateObjectStructure(processed.keyPoints)
      : removeDuplicates(processed.keyPoints);
  }
  
  // Process complianceRequirements
  if (processed.complianceRequirements) {
    processed.complianceRequirements = typeof processed.complianceRequirements === 'object' && !Array.isArray(processed.complianceRequirements)
      ? deduplicateObjectStructure(processed.complianceRequirements)
      : removeDuplicates(processed.complianceRequirements);
  }
  
  // Process riskAreas
  if (processed.riskAreas) {
    processed.riskAreas = typeof processed.riskAreas === 'object' && !Array.isArray(processed.riskAreas)
      ? deduplicateObjectStructure(processed.riskAreas)
      : removeDuplicates(processed.riskAreas);
  }
  
  // Process actionItems
  if (processed.actionItems) {
    processed.actionItems = removeDuplicates(processed.actionItems);
  }
  
  // Process criticalDates
  if (processed.criticalDates && Array.isArray(processed.criticalDates)) {
    const seen = new Set();
    processed.criticalDates = processed.criticalDates.filter((item) => {
      // Filter out N/A dates and descriptions
      const date = String(item.date || '').trim().toLowerCase();
      const desc = String(item.description || '').trim().toLowerCase();
      if (date === 'n/a' || date === 'na' || desc === 'n/a' || desc === 'na' || !date || !desc) {
        return false;
      }
      const key = `${date}_${desc}`.trim().toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  // Process requiredComplianceDocuments
  if (processed.requiredComplianceDocuments) {
    processed.requiredComplianceDocuments = filterNA(processed.requiredComplianceDocuments);
  }
  
  // Process requiredDocuments (fallback field)
  if (processed.requiredDocuments) {
    processed.requiredDocuments = filterNA(processed.requiredDocuments);
  }
  
  // Process successFactors (for BidManagement) - ensure all arrays are deduplicated
  if (processed.successFactors) {
    if (typeof processed.successFactors === 'object' && !Array.isArray(processed.successFactors)) {
      // Deduplicate each category array, including the new special fields
      const deduplicatedSuccessFactors = {};
      Object.entries(processed.successFactors).forEach(([category, items]) => {
        if (Array.isArray(items)) {
          // Special handling for preQualificationCriteria - preserve all items, only filter N/A
          if (category === 'preQualificationCriteria') {
            const filteredItems = filterNA(items);
            if (filteredItems.length > 0) {
              deduplicatedSuccessFactors[category] = filteredItems;
            }
          } else {
            const uniqueItems = removeDuplicates(items);
            if (uniqueItems.length > 0) {
              deduplicatedSuccessFactors[category] = uniqueItems;
            }
          }
        } else {
          deduplicatedSuccessFactors[category] = items;
        }
      });
      processed.successFactors = deduplicatedSuccessFactors;
    } else if (Array.isArray(processed.successFactors)) {
      processed.successFactors = removeDuplicates(processed.successFactors);
    }
  }
  
  // Process criticalRequirements (for Technical)
  if (processed.criticalRequirements) {
    if (typeof processed.criticalRequirements === 'object' && !Array.isArray(processed.criticalRequirements)) {
      processed.criticalRequirements = deduplicateObjectStructure(processed.criticalRequirements);
    } else if (Array.isArray(processed.criticalRequirements)) {
      processed.criticalRequirements = removeDuplicates(processed.criticalRequirements);
    }
  }
  
  // Process riskFactors (for BidManagement)
  if (processed.riskFactors) {
    if (typeof processed.riskFactors === 'object' && !Array.isArray(processed.riskFactors)) {
      // Deduplicate each array within riskFactors
      const deduplicatedRiskFactors = {};
      Object.entries(processed.riskFactors).forEach(([category, items]) => {
        if (Array.isArray(items)) {
          const uniqueItems = removeDuplicates(items);
          if (uniqueItems.length > 0) {
            deduplicatedRiskFactors[category] = uniqueItems;
          }
        } else {
          deduplicatedRiskFactors[category] = items;
        }
      });
      processed.riskFactors = deduplicatedRiskFactors;
    } else if (Array.isArray(processed.riskFactors)) {
      processed.riskFactors = removeDuplicates(processed.riskFactors);
    }
  }
  
  return processed;
};

