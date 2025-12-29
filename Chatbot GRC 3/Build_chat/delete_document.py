"""
Script to delete a specific document from Pinecone by file hash/namespace
Usage: python delete_document.py <file_hash>
"""
from dotenv import load_dotenv
import os
import sys
from pinecone import Pinecone

load_dotenv()

PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY not found in environment variables.")

if len(sys.argv) < 2:
    print("Usage: python delete_document.py <file_hash>")
    print("Example: python delete_document.py 37c371bdebaaa67add1ee4afd56834d44670d99f670942213b7b2a6d9b4b373a")
    sys.exit(1)

file_hash = sys.argv[1]
index_name = "bid-intelligence-chatbot"

pc = Pinecone(api_key=PINECONE_API_KEY)

try:
    if not pc.has_index(index_name):
        print(f"Index '{index_name}' does not exist.")
        sys.exit(1)
    
    index = pc.Index(index_name)
    
    # Delete all vectors in the namespace
    print(f"🗑️  Deleting all vectors for document hash: {file_hash}")
    index.delete(delete_all=True, namespace=file_hash)
    print(f"✅ Successfully deleted document data from namespace: {file_hash}")
    print(f"   You can now re-upload the document to store it with improved page numbers.")
    
except Exception as e:
    print(f"❌ Error deleting document: {str(e)}")
    sys.exit(1)

