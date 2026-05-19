import base64
import numpy as np
import cv2
import face_recognition
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from fastapi.middleware.cors import CORSMiddleware
from typing import List

app = FastAPI(title="Smarter Blinkit AI Services")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Models
print("Loading models...")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
print("Models loaded successfully.")

class FaceEncodeRequest(BaseModel):
    image: str # Base64 encoded string

class FaceVerifyRequest(BaseModel):
    image: str # Base64
    known_encodings: List[List[float]]

class TextEmbedRequest(BaseModel):
    text: str

def decode_image(base64_str: str) -> np.ndarray:
    try:
        if ',' in base64_str:
            base64_str = base64_str.split(',')[1]
        img_data = base64.b64decode(base64_str)
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is not None:
            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        return img
    except Exception as e:
        return None

@app.post("/api/face/encode")
def encode_face(req: FaceEncodeRequest):
    img = decode_image(req.image)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")
    
    face_locations = face_recognition.face_locations(img)
    if not face_locations:
        raise HTTPException(status_code=400, detail="No face found in image")
    
    encodings = face_recognition.face_encodings(img, face_locations)
    if not encodings:
        raise HTTPException(status_code=400, detail="Could not encode face")
        
    return {"encoding": encodings[0].tolist()}

@app.post("/api/face/verify")
def verify_face(req: FaceVerifyRequest):
    img = decode_image(req.image)
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image data")
        
    face_locations = face_recognition.face_locations(img)
    if not face_locations:
        raise HTTPException(status_code=400, detail="No face found in image")
        
    encodings = face_recognition.face_encodings(img, face_locations)
    if not encodings:
        raise HTTPException(status_code=400, detail="Could not encode face")
        
    unknown_encoding = encodings[0]
    known_encs = [np.array(e) for e in req.known_encodings]
    
    if not known_encs:
        return {"match_index": -1, "distance": 1.0}
        
    distances = face_recognition.face_distance(known_encs, unknown_encoding)
    best_match_index = np.argmin(distances)
    
    # tolerance of 0.6 is typical
    if distances[best_match_index] < 0.6:
        return {"match_index": int(best_match_index), "distance": float(distances[best_match_index])}
    else:
        return {"match_index": -1, "distance": float(distances[best_match_index])}

@app.post("/api/embeddings/encode")
def encode_text(req: TextEmbedRequest):
    embedding = embedding_model.encode(req.text)
    return {"embedding": embedding.tolist()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
