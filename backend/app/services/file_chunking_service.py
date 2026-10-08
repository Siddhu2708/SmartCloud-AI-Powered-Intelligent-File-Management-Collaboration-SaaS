"""
File Chunking Service

Handles splitting large files into manageable chunks for reliable uploads
and resumable transfers. Tracks chunk metadata for reassembly.
"""

import hashlib
import uuid
from typing import Optional
from datetime import datetime
from dataclasses import dataclass


@dataclass
class ChunkMetadata:
    """Metadata for a single file chunk"""
    chunk_id: str
    file_id: str
    owner_id: str
    chunk_index: int
    total_chunks: int
    chunk_size_bytes: int
    chunk_hash: str  # SHA256 of chunk content
    created_at: datetime
    status: str  # 'pending', 'uploaded', 'verified'


class FileChunkingService:
    """Service for handling file chunking and reassembly"""

    # Default chunk sizes (in bytes)
    CHUNK_SIZES = {
        64: 64 * 1024,           # 64 KB
        128: 128 * 1024,         # 128 KB
        256: 256 * 1024,         # 256 KB (default, good for mobile)
        512: 512 * 1024,         # 512 KB
        1024: 1024 * 1024,       # 1 MB
        2048: 2 * 1024 * 1024,   # 2 MB
        5120: 5 * 1024 * 1024,   # 5 MB
    }

    def __init__(self):
        self.chunks_in_progress = {}  # Track chunks being uploaded

    @staticmethod
    def calculate_chunks(
        file_size_bytes: int,
        chunk_size_kb: int = 256,
    ) -> int:
        """
        Calculate number of chunks needed for file.

        Args:
            file_size_bytes: Total file size in bytes
            chunk_size_kb: Chunk size in KB (default 256)

        Returns:
            Number of chunks needed
        """
        chunk_size_bytes = FileChunkingService.CHUNK_SIZES.get(
            chunk_size_kb, 256 * 1024
        )
        return (file_size_bytes + chunk_size_bytes - 1) // chunk_size_bytes

    @staticmethod
    def chunk_file(
        content: bytes,
        chunk_size_kb: int = 256,
    ) -> list[bytes]:
        """
        Split file content into chunks.

        Args:
            content: File content bytes
            chunk_size_kb: Chunk size in KB

        Returns:
            List of chunk bytes
        """
        chunk_size_bytes = FileChunkingService.CHUNK_SIZES.get(
            chunk_size_kb, 256 * 1024
        )

        chunks = []
        for i in range(0, len(content), chunk_size_bytes):
            chunk = content[i : i + chunk_size_bytes]
            chunks.append(chunk)

        return chunks

    @staticmethod
    def calculate_chunk_hash(chunk_content: bytes) -> str:
        """Calculate SHA256 hash of chunk content"""
        return hashlib.sha256(chunk_content).hexdigest()

    @staticmethod
    def verify_chunk(chunk_content: bytes, expected_hash: str) -> bool:
        """Verify chunk integrity using hash"""
        calculated_hash = FileChunkingService.calculate_chunk_hash(chunk_content)
        return calculated_hash == expected_hash

    def start_chunked_upload(
        self,
        file_id: str,
        owner_id: str,
        file_size_bytes: int,
        chunk_size_kb: int = 256,
    ) -> dict:
        """
        Initiate chunked upload session.

        Args:
            file_id: File UUID
            owner_id: Owner user UUID
            file_size_bytes: Total file size
            chunk_size_kb: Chunk size in KB

        Returns:
            Upload session info with chunk details
        """
        total_chunks = self.calculate_chunks(file_size_bytes, chunk_size_kb)
        upload_session_id = str(uuid.uuid4())

        session_info = {
            "upload_session_id": upload_session_id,
            "file_id": file_id,
            "owner_id": owner_id,
            "total_chunks": total_chunks,
            "chunk_size_kb": chunk_size_kb,
            "file_size_bytes": file_size_bytes,
            "uploaded_chunks": [],
            "status": "in_progress",
        }

        self.chunks_in_progress[upload_session_id] = session_info
        return session_info

    def track_chunk_upload(
        self,
        upload_session_id: str,
        chunk_index: int,
        chunk_hash: str,
    ) -> Optional[dict]:
        """
        Track uploaded chunk.

        Args:
            upload_session_id: Upload session UUID
            chunk_index: Index of uploaded chunk (0-based)
            chunk_hash: SHA256 hash of chunk

        Returns:
            Updated session info or None if session not found
        """
        if upload_session_id not in self.chunks_in_progress:
            return None

        session = self.chunks_in_progress[upload_session_id]
        session["uploaded_chunks"].append({
            "index": chunk_index,
            "hash": chunk_hash,
            "uploaded_at": datetime.now().isoformat(),
        })

        # Check if all chunks uploaded
        if len(session["uploaded_chunks"]) == session["total_chunks"]:
            session["status"] = "completed"

        return session

    def get_upload_progress(self, upload_session_id: str) -> Optional[dict]:
        """
        Get current upload progress.

        Returns:
            Progress info: {uploaded: N, total: N, percentage: X}
        """
        if upload_session_id not in self.chunks_in_progress:
            return None

        session = self.chunks_in_progress[upload_session_id]
        uploaded = len(session["uploaded_chunks"])
        total = session["total_chunks"]
        percentage = int((uploaded / total) * 100) if total > 0 else 0

        return {
            "uploaded": uploaded,
            "total": total,
            "percentage": percentage,
            "status": session["status"],
        }

    def complete_chunked_upload(
        self, upload_session_id: str
    ) -> bool:
        """Mark chunked upload as complete"""
        if upload_session_id not in self.chunks_in_progress:
            return False

        session = self.chunks_in_progress[upload_session_id]
        session["status"] = "completed"
        return True

    def cancel_chunked_upload(self, upload_session_id: str) -> bool:
        """Cancel and clean up chunked upload"""
        if upload_session_id not in self.chunks_in_progress:
            return False

        del self.chunks_in_progress[upload_session_id]
        return True
