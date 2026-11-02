# CV (PDF/DOCX) theke text ber kore.
from pathlib import Path

MAX_CHARS = 40_000  # onek boro file-e AI/embedding dhir na hoy


def extract_text(path: Path) -> str:
    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            text = "\n".join((page.extract_text() or "") for page in reader.pages)
        elif ext == ".docx":
            import docx
            d = docx.Document(str(path))
            parts = [p.text for p in d.paragraphs]
            for table in d.tables:
                for row in table.rows:
                    parts.append(" | ".join(cell.text for cell in row.cells))
            text = "\n".join(parts)
        else:
            raise ValueError("Unsupported file type")
    except ValueError:
        raise
    except Exception as exc:  # noqa: BLE001  (nosto/encrypted file)
        raise ValueError("Could not read this file") from exc

    text = " ".join(text.split())  # extra space/newline poriskar
    if len(text) < 30:
        # Scan kora (chhobi) PDF-e text thake na. OCR ekhon support kori na.
        raise ValueError("No readable text found in the CV")
    return text[:MAX_CHARS]
