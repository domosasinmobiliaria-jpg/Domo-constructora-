"""Respaldo Excel (solo admin)."""
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
import io

from auth import get_current_admin
from exports.excel import build_excel

router = APIRouter(tags=["backup"])


@router.get("/backup/export-excel")
async def export_excel(admin: dict = Depends(get_current_admin)):
    data = await build_excel()
    filename = f"respaldo_domo_{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
