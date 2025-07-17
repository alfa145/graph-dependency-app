from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import csv
from io import StringIO

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
