# neon1-site :: infra/modules/neo-chat/lambda/index.py
# Purpose: Lambda handler for Neo chat (API Gateway HTTP API). Speaks to Amazon Bedrock.
# Notes: No external deps; uses boto3 (preinstalled in Lambda runtime). Optional DynamoDB for memory.
# Linked to: infra/modules/neo-chat/main.tf (Terraform provisions this + injects env vars)

import os, json, time, decimal, boto3
from boto3.dynamodb.conditions import Key

# --------------------------------------------------------------------
# Environment variables (injected from Terraform `aws_lambda_function.neo`)
# --------------------------------------------------------------------
# Which Bedrock model to call (default: Claude 3 Haiku). Change in TF if needed.
MODEL_ID        = os.environ.get("MODEL_ID", "anthropic.claude-3-haiku-20240307-v1:0")
# Persona baked into every request. Default is a short “Neo” system role.
SYSTEM_PROMPT   = os.environ.get("SYSTEM_PROMPT", "You are Neo from The Matrix. Calm, kind, a quiet rebel. Speak briefly, clearly, and compassionately. Help the user escape confusion.")
# AWS region to run Bedrock in. Must be enabled in your account.
REGION          = os.environ.get("REGION", "us-east-1")
# If true, DynamoDB memory persistence is enabled.
ENABLE_MEMORY   = os.environ.get("ENABLE_MEMORY", "0") == "1"
# DynamoDB table name (set by Terraform if memory is enabled).
TABLE_NAME      = os.environ.get("TABLE_NAME", "")
# How many past messages to retrieve for context (per session).
MEMORY_MAX      = int(os.environ.get("MEMORY_MAX", "10"))
# Daily request cap per session (enforced here). Configurable in TF.
MAX_REQUESTS    = int(os.environ.get("MAX_REQUESTS_PER_DAY", "1000"))
# Comma-separated CORS allowlist. Usually includes your CloudFront domain(s).
ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

# --------------------------------------------------------------------
# AWS SDK clients
# --------------------------------------------------------------------
# Main client for Bedrock model inference.
bedrock  = boto3.client("bedrock-runtime", region_name=REGION)  
# DynamoDB resource, only if memory is enabled.
dynamodb = boto3.resource("dynamodb") if ENABLE_MEMORY and TABLE_NAME else None  
# Bound table handle (safe to be None if memory off).
table    = dynamodb.Table(TABLE_NAME) if dynamodb else None  

# --------------------------------------------------------------------
# Helper: format API Gateway HTTP response with JSON + CORS headers
# --------------------------------------------------------------------
def _resp(status, body, origin="*"):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin, # Dynamically set from request origin
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body)
    }

# --------------------------------------------------------------------
# Helper: determine which Origin to allow based on event headers
# --------------------------------------------------------------------
def _allowed_origin(event):
    headers = event.get("headers") or {}
    origin  = headers.get("origin") or headers.get("Origin") or "*"
    if "*" in ALLOWED_ORIGINS:
        return origin  # wildcard mode: reflect whatever was sent
    return origin if origin in ALLOWED_ORIGINS else ALLOWED_ORIGINS[0]

# --------------------------------------------------------------------
# Helper: timestamp in ms (for DynamoDB sort key)
# --------------------------------------------------------------------
def _now_ms():
    return int(time.time() * 1000)

# --------------------------------------------------------------------
# Load chat history from DynamoDB (up to MEMORY_MAX items)
# --------------------------------------------------------------------
def _load_memory(session_id):
    if not table: 
        return []
    resp = table.query(
        KeyConditionExpression=Key("session_id").eq(session_id),
        ScanIndexForward=False,   # newest first
        Limit=MEMORY_MAX
    )
    items = resp.get("Items", [])
    items.sort(key=lambda x: x["ts"])  # ensure chronological order
    history = []
    for it in items:
        txt = it.get("text")
        if isinstance(txt, decimal.Decimal):  # Dynamo can store numbers as Decimal
            txt = str(txt)
        history.append({
            "role": it.get("role", "user"),
            "text": txt
        })
    return history

