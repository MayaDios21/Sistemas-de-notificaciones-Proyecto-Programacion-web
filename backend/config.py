import os
from dotenv import load_dotenv

load_dotenv()

AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')

EMAIL_QUEUE_URL = os.getenv('EMAIL_QUEUE_URL')
SMS_QUEUE_URL = os.getenv('SMS_QUEUE_URL')
PUSH_QUEUE_URL = os.getenv('PUSH_QUEUE_URL')
