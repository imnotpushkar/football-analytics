"""
backend/api/app.py

Flask application factory.

Why a factory function instead of a global app object?
    A factory function (create_app) lets you create multiple instances
    of the app with different configurations — useful for testing
    (test config) vs production (real config). It's the standard
    Flask pattern for any project beyond a single script.

flask-cors (Cross-Origin Resource Sharing):
    Browsers block requests from one origin (e.g. localhost:3000 — React)
    to a different origin (e.g. localhost:5000 — Flask) by default.
    This is a browser security feature called the Same-Origin Policy.
    CORS(app) adds the necessary headers to Flask responses so the
    browser allows our React frontend to talk to our Flask backend.
    Without this, every React fetch() call would be blocked.

Run the app with:
    python -m backend.api.app
"""

from flask import Flask
from flask_cors import CORS
from backend.api.routes import api


def create_app() -> Flask:
    """
    Creates and configures the Flask application.

    Registers the api Blueprint which contains all /api/* routes.
    Enables CORS so the React frontend can make requests.

    Returns:
        Configured Flask app instance.
    """
    app = Flask(__name__)

    # Enable CORS for all routes — allows React (localhost:3000)
    # to talk to Flask (localhost:5000) without browser blocking
    CORS(app)

    # Register the api blueprint — all routes defined in routes.py
    # are prefixed with /api automatically via url_prefix
    app.register_blueprint(api, url_prefix="/api")

    return app


if __name__ == "__main__":
    app = create_app()

    print("=" * 45)
    print("  Football Analytics API")
    print("  Running on http://localhost:5000")
    print("=" * 45)
    print("  Endpoints:")
    print("  GET  /api/matches")
    print("  GET  /api/matches/<id>/summary")
    print("  GET  /api/matches/<id>/events")
    print("  GET  /api/health")
    print("  POST /api/pipeline/run")
    print("=" * 45)

    # debug=True means:
    # 1. Auto-reloads when you save a file — no manual restart needed
    # 2. Shows detailed error pages in the browser
    # Never use debug=True in production — it exposes internals
    app.run(debug=True, port=5000)