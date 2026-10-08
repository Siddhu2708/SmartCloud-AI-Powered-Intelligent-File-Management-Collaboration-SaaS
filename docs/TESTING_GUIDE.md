# SmartCloud AI Testing Guide

Complete end-to-end testing procedures for semantic search, RAG, and local LLM functionality.

## Prerequisites

Before testing, ensure:

1. ✅ Ollama is running: `ollama serve`
2. ✅ Model is downloaded: `ollama list` shows `mistral` or other model
3. ✅ Backend is running: `python -m uvicorn app.main:app --reload`
4. ✅ Frontend is running: `npm run dev`
5. ✅ Database migrations applied: pgvector enabled in Supabase
6. ✅ `.env` configured: `USE_LOCAL_LLM=true`, `OLLAMA_BASE_URL=http://localhost:11434`

---

## Test 1: Backend Health Check

**Objective:** Verify Ollama, embeddings, and configuration are working

**Command:**

```bash
curl http://localhost:8000/ai/health
```

**Expected Response:**

```json
{
  "status": "ok",
  "llm_type": "ollama",
  "model": "mistral",
  "ollama_available": true
}
```

**Troubleshooting:**

- `"ollama_available": false` → Start Ollama (`ollama serve`)
- `"status": "error"` → Check backend logs for Python errors
- Connection refused → Backend not running

---

## Test 2: Embeddings Generation

**Objective:** Verify local embeddings are working

**Create test script** `test_embeddings.py`:

```python
from app.services.embeddings import encode, get_embedding_dimension

# Test single text
text = "Machine learning is a subset of artificial intelligence"
embedding = encode(text)

print(f"Embedding dimension: {get_embedding_dimension()}")
print(f"Embedding shape: {embedding.shape}")
print(f"First 10 values: {embedding[:10]}")
print(f"✅ Embeddings working!")

# Test batch
texts = [
    "What is machine learning?",
    "How does neural network training work?",
    "Explain deep learning concepts",
]
batch_embeddings = encode(texts)
print(f"Batch shape: {batch_embeddings.shape}")
print(f"✅ Batch embeddings working!")
```

**Run:**

```bash
cd backend
python test_embeddings.py
```

**Expected Output:**

```
Embedding dimension: 384
Embedding shape: (384,)
First 10 values: [0.123, -0.456, ...]
✅ Embeddings working!
Batch shape: (3, 384)
✅ Batch embeddings working!
```

---

## Test 3: Document Processing & Chunking

**Objective:** Verify file extraction and chunking

**Create test script** `test_document_processor.py`:

```python
from app.services.document_processor import process_document

# Test with sample text
content = """
Machine learning is a subset of artificial intelligence that enables 
systems to learn and improve from experience without explicit programming.

There are several types of machine learning:
1. Supervised Learning - learning from labeled data
2. Unsupervised Learning - finding patterns in unlabeled data
3. Reinforcement Learning - learning through rewards and penalties

Deep learning uses neural networks with multiple layers to process data.
Transfer learning reuses pre-trained models for new tasks.
""".encode()

chunks = process_document(
    file_bytes=content,
    file_name="test.txt",
    mime_type="text/plain"
)

print(f"Number of chunks: {len(chunks)}")
for i, chunk in enumerate(chunks[:2]):  # Show first 2 chunks
    print(f"\nChunk {i+1}:")
    print(f"  Content: {chunk['content'][:100]}...")
    print(f"  Embedding dim: {len(chunk['embedding'])}")

print(f"\n✅ Document processing working!")
```

**Run:**

```bash
cd backend
python test_document_processor.py
```

**Expected Output:**

```
Number of chunks: 2-4
Chunk 1:
  Content: Machine learning is a subset of artificial intelligence...
  Embedding dim: 384
✅ Document processing working!
```

---

## Test 4: Vector Search (RAG)

**Objective:** Verify pgvector and vector similarity search

