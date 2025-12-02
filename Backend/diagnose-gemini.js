const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

async function diagnoseGeminiAPI() {
    console.log('=== Gemini API Diagnostic Tool ===\n');
    
    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('❌ GEMINI_API_KEY is not set in .env file');
        return;
    }
    
    console.log('✓ API Key found');
    console.log(`  Length: ${apiKey.length} characters`);
    console.log(`  Starts with: ${apiKey.substring(0, 10)}...`);
    console.log(`  Format check: ${apiKey.startsWith('AIza') ? '✓ Looks like Google AI Studio key' : '⚠ Unexpected format'}`);
    
    // Initialize client
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Test different model naming conventions
    const modelsToTest = [
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro',
        'gemini-2.0-flash-exp',
    ];
    
    console.log('\n=== Testing Model Access ===\n');
    
    let workingModel = null;
    
    for (const modelName of modelsToTest) {
        try {
            console.log(`Testing: ${modelName}...`);
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent('Say "OK"');
            const response = await result.response;
            const text = response.text();
            console.log(`  ✓ SUCCESS! Response: ${text.trim()}`);
            workingModel = modelName;
            break;
        } catch (error) {
            if (error.status === 404) {
                console.log(`  ✗ 404 Not Found`);
            } else if (error.status === 403) {
                console.log(`  ✗ 403 Forbidden - API key may not have access`);
            } else if (error.status === 429) {
                console.log(`  ✗ 429 Rate Limited`);
            } else {
                console.log(`  ✗ Error: ${error.message}`);
            }
        }
    }
    
    console.log('\n=== Results ===\n');
    if (workingModel) {
        console.log(`✓ Found working model: ${workingModel}`);
        console.log(`\nUpdate your geminiService.js to use:`);
        console.log(`const MODEL = '${workingModel}';`);
    } else {
        console.log('❌ No working models found.');
        console.log('\nPossible issues:');
        console.log('1. API key is invalid or expired');
        console.log('2. API key is for Vertex AI (not Google AI Studio)');
        console.log('3. API key doesn\'t have Gemini API enabled');
        console.log('4. Network/firewall blocking the API');
        console.log('\nTo fix:');
        console.log('1. Go to https://aistudio.google.com/apikey');
        console.log('2. Create a new API key (should start with "AIza")');
        console.log('3. Update GEMINI_API_KEY in your .env file');
    }
}

diagnoseGeminiAPI().catch(console.error);