# --------------------------------------------------------------------
# Save one message to DynamoDB (if memory enabled)
# --------------------------------------------------------------------
def _save_message(session_id, role, text):
    if not table:
        return
    table.put_item(Item={
        "session_id": session_id,
        "ts": _now_ms(),
        "role": role,   # "user" | "assistant" | "meta"
        "text": text
    })

# --------------------------------------------------------------------
# Daily cap: check and increment per-session request count
# --------------------------------------------------------------------
def _check_limit(session_id):
    if not table:
        return True  # If no memory, skip enforcement

    key = f"{session_id}#{time.strftime('%Y-%m-%d')}"  # composite key (session+date)
    resp = table.get_item(Key={"session_id": key})
    count = resp.get("Item", {}).get("count", 0)

    if count >= MAX_REQUESTS:
        return False  # already hit the daily cap

    # Increment counter
    table.put_item(Item={
        "session_id": key,
        "ts": _now_ms(),
        "role": "meta",
        "text": f"req {count+1}",
        "count": count+1
    })
    return True

# --------------------------------------------------------------------
# Build Anthropic message schema for Bedrock
# --------------------------------------------------------------------
def _build_anthropic_messages(system_prompt, history, user_text):
    messages = []
    # Map chat history into Bedrock/Anthropic format
    for h in history:
        role = "user" if h["role"] == "user" else "assistant"
        messages.append({
            "role": role,
            "content": [{"type": "text", "text": h["text"]}]
        })
    # Current user turn
    messages.append({
        "role": "user",
        "content": [{"type": "text", "text": user_text}]
    })
    return {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 600,       # cap output tokens
        "temperature": 0.7,      # some creativity, not too flat
        "system": system_prompt, # persona injection
        "messages": messages
    }

# --------------------------------------------------------------------
# Lambda entrypoint
# --------------------------------------------------------------------
def handler(event, context):
    # 1) Handle CORS preflight (OPTIONS)
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _resp(200, {"ok": True}, _allowed_origin(event))

    # 2) Parse JSON body safely
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return _resp(400, {"error": "Invalid JSON body"}, _allowed_origin(event))

    # 3) Extract inputs
    user_text  = (body.get("message") or "").strip()
    session_id = (body.get("sessionId") or "").strip() or "anon"
    if not user_text:
        return _resp(400, {"error": "message is required"}, _allowed_origin(event))

    # 4) Enforce daily request limit
    if not _check_limit(session_id):
        return _resp(200, {
            "reply": "Let's talk early tomorrow.", 
            "sessionId": session_id
        }, _allowed_origin(event))

    # 5) Load conversation history if enabled
    history = _load_memory(session_id) if ENABLE_MEMORY else []

    # 6) Build model payload
    payload = _build_anthropic_messages(SYSTEM_PROMPT, history, user_text)

    # 7) Call Bedrock model
    try:
        res = bedrock.invoke_model(
            modelId=MODEL_ID,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(payload).encode("utf-8")
        )
        model_out = json.loads(res.get("body").read().decode("utf-8"))
        parts = model_out.get("content", [])
        reply = ""
        for p in parts:
            if isinstance(p, dict) and p.get("type") == "text":
                reply += p.get("text", "")
    except Exception as e:
        # Fail gracefully, don’t crash the modal UI
        return _resp(500, {"error": "model_error", "detail": str(e)}, _allowed_origin(event))

    # 8) Persist new messages (if memory enabled)
    if ENABLE_MEMORY:
        _save_message(session_id, "user", user_text)
        _save_message(session_id, "assistant", reply)

    # 9) Respond back to frontend
    return _resp(200, {"reply": reply, "sessionId": session_id}, _allowed_origin(event))
