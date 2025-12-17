try {
    console.log('Testing specific imports...');
    
    try { require('@pinecone-database/pinecone'); console.log('✅ @pinecone-database/pinecone ok'); } catch(e) { console.error('❌ @pinecone-database/pinecone failed', e.message); }
    
    try { require('@langchain/core/documents'); console.log('✅ @langchain/core/documents ok'); } catch(e) { console.error('❌ @langchain/core/documents failed', e.message); }
    
    try { require('langchain/text_splitter'); console.log('✅ langchain/text_splitter ok'); } catch(e) { console.error('❌ langchain/text_splitter failed', e.message); }
    
    try { require('@langchain/pinecone'); console.log('✅ @langchain/pinecone ok'); } catch(e) { console.error('❌ @langchain/pinecone failed', e.message); }
    
    try { require('@langchain/openai'); console.log('✅ @langchain/openai ok'); } catch(e) { console.error('❌ @langchain/openai failed', e.message); }

} catch (e) {
    console.error('Fatal error:', e);
}
