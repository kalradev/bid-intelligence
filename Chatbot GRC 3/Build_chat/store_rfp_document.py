"""
Service to store uploaded RFP documents in Pinecone and ChromaDB for chatbot queries
"""
from dotenv import load_dotenv
import os
from src.helper import download_hugging_face_embeddings, text_split
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
import hashlib
import json
from chromadb_service import store_documents_in_chroma

load_dotenv()

PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')

if not PINECONE_API_KEY:
    raise ValueError("PINECONE_API_KEY not found in environment variables.")

os.environ["PINECONE_API_KEY"] = PINECONE_API_KEY
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY

embeddings = download_hugging_face_embeddings()
pc = Pinecone(api_key=PINECONE_API_KEY)
index_name = "bid-intelligence-chatbot"

def find_page_number_by_position(chunk_text, full_text, page_texts):
    """
    Find which page(s) a chunk belongs to by finding its position in the full text
    and mapping to page boundaries. This is more accurate than text matching.
    Returns list of page numbers
    """
    if not page_texts or not chunk_text or not full_text:
        return []
    
    # Try multiple strategies to find the chunk position
    chunk_start = -1
    
    # Strategy 1: Try to find exact match of first 200 chars (more reliable)
    if len(chunk_text) > 200:
        chunk_start = full_text.find(chunk_text[:200])
    
    # Strategy 2: Try first 100 chars
    if chunk_start == -1 and len(chunk_text) > 100:
        chunk_start = full_text.find(chunk_text[:100])
    
    # Strategy 3: Try first 50 chars
    if chunk_start == -1 and len(chunk_text) > 50:
        chunk_start = full_text.find(chunk_text[:50])
    
    # Strategy 4: Try to find by matching key words (last resort)
    if chunk_start == -1:
        # Extract first few meaningful words from chunk
        words = chunk_text.split()[:10]  # First 10 words
        if words:
            # Try to find a unique phrase
            for i in range(len(words) - 2, 0, -1):  # Try phrases of decreasing length
                phrase = ' '.join(words[:i+1])
                chunk_start = full_text.find(phrase)
                if chunk_start != -1:
                    break
    
    if chunk_start == -1:
        return []
    
    chunk_end = chunk_start + len(chunk_text)
    
    # Build character position boundaries for each page
    current_pos = 0
    page_boundaries = []
    for page_info in sorted(page_texts, key=lambda x: x.get("pageNumber", 0)):
        page_text = page_info.get("text", "")
        page_num = page_info.get("pageNumber", 0)
        page_start = current_pos
        page_end = current_pos + len(page_text)
        page_boundaries.append({
            "pageNumber": page_num,
            "start": page_start,
            "end": page_end,
            "text": page_text  # Store text for verification
        })
        current_pos = page_end
    
    # Find which page(s) the chunk overlaps with
    page_numbers = []
    best_match_page = None
    best_match_score = 0
    
    for boundary in page_boundaries:
        # Check if chunk overlaps with this page
        overlap_start = max(chunk_start, boundary["start"])
        overlap_end = min(chunk_end, boundary["end"])
        overlap_size = max(0, overlap_end - overlap_start)
        
        if overlap_size > 0:
            # Calculate how much of the chunk is in this page (percentage)
            chunk_in_page_ratio = overlap_size / len(chunk_text) if len(chunk_text) > 0 else 0
            
            # Also check text similarity
            page_text = boundary.get("text", "").lower()
            chunk_lower = chunk_text.lower()
            words_in_chunk = set(chunk_lower.split())
            words_in_page = set(page_text.split())
            if len(words_in_chunk) > 0:
                word_overlap = len(words_in_chunk.intersection(words_in_page)) / len(words_in_chunk)
            else:
                word_overlap = 0
            
            # Combined score: position overlap + word overlap
            match_score = (chunk_in_page_ratio * 0.6) + (word_overlap * 0.4)
            
            if match_score > best_match_score:
                best_match_score = match_score
                best_match_page = boundary["pageNumber"]
            
            # Add page if at least 30% of chunk is in this page
            if chunk_in_page_ratio > 0.3:
                page_numbers.append(boundary["pageNumber"])
    
    # If we found a best match, prioritize it
    if best_match_page and best_match_page not in page_numbers:
        page_numbers.insert(0, best_match_page)
    elif best_match_page and page_numbers:
        # Move best match to front
        page_numbers.remove(best_match_page)
        page_numbers.insert(0, best_match_page)
    
    return sorted(list(set(page_numbers))) if page_numbers else []


