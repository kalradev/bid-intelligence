/**
 * Specification Analyzer
 * Analyzes product specifications to infer OEM and model information
 */

/**
 * Infer OEM from product specifications
 * @param {string} specifications - Product specifications text
 * @param {string} productName - Product name
 * @returns {object|null} - OEM information with oem, confidence, and source, or null if no inference
 */
function inferOEMFromSpecs(specifications, productName) {
    if (!specifications || typeof specifications !== 'string') {
        return null;
    }

    const specsLower = specifications.toLowerCase();
    const productLower = (productName || '').toLowerCase();

    // Common OEM indicators in specifications
    const oemPatterns = {
        'cisco': ['cisco', 'catalyst', 'nexus', 'asa', 'ucs'],
        'microsoft': ['microsoft', 'windows', 'azure', 'office 365', 'sharepoint', 'active directory'],
        'dell': ['dell', 'poweredge', 'optiplex', 'latitude', 'precision'],
        'hp': ['hp', 'hewlett packard', 'proliant', 'elitebook', 'probook'],
        'hpe': ['hpe', 'hewlett packard enterprise', 'aruba', 'nimble'],
        'lenovo': ['lenovo', 'thinkpad', 'thinkcentre', 'thinkstation'],
        'ibm': ['ibm', 'power systems', 'system x', 'thinkpad'],
        'vmware': ['vmware', 'vsphere', 'vcenter', 'esxi'],
        'oracle': ['oracle', 'sun', 'sparc', 'exadata'],
        'juniper': ['juniper', 'junos', 'mx series', 'ex series'],
        'aruba': ['aruba', 'clearpass', 'airwave'],
        'fortinet': ['fortinet', 'fortigate', 'fortimanager'],
        'palo alto': ['palo alto', 'pan-os', 'panorama'],
        'check point': ['check point', 'gaia os'],
        'polycab': ['polycab', 'polycab cables'],
        'havells': ['havells', 'havells india'],
        'luminous': ['luminous', 'luminous india'],
        'su-kam': ['su-kam', 'sukam'],
        'matrix': ['matrix', 'matrix comsec'],
        'tata': ['tata', 'tata communications'],
        'reliance': ['reliance', 'reliance jio'],
        'bharti': ['bharti', 'airtel']
    };

    // Check for OEM mentions in specifications
    for (const [oem, patterns] of Object.entries(oemPatterns)) {
        for (const pattern of patterns) {
            if (specsLower.includes(pattern) || productLower.includes(pattern)) {
                // Capitalize each word in OEM name
                const formattedOEM = oem.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1)
                ).join(' ');
                return {
                    oem: formattedOEM,
                    confidence: 75,
                    source: 'specification_analysis'
                };
            }
        }
    }

    // Check for model numbers that might indicate OEM
    const modelPatterns = {
        'cisco': /\b(cat|ws-|nexus|asa-|ucs-)\d+/i,
        'dell': /\b(poweredge|optiplex|latitude|precision)\s*\d+/i,
        'hp': /\b(proliant|elitebook|probook)\s*\d+/i,
        'lenovo': /\b(thinkpad|thinkcentre|thinkstation)\s*\d+/i,
        'ibm': /\b(system\s*x|power\s*systems?|thinkpad)\s*\d+/i
    };

    for (const [oem, pattern] of Object.entries(modelPatterns)) {
        if (pattern.test(specifications) || pattern.test(productName)) {
            // Capitalize each word in OEM name
            const formattedOEM = oem.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            return {
                oem: formattedOEM,
                confidence: 70,
                source: 'model_pattern_analysis'
            };
        }
    }

    return null;
}

/**
 * Infer model from product specifications
 * @param {string} specifications - Product specifications text
 * @param {string} oem - OEM name
 * @param {string} productName - Product name
 * @returns {Promise<object|null>} - Model information with model, confidence, and source, or null if no inference
 */
