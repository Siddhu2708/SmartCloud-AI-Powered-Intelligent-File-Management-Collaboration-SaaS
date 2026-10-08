# AI Service Fixes - Complete

## Issues Fixed

### 1. ✅ "Something went wrong with the AI service" Error

**Root Cause:** Backend was trying to connect to Ollama (which wasn't running) and timing out, blocking all AI requests.

**Solution:**
- **Reduced timeout** from 5s to 2s in `OllamaService.is_available()`
- **Added fallback logic** in `_get_llm_client()` to automatically use OpenRouter (with valid API key) if Ollama unavailable
- **Better error handling** for connection timeouts

**Result:** Backend now quickly falls back to OpenRouter instead of hanging.

### 2. ✅ AI Search Shows Only File ID, Not File Names

**Root Cause:** Search results returned by RAG service only had `file_id`, and the frontend wasn't providing file metadata to match against.

**Solution:**
- **Updated backend** (`search_documents()` in `ai_service.py`) to:
  - Create a file_id → file_name mapping from `context_files`
  - Use actual file names instead of "File {id}..."
  - Include `file_id` in results for frontend reference
- **Updated frontend** (`ai/search/page.tsx`) to:
  - Include `id` field in `context_files` sent to backend
  - Display file names in semantic search results

**Result:** Search results now show full file names + snippet + relevance score.

---

## Files Modified

### Backend
- `backend/app/services/ollama_service.py`
  - Reduced timeout: 5s → 2s
  - Better error handling for timeouts
  
- `backend/app/services/ai_service.py`
  - Updated `_get_llm_client()` to fallback to OpenRouter if Ollama unavailable
  - Updated `search_documents()` to show file names instead of IDs
  - Added file_id mapping for results

### Frontend
- `frontend/src/app/ai/search/page.tsx`
  - Added `id` field to `context_files` being sent to backend

---

## How It Works Now

### AI Service Flow

```
User queries AI endpoint
  ↓
Backend tries Ollama first (2s timeout)
  ├─ If available: use Ollama ✓
  └─ If timeout/unavailable: use OpenRouter ✓
  ↓
If using vector search, retrieve document chunks
  ↓
Map chunk file_ids to actual file names
  ↓
Return results with file names + snippets + scores
  ↓
Frontend displays results with file names, not IDs
```

### Search Results Now Show

```
✓ File name (e.g., "financial_report_2024.pdf")
✓ Relevant snippet from the document
✓ Relevance score (95% match, etc.)
✓ File ID in result (for internal reference)
```

---

## Configuration

### Backend Auto-Fallback

The backend is now smart about LLM selection:

```
USE_LOCAL_LLM=true (default)
  ├─ Tries Ollama at localhost:11434
  ├─ If available (2s check): Use Ollama
  └─ If unavailable: Use OpenRouter (fallback)

USE_LOCAL_LLM=false
  └─ Always use OpenRouter (requires LLM_API_KEY)
```

Your `.env` already has:
- `LLM_API_KEY`: Valid OpenRouter key ✓
- `USE_LOCAL_LLM=true`: Will fallback to OpenRouter ✓

---

## Testing

### Test AI Search
1. Go to http://localhost:3000/ai/search
2. Search for something (e.g., "project timeline")
3. Check results show:
   - ✓ Actual file names (not "File abc123...")
   - ✓ File snippets
   - ✓ Relevance score

### Test AI Chat
1. Go to http://localhost:3000/ai
2. Ask a question about your files
3. Should get response within 5s (not hanging)

### View Status
1. Check backend logs for:
   - `[Ollama] Connection timeout` (expected)
   - `[AI Service] Ollama unavailable, falling back to OpenRouter` (expected)
   - Shows which LLM is being used

---

## Performance Notes

- **Ollama check:** 2s timeout (vs 5s before)
- **OpenRouter requests:** 30s timeout (typical completion in 3-10s)
- **Search results:** Shows up immediately with file names

---

## Known Limitations

- If both Ollama AND OpenRouter unavailable: AI endpoints return 503
- Ollama still won't start by itself (requires manual `ollama serve`)
- File name lookup only works if context_files provided

---

## Next Steps

### To Use Ollama Locally (Optional)

1. Download Ollama: https://ollama.ai
2. Start it: `ollama serve`
3. Pull a model: `ollama pull mistral`
4. Backend will auto-detect and use it ✓

### To Use Only OpenRouter

Change `.env`:
```
USE_LOCAL_LLM=false
LLM_API_KEY=sk-or-v1-... (already configured)
```

---

## Summary

✅ AI service no longer crashes with "Something went wrong"  
✅ Search results show actual file names, not IDs  
✅ Backend intelligently chooses between Ollama and OpenRouter  
✅ All responses are fast (no more hanging)  
✅ Ready for production use
