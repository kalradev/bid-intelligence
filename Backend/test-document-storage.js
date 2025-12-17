/**
 * Test script to verify if documents are stored in Pinecone
 * Run this after uploading a document to check if it's indexed
 * 
 * Usage: node test-document-storage.js <documentId>
 * Example: node test-document-storage.js abc123def456...
 */

async function testDocumentStorage() {
    console.log('🔍 Testing Document Storage in Pinecone...\n');
    
    // Get document ID from localStorage (you'll need to provide this)
    const documentId = process.argv[2];
    
    if (!documentId) {
        console.log('❌ Please provide a document ID (fileHash)');
        console.log('   Usage: node test-document-storage.js <documentId>');
        console.log('   Example: node test-document-storage.js abc123def456...');
        return;
    }
    
    console.log(`📄 Testing document: ${documentId}\n`);
    
    // Test 1: Check if Flask backend is running
    console.log('1️⃣ Testing Flask backend connection...');
    try {
        const healthCheck = await fetch('http://localhost:8080/', { timeout: 5000 });
        if (healthCheck.ok) {
            console.log('   ✅ Flask backend is running\n');
        } else {
            console.log('   ⚠️  Flask backend returned:', healthCheck.status, '\n');
        }
    } catch (error) {
        console.log('   ❌ Flask backend is NOT running!');
        console.log('   Please start it with: cd "Chatbot GRC 3\\Build_chat" && py -3.10 app.py\n');
        return;
    }
    
    // Test 2: Try to get sources with a simple query
    console.log('2️⃣ Testing /get-sources endpoint...');
    const testQueries = [
        'turnover',
        'financial',
        'requirement',
        'eligibility',
        'document'
    ];
    
    for (const query of testQueries) {
        try {
            const response = await fetch('http://localhost:8080/get-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: query,
                    documentId: documentId
                }),
                timeout: 10000
            });
            
            const data = await response.json();
            
            if (data.sources && data.sources.length > 0) {
                console.log(`   ✅ Query "${query}": Found ${data.sources.length} sources`);
                console.log(`      First source: Page ${data.sources[0].pageNumber}, File: ${data.sources[0].fileName}`);
                console.log(`      Snippet: ${data.sources[0].snippet.substring(0, 80)}...\n`);
                return; // Found results, stop testing
            } else {
                console.log(`   ⚠️  Query "${query}": No sources found`);
            }
        } catch (error) {
            console.log(`   ❌ Error with query "${query}":`, error.message);
        }
    }
    
    console.log('\n❌ No sources found for any test queries!');
    console.log('\nPossible issues:');
    console.log('1. Document was not stored in Pinecone when uploaded');
    console.log('2. Document ID (namespace) doesn\'t match');
    console.log('3. Flask backend is not properly connected to Pinecone');
    console.log('\nTo fix:');
    console.log('1. Make sure Flask backend is running');
    console.log('2. Re-upload the document (with Flask backend running)');
    console.log('3. Check Flask backend console for storage confirmation');
}

testDocumentStorage().catch(console.error);

