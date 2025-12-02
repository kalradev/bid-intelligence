/**
 * Comprehensive MII (Make In India) Database
 * Contains verified Indian and Global OEMs across all categories
 */

const indianOEMs = {
    // Electronics & Electrical
    electrical: [
        'Havells', 'Polycab', 'Anchor', 'Finolex', 'KEI Industries', 'RR Kabel', 
        'V-Guard', 'Crompton Greaves', 'Bajaj Electricals', 'Orient Electric',
        'Syska', 'Usha', 'Surya Roshni', 'HPL Electric', 'GM Modular',
        'Legrand India', 'Indo Asian Switchgear', 'Precision Wires India',
        'Luminous', 'Microtek', 'Su-Kam', 'Exide'
    ],
    
    // IT Hardware & Software
    it: [
        'HCL Technologies', 'Wipro', 'Infosys', 'TCS', 'Tech Mahindra',
        'Mindtree', 'Mphasis', 'L&T Infotech', 'Birlasoft', 'Cyient',
        'HCL Infosystems', 'Zensar', 'Persistent Systems', 'QuickHeal',
        'eScan', 'K7 Computing', 'Paladion', 'Sify Technologies'
    ],
    
    // HVAC & Air Conditioning
    hvac: [
        'Voltas', 'Blue Star', 'Lloyd', 'Videocon', 'Onida',
        'Godrej', 'Microtek', 'Hitachi India', 'Carrier Midea India',
        'Amber Enterprises', 'Symphony', 'Kenstar', 'Usha International'
    ],
    
    // Networking & Security
    networking: [
        'Matrix Comsec', 'eSSL Security', 'CP Plus', 'Hikvision India',
        'Honeywell India', 'Zicom', 'Godrej Security Solutions',
        'Securens', 'Visiontek', 'ACTi India', 'Dahua India'
    ],
    
    // Automotive & Manufacturing
    automotive: [
        'Tata Motors', 'Mahindra', 'Bajaj Auto', 'TVS Motor', 'Hero MotoCorp',
        'Ashok Leyland', 'Eicher Motors', 'Force Motors', 'Escorts',
        'Bharat Forge', 'Motherson Sumi', 'Amara Raja Batteries', 'Exide Industries'
    ],
    
    // Construction & Building Materials
    construction: [
        'UltraTech Cement', 'ACC Cement', 'Ambuja Cement', 'Shree Cement',
        'JK Cement', 'Dalmia Cement', 'Birla White', 'Asian Paints',
        'Berger Paints', 'Nerolac', 'JSW Steel', 'Tata Steel',
        'SAIL', 'Hindalco', 'Vedanta', 'Jindal Steel',
        'Supreme Industries', 'Astral Pipes', 'Prince Pipes', 'Apollo Pipes',
        'L&T Construction', 'Tata Projects', 'Gammon India', 'NCC Limited',
        'Shapoorji Pallonji', 'HCC', 'Simplex Infrastructures'
    ],
    
    // Furniture & Interior
    furniture: [
        'Godrej Interio', 'Durian', 'Nilkamal', 'Featherlite',
        'Wipro Furniture', 'BPIL', 'Spacewood', 'HomeTown',
        'Sleepwell', 'Kurlon', 'Springfit'
    ],
    
    // Medical & Healthcare
    medical: [
        'Wipro GE Healthcare', 'BPL Medical', 'Trivitron Healthcare',
        'Polymed', 'Transasia Bio-Medicals', 'Hindustan Syringes',
        'Dr. Reddy\'s', 'Sun Pharma', 'Cipla', 'Lupin',
        'Biocon', 'Cadila Healthcare', 'Aurobindo Pharma'
    ],
    
    // Telecommunications & Fiber Optics
    telecom: [
        'Bharti Airtel', 'Reliance Jio', 'BSNL', 'MTNL',
        'Sterlite Technologies', 'Tejas Networks', 'ITI Limited',
        'Tata Communications', 'Vi (Vodafone Idea)',
        'Birla Cable', 'Universal Cables'
    ],
    
    // Defense & Aerospace
    defense: [
        'HAL (Hindustan Aeronautics)', 'BEL (Bharat Electronics)',
        'BEML', 'BDL (Bharat Dynamics)', 'GRSE (Garden Reach Shipbuilders)',
        'MDL (Mazagon Dock)', 'Ordnance Factory Board', 'L&T Defence'
    ],
    
    // Industrial Machinery
    machinery: [
        'L&T (Larsen & Toubro)', 'BHEL', 'Thermax', 'Kirloskar',
        'Greaves Cotton', 'Cummins India', 'ABB India',
        'Crompton Greaves Consumer', 'KSB Pumps'
    ],
    
    // Solar & Renewable Energy
    solar: [
        'Tata Power Solar', 'Adani Solar', 'Vikram Solar', 'Waaree Energies',
        'Premier Solar', 'Renewsys', 'Goldi Solar', 'Websol Energy',
        'Jupiter Solar', 'Emmvee Solar'
    ],
    
    // Fire Safety & Security
    fireSafety: [
        'Ceasefire Industries', 'Agni Devices', 'Kanex',
        'Minimax Viking India', 'Safe Pro', 'Firefly'
    ],
    
    // Printing & Imaging
    printing: [
        'TVS Electronics', 'Ricoh India', 'Canon India', 'HP India',
        'Epson India', 'Konica Minolta India'
    ],
    
    // Consumer Electronics
    consumer: [
        'Dixon Technologies', 'Micromax', 'Lava', 'Karbonn',
        'iBall', 'Intex', 'BPL'
    ]
};

