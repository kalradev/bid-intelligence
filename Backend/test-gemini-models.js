const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listAvailableModels() {
    try {
        console.log('Testing Gemini API connection...');
        console.log('API Key configured:', process.env.GEMINI_API_KEY ? '✓' : '✗');
        
        // Try to list models
        console.log('\nAttempting to list available models...');
        
        // Test with different model names
        const modelsToTest = [
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'gemini-1.5-pro-latest',
            'gemini-1.5-pro',
            'gemini-pro',
            'models/gemini-1.5-flash-latest',
            'models/gemini-1.5-flash',
        ];
        
        for (const modelName of modelsToTest) {
            try {
                console.log(`\nTesting model: ${modelName}`);
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent('Hello, respond with just "OK"');
                const response = await result.response;
                const text = response.text();
                console.log(`✓ ${modelName} works! Response: ${text}`);
                break; // If one works, we're done
            } catch (error) {
                console.log(`✗ ${modelName} failed: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('Error:', error.message);
        console.error('Full error:', error);
    }
}

listAvailableModels();
