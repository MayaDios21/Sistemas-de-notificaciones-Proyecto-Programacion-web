import boto3
import json
import time
import os
from dotenv import load_dotenv
from datetime import datetime

# Cargar variables de entorno
load_dotenv(dotenv_path="../.env")
load_dotenv(dotenv_path="../.env")

# Deshabilitar archivos de configuración de AWS (usar solo .env)
os.environ['AWS_CONFIG_FILE'] = '/dev/null'
os.environ['AWS_SHARED_CREDENTIALS_FILE'] = '/dev/null'

print("="*60)
print(" WORKER EMAIL - INICIADO")
print("="*60)

# Cliente SQS
sqs = boto3.client(
    'sqs',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    aws_session_token=os.getenv('AWS_SESSION_TOKEN'),
    region_name=os.getenv('AWS_REGION', 'us-east-1')
)

QUEUE_URL = os.getenv('EMAIL_QUEUE_URL')

if not QUEUE_URL:
    print(" ERROR: EMAIL_QUEUE_URL no está configurado en .env")
    exit(1)

print(f" Escuchando cola: {QUEUE_URL}")
print(f" Iniciado: {datetime.now().isoformat()}")
print("-"*60)

# Contador de mensajes procesados
messages_processed = 0

while True:
    try:
        # Recibir mensajes de la cola (long polling)
        response = sqs.receive_message(
            QueueUrl=QUEUE_URL,
            MaxNumberOfMessages=1,
            WaitTimeSeconds=10,  # Long polling de 10 segundos
            MessageAttributeNames=['All']
        )
        
        if 'Messages' in response:
            for message in response['Messages']:
                messages_processed += 1
                
                # Parsear el cuerpo del mensaje
                try:
                    body = json.loads(message['Body'])
                except json.JSONDecodeError:
                    body = {'raw': message['Body']}
                
                print(f"\n{'='*60}")
                print(f" MENSAJE #{messages_processed} RECIBIDO")
                print(f"{'='*60}")
                print(f" Timestamp: {datetime.now().isoformat()}")
                print(f" Message ID: {message['MessageId']}")
                print(f" Destinatario: {body.get('destinatario', 'N/A')}")
                print(f" Mensaje: {body.get('mensaje', 'N/A')}")
                print(f" Tipo: {body.get('tipo', 'N/A')}")
                
                # Simular procesamiento (envío de email)
                print(f"\n Procesando envío de email...")
                time.sleep(3)  # Simular latencia de SMTP
                
                print(f"✅ Email enviado exitosamente!")
                
                # Eliminar mensaje de la cola (acknowledge)
                sqs.delete_message(
                    QueueUrl=QUEUE_URL,
                    ReceiptHandle=message['ReceiptHandle']
                )
                
                print(f"  Mensaje eliminado de la cola")
                print(f" Total procesados: {messages_processed}")
                print(f"{'='*60}\n")
        
        else:
            # No hay mensajes - mostrar heartbeat cada 30 segundos
            print(".", end="", flush=True)
            time.sleep(2)
            
    except KeyboardInterrupt:
        print("\n\n Worker detenido por usuario")
        print(f" Total mensajes procesados: {messages_processed}")
        break
        
    except Exception as e:
        print(f"\n ERROR: {e}")
        print(" Reintentando en 5 segundos...")
        time.sleep(5)
