import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import logger from './utils/logger';
import prisma from './utils/prisma';
import { rabbitmqService } from './services/rabbitmq.service';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // Validar conexión a la BD
    await prisma.$connect();
    logger.info('Connected to the database successfully.');

    // Conectar a RabbitMQ
    await rabbitmqService.connect();

    app.listen(PORT, () => {
      logger.info(`Authentication Service running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
