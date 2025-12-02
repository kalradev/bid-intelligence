/**
 * Cybersecurity Product OEM Identification Agent
 * 
 * Goal: Identify OEM manufacturers for products with missing or unspecified OEM information
 * 
 * Features:
 * - Suggests 2-3 possible OEM manufacturers for each product
 * - Returns strict JSON format only (no extra text)
 * - Includes confidence levels (high/medium/low)
 * - Supports both Indian and Global OEMs
 */

const { getCategoryOEMs, getAllIndianOEMs, getAllGlobalOEMs } = require('../data/miiDatabase');

/**
 * OEM Identification Agent
 * Analyzes products and suggests OEMs with confidence levels
 * 
 * @param {Array} products - Array of products to analyze
 * @returns {Array} - JSON array of OEM suggestions
 */
const identifyMissingOEMs = (products) => {
    const results = [];

    for (const product of products) {
        const productName = product.productName || product.name || '';
        const category = product.category || 'Unknown';
        const currentOEM = product.oem || 'Unspecified';

        // Skip products that already have valid OEMs
        if (currentOEM && 
            currentOEM !== 'Unspecified' && 
            currentOEM !== 'N/A' && 
            currentOEM !== 'Unknown' &&
            currentOEM.trim() !== '') {
            continue; // Skip - already has OEM
        }

        // Product needs OEM identification
        const suggestions = getSuggestedOEMs(productName, category);
        
        if (suggestions && suggestions.length > 0) {
            results.push({
                productName: productName,
                suggestedOEMs: suggestions,
                confidence: calculateOverallConfidence(suggestions)
            });
        } else {
            // No OEMs found
            results.push({
                productName: productName,
                suggestedOEMs: [],
                confidence: 'low'
            });
        }
    }

    return results;
};

/**
 * Get suggested OEMs for a product based on keywords and category
 * 
 * @param {string} productName - Product name
 * @param {string} category - Product category
 * @returns {Array} - Array of suggested OEMs with country info
 */
