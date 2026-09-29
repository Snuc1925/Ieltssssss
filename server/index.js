import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import writingFixRoutes from './modules/writing-fix/routes.js';
import writingTask2Routes from './modules/writing-task2/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/writing-fix', writingFixRoutes);
app.use('/api/writing-task2', writingTask2Routes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Loi khong xac dinh tu server' });
});

app.listen(PORT, () => {
  console.log(`Chatbot sua loi dien dat dang chay tai http://localhost:${PORT}`);
});
