import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import folderRoutes from './routes/folder.routes';
import adminRoutes from './routes/admin.routes';
import internalRoutes from './routes/internal.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas públicas
app.use('/', authRoutes);
app.use('/folders', folderRoutes);
app.use('/admin', adminRoutes);

// Rutas internas (solo accesibles desde la red Docker interna, no expuestas al Gateway)
app.use('/internal', internalRoutes);

// Manejo de Errores Global
app.use(errorHandler);

export default app;
