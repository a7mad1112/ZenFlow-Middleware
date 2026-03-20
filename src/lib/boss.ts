import PgBoss from 'pg-boss';
import { config } from '../config/env.js';

/**
 * Global PG-Boss instance
 * Initialized once and reused throughout the application
 */
let bossInstance: PgBoss | null = null;

/**
 * Initialize and get the PG-Boss instance
 * This function ensures only a single instance is created and started
 */
export async function initBoss(): Promise<PgBoss> {
  if (bossInstance) {
    console.log('✅ PG-Boss instance already running, returning existing instance');
    return bossInstance;
  }

  console.log('🔵 Initializing PG-Boss with DATABASE_URL:', config.databaseUrl.substring(0, 50) + '...');

  bossInstance = new PgBoss({
    connectionString: config.databaseUrl,
    max: config.pgBossPoolSize,
    schema: 'pgboss',
    archiveCompletedAfterSeconds: 86400, // Keep completed jobs for 24 hours
  });

  // Attach error handler for internal pg-boss errors
  bossInstance.on('error', (error: Error): void => {
    console.error('🔴 PG-Boss internal error:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  });

  console.log('🔵 Starting PG-Boss queue...');
  
  // Start the queue
  await bossInstance.start();
  
  console.log('✅ PG-Boss started successfully');

  // Give it a moment to fully initialize connections and create tables
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('✅ PG-Boss ready for use');

  return bossInstance;
}

/**
 * Get the PG-Boss instance (must be initialized first)
 */
export function getBoss(): PgBoss {
  if (!bossInstance) {
    throw new Error('PG-Boss not initialized. Call initBoss() first.');
  }
  return bossInstance;
}

/**
 * Stop the PG-Boss instance gracefully
 */
export async function stopBoss(): Promise<void> {
  if (!bossInstance) {
    return;
  }

  try {
    await bossInstance.stop();
    bossInstance = null;
  } catch (error) {
    console.error('🔴 Error stopping PG-Boss:', error);
  }
}

// Export the instance for direct access if needed
export { bossInstance };
