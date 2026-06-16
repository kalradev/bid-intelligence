"""
MII (Make in India) Database - Indian and Global OEM lists for tender analysis
Used for classifying OEMs and providing context to AI extraction
"""
from typing import List

# Indian OEMs - Make in India compliant manufacturers
INDIAN_OEMS: List[str] = [
    "Godrej", "Durian", "Featherlite", "Havells", "Syska", "Crompton", "Bajaj",
    "V-Guard", "Orient Electric", "Polycab", "Finolex", "APAR", "Luminous",
    "Su-Kam", "Exide", "Amaron", "HPL", "Legrand", "Schneider", "Delta",
    "Wipro", "Surya", "Eveready", "Panasonic India", "Voltas", "Blue Star",
    "Lloyd", "Carrier India", "Daikin India", "Hitachi India", "Godrej Appliances",
    "IFB", "Whirlpool India", "LG India", "Samsung India", "Dell India", "HP India",
    "Lenovo India", "Acer India", "iBall", "Intex", "Micromax", "Lava", "Karbonn",
    "TVS", "Tata", "Mahindra", "Ashok Leyland", "Force Motors", "Eicher",
    "Redington", "Rashi Peripherals", "Ingram Micro India", "Rashi Peripherals",
]

# Global OEMs - International manufacturers
GLOBAL_OEMS: List[str] = [
    "Cisco", "IBM", "Oracle", "Dell", "HP", "HPE", "Microsoft", "Lenovo",
    "Juniper", "Arista", "Fortinet", "Palo Alto", "VMware", "Red Hat",
    "Amazon", "Google", "Salesforce", "SAP", "Adobe", "Intel", "AMD", "Nvidia",
    "Samsung", "LG", "Apple", "Sony", "Philips", "Bosch", "Siemens", "ABB",
    "Schneider Electric", "Eaton", "Emerson", "Honeywell", "Johnson Controls",
    "APC", "Tripp Lite", "Panduit", "Rittal", "Vertiv", "CyberPower",
    "NetApp", "Dell EMC", "Hitachi Vantara", "Pure Storage", "Nutanix",
    "Western Digital", "Seagate", "Kingston", "Crucial", "Samsung SSD",
]

def get_all_indian_oems() -> List[str]:
    """Return list of known Indian OEMs for MII classification"""
    return INDIAN_OEMS.copy()

def get_all_global_oems() -> List[str]:
    """Return list of known global OEMs for classification"""
    return GLOBAL_OEMS.copy()

def classify_mii_status(oem: str, category: str = "") -> str:
    """
    Classify an OEM as Indian OEM or Global OEM based on known lists.
      Returns 'Indian OEM' or 'Global OEM'.
    """
    if not oem or not isinstance(oem, str):
        return "Global OEM"
    
    oem_clean = oem.strip()
    oem_lower = oem_clean.lower()
    
    # Check Indian OEMs first (case-insensitive partial match)
    for indian in INDIAN_OEMS:
        if indian.lower() in oem_lower or oem_lower in indian.lower():
            return "Indian OEM"
    
    # Check Global OEMs
    for global_oem in GLOBAL_OEMS:
        if global_oem.lower() in oem_lower or oem_lower in global_oem.lower():
            return "Global OEM"
    
    # Default: assume Global if not in Indian list (conservative for MII compliance)
    return "Global OEM"
