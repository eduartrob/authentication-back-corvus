import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth.routes';
import folderRoutes from './routes/folder.routes';
import adminRoutes from './routes/admin.routes';
import internalRoutes from './routes/internal.routes';
import universityRoutes from './routes/university.routes';
import careerRoutes from './routes/career.routes';
import finalReviewRoutes from './routes/finalReview.routes';
import professorRoutes from './routes/professor.routes';
import projectRoutes from './routes/project.routes';
import { errorHandler } from './middlewares/error.middleware';

const app = express();

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/', authRoutes);
app.use('/folders', folderRoutes);
app.use('/admin', adminRoutes);
app.use('/internal', internalRoutes);
app.use('/universities', universityRoutes);
app.use('/careers', careerRoutes);
app.use('/final-reviews', finalReviewRoutes);
app.use('/professors', professorRoutes);
app.use('/projects', projectRoutes);

app.use(errorHandler);

export default app;
