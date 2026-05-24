import boto3
import os
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

print("="*50)
print(" PROBANDO CONEXIÓN CON AWS SQS")
print("="*50)

# Verificar que las variables existen
print("\n1. Verificando variables de entorno...")
aws_key = os.getenv('AWS_ACCESS_KEY_ID')
aws_secret = os.getenv('AWS_SECRET_ACCESS_KEY')
aws_region = os.getenv('AWS_REGION')
email_queue = os.getenv('EMAIL_QUEUE_URL')
session_token = os.getenv('AWS_SESSION_TOKEN')  # Para AWS Academy

if not all([aws_key, aws_secret, aws_region, email_queue]):
    print(" ERROR: Faltan variables de entorno en .env")
    exit(1)

print(f" AWS_ACCESS_KEY_ID: {aws_key[:10]}...")
print(f" AWS_REGION: {aws_region}")
print(f" EMAIL_QUEUE_URL: {email_queue[:50]}...")
if session_token:
    print(f" AWS_SESSION_TOKEN: {session_token[:20]}... (AWS Academy)")

# Crear cliente SQS
print("\n2. Creando cliente SQS...")
try:
    sqs = boto3.client(
        'sqs',
        aws_access_key_id=aws_key,
        aws_secret_access_key=aws_secret,
        aws_session_token=session_token,  # Para AWS Academy
        region_name=aws_region
    )
    print(" Cliente SQS creado")
except Exception as e:
    print(f" Error creando cliente: {e}")
    exit(1)

# Enviar mensaje de prueba
print("\n3. Enviando mensaje de prueba...")
try:
    import json
    response = sqs.send_message(
        QueueUrl=email_queue,
        MessageBody=json.dumps({'test': 'Hello from test script!'})
    )
    print(f" Mensaje enviado! ID: {response['MessageId']}")
except Exception as e:
    print(f" Error enviando mensaje: {e}")
    exit(1)

# Recibir mensaje
print("\n4. Recibiendo mensaje de prueba...")
try:
    response = sqs.receive_message(
        QueueUrl=email_queue,
        MaxNumberOfMessages=1
    )
    
    if 'Messages' in response:
        message = response['Messages'][0]
        print(f" Mensaje recibido: {message['Body']}")
        
        # Eliminar mensaje
        sqs.delete_message(
            QueueUrl=email_queue,
            ReceiptHandle=message['ReceiptHandle']
        )
        print(" Mensaje eliminado de la cola")
    else:
        print("  No hay mensajes en la cola (esto es normal)")
        
except Exception as e:
    print(f" Error recibiendo mensaje: {e}")
    exit(1)

print("\n" + "="*50)
print("✅ ¡TODO FUNCIONÓ! AWS SQS está configurado correctamente")
print("="*50)