def find_page_number(chunk_text, page_texts, full_text=None):
    """
    Find which page(s) a chunk belongs to by matching text or position
    Returns list of page numbers
    """
    if not page_texts:
        return []
    
    # If we have full_text, use position-based mapping (more accurate)
    if full_text:
        return find_page_number_by_position(chunk_text, full_text, page_texts)
    
    # Fallback: text matching approach
    chunk_lower = chunk_text.lower()
    page_numbers = []
    
    for page_info in page_texts:
        page_text = page_info.get("text", "").lower()
        # Check if chunk text appears in this page (at least 20% overlap - lowered threshold)
        if page_text and len(chunk_text) > 0:
            # Simple overlap check: if significant portion of chunk is in page
            words_in_chunk = set(chunk_lower.split())
            words_in_page = set(page_text.split())
            if len(words_in_chunk) > 0:
                overlap = len(words_in_chunk.intersection(words_in_page)) / len(words_in_chunk)
                if overlap > 0.2:  # Lowered threshold from 0.3 to 0.2 for better matching
                    page_numbers.append(page_info.get("pageNumber", 0))
    
    # Remove duplicates and sort
    return sorted(list(set(page_numbers))) if page_numbers else []


def format_analysis_data_for_storage(dept_name, dept_data):
    """
    Format department analysis data into a readable text format for semantic search
    
    Args:
        dept_name: Department name (technical, commercial, finance, etc.)
        dept_data: Department analysis data dictionary
    
    Returns:
        Formatted text string representing the analysis data
    """
    if not dept_data or not isinstance(dept_data, dict):
        return ""
    
    text_parts = [f"=== {dept_name.upper()} DEPARTMENT ANALYSIS ===\n"]
    
    # Format each key-value pair in the department data
    for key, value in dept_data.items():
        if value is None or value == "":
            continue
            
        if isinstance(value, dict):
            # Nested dictionaries (e.g., successFactors, riskFactors)
            text_parts.append(f"\n{key.replace('_', ' ').title()}:\n")
            for sub_key, sub_value in value.items():
                if sub_value:
                    if isinstance(sub_value, list):
                        if sub_value:
                            text_parts.append(f"  - {sub_key.replace('_', ' ').title()}: {', '.join(map(str, sub_value[:5]))}\n")
                    elif isinstance(sub_value, dict):
                        # Handle nested dicts (e.g., organized by categories)
                        for cat, items in sub_value.items():
                            if items:
                                if isinstance(items, list):
                                    text_parts.append(f"  - {cat}: {', '.join(map(str, items[:3]))}\n")
                    else:
                        text_parts.append(f"  - {sub_key.replace('_', ' ').title()}: {sub_value}\n")
        elif isinstance(value, list):
            # Lists (e.g., keyPoints, actionItems)
            if value:
                text_parts.append(f"\n{key.replace('_', ' ').title()}:\n")
                for item in value[:10]:  # Limit to first 10 items
                    if isinstance(item, str):
                        text_parts.append(f"  - {item}\n")
                    elif isinstance(item, dict):
                        # Handle list of dicts
                        for k, v in item.items():
                            text_parts.append(f"  - {k}: {v}\n")
        else:
            # Simple values
            text_parts.append(f"{key.replace('_', ' ').title()}: {value}\n")
    
    return "".join(text_parts)


def create_analysis_documents(analysis_data, file_hash, file_name):
    """
    Create Document objects for each department's analysis data
    
    Args:
        analysis_data: Dictionary with departmental summaries (technical, commercial, etc.)
        file_hash: Document identifier
        file_name: Original filename
    
    Returns:
        List of Document objects ready for Pinecone storage
    """
    if not analysis_data or not isinstance(analysis_data, dict):
        return []
    
    departments = ["technical", "commercial", "finance", "legal", "scm", "bidManagement"]
    analysis_documents = []
    
    for dept in departments:
        dept_data = analysis_data.get(dept)
        if not dept_data:
            continue
        
        # Format the analysis data as text
        formatted_text = format_analysis_data_for_storage(dept, dept_data)
        
        if not formatted_text or len(formatted_text.strip()) < 50:
            continue  # Skip if too short
        
        # Create metadata
        doc_metadata = {
            "documentId": file_hash,
            "fileName": file_name,
            "dataType": "analysis",
            "department": dept,
            "source": file_name,
            "uploadedAt": analysis_data.get("uploadedAt", "")
        }
        
        # Store full analysis data as JSON string in metadata (for reference)
        try:
            doc_metadata["analysisData"] = json.dumps(dept_data)
        except:
            pass  # Skip if JSON serialization fails
        
        # Create document
        doc = Document(page_content=formatted_text, metadata=doc_metadata)
        analysis_documents.append(doc)
    
    return analysis_documents

