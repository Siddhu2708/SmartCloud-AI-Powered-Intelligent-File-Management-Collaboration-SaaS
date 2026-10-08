import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_URL
from app.api import ai, auth, files, ai_enhanced, file_upload
from app.api.payments import router as payments_router, subscription_router

app = FastAPI(
    title="SmartCloud API",
    description="Backend for AI-Powered SaaS Cloud Storage & Collaboration Platform",
    version="1.0.0",
)

# CORS Configuration - Restrict to frontend domain
# Reads FRONTEND_URL from environment (defaults to localhost:3000)
CORS_ORIGINS = [FRONTEND_URL]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth.router)
app.include_router(files.router)
app.include_router(ai.router)
app.include_router(ai_enhanced.router)
app.include_router(file_upload.router)
app.include_router(payments_router)
app.include_router(subscription_router)

@app.get("/")
def read_root():
    return {"message": "Welcome to SmartCloud API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
