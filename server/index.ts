import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import companiesRouter from './routes/companies';
import opportunitiesRouter from './routes/opportunities';
import candidatesRouter from './routes/candidates';
import matchesRouter from './routes/matches';
import introductionsRouter from './routes/introductions';
import { expiryMiddleware } from './services/expiry';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Expiry check middleware (runs on every request)
app.use(expiryMiddleware);

// Serve uploaded files
app.use('/uploads', express.static(path.resolve('./server/uploads')));

// API Routes
app.use('/api/companies', companiesRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/candidates', candidatesRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/introductions', introductionsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`VC Talent Match server running on http://localhost:${PORT}`);
});

export default app;