const globalOEMs = {
    // IT & Computing
    it: [
        'Microsoft', 'Apple', 'Google', 'IBM', 'Oracle', 'SAP', 'Adobe',
        'Dell', 'HP', 'Lenovo', 'Acer', 'ASUS', 'MSI', 'Intel', 'AMD',
        'Nvidia', 'Seagate', 'Western Digital', 'Kingston', 'Corsair',
        'Logitech', 'Razer', 'Cooler Master'
    ],
    
    // Networking & Security
    networking: [
        'Cisco', 'Juniper Networks', 'Aruba Networks', 'Palo Alto Networks',
        'Fortinet', 'Check Point', 'F5 Networks', 'Extreme Networks',
        'Ubiquiti', 'Netgear', 'TP-Link', 'D-Link', 'Linksys',
        'Sophos', 'Trend Micro', 'McAfee', 'Symantec', 'Kaspersky'
    ],
    
    // Electrical & Automation
    electrical: [
        'Siemens', 'Schneider Electric', 'ABB', 'Honeywell', 'Rockwell Automation',
        'Eaton', 'Emerson', 'GE', 'Mitsubishi Electric', 'Omron',
        'Allen-Bradley', 'Phoenix Contact', 'Weidmuller', 'Legrand'
    ],
    
    // HVAC & Climate Control
    hvac: [
        'Daikin', 'Carrier', 'Trane', 'York', 'Mitsubishi Heavy Industries',
        'Fujitsu', 'Gree', 'Midea',
        'Rheem', 'Lennox', 'Goodman', 'Bosch Climate'
    ],
    
    // Telecommunications
    telecom: [
        'Ericsson', 'Nokia', 'Qualcomm', 'Broadcom',
        'Alcatel-Lucent'
    ],
    
    // Industrial Machinery
    machinery: [
        'Caterpillar', 'Komatsu', 'Hitachi Construction', 'Volvo Construction',
        'JCB', 'Liebherr', 'Doosan', 'Terex', 'Manitowoc', 'Tadano',
        'Atlas Copco', 'Ingersoll Rand', 'Gardner Denver', 'Sullair'
    ],
    
    // Automotive
    automotive: [
        'Toyota', 'Honda', 'Ford', 'GM', 'Volkswagen', 'BMW', 'Mercedes-Benz',
        'Audi', 'Tesla', 'Nissan', 'Hyundai', 'Kia', 'Mazda', 'Subaru',
        'Volvo', 'Jaguar', 'Land Rover', 'Ferrari', 'Porsche'
    ],
    
    // Medical Equipment
    medical: [
        'GE Healthcare', 'Siemens Healthineers', 'Philips Healthcare',
        'Medtronic', 'Johnson & Johnson', 'Abbott', 'Roche',
        'Becton Dickinson', 'Stryker', 'Boston Scientific',
        'Olympus Medical', 'Karl Storz', 'Mindray'
    ],
    
    // Laboratory Equipment
    laboratory: [
        'Thermo Fisher Scientific', 'Agilent Technologies', 'PerkinElmer',
        'Shimadzu', 'Waters Corporation', 'Bruker', 'JEOL',
        'Eppendorf', 'Sartorius', 'Mettler Toledo'
    ],
    
    // Security & Surveillance
    security: [
        'Axis Communications', 'Bosch Security', 'Honeywell Security',
        'Pelco', 'Avigilon', 'Milestone Systems', 'Genetec',
        'Hanwha Techwin'
    ],
    
    // Audio Visual
    audioVisual: [
        'Bose', 'JBL', 'Harman',
        'Yamaha', 'Denon', 'Marantz', 'Pioneer', 'Onkyo',
        'Crestron', 'Extron', 'AMX', 'Polycom', 'Logitech ConferenceCam'
    ],
    
    // Solar & Energy
    solar: [
        'SunPower', 'First Solar', 'Canadian Solar', 'Trina Solar',
        'JA Solar', 'Jinko Solar', 'Hanwha Q CELLS', 'LONGi Solar',
        'REC Solar', 'SolarEdge', 'Enphase Energy', 'Fronius'
    ],
    
    // Fire Safety
    fireSafety: [
        'Tyco', 'Johnson Controls', 'Notifier', 'Simplex',
        'Hochiki', 'System Sensor', 'Kidde', 'Fireye',
        'Fike', 'Minimax', 'Viking Group'
    ],
    
    // Software Platforms
    software: [
        'Salesforce', 'Workday', 'ServiceNow', 'Atlassian', 'Slack',
        'Zoom', 'Dropbox', 'Box', 'Splunk', 'Tableau', 'Qlik',
        'MicroStrategy', 'SAS', 'TIBCO', 'BMC Software'
    ],
    
    // Consumer Electronics
    consumer: [
        'Sony', 'Samsung', 'LG', 'Panasonic', 'Sharp', 'Toshiba',
        'Xiaomi', 'Oppo', 'Vivo', 'Realme', 'OnePlus', 'Motorola',
        'Google Pixel', 'Huawei', 'ZTE', 'Alcatel'
    ]
};

