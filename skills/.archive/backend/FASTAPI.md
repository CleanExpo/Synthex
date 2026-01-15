---
name: fastapi
version: 1.0.0
priority: 3
triggers:
  - fastapi
  - api
  - endpoint
---

# FastAPI Patterns

## App Setup

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_database(); yield; await close_database()

app = FastAPI(title="API", lifespan=lifespan)
```

## Routes

```python
router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=list[UserResponse])
async def list_users(db: Database = Depends(get_db)):
    return await db.get_users()

@router.get("/{user_id}")
async def get_user(user_id: str, db = Depends(get_db)):
    user = await db.get_user(user_id)
    if not user: raise HTTPException(404, "Not found")
    return user
```

## Models

```python
class CreateUserRequest(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)

class UserResponse(BaseModel):
    id: str; email: str; name: str
    model_config = ConfigDict(from_attributes=True)
```

## Dependencies

```python
async def get_db(): db = Database(); yield db; await db.close()

async def get_current_user(request: Request, db = Depends(get_db)) -> User:
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token: raise HTTPException(401)
    return await verify_token(token, db)
```

## Error Handling

```python
@app.exception_handler(ValidationError)
async def validation_handler(request, exc):
    return JSONResponse(422, {"error": "Validation failed", "details": exc.errors()})
```

See: `api/main.py`, `api/routes/`
