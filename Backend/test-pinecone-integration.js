/**
 * Test Pinecone Integration
 * Run with: node test-pinecone-integration.js
 */
require('dotenv').config();
const { storeRFPInPinecone } = require('./services/pineconeService');

async function testPineconeStorage() {
    console.log('🧪 Testing Pinecone Storage...');
    
    // Check API Key existence (without revealing it)
    console.log(`Debug: Loading .env from ${__dirname}/.env`);
    if (!process.env.PINECONE_API_KEY) {
        console.error('❌ Error: PINECONE_API_KEY is missing in .env');
        console.log('Env Keys present:', Object.keys(process.env).filter(k => !k.startsWith('npm_')));
        process.exit(1);
    }
    console.log(`✅ PINECONE_API_KEY found (starts with: ${process.env.PINECONE_API_KEY.substring(0, 5)}...)`);
    console.log(`   Internal Index Host: ${process.env.PINECONE_INDEX_HOST || 'Not set'}`);

    const testId = `test-${Date.now()}`;
    const testFilename = 'test_document.txt';
    const testText = 'This is a test document to verify Pinecone storage integration. It contains some sample text about ensuring vectors are correctly upserted.';
    
    try {
        console.log(`📡 Attempting to store document: ${testId}`);
        
        const result = await storeRFPInPinecone(
            testId,
            testFilename,
            testText,
            { type: 'test_verification' }
        );

        console.log('✅ Storage Success!');
        console.log('Document ID:', result.documentId);
        console.log('Chunks:', result.chunksCount);
        console.log('Index:', result.indexName);
        
    } catch (error) {
        console.error('❌ Storage Failed:', error.message);
        if (error.message.includes('Unauthorized')) {
             console.error('   -> Check if your PINECONE_API_KEY is correct.');
        }
        if (error.message.includes('Index not found')) {
             console.error('   -> Check if the index name in .env matches your Pinecone console.');
        }
    }
}

testPineconeStorage();
