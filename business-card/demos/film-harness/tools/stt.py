# Transcribe audio files with ElevenLabs speech-to-text (word timings). Key is read from the env loader, never printed.
import sys, json, uuid, urllib.request
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[2]))   # business-card/demos, for build.env()
import build as B
key = B.env()["ELEVENLABS_API_KEY"]
for path in sys.argv[1:]:
    bnd = uuid.uuid4().hex; data = open(path, "rb").read()
    body = (f"--{bnd}\r\nContent-Disposition: form-data; name=\"model_id\"\r\n\r\nscribe_v1\r\n"
            f"--{bnd}\r\nContent-Disposition: form-data; name=\"tag_audio_events\"\r\n\r\ntrue\r\n"
            f"--{bnd}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.mp3\"\r\nContent-Type: audio/mpeg\r\n\r\n").encode() + data + f"\r\n--{bnd}--\r\n".encode()
    req = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=body,
                                 headers={"xi-api-key": key, "Content-Type": f"multipart/form-data; boundary={bnd}"})
    r = json.load(urllib.request.urlopen(req, timeout=300))
    print("==", path.split("/")[-1], "|", r.get("text", ""))
    for w in r.get("words", []):
        if w.get("type") == "word": print(f"  {w['start']:6.2f} {w['text']}")
