"""
File Access Service for SmartCloud AI Assistant

Provides secure, authenticated access to user's files and folders.
All operations are scoped to the authenticated user - never grants
access to another user's data.

Security principles:
1. Always validate authenticated_user_id matches requested owner_id
2. Never perform unrestricted global searches
3. All database queries filtered by user ownership
4. Storage access restricted to user's path: documents/<user_id>/*
5. RLS policies enforced at database layer as defense-in-depth
"""

from __future__ import annotations

from typing import Optional, Any
from uuid import UUID
from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_KEY


class FileAccessService:
    """
    Secure access to authenticated user's files and folders.
    
    Every method validates that operations belong to the current authenticated user.
    """

    def __init__(self, authenticated_user_id: str, supabase_client: Optional[Client] = None):
        """
        Initialize FileAccessService with authenticated user context.
        
        Args:
            authenticated_user_id: UUID of the authenticated user (from JWT token)
            supabase_client: Optional Supabase client instance (created if None)
        
        Raises:
            ValueError: If authenticated_user_id is empty or invalid
        """
        if not authenticated_user_id or not str(authenticated_user_id).strip():
            raise ValueError("authenticated_user_id cannot be empty")
        
        self.authenticated_user_id = str(authenticated_user_id)
        self._client = supabase_client

    def _get_client(self) -> Client:
        """Get or initialize Supabase client."""
        if self._client is None:
            self._client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return self._client

    # ────────────────────────────────────────────────────────────────────────
    # FILE OPERATIONS
    # ────────────────────────────────────────────────────────────────────────

    def list_user_files(
        self,
        folder_id: Optional[str] = None,
        include_trashed: bool = False,
    ) -> list[dict[str, Any]]:
        """
        List all files in user's account or a specific folder.
        
        Args:
            folder_id: If provided, list files only in this folder
                      (must belong to authenticated user)
            include_trashed: If False, exclude files in trash
        
        Returns:
            List of file records:
            - id, owner_id, folder_id, name, file_type, mime_type,
              file_size, is_starred, is_trashed, created_at, updated_at
        
        Raises:
            ValueError: If folder_id doesn't belong to authenticated user
        """
        client = self._get_client()

        try:
            # Validate folder ownership if folder_id provided
            if folder_id:
                folder = self.get_folder(folder_id)
                if not folder:
                    raise ValueError(f"Folder {folder_id} not found or not owned by user")

            # Build query
            query = (
                client.table("files")
                .select("*")
                .eq("owner_id", self.authenticated_user_id)
            )

            if folder_id:
                query = query.eq("folder_id", folder_id)
            else:
                # Root files (folder_id is null)
                query = query.is_("folder_id", "null")

            if not include_trashed:
                query = query.eq("is_trashed", False)

            result = query.order("created_at", desc=True).execute()
            
            files = result.data if result.data else []
            print(f"[FileAccess] Listed {len(files)} files for user {self.authenticated_user_id[:8]}...")
            return files

        except ValueError:
            raise
        except Exception as e:
            print(f"[FileAccess] Failed to list files: {e}")
            return []

    def get_file(self, file_id: str) -> Optional[dict[str, Any]]:
        """
        Get a single file by ID.
        
        Args:
            file_id: File UUID
        
        Returns:
            File record if owned by authenticated user, None otherwise
        """
        client = self._get_client()

        try:
            result = (
                client.table("files")
                .select("*")
                .eq("id", file_id)
                .eq("owner_id", self.authenticated_user_id)
                .single()
                .execute()
            )
            
            if result.data:
                print(f"[FileAccess] Retrieved file {file_id[:8]}... for user {self.authenticated_user_id[:8]}...")
                return result.data
            
            print(f"[FileAccess] File {file_id[:8]}... not found or not owned by user")
            return None

        except Exception as e:
            print(f"[FileAccess] Failed to get file: {e}")
            return None

    def search_user_files(
        self,
        query: str,
        search_type: str = "name",  # "name" or "all"
    ) -> list[dict[str, Any]]:
        """
        Search user's files by name or metadata.
        
        This is NOT semantic/embedding search - it's metadata-based search.
        For semantic search, use RAGService.retrieve() instead.
        
        Args:
            query: Search query string
            search_type: "name" (filename only) or "all" (filename + type)
        
        Returns:
            List of matching files owned by authenticated user
        """
        client = self._get_client()
        query_lower = query.lower()

        try:
            result = (
                client.table("files")
                .select("*")
                .eq("owner_id", self.authenticated_user_id)
                .eq("is_trashed", False)
                .execute()
            )

            files = result.data if result.data else []

            # Client-side filtering (could be moved to SQL for scale)
            matches = []
            for f in files:
                if search_type == "name":
                    if query_lower in (f.get("name", "") or "").lower():
                        matches.append(f)
                elif search_type == "all":
                    name_match = query_lower in (f.get("name", "") or "").lower()
                    type_match = query_lower in (f.get("file_type", "") or "").lower()
                    mime_match = query_lower in (f.get("mime_type", "") or "").lower()
                    if name_match or type_match or mime_match:
                        matches.append(f)

            print(f"[FileAccess] Found {len(matches)} files matching '{query}' for user")
            return matches

        except Exception as e:
            print(f"[FileAccess] Search failed: {e}")
            return []

    # ────────────────────────────────────────────────────────────────────────
    # FOLDER OPERATIONS
    # ────────────────────────────────────────────────────────────────────────

    def list_user_folders(
        self,
        parent_id: Optional[str] = None,
        include_trashed: bool = False,
    ) -> list[dict[str, Any]]:
        """
        List all folders in user's account or within a parent folder.
        
        Args:
            parent_id: If provided, list subfolders only under this parent
                      (must belong to authenticated user)
            include_trashed: If False, exclude folders in trash
        
        Returns:
            List of folder records:
            - id, owner_id, parent_id, name, is_starred, is_trashed,
              created_at, updated_at
        
        Raises:
            ValueError: If parent_id doesn't belong to authenticated user
        """
        client = self._get_client()

        try:
            # Validate parent folder ownership if parent_id provided
            if parent_id:
                parent = self.get_folder(parent_id)
                if not parent:
                    raise ValueError(f"Parent folder {parent_id} not found or not owned by user")

            # Build query
            query = (
                client.table("folders")
                .select("*")
                .eq("owner_id", self.authenticated_user_id)
            )

            if parent_id:
                query = query.eq("parent_id", parent_id)
            else:
                # Root folders (parent_id is null)
                query = query.is_("parent_id", "null")

            if not include_trashed:
                query = query.eq("is_trashed", False)

            result = query.order("created_at", desc=True).execute()
            
            folders = result.data if result.data else []
            print(f"[FileAccess] Listed {len(folders)} folders for user {self.authenticated_user_id[:8]}...")
            return folders

        except ValueError:
            raise
        except Exception as e:
            print(f"[FileAccess] Failed to list folders: {e}")
            return []

    def get_folder(self, folder_id: str) -> Optional[dict[str, Any]]:
        """
        Get a single folder by ID.
        
        Args:
            folder_id: Folder UUID
        
        Returns:
            Folder record if owned by authenticated user, None otherwise
        """
        client = self._get_client()

        try:
            result = (
                client.table("folders")
                .select("*")
                .eq("id", folder_id)
                .eq("owner_id", self.authenticated_user_id)
                .single()
                .execute()
            )
            
            if result.data:
                print(f"[FileAccess] Retrieved folder {folder_id[:8]}... for user")
                return result.data
            
            print(f"[FileAccess] Folder {folder_id[:8]}... not found or not owned by user")
            return None

        except Exception as e:
            print(f"[FileAccess] Failed to get folder: {e}")
            return None

    def get_folder_contents(
        self,
        folder_id: str,
        include_trashed: bool = False,
    ) -> dict[str, Any]:
        """
        Get complete contents of a folder (subfolders + files).
        
        Args:
            folder_id: Folder UUID (must belong to authenticated user)
            include_trashed: If False, exclude trashed items
        
        Returns:
            Dict with:
            - folder: The folder record
            - subfolders: List of subfolders
            - files: List of files in folder
        
        Raises:
            ValueError: If folder doesn't belong to authenticated user
        """
        try:
            folder = self.get_folder(folder_id)
            if not folder:
                raise ValueError(f"Folder not found or not owned by user")

            subfolders = self.list_user_folders(parent_id=folder_id, include_trashed=include_trashed)
            files = self.list_user_files(folder_id=folder_id, include_trashed=include_trashed)

            return {
                "folder": folder,
                "subfolders": subfolders,
                "files": files,
                "total_items": len(subfolders) + len(files),
            }

        except ValueError:
            raise
        except Exception as e:
            print(f"[FileAccess] Failed to get folder contents: {e}")
            return {
                "folder": None,
                "subfolders": [],
                "files": [],
                "total_items": 0,
            }

    def get_folder_hierarchy(self, folder_id: str) -> list[dict[str, Any]]:
        """
        Get path from root to specified folder (breadcrumb trail).
        
        Example: Root → AI Projects → ML Folder → Current Folder
        
        Args:
            folder_id: Folder UUID (must belong to authenticated user)
        
        Returns:
            List of folder records from root to target (inclusive)
        
        Raises:
            ValueError: If folder doesn't belong to authenticated user
        """
        try:
            folder = self.get_folder(folder_id)
            if not folder:
                raise ValueError(f"Folder not found or not owned by user")

            path = [folder]

            # Walk up the parent chain
            current_parent_id = folder.get("parent_id")
            while current_parent_id:
                parent = self.get_folder(current_parent_id)
                if not parent:
                    break
                path.insert(0, parent)
                current_parent_id = parent.get("parent_id")

            print(f"[FileAccess] Folder hierarchy: {len(path)} levels")
            return path

        except ValueError:
            raise
        except Exception as e:
            print(f"[FileAccess] Failed to get folder hierarchy: {e}")
            return []

    def search_user_folders(self, query: str) -> list[dict[str, Any]]:
        """
        Search user's folders by name.
        
        Args:
            query: Search query string
        
        Returns:
            List of matching folders owned by authenticated user
        """
        client = self._get_client()
        query_lower = query.lower()

        try:
            result = (
                client.table("folders")
                .select("*")
                .eq("owner_id", self.authenticated_user_id)
                .eq("is_trashed", False)
                .execute()
            )

            folders = result.data if result.data else []

            # Client-side filtering
            matches = [f for f in folders if query_lower in (f.get("name", "") or "").lower()]

            print(f"[FileAccess] Found {len(matches)} folders matching '{query}'")
            return matches

        except Exception as e:
            print(f"[FileAccess] Folder search failed: {e}")
            return []

    # ────────────────────────────────────────────────────────────────────────
    # METADATA OPERATIONS
    # ────────────────────────────────────────────────────────────────────────

    def get_file_metadata(self, file_id: str) -> Optional[dict[str, Any]]:
        """
        Get file metadata (size, type, creation date, etc).
        
        Args:
            file_id: File UUID
        
        Returns:
            File metadata dict, None if not found or not owned
        """
        file_record = self.get_file(file_id)
        if not file_record:
            return None

        return {
            "id": file_record.get("id"),
            "name": file_record.get("name"),
            "file_type": file_record.get("file_type"),
            "mime_type": file_record.get("mime_type"),
            "file_size": file_record.get("file_size"),
            "is_starred": file_record.get("is_starred"),
            "created_at": file_record.get("created_at"),
            "updated_at": file_record.get("updated_at"),
            "storage_path": file_record.get("storage_path"),
        }

    def get_storage_path(self, file_id: str) -> Optional[str]:
        """
        Get storage path for a file (for downloading/reading content).
        
        Args:
            file_id: File UUID
        
        Returns:
            Storage path like "documents/<user_id>/<file_id>/<name>", or None
        """
        file_record = self.get_file(file_id)
        if not file_record:
            return None

        return file_record.get("storage_path")

    def get_user_storage_stats(self) -> dict[str, Any]:
        """
        Get storage usage statistics for authenticated user.
        
        Returns:
            Dict with:
            - total_files: Number of files
            - total_folders: Number of folders
            - total_size_bytes: Sum of all file sizes
            - file_count_by_type: Dict of file_type -> count
        """
        client = self._get_client()

        try:
            # Get all files
            files_result = (
                client.table("files")
                .select("file_type, file_size")
                .eq("owner_id", self.authenticated_user_id)
                .eq("is_trashed", False)
                .execute()
            )

            files = files_result.data if files_result.data else []

            # Get all folders
            folders_result = (
                client.table("folders")
                .select("*")
                .eq("owner_id", self.authenticated_user_id)
                .eq("is_trashed", False)
                .execute()
            )

            folders = folders_result.data if folders_result.data else []

            # Calculate stats
            total_size = sum(f.get("file_size", 0) for f in files)
            file_types = {}
            for f in files:
                ftype = f.get("file_type", "unknown")
                file_types[ftype] = file_types.get(ftype, 0) + 1

            stats = {
                "total_files": len(files),
                "total_folders": len(folders),
                "total_size_bytes": total_size,
                "file_count_by_type": file_types,
            }

            print(f"[FileAccess] Storage stats: {stats['total_files']} files, {total_size} bytes")
            return stats

        except Exception as e:
            print(f"[FileAccess] Failed to get storage stats: {e}")
            return {
                "total_files": 0,
                "total_folders": 0,
                "total_size_bytes": 0,
                "file_count_by_type": {},
            }

    # ────────────────────────────────────────────────────────────────────────
    # SECURITY HELPER
    # ────────────────────────────────────────────────────────────────────────

    def validate_ownership(self, file_id: str, file_owner_id: str) -> bool:
        """
        Validate that a file's owner matches the authenticated user.
        
        Used as a security check before allowing operations.
        
        Args:
            file_id: File UUID
            file_owner_id: Claimed owner ID from database record
        
        Returns:
            True if ownership is valid, False otherwise
        """
        # Double-check: owner must match authenticated user
        # (RLS should prevent this anyway, but defense in depth)
        return str(file_owner_id) == self.authenticated_user_id

    def get_user_id(self) -> str:
        """Get the authenticated user's ID."""
        return self.authenticated_user_id
