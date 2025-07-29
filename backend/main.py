from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Float, DateTime, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime
from croniter import croniter
import csv
import io
import os

# === DATABASE SETUP ===
DATABASE_URL = os.getenv("DATABASE_URL")



engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Node(Base):
    __tablename__ = "nodes"
    id = Column(String, primary_key=True, index=True)
    label = Column(String)
    schema = Column(String)
    server = Column(String)
    owner = Column(String)
    creation_date = Column(String)
    last_update = Column(String)
    cron_expression = Column(String)
    next_execution = Column(String)
    x = Column(Float, default=0)
    y = Column(Float, default=0)
    calendar_string = Column(String)

    outgoing_edges = relationship(
        "Edge",
        back_populates="source_node",
        foreign_keys="Edge.source",  # specify source FK
        cascade="all, delete"
    )

    incoming_edges = relationship(
        "Edge",
        back_populates="target_node",
        foreign_keys="Edge.target",  # specify target FK
        cascade="all, delete"
    )


class Edge(Base):
    __tablename__ = "edges"
    id = Column(String, primary_key=True)
    source = Column(String, ForeignKey("nodes.id"))
    target = Column(String, ForeignKey("nodes.id"))

    source_node = relationship("Node", foreign_keys=[source], back_populates="outgoing_edges")
    target_node = relationship("Node", foreign_keys=[target], back_populates="incoming_edges")


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


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# === HELPERS ===
def calculate_next_execution(cron_expr: str) -> str:
    try:
        base = datetime.now()
        itr = croniter(cron_expr, base)
        return itr.get_next(datetime).isoformat()
    except Exception:
        return ""


# === ROUTES ===
@app.post("/upload")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload and parse new CSV, wipe existing data"""
    contents = await file.read()
    decoded = contents.decode("utf-8")
    reader = csv.DictReader(io.StringIO(decoded))

    db.query(Edge).delete()
    db.query(Node).delete()
    db.commit()

    nodes = {}
    edges = []

    for row in reader:
        node_id = row["object"]

        nodes[node_id] = Node(
            id=node_id,
            label=row["object"],
            schema=row.get("schema", ""),
            server=row.get("server", ""),
            owner=row.get("owner", ""),
            creation_date=row.get("creation_date", ""),
            last_update=row.get("last_update", ""),
            cron_expression=row.get("cron_expression", ""),
            next_execution=calculate_next_execution(row.get("cron_expression", "")),
            x=float(row["position_x"]) if row.get("position_x") else 0,
            y=float(row["position_y"]) if row.get("position_y") else 0,
            calendar_string=row.get("calendar_string", "")
        )

        depends_on = row.get("depends_on", "")
        if depends_on:
            for dep in depends_on.split(";"):
                dep = dep.strip()
                if dep:
                    edge_id = f"{dep}->{node_id}"
                    edges.append(Edge(id=edge_id, source=dep, target=node_id))

    db.bulk_save_objects(nodes.values())
    db.bulk_save_objects(edges)
    db.commit()

    return {"message": "Graph data loaded into DB"}


@app.get("/graph")
def get_graph(db: Session = Depends(get_db)):
    """Returns graph from DB"""
    nodes = db.query(Node).all()
    edges = db.query(Edge).all()

    node_list = [
        {
            "id": node.id,
            "label": node.label,
            "schema": node.schema,
            "server": node.server,
            "owner": node.owner,
            "creation_date": node.creation_date,
            "last_update": node.last_update,
            "cron_expression": node.cron_expression,
            "next_execution": node.next_execution,
            "x": node.x,
            "y": node.y,
            "calendar_string": node.calendar_string
        }
        for node in nodes
    ]

    edge_list = [{"source": edge.source, "target": edge.target} for edge in edges]

    return {"nodes": node_list, "edges": edge_list}


@app.post("/positions")
def save_position(data: dict, db: Session = Depends(get_db)):
    """Update position of a single node"""
    # node_id = data.get("node_id")
    # x = data.get("x")
    # y = data.get("y")
    node_id = data.get("id")
    position = data.get("position", {})
    x = position.get("x", 0)
    y = position.get("y", 0)


    node = db.query(Node).filter(Node.id == node_id).first()
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")

    node.x = x
    node.y = y
    db.commit()

    return {"message": "Position updated"}
# DELETE: Reset all nodes and edges
@app.delete("/reset")
def reset_graph(db: Session = Depends(get_db)):
    try:
        db.query(Edge).delete()
        db.query(Node).delete()
        db.commit()
        return {"status": "reset complete"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
