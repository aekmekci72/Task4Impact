"""Writes fake member profiles to Firestore so the directory and assignment have people to show.

    .venv/bin/python seed_profiles.py            # create or overwrite the seed profiles
    .venv/bin/python seed_profiles.py --delete   # remove them

Seed users can't sign in; their ids aren't real Firebase accounts. Re-running is safe:
it overwrites the same documents instead of adding duplicates.
"""
import sys

from firebase import db
from profile_repository import save_profile
from profiles import validate_profile

SEED_PROFILES = {
    "seed-maya": {
        "name": "Maya Patel",
        "seniority": "oldie",
        "strengths": ["backend", "python", "database"],
        "interests": ["data-ml"],
    },
    "seed-leo": {
        "name": "Leo Martinez",
        "seniority": "newbie",
        "strengths": ["frontend", "react", "css"],
        "interests": ["ui-design", "javascript"],
    },
    "seed-priya": {
        "name": "Priya Shah",
        "seniority": "oldie",
        "strengths": ["ui-design", "product-management"],
        "interests": ["frontend", "mobile"],
    },
    "seed-sam": {
        "name": "Sam Okafor",
        "seniority": "newbie",
        "strengths": ["javascript", "node", "apis"],
        "interests": ["backend", "devops"],
    },
    "seed-grace": {
        "name": "Grace Kim",
        "seniority": "oldie",
        "strengths": ["devops", "testing", "firebase"],
        "interests": ["auth"],
    },
    "seed-noah": {
        "name": "Noah Brooks",
        "seniority": "newbie",
        "strengths": ["data-ml", "python"],
        "interests": ["backend", "database"],
    },
}


def seed():
    for uid, profile in SEED_PROFILES.items():
        _, created = save_profile(uid, f"{uid.removeprefix('seed-')}@example.com", validate_profile(profile))
        print(f"{'created' if created else 'updated'} {uid}")


def delete():
    for uid in SEED_PROFILES:
        db.collection("users").document(uid).delete()
        print(f"deleted {uid}")


if __name__ == "__main__":
    delete() if "--delete" in sys.argv else seed()
