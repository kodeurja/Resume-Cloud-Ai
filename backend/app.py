import json
import boto3
import logging
import datetime
import os
import uuid
import bcrypt
import jwt

# Setup logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
bedrock = boto3.client(service_name='bedrock-runtime')
dynamodb = boto3.resource('dynamodb')
textract = boto3.client('textract')
s3 = boto3.client('s3')
cloudwatch = boto3.client('cloudwatch')
from boto3.dynamodb.conditions import Key

TABLE_NAME = os.environ.get('RESULTS_TABLE_NAME', 'resume-intelligence-table')
USERS_TABLE_NAME = os.environ.get('USERS_TABLE_NAME', 'users-table')
BUCKET_NAME = os.environ.get('RESUME_BUCKET_NAME')
JWT_SECRET = os.environ.get('JWT_SECRET', 'super-secret-key-change-in-prod')
MODEL_ID = 'amazon.nova-pro-v1:0' 
# MODEL_ID = 'amazon.nova-micro-v1:0'

table = dynamodb.Table(TABLE_NAME)
users_table = dynamodb.Table(USERS_TABLE_NAME)

from decimal import Decimal

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def build_cors_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
        },
        'body': json.dumps(body, cls=DecimalEncoder)
    }

def lambda_handler(event, context):
    path = event.get('path', '')
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return build_cors_response(200, {})

    try:
        if path == '/auth/signup':
            return handle_signup(event)
        elif path == '/auth/login':
            return handle_login(event)
        elif path == '/analyze' or '/summarize' in path: # Legacy support
            return handle_analysis(event)
        elif path == '/history':
            return handle_history(event)
        elif path == '/chat':
            return handle_chatbot(event)
        elif path == '/auth/logout':
            return build_cors_response(200, {'message': 'Logged out successfully'})
        elif path == '/get-upload-url':
            return handle_get_upload_url(event)
        else:
            return build_cors_response(404, {'error': f'Route {path} not found'})
    except Exception as e:
        logger.error(f"Global Error: {str(e)}", exc_info=True)
        return build_cors_response(500, {'error': str(e)})

def verify_auth(event):
    headers = event.get('headers', {})
    auth_header = headers.get('Authorization') or headers.get('authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload.get('user_id')
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Auth verification failed: {str(e)}")
        return None

def handle_signup(event):
    body = json.loads(event.get('body', '{}'))
    email = body.get('email')
    password = body.get('password')
    name = body.get('name')
    
    if not email or not password or not name:
        return build_cors_response(400, {'error': 'Missing required fields'})
        
    try:
        # Check if user already exists
        response = users_table.get_item(Key={'email': email})
        if 'Item' in response:
            return build_cors_response(400, {'error': 'User with this email already exists'})

        # Hash password using bcrypt
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

        # Store user in database
        users_table.put_item(
            Item={
                'email': email,
                'user_id': email,  # using email as user_id
                'name': name,
                'password_hash': hashed_password,
                'created_at': datetime.datetime.utcnow().isoformat()
            }
        )
        return build_cors_response(200, {'message': 'User created successfully'})
    except Exception as e:
        logger.error(f"Signup error: {str(e)}")
        return build_cors_response(500, {'error': 'Internal server error during signup'})

def handle_login(event):
    body = json.loads(event.get('body', '{}'))
    email = body.get('email')
    password = body.get('password')
    
    if not email or not password:
        return build_cors_response(400, {'error': 'Missing required fields'})

    try:
        # Find user by email
        response = users_table.get_item(Key={'email': email})
        user = response.get('Item')
        
        if not user:
            return build_cors_response(401, {'error': 'Invalid credentials'})

        # Compare password using bcrypt
        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            return build_cors_response(401, {'error': 'Invalid credentials'})

        # If valid -> generate JWT token
        payload = {
            'user_id': email,
            'name': user.get('name'),
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1)
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
        
        return build_cors_response(200, {'token': token, 'email': email, 'name': user.get('name')})
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return build_cors_response(500, {'error': 'Internal server error during login'})

def extract_json(text):
    """Robustly extract JSON from text even if wrapped in markdown backticks."""
    try:
        # Try finding the first '{' and last '}'
        start = text.find('{')
        end = text.rfind('}')
        if start != -1 and end != -1:
            json_str = text[start:end+1]
            return json.loads(json_str)
        return json.loads(text)
    except Exception as e:
        logger.error(f"JSON Extraction Error: {str(e)} - Raw text: {text}")
        raise ValueError(f"AI returned invalid JSON format: {text[:200]}...")

def handle_get_upload_url(event):
    """Generate a pre-signed S3 URL so the frontend can upload directly to S3."""
    user_id = verify_auth(event)
    if not user_id:
        return build_cors_response(401, {'error': 'Unauthorized'})
    
    try:
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('fileName', 'resume.pdf')
        s3_key = f"{user_id}/{str(uuid.uuid4())}-{file_name}"
        bucket_name = os.environ.get('RESUME_BUCKET_NAME')
        
        s3_client = boto3.client('s3')
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': s3_key,
                'ContentType': 'application/pdf'
            },
            ExpiresIn=300  # URL valid for 5 minutes
        )
        logger.info(f"Generated presigned URL for key: {s3_key}")
        return build_cors_response(200, {'uploadUrl': presigned_url, 's3Key': s3_key})
    except Exception as e:
        logger.error(f"Error generating presigned URL: {str(e)}")
        return build_cors_response(500, {'error': 'Could not generate upload URL'})