def store_rfp_document(file_hash, file_name, text, metadata=None, page_texts=None, delete_old_data=False):
    """
    Store RFP document in Pinecone for chatbot queries
    
    Args:
        file_hash: Unique identifier for the document
        file_name: Original filename
        text: Extracted text from document
        metadata: Additional metadata (analysis results, etc.)
        page_texts: List of dicts with pageNumber and text for each page
        delete_old_data: If True, delete old vectors before storing (default: False)
                        Set to True only during testing/development
    """
    try:
        # Ensure index exists - create if it doesn't
        if not pc.has_index(index_name):
            print(f"Creating index: {index_name}")
            try:
                pc.create_index(
                    name=index_name,
                    dimension=384,
                    metric="cosine",
                    spec=ServerlessSpec(cloud="aws", region="us-east-1"),
                )
                print(f"✅ Index '{index_name}' created successfully!")
            except Exception as create_error:
                print(f"⚠️  Error creating index (may already exist): {str(create_error)}")
                # Continue anyway - index might exist but not detected yet
        else:
            print(f"✅ Using existing index: {index_name}")
        
        # Delete old vectors in this namespace before storing new ones (only if requested)
        # This is useful during testing/development to ensure fresh data
        # In production, set delete_old_data=False to preserve existing data
        if delete_old_data:
            try:
                index = pc.Index(index_name)
                # Delete all vectors in the namespace (if any exist)
                # Using delete_all=True with namespace deletes all vectors in that namespace
                index.delete(delete_all=True, namespace=file_hash)
                print(f"🗑️  Deleted old vectors for document: {file_name} (namespace: {file_hash})")
            except Exception as e:
                # If namespace doesn't exist or deletion fails, continue anyway
                # This is expected for new documents that haven't been stored before
                print(f"ℹ️  No old vectors to delete for namespace {file_hash} (or deletion not needed): {str(e)}")
        else:
            print(f"ℹ️  Skipping deletion (delete_old_data=False). New chunks will be added to existing data.")
        
        # Create a Document object from text
        from langchain_core.documents import Document
        doc = Document(page_content=text, metadata={"source": file_name})
        
        # Split text into chunks (text_split expects list of Documents)
        text_chunks = text_split([doc])
        
        # Add metadata to each chunk
        documents = []
        chunks_with_pages = 0
        for i, chunk in enumerate(text_chunks):
            # Find page numbers for this chunk using position-based mapping (more accurate)
            page_numbers = find_page_number(chunk.page_content, page_texts, full_text=text) if page_texts else []
            
            doc_metadata = {
                "documentId": file_hash,
                "fileName": file_name,
                "chunkIndex": i,
                "totalChunks": len(text_chunks),
                "uploadedAt": metadata.get("uploadedAt", "") if metadata else "",
                "source": file_name
            }
            
            # Add page numbers if found
            if page_numbers:
                doc_metadata["pageNumbers"] = ",".join(map(str, page_numbers))
                doc_metadata["pageNumber"] = str(page_numbers[0])  # Primary page number (ensure string)
                chunks_with_pages += 1
            else:
                # CRITICAL: Always assign a page number - estimate based on chunk position
                # Estimate: assume ~3-5 chunks per page, calculate from chunk index
                if page_texts and len(page_texts) > 0:
                    # Estimate page based on chunk position in document
                    total_chunks = len(text_chunks)
                    total_pages = len(page_texts)
                    estimated_page = max(1, min(total_pages, (i * total_pages // total_chunks) + 1))
                else:
                    # Fallback: estimate 3 chunks per page
                    estimated_page = max(1, (i // 3) + 1)
                
                doc_metadata["pageNumbers"] = str(estimated_page)
                doc_metadata["pageNumber"] = str(estimated_page)
                chunks_with_pages += 1
                
                if i < 3:  # Only log first few to avoid spam
                    print(f"⚠️  Chunk {i} estimated page {estimated_page} (no exact match found)")
            
            # Add analysis data if provided (store as string to avoid metadata size limits)
            if metadata and metadata.get("analysisData"):
                try:
                    doc_metadata["hasAnalysisData"] = "true"
                    # Store key analysis points only (not full data to avoid size limits)
                    analysis = metadata.get("analysisData", {})
                    if isinstance(analysis, dict):
                        doc_metadata["analysisSummary"] = json.dumps({
                            "totalItems": analysis.get("productMapping", {}).get("totalItems", 0),
                            "fileName": file_name
                        })
                except:
                    pass  # Skip if analysis data is too large
            
            documents.append(Document(page_content=chunk.page_content, metadata=doc_metadata))
        
        # Store in Pinecone with namespace = documentId
        vector_store = PineconeVectorStore.from_documents(
            documents=documents,
            embedding=embeddings,
            index_name=index_name,
            namespace=file_hash  # Use file_hash as namespace for document-specific queries
        )
        
        print(f"✅ Successfully stored {len(text_chunks)} chunks for document: {file_name} (ID: {file_hash})")
        print(f"📄 {chunks_with_pages} chunks have page numbers assigned ({chunks_with_pages/len(text_chunks)*100:.1f}%)")
        print(f"📍 Stored in Pinecone index: {index_name}, namespace: {file_hash}")
        
        # Store documents in ChromaDB for reference links
        try:
            print(f"💾 Storing documents in ChromaDB for reference links...")
            chroma_result = store_documents_in_chroma(
                file_hash=file_hash,
                file_name=file_name,
                documents=documents,
                metadata=metadata
            )
            print(f"✅ ChromaDB storage successful: {chroma_result.get('documentsStored', 0)} documents stored")
        except Exception as chroma_error:
            print(f"⚠️  Error storing in ChromaDB (continuing with Pinecone): {str(chroma_error)}")
            # Continue even if ChromaDB fails - Pinecone storage is primary
        
        # Store analysis data if provided
        analysis_stored = 0
        if metadata and metadata.get("analysisData"):
            try:
                analysis_data = metadata.get("analysisData")
                if isinstance(analysis_data, dict):
                    # Check if it has departmental summaries
                    if "departmentalSummaries" in analysis_data:
                        analysis_data = analysis_data["departmentalSummaries"]
                    
                    analysis_docs = create_analysis_documents(analysis_data, file_hash, file_name)
                    if analysis_docs:
                        # Store analysis documents in the same namespace
                        analysis_vector_store = PineconeVectorStore.from_documents(
                            documents=analysis_docs,
                            embedding=embeddings,
                            index_name=index_name,
                            namespace=file_hash
                        )
                        analysis_stored = len(analysis_docs)
                        print(f"✅ Successfully stored {analysis_stored} analysis documents for {file_name}")
                        print(f"   Departments: {', '.join([doc.metadata.get('department', '') for doc in analysis_docs])}")
                    else:
                        print(f"⚠️  No analysis documents created (data may be empty or invalid)")
                else:
                    print(f"⚠️  Analysis data is not in expected format (dict)")
            except Exception as e:
                print(f"⚠️  Error storing analysis data: {str(e)}")
                import traceback
                traceback.print_exc()
        
        # Verify storage by checking index stats
        try:
            index = pc.Index(index_name)
            stats = index.describe_index_stats()
            namespaces = stats.get('namespaces', {})
            if file_hash in namespaces:
                vector_count = namespaces[file_hash].get('vector_count', 0)
                print(f"✅ Verified: {vector_count} vectors found in namespace {file_hash}")
            else:
                print(f"⚠️  Warning: Namespace {file_hash} not found in index stats (may take a moment to update)")
        except Exception as verify_error:
            print(f"⚠️  Could not verify storage: {str(verify_error)}")
        
        return {
            "success": True,
            "documentId": file_hash,
            "chunksCount": len(text_chunks),
            "chunksWithPages": chunks_with_pages,
            "analysisDocumentsStored": analysis_stored if 'analysis_stored' in locals() else 0
        }
        
    except Exception as e:
        print(f"❌ Error storing document: {str(e)}")
        import traceback
        traceback.print_exc()
        raise e

if __name__ == "__main__":
    # Test function
    test_text = "This is a test RFP document for Bid Intelligence platform."
    test_hash = hashlib.md5(test_text.encode()).hexdigest()
    store_rfp_document(test_hash, "test.pdf", test_text, {"uploadedAt": "2025-12-07"})

