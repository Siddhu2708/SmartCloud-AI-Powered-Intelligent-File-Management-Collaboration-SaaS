from fastapi import APIRouter

router = APIRouter(prefix="/files", tags=["files"])

@router.get("/")
def list_files():
    return {"files": []}

@router.post("/upload")
def upload_file():
    return {"message": "File upload placeholder"}

@router.get("/{file_id}")
def get_file(file_id: str):
    return {"message": f"Get file {file_id} placeholder"}
