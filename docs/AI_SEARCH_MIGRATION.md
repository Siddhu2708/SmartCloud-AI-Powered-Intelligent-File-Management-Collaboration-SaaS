# SmartCloud AI Search & LLM Migration Guide

## Executive Summary

SmartCloud currently uses **OpenRouter API with proprietary models** and implements only **keyword-based search** without real semantic understanding or document content RAG. This document outlines the complete migration to **local, open-source infrastructure** using:

- **LLM**: Ollama + Mistral/Llama (free, privacy-preserving, no API costs)
- **Embeddings**: Sentence-Transformers (local, fast, no external dependencies)
- **Vector Search**: PostgreSQL pgvector (already in schema)
- **RAG**: Proper document chunking and content-based retrieval

---

## Current Issues

### 1. **Search is Keyword-Only**
- `/ai/search` endpoint uses basic tokenization and TF-style scoring
- No semantic understanding of query intent
- Cannot find conceptually related documents ("machine learning" ≠ "deep learning models")
- Results depend on exact word matches

### 2. **No Real Document RAG**
- System passes only file **metadata** (name, type, size) to LLM
- No actual document **content** is retrieved or indexed
- Context block says "user has these files" but provides no summaries
- `/ai/summarize` accepts only `content_hint` (preview), not full content

### 3. **Missing Embeddings Pipeline**
- `document_chunks` table in schema is reserved but never populated
- No chunking strategy for splitting large documents
- No embedding storage or vector similarity search

### 4. **External API Dependency**
- Relies on OpenRouter (proprietary models, requires API key and internet)
- Model availability risk (`nvidia/nemotron-3.5-lightning:free` could be discontinued)
- Per-request latency and potential rate limits
- Privacy concern: file metadata sent to third-party API

### 5. **Stubbed Components**
- Authentication layer incomplete (delegated to Supabase)
- File upload endpoint not implemented
- No file content extraction (PDFs, DOCX, etc.)

---

## Proposed Solution Architecture

### A. Local LLM Integration (Ollama)

**Why Ollama?**
- Runs locally on any machine (Linux, macOS, Windows with WSL2)
- Free, open-source, privacy-preserving
- Supports multiple models: Mistral, Llama, Neural, Orca, etc.
- OpenAI-compatible API (minimal code changes)
- No API key, no rate limits, no internet required

**Installation & Setup:**
```bash
# macOS (Homebrew)
brew install ollama
ollama serve

# Linux
curl https://ollama.ai/install.sh | sh
ollama serve

# Windows (WSL2)
curl https://ollama.ai/install.sh | sh
ollama serve

# Pull a model
ollama pull mistral  # 4.1 GB, very capable
# OR
ollama pull llama2   # 3.8 GB, popular
# OR
ollama pull neural-chat  # 4.1 GB, optimized for chat
```

**Model Selection:**
| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| Mistral | 4.1 GB | Fast | Excellent | **Recommended** – best balance |
| Llama 2 | 3.8 GB | Medium | Good | General purpose |
| Neural Chat | 4.1 GB | Fast | Very Good | Chat & questions |
| Dolphin Mixtral | 26 GB | Slower | Excellent | If resources available |