**Prerequisite:** Ensure test user ID and sample data:

```bash
# Get your user ID from Supabase auth
export TEST_USER_ID="550e8400-e29b-41d4-a716-446655440000"  # Replace with real UUID
```

**Create test script** `test_rag.py`:

```python
from app.services.rag_service import RAGService
from app.services.embeddings import encode
from uuid import uuid4

rag = RAGService()

# Create sample chunks
file_id = str(uuid4())
owner_id = "550e8400-e29b-41d4-a716-446655440000"  # Replace with real user UUID

test_chunks = [
    {
        "chunk_index": 0,
        "content": "Machine learning enables computers to learn from data",
        "embedding": encode("Machine learning enables computers to learn from data").tolist()
    },
    {
        "chunk_index": 1,
        "content": "Deep neural networks have multiple layers of artificial neurons",
        "embedding": encode("Deep neural networks have multiple layers of artificial neurons").tolist()
    },
    {
        "chunk_index": 2,
        "content": "Transfer learning reuses pre-trained models for new tasks",
        "embedding": encode("Transfer learning reuses pre-trained models for new tasks").tolist()
    },
]

# Store chunks
print("Storing test chunks...")
success = rag.store_chunks(file_id, owner_id, test_chunks)
if success:
    print("✅ Chunks stored successfully")
else:
    print("❌ Failed to store chunks")

# Retrieve relevant chunks
print("\nSearching for: 'neural networks'")
results = rag.retrieve("neural networks", owner_id, top_k=3)

print(f"Found {len(results)} results:")
for r in results:
    print(f"  - Score: {r.get('similarity', 0):.2f} | {r.get('content', '')[:60]}...")

if len(results) > 0:
    print("✅ Vector search working!")
else:
    print("❌ No results found")

# Get stats
stats = rag.get_stats(owner_id)
print(f"\nStats: {stats}")
```

**Run:**

```bash
cd backend
python test_rag.py
```

**Expected Output:**

```
Storing test chunks...
✅ Chunks stored successfully

Searching for: 'neural networks'
Found 3 results:
  - Score: 0.87 | Deep neural networks have multiple layers...
  - Score: 0.65 | Transfer learning reuses pre-trained...
  - Score: 0.58 | Machine learning enables computers...
✅ Vector search working!

Stats: {'total_chunks': 3, 'total_files': 1, 'owner_id': '550e...'}
```

---

## Test 5: LLM Chat (Ollama)

**Objective:** Verify Ollama integration and chat functionality

**Command:**

```bash
curl -X POST http://localhost:8000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Explain machine learning in one sentence",
    "owner_id": "550e8400-e29b-41d4-a716-446655440000",
    "context_files": []
  }'
```

**Expected Response:**

```json
{
  "answer": "Machine learning is a branch of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.",
  "sources": [],
  "model": "mistral"
}
```

**Troubleshooting:**

- Empty `answer` → Ollama not running or model issues
- Long response time (>10s) → CPU-only, consider GPU or smaller model
- Timeout error → Increase `timeout` in config

---

## Test 6: Semantic Search

**Objective:** Verify semantic search endpoint

**Command:**

```bash
curl -X POST http://localhost:8000/ai/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning algorithms",
    "owner_id": "550e8400-e29b-41d4-a716-446655440000",
    "context_files": []
  }'
```

**Expected Response:**

```json
{
  "results": [
    {
      "title": "File 550e8400...",
      "snippet": "Deep neural networks have multiple layers of artificial neurons",
      "score": 0.87
    }
  ],
  "search_type": "semantic"
}
```

---

## Test 7: Document Indexing

**Objective:** Verify document processing and indexing

**Command:**

```bash
curl -X POST http://localhost:8000/ai/index \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "550e8400-e29b-41d4-a716-446655440001",
    "owner_id": "550e8400-e29b-41d4-a716-446655440000",
    "file_name": "ml_guide.txt",
    "file_type": "text/plain",
    "content": "Machine learning is a subset of artificial intelligence. There are three main types: supervised learning, unsupervised learning, and reinforcement learning. Deep learning uses neural networks with multiple layers to process data automatically."
  }'
```

