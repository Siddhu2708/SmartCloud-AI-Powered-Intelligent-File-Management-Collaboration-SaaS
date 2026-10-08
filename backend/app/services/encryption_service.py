"""
Encryption Service

Handles AES-256 encryption and decryption of files.
Uses Fernet (symmetric encryption) for simplicity, can be replaced with stronger schemes.
"""

import os
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from base64 import urlsafe_b64encode
import secrets


class EncryptionService:
    """Service for file encryption and decryption"""

    @staticmethod
    def generate_key() -> bytes:
        """Generate a new encryption key"""
        return Fernet.generate_key()

    @staticmethod
    def derive_key_from_password(password: str, salt: bytes = None) -> tuple[bytes, bytes]:
        """
        Derive encryption key from password using PBKDF2.

        Args:
            password: User password
            salt: Random salt (generates new if not provided)

        Returns:
            Tuple of (key, salt)
        """
        if salt is None:
            salt = secrets.token_bytes(16)

        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )

        key = urlsafe_b64encode(kdf.derive(password.encode()))
        return key, salt

    @staticmethod
    def encrypt_content(content: bytes, key: bytes = None) -> tuple[bytes, bytes]:
        """
        Encrypt file content.

        Args:
            content: File content to encrypt
            key: Encryption key (generates new if not provided)

        Returns:
            Tuple of (encrypted_content, key)
        """
        if key is None:
            key = EncryptionService.generate_key()

        fernet = Fernet(key)
        encrypted_content = fernet.encrypt(content)

        return encrypted_content, key

    @staticmethod
    def decrypt_content(encrypted_content: bytes, key: bytes) -> bytes:
        """
        Decrypt file content.

        Args:
            encrypted_content: Encrypted file content
            key: Decryption key

        Returns:
            Decrypted content
        """
        try:
            fernet = Fernet(key)
            decrypted_content = fernet.decrypt(encrypted_content)
            return decrypted_content
        except Exception as e:
            raise ValueError(f"Decryption failed: {str(e)}")

    @staticmethod
    def encrypt_chunk(chunk: bytes, key: bytes) -> bytes:
        """Encrypt a single file chunk"""
        fernet = Fernet(key)
        return fernet.encrypt(chunk)

    @staticmethod
    def decrypt_chunk(encrypted_chunk: bytes, key: bytes) -> bytes:
        """Decrypt a single file chunk"""
        try:
            fernet = Fernet(key)
            return fernet.decrypt(encrypted_chunk)
        except Exception as e:
            raise ValueError(f"Chunk decryption failed: {str(e)}")

    @staticmethod
    def get_key_for_file(
        user_id: str,
        file_id: str,
        master_key: str = None,
    ) -> bytes:
        """
        Generate deterministic key for file based on user + file ID.

        Args:
            user_id: User UUID
            file_id: File UUID
            master_key: Master encryption key (from env)

        Returns:
            Derived key for this file
        """
        if master_key is None:
            master_key = os.getenv("ENCRYPTION_MASTER_KEY", "default-master-key")

        # Combine user_id + file_id + master_key
        key_material = f"{user_id}:{file_id}:{master_key}"

        # Derive deterministic key
        key, _ = EncryptionService.derive_key_from_password(key_material)
        return key
