"""
ChromaDB service for storing and retrieving RFP documents with reference links
"""
from dotenv import load_dotenv
import os
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from src.helper import download_hugging_face_embeddings
import hashlib
import json
from typing import List, Dict, Optional

load_dotenv()

# Initialize embeddings
embeddings = download_hugging_face_embeddings()

# ChromaDB collection name
COLLECTION_NAME = "bid-intelligence-documents"

# Persistent directory for ChromaDB
CHROMA_DB_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")

def get_chroma_client():
    """
    Get or create ChromaDB client with persistent storage
    """
    try:
        # Create persistent ChromaDB instance
        vectorstore = Chroma(
            collection_name=COLLECTION_NAME,
            embedding_function=embeddings,
            persist_directory=CHROMA_DB_PATH
        )
        return vectorstore
    except Exception as e:
        print(f"❌ Error initializing ChromaDB: {str(e)}")
        raise e


def store_documents_in_chroma(
    file_hash: str,
    file_name: str,
    documents: List[Document],
    metadata: Optional[Dict] = None
) -> Dict:
    """
    Store documents in ChromaDB with reference links
    
    Args:
        file_hash: Unique document identifier
        file_name: Original filename
        documents: List of Document objects to store
        metadata: Additional metadata
    
    Returns:
        Dictionary with storage results
    """
    try:
        vectorstore = get_chroma_client()
        
        # Add reference link metadata to each document
        enhanced_documents = []
        for i, doc in enumerate(documents):
            # Create reference link for each chunk
            reference_link = f"/document/{file_hash}?page={doc.metadata.get('pageNumber', doc.metadata.get('pageNumbers', '').split(',')[0] if doc.metadata.get('pageNumbers') else '1')}"
            
            # Enhance metadata with reference link
            enhanced_metadata = doc.metadata.copy()
            enhanced_metadata["referenceLink"] = reference_link
            enhanced_metadata["documentId"] = file_hash
            enhanced_metadata["fileName"] = file_name
            enhanced_metadata["chunkId"] = f"{file_hash}_{i}"
            
            # Add file URL if available in metadata
            if metadata and metadata.get("fileUrl"):
                enhanced_metadata["fileUrl"] = metadata.get("fileUrl")
            
            # Create enhanced document
            enhanced_doc = Document(
                page_content=doc.page_content,
                metadata=enhanced_metadata
            )
            enhanced_documents.append(enhanced_doc)
        
        # Store documents in ChromaDB
        # Use file_hash as a filter to group documents by file
        vectorstore.add_documents(enhanced_documents)
        
        # Persist to disk
        vectorstore.persist()
        
        print(f"✅ Stored {len(enhanced_documents)} documents in ChromaDB for: {file_name}")
        print(f"📍 Reference links created for document: {file_hash}")
        
        return {
            "success": True,
            "documentsStored": len(enhanced_documents),
            "documentId": file_hash,
            "fileName": file_name
        }
        
    except Exception as e:
        print(f"❌ Error storing documents in ChromaDB: {str(e)}")
        import traceback
        traceback.print_exc()
        raise e


def search_chroma_documents(
    query: str,
    file_hash: Optional[str] = None,
    k: int = 5
) -> List[Dict]:
    """
    Search documents in ChromaDB and return results with reference links
    
    Args:
        query: Search query
        file_hash: Optional document ID to filter by specific document
        k: Number of results to return
    
    Returns:
        List of dictionaries with document content, metadata, and reference links
    """
    try:
        vectorstore = get_chroma_client()
        
        # Build filter if document_id is provided
        where_filter = None
        if file_hash:
            where_filter = {"documentId": file_hash}
        
        # Search in ChromaDB
        # Note: ChromaDB filter syntax may vary, using where parameter
        try:
            if where_filter:
                # Try with filter parameter
                results = vectorstore.similarity_search_with_score(
                    query=query,
                    k=k,
                    filter=where_filter
                )
            else:
                results = vectorstore.similarity_search_with_score(
                    query=query,
                    k=k
                )
        except TypeError:
            # If filter parameter doesn't work, filter after retrieval
            results = vectorstore.similarity_search_with_score(
                query=query,
                k=k * 2  # Get more results to filter
            )
            # Filter by documentId if needed
            if where_filter and where_filter.get("documentId"):
                filtered_results = []
                for doc, score in results:
                    if doc.metadata.get("documentId") == where_filter["documentId"]:
                        filtered_results.append((doc, score))
                results = filtered_results[:k]
        
        # Format results with reference links
        formatted_results = []
        for doc, score in results:
            result_dict = {
                "content": doc.page_content,
                "metadata": doc.metadata,
                "referenceLink": doc.metadata.get("referenceLink", ""),
                "fileName": doc.metadata.get("fileName", ""),
                "pageNumber": doc.metadata.get("pageNumber") or doc.metadata.get("pageNumbers", "").split(",")[0] if doc.metadata.get("pageNumbers") else None,
                "score": float(score),
                "documentId": doc.metadata.get("documentId", "")
            }
            formatted_results.append(result_dict)
        
        print(f"✅ Found {len(formatted_results)} documents in ChromaDB for query: {query[:50]}...")
        
        return formatted_results
        
    except Exception as e:
        print(f"❌ Error searching ChromaDB: {str(e)}")
        import traceback
        traceback.print_exc()
        return []


