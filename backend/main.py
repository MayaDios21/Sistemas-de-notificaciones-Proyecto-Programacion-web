from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import boto3
import json
import os
from dotenv import load_dotenv
from datetime import datetime

# Cargar variables de entorno
load_dotenv()

# Deshabilitar archivos de configuración de AWS (usar solo .env)
os.environ['AWS_CONFIG_FILE'] = '/dev/null'
os.environ['AWS_SHARED_CREDENTIALS_FILE'] = '/dev/null'

# Crear app FastAPI
app = FastAPI(
    title="Notification System API",
    description="Sistema distribuido de notificaciones con AWS SQS",
    version="1.0.0"
)

# Configurar CORS para permitir requests del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Función para crear cliente SQS (lazy loading)
def get_sqs_client():
    """Crear cliente SQS solo cuando se necesita"""
    return boto3.client(
        'sqs',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        aws_session_token=os.getenv('AWS_SESSION_TOKEN'),  # Para AWS Academy
        region_name=os.getenv('AWS_REGION', 'us-east-1')
    )

# URLs de las colas
QUEUES = {
    'email': os.getenv('EMAIL_QUEUE_URL'),
    'sms': os.getenv('SMS_QUEUE_URL'),
    'push': os.getenv('PUSH_QUEUE_URL')
}

# Modelo de datos
class Notification(BaseModel):
    tipo: str  # email, sms, push
    destinatario: str
    mensaje: str

# Almacenamiento en memoria para tracking (temporal)
notifications_storage = {}

# ==================== ENDPOINTS ====================

@app.get("/")
async def root():
    """Endpoint raíz - verificar que la API está corriendo"""
    return {
        "status": "online",
        "service": "Notification System API",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "send": "/send-notification",
            "stats": "/stats"
        }
    }

@app.get("/health")
async def health():
    """Health check - verificar conexión con SQS"""
    try:
        # Intentar listar colas
        sqs = get_sqs_client()
        response = sqs.list_queues()
        return {
            "status": "healthy",
            "sqs_connection": "ok",
            "queues_configured": list(QUEUES.keys()),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"SQS connection failed: {str(e)}")

@app.post("/send-notification")
async def send_notification(notification: Notification):
    """
    Enviar notificación a la cola correspondiente
    """
    try:
        # Validar tipo de notificación
        if notification.tipo not in QUEUES:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo inválido. Usa: {list(QUEUES.keys())}"
            )
        
        # Obtener URL de la cola
        queue_url = QUEUES[notification.tipo]
        
        if not queue_url:
            raise HTTPException(
                status_code=500,
                detail=f"Cola {notification.tipo} no configurada en .env"
            )
        
        # Crear mensaje
        message_body = {
            'tipo': notification.tipo,
            'destinatario': notification.destinatario,
            'mensaje': notification.mensaje,
            'timestamp': datetime.now().isoformat()
        }
        
        # Enviar a SQS
        sqs = get_sqs_client()
        response = sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(message_body)
        )
        
        # Guardar en storage local (para tracking)
        message_id = response['MessageId']
        notifications_storage[message_id] = {
            **message_body,
            'status': 'pending',
            'message_id': message_id
        }
        
        return {
            "status": "success",
            "message": "Notificación enviada a cola",
            "message_id": message_id,
            "queue": notification.tipo,
            "timestamp": datetime.now().isoformat()
        }
        
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al enviar notificación: {str(e)}"
        )

@app.get("/stats")
async def get_stats():
    """
    Obtener estadísticas del sistema
    """
    total = len(notifications_storage)
    by_type = {
        'email': sum(1 for n in notifications_storage.values() if n['tipo'] == 'email'),
        'sms': sum(1 for n in notifications_storage.values() if n['tipo'] == 'sms'),
        'push': sum(1 for n in notifications_storage.values() if n['tipo'] == 'push')
    }
    
    return {
        "total_notifications": total,
        "by_type": by_type,
        "active_queues": list(QUEUES.keys()),
        "timestamp": datetime.now().isoformat()
    }

@app.get("/notifications")
async def get_notifications():
    """
    Listar todas las notificaciones enviadas
    """
    return {
        "total": len(notifications_storage),
        "notifications": list(notifications_storage.values())
    }

# Ejecutar con: uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
