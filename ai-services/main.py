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

class RecipeRequest(BaseModel):
    prompt: str

# predefined blueprints
RECIPE_BLUEPRINTS = {
    "pizza": [{"name": "Pizza Dough", "qty": 1}, {"name": "Tomato Sauce", "qty": 1}, {"name": "Mozzarella Cheese", "qty": 2}],
    "pasta": [{"name": "Pasta", "qty": 1}, {"name": "Pasta Sauce", "qty": 1}, {"name": "Parmesan", "qty": 1}],
    "salad": [{"name": "Lettuce", "qty": 1}, {"name": "Tomatoes", "qty": 2}, {"name": "Cucumber", "qty": 1}, {"name": "Salad Dressing", "qty": 1}],
    "tea": [{"name": "Tea Leaves", "qty": 1}, {"name": "Milk", "qty": 1}, {"name": "Sugar", "qty": 1}],
    "coffee": [{"name": "Coffee Beans", "qty": 1}, {"name": "Milk", "qty": 1}, {"name": "Sugar", "qty": 1}],
}

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

import re
@app.post("/api/ai/recipe")
def parse_recipe(req: RecipeRequest):
    prompt_lower = req.prompt.lower()
    
    match = re.search(r'for (\d+)', prompt_lower)
    people = int(match.group(1)) if match else 2
    
    scale_factor = max(1, people // 2)
    
    prompt_emb = embedding_model.encode(prompt_lower)
    best_blueprint = None
    best_score = -1
    
    for key in RECIPE_BLUEPRINTS.keys():
        key_emb = embedding_model.encode(key)
        score = np.dot(prompt_emb, key_emb) / (np.linalg.norm(prompt_emb) * np.linalg.norm(key_emb))
        if score > best_score:
            best_score = score
            best_blueprint = key
            
    if best_score < 0.3 or not best_blueprint:
        raise HTTPException(status_code=400, detail="Could not understand recipe intent.")
        
    items = []
    for item in RECIPE_BLUEPRINTS[best_blueprint]:
        items.append({
            "name": item["name"],
            "quantity": item["qty"] * scale_factor
        })
        
    return {"recipe": best_blueprint, "people": people, "items": items}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
