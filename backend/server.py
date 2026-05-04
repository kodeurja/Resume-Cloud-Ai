from flask import Flask, request, jsonify
from flask_cors import CORS
import json
import logging
from app import lambda_handler

# Initialize Flask app
app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@app.route('/<path:path>', methods=['GET', 'POST', 'OPTIONS'])
def proxy(path):
    # Prepare the event object to mimic AWS Lambda's event structure
    event = {
        'path': f'/{path}',
        'httpMethod': request.method,
        'headers': dict(request.headers),
        'body': request.get_data().decode('utf-8') if request.data else '{}',
        'requestContext': {} # Minimal context
    }
    
    # Add query parameters if present
    if request.args:
        event['queryStringParameters'] = dict(request.args)

    try:
        # Call the existing lambda_handler
        # Note: 'context' is not used in our current app.py logic
        response = lambda_handler(event, None)
        
        # Extract body and status code from Lambda response
        status_code = response.get('statusCode', 200)
        body = json.loads(response.get('body', '{}'))
        headers = response.get('headers', {})
        
        return jsonify(body), status_code, headers
        
    except Exception as e:
        logger.error(f"EC2 Server Error: {str(e)}")
        return jsonify({'error': 'Internal Server Error', 'details': str(e)}), 500

if __name__ == '__main__':
    # Run locally for testing (Gunicorn will be used in production)
    app.run(host='0.0.0.0', port=5000, debug=True)
