from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from src.helper import download_hugging_face_embeddings
from langchain_pinecone import PineconeVectorStore
from langchain_openai import ChatOpenAI
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
from src.prompt import *
from pinecone import Pinecone, ServerlessSpec
from store_rfp_document import store_rfp_document
from elasticsearch_search import elasticsearch_search, elasticsearch_search_simple
from chromadb_service import search_chroma_documents, get_document_references
import os
import requests
import json


app = Flask(__name__)
# Enable CORS for React frontend
CORS(app, origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:5174"])


load_dotenv()

PINECONE_API_KEY=os.environ.get('PINECONE_API_KEY')
OPENAI_API_KEY=os.environ.get('OPENAI_API_KEY')

# Validate API keys
if not PINECONE_API_KEY:
    raise ValueError("❌ PINECONE_API_KEY not found in environment variables. Please check your .env file.")
if not OPENAI_API_KEY:
    raise ValueError("❌ OPENAI_API_KEY not found in environment variables. Please check your .env file.")

os.environ["PINECONE_API_KEY"] = PINECONE_API_KEY
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY


embeddings = download_hugging_face_embeddings()

index_name = "bid-intelligence-chatbot"  # Updated to Bid Intelligence knowledge base

# Check if index exists, create if it doesn't
# Check if index exists, create if it doesn't
pc = Pinecone(api_key=PINECONE_API_KEY)
index_host = os.environ.get('PINECONE_INDEX_HOST')

if not pc.has_index(index_name):
    print(f"Creating new index: {index_name}")
    pc.create_index(
        name=index_name,
        dimension=384,
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )
    print(f"Index '{index_name}' created successfully!")
    print("NOTE: The index is empty. Run 'store_index.py' to add your Bid Intelligence documents.")
else:
    print(f"Using existing index: {index_name}")

if index_host:
    print(f"🌲 Using Pinecone Host: {index_host}")
    # Manually instantiate index with host
    index = pc.Index(index_name, host=index_host)
    docsearch = PineconeVectorStore(index=index, embedding=embeddings)
else:
    docsearch = PineconeVectorStore.from_existing_index(
        index_name=index_name,
        embedding=embeddings
    )




retriever = docsearch.as_retriever(search_type="similarity", search_kwargs={"k":5})  # Increased from 3 to 5 for better context

chatModel = ChatOpenAI(model="gpt-4o")
prompt = ChatPromptTemplate.from_messages(
    [
        ("system", system_prompt),
        ("human", "{input}"),
    ]
)

question_answer_chain = create_stuff_documents_chain(chatModel, prompt)
rag_chain = create_retrieval_chain(retriever, question_answer_chain)


def search_analysis_data(analysis_data, query):
    """
    Search through analysis data (from Frontend UI) to find relevant information
    
    Args:
        analysis_data: Dictionary with departmental summaries (technical, commercial, etc.)
        query: User's query/question
    
    Returns:
        Tuple of (found_answer: bool, answer_text: str, relevant_department: str)
    """
    if not analysis_data or not isinstance(analysis_data, dict):
        return False, None, None
    
    query_lower = query.lower()
    departments = ["technical", "commercial", "finance", "legal", "scm", "bidManagement"]
    
    # Keywords to identify which department the query is about
    department_keywords = {
        "technical": ["technical", "specification", "product", "equipment", "hardware", "software", "boq", "bom", "oem", "make in india", "mii"],
        "commercial": ["commercial", "price", "cost", "pricing", "bid value", "payment", "financial bid", "commercial bid"],
        "finance": ["finance", "financial", "cost", "budget", "payment", "terms", "emd", "bank guarantee"],
        "legal": ["legal", "compliance", "certificate", "certification", "requirement", "mandatory"],
        "scm": ["scm", "supply chain", "logistics", "delivery", "vendor", "supplier", "procurement"],
        "bidManagement": ["bid", "tender", "submission", "deadline", "evaluation", "qualification", "criteria"]
    }
    
    # Determine which department(s) to check based on query
    relevant_departments = []
    for dept, keywords in department_keywords.items():
        if any(keyword in query_lower for keyword in keywords):
            relevant_departments.append(dept)
    
    # If no specific department identified, check all
    if not relevant_departments:
        relevant_departments = departments
    
    # Search through relevant departments
    for dept in relevant_departments:
        dept_data = analysis_data.get(dept)
        if not dept_data:
            continue
        
        # Convert department data to searchable text
        dept_text = format_analysis_for_search(dept_data, dept)
        
        # Simple keyword matching - check if query terms appear in department data
        query_terms = set(query_lower.split())
        dept_text_lower = dept_text.lower()
        
        # Count matching terms
        matches = sum(1 for term in query_terms if term in dept_text_lower and len(term) > 2)
        match_ratio = matches / len(query_terms) if query_terms else 0
        
        # If significant match (at least 30% of query terms found), return this department's data
        if match_ratio >= 0.3:
            print(f"✅ Found relevant data in {dept} department (match ratio: {match_ratio:.2%})")
            return True, dept_text, dept
    
    return False, None, None


def format_analysis_for_search(dept_data, dept_name):
    """
    Format department analysis data into searchable text
    
    Args:
        dept_data: Department analysis data dictionary
        dept_name: Department name
    
    Returns:
        Formatted text string
    """
    if not dept_data or not isinstance(dept_data, dict):
        return ""
    
    text_parts = [f"{dept_name.upper()} DEPARTMENT ANALYSIS:\n"]
    
    # Format each key-value pair
    for key, value in dept_data.items():
        if value is None or value == "":
            continue
            
        if isinstance(value, dict):
            # Nested dictionaries
            for sub_key, sub_value in value.items():
                if sub_value:
                    if isinstance(sub_value, list):
                        if sub_value:
                            text_parts.append(f"{key} {sub_key}: {', '.join(map(str, sub_value[:10]))}\n")
                    elif isinstance(sub_value, dict):
                        # Handle nested dicts (organized by categories)
                        for cat, items in sub_value.items():
                            if items:
                                if isinstance(items, list):
                                    text_parts.append(f"{key} {sub_key} {cat}: {', '.join(map(str, items[:5]))}\n")
                    else:
                        text_parts.append(f"{key} {sub_key}: {sub_value}\n")
        elif isinstance(value, list):
            if value:
                text_parts.append(f"{key}: {', '.join(map(str, value[:10]))}\n")
        else:
            text_parts.append(f"{key}: {value}\n")
    
    return "".join(text_parts)


def get_analysis_data(document_id, query, k=6):
    """
    Query analysis data from Pinecone for a specific document
    
    Args:
        document_id: Document identifier (file hash)
        query: Search query
        k: Number of documents to retrieve (we'll filter for analysis docs)
    
    Returns:
        List of Document objects containing analysis data, or empty list if none found
    """
    try:
        # Query all documents in namespace, then filter for analysis
        analysis_retriever = PineconeVectorStore.from_existing_index(
            index_name=index_name,
            embedding=embeddings,
            namespace=document_id
        ).as_retriever(search_type="similarity", search_kwargs={"k": k * 2})  # Get more to ensure we find analysis docs
        
        # Get documents
        all_docs = analysis_retriever.get_relevant_documents(query)
        
        # Filter to only analysis documents
        filtered_docs = [doc for doc in all_docs if doc.metadata.get("dataType") == "analysis"]
        
        # Limit to k analysis documents
        filtered_docs = filtered_docs[:k]
        
        if filtered_docs:
            print(f"📊 Found {len(filtered_docs)} analysis documents for query: {query[:50]}...")
            for doc in filtered_docs:
                dept = doc.metadata.get("department", "unknown")
                print(f"   - {dept} department")
        else:
            print(f"⚠️  No analysis documents found in namespace {document_id}")
        
        return filtered_docs
    except Exception as e:
        print(f"⚠️  Error querying analysis data: {str(e)}")
        import traceback
        traceback.print_exc()
        return []



@app.route("/")
def index():
    return render_template('chat.html')



def google_search(query, num_results=5):
    """Perform Google search using SerpAPI or similar service"""
    try:
        # Option 1: Using SerpAPI (requires API key)
        serp_api_key = os.environ.get('SERP_API_KEY')
        if serp_api_key:
            url = "https://serpapi.com/search"
            params = {
                "q": query,
                "api_key": serp_api_key,
                "num": num_results
            }
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                results = []
                if "organic_results" in data:
                    for result in data["organic_results"][:num_results]:
                        results.append({
                            "title": result.get("title", ""),
                            "snippet": result.get("snippet", ""),
                            "link": result.get("link", "")
                        })
                return results
        
        # Option 2: Fallback - return empty results
        print("Warning: SERP_API_KEY not found. Google search disabled.")
        return []
        return []
    except Exception as e:
        # print(f"Google search error: {str(e)}") # Reduce noise
        return []


def global_search(query, num_results=5, use_elasticsearch=True):
    """
    Perform global search using Elasticsearch (primary) or Google search (fallback)
    
    Args:
        query: Search query string
        num_results: Number of results to return
        use_elasticsearch: If True, use Elasticsearch; if False, use Google search
    
    Returns:
        List of search results
    """
    # Try Elasticsearch first if enabled
    if use_elasticsearch:
        # Support both environment variable formats
        elasticsearch_endpoint = os.environ.get('ELASTICSEARCH_ENDPOINT') or os.environ.get('elasticsearch')
        elasticsearch_api_key = os.environ.get('ELASTICSEARCH_API_KEY') or os.environ.get('elasticsearch_api_key')
        
        if elasticsearch_endpoint and elasticsearch_api_key:
            print(f"🔍 Using Elasticsearch for global search: {query}")
            results = elasticsearch_search_simple(query, num_results)
            if results:
                print(f"✅ Elasticsearch returned {len(results)} results")
                return results
            else:
                print("⚠️  Elasticsearch returned no results, falling back to Google search")
        else:
            print("⚠️  Elasticsearch not configured, using Google search")
    
    # Fallback to Google search
    # Fallback to Google search
    # print(f"🌐 Using Google search (SerpAPI) for: {query}")
    return google_search(query, num_results)

@app.route("/store-rfp", methods=["POST"])
def store_rfp():
    """Store uploaded RFP document in Pinecone"""
    try:
        print(f"\n{'='*60}")
        print(f"📥 Received request to store RFP document")
        print(f"{'='*60}")
        
        data = request.get_json()
        file_hash = data.get("fileHash")
        file_name = data.get("fileName")
        text = data.get("text")
        page_texts = data.get("pageTexts", None)  # Page-by-page text for page number mapping
        metadata = data.get("metadata", {})
        analysis_data = data.get("analysisData", None)  # Analysis data from RFP analysis
        delete_old_data = data.get("deleteOldData", False)  # Optional: delete old data (default: False)
        
        print(f"📄 File: {file_name}")
        print(f"🔑 Hash: {file_hash}")
        print(f"📝 Text length: {len(text) if text else 0} characters")
        print(f"📑 Pages: {len(page_texts) if page_texts else 0}")
        
        # Add analysis data to metadata if provided
        if analysis_data:
            if not metadata:
                metadata = {}
            metadata["analysisData"] = analysis_data
            print(f"📊 Analysis data provided: {len(analysis_data) if isinstance(analysis_data, dict) else 'N/A'} departments")
        
        # Also check environment variable for testing mode
        if not delete_old_data:
            delete_old_data = os.environ.get("DELETE_OLD_DATA_ON_UPLOAD", "false").lower() == "true"
        
        if not file_hash or not file_name or not text:
            error_msg = "Missing required fields: fileHash, fileName, or text"
            print(f"❌ {error_msg}")
            return jsonify({"error": error_msg}), 400
        
        print(f"💾 Storing document in Pinecone...")
        result = store_rfp_document(file_hash, file_name, text, metadata, page_texts, delete_old_data=delete_old_data)
        
        print(f"✅ Document stored successfully!")
        if result.get("analysisDocumentsStored", 0) > 0:
            print(f"✅ Analysis data stored: {result.get('analysisDocumentsStored')} department documents")
        print(f"{'='*60}\n")
        
        return jsonify({"success": True, "data": result})
    except Exception as e:
        error_msg = f"Error storing RFP: {str(e)}"
        print(f"\n❌ {error_msg}")
        import traceback
        traceback.print_exc()
        print(f"{'='*60}\n")
        return jsonify({"error": str(e)}), 500

@app.route("/get", methods=["GET", "POST"])
def chat():
    try:
        # Support both form data and JSON requests
        if request.is_json:
            data = request.get_json()
            msg = data.get("msg", "")
            document_id = data.get("documentId", None)  # Optional: query specific document
            deep_research = data.get("deepResearch", False)  # Deep research toggle
            ui_analysis_data = data.get("analysisData", None)  # Analysis data from Frontend UI
        else:
            msg = request.form.get("msg", "")
            document_id = request.form.get("documentId", None)
            deep_research = request.form.get("deepResearch", "false").lower() == "true"
            ui_analysis_data = None
        
        if not msg:
            return jsonify({"error": "No message provided"}), 400
        
        print(f"User query: {msg}")
        print(f"Document ID: {document_id}")
        print(f"Deep Research: {deep_research}")
        
        # Step 1: Check Frontend UI analysis data first
        answer = None
        found_in_ui = False
        relevant_dept = None
        
        if ui_analysis_data:
            print(f"📊 Checking Frontend UI analysis data first...")
            found_in_ui, ui_answer, relevant_dept = search_analysis_data(ui_analysis_data, msg)
            if found_in_ui:
                print(f"✅ Found answer in UI analysis data ({relevant_dept} department)")
                # Use UI data to generate answer with proper prompt format
                ui_context = f"Context from {relevant_dept} department analysis:\n{ui_answer}"
                ui_prompt = ChatPromptTemplate.from_messages(
                    [
                        ("system", system_prompt),
                        ("human", "{input}"),
                    ]
                )
                response = ui_prompt.format_messages(context=ui_context, input=msg)
                answer_response = chatModel.invoke(response)
                answer = answer_response.content if hasattr(answer_response, 'content') else str(answer_response)
            else:
                print(f"⚠️  Query not found in UI analysis data, will search Pinecone...")
        else:
            print(f"ℹ️  No UI analysis data provided, searching Pinecone directly...")
        
        # Step 2: If not found in UI, search Pinecone
        source_pages = []  # Track page numbers from retrieved documents
        # Increase chunks for deep research (more detailed answers)
        num_chunks = 10 if deep_research else 7  # Increased from 5 to 7 for better context retrieval
        
        # Only search Pinecone if not found in UI (or if deep research mode)
        if not found_in_ui or deep_research:
            if document_id:
                try:
                    print(f"🔍 Querying document-specific namespace: {document_id}")
                    print(f"📄 User question: {msg}")
                    if deep_research:
                        print(f"📚 Deep research mode: Retrieving {num_chunks} chunks + global search")
                    
                    # Step 1: Query analysis data first (if available)
                    analysis_docs = get_analysis_data(document_id, msg, k=3)
                    has_analysis = len(analysis_docs) > 0
                    
                    # Step 2: Query document chunks
                    doc_retriever = PineconeVectorStore.from_existing_index(
                        index_name=index_name,
                        embedding=embeddings,
                        namespace=document_id
                    ).as_retriever(search_type="similarity", search_kwargs={"k": num_chunks})
                    
                    # Get source documents to extract page numbers
                    source_docs = doc_retriever.get_relevant_documents(msg)
                    print(f"✅ Found {len(source_docs)} relevant chunks from document {document_id}")
                    
                    # Combine analysis and document chunks
                    if has_analysis:
                        # In deep research mode, use both; otherwise prioritize analysis
                        if deep_research:
                            all_docs = analysis_docs + source_docs
                            print(f"📊 Using {len(analysis_docs)} analysis docs + {len(source_docs)} document chunks (deep research)")
                        else:
                            # Prioritize analysis data, but include some document chunks for context
                            all_docs = analysis_docs + source_docs[:3]  # Top 3 document chunks
                            print(f"📊 Using {len(analysis_docs)} analysis docs + {len(source_docs[:3])} document chunks (prioritizing analysis)")
                    else:
                        all_docs = source_docs
                        print(f"📄 No analysis data found, using {len(source_docs)} document chunks")
                    
                    if len(all_docs) == 0:
                        print(f"⚠️  No documents found in namespace {document_id}. Document may not be stored yet.")
                        print(f"   💡 Make sure you clicked 'Start Analysis' after uploading the RFP document.")
                        # Still try to query, but warn user
                        if not found_in_ui:
                            answer = "I couldn't find this document in my knowledge base. Please make sure:\n1. The document was uploaded successfully\n2. You clicked 'Start Analysis' to process it\n3. The document was stored in Pinecone (check backend logs)"
                    else:
                        # Extract page numbers from document chunks (not analysis docs)
                        print(f"🔍 Extracting page numbers from {len(source_docs)} source documents...")
                        for i, doc in enumerate(source_docs):
                            if hasattr(doc, 'metadata'):
                                metadata = doc.metadata
                                # Try multiple metadata keys for page numbers (in order of preference)
                                page_num = (metadata.get("pageNumbers") or  # Comma-separated list (preferred)
                                           metadata.get("pageNumber") or     # Single page number
                                           metadata.get("page") or "")       # Alternative key
                                
                                if page_num:
                                    if isinstance(page_num, str):
                                        # Handle comma-separated page numbers
                                        if "," in page_num:
                                            pages = [p.strip() for p in page_num.split(",") if p.strip() and (p.strip().isdigit() or p.strip().replace('.', '').isdigit())]
                                            if pages:
                                                source_pages.extend(pages)
                                                print(f"  📄 Chunk {i}: Found pages {pages}")
                                        elif page_num.strip() and (page_num.strip().isdigit() or page_num.strip().replace('.', '').isdigit()):
                                            # Single page number (handle both integer and float strings)
                                            page_val = page_num.strip()
                                            # Convert to int if it's a whole number
                                            try:
                                                page_int = int(float(page_val))
                                                source_pages.append(str(page_int))
                                                print(f"  📄 Chunk {i}: Found page {page_int}")
                                            except ValueError:
                                                print(f"  ⚠️  Chunk {i}: Invalid page number format: {page_val}")
                                    elif isinstance(page_num, (int, float)):
                                        # Numeric page number
                                        source_pages.append(str(int(page_num)))
                                        print(f"  📄 Chunk {i}: Found page {int(page_num)}")
                                    elif isinstance(page_num, list):
                                        # List of page numbers
                                        pages = [str(int(float(p))) for p in page_num if p]
                                        source_pages.extend(pages)
                                        print(f"  📄 Chunk {i}: Found pages {pages}")
                                else:
                                    # Debug: log first few chunks without page numbers
                                    if i < 3:
                                        print(f"  ⚠️  Chunk {i}: No page number in metadata. Available keys: {list(metadata.keys())}")
                        
                        # Create a simple retriever that returns our combined documents
                        from langchain_core.retrievers import BaseRetriever
                        from langchain_core.callbacks import CallbackManagerForRetrieverRun
                        from typing import List
                        
                        class SimpleDocumentRetriever(BaseRetriever):
                            def __init__(self, documents):
                                super().__init__()
                                self.documents = documents
                            
                            def _get_relevant_documents(self, query: str, *, run_manager: CallbackManagerForRetrieverRun) -> List:
                                return self.documents
                        
                        combined_retriever = SimpleDocumentRetriever(all_docs)
                        
                        doc_qa_chain = create_stuff_documents_chain(chatModel, prompt)
                        doc_rag_chain = create_retrieval_chain(combined_retriever, doc_qa_chain)
                        response = doc_rag_chain.invoke({"input": msg})
                        pinecone_answer = response["answer"]
                        
                        # If we found in UI, combine both; otherwise use Pinecone answer
                        if found_in_ui and deep_research:
                            answer = f"{answer}\n\n=== Additional Information from Document ===\n{pinecone_answer}"
                        elif not found_in_ui:
                            answer = pinecone_answer
                        # If found in UI and not deep research, keep UI answer
                except Exception as e:
                    print(f"❌ Error querying specific document: {str(e)}")
                    if not found_in_ui:
                        print(f"   Falling back to general knowledge base")
                        # Fallback to general knowledge base
                        response = rag_chain.invoke({"input": msg})
                        answer = response["answer"]
                        # Add note that we fell back
                        answer = f"{answer}\n\n(Note: Document-specific query failed, showing general knowledge base results)"
            else:
                # No document_id provided, query general knowledge base
                if not found_in_ui:
                    if deep_research:
                        # Use more chunks for general knowledge base too in deep research mode
                        enhanced_retriever = docsearch.as_retriever(search_type="similarity", search_kwargs={"k": num_chunks})
                        enhanced_qa_chain = create_stuff_documents_chain(chatModel, prompt)
                        enhanced_rag_chain = create_retrieval_chain(enhanced_retriever, enhanced_qa_chain)
                        response = enhanced_rag_chain.invoke({"input": msg})
                        answer = response["answer"]
                    else:
                        response = rag_chain.invoke({"input": msg})
                        answer = response["answer"]
        else:
            # Query general knowledge base (only if not found in UI)
            if not found_in_ui:
                if deep_research:
                    # Use more chunks for general knowledge base too in deep research mode
                    enhanced_retriever = docsearch.as_retriever(search_type="similarity", search_kwargs={"k": num_chunks})
                    enhanced_qa_chain = create_stuff_documents_chain(chatModel, prompt)
                    enhanced_rag_chain = create_retrieval_chain(enhanced_retriever, enhanced_qa_chain)
                    response = enhanced_rag_chain.invoke({"input": msg})
                    answer = response["answer"]
                else:
                    response = rag_chain.invoke({"input": msg})
                    answer = response["answer"]
        
        # Remove duplicates and sort page numbers (only keep valid page numbers)
        source_pages = [p for p in source_pages if p and str(p).strip().isdigit()]
        source_pages = sorted(list(set(source_pages)), key=lambda x: int(x) if str(x).isdigit() else 999)
        
        if source_pages:
            print(f"📄 Extracted page references: {source_pages}")
        else:
            print(f"⚠️  No page references found in retrieved documents")
        
        # If deep research is enabled, enhance with more document context and Google search
        google_results = []
        if deep_research:
            print("📚 Deep research mode: Providing comprehensive detailed answer from document...")
            
            # Get MORE context from document for detailed answer
            if document_id and 'doc_retriever' in locals():
                # Re-query analysis data and document chunks for comprehensive context
                detailed_analysis = get_analysis_data(document_id, msg, k=6)
                detailed_docs = doc_retriever.get_relevant_documents(msg)
                print(f"📖 Retrieved {len(detailed_analysis)} analysis docs + {len(detailed_docs)} document chunks for detailed analysis")
                
                # Combine for deep research
                detailed_docs = detailed_analysis + detailed_docs
                
                # Build comprehensive context from document
                document_context = "\n\n=== DETAILED DOCUMENT CONTEXT ===\n"
                for i, doc in enumerate(detailed_docs, 1):
                    document_context += f"\n[Section {i}]\n{doc.page_content}\n"
                    # Extract page numbers (more robust extraction)
                    if hasattr(doc, 'metadata'):
                        metadata = doc.metadata
                        page_num = (metadata.get("pageNumbers") or  # Comma-separated list (preferred)
                                   metadata.get("pageNumber") or     # Single page number
                                   metadata.get("page") or "")       # Alternative key
                        if page_num:
                            if isinstance(page_num, str):
                                if "," in page_num:
                                    pages = [p.strip() for p in page_num.split(",") if p.strip() and (p.strip().isdigit() or p.strip().replace('.', '').isdigit())]
                                    if pages:
                                        source_pages.extend(pages)
                                elif page_num.strip() and (page_num.strip().isdigit() or page_num.strip().replace('.', '').isdigit()):
                                    try:
                                        page_int = int(float(page_num.strip()))
                                        source_pages.append(str(page_int))
                                    except ValueError:
                                        pass  # Skip invalid page numbers
                            elif isinstance(page_num, (int, float)):
                                source_pages.append(str(int(page_num)))
                            elif isinstance(page_num, list):
                                pages = [str(int(float(p))) for p in page_num if p]
                                source_pages.extend(pages)
                
                # For deep research, use enhanced prompt that emphasizes detailed answers
                detailed_system_prompt = (
                    "You are Piko, a helpful AI assistant for Bid Intelligence.Ai platform. "
                    "You are in DEEP RESEARCH mode. Your role is to provide COMPREHENSIVE, DETAILED answers "
                    "using ALL available context from the document. Include specific details, numbers, dates, "
                    "requirements, specifications, and any relevant information. Be thorough and exhaustive in your response. "
                    "Focus on helping users understand bid intelligence concepts, RFP processes, and how to use the platform effectively."
                    "\n\n"
                    "Use the following pieces of retrieved context from the document to answer the question:"
                    "\n{context}"
                )
                
                detailed_prompt = ChatPromptTemplate.from_messages([
                    ("system", detailed_system_prompt),
                    ("human", "Question: {input}\n\n"
                              "IMPORTANT: Provide a DETAILED, COMPREHENSIVE answer that:\n"
                              "1. Directly addresses the question using specific information from the document\n"
                              "2. Includes relevant details, numbers, dates, and specifications\n"
                              "3. References specific sections or pages when possible\n"
                              "4. Is thorough and leaves no important detail unmentioned.")
                ])
                
                # Use the retriever with more chunks for detailed answer
                doc_qa_chain = create_stuff_documents_chain(chatModel, detailed_prompt)
                doc_rag_chain = create_retrieval_chain(doc_retriever, doc_qa_chain)
                response = doc_rag_chain.invoke({"input": msg})
                answer = response["answer"]
                
                # Perform global search (Elasticsearch or Google) for additional context
                # Only do this if strictly necessary or explicitly requested
                google_results = [] # Default empty to avoid spamming "ADDITIONAL GLOBAL SEARCH RESULTS"
                if os.environ.get('ENABLE_GLOBAL_SEARCH', 'false').lower() == 'true':
                     print("🌐 Performing global search (Elasticsearch) for additional context...")
                     google_results = global_search(msg, num_results=3, use_elasticsearch=True)
                
                if google_results:
                    print(f"✅ Global search found {len(google_results)} results")
                    # Append web search results to the answer
                    google_context = "\n\n=== ADDITIONAL GLOBAL SEARCH RESULTS ===\n"
                    for i, result in enumerate(google_results, 1):
                        google_context += f"{i}. {result['title']}: {result['snippet']}\n"
                    
                    # Enhance answer with global search context
                    enhanced_prompt = ChatPromptTemplate.from_messages([
                        ("system", "You are enhancing an existing answer with global search results from Elasticsearch. Provide additional context if relevant, but keep the document-based answer as the primary source."),
                        ("human", "Original answer from document: {answer}\n\nGlobal search results:\n{google_context}\n\nEnhance the answer with relevant global search information if it adds value. Keep the document-based answer as primary.")
                    ])
                    
                    enhance_chain = enhanced_prompt | chatModel
                    enhanced_response = enhance_chain.invoke({
                        "answer": answer,
                        "google_context": google_context
                    })
                    # Append global search results as additional context
                    answer = f"{answer}\n\n{google_context}"
                else:
                    print("⚠️  Global search returned no results (Elasticsearch may be empty or connection issue)")
                    google_results = []
                
            else:
                # General knowledge base with deep research
                if os.environ.get('ENABLE_GLOBAL_SEARCH', 'false').lower() == 'true':
                    print("🌐 Performing deep research with global search...")
                    google_results = global_search(msg, num_results=3, use_elasticsearch=True)
                else:
                    google_results = []
                
                if google_results:
                    # Get more context from general knowledge base
                    enhanced_retriever = docsearch.as_retriever(search_type="similarity", search_kwargs={"k": num_chunks})
                    context_docs = enhanced_retriever.get_relevant_documents(msg)
                    context = "\n".join([doc.page_content for doc in context_docs])
                    
                    google_context = "\n\nAdditional information from web search:\n"
                    for i, result in enumerate(google_results, 1):
                        google_context += f"{i}. {result['title']}: {result['snippet']}\n"
                    
                    # Create enhanced prompt
                    enhanced_prompt = ChatPromptTemplate.from_messages([
                        ("system", system_prompt + "\n\nIMPORTANT: You are in DEEP RESEARCH mode. Provide a COMPREHENSIVE, DETAILED answer using ALL available context. Be thorough and exhaustive."),
                        ("human", "Question: {input}\n\nContext from knowledge base:\n{context}\n\n{google_context}\n\nProvide a DETAILED, COMPREHENSIVE answer combining both the knowledge base and web search results.")
                    ])
                    
                    enhanced_qa_chain = create_stuff_documents_chain(chatModel, enhanced_prompt)
                    
                    enhanced_response = enhanced_qa_chain.invoke({
                        "input": msg,
                        "context": context,
                        "google_context": google_context
                    })
                    answer = enhanced_response.get("answer", enhanced_response) if isinstance(enhanced_response, dict) else enhanced_response
        
        print(f"Response: {answer}")
        
        # Get reference links from ChromaDB
        reference_links = []
        try:
            if document_id:
                # Search ChromaDB for relevant documents with reference links
                chroma_results = search_chroma_documents(
                    query=msg,
                    file_hash=document_id,
                    k=min(5, num_chunks)  # Get top 5 reference links
                )
                
                # Extract unique reference links
                seen_links = set()
                for result in chroma_results:
                    ref_link = result.get("referenceLink", "")
                    if ref_link and ref_link not in seen_links:
                        reference_links.append({
                            "link": ref_link,
                            "pageNumber": result.get("pageNumber"),
                            "fileName": result.get("fileName", ""),
                            "score": result.get("score", 0.0)
                        })
                        seen_links.add(ref_link)
                
                print(f"🔗 Found {len(reference_links)} reference links from ChromaDB")
            else:
                # Search general ChromaDB for reference links
                chroma_results = search_chroma_documents(
                    query=msg,
                    k=5
                )
                
                seen_links = set()
                for result in chroma_results:
                    ref_link = result.get("referenceLink", "")
                    if ref_link and ref_link not in seen_links:
                        reference_links.append({
                            "link": ref_link,
                            "pageNumber": result.get("pageNumber"),
                            "fileName": result.get("fileName", ""),
                            "score": result.get("score", 0.0)
                        })
                        seen_links.add(ref_link)
                
                print(f"🔗 Found {len(reference_links)} reference links from ChromaDB (general search)")
        except Exception as chroma_error:
            print(f"⚠️  Error retrieving reference links from ChromaDB: {str(chroma_error)}")
            # Continue without reference links if ChromaDB fails
        
        # Ensure sourcePages is always an array (even if empty)
        if not source_pages:
            source_pages = []
        
        # Return JSON for API calls, plain text for form submissions
        response_data = {
            "answer": answer,
            "deepResearch": deep_research,
            "googleResults": google_results if deep_research else [],
            "sourcePages": source_pages,  # Page numbers where answer came from (always an array)
            "referenceLinks": reference_links  # Reference links from ChromaDB
        }
        
        # Debug: Log what we're returning
        if source_pages:
            print(f"✅ Returning {len(source_pages)} page reference(s): {source_pages}")
        else:
            print(f"⚠️  No page references to return (document may not have page numbers stored)")
        
        if request.is_json or request.headers.get("Content-Type") == "application/json":
            return jsonify(response_data)
        return str(answer)
    except Exception as e:
        print(f"Error: {str(e)}")
        error_msg = f"Sorry, an error occurred: {str(e)}"
        if request.is_json or request.headers.get("Content-Type") == "application/json":
            return jsonify({"error": error_msg}), 500
        return error_msg, 500


@app.route("/get-sources", methods=["GET", "POST"])
def get_sources():
    """Get source references from Pinecone for a query (for reference links in UI)"""
    try:
        if request.is_json:
            data = request.get_json()
            query = data.get("query", "")
            document_id = data.get("documentId", None)
        else:
            query = request.form.get("query", "")
            document_id = request.form.get("documentId", None)
        
        if not query:
            return jsonify({"error": "query is required"}), 400
        
        print(f"🔍 Getting sources for query: {query[:100]}...")
        print(f"📄 Document ID: {document_id}")
        
        sources = []
        
        try:
            if document_id:
                # Query document-specific namespace
                print(f"🔎 Querying namespace: {document_id}")
                
                # Create retriever with higher k value for better results
                if index_host:
                    # Use index with host if configured
                    doc_index = pc.Index(index_name, host=index_host)
                    doc_vector_store = PineconeVectorStore(index=doc_index, embedding=embeddings, namespace=document_id)
                else:
                    doc_vector_store = PineconeVectorStore.from_existing_index(
                        index_name=index_name,
                        embedding=embeddings,
                        namespace=document_id
                    )
                
                # Use similarity_search_with_score to get actual similarity scores
                # Fetch more candidates initially, then filter by relevance (user wants at least 3)
                search_results = doc_vector_store.similarity_search_with_score(query, k=20)
                print(f"✅ Found {len(search_results)} candidate chunks from document namespace")
                
                # If no results, try a broader search with key terms
                if len(search_results) == 0:
                    print("⚠️  No results with full query, trying key terms...")
                    # Extract key terms from query (remove common words)
                    key_terms = [word for word in query.split() if len(word) > 3 and word.lower() not in ['the', 'and', 'for', 'with', 'from', 'that', 'this']]
                    if key_terms:
                        simplified_query = " ".join(key_terms[:5])  # Use top 5 key terms
                        print(f"   Trying simplified query: {simplified_query}")
                        search_results = doc_vector_store.similarity_search_with_score(simplified_query, k=20)
                        print(f"   Found {len(search_results)} chunks with simplified query")
                
                # Filter by minimum relevance threshold (cosine similarity > 0.3 for better coverage)
                # Higher score = more similar (cosine similarity ranges from -1 to 1, but typically 0-1)
                MIN_RELEVANCE_THRESHOLD = 0.25  # Lowered to get more results (user wants at least 3)
                MAX_SOURCES = 5  # Fetch more candidates to ensure we get 3 good ones
                MIN_SOURCES = 3  # Always try to return at least 3 sources (user requirement)
                
                # Track seen page numbers to avoid duplicates
                seen_pages = set()
                
                # Collect all valid sources first
                valid_sources = []
                
                import re  # For extracting page numbers from content
                
                for doc, score in search_results:
                    # Convert cosine similarity to relevance percentage (0-100%)
                    # Cosine similarity of 1.0 = 100% relevance, 0.5 = 50% relevance
                    relevance_pct = max(0, min(100, score * 100))
                    
                    # Filter by minimum relevance threshold
                    if score < MIN_RELEVANCE_THRESHOLD:
                        continue
                    
                    if hasattr(doc, 'metadata'):
                        metadata = doc.metadata
                        
                        # Try multiple ways to get page number - ONLY use actual page numbers
                        page_num = None
                        
                        # FIRST: Try to extract page number from content itself (most accurate)
                        # Look for patterns like "Page 82 of 89" or "Page 82" in the content
                        content_page_match = re.search(r'Page\s+(\d+)\s+of\s+\d+', doc.page_content, re.IGNORECASE)
                        if not content_page_match:
                            content_page_match = re.search(r'Page\s+(\d+)', doc.page_content, re.IGNORECASE)
                        
                        if content_page_match:
                            content_page = content_page_match.group(1)
                            # Validate it's a reasonable page number (1-1000)
                            if content_page.isdigit() and 1 <= int(content_page) <= 1000:
                                page_num = content_page
                                print(f"   ✅ Extracted page number {page_num} from content (was in metadata: {metadata.get('pageNumber', 'N/A')})")
                        
                        # SECOND: Use metadata page number if content extraction didn't work
                        metadata_page_num = None
                        if not page_num:
                            # Try to get the most specific page number from metadata
                            if metadata.get("pageNumbers"):
                                # If multiple pages, prefer the one that makes most sense
                                page_list = [p.strip() for p in str(metadata.get("pageNumbers")).split(",")]
                                # Use first page number (usually most relevant)
                                metadata_page_num = page_list[0] if page_list else None
                            elif metadata.get("pageNumber"):
                                metadata_page_num = str(metadata.get("pageNumber")).strip()
                            elif metadata.get("page"):
                                metadata_page_num = str(metadata.get("page")).strip()
                            
                            page_num = metadata_page_num
                        
                        # THIRD: Verify page number accuracy by checking if query terms appear in snippet
                        # This helps catch cases where metadata page number is wrong
                        if page_num and query:
                            # Get key search terms (remove common words and numbers)
                            key_terms = [w for w in query.split() if len(w) > 2 and w.lower() not in ['the', 'and', 'for', 'with', 'from', 'that', 'this', 'must', 'shall', 'will', 'are', 'was', 'were', 'has', 'have', 'been']]
                            
                            if key_terms:
                                snippet_lower = doc.page_content[:800].lower()  # Check first 800 chars
                                query_terms_lower = [t.lower() for t in key_terms[:5]]  # Check top 5 terms
                                terms_found = sum(1 for term in query_terms_lower if term in snippet_lower)
                                
                                # If less than 40% of key terms found, the page number might be wrong
                                # Try to find a better page number by checking if content mentions a different page
                                if terms_found < len(query_terms_lower) * 0.4:
                                    print(f"   ⚠️  Warning: Only {terms_found}/{len(query_terms_lower)} key terms found in snippet for page {page_num}")
                                    print(f"      Query: {query[:50]}...")
                                    print(f"      Snippet preview: {doc.page_content[:100]}...")
                                    
                                    # Try to find page number mentioned in content that might be more accurate
                                    alt_page_match = re.search(r'[Pp]age\s+(\d+)', doc.page_content)
                                    if alt_page_match:
                                        alt_page = alt_page_match.group(1)
                                        if alt_page != page_num and alt_page.isdigit() and 1 <= int(alt_page) <= 1000:
                                            print(f"   🔄 Found alternative page number {alt_page} in content, using it instead of {page_num}")
                                            page_num = alt_page
                        
                        # CRITICAL: Only use actual page numbers - skip if not available
                        if not page_num or page_num.lower() in ['none', 'null', '', 'n/a', '0']:
                            continue
                        
                        # Validate page number is numeric and reasonable
                        if not page_num.isdigit() or not (1 <= int(page_num) <= 1000):
                            print(f"   ⚠️  Invalid page number: {page_num}, skipping")
                            continue
                        
                        # Skip if we've already seen this page number (avoid duplicates)
                        page_key = f"{page_num}_{metadata.get('fileName', '')}"
                        if page_key in seen_pages:
                            continue
                        seen_pages.add(page_key)
                        
                        # Extract snippet (first 300 chars of content for better context)
                        snippet = doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content
                        
                        # Only add if snippet has meaningful content
                        if snippet and len(snippet.strip()) > 10:
                            valid_sources.append({
                                "pageNumber": page_num,
                                "fileName": metadata.get("fileName", metadata.get("source", "document.pdf")),
                                "snippet": snippet,
                                "relevance": round(relevance_pct, 1),
                                "chunkIndex": metadata.get("chunkIndex", 0),
                                "score": score  # Keep original score for sorting
                            })
                
                # Sort by relevance (highest first) and take top 3 (user wants at least 3)
                valid_sources.sort(key=lambda x: x['score'], reverse=True)
                sources = valid_sources[:3]  # Always return top 3 most relevant
                
                # If we don't have enough sources, try to get more (even if below threshold)
                if len(sources) < MIN_SOURCES and len(search_results) > len(valid_sources):
                    print(f"   ⚠️  Only found {len(sources)} sources, trying to get more...")
                    # Get additional sources with lower threshold
                    for doc, score in search_results:
                        if len(sources) >= MIN_SOURCES:
                            break
                        
                        # Skip if already in sources
                        if hasattr(doc, 'metadata'):
                            metadata = doc.metadata
                            page_num = None
                            
                            # FIRST: Try to extract page number from content itself
                            content_page_match = re.search(r'Page\s+(\d+)\s+of\s+\d+', doc.page_content, re.IGNORECASE)
                            if not content_page_match:
                                content_page_match = re.search(r'Page\s+(\d+)', doc.page_content, re.IGNORECASE)
                            
                            if content_page_match:
                                content_page = content_page_match.group(1)
                                if content_page.isdigit() and 1 <= int(content_page) <= 1000:
                                    page_num = content_page
                                    print(f"   ✅ Extracted page number {page_num} from content (fallback)")
                            
                            # SECOND: Use metadata if content extraction didn't work
                            if not page_num:
                                if metadata.get("pageNumbers"):
                                    page_num = str(metadata.get("pageNumbers")).split(",")[0].strip()
                                elif metadata.get("pageNumber"):
                                    page_num = str(metadata.get("pageNumber")).strip()
                                elif metadata.get("page"):
                                    page_num = str(metadata.get("page")).strip()
                            
                            if not page_num or page_num.lower() in ['none', 'null', '', 'n/a', '0']:
                                continue
                            
                            # Validate page number
                            if not page_num.isdigit() or not (1 <= int(page_num) <= 1000):
                                continue
                            
                            page_key = f"{page_num}_{metadata.get('fileName', '')}"
                            if page_key in seen_pages:
                                continue
                            
                            # Check if already in sources
                            already_added = any(s['pageNumber'] == page_num and s['fileName'] == metadata.get('fileName', '') for s in sources)
                            if already_added:
                                continue
                            
                            seen_pages.add(page_key)
                            snippet = doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content
                            
                            if snippet and len(snippet.strip()) > 10:
                                relevance_pct = max(0, min(100, score * 100))
                                sources.append({
                                    "pageNumber": page_num,
                                    "fileName": metadata.get("fileName", metadata.get("source", "document.pdf")),
                                    "snippet": snippet,
                                    "relevance": round(relevance_pct, 1),
                                    "chunkIndex": metadata.get("chunkIndex", 0),
                                    "score": score
                                })
                                print(f"   📄 Added fallback source: Page {page_num}, Relevance: {round(relevance_pct, 1)}%")
                
                # Log final sources
                for i, source in enumerate(sources):
                    print(f"   📄 Source {i+1}: Page {source['pageNumber']}, Relevance: {source['relevance']}%, File: {source['fileName']}")
            else:
                # Query general knowledge base
                print("🔎 Querying general knowledge base (no document ID)")
                search_results = docsearch.similarity_search_with_score(query, k=20)
                print(f"✅ Found {len(search_results)} candidate chunks from general knowledge base")
                
                # Filter by minimum relevance threshold (lowered for better coverage)
                MIN_RELEVANCE_THRESHOLD = 0.25
                MAX_SOURCES = 5  # Fetch more candidates
                MIN_SOURCES = 3  # Always return at least 3 sources
                seen_pages = set()
                
                # Collect all valid sources first
                valid_sources = []
                
                for doc, score in search_results:
                    # Convert cosine similarity to relevance percentage
                    relevance_pct = max(0, min(100, score * 100))
                    
                    # Filter by minimum relevance threshold
                    if score < MIN_RELEVANCE_THRESHOLD:
                        continue
                    
                    if hasattr(doc, 'metadata'):
                        metadata = doc.metadata
                        
                        # Try multiple ways to get page number - ONLY use actual page numbers
                        page_num = None
                        
                        # FIRST: Try to extract page number from content itself
                        content_page_match = re.search(r'Page\s+(\d+)\s+of\s+\d+', doc.page_content, re.IGNORECASE)
                        if not content_page_match:
                            content_page_match = re.search(r'Page\s+(\d+)', doc.page_content, re.IGNORECASE)
                        
                        if content_page_match:
                            content_page = content_page_match.group(1)
                            if content_page.isdigit() and 1 <= int(content_page) <= 1000:
                                page_num = content_page
                                print(f"   ✅ Extracted page number {page_num} from content (general KB)")
                        
                        # SECOND: Use metadata if content extraction didn't work
                        if not page_num:
                            if metadata.get("pageNumbers"):
                                page_num = str(metadata.get("pageNumbers")).split(",")[0].strip()
                            elif metadata.get("pageNumber"):
                                page_num = str(metadata.get("pageNumber")).strip()
                            elif metadata.get("page"):
                                page_num = str(metadata.get("page")).strip()
                        
                        # CRITICAL: Only use actual page numbers - skip if not available
                        if not page_num or page_num.lower() in ['none', 'null', '', 'n/a', '0']:
                            continue
                        
                        # Validate page number
                        if not page_num.isdigit() or not (1 <= int(page_num) <= 1000):
                            continue
                        
                        # Skip if we've already seen this page number
                        page_key = f"{page_num}_{metadata.get('fileName', '')}"
                        if page_key in seen_pages:
                            continue
                        seen_pages.add(page_key)
                        
                        snippet = doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content
                        
                        if snippet and len(snippet.strip()) > 10:
                            valid_sources.append({
                                "pageNumber": page_num,
                                "fileName": metadata.get("fileName", metadata.get("source", "document.pdf")),
                                "snippet": snippet,
                                "relevance": round(relevance_pct, 1),
                                "chunkIndex": metadata.get("chunkIndex", 0),
                                "score": score
                            })
                
                # Sort by relevance and take top 3 (user wants at least 3)
                valid_sources.sort(key=lambda x: x['score'], reverse=True)
                sources = valid_sources[:3]  # Always return top 3 most relevant
                
                # If we don't have enough, try to get more with lower threshold
                if len(sources) < MIN_SOURCES and len(search_results) > len(valid_sources):
                    for doc, score in search_results:
                        if len(sources) >= MIN_SOURCES:
                            break
                        
                        if hasattr(doc, 'metadata'):
                            metadata = doc.metadata
                            page_num = None
                            if metadata.get("pageNumbers"):
                                page_num = str(metadata.get("pageNumbers")).split(",")[0].strip()
                            elif metadata.get("pageNumber"):
                                page_num = str(metadata.get("pageNumber")).strip()
                            elif metadata.get("page"):
                                page_num = str(metadata.get("page")).strip()
                            
                            if not page_num or page_num.lower() in ['none', 'null', '', 'n/a', '0']:
                                continue
                            
                            page_key = f"{page_num}_{metadata.get('fileName', '')}"
                            if page_key in seen_pages:
                                continue
                            
                            already_added = any(s['pageNumber'] == page_num and s['fileName'] == metadata.get('fileName', '') for s in sources)
                            if already_added:
                                continue
                            
                            seen_pages.add(page_key)
                            snippet = doc.page_content[:300] + "..." if len(doc.page_content) > 300 else doc.page_content
                            
                            if snippet and len(snippet.strip()) > 10:
                                relevance_pct = max(0, min(100, score * 100))
                                sources.append({
                                    "pageNumber": page_num,
                                    "fileName": metadata.get("fileName", metadata.get("source", "document.pdf")),
                                    "snippet": snippet,
                                    "relevance": round(relevance_pct, 1),
                                    "chunkIndex": metadata.get("chunkIndex", 0),
                                    "score": score
                                })
        except Exception as e:
            print(f"⚠️  Error querying Pinecone: {str(e)}")
            import traceback
            traceback.print_exc()
            # Return error details for debugging
            return jsonify({
                "success": False,
                "error": str(e),
                "sources": [],
                "count": 0
            }), 500
        
        # Sort sources by relevance (highest first)
        sources.sort(key=lambda x: x.get('relevance', 0), reverse=True)
        
        print(f"📚 Returning {len(sources)} sources (filtered by relevance >= 50%)")
        
        # If still no sources, provide helpful message
        if len(sources) == 0:
            print(f"⚠️  WARNING: No sources found for query: '{query}' (all results below relevance threshold 50%)")
            print(f"   Document ID: {document_id}")
            print(f"   This might mean:")
            print(f"   1. Document {document_id} is not indexed in Pinecone")
            print(f"   2. The query doesn't match any content in the document")
            print(f"   3. The namespace doesn't exist in Pinecone")
        
        return jsonify({
            "success": True,
            "sources": sources,
            "count": len(sources),
            "query": query,
            "documentId": document_id
        })
        
    except Exception as e:
        error_msg = f"Error getting sources: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": error_msg,
            "sources": [],
            "count": 0
        }), 500