async function inferModelFromSpecs(specifications, oem, productName) {
    if (!specifications || typeof specifications !== 'string') {
        return null;
    }

    const specsText = specifications;
    const oemLower = (oem || '').toLowerCase();
    const productLower = (productName || '').toLowerCase();

    // Common model number patterns by OEM
    const modelPatterns = {
        'cisco': [
            /\b(catalyst|cats?)\s*(\d{4,5}[a-z]?)/i,
            /\b(nexus|nex-?)\s*(\d{4,5}[a-z]?)/i,
            /\b(asa|asav?)\s*(\d{4,5}[a-z]?)/i,
            /\b(ws-|wsc-)([a-z0-9\-]+)/i,
            /\b(ucs-?)([a-z0-9\-]+)/i
        ],
        'microsoft': [
            /\b(windows\s*server\s*)?(\d{4}|[a-z0-9]+)/i,
            /\b(office\s*)?(\d{4}|[a-z0-9]+)/i,
            /\b(azure\s*)?([a-z0-9\-]+)/i
        ],
        'dell': [
            /\b(poweredge|pe-?)(\d{4,5}[a-z]?)/i,
            /\b(optiplex|op-?)(\d{4,5}[a-z]?)/i,
            /\b(latitude|lat-?)(\d{4,5}[a-z]?)/i,
            /\b(precision|pre-?)(\d{4,5}[a-z]?)/i
        ],
        'hp': [
            /\b(proliant|dl|ml|bl)\s*(\d{4,5}[a-z]?)/i,
            /\b(elitebook|elite-?)\s*(\d{4,5}[a-z]?)/i,
            /\b(probook|pro-?)\s*(\d{4,5}[a-z]?)/i
        ],
        'hpe': [
            /\b(proliant|dl|ml|bl)\s*(\d{4,5}[a-z]?)/i,
            /\b(aruba|ap-?)(\d{2,4}[a-z]?)/i,
            /\b(nimble|af-?)(\d{2,4}[a-z]?)/i
        ],
        'lenovo': [
            /\b(thinkpad|t|p|x|e)\s*(\d{3,5}[a-z]?)/i,
            /\b(thinkcentre|m|s)\s*(\d{3,5}[a-z]?)/i,
            /\b(thinkstation|p)\s*(\d{3,5}[a-z]?)/i
        ]
    };

    // Try to find model patterns specific to the OEM
    if (oemLower && modelPatterns[oemLower]) {
        for (const pattern of modelPatterns[oemLower]) {
            const match = specsText.match(pattern) || productName.match(pattern);
            if (match) {
                // Extract model number (usually the second capture group)
                const model = match[2] || match[0];
                if (model && model.length >= 2) {
                    return {
                        model: model.trim(),
                        confidence: 75,
                        source: 'specification_model_pattern'
                    };
                }
            }
        }
    }

    // Generic model number patterns (alphanumeric codes)
    const genericPatterns = [
        /\b([a-z]{1,3}[-]?\d{3,5}[a-z]?)\b/i,  // e.g., CAT-3850, WS-C2960
        /\b(model[:\s]+)?([a-z0-9\-]{4,12})\b/i,  // e.g., Model: ABC123
        /\b(part[:\s]+number[:\s]+)?([a-z0-9\-]{4,12})\b/i  // Part number
    ];

    // Common specification keywords that should NOT be treated as model numbers
    const invalidModelKeywords = [
        'specification', 'product', 'description', 'width', 'height', 'length', 
        'depth', 'capacity', 'size', 'dimension', 'inches', 'inch', 'cm', 'mm',
        'based', 'type', 'standard', 'model', 'make', 'manufacturer', 'brand',
        'color', 'weight', 'warranty', 'installation', 'power', 'voltage',
        'current', 'frequency', 'rating', 'certification', 'compliance',
        'approval', 'standard', 'grade', 'class', 'category', 'series',
        'version', 'edition', 'material', 'finish', 'coating', 'surface'
    ];

    for (const pattern of genericPatterns) {
        const match = specsText.match(pattern);
        if (match) {
            const model = (match[2] || match[1] || match[0]).trim();
            const modelLower = model.toLowerCase();
            
            // Filter out common false positives (specification attributes, not model numbers)
            if (model && 
                model.length >= 3 && 
                !invalidModelKeywords.includes(modelLower) &&
                !invalidModelKeywords.some(keyword => modelLower.includes(keyword)) &&
                // Ensure it looks like a model number (contains numbers or is alphanumeric code)
                (/\d/.test(model) || /^[a-z]{2,}\d/i.test(model))) {
                return {
                    model: model,
                    confidence: 60,
                    source: 'generic_model_pattern'
                };
            }
        }
    }

    return null;
}

module.exports = {
    inferOEMFromSpecs,
    inferModelFromSpecs
};
