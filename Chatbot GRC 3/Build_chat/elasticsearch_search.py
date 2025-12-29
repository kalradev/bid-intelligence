"""
Elasticsearch Global Search Integration
Provides global search capabilities using Elasticsearch
"""
import os
from dotenv import load_dotenv
import requests
from requests.auth import HTTPBasicAuth
import base64
from typing import List, Dict

load_dotenv()

def elasticsearch_search(query: str, num_results: int = 5, index: str = None) -> List[Dict]:
    """
    Perform global search using Elasticsearch
    
    Args:
        query: Search query string
        num_results: Number of results to return (default: 5)
        index: Elasticsearch index to search (optional, searches all if not specified)
    
    Returns:
        List of search results with title, snippet, and link
    """
    try:
        # Get Elasticsearch configuration from environment
        # Support both formats: elasticsearch/elasticsearch_api_key and ELASTICSEARCH_ENDPOINT/ELASTICSEARCH_API_KEY
        elasticsearch_endpoint = os.environ.get('ELASTICSEARCH_ENDPOINT') or os.environ.get('elasticsearch')
        elasticsearch_api_key = os.environ.get('ELASTICSEARCH_API_KEY') or os.environ.get('elasticsearch_api_key')
        
        if not elasticsearch_endpoint or not elasticsearch_api_key:
            print("Warning: Elasticsearch endpoint or API key not found in .env file")
            return []
        
        # Clean endpoint (remove trailing slash if present)
        endpoint = elasticsearch_endpoint.rstrip('/')
        
        # Prepare search URL
        if index:
            search_url = f"{endpoint}/{index}/_search"
        else:
            # Search across all indices
            search_url = f"{endpoint}/_search"
        
        # Prepare Elasticsearch query
        es_query = {
            "size": num_results,
            "query": {
                "multi_match": {
                    "query": query,
                    "fields": ["title^2", "content", "text", "body", "description"],
                    "type": "best_fields",
                    "fuzziness": "AUTO"
                }
            },
            "highlight": {
                "fields": {
                    "content": {},
                    "text": {},
                    "body": {},
                    "description": {}
                },
                "fragment_size": 150,
                "number_of_fragments": 1
            }
        }
        
        # Prepare headers with API key authentication
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"ApiKey {elasticsearch_api_key}"
        }
        
        # Make request to Elasticsearch
        response = requests.post(
            search_url,
            json=es_query,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            results = []
            
            if "hits" in data and "hits" in data["hits"]:
                for hit in data["hits"]["hits"]:
                    source = hit.get("_source", {})
                    highlight = hit.get("highlight", {})
                    
                    # Extract title
                    title = (
                        source.get("title") or 
                        source.get("name") or 
                        source.get("_id") or 
                        "Untitled"
                    )
                    
                    # Extract snippet from highlight or content
                    snippet = ""
                    if highlight:
                        # Get first highlighted fragment
                        for field in ["content", "text", "body", "description"]:
                            if field in highlight:
                                snippet = " ".join(highlight[field][:1])
                                break
                    
                    if not snippet:
                        snippet = (
                            source.get("content", "")[:200] or
                            source.get("text", "")[:200] or
                            source.get("body", "")[:200] or
                            source.get("description", "")[:200] or
                            ""
                        )
                    
                    # Extract link/URL
                    link = (
                        source.get("url") or 
                        source.get("link") or 
                        source.get("_id") or 
                        "#"
                    )
                    
                    results.append({
                        "title": title,
                        "snippet": snippet.strip(),
                        "link": link,
                        "score": hit.get("_score", 0)
                    })
            
            print(f"Elasticsearch found {len(results)} results for query: {query}")
            return results
        else:
            print(f"Elasticsearch error: {response.status_code} - {response.text}")
            return []
            
    except requests.exceptions.RequestException as e:
        print(f"Elasticsearch connection error: {str(e)}")
        return []
    except Exception as e:
        print(f"Elasticsearch search error: {str(e)}")
        return []


def elasticsearch_search_simple(query: str, num_results: int = 5) -> List[Dict]:
    """
    Simplified Elasticsearch search that works with common Elasticsearch setups
    Uses a simpler query structure
    """
    try:
        # Support both environment variable formats
        elasticsearch_endpoint = os.environ.get('ELASTICSEARCH_ENDPOINT') or os.environ.get('elasticsearch')
        elasticsearch_api_key = os.environ.get('ELASTICSEARCH_API_KEY') or os.environ.get('elasticsearch_api_key')
        
        if not elasticsearch_endpoint or not elasticsearch_api_key:
            print("Warning: Elasticsearch configuration not found")
            return []
        
        endpoint = elasticsearch_endpoint.rstrip('/')
        search_url = f"{endpoint}/_search"
        
        # Simple query that works with most Elasticsearch setups
        es_query = {
            "size": num_results,
            "query": {
                "query_string": {
                    "query": query,
                    "default_operator": "AND"
                }
            }
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"ApiKey {elasticsearch_api_key}"
        }
        
        response = requests.post(
            search_url,
            json=es_query,
            headers=headers,
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            results = []
            
            if "hits" in data and "hits" in data["hits"]:
                for hit in data["hits"]["hits"]:
                    source = hit.get("_source", {})
                    
                    title = source.get("title") or source.get("_id") or "Result"
                    snippet = source.get("content") or source.get("text") or source.get("body") or ""
                    link = source.get("url") or source.get("link") or "#"
                    
                    results.append({
                        "title": title[:100],
                        "snippet": snippet[:200],
                        "link": link,
                        "score": hit.get("_score", 0)
                    })
            
            return results
        else:
            print(f"Elasticsearch error: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"Elasticsearch search error: {str(e)}")
        return []


if __name__ == "__main__":
    # Test function
    print("Testing Elasticsearch connection...")
    results = elasticsearch_search("test query", num_results=3)
    print(f"Results: {len(results)}")
    for result in results:
        print(f"- {result['title']}: {result['snippet'][:50]}...")

