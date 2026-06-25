import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import folderRoutes from './routes/folder.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/', authRoutes);
app.use('/folders', folderRoutes);

// Manejo de Errores Global
app.use(errorHandler);

export default app;