**Expected Response:**

```json
{
  "chunks_stored": 2,
  "file_id": "550e8400-e29b-41d4-a716-446655440001",
  "status": "indexed"
}
```

---

## Test 8: Frontend Search UI

**Objective:** Verify frontend displays semantic search results

**Steps:**

1. Open browser: `http://localhost:3000/ai/search`
2. Type query: `"machine learning"`
3. Click Search
4. Verify:
   - ✅ Search type indicator shows "semantic AI search"
   - ✅ Results display with relevance badges (e.g., "87% match")
   - ✅ Snippets show in semantic results section
   - ✅ No console errors

**Expected UI:**

```
🧠 Smart Search
Search your files by name, type, or meaning...

[Search box] [Search button]

⚡ Using semantic AI search — finding documents by meaning...

✨ Semantic Search Results
┌─────────────────────────────────────────┐
│ File 550e8400...                   87%   │
│ Deep neural networks have multiple...   │
├─────────────────────────────────────────┤
│ Transfer learning approach...      65%   │
└─────────────────────────────────────────┘
```

---

## Test 9: Frontend Chat UI

**Objective:** Verify RAG-grounded chat responses

**Steps:**

1. Open browser: `http://localhost:3000/ai`
2. Type question: `"What is machine learning?"`
3. Click Send or press Enter
4. Wait for response
5. Verify:
   - ✅ Response appears with LLM answer
   - ✅ Sources show below response (if documents indexed)
   - ✅ "AI online" indicator in header
   - ✅ No console errors

**Expected Response:**

```
You: "What is machine learning?"

SmartCloud AI: "Machine learning is a subset of 
artificial intelligence that enables systems to learn 
and improve from experience without explicit 
programming..."

Sources
📄 File 550e8400...  (Score: 0.87)
```

---

## Test 10: Permission Filtering

**Objective:** Verify user data isolation (security test)

**Setup:**

```bash
# User A's test
export USER_A_ID="550e8400-e29b-41d4-a716-446655440000"
export USER_B_ID="550e8400-e29b-41d4-a716-446655440001"

# User A indexes a document
curl -X POST http://localhost:8000/ai/index \
  -H "Content-Type: application/json" \
  -d '{
    "file_id": "file-a",
    "owner_id": "'$USER_A_ID'",
    "file_name": "secret_a.txt",
    "file_type": "text/plain",
    "content": "User A secret document - confidential"
  }'

# User B tries to search User A's data
curl -X POST http://localhost:8000/ai/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "User A secret",
    "owner_id": "'$USER_B_ID'",
    "context_files": []
  }'
```

**Expected Result:**

- User B search returns: `"results": []`
- User B cannot see User A's data
- ✅ Permission filtering working

---

## Test 11: Fallback to OpenRouter

**Objective:** Verify graceful degradation when Ollama unavailable

**Steps:**

1. Stop Ollama: `kill <ollama-pid>` or Ctrl+C
2. Send chat request:

```bash
curl -X POST http://localhost:8000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Test fallback",
    "owner_id": "550e8400-e29b-41d4-a716-446655440000",
    "context_files": []
  }'
```

3. Verify:
   - If `LLM_API_KEY` set and `USE_LOCAL_LLM=false`:
     - ✅ Falls back to OpenRouter
     - ✅ Response received (slower, requires API)
   - If no fallback configured:
     - ✅ Clear error message explaining AI unavailable
     - ✅ No crash or blank response

---

## Test 12: Performance Benchmarks

**Objective:** Measure response times and throughput

**Embeddings Benchmark:**

