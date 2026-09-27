from skills import SKILL_TAGS

MAX_NAME_LENGTH = 100
SENIORITY_LEVELS = ("newbie", "oldie")


def validate_profile(data):
    """Check a profile payload from the client and return the cleaned fields.

    Raises ValueError with a message the UI can show if anything is invalid.
    Only name, seniority, strengths, and interests are read; id and email
    come from the sign-in token, so any client-sent values for them are ignored.
    """
    if not isinstance(data, dict):
        raise ValueError("Profile must be a JSON object")

    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        raise ValueError("Name is required")
    name = name.strip()
    if len(name) > MAX_NAME_LENGTH:
        raise ValueError(f"Name must be at most {MAX_NAME_LENGTH} characters")

    seniority = data.get("seniority")
    if seniority not in SENIORITY_LEVELS:
        raise ValueError("Seniority must be newbie or oldie")

    strengths = _validate_tags(data.get("strengths"), "strengths")
    if not strengths:
        raise ValueError("Pick at least one strength")

    return {
        "name": name,
        "seniority": seniority,
        "strengths": strengths,
        "interests": _validate_tags(data.get("interests"), "interests"),
    }


def _validate_tags(tags, field):
    if not isinstance(tags, list):
        raise ValueError(f"{field} must be a list of skill tags")
    unknown = [t for t in tags if t not in SKILL_TAGS]
    if unknown:
        raise ValueError(f"Unknown {field}: {', '.join(map(str, unknown))}")
    return list(dict.fromkeys(tags))