def handle_analysis(event):
    user_id = verify_auth(event)
    if not user_id:
        return build_cors_response(401, {'error': 'Unauthorized'})

    body = json.loads(event.get('body', '{}'))
    text_content = body.get('text')
    jd_content = body.get('jobDescription', '')
    s3_key = body.get('s3Key')  # S3 key from the pre-signed upload step
    
    if not text_content:
        return build_cors_response(400, {'error': 'Missing text content'})

    if s3_key:
        logger.info(f"Resume linked to S3 key: {s3_key}")
    
    text_len = len(text_content) if text_content else 0
    logger.info(f"Processing analysis request. Text length: {text_len}, JD length: {len(jd_content)}")

    if text_len < 50:
        logger.warning("Extracted text is too short. Potential PDF parsing issue.")
        return build_cors_response(400, {'error': 'Resume not found. The uploaded file seems empty or could not be read properly.'})

    # Prepare Bedrock Prompt for full analysis
    system_prompt = (
        "You are a Senior Technical Recruiter. "
        "Analyze the provided Resume Content against the Job Description. "
        "If the content is absolutely garbage or not a resume at all, return {\"error\": \"resume_not_found\"}. "
        "Otherwise, calculate an ATS score and return ONLY a JSON object with these keys: "
        "summary (string), skills (array), experience (string), ats_score (integer 0-100), "
        "missing_skills (array), and suggestions (object containing arrays: 'skills', 'experience', 'projects', 'keywords')."
    )
    
    user_prompt = f"Resume Content:\n{text_content}\n\nJob Description:\n{jd_content}\n\nPerform validation and analysis:"
    
    bedrock_payload = {
        "system": [{"text": system_prompt}],
        "messages": [{"role": "user", "content": [{"text": user_prompt}]}],
        "inferenceConfig": {"max_new_tokens": 2000, "temperature": 0.1}
    }

    logger.info(f"Invoking Bedrock model: {MODEL_ID}")
    start_time = datetime.datetime.now()
    try:
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(bedrock_payload),
            accept='application/json',
            contentType='application/json'
        )
        
        end_time = datetime.datetime.now()
        duration = (end_time - start_time).total_seconds()
        logger.info(f"Bedrock call completed in {duration}s")
        
        response_body = json.loads(response.get('body').read())
        output_text = response_body.get('output', {}).get('message', {}).get('content', [])[0].get('text', '')
        
        if not output_text:
            raise ValueError("Bedrock returned an empty response")
            
        analysis = extract_json(output_text)

        # Check if AI identified it as NOT a resume
        if isinstance(analysis, dict) and analysis.get('error') == 'resume_not_found':
            return build_cors_response(400, {'error': 'Resume not found. Please upload a valid professional resume.'})
            
        # STEP 2: Generate Optimized Resume if ATS < 100
        analysis['optimized_resume'] = None
        if isinstance(analysis, dict) and analysis.get('ats_score', 100) < 100:
            opt_system = (
                "You are an AI Resume Writer. Rewrite the provided resume to best match the job description "
                "while keeping it realistic and professional. Incorporate missing skills where realistically possible. "
                "Output ONLY a JSON object exactly with these keys: "
                "name (string), summary (string), skills (array of strings), experience (array of objects with 'role' and 'description' strings), "
                "projects (array of strings), education (string)."
            )
            opt_user = f"Original Resume:\n{text_content}\n\nJob Description:\n{jd_content}\n\nMissing Skills to incorporate:\n{', '.join(analysis.get('missing_skills', []))}"
            
            opt_payload = {
                "system": [{"text": opt_system}],
                "messages": [{"role": "user", "content": [{"text": opt_user}]}],
                "inferenceConfig": {"max_new_tokens": 2500, "temperature": 0.2}
            }
            try:
                opt_res = bedrock.invoke_model(
                    modelId=MODEL_ID,
                    body=json.dumps(opt_payload),
                    accept='application/json',
                    contentType='application/json'
                )
                opt_body = json.loads(opt_res.get('body').read())
                opt_text = opt_body.get('output', {}).get('message', {}).get('content', [])[0].get('text', '')
                analysis['optimized_resume'] = extract_json(opt_text)
            except Exception as e_opt:
                logger.error(f"Bedrock Optimization Error: {str(e_opt)}")
                # Fail gracefully for the optimization part
                analysis['optimized_resume'] = None

    except Exception as e:
        logger.error(f"Bedrock Error: {str(e)}")
        # Fallback analysis if AI fails
        analysis = {
            "summary": "AI Analysis temporarily unavailable. Please retry.",
            "skills": [],
            "experience": "N/A",
            "ats_score": 0,
            "missing_skills": [],
            "suggestions": {"skills": [], "experience": [], "projects": [], "keywords": ["System error, please retry"]},
            "optimized_resume": None
        }
    
    # Persist to DynamoDB
    record = {
        'UserId': user_id,
        'Timestamp': datetime.datetime.utcnow().isoformat(),
        'ResumeId': str(uuid.uuid4()),
        'Data': analysis,
        'RawText': text_content[:5000], # Store first 5k chars for chatbot context
        'S3Key': s3_key
    }
    table.put_item(Item=record)
    
    return build_cors_response(200, analysis)

