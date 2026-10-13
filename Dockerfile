FROM node:20-alpine

# Instalação do aria2 para download turbo multi-threaded
RUN apk add --no-cache aria2

WORKDIR /app

# Copiar dependências
COPY package.json ./

# Instalar dependências
RUN npm install

# Copiar código-fonte
COPY . .

# Compilar frontend React (Vite)
RUN npm run build

# Permissões completas para o ambiente do Hugging Face Spaces
RUN chmod -R 777 /app /tmp

# Porta padrão do Hugging Face Spaces é 7860 (compatível também com Render/Railway via PORT)
ENV PORT=7860
EXPOSE 7860

# Iniciar servidor
CMD ["npm", "start"]
