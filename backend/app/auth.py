# When someone signs in via Supabase Auth (still handled by the browser, same
# as before), Supabase hands them a signed token (a JWT — "JSON Web Token").
# The browser sends that token with every request to this API in the
# "Authorization: Bearer <token>" header.
#
# This project uses Supabase's newer signing-key system: instead of one
# shared secret, Supabase publishes its PUBLIC verification key at a public
# URL (the "JWKS" — JSON Web Key Set). Only Supabase holds the matching
# PRIVATE key needed to actually sign tokens, so fetching the public one is
# completely safe — it can't be used to forge a token, only to check one.
import os
import time
import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.environ["SUPABASE_URL"]
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

bearer_scheme = HTTPBearer()

_jwks_cache = {"keys": [], "fetched_at": 0}
_CACHE_TTL_SECONDS = 3600  # re-fetch at most once an hour (keys rotate rarely)


def _get_jwks():
    now = time.time()
    if not _jwks_cache["keys"] or (now - _jwks_cache["fetched_at"]) > _CACHE_TTL_SECONDS:
        resp = requests.get(JWKS_URL, timeout=5)
        resp.raise_for_status()
        _jwks_cache["keys"] = resp.json()["keys"]
        _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys"]


def _find_key(kid: str, keys: list) -> dict | None:
    return next((k for k in keys if k.get("kid") == kid), None)


def get_current_user_id(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    token = creds.credentials
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        keys = _get_jwks()
        jwk = _find_key(kid, keys)
        if jwk is None:
            # Key rotated since our last fetch — force a fresh fetch once before giving up.
            _jwks_cache["fetched_at"] = 0
            jwk = _find_key(kid, _get_jwks())
        if jwk is None:
            raise JWTError("Signing key not found")
        payload = jwt.decode(token, jwk, algorithms=[jwk.get("alg", "ES256")], audience="authenticated")
    except (JWTError, requests.RequestException):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session — please sign in again.")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token.")
    return user_id