def handle_history(event):
    user_id = verify_auth(event)
    if not user_id:
        return build_cors_response(401, {'error': 'Unauthorized'})

    response = table.query(
        KeyConditionExpression=Key('UserId').eq(user_id),
        ScanIndexForward=False, # Sort by timestamp descending natively
        Limit=50
    )
    items = response.get('Items', [])
    return build_cors_response(200, items)

def handle_chatbot(event):
    user_id = verify_auth(event)
    if not user_id:
        return build_cors_response(401, {'error': 'Unauthorized'})

    body = json.loads(event.get('body', '{}'))
    query = body.get('query')
    
    if not query:
        return build_cors_response(400, {'error': 'Missing query'})

    # Retrieve context from DynamoDB properly isolated to this user
    res = table.query(
        KeyConditionExpression=Key('UserId').eq(user_id),
        Limit=10,
        ScanIndexForward=False,
        ProjectionExpression="RawText, #d.ats_score, #d.summary",
        ExpressionAttributeNames={"#d": "Data"}
    )
    context_data = res.get('Items', [])
    
    # Safely extract values in case Data is malformed
    context_str = ""
    for i, c in enumerate(context_data):
        data = c.get('Data', {})
        score = data.get('ats_score', 'N/A')
        summary = data.get('summary', 'No summary')
        raw_text_head = c.get('RawText', '')[:400] # Provide start of resume to extract name
        context_str += f"\n---\nProfile Data:\nATS Score: {score}\nResume Header (extract name from here): {raw_text_head}...\nSummary: {summary}"

    system_prompt = (
        "You are an Executive HR Assistant. "
        "Answer the user query based ONLY on the provided context of candidates. "
        "CRITICAL RULE: When asked for top profiles or candidates, DO NOT provide long summaries. "
        "Instead, extract the candidate's real name from the 'Resume Header' and directly list their names and ATS scores. "
        "Keep responses concise, direct, and name-focused."
    )
    
    user_prompt = f"Context:\n{context_str}\n\nUser Question: {query}"
    
    bedrock_payload = {
        "system": [{"text": system_prompt}],
        "messages": [{"role": "user", "content": [{"text": user_prompt}]}],
        "inferenceConfig": {"max_new_tokens": 500, "temperature": 0.5}
    }

    response = bedrock.invoke_model(
        modelId=MODEL_ID,
        body=json.dumps(bedrock_payload),
        accept='application/json',
        contentType='application/json'
    )
    
    response_body = json.loads(response.get('body').read())
    answer = response_body.get('output', {}).get('message', {}).get('content', [])[0].get('text', '')
    
    return build_cors_response(200, {'answer': answer})
