FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm install --workspaces --include-workspace-root || npm install
COPY backend ./backend
RUN npm run build -w backend
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "backend"]
