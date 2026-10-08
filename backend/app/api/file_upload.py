"""
File Upload API Endpoints

Handles:
- Chunked file uploads with configurable chunk sizes
- Optional encryption for uploaded files
- Progress tracking
- Resumable uploads
"""

from fastapi import APIRouter, HTTPException, Depends, status, UploadFile, File, Query
from pydantic import BaseModel
from typing import Optional
from app.services.auth_service import get_auth_service
from app.services.file_chunking_service import FileChunkingService
from app.services.encryption_service import EncryptionService


router = APIRouter(prefix="/upload", tags=["uploads"])

# ────────────────────────────────────────────────────────────────────────
# Request/Response Models
# ────────────────────────────────────────────────────────────────────────


class ChunkedUploadInitRequest(BaseModel):
    """Initiate chunked upload"""
    file_id: str
    file_name: str
    file_size_bytes: int
    chunk_size_kb: int = 256
    encrypt: bool = False


class ChunkedUploadInitResponse(BaseModel):
    """Response with upload session info"""
    upload_session_id: str
    file_id: str
    total_chunks: int
    chunk_size_kb: int
    file_size_bytes: int
    status: str


class ChunkUploadRequest(BaseModel):
    """Upload single chunk"""
    upload_session_id: str
    chunk_index: int


class UploadProgressResponse(BaseModel):
    """Upload progress"""
    upload_session_id: str
    uploaded: int
    total: int
    percentage: int
    status: str


# ────────────────────────────────────────────────────────────────────────
# Service Instances
# ────────────────────────────────────────────────────────────────────────

chunking_service = FileChunkingService()


# ────────────────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────────────────


@router.post("/init-chunked", response_model=ChunkedUploadInitResponse)
async def init_chunked_upload(
    payload: ChunkedUploadInitRequest,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Initiate chunked file upload.

    Args:
        payload: Upload initialization request
        user_id: Authenticated user ID

    Returns:
        Upload session with chunk info
    """
    try:
        # Start chunked upload session
        session_info = chunking_service.start_chunked_upload(
            file_id=payload.file_id,
            owner_id=user_id,
            file_size_bytes=payload.file_size_bytes,
            chunk_size_kb=payload.chunk_size_kb,
        )

        # Store encryption flag in session if needed
        if payload.encrypt:
            session_info["encryption_enabled"] = True
            session_info["encryption_key"] = EncryptionService.get_key_for_file(
                user_id, payload.file_id
            ).decode('utf-8')

        return ChunkedUploadInitResponse(
            upload_session_id=session_info["upload_session_id"],
            file_id=session_info["file_id"],
            total_chunks=session_info["total_chunks"],
            chunk_size_kb=session_info["chunk_size_kb"],
            file_size_bytes=session_info["file_size_bytes"],
            status=session_info["status"],
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/chunk")
async def upload_chunk(
    upload_session_id: str = Query(...),
    chunk_index: int = Query(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Upload single file chunk.

    Args:
        upload_session_id: Upload session UUID
        chunk_index: Index of this chunk (0-based)
        file: Chunk file data
        user_id: Authenticated user ID

    Returns:
        Chunk upload confirmation
    """
    try:
        content = await file.read()

        # Calculate hash
        chunk_hash = FileChunkingService.calculate_chunk_hash(content)

        # Track chunk
        session = chunking_service.track_chunk_upload(
            upload_session_id=upload_session_id,
            chunk_index=chunk_index,
            chunk_hash=chunk_hash,
        )

        if session is None:
            raise HTTPException(status_code=404, detail="Upload session not found")

        # Store chunk (in production, save to Supabase Storage)
        # For now, just confirm received

        return {
            "upload_session_id": upload_session_id,
            "chunk_index": chunk_index,
            "chunk_hash": chunk_hash,
            "status": "uploaded",
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/progress/{upload_session_id}", response_model=UploadProgressResponse)
async def get_upload_progress(
    upload_session_id: str,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Get current upload progress.

    Args:
        upload_session_id: Upload session UUID
        user_id: Authenticated user ID

    Returns:
        Upload progress info
    """
    progress = chunking_service.get_upload_progress(upload_session_id)

    if progress is None:
        raise HTTPException(status_code=404, detail="Upload session not found")

    return UploadProgressResponse(
        upload_session_id=upload_session_id,
        uploaded=progress["uploaded"],
        total=progress["total"],
        percentage=progress["percentage"],
        status=progress["status"],
    )


@router.post("/complete/{upload_session_id}")
async def complete_chunked_upload(
    upload_session_id: str,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Mark chunked upload as complete.

    Args:
        upload_session_id: Upload session UUID
        user_id: Authenticated user ID

    Returns:
        Completion confirmation
    """
    success = chunking_service.complete_chunked_upload(upload_session_id)

    if not success:
        raise HTTPException(status_code=404, detail="Upload session not found")

    return {"message": "Upload completed", "upload_session_id": upload_session_id}


@router.post("/cancel/{upload_session_id}")
async def cancel_chunked_upload(
    upload_session_id: str,
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Cancel and clean up chunked upload.

    Args:
        upload_session_id: Upload session UUID
        user_id: Authenticated user ID

    Returns:
        Cancellation confirmation
    """
    success = chunking_service.cancel_chunked_upload(upload_session_id)

    if not success:
        raise HTTPException(status_code=404, detail="Upload session not found")

    return {"message": "Upload cancelled", "upload_session_id": upload_session_id}


# ────────────────────────────────────────────────────────────────────────
# Encryption Endpoints
# ────────────────────────────────────────────────────────────────────────


@router.post("/encrypt")
async def encrypt_file(
    file: UploadFile = File(...),
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Encrypt a file.

    Args:
        file: File to encrypt
        user_id: Authenticated user ID

    Returns:
        Encrypted content
    """
    try:
        content = await file.read()

        # Encrypt content
        encrypted_content, key = EncryptionService.encrypt_content(content)

        return {
            "file_name": file.filename,
            "encrypted": True,
            "key": key.decode('utf-8'),
            "size_bytes": len(encrypted_content),
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/decrypt")
async def decrypt_file(
    file: UploadFile = File(...),
    key: str = Query(...),
    user_id: str = Depends(get_auth_service().get_current_user_id),
):
    """
    Decrypt a file.

    Args:
        file: Encrypted file
        key: Decryption key
        user_id: Authenticated user ID

    Returns:
        Decrypted content
    """
    try:
        encrypted_content = await file.read()
        key_bytes = key.encode('utf-8')

        # Decrypt content
        decrypted_content = EncryptionService.decrypt_content(encrypted_content, key_bytes)

        return {
            "file_name": file.filename,
            "decrypted": True,
            "size_bytes": len(decrypted_content),
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