@app.route("/get-references", methods=["GET", "POST"])
def get_references():
    """Get reference links for a specific document from ChromaDB"""
    try:
        if request.is_json:
            data = request.get_json()
            document_id = data.get("documentId", None)
            query = data.get("query", "")
        else:
            document_id = request.form.get("documentId", None)
            query = request.form.get("query", "")
        
        if not document_id:
            return jsonify({"error": "documentId is required"}), 400
        
        # Get reference links from ChromaDB
        if query:
            # Search-based references
            results = search_chroma_documents(
                query=query,
                file_hash=document_id,
                k=10
            )
            references = [
                {
                    "link": r.get("referenceLink", ""),
                    "pageNumber": r.get("pageNumber"),
                    "fileName": r.get("fileName", ""),
                    "score": r.get("score", 0.0)
                }
                for r in results
            ]
        else:
            # Get all references for document
            references = get_document_references(document_id)
            references = [
                {
                    "link": r.get("referenceLink", ""),
                    "pageNumber": r.get("pageNumber"),
                    "fileName": r.get("fileName", ""),
                    "chunkId": r.get("chunkId", "")
                }
                for r in references
            ]
        
        return jsonify({
            "success": True,
            "documentId": document_id,
            "references": references,
            "count": len(references)
        })
        
    except Exception as e:
        error_msg = f"Error getting references: {str(e)}"
        print(f"❌ {error_msg}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": error_msg}), 500


if __name__ == '__main__':
    app.run(host="0.0.0.0", port= 8080, debug= True)