/**
 * Get all Indian OEMs as a flat array
 */
const getAllIndianOEMs = () => {
    return Object.values(indianOEMs).flat();
};

/**
 * Get all Global OEMs as a flat array
 */
const getAllGlobalOEMs = () => {
    return Object.values(globalOEMs).flat();
};

/**
 * Check if a company is an Indian OEM
 * @param {string} companyName - Company name to check
 * @returns {boolean} - True if Indian OEM
 */
const isIndianOEM = (companyName) => {
    if (!companyName || companyName === 'Unspecified' || companyName === 'N/A') {
        return false;
    }
    
    const allIndian = getAllIndianOEMs();
    const normalized = companyName.toLowerCase().trim();
    
    // Check for exact match first
    if (allIndian.some(oem => oem.toLowerCase() === normalized)) {
        return true;
    }
    
    // Check for word boundary matches (e.g., "HCL" in "HCL Technologies")
    for (const oem of allIndian) {
        const oemLower = oem.toLowerCase();
        // Check if company name matches as whole word in OEM name
        const regex = new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(oem)) {
            return true;
        }
        // Or if OEM name matches as whole word in company name
        const reverseRegex = new RegExp(`\\b${oemLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (reverseRegex.test(companyName)) {
            return true;
        }
    }
    
    return false;
};

/**
 * Check if a company is a Global OEM
 * @param {string} companyName - Company name to check
 * @returns {boolean} - True if Global OEM
 */
const isGlobalOEM = (companyName) => {
    if (!companyName || companyName === 'Unspecified' || companyName === 'N/A') {
        return false;
    }
    
    const allGlobal = getAllGlobalOEMs();
    const normalized = companyName.toLowerCase().trim();
    
    // Check for exact match first
    if (allGlobal.some(oem => oem.toLowerCase() === normalized)) {
        return true;
    }
    
    // Check for word boundary matches
    for (const oem of allGlobal) {
        const oemLower = oem.toLowerCase();
        // Check if company name matches as whole word in OEM name
        const regex = new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(oem)) {
            return true;
        }
        // Or if OEM name matches as whole word in company name
        const reverseRegex = new RegExp(`\\b${oemLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (reverseRegex.test(companyName)) {
            return true;
        }
    }
    
    return false;
};

/**
 * Classify MII status of a company
 * @param {string} companyName - Company name
 * @param {string} category - Product category
 * @returns {string} - MII status classification
 * 
 * ✅ NEVER returns "Requires Review" - only "Indian OEM" or "Global OEM"
 */
const classifyMIIStatus = (companyName, category = '') => {
    if (!companyName || companyName === 'Unspecified' || companyName === 'N/A') {
        // Check if category suggests local manufacturing
        const localCategories = ['civil', 'construction', 'cement', 'brick', 'sand', 'aggregate', 'service', 'installation'];
        if (category && localCategories.some(cat => category.toLowerCase().includes(cat))) {
            return 'Indian OEM'; // Changed from 'Likely Indian' to 'Indian OEM'
        }
        return 'Global OEM'; // ✅ Default to Global instead of "Requires Review"
    }
    
    if (isIndianOEM(companyName)) {
        return 'Indian OEM';
    }
    
    if (isGlobalOEM(companyName)) {
        return 'Global OEM';
    }
    
    // Check for explicit MII mentions
    const normalized = companyName.toLowerCase();
    if (normalized.includes('make in india') || 
        normalized.includes('mii') || 
        normalized.includes('local supplier') ||
        normalized.includes('indian') ||
        normalized.includes('bharat')) {
        return 'Indian OEM'; // Changed from 'MII-Compliant' to 'Indian OEM'
    }
    
    // ✅ If not found in database, check if it sounds Indian
    const indianIndicators = ['india', 'indian', 'bharat', 'desi', 'hindustan', 'tata', 'mahindra', 'bajaj', 'larsen', 'toubro'];
    if (indianIndicators.some(indicator => normalized.includes(indicator))) {
        return 'Indian OEM';
    }
    
    // ✅ DEFAULT: Assume Global OEM (NEVER "Requires Review")
    return 'Global OEM';
};

/**
 * Get category-specific OEM suggestions
 * @param {string} category - Product category
 * @returns {object} - Suggested Indian and Global OEMs for the category
 */
const getCategoryOEMs = (category) => {
    const normalizedCategory = category.toLowerCase();
    
    const categoryMap = {
        electrical: { indian: indianOEMs.electrical, global: globalOEMs.electrical },
        electronics: { indian: indianOEMs.electrical, global: globalOEMs.electrical },
        it: { indian: indianOEMs.it, global: globalOEMs.it },
        software: { indian: indianOEMs.it, global: globalOEMs.software },
        license: { indian: indianOEMs.it, global: globalOEMs.software },
        licenses: { indian: indianOEMs.it, global: globalOEMs.software },
        hardware: { indian: indianOEMs.it, global: globalOEMs.it },
        hvac: { indian: indianOEMs.hvac, global: globalOEMs.hvac },
        networking: { indian: indianOEMs.networking, global: globalOEMs.networking },
        security: { indian: indianOEMs.networking, global: globalOEMs.security },
        construction: { indian: indianOEMs.construction, global: [] },
        furniture: { indian: indianOEMs.furniture, global: [] },
        medical: { indian: indianOEMs.medical, global: globalOEMs.medical },
        automotive: { indian: indianOEMs.automotive, global: globalOEMs.automotive },
        telecom: { indian: indianOEMs.telecom, global: globalOEMs.telecom },
        solar: { indian: indianOEMs.solar, global: globalOEMs.solar },
        fire: { indian: indianOEMs.fireSafety, global: globalOEMs.fireSafety }
    };
    
    // Find matching category
    for (const [key, value] of Object.entries(categoryMap)) {
        if (normalizedCategory.includes(key)) {
            return value;
        }
    }
    
    // Default fallback - return global tech companies
    return { indian: [], global: ['Microsoft', 'Cisco', 'HP', 'Dell', 'Oracle'] };
};

module.exports = {
    indianOEMs,
    globalOEMs,
    getAllIndianOEMs,
    getAllGlobalOEMs,
    isIndianOEM,
    isGlobalOEM,
    classifyMIIStatus,
    getCategoryOEMs
};

