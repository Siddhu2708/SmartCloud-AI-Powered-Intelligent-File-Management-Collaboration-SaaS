# SmartCloud — AI-Powered SaaS Cloud Storage & Collaboration Platform

## 🚀 Project Overview

SmartCloud is a comprehensive cloud storage and collaboration platform with integrated AI capabilities. Built with modern technologies, it provides secure file storage, real-time collaboration, and intelligent AI-powered document analysis.

**Status:** Production Ready ✅

---

## 🎯 Core Features

### 📁 File Management
- Secure cloud storage with folder hierarchy
- File upload/download with chunking support
- Resumable uploads
- File search and metadata tracking
- Storage quota management

### 🔒 Security
- JWT-based authentication (Supabase)
- Row-Level Security (RLS) policies
- Encrypted file storage
- User data isolation
- Audit logging

### 🤖 AI Assistant
- RAG-grounded chat with document retrieval
- Semantic search over user documents
- Document extraction (PDF, DOCX, XLSX, PPTX, CSV, TXT)
- AI-powered assignment management
- Local LLM (Ollama) + OpenRouter fallback

### 💾 File Chunking
- Split large files into manageable pieces
- 7 configurable chunk sizes (64KB-5MB)
- Progress tracking
- SHA256 integrity verification
- Resumable transfers

### 🔐 Encryption
- AES-256 file encryption
- Per-file encryption keys
- Optional encryption toggle
- PBKDF2 key derivation
- Chunk-level encryption

### 💳 Payments
- Stripe integration
- Subscription plans (Free, Pro, Enterprise)
- Usage-based billing
- Razorpay support

### 👥 Collaboration
- File sharing with permissions
- Share expiration dates
- Viewer/Editor permissions
- Activity audit logs

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** Next.js 15 (React 19)
- **UI:** Tailwind CSS + shadcn/ui
- **State:** React hooks + Context API
- **Auth:** Supabase Auth (OAuth + JWT)
- **API Client:** Fetch API

### Backend
- **Framework:** FastAPI (Python 3.10+)
- **Database:** PostgreSQL 15+ (Supabase)
- **Auth:** Supabase JWT validation
- **Storage:** Supabase Storage
- **LLM:** Ollama (local) + OpenRouter (fallback)
- **Embeddings:** sentence-transformers (all-MiniLM-L6-v2)
- **Vector DB:** pgvector (PostgreSQL extension)

### Infrastructure
- **Hosting:** Docker-ready
- **Database:** Supabase (managed PostgreSQL)
- **Storage:** Supabase Storage (S3-compatible)
- **Email:** SendGrid or similar
- **Payments:** Stripe + Razorpay

---

## 📂 Project Structure

```
SmartCloud/
├── frontend/                    # Next.js frontend
│   ├── src/
│   │   ├── app/               # App router pages
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities & services
│   │   └── styles/            # Global styles
│   ├── package.json
│   └── next.config.ts
│
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── api/               # API route handlers
│   │   ├── services/          # Business logic services
│   │   ├── main.py            # FastAPI app
│   │   └── config.py          # Configuration
│   ├── requirements.txt
│   └── Dockerfile
│
├── database/                    # Database scripts
│   ├── schema.sql             # Base schema
│   └── migrations/            # Database migrations
│
├── docs/                        # Documentation
│   ├── SETUP.md               # Setup instructions
│   ├── API.md                 # API documentation
│   └── ARCHITECTURE.md        # Architecture overview
│
└── README.md                   # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 15+ (Supabase)
- Docker (optional)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with Supabase credentials

# Run server
python -m uvicorn app.main:app --reload
```

Backend runs at: http://localhost:8000

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with API URL

# Run dev server
npm run dev
```

Frontend runs at: http://localhost:3000

### Database Setup

1. Create Supabase project
2. Run migrations:
```bash
# In Supabase SQL Editor, paste each migration file
database/migrations/001_*.sql
database/migrations/002_*.sql
# ... etc
```

### Ollama Setup (for AI features)

```bash
# Install Ollama
ollama pull mistral
ollama serve
```

---

## 📊 Development Status

### ✅ Completed

- [x] Authentication (JWT + OAuth)
- [x] File management (CRUD + search)
- [x] Storage integration
- [x] User profiles & subscriptions
- [x] RAG AI assistant
- [x] Document extraction (6 formats)
- [x] File chunking (7 sizes)
- [x] Encryption (AES-256)
- [x] AI assignments/tasks
- [x] Stripe payments
- [x] Audit logging
- [x] RLS policies

### 🔄 In Progress

- [ ] Real-time collaboration (WebSockets)
- [ ] Advanced search filters
- [ ] File versioning
- [ ] Batch operations
- [ ] Custom LLM models per user
- [ ] API rate limiting

### 📋 Planned

- [ ] Mobile apps (iOS/Android)
- [ ] Desktop sync client
- [ ] Advanced analytics
- [ ] Custom integrations
- [ ] SAML/SSO

---

## 🔐 Security

### Authentication
- JWT tokens via Supabase
- OAuth2 (Google, GitHub)
- 2FA support

### Data Protection
- RLS policies on all user data
- AES-256 encryption available
- HTTPS only
- Audit logging

### Privacy
- User data isolation
- GDPR compliant
- Transparent data handling
- Data export/deletion

---

## 📖 Documentation

- **[SETUP.md](./docs/SETUP.md)** — Installation & deployment
- **[API.md](./docs/API.md)** — API endpoint reference
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — System design
- **[CHUNKING_ENCRYPTION_COMPLETE.md](./CHUNKING_ENCRYPTION_COMPLETE.md)** — File chunking & encryption
- **[SMARTCLOUD_AI_COMPLETE.md](./SMARTCLOUD_AI_COMPLETE.md)** — AI assistant implementation

---

## 🐛 Known Issues

None currently. Please report bugs in GitHub Issues.

---

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/name`)
2. Commit changes (`git commit -m "Add feature"`)
3. Push branch (`git push origin feature/name`)
4. Open Pull Request

---

## 📄 License

Proprietary — All rights reserved

---

## 📞 Support

- **Email:** support@smartcloud.com
- **Issues:** GitHub Issues
- **Documentation:** See `/docs` folder

---

## 🎯 Roadmap

### Q1 2025
- Real-time collaboration
- Advanced search
- File versioning

### Q2 2025
- Mobile apps
- Desktop sync
- Advanced analytics

### Q3 2025
- Custom integrations
- Enterprise features
- Advanced security

---

## 👨‍💻 Project Maintainers

- **Lead Developer:** Siddhu
- **Last Updated:** October 2, 2026

---

## 📈 Project Statistics

- **Total Commits:** (tracked in Git)
- **Lines of Code:** ~10,000+
- **Components:** 50+
- **API Endpoints:** 30+
- **Database Tables:** 12+

---

**Repository:** https://github.com/Siddhu2708/SmartCloud.git
