"""
Script to list all documents stored in Pinecone
Shows index name, namespaces (documents), and vector counts
"""
from dotenv import load_dotenv
import os
from pinecone import Pinecone

load_dotenv()

PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY not found in environment variables.")

index_name = "bid-intelligence-chatbot"

pc = Pinecone(api_key=PINECONE_API_KEY)

try:
    # Check if index exists
    if not pc.has_index(index_name):
        print(f"[ERROR] Index '{index_name}' does not exist.")
        print("   No documents have been uploaded yet.")
        exit(1)
    
    print(f"Pinecone Index Information")
    print(f"{'='*60}")
    print(f"Index Name: {index_name}")
    print(f"API Key: {PINECONE_API_KEY[:20]}...{PINECONE_API_KEY[-10:]}")
    print(f"{'='*60}\n")
    
    # Get index stats
    index = pc.Index(index_name)
    stats = index.describe_index_stats()
    
    print(f"Index Statistics:")
    print(f"   Total Vectors: {stats.get('total_vector_count', 0):,}")
    print(f"   Dimension: {stats.get('dimension', 'N/A')}")
    print(f"   Index Type: {stats.get('index_type', 'N/A')}")
    print(f"\n")
    
    # List namespaces (each namespace = one document)
    namespaces = stats.get('namespaces', {})
    
    if namespaces:
        print(f"Documents (Namespaces) in Index:")
        print(f"{'='*60}")
        
        for namespace, ns_stats in namespaces.items():
            vector_count = ns_stats.get('vector_count', 0)
            print(f"\nDocument ID: {namespace}")
            print(f"   Vectors (chunks): {vector_count:,}")
            
            # Try to get a sample vector to see metadata
            try:
                # Query for one vector to get metadata
                query_result = index.query(
                    vector=[0.0] * 384,  # Dummy vector
                    top_k=1,
                    namespace=namespace,
                    include_metadata=True
                )
                
                if query_result.matches:
                    metadata = query_result.matches[0].metadata
                    if metadata:
                        print(f"   Metadata:")
                        if 'fileName' in metadata:
                            print(f"      File Name: {metadata['fileName']}")
                        if 'documentId' in metadata:
                            print(f"      Document ID: {metadata['documentId']}")
                        if 'totalChunks' in metadata:
                            print(f"      Total Chunks: {metadata['totalChunks']}")
                        if 'uploadedAt' in metadata:
                            print(f"      Uploaded At: {metadata['uploadedAt']}")
            except Exception as e:
                print(f"   (Could not retrieve metadata: {str(e)})")
        
        print(f"\n{'='*60}")
        print(f"[SUCCESS] Total Documents: {len(namespaces)}")
    else:
        print(f"[WARNING] No documents found in index '{index_name}'")
        print(f"   The index exists but is empty.")
        print(f"   Upload a document through the Bid Intelligence platform to store it here.")
    
except Exception as e:
    print(f"[ERROR] Error accessing Pinecone: {str(e)}")
    import traceback
    traceback.print_exc()
