import json
import boto3
import logging
import datetime
import os

# Setup basic logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
try:
    bedrock = boto3.client(service_name='bedrock-runtime')
    dynamodb = boto3.resource('dynamodb')
    cloudwatch = boto3.client('cloudwatch')
    table_name = os.environ.get('RESULTS_TABLE_NAME', 'sice-results-table')
    table = dynamodb.Table(table_name)
except Exception as e:
    logger.error(f"Failed to initialize AWS clients: {e}")
    bedrock = None
    table = None

MODEL_ID = 'amazon.nova-micro-v1:0'

def build_cors_response(status_code, body):
    """Helper function to return CORS headers with the response."""
    return {
        'statusCode': status_code,
        'headers': {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'OPTIONS,POST'
        },
        'body': json.dumps(body)
    }

def lambda_handler(event, context):
    logger.info("Received request to summarize Resume content.")
    logger.info(f"Incoming Event: {json.dumps(event)}")
    
    # Error checking for bedrock client
    if not bedrock:
        logger.error("Bedrock client is uninitialized.")
        return build_cors_response(500, {'error': 'Internal server error: Bedrock client uninitialized'})

    # Handle OPTIONS method for CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        logger.info("Handling OPTIONS preflight request.")
        return build_cors_response(200, {})

    try:
        # Determine if event is from Proxy Integration or Non-Proxy
        if 'body' in event and isinstance(event['body'], str):
            logger.info("Detected API Gateway Proxy Integration format.")
            body = json.loads(event['body'])
            text_content = body.get('text')
        else:
            logger.info("Detected RAW/Non-Proxy format.")
            text_content = event.get('text')

        if not text_content:
            logger.warning("No text content found in request.")
            return build_cors_response(400, {'error': 'Missing "text" field in request body'})

        # Construct the prompts for Amazon Nova Micro
        system_prompt = (
            "You are an expert summarizer. Your task is to provide a highly concise, "
            "accurate, and easy-to-read summary of the provided text. "
            "You MUST output your response strictly as a JSON array of strings, where each string is a bullet point. "
            "Do not include any intro, outro, or markdown formatting outside of the JSON array. "
            "Example format: [\"Bullet point 1.\", \"Bullet point 2.\"]"
        )
        user_prompt = f"Please summarize the following text:\n\n{text_content}"

        bedrock_payload = {
            "system": [{"text": system_prompt}],
            "messages": [
                {
                    "role": "user",
                    "content": [{"text": user_prompt}]
                }
            ],
            "inferenceConfig": {
                "max_new_tokens": 800,
                "temperature": 0.3,
                "top_p": 0.9
            }
        }

        # Invoke Bedrock
        response = bedrock.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(bedrock_payload),
            accept='application/json',
            contentType='application/json'
        )

        response_body = json.loads(response.get('body').read())
        
        # Amazon Nova response extraction
        output_text = response_body.get('output', {}).get('message', {}).get('content', [])[0].get('text', '')
        
        # Extract telemetry data
        usage = response_body.get('usage', {})
        input_tokens = usage.get('inputTokens', 0)
        output_tokens = usage.get('outputTokens', 0)
        
        # Push to CloudWatch
        try:
            cloudwatch.put_metric_data(
                Namespace='SICE/Telemetry',
                MetricData=[
                    {'MetricName': 'InputTokens', 'Value': input_tokens, 'Unit': 'Count'},
                    {'MetricName': 'OutputTokens', 'Value': output_tokens, 'Unit': 'Count'}
                ]
            )
            logger.info(f"Pushed CW metrics: Input={input_tokens}, Output={output_tokens}")
        except Exception as e:
            logger.error(f"Failed to push CW metrics: {e}")
        
        # Try to parse the output text expecting it to be a JSON array
        try:
            bullet_points = json.loads(output_text)
            if not isinstance(bullet_points, list):
                raise ValueError("LLM returned JSON, but it was not a list.")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse LLM output as JSON: {e}")
            logger.error(f"Raw LLM output: {output_text}")
            # Fallback: if it failed to output pure JSON, split by newlines manually
            cleaned_text = output_text.strip().replace('[', '').replace(']', '')
            bullet_points = [b.strip().strip('"').strip() for b in cleaned_text.split('\n') if b.strip()]

        # Persistence to DynamoDB
        if table:
            try:
                timestamp = datetime.datetime.utcnow().isoformat()
                user_id = 'anonymous'  # Uses anonymous as no auth exists
                table.put_item(
                    Item={
                        'UserId': user_id,
                        'Timestamp': timestamp,
                        'Summary': bullet_points
                    }
                )
                logger.info(f"Successfully saved summary to DDB for user {user_id}")
            except Exception as e:
                logger.error(f"Failed to save record to DynamoDB: {e}")

        return build_cors_response(200, {'bullets': bullet_points})

    except Exception as e:
        logger.error(f"Error processing request: {str(e)}", exc_info=True)
        # Format errors perfectly too, so the frontend can read them
        return build_cors_response(500, {'error': str(e)})
