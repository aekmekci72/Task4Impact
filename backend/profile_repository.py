from firebase import db


def get_profile(uid):
    doc = db.collection("users").document(uid).get()
    return _to_profile(doc) if doc.exists else None


def list_profiles():
    docs = db.collection("users").stream()
    return sorted((_to_profile(d) for d in docs), key=lambda p: p["name"].casefold())


def save_profile(uid, email, fields):
    """Create or replace a profile. fields comes from validate_profile.

    Returns (profile, created) so the route can pick 201 vs 200.
    """
    ref = db.collection("users").document(uid)
    created = not ref.get().exists
    ref.set({**fields, "email": email}, merge=True)
    return {"id": uid, "email": email, **fields}, created


def _to_profile(doc):
    return {"id": doc.id, **doc.to_dict()}
