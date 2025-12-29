"""
Script to delete the old GRC chatbot index from Pinecone
"""
from dotenv import load_dotenv
import os
from pinecone import Pinecone

load_dotenv()

PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY not found in environment variables.")

pc = Pinecone(api_key=PINECONE_API_KEY)

# Old index name
old_index_name = "grc-chatbot"

try:
    if pc.has_index(old_index_name):
        print(f"Deleting old index: {old_index_name}")
        pc.delete_index(old_index_name)
        print(f"Successfully deleted index: {old_index_name}")
    else:
        print(f"Index '{old_index_name}' does not exist. Nothing to delete.")
except Exception as e:
    print(f"Error deleting index: {str(e)}")

print("\nCleanup complete!")
print("You can now add your Bid Intelligence documents to the 'data/' folder")
print("Then run 'store_index.py' to create the new knowledge base")

