# SmartCloud Ollama Setup Guide

This guide walks you through installing and configuring Ollama for local AI inference on your machine.

## Table of Contents

1. [Installation](#installation)
2. [Download a Model](#download-a-model)
3. [Start Ollama](#start-ollama)
4. [Configure SmartCloud Backend](#configure-smartcloud-backend)
5. [Verify Setup](#verify-setup)
6. [Troubleshooting](#troubleshooting)
7. [Production Deployment](#production-deployment)

---

## Installation

### macOS

**Option 1: Homebrew (Recommended)**

```bash
brew install ollama
```

**Option 2: Direct Download**

1. Visit [ollama.ai](https://ollama.ai)
2. Download the macOS app
3. Run the installer and follow the prompts

### Linux

**Ubuntu/Debian:**

```bash
curl https://ollama.ai/install.sh | sh
```

**Other Distributions:**

Visit [ollama.ai/download](https://ollama.ai/download) for your specific distro.

### Windows

**Option 1: WSL2 (Recommended)**

Windows requires WSL2 (Windows Subsystem for Linux 2) to run Ollama.

```bash
# Install WSL2 if not already installed
wsl --install -d Ubuntu

# Inside WSL2 terminal:
curl https://ollama.ai/install.sh | sh
```

**Option 2: Docker**

```bash
docker run -it -p 11434:11434 ollama/ollama
```

---

## Download a Model

Ollama provides several models optimized for different use cases. Download one before starting the server.

### Recommended Models

| Model | Size | Speed | Quality | Command |
|-------|------|-------|---------|---------|
| **Mistral** | 4.1 GB | ⚡ Fast | 🌟 Excellent | `ollama pull mistral` |
| Llama 2 | 3.8 GB | 🟡 Medium | 🌟 Good | `ollama pull llama2` |
| Neural Chat | 4.1 GB | ⚡ Fast | 🌟 Very Good | `ollama pull neural-chat` |
| Orca Mini | 1.3 GB | ⚡⚡ Very Fast | 🟡 Fair | `ollama pull orca-mini` |
| Dolphin Mixtral | 26 GB | 🐢 Slow | 🌟🌟 Excellent | `ollama pull dolphin-mixtral` |

**SmartCloud Default:** Mistral (4.1 GB)

### Download a Model

```bash
# Download Mistral (recommended for SmartCloud)
ollama pull mistral

# Or download Llama 2
ollama pull llama2

# Or download another model
ollama pull neural-chat
```

The first download may take a few minutes depending on your internet speed.

**Verify download:**

```bash
ollama list
```

You should see output like:

```
NAME             	ID          	SIZE  	MODIFIED
mistral:latest   	2ae745f8ef6c	4.1 GB	X minutes ago
```

---

## Start Ollama

### macOS

**If installed via Homebrew:**

```bash
# Start in foreground (for testing)
ollama serve

# Or run as background service
brew services start ollama
```

**If installed as app:**

Simply open the Ollama app from Applications. It runs as a menu bar app.

### Linux

```bash
# Start the Ollama service
sudo systemctl start ollama

# Enable to start on boot
sudo systemctl enable ollama

# View logs
sudo journalctl -u ollama -f
```

### Windows (WSL2)

```bash
# Inside WSL2 terminal
ollama serve
```

### Docker

```bash
docker run -d -p 11434:11434 --name ollama ollama/ollama
docker exec ollama ollama pull mistral
```

### Verify Ollama is Running

```bash
curl http://localhost:11434/api/tags
```

Should return JSON with available models:

```json
{
  "models": [
    {
      "name": "mistral:latest",
      "modified_at": "2024-01-15T10:30:00Z",
      "size": 4398046511,
      "digest": "2ae745f8ef6c..."
    }
  ]
}
```

---

## Configure SmartCloud Backend

### Step 1: Update `.env` file

Open `backend/.env` and ensure:

```bash
# Use local Ollama (default)
USE_LOCAL_LLM=true

# Ollama server location (default)
OLLAMA_BASE_URL=http://localhost:11434

# Model name (must match downloaded model)
OLLAMA_MODEL=mistral

# Embedding model (default - downloads automatically)
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Keep OpenRouter key as fallback (optional)
LLM_API_KEY=sk-or-v1-... (keep existing or remove)
```

### Step 2: Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

This installs:
- `sentence-transformers` (for embeddings)
- `ollama` (Ollama Python client)
- `pdfplumber` (PDF parsing)
- `python-docx` (Word document parsing)

### Step 3: Apply Database Migration

Enable pgvector in your Supabase database:

```bash
# Copy the migration SQL
cat database/migrations/003_enable_pgvector.sql

# Paste into Supabase SQL editor (https://app.supabase.com)
# Run the query
```

This:
1. Enables the pgvector extension
2. Creates vector search RPC function
3. Sets up indexes for fast similarity search

### Step 4: Start Backend

```bash
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:

```
[Embeddings] Loading model: all-MiniLM-L6-v2
[Embeddings] Model loaded. Dimension: 384
[Ollama] Connected to http://localhost:11434
Uvicorn running on http://0.0.0.0:8000
```

---

## Verify Setup

### 1. Check Health Endpoint

```bash
curl http://localhost:8000/ai/health
```

Expected response:

```json
{
  "status": "ok",
  "llm_type": "ollama",
  "model": "mistral",
  "ollama_available": true
}
```

### 2. Test Search Endpoint

```bash
curl -X POST http://localhost:8000/ai/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning",
    "owner_id": "your-user-id",
    "context_files": []
  }'
```

Response:

```json
{
  "results": [],
  "search_type": "semantic"
}
```

(Empty because no documents indexed yet)

### 3. Test Chat Endpoint

```bash
curl -X POST http://localhost:8000/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is machine learning?",
    "owner_id": "your-user-id",
    "context_files": []
  }'
```

Response:

```json
{
  "answer": "Machine learning is a subset of artificial intelligence...",
  "sources": [],
  "model": "mistral"
}
```

### 4. Test Frontend

1. Start frontend dev server: `npm run dev`
2. Navigate to `/ai/search`
3. Type a query: "machine learning"
4. Should show search type indicator: "Using semantic AI search"

---

## Troubleshooting

### Ollama Connection Refused

**Problem:** `connection refused http://localhost:11434`

**Solutions:**

1. **Check if Ollama is running:**
   ```bash
   ps aux | grep ollama
   ```

2. **Start Ollama:**
   ```bash
   # macOS
   brew services start ollama
   
   # Linux
   sudo systemctl start ollama
   
   # WSL2/Windows
   ollama serve
   ```

3. **Check port 11434 is open:**
   ```bash
   netstat -tlnp | grep 11434
   ```

4. **Try connecting directly:**
   ```bash
   curl http://localhost:11434/api/tags
   ```

### Model Not Found

**Problem:** `model "mistral" not found`

**Solution:**

```bash
# List installed models
ollama list

# Download model if missing
ollama pull mistral
```

### Out of Memory (OOM)

**Problem:** Ollama process crashes or hangs

**Solutions:**

1. **Use a smaller model:**
   ```bash
   ollama pull orca-mini  # 1.3 GB
   ```

2. **Update backend/.env:**
   ```bash
   OLLAMA_MODEL=orca-mini
   ```

3. **Increase system swap:**
   ```bash
   # Linux
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

4. **Run on GPU (if available):**
   - Ollama automatically uses GPU if CUDA/Metal is detected
   - Verify: Check Ollama logs for "GPU device"

### Slow Responses

**Problem:** AI queries take 30+ seconds

**Solutions:**

1. **Check system resources:**
   ```bash
   # View CPU/memory usage
   top  # Linux/macOS
   Task Manager  # Windows
   ```

2. **Use GPU if available:**
   - macOS: Metal acceleration (automatic)
   - Linux: Install CUDA for NVIDIA GPUs
   - Windows WSL2: GPU support coming soon

3. **Use faster model:**
   ```bash
   ollama pull orca-mini  # 1.3 GB, very fast
   # Update backend/.env: OLLAMA_MODEL=orca-mini
   ```

### Embeddings Slow (First Run)

**Problem:** First embedding query takes 10+ seconds

**Explanation:** Sentence-transformers model downloads on first use (~22 MB)

**Solution:** Wait for first query to complete. Subsequent queries are fast (~50ms)

### pgvector Extension Error

**Problem:** `relation "document_chunks" does not exist`

**Solution:**

1. Run migration in Supabase:
   - Visit [https://app.supabase.com](https://app.supabase.com)
   - Open SQL Editor
   - Paste `database/migrations/003_enable_pgvector.sql`
   - Execute

2. Or via CLI:
   ```bash
   supabase db push --linked
   ```

---

## Performance Optimization

### 1. Use GPU Acceleration

**NVIDIA (CUDA):**

```bash
# Check for GPU
ollama list-models

# Ollama will automatically use CUDA if available
# Verify in Ollama logs
```

**macOS (Metal):**

- Automatic on Apple Silicon (M1/M2/M3)
- Verify in Ollama menu: Settings → Check "Accelerated"

### 2. Increase Context Window

```bash
# Edit ~/.ollama/modelfile
# Add: PARAMETER num_ctx 4096

# Rebuild
ollama pull mistral
```

### 3. Parallel Requests

```bash
# Backend supports multiple concurrent requests
# Configure in backend/app/main.py:
# app.state.max_workers = 4
```

---

## Production Deployment

### Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_MODELS=/root/.ollama/models
    command: serve

  smartcloud-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - USE_LOCAL_LLM=true
      - OLLAMA_BASE_URL=http://ollama:11434
      - OLLAMA_MODEL=mistral
      - EMBEDDING_MODEL=all-MiniLM-L6-v2
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
    depends_on:
      - ollama
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000

volumes:
  ollama_data:
```

**Start:**

```bash
docker-compose up -d
docker-compose exec ollama ollama pull mistral
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ollama
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: ollama
    spec:
      containers:
      - name: ollama
        image: ollama/ollama:latest
        resources:
          requests:
            memory: "4Gi"
            nvidia.com/gpu: 1  # Requires GPU
          limits:
            memory: "8Gi"
            nvidia.com/gpu: 1
        ports:
        - containerPort: 11434
```

---

## Next Steps

1. ✅ Install Ollama
2. ✅ Download a model (Mistral recommended)
3. ✅ Configure SmartCloud backend
4. ✅ Verify setup with health check
5. 🎯 Test with real documents in SmartCloud UI

---

## Resources

- [Ollama Official Docs](https://github.com/ollama/ollama)
- [Available Models](https://ollama.ai/library)
- [Sentence-Transformers](https://www.sbert.net/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)

---

## Support

If you encounter issues:

1. Check [Troubleshooting](#troubleshooting) section
2. Review backend logs: `tail -f backend.log`
3. Check Ollama logs: `tail -f ~/.ollama/log`
4. Open an issue on GitHub with error messages and system info