const getSuggestedOEMs = (productName, category) => {
    const productLower = productName.toLowerCase();
    const categoryLower = category.toLowerCase();
    const suggestions = [];

    // SECURITY PRODUCTS
    if (categoryLower.includes('security') || categoryLower.includes('software')) {
        // Firewall Products
        if (productLower.includes('firewall') || productLower.includes('ngfw')) {
            suggestions.push(
                { oem: 'Fortinet', country: 'Global' },
                { oem: 'Palo Alto Networks', country: 'Global' },
                { oem: 'Check Point', country: 'Global' }
            );
        }
        // Endpoint Protection
        else if (productLower.includes('endpoint') || productLower.includes('antivirus') || productLower.includes('edr')) {
            suggestions.push(
                { oem: 'QuickHeal', country: 'Indian' },
                { oem: 'K7 Computing', country: 'Indian' },
                { oem: 'Trend Micro', country: 'Global' }
            );
        }
        // DLP (Data Loss Prevention)
        else if (productLower.includes('dlp') || productLower.includes('data loss')) {
            suggestions.push(
                { oem: 'Symantec DLP', country: 'Global' },
                { oem: 'McAfee DLP', country: 'Global' },
                { oem: 'Forcepoint DLP', country: 'Global' }
            );
        }
        // SIEM / Log Management
        else if (productLower.includes('siem') || productLower.includes('log') || productLower.includes('analyzer')) {
            suggestions.push(
                { oem: 'Splunk', country: 'Global' },
                { oem: 'IBM QRadar', country: 'Global' },
                { oem: 'LogRhythm', country: 'Global' }
            );
        }
        // IPS/IDS
        else if (productLower.includes('ips') || productLower.includes('ids') || productLower.includes('intrusion')) {
            suggestions.push(
                { oem: 'Cisco Firepower', country: 'Global' },
                { oem: 'Palo Alto Networks', country: 'Global' },
                { oem: 'Fortinet', country: 'Global' }
            );
        }
        // Web Gateway / Proxy
        else if (productLower.includes('proxy') || productLower.includes('web gateway') || productLower.includes('secure gateway')) {
            suggestions.push(
                { oem: 'Zscaler', country: 'Global' },
                { oem: 'McAfee Web Gateway', country: 'Global' },
                { oem: 'Forcepoint', country: 'Global' }
            );
        }
        // DDoS Protection
        else if (productLower.includes('ddos') || productLower.includes('anti-ddos')) {
            suggestions.push(
                { oem: 'Arbor Networks', country: 'Global' },
                { oem: 'Cloudflare', country: 'Global' },
                { oem: 'Akamai', country: 'Global' }
            );
        }
        // Generic Security
        else {
            suggestions.push(
                { oem: 'Fortinet', country: 'Global' },
                { oem: 'Palo Alto Networks', country: 'Global' },
                { oem: 'Cisco', country: 'Global' }
            );
        }
    }

    // NETWORKING PRODUCTS
    else if (categoryLower.includes('network') || categoryLower.includes('networking')) {
        // Switches
        if (productLower.includes('switch')) {
            suggestions.push(
                { oem: 'Cisco Catalyst', country: 'Global' },
                { oem: 'HPE Aruba', country: 'Global' },
                { oem: 'Juniper Networks', country: 'Global' }
            );
        }
        // Routers
        else if (productLower.includes('router')) {
            suggestions.push(
                { oem: 'Cisco', country: 'Global' },
                { oem: 'Juniper Networks', country: 'Global' },
                { oem: 'HPE', country: 'Global' }
            );
        }
        // Wireless / WiFi
        else if (productLower.includes('wireless') || productLower.includes('wifi') || productLower.includes('access point')) {
            suggestions.push(
                { oem: 'Cisco Meraki', country: 'Global' },
                { oem: 'Aruba', country: 'Global' },
                { oem: 'Ruckus', country: 'Global' }
            );
        }
        // Fiber / OFC
        else if (productLower.includes('fiber') || productLower.includes('ofc') || productLower.includes('optical')) {
            suggestions.push(
                { oem: 'Corning', country: 'Global' },
                { oem: 'CommScope', country: 'Global' },
                { oem: 'Sterlite Technologies', country: 'Indian' }
            );
        }
        // Generic Networking
        else {
            suggestions.push(
                { oem: 'Cisco', country: 'Global' },
                { oem: 'HPE', country: 'Global' },
                { oem: 'Juniper Networks', country: 'Global' }
            );
        }
    }

    // HARDWARE PRODUCTS
    else if (categoryLower.includes('hardware') || categoryLower.includes('server') || categoryLower.includes('storage')) {
        // Servers
        if (productLower.includes('server')) {
            suggestions.push(
                { oem: 'Dell PowerEdge', country: 'Global' },
                { oem: 'HP ProLiant', country: 'Global' },
                { oem: 'Lenovo ThinkSystem', country: 'Global' }
            );
        }
        // Storage
        else if (productLower.includes('storage') || productLower.includes('san') || productLower.includes('nas')) {
            suggestions.push(
                { oem: 'NetApp', country: 'Global' },
                { oem: 'Dell EMC', country: 'Global' },
                { oem: 'HPE', country: 'Global' }
            );
        }
        // Laptops
        else if (productLower.includes('laptop') || productLower.includes('notebook')) {
            suggestions.push(
                { oem: 'Dell Latitude', country: 'Global' },
                { oem: 'HP EliteBook', country: 'Global' },
                { oem: 'Lenovo ThinkPad', country: 'Global' }
            );
        }
        // Desktop
        else if (productLower.includes('desktop') || productLower.includes('workstation')) {
            suggestions.push(
                { oem: 'Dell OptiPlex', country: 'Global' },
                { oem: 'HP ProDesk', country: 'Global' },
                { oem: 'Lenovo ThinkCentre', country: 'Global' }
            );
        }
        // Generic Hardware
        else {
            suggestions.push(
                { oem: 'Dell', country: 'Global' },
                { oem: 'HP', country: 'Global' },
                { oem: 'Lenovo', country: 'Global' }
            );
        }
    }

    // SOFTWARE / LICENSE
    else if (categoryLower.includes('software') || categoryLower.includes('license')) {
        // Database
        if (productLower.includes('database') || productLower.includes('sql') || productLower.includes('db')) {
            suggestions.push(
                { oem: 'Oracle', country: 'Global' },
                { oem: 'Microsoft SQL Server', country: 'Global' },
                { oem: 'IBM Db2', country: 'Global' }
            );
        }
        // Virtualization
        else if (productLower.includes('virtual') || productLower.includes('vm') || productLower.includes('hypervisor')) {
            suggestions.push(
                { oem: 'VMware', country: 'Global' },
                { oem: 'Microsoft Hyper-V', country: 'Global' },
                { oem: 'Citrix', country: 'Global' }
            );
        }
        // Backup
        else if (productLower.includes('backup') || productLower.includes('recovery')) {
            suggestions.push(
                { oem: 'Veeam', country: 'Global' },
                { oem: 'Veritas', country: 'Global' },
                { oem: 'Commvault', country: 'Global' }
            );
        }
        // Generic Software
        else {
            suggestions.push(
                { oem: 'Microsoft', country: 'Global' },
                { oem: 'Oracle', country: 'Global' },
                { oem: 'SAP', country: 'Global' }
            );
        }
    }

    // SERVICES
    else if (categoryLower.includes('service') || categoryLower.includes('support')) {
        if (productLower.includes('incident') || productLower.includes('response')) {
            suggestions.push(
                { oem: 'Tata Consultancy Services', country: 'Indian' },
                { oem: 'Wipro', country: 'Indian' },
                { oem: 'IBM Services', country: 'Global' }
            );
        } else {
            suggestions.push(
                { oem: 'Tata Projects', country: 'Indian' },
                { oem: 'HCL Technologies', country: 'Indian' },
                { oem: 'Accenture', country: 'Global' }
            );
        }
    }

    // FALLBACK - Use category database
    if (suggestions.length === 0) {
        const categoryOEMs = getCategoryOEMs(category);
        
        // Prefer Indian OEMs first
        if (categoryOEMs.indian && categoryOEMs.indian.length > 0) {
            categoryOEMs.indian.slice(0, 2).forEach(oem => {
                suggestions.push({ oem: oem, country: 'Indian' });
            });
        }
        
        // Add Global OEMs
        if (categoryOEMs.global && categoryOEMs.global.length > 0) {
            const remaining = 3 - suggestions.length;
            categoryOEMs.global.slice(0, remaining).forEach(oem => {
                suggestions.push({ oem: oem, country: 'Global' });
            });
        }

        // Absolute fallback
        if (suggestions.length === 0) {
            suggestions.push(
                { oem: 'Cisco', country: 'Global' },
                { oem: 'IBM', country: 'Global' },
                { oem: 'HPE', country: 'Global' }
            );
        }
    }

    // Return top 2-3 suggestions
    return suggestions.slice(0, 3);
};

/**
 * Calculate overall confidence based on suggestions
 * 
 * @param {Array} suggestions - Array of OEM suggestions
 * @returns {string} - Confidence level (high/medium/low)
 */
const calculateOverallConfidence = (suggestions) => {
    if (!suggestions || suggestions.length === 0) {
        return 'low';
    }

    // Check if suggestions include Indian OEMs (higher confidence for Indian market)
    const hasIndianOEM = suggestions.some(s => s.country === 'Indian');
    
    if (suggestions.length >= 3 && hasIndianOEM) {
        return 'high';
    } else if (suggestions.length >= 2) {
        return 'medium';
    } else {
        return 'low';
    }
};

/**
 * Generate agent report in strict JSON format
 * NO TEXT OUTSIDE JSON - only returns JSON array
 * 
 * @param {Array} products - Array of products
 * @returns {string} - Strict JSON string (no extra text)
 */
const generateAgentReport = (products) => {
    const analysis = identifyMissingOEMs(products);
    
    // Return ONLY JSON, no explanation or text
    return JSON.stringify(analysis, null, 2);
};

module.exports = {
    identifyMissingOEMs,
    getSuggestedOEMs,
    generateAgentReport
};


