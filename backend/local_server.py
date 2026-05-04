"""
Local Flask dev server — wraps the Lambda handler so you can test without Docker.
Run: python local_server.py
The server listens on http://127.0.0.1:3000
"""

import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS

# ── Point to real AWS DynamoDB (uses your local ~/.aws credentials) ────────────
os.environ.setdefault('RESULTS_TABLE_NAME', 'resume-intelligence-table')
os.environ.setdefault('USERS_TABLE_NAME',   'users-table')
os.environ.setdefault('JWT_SECRET',         'local-dev-secret-change-in-prod')

# Import the Lambda handler AFTER env vars are set
import app as lambda_app   # backend/app.py

flask_app = Flask(__name__)
CORS(flask_app, resources={r"/*": {"origins": "*"}})


def flask_request_to_lambda_event(path: str):
    """Convert an incoming Flask request into the API Gateway proxy event shape."""
    body = None
    if request.data:
        body = request.data.decode('utf-8')
    elif request.is_json:
        body = json.dumps(request.get_json())

    return {
        'path': f'/{path}',
        'httpMethod': request.method,
        'headers': dict(request.headers),
        'queryStringParameters': dict(request.args) or None,
        'body': body,
    }


def lambda_response_to_flask(lambda_resp):
    """Convert a Lambda proxy response dict into a Flask Response."""
    status_code = lambda_resp.get('statusCode', 200)
    body        = lambda_resp.get('body', '{}')
    return flask_app.response_class(
        response=body,
        status=status_code,
        mimetype='application/json'
    )


@flask_app.route('/<path:path>', methods=['GET', 'POST', 'OPTIONS'])
def proxy(path):
    event   = flask_request_to_lambda_event(path)
    result  = lambda_app.lambda_handler(event, {})
    return lambda_response_to_flask(result)


@flask_app.route('/', methods=['GET'])
def root():
    return jsonify({'status': 'AI Resume Intelligence — local dev server running ✅'})


if __name__ == '__main__':
    print("\n[START] Local dev server starting on http://127.0.0.1:3000\n")
    flask_app.run(host='127.0.0.1', port=3000, debug=True)
