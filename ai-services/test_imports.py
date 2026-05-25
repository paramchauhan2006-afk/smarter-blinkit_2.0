import sys

def test_imports():
    print("Testing core AI service imports...")
    try:
        import base64
        import numpy as np
        import cv2
        print("[OK] Core utilities imported successfully.")
        
        # We need to test the fallback mechanism specifically
        from main import face_recognition
        
        if hasattr(face_recognition, '__class__') and face_recognition.__class__.__name__ == 'MockFaceRecognition':
            print("[OK] face_recognition mock fallback loaded successfully.")
            # Test mock functionality
            img = np.zeros((100, 100, 3), dtype=np.uint8)
            locs = face_recognition.face_locations(img)
            assert len(locs) == 1, "Mock face_locations failed"
            encs = face_recognition.face_encodings(img, locs)
            assert len(encs) == 1 and len(encs[0]) == 128, "Mock face_encodings failed"
            dists = face_recognition.face_distance([encs[0]], encs[0])
            assert len(dists) == 1 and dists[0] == 0.1, "Mock face_distance failed"
            print("[OK] Mock face_recognition methods verified.")
        else:
            print("[OK] Native face_recognition library loaded successfully.")
            
        print("[OK] All imports passed successfully without crashing.")
        sys.exit(0)
    except Exception as e:
        print(f"[FAIL] Import test failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    test_imports()

if __name__ == "__main__":
    test_imports()
