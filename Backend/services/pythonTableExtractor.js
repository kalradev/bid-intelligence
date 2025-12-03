/**
 * Python Table Extractor Bridge
 * Calls Python script with tabula-py for deterministic table extraction
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

/**
 * Extract tables from PDF using Python tabula-py
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<Object>} - Extracted table data
 */
const extractTableWithPython = async (buffer) => {
    return new Promise((resolve, reject) => {
        // Create temporary file for PDF
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `boq_${Date.now()}_${Math.random().toString(36).substring(7)}.pdf`);
        
        try {
            // Write buffer to temp file
            fs.writeFileSync(tempFilePath, buffer);
            
            console.log('🐍 Calling Python tabula-py for deterministic extraction...');
            
            // Determine Python command (python3 or python)
            const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
            
            // Path to Python script
            const scriptPath = path.join(__dirname, '..', 'scripts', 'extract_table.py');
            
            // Spawn Python process
            const python = spawn(pythonCmd, [scriptPath, tempFilePath]);
            
            let dataString = '';
            let errorString = '';
            
            // Collect stdout
            python.stdout.on('data', (data) => {
                dataString += data.toString();
            });
            
            // Collect stderr
            python.stderr.on('data', (data) => {
                errorString += data.toString();
            });
            
            // Handle process completion
            python.on('close', (code) => {
                // Clean up temp file
                try {
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                } catch (cleanupError) {
                    console.warn('⚠️ Failed to clean up temp file:', cleanupError.message);
                }
                
                if (code !== 0) {
                    console.error('❌ Python script failed:', errorString);
                    resolve({
                        success: false,
                        error: `Python script exited with code ${code}: ${errorString}`,
                        useFallback: true
                    });
                    return;
                }
                
                try {
                    const result = JSON.parse(dataString);
                    
                    if (result.success) {
                        console.log(`✅ Python extracted ${result.rowCount} rows deterministically`);
                    } else {
                        console.log('⚠️ Python extraction failed:', result.error);
                    }
                    
                    resolve(result);
                } catch (parseError) {
                    console.error('❌ Failed to parse Python output:', parseError.message);
                    resolve({
                        success: false,
                        error: 'Failed to parse Python output',
                        useFallback: true
                    });
                }
            });
            
            // Handle spawn errors
            python.on('error', (error) => {
                // Clean up temp file
                try {
                    if (fs.existsSync(tempFilePath)) {
                        fs.unlinkSync(tempFilePath);
                    }
                } catch (cleanupError) {
                    // Ignore cleanup errors
                }
                
                console.error('❌ Failed to spawn Python process:', error.message);
                resolve({
                    success: false,
                    error: `Failed to spawn Python: ${error.message}`,
                    useFallback: true
                });
            });
            
            // Set timeout (30 seconds)
            setTimeout(() => {
                python.kill();
                resolve({
                    success: false,
                    error: 'Python extraction timeout',
                    useFallback: true
                });
            }, 30000);
            
        } catch (error) {
            // Clean up temp file on error
            try {
                if (fs.existsSync(tempFilePath)) {
                    fs.unlinkSync(tempFilePath);
                }
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            
            console.error('❌ Python extraction error:', error.message);
            resolve({
                success: false,
                error: error.message,
                useFallback: true
            });
        }
    });
};

/**
 * Check if Python and tabula-py are available
 * @returns {Promise<Boolean>} - True if available
 */
const checkPythonAvailability = async () => {
    return new Promise((resolve) => {
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
        const python = spawn(pythonCmd, ['--version']);
        
        python.on('close', (code) => {
            resolve(code === 0);
        });
        
        python.on('error', () => {
            resolve(false);
        });
        
        setTimeout(() => {
            python.kill();
            resolve(false);
        }, 5000);
    });
};

module.exports = {
    extractTableWithPython,
    checkPythonAvailability
};

