# Dockerfile — MCP Server base image
# All four MCP servers share this base. Set MCP_SERVER env var to pick server.
FROM node:22-slim

WORKDIR /app

COPY package.json ./
RUN npm install --no-optional

COPY . .

ENV MCP_SERVER=registry

CMD ["sh", "-c", "npx tsx --tsconfig tsconfig.json src/$MCP_SERVER/server.ts"]