```python
import time
from app.services.embeddings import encode

texts = [f"Sample text {i}" for i in range(100)]

start = time.time()
embeddings = encode(texts)
elapsed = time.time() - start

print(f"Embedded 100 texts in {elapsed:.2f}s")
print(f"Average: {elapsed/100*1000:.1f}ms per text")
# Expected: ~2-5ms per text on CPU, <1ms on GPU
```

**Search Benchmark:**

```python
import time
from app.services.rag_service import RAGService

rag = RAGService()

queries = [
    "machine learning",
    "neural networks",
    "deep learning",
]

start = time.time()
for q in queries:
    results = rag.retrieve(q, "test-user", top_k=5)
elapsed = time.time() - start

print(f"3 searches in {elapsed:.2f}s")
print(f"Average: {elapsed/3*1000:.0f}ms per search")
# Expected: 10-50ms per search
```

**LLM Benchmark:**

```bash
time curl -X POST http://localhost:8000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Explain quantum computing",
    "owner_id": "test-user",
    "context_files": []
  }'
# Expected: 2-5s on CPU, 0.5-1s on GPU
```

---

## Integration Test Checklist

Use this checklist to verify end-to-end workflow:

- [ ] Ollama running and model loaded
- [ ] Backend health check passes
- [ ] Embeddings generate correctly (384-dim)
- [ ] Document chunking works (2-10 chunks per page)
- [ ] pgvector RPC function exists
- [ ] Chunks store in database
- [ ] Vector search returns results (sorted by similarity)
- [ ] LLM chat responds within 30s
- [ ] Search endpoint returns semantic results
- [ ] Document indexing endpoint works
- [ ] Frontend search UI displays results
- [ ] Frontend chat UI shows LLM responses
- [ ] Permission filtering prevents data leakage
- [ ] Fallback to OpenRouter when Ollama down
- [ ] Response times acceptable (<5s typical)

---

## Common Issues & Debugging

### Issue: "Model not found" error

```bash
# Check if model is downloaded
ollama list

# Download if missing
ollama pull mistral
```

### Issue: Slow responses (>30s)

```bash
# Check CPU usage
top

# Switch to faster model
ollama pull orca-mini
# Update: OLLAMA_MODEL=orca-mini in .env
```

### Issue: Out of memory errors

```bash
# Reduce batch size
# Use smaller model
ollama pull orca-mini

# Or increase system swap
sudo fallocate -l 4G /swapfile
```

### Issue: "Relation document_chunks does not exist"

```bash
# Run pgvector migration in Supabase SQL editor
# Copy database/migrations/003_enable_pgvector.sql
# Paste and execute
```

### Issue: Frontend shows "keyword search" instead of "semantic"

```bash
# Ensure owner_id is passed to backend
# Check browser DevTools Network tab
# Verify POST body includes: "owner_id": "xxx"
```

---

## Performance Tuning

### For Development

```bash
# Fast local testing
OLLAMA_MODEL=orca-mini  # 1.3 GB, very fast
EMBEDDING_MODEL=all-MiniLM-L6-v2  # Default, already fast
```

### For Production

```bash
# High quality but slower
OLLAMA_MODEL=mistral  # Balanced (recommended)

# Or higher quality
OLLAMA_MODEL=neural-chat
```

### With GPU

```bash
# Enable GPU in Ollama
# macOS: Automatic on Apple Silicon
# Linux: Install CUDA, restart Ollama
# Windows: Future WSL2 support

# Verify GPU usage
ollama list  # Check logs for GPU device
```

---

## Next Steps After Passing Tests

1. ✅ All 12 tests passing
2. 📝 Document any custom configurations
3. 🚀 Deploy to production (see OLLAMA_SETUP.md)
4. 📊 Monitor performance and costs (now zero API costs!)
5. 🔄 Update documents with real-world URLs

---

## Support

If tests fail:

1. Check [Troubleshooting](#troubleshooting) section
2. Review logs:
   - Backend: `tail -f backend.log`
   - Ollama: `tail -f ~/.ollama/log`
3. Try health check again
4. Restart services and retry
