# #******************************
# # Working version with only csv
# #******************************

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


#*********************************
# New version for position storage
#*********************************

from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import csv
import io
import os

# === DATABASE SETUP ===
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

# === APP SETUP ===
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # consider restricting in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graph_data = {"nodes": [], "edges": []}
csv_loaded = False  # Tracks if default.csv was already loaded


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def load_default_csv():
    """Reads default.csv if graph_data is empty"""
    global graph_data, csv_loaded

    if csv_loaded or graph_data["nodes"]:
        return  # already loaded

    path = os.path.join(os.path.dirname(__file__), "default.csv")
    if not os.path.exists(path):
        print("⚠️ default.csv not found.")
        return

    with open(path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        nodes = {}
        edges = []

        for row in reader:
            table_id = row["object"]
            depends_on = row["depends_on"].split(";") if row["depends_on"] else []

            if table_id not in nodes:
                nodes[table_id] = {
                    "id": table_id,
                    "label": table_id,
                    "owner": row.get("owner", ""),
                    "last_update": row.get("last_update", ""),
                    "next_execution": row.get("next_execution", "")
                }

            for dep in depends_on:
                dep = dep.strip()
                if dep:
                    edges.append({"source": dep, "target": table_id})

        graph_data["nodes"] = list(nodes.values())
        graph_data["edges"] = edges
        csv_loaded = True
        print("✅ default.csv loaded.")


@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload new CSV via /upload"""
    global graph_data, csv_loaded

    contents = await file.read()
    decoded = contents.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    nodes = {}
    edges = []

    for row in reader:
        table_id = row["object"]
        depends_on = row["depends_on"].split(";") if row["depends_on"] else []

        if table_id not in nodes:
            nodes[table_id] = {
                "id": table_id,
                "label": table_id,
                "owner": row.get("owner", ""),
                "last_update": row.get("last_update", ""),
                "next_execution": row.get("next_execution", "")
            }

        for dep in depends_on:
            dep = dep.strip()
            if dep:
                edges.append({"source": dep, "target": table_id})

    graph_data["nodes"] = list(nodes.values())
    graph_data["edges"] = edges
    csv_loaded = True

    return {"message": "Graph uploaded successfully."}


@app.get("/graph")
def get_graph(db: Session = Depends(get_db)):
    """Return graph with persisted positions"""
    load_default_csv()

    positions = {
        pos.node_id: {"x": pos.x, "y": pos.y}
        for pos in db.query(NodePosition).all()
    }

    nodes_with_positions = []
    for node in graph_data["nodes"]:
        pos = positions.get(node["id"], {"x": 0, "y": 0})
        nodes_with_positions.append({
            "id": node["id"],
            "label": node.get("label", ""),
            "owner": node.get("owner", ""),
            "last_update": node.get("last_update", ""),
            "next_execution": node.get("next_execution", ""),
            **pos
        })

    return {"nodes": nodes_with_positions, "edges": graph_data["edges"]}


@app.post("/positions")
def save_position(data: dict, db: Session = Depends(get_db)):
    """Save or update a node's position"""
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
