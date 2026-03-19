# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies (including devDependencies for build)
# Install tsx and typescript explicitly to ensure they're available
RUN npm install && npm install --save-dev tsx typescript

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build TypeScript to dist folder
RUN npm run build

# Verify dist folder was created
RUN test -d dist || (echo "Build failed: dist folder not created" && exit 1)

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init
RUN apk add --no-cache dumb-init

# Copy package files
COPY package*.json ./

# Copy prisma schema (needed for Prisma Client generation)
COPY prisma ./prisma/

# Install only production dependencies
RUN npm install --production

# Generate Prisma Client in production (needed for runtime)
RUN npx prisma generate

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run compiled JavaScript directly (NOT tsx or npm run dev)
CMD ["node", "dist/index.js"]
