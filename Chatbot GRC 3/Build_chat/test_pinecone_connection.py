"""
Test Pinecone connection and create index if needed
"""
from dotenv import load_dotenv
import os
from pinecone import Pinecone, ServerlessSpec

# Load environment variables
load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "bid-intelligence-chatbot")

if not PINECONE_API_KEY:
    raise RuntimeError("❌ PINECONE_API_KEY not found in .env")

print("Testing Pinecone connection...")
print(f"Index Name: {INDEX_NAME}")
print("=" * 60)

try:
    # ✅ Correct initialization
    pc = Pinecone(api_key=PINECONE_API_KEY)
    print("[SUCCESS] Connected to Pinecone")

    # ✅ Check index
    if pc.has_index(INDEX_NAME):
        print(f"[SUCCESS] Index '{INDEX_NAME}' exists")

        index = pc.Index(INDEX_NAME)
        stats = index.describe_index_stats()

        print(f"   Total Vectors: {stats.get('total_vector_count', 0):,}")

        namespaces = stats.get("namespaces", {})
        if namespaces:
            print(f"   Namespaces: {len(namespaces)}")
            for ns in list(namespaces.keys())[:5]:
                print(f"      - {ns}")
        else:
            print("   Index is empty")

    else:
        print(f"[WARNING] Index '{INDEX_NAME}' does not exist")
        print("Creating index...")

        pc.create_index(
            name=INDEX_NAME,
            dimension=384,  # Match dimension used in store_index.py and app.py
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1"),
        )

        print(f"[SUCCESS] Index '{INDEX_NAME}' created")

except Exception as e:
    print("[ERROR] Pinecone operation failed")
    import traceback
    traceback.print_exc()
