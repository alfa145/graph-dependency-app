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

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Float, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import csv
import io
import os

# DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost/graph-layout-db")
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class NodePosition(Base):
    __tablename__ = "node_positions"
    node_id = Column(String, primary_key=True, index=True)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)

Base.metadata.create_all(bind=engine)

app = FastAPI()

# Allow frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # update to specific Vercel frontend URL for security
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store graph data in memory for now
graph_data = {"nodes": [], "edges": []}

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    contents = await file.read()
    decoded = contents.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    global graph_data
    graph_data = {"nodes": [], "edges": []}

    for row in reader:
        source = row.get("source")
        target = row.get("target")
        if source and target:
            graph_data["edges"].append({"from": source, "to": target})
        if source and source not in [n["id"] for n in graph_data["nodes"]]:
            graph_data["nodes"].append({"id": source})
        if target and target not in [n["id"] for n in graph_data["nodes"]]:
            graph_data["nodes"].append({"id": target})

    return {"message": "Graph uploaded successfully."}

@app.get("/graph")
def get_graph(db: Session = Depends(get_db)):
    positions = {pos.node_id: {"x": pos.x, "y": pos.y} for pos in db.query(NodePosition).all()}
    nodes_with_positions = []
    for node in graph_data["nodes"]:
        pos = positions.get(node["id"], {"x": 0, "y": 0})
        nodes_with_positions.append({"id": node["id"], **pos})
    return {"nodes": nodes_with_positions, "edges": graph_data["edges"]}

@app.post("/positions")
def save_position(data: dict, db: Session = Depends(get_db)):
    node_id = data.get("node_id")
    x = data.get("x")
    y = data.get("y")

    if not node_id or x is None or y is None:
        raise HTTPException(status_code=400, detail="Missing node_id or position")

    pos = db.query(NodePosition).filter(NodePosition.node_id == node_id).first()
    if pos:
        pos.x = x
        pos.y = y
    else:
        pos = NodePosition(node_id=node_id, x=x, y=y)
        db.add(pos)
    db.commit()
    return {"message": "Position saved"}
