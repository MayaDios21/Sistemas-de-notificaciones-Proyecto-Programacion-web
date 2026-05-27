FROM python:3.12-slim

WORKDIR /app

# Copiar requirements
COPY requirements.txt .

# Instalar dependencias
RUN pip install --no-cache-dir -r requirements.txt

# Copiar workers
COPY . .

# Por defecto corre worker_email
# Se sobreescribe en docker-compose con 'command'
CMD ["python", "worker_email.py"]
