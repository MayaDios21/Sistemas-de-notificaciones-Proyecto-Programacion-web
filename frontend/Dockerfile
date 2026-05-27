FROM nginx:alpine

# Copiar archivos del frontend
COPY . /usr/share/nginx/html

# Exponer puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
