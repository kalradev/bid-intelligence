/**
 * Test if backend can connect to chatbot service
 * Run this from Backend directory: node test_backend_connection.js
 */

const fetch = require('node-fetch');

const chatbotUrl = process.env.CHATBOT_API_URL || 'http://localhost:8080';

console.log('Testing Backend to Chatbot Service Connection...');
console.log(`Chatbot URL: ${chatbotUrl}`);
console.log('='.repeat(60));

// Test 1: Check if chatbot service is running
fetch(`${chatbotUrl}/`, { method: 'GET' })
    .then(response => {
        if (response.ok || response.status === 200 || response.status === 404) {
            console.log('✅ Chatbot service is running');
        } else {
            console.log(`⚠️  Chatbot service responded with status: ${response.status}`);
        }
        return testStoreRFP();
    })
    .catch(error => {
        console.log(`❌ Cannot connect to chatbot service: ${error.message}`);
        console.log('\nTroubleshooting:');
        console.log('1. Make sure chatbot service is running:');
        console.log('   cd "C:\\Users\\ASUS\\Downloads\\Chatbot GRC 3\\Build_chat"');
        console.log('   py -3.10 app.py');
        console.log('\n2. Check if port 8080 is available');
        console.log('\n3. Verify CHATBOT_API_URL in backend config');
        process.exit(1);
    });

// Test 2: Test store-rfp endpoint
function testStoreRFP() {
    console.log('\nTesting /store-rfp endpoint...');
    
    const testData = {
        fileHash: 'test-hash-123',
        fileName: 'test-document.pdf',
        text: 'This is a test document for checking Pinecone storage.',
        pageTexts: [
            { pageNumber: 1, text: 'This is a test document for checking Pinecone storage.' }
        ],
        deleteOldData: false,
        metadata: {
            uploadedAt: new Date().toISOString(),
            pageCount: 1
        }
    };

    return fetch(`${chatbotUrl}/store-rfp`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData)
    })
    .then(async response => {
        if (response.ok) {
            const result = await response.json();
            console.log('✅ /store-rfp endpoint is working');
            console.log(`   Response: ${JSON.stringify(result, null, 2)}`);
            return checkPinecone();
        } else {
            const errorText = await response.text();
            console.log(`❌ /store-rfp endpoint failed: ${response.status}`);
            console.log(`   Error: ${errorText}`);
            return Promise.reject(new Error('store-rfp failed'));
        }
    })
    .catch(error => {
        console.log(`❌ Error calling /store-rfp: ${error.message}`);
        return Promise.reject(error);
    });
}

// Test 3: Check if document was stored in Pinecone
function checkPinecone() {
    console.log('\nChecking Pinecone for stored document...');
    console.log('   Run: python list_documents.py');
    console.log('   Or check Pinecone dashboard');
}