**Backend Configuration:**
- Default: `http://localhost:11434` (Ollama's default endpoint)
- Environment variable: `OLLAMA_BASE_URL` and `OLLAMA_MODEL`
- Fallback: If Ollama unavailable, gracefully degrade to offline mode

---

### B. Local Embeddings (Sentence-Transformers)

**Why Sentence-Transformers?**
- Converts text to dense vectors (1536-dim or configurable)
- Pre-trained on large text corpus, good generalization
- Runs locally, no external API calls
- Fast (~50ms for typical document chunks)
- Hugging Face models available

**Pipeline:**
```python
from sentence_transformers import SentenceTransformer

# Load model once at startup (cached)
model = SentenceTransformer('all-MiniLM-L6-v2')  # 22 MB, very fast

# Convert text to embedding
chunk = "Machine learning is a subset of artificial intelligence..."
embedding = model.encode(chunk)  # Returns [1536] numpy array

# Store in PostgreSQL
supabase.execute("""
  INSERT INTO document_chunks (file_id, owner_id, chunk_index, content, embedding)
  VALUES (%s, %s, %s, %s, %s)
""", (file_id, user_id, 0, chunk, embedding))

# Search by similarity
results = supabase.execute("""
  SELECT file_id, content, 1 - (embedding <=> query_embedding) as similarity
  FROM document_chunks
  WHERE owner_id = %s
  ORDER BY embedding <=> query_embedding
  LIMIT 5
""")
```

---

### C. Document Processing Pipeline

**Chunking Strategy:**
- Split documents into 512-token chunks with 128-token overlap
- Preserve semantic boundaries (split on paragraphs when possible)
- Store chunk index for reconstruction

**Supported Formats:**
- **Text/Markdown**: Direct splitting
- **PDF**: Use PyPDF2 or pdfplumber to extract text, then chunk
- **DOCX**: Use python-docx to extract text
- **Code**: Keep intact or split by functions

**Implementation:**
```python
def chunk_document(content: str, chunk_size: int = 512, overlap: int = 128):
    """Split document into overlapping chunks."""
    words = content.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = ' '.join(words[i:i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks

def process_file(file_id: str, owner_id: str, content: str):
    """Extract, chunk, embed, and store document."""
    chunks = chunk_document(content)
    embeddings = model.encode(chunks)  # Batch encode
    
    for idx, (chunk, emb) in enumerate(zip(chunks, embeddings)):
        db.insert_chunk(file_id, owner_id, idx, chunk, emb)
```

---

## Implementation Plan

### Phase 1: Backend Setup (Steps 2-6)

**Step 2.1: Update `backend/requirements.txt`**
```
sentence-transformers>=2.2.2
ollama>=0.1.0
pdfplumber>=0.10.0
python-docx>=0.8.11
```

**Step 2.2: Create `backend/app/services/embeddings.py`**
- Initialize SentenceTransformer model
- Cache model in memory
- Provide encode() method for text → vector
- Handle model download and caching

**Step 2.3: Create `backend/app/services/document_processor.py`**
- Chunk documents based on format
- Extract text from PDFs, DOCX, etc.
- Call embeddings service to generate vectors
- Store in PostgreSQL

**Step 3: Implement `backend/app/services/ollama_service.py`**
- Wrapper around Ollama's OpenAI-compatible API
- Graceful fallback if Ollama unavailable
- Response streaming support
- Configurable model switching

**Step 4: Create `backend/app/services/rag_service.py`**
- Query embeddings to fetch relevant chunks
- Rerank results by similarity score
- Format chunks into LLM context
- Handle permission filtering

**Step 5: Update `backend/app/config.py`**
- Add `OLLAMA_BASE_URL` (default: `http://localhost:11434`)
- Add `OLLAMA_MODEL` (default: `mistral`)
- Add `EMBEDDING_MODEL` (default: `all-MiniLM-L6-v2`)
- Add `USE_LOCAL_LLM` flag (default: `True`)
- Keep OpenRouter fallback for backwards compatibility

**Step 6: Update `backend/app/api/ai.py`**
- Modify `/ai/search` to use embedding similarity
- Modify `/ai/chat` to fetch and include document chunks
- Add `/ai/upload` to process and embed file content on upload
- Update `/ai/summarize` to use actual content

### Phase 2: Frontend Updates (Step 9)

**Step 9: Update `frontend/src/app/ai/search/page.tsx`**
- Modify AI search to display embedding confidence scores
- Show semantic relevance badges
- Provide better source attribution
- Add "semantic vs keyword" toggle for debugging

### Phase 3: Documentation (Step 10)

**Setup Guide:**
- Installation instructions for Ollama (all platforms)
- Model download guide
- Docker Compose setup for production
- Troubleshooting

### Phase 4: Testing (Step 11)

**Test Cases:**
- ✅ Search finds semantically related documents
- ✅ RAG includes document content in chat
- ✅ Ollama model switching works
- ✅ Fallback to offline mode if Ollama unavailable
- ✅ Permission filtering still works
- ✅ Organization smart folder detection still works

---

## Code Changes Roadmap

### File Changes Summary

| File | Change | Purpose |
|------|--------|---------|
| `backend/requirements.txt` | Add deps | Embeddings, PDF parsing, Ollama client |
| `backend/app/config.py` | Add config | Ollama URL, model names, feature flags |
| `backend/app/services/embeddings.py` | **NEW** | Local text-to-vector encoding |
| `backend/app/services/document_processor.py` | **NEW** | Chunking and file format extraction |
| `backend/app/services/ollama_service.py` | **NEW** | Ollama LLM integration |
| `backend/app/services/rag_service.py` | **NEW** | Vector search and context building |
| `backend/app/services/ai_service.py` | Update | Integrate RAG and embeddings |
| `backend/app/api/ai.py` | Update | New endpoints, semantic search |
| `frontend/src/app/ai/search/page.tsx` | Update | Display embedding scores |
| `database/migrations/003_enable_pgvector.sql` | **NEW** | Enable pgvector extension |
| `docs/OLLAMA_SETUP.md` | **NEW** | Installation and setup guide |

---

## Migration Steps (Detailed Implementation Order)

1. ✅ **Task 1: Analysis** (this document)
2. **Task 2-6**: Update requirements, create embeddings, configure Ollama
3. **Task 7**: Update search endpoint to use embeddings
4. **Task 8**: Implement RAG with document chunks
5. **Task 9**: Update frontend to display results
6. **Task 10**: Create setup guide
7. **Task 11**: End-to-end testing

---

## Backwards Compatibility

**No Breaking Changes:**
- Existing `/ai/chat` and `/ai/search` endpoints maintain same request/response format
- Optional: Frontend can continue using existing code without changes
- OpenRouter fallback remains available if Ollama not configured
- Database migration is additive (no dropping columns)

**Graceful Degradation:**
```python
if USE_LOCAL_LLM and ollama_available():
    # Use local Ollama + embeddings
    use_ollama_service()
elif openrouter_available():
    # Fall back to OpenRouter
    use_openrouter_service()
else:
    # Offline mode: keyword search only
    return_error_or_cached_results()
```

---

## Performance Expectations

**Latency Improvements:**
- Search: 50ms (embeddings locally) vs 2000ms+ (API roundtrip)
- Chat: 2-5s (Ollama on decent hardware) vs 5-10s (OpenRouter)

**Resource Usage:**
- Ollama: ~4 GB RAM, ~4 GB VRAM (GPU optional, helpful)
- Embeddings model: ~500 MB RAM, loaded once
- PostgreSQL pgvector: Minimal overhead

**Throughput:**
- Embeddings: ~200 documents/sec on CPU (GPU: 1000+/sec)
- Vector search: ~10ms for 10k chunks

---

## Security & Privacy

**Advantages of Local Setup:**
- ✅ No file content sent to external APIs
- ✅ No API key exposure
- ✅ Complete data privacy (only on local machine or self-hosted)
- ✅ GDPR/CCPA compliant by design

**Considerations:**
- Row-level security in PostgreSQL still enforced
- User embeddings are separate per user
- No cross-user data leakage (vector search scoped by owner_id)

---

## Troubleshooting

### Ollama Not Found
```
Error: connection refused http://localhost:11434
Solution: Start Ollama with `ollama serve` or check OLLAMA_BASE_URL config
```

### Out of Memory
```
Error: CUDA out of memory
Solution: Use CPU-only model or reduce batch size
```

### Embeddings Too Slow
```
Solution: Download faster model (all-MiniLM-L6-v2) or use GPU
```

### pgvector Extension Not Available
```
Solution: Run migration 003_enable_pgvector.sql
```

---

## Next Steps

1. Install Ollama locally
2. Execute implementation tasks in order (2-11)
3. Test with sample documents
4. Deploy to production with Docker Compose

