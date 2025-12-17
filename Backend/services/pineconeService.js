/**
 * Pinecone Service - Store and retrieve RFP documents for chatbot
 */
const { Pinecone } = require('@pinecone-database/pinecone');
const { Document } = require('@langchain/core/documents');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { PineconeStore } = require('@langchain/pinecone');

// Initialize Pinecone
let pineconeClient = null;
let pineconeIndex = null;

const initializePinecone = () => {
    if (!pineconeClient && process.env.PINECONE_API_KEY) {
        pineconeClient = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY
        });
    }
    return pineconeClient;
};

/**
 * Store RFP document in Pinecone for chatbot queries
 * @param {string} documentId - Unique ID for the document (e.g., file hash)
 * @param {string} fileName - Original filename
 * @param {string} text - Extracted text from document
 * @param {Object} metadata - Additional metadata (analysis results, etc.)
 */
const storeRFPInPinecone = async (documentId, fileName, text, metadata = {}) => {
    try {
        const client = initializePinecone();
        if (!client) {
            throw new Error('Pinecone not initialized. Check PINECONE_API_KEY.');
        }

        const indexName = process.env.PINECONE_INDEX_NAME || 'bid-intelligence-chatbot';
        
        // Get or create index (support Host URL if provided)
        const indexHostUrl = process.env.PINECONE_INDEX_HOST;
        // The Pinecone v3 client uses lowercase .index()
        const index = client.index(indexName, indexHostUrl ? indexHostUrl : undefined);

        // Split text into chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const chunks = await textSplitter.splitText(text);
        
        // Create documents with metadata
        const documents = chunks.map((chunk, index) => {
            return new Document({
                pageContent: chunk,
                metadata: {
                    documentId,
                    fileName,
                    chunkIndex: index,
                    totalChunks: chunks.length,
                    uploadedAt: new Date().toISOString(),
                    ...metadata
                }
            });
        });

        // Store in Pinecone using LangChain
        const vectorStore = await PineconeStore.fromDocuments(
            documents,
            // Note: You'll need to use the same embeddings model as the chatbot
            // For now, we'll use a placeholder - you may need to adjust this
            await getEmbeddings(),
            {
                pineconeIndex: index,
                namespace: documentId, // Use documentId as namespace for easy retrieval
            }
        );

        console.log(`✅ Stored ${chunks.length} chunks for document: ${fileName} (ID: ${documentId})`);
        
        return {
            success: true,
            documentId,
            chunksCount: chunks.length,
            indexName
        };

    } catch (error) {
        console.error('Error storing document in Pinecone:', error);
        throw error;
    }
};

/**
 * Get embeddings - using the same model as chatbot
 * This should match the embeddings used in the Python chatbot
 */
const getEmbeddings = async () => {
    // For now, we'll need to call the Python service or use a compatible embedding model
    // Since the chatbot uses sentence-transformers, we might need to use a compatible Node.js library
    // or make an API call to the Python service
    
    // Option 1: Use OpenAI embeddings (compatible)
    const { OpenAIEmbeddings } = require('@langchain/openai');
    return new OpenAIEmbeddings({
        openAIApiKey: process.env.OPENAI_API_KEY,
        modelName: 'text-embedding-3-small' // or 'text-embedding-ada-002'
    });
    
    // Option 2: If you want to use the same model as Python (sentence-transformers),
    // you would need to make an HTTP call to a Python service or use a compatible library
};

/**
 * Query documents by documentId
 * @param {string} documentId - Document ID to query
 * @param {string} query - Search query
 * @param {number} k - Number of results
 */
const queryRFPDocument = async (documentId, query, k = 3) => {
    try {
        const client = initializePinecone();
        if (!client) {
            throw new Error('Pinecone not initialized.');
        }

        const indexName = process.env.PINECONE_INDEX_NAME || 'bid-intelligence-chatbot';
        const indexHostUrl = process.env.PINECONE_INDEX_HOST;
        const index = client.index(indexName, indexHostUrl ? indexHostUrl : undefined);

        const embeddings = await getEmbeddings();
        
        const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index,
            namespace: documentId,
        });

        const results = await vectorStore.similaritySearch(query, k);
        
        return results;

    } catch (error) {
        console.error('Error querying document:', error);
        throw error;
    }
};

/**
 * Delete document from Pinecone
 * @param {string} documentId - Document ID to delete
 */
const deleteRFPFromPinecone = async (documentId) => {
    try {
        const client = initializePinecone();
        if (!client) {
            throw new Error('Pinecone not initialized.');
        }

        const indexName = process.env.PINECONE_INDEX_NAME || 'bid-intelligence-chatbot';
        const indexHostUrl = process.env.PINECONE_INDEX_HOST;
        const index = client.index(indexName, indexHostUrl ? indexHostUrl : undefined);

        // Delete all vectors in the namespace
        await index.deleteMany({
            filter: { documentId: { $eq: documentId } }
        });

        console.log(`✅ Deleted document from Pinecone: ${documentId}`);
        return { success: true };

    } catch (error) {
        console.error('Error deleting document:', error);
        throw error;
    }
};

module.exports = {
    storeRFPInPinecone,
    queryRFPDocument,
    deleteRFPFromPinecone,
    initializePinecone
};

