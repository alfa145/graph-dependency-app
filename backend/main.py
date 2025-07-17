# from fastapi import FastAPI, UploadFile, File
# from fastapi.middleware.cors import CORSMiddleware
# import csv
# from io import StringIO

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# graph_data = {"nodes": [], "edges": []}

# @app.post("/upload_csv")
# async def upload_csv(file: UploadFile = File(...)):
#     content = await file.read()
#     decoded = content.decode()
#     f = StringIO(decoded)
#     reader = csv.DictReader(f)

#     nodes = {}
#     edges = []

#     for row in reader:
#         table_id = row["object"]
#         depends_on = row["depends_on"].split(";") if row["depends_on"] else []
#         nodes[table_id] = {
#             "id": table_id,
#             "label": table_id,
#             "owner": row.get("owner", ""),
#             "last_update": row.get("last_update", ""),
#             "next_execution": row.get("next_execution", ""),
#         }
#         for dep in depends_on:
#             if dep:
#                 edges.append({"source": dep.strip(), "target": table_id})

#     graph_data["nodes"] = list(nodes.values())
#     graph_data["edges"] = edges
#     return {"status": "uploaded"}

# @app.get("/graph")
# def get_graph():
#     return graph_data


from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict
import csv
from io import StringIO
import os
import psycopg2
import json

app = FastAPI()

# CORS Middleware — adjust origins for your frontend URL in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Replace "*" with your frontend URL in production e.g. ["https://graph-dependency-app.vercel.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage of graph loaded from CSV upload
graph_data = {"nodes": [], "edges": []}

@app.post("/upload_csv")
async def upload_csv(file: UploadFile = File(...)):
    content = await file.read()
    decoded = content.decode()
    f = StringIO(decoded)
    reader = csv.DictReader(f)

    nodes = {}
    edges = []

    for row in reader:
        table_id = row["object"]
        depends_on = row["depends_on"].split(";") if row["depends_on"] else []
        nodes[table_id] = {
            "id": table_id,
            "label": table_id,
            "owner": row.get("owner", ""),
            "last_update": row.get("last_update", ""),
            "next_execution": row.get("next_execution", ""),
        }
        for dep in depends_on:
            if dep:
                edges.append({"source": dep.strip(), "target": table_id})

    graph_data["nodes"] = list(nodes.values())
    graph_data["edges"] = edges
    return {"status": "uploaded"}

@app.get("/graph")
def get_graph():
    return graph_data

# PostgreSQL connection URL from environment variable
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set.")

def get_connection():
    return psycopg2.connect(DB_URL)

# Pydantic model for the layout JSON data
class LayoutRequest(BaseModel):
    layout: Dict[str, Dict[str, float]]  # e.g. { "table1": {"x": 100, "y": 200}, ... }

@app.get("/layout")
def get_layout():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT layout_json FROM graph_layouts WHERE id = 1")
    result = cur.fetchone()
    cur.close()
    conn.close()
    if result and result[0]:
        return json.loads(result[0])
    return {}

@app.post("/layout")
def save_layout(layout_req: LayoutRequest):
    conn = get_connection()
    cur = conn.cursor()
    layout_str = json.dumps(layout_req.layout)
    cur.execute("""
        INSERT INTO graph_layouts (id, layout_json)
        VALUES (1, %s)
        ON CONFLICT (id) DO UPDATE SET layout_json = EXCLUDED.layout_json
    """, (layout_str,))
    conn.commit()
    cur.close()
    conn.close()
    return {"status": "ok"}