"""
Document Extraction Service for SmartCloud AI Assistant

Extracts text content from various document formats:
- PDF (via pdfplumber)
- DOCX (via python-docx)
- TXT (plain text)
- CSV (tabular data)
- XLSX (Excel spreadsheets)
- PPTX (PowerPoint presentations)

Handles errors gracefully and provides metadata about extraction.
Extracted content is cleaned and prepared for embedding/chunking.
"""

from __future__ import annotations

import io
from typing import Optional, Any
from dataclasses import dataclass


@dataclass
class ExtractionResult:
    """Result of document extraction."""
    success: bool
    content: str  # Extracted text
    word_count: int
    page_count: Optional[int] = None  # For PDFs
    error: Optional[str] = None
    metadata: dict[str, Any] = None


class DocumentExtractionService:
    """
    Extracts text from various document formats.
    
    Supports:
    - PDF files
    - DOCX (Word documents)
    - TXT (plain text)
    - CSV (comma-separated values)
    - XLSX (Excel spreadsheets)
    - PPTX (PowerPoint presentations)
    """

    # Supported MIME types and file extensions
    SUPPORTED_TYPES = {
        "application/pdf": ["pdf"],
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["pptx"],
        "text/plain": ["txt"],
        "text/csv": ["csv"],
        "application/vnd.ms-excel": ["xls"],
        "application/msword": ["doc"],
    }

    @staticmethod
    def is_supported(mime_type: Optional[str], file_extension: Optional[str] = None) -> bool:
        """Check if file type is supported for extraction."""
        if mime_type and mime_type in DocumentExtractionService.SUPPORTED_TYPES:
            return True
        
        if file_extension:
            ext_lower = file_extension.lower().lstrip(".")
            for supported_exts in DocumentExtractionService.SUPPORTED_TYPES.values():
                if ext_lower in supported_exts:
                    return True
        
        return False

    @staticmethod
    def extract(
        file_bytes: bytes,
        mime_type: Optional[str] = None,
        file_name: Optional[str] = None,
    ) -> ExtractionResult:
        """
        Extract text from a document file.
        
        Args:
            file_bytes: File content as bytes
            mime_type: MIME type (e.g., "application/pdf")
            file_name: Original filename (used if mime_type unavailable)
        
        Returns:
            ExtractionResult with success status, content, and metadata
        """
        if not file_bytes:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error="File is empty",
            )

        # Determine file type
        file_type = DocumentExtractionService._determine_file_type(mime_type, file_name)
        
        if not file_type:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error=f"Unsupported file type: {mime_type or file_name}",
            )

        # Extract based on type
        try:
            if file_type == "pdf":
                return DocumentExtractionService._extract_pdf(file_bytes)
            elif file_type == "docx":
                return DocumentExtractionService._extract_docx(file_bytes)
            elif file_type == "txt":
                return DocumentExtractionService._extract_txt(file_bytes)
            elif file_type == "csv":
                return DocumentExtractionService._extract_csv(file_bytes)
            elif file_type == "xlsx":
                return DocumentExtractionService._extract_xlsx(file_bytes)
            elif file_type == "pptx":
                return DocumentExtractionService._extract_pptx(file_bytes)
            else:
                return ExtractionResult(
                    success=False,
                    content="",
                    word_count=0,
                    error=f"Extraction not implemented for {file_type}",
                )
        
        except Exception as e:
            print(f"[DocumentExtraction] Extraction failed: {e}")
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error=f"Extraction error: {str(e)}",
            )

    @staticmethod
    def _determine_file_type(mime_type: Optional[str], file_name: Optional[str]) -> Optional[str]:
        """Determine file type from MIME type or filename."""
        if mime_type:
            mime_lower = mime_type.lower()
            if "pdf" in mime_lower:
                return "pdf"
            elif "word" in mime_lower or "document" in mime_lower:
                return "docx"
            elif "sheet" in mime_lower or "excel" in mime_lower:
                return "xlsx"
            elif "presentation" in mime_lower:
                return "pptx"
            elif "plain" in mime_lower or "text" in mime_lower:
                return "txt"
            elif "csv" in mime_lower:
                return "csv"

        if file_name:
            name_lower = file_name.lower()
            if name_lower.endswith(".pdf"):
                return "pdf"
            elif name_lower.endswith(".docx"):
                return "docx"
            elif name_lower.endswith(".doc"):
                return "docx"
            elif name_lower.endswith(".xlsx"):
                return "xlsx"
            elif name_lower.endswith(".xls"):
                return "xlsx"
            elif name_lower.endswith(".pptx"):
                return "pptx"
            elif name_lower.endswith(".ppt"):
                return "pptx"
            elif name_lower.endswith(".txt"):
                return "txt"
            elif name_lower.endswith(".csv"):
                return "csv"

        return None

    @staticmethod
    def _extract_pdf(file_bytes: bytes) -> ExtractionResult:
        """Extract text from PDF."""
        try:
            import pdfplumber
        except ImportError:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error="pdfplumber not installed",
            )

        try:
            pdf_file = io.BytesIO(file_bytes)
            text_parts = []
            page_count = 0

            with pdfplumber.open(pdf_file) as pdf:
                page_count = len(pdf.pages)
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)

            content = "\n\n".join(text_parts)
            content = DocumentExtractionService._clean_text(content)

            return ExtractionResult(
                success=True,
                content=content,
                word_count=len(content.split()),
                page_count=page_count,
                metadata={"page_count": page_count},
            )

        except Exception as e:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error=f"PDF extraction failed: {str(e)}",
            )

    @staticmethod
    def _extract_docx(file_bytes: bytes) -> ExtractionResult:
        """Extract text from DOCX (Word document)."""
        try:
            from docx import Document
        except ImportError:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error="python-docx not installed",
            )

        try:
            doc_file = io.BytesIO(file_bytes)
            doc = Document(doc_file)

            text_parts = []

            # Extract paragraphs
            for para in doc.paragraphs:
                if para.text.strip():
                    text_parts.append(para.text)

            # Extract tables
            for table in doc.tables:
                table_text = []
                for row in table.rows:
                    row_text = []
                    for cell in row.cells:
                        row_text.append(cell.text.strip())
                    table_text.append(" | ".join(row_text))
                if table_text:
                    text_parts.append("\n".join(table_text))

            content = "\n\n".join(text_parts)
            content = DocumentExtractionService._clean_text(content)

            return ExtractionResult(
                success=True,
                content=content,
                word_count=len(content.split()),
                metadata={"has_tables": len(doc.tables) > 0},
            )

        except Exception as e:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error=f"DOCX extraction failed: {str(e)}",
            )

    @staticmethod
    def _extract_txt(file_bytes: bytes) -> ExtractionResult:
        """Extract text from plain text file."""
        try:
            # Try UTF-8 first, then fallback
            try:
                content = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                content = file_bytes.decode("latin-1")

            content = DocumentExtractionService._clean_text(content)

            return ExtractionResult(
                success=True,
                content=content,
                word_count=len(content.split()),
            )

        except Exception as e:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error=f"TXT extraction failed: {str(e)}",
            )

    @staticmethod
    def _extract_csv(file_bytes: bytes) -> ExtractionResult:
        """Extract text from CSV file."""
        try:
            import csv
        except ImportError:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error="csv module not available",
            )

        try:
            # Decode CSV
            try:
                content_str = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                content_str = file_bytes.decode("latin-1")

            # Parse CSV
            csv_file = io.StringIO(content_str)
            reader = csv.reader(csv_file)

            text_parts = []
            for row in reader:
                if row:
                    text_parts.append(" | ".join(str(cell).strip() for cell in row))

            content = "\n".join(text_parts)
            content = DocumentExtractionService._clean_text(content)

            return ExtractionResult(
                success=True,
                content=content,
                word_count=len(content.split()),
                metadata={"row_count": len(text_parts)},
            )

        except Exception as e:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error=f"CSV extraction failed: {str(e)}",
            )

    @staticmethod
    def _extract_xlsx(file_bytes: bytes) -> ExtractionResult:
        """Extract text from XLSX (Excel spreadsheet)."""
        try:
            from openpyxl import load_workbook
        except ImportError:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error="openpyxl not installed",
            )

        try:
            excel_file = io.BytesIO(file_bytes)
            workbook = load_workbook(excel_file)

            text_parts = []
            sheet_count = 0

            for sheet in workbook.sheetnames:
                sheet_count += 1
                text_parts.append(f"=== Sheet: {sheet} ===")

                ws = workbook[sheet]
                for row in ws.iter_rows(values_only=True):
                    row_text = []
                    for cell in row:
                        if cell is not None:
                            row_text.append(str(cell).strip())
                    if row_text:
                        text_parts.append(" | ".join(row_text))

            content = "\n".join(text_parts)
            content = DocumentExtractionService._clean_text(content)

            return ExtractionResult(
                success=True,
                content=content,
                word_count=len(content.split()),
                metadata={"sheet_count": sheet_count},
            )

        except Exception as e:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error=f"XLSX extraction failed: {str(e)}",
            )

    @staticmethod
    def _extract_pptx(file_bytes: bytes) -> ExtractionResult:
        """Extract text from PPTX (PowerPoint presentation)."""
        try:
            from pptx import Presentation
        except ImportError:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error="python-pptx not installed",
            )

        try:
            pptx_file = io.BytesIO(file_bytes)
            presentation = Presentation(pptx_file)

            text_parts = []
            slide_count = 0

            for slide_num, slide in enumerate(presentation.slides, 1):
                slide_count += 1
                text_parts.append(f"=== Slide {slide_num} ===")

                # Extract text from shapes
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        text_parts.append(shape.text)

                    # Handle tables in slides
                    if shape.has_table:
                        table = shape.table
                        for row in table.rows:
                            row_text = []
                            for cell in row.cells:
                                row_text.append(cell.text.strip())
                            if row_text:
                                text_parts.append(" | ".join(row_text))

            content = "\n".join(text_parts)
            content = DocumentExtractionService._clean_text(content)

            return ExtractionResult(
                success=True,
                content=content,
                word_count=len(content.split()),
                page_count=slide_count,
                metadata={"slide_count": slide_count},
            )

        except Exception as e:
            return ExtractionResult(
                success=False,
                content="",
                word_count=0,
                error=f"PPTX extraction failed: {str(e)}",
            )

    @staticmethod
    def _clean_text(text: str) -> str:
        """
        Clean extracted text.
        
        - Remove extra whitespace
        - Remove control characters
        - Normalize line breaks
        """
        # Remove control characters except newlines and tabs
        text = "".join(char for char in text if ord(char) >= 32 or char in "\n\t\r")

        # Normalize line breaks
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        # Remove extra spaces
        lines = [line.strip() for line in text.split("\n")]

        # Remove empty lines but keep some spacing
        text = "\n".join(lines)

        # Remove multiple consecutive newlines
        while "\n\n\n" in text:
            text = text.replace("\n\n\n", "\n\n")

        return text.strip()