def get_document_references(
    file_hash: str,
    chunk_ids: Optional[List[str]] = None
) -> List[Dict]:
    """
    Get reference links for specific document chunks
    
    Args:
        file_hash: Document identifier
        chunk_ids: Optional list of specific chunk IDs
    
    Returns:
        List of reference dictionaries
    """
    try:
        vectorstore = get_chroma_client()
        
        # Search for documents with this documentId
        # Use similarity search with a generic query to get all documents
        results = vectorstore.similarity_search_with_score(
            query="document",  # Generic query to get all documents
            k=1000,  # Get all chunks for this document
            filter={"documentId": file_hash} if hasattr(vectorstore, '_collection') else None
        )
        
        references = []
        for doc, score in results:
            metadata = doc.metadata
            chunk_id = metadata.get("chunkId", "")
            
            # Filter by chunk_ids if provided
            if chunk_ids and chunk_id not in chunk_ids:
                continue
            
            # Only include if documentId matches
            if metadata.get("documentId") != file_hash:
                continue
            
            ref = {
                "chunkId": chunk_id,
                "referenceLink": metadata.get("referenceLink", ""),
                "pageNumber": metadata.get("pageNumber") or metadata.get("pageNumbers", "").split(",")[0] if metadata.get("pageNumbers") else None,
                "fileName": metadata.get("fileName", ""),
                "documentId": file_hash
            }
            references.append(ref)
        
        return references
        
    except Exception as e:
        print(f"❌ Error getting document references: {str(e)}")
        import traceback
        traceback.print_exc()
        return []


def delete_document_from_chroma(file_hash: str) -> bool:
    """
    Delete all documents for a specific file from ChromaDB
    
    Args:
        file_hash: Document identifier
    
    Returns:
        True if successful, False otherwise
    """
    try:
        vectorstore = get_chroma_client()
        
        # Search for all documents with this documentId
        results = vectorstore.similarity_search_with_score(
            query="document",
            k=1000,
            filter={"documentId": file_hash} if hasattr(vectorstore, '_collection') else None
        )
        
        # Extract IDs to delete
        ids_to_delete = []
        for doc, score in results:
            if doc.metadata.get("documentId") == file_hash:
                chunk_id = doc.metadata.get("chunkId", "")
                if chunk_id:
                    ids_to_delete.append(chunk_id)
        
        if ids_to_delete:
            # Delete by IDs using the collection directly
            if hasattr(vectorstore, '_collection'):
                vectorstore._collection.delete(ids=ids_to_delete)
                vectorstore.persist()
                print(f"✅ Deleted {len(ids_to_delete)} documents from ChromaDB for: {file_hash}")
            else:
                # Fallback: try delete method
                try:
                    vectorstore.delete(ids=ids_to_delete)
                    vectorstore.persist()
                    print(f"✅ Deleted {len(ids_to_delete)} documents from ChromaDB for: {file_hash}")
                except:
                    print(f"⚠️  Could not delete documents (ChromaDB API may have changed)")
            return True
        else:
            print(f"ℹ️  No documents found to delete for: {file_hash}")
            return True
            
    except Exception as e:
        print(f"❌ Error deleting from ChromaDB: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Test ChromaDB functionality
    print("Testing ChromaDB service...")
    
    # Test document storage
    test_doc = Document(
        page_content="This is a test document for ChromaDB storage.",
        metadata={
            "documentId": "test_hash_123",
            "fileName": "test.pdf",
            "pageNumber": "1"
        }
    )
    
    result = store_documents_in_chroma(
        file_hash="test_hash_123",
        file_name="test.pdf",
        documents=[test_doc]
    )
    print(f"Storage result: {result}")
    
    # Test search
    results = search_chroma_documents("test document", k=3)
    print(f"Search results: {len(results)} found")
    for r in results:
        print(f"  - {r['fileName']}: {r['referenceLink']}")

