const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const { z } = require('zod');
const { analyzeTranscript } = require('./services/geminiService');

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT) || 5000;
const MOCK_MODE = process.env.MOCK_EXTERNAL_APIS === 'true';

const createSessionSchema = z.object({
  title: z.string().trim().min(1, 'Session title is required.').max(160).optional(),
  subject: z.string().trim().min(1, 'Subject is required.'),
  topic: z.string().trim().min(1, 'Topic is required.'),
  transcript: z.string().trim().min(1, 'Transcript is required.'),
  notes: z.string().optional(),
  learningDate: z.string().optional()
});

const analyzeTranscriptSchema = z.object({
  subject: z.string().trim().max(120).optional().default('General Learning'),
  transcript: z.string().trim().min(20, 'Transcript must contain at least 20 characters.').max(100_000)
});

const updateSessionSchema = z.object({
  title: z.string().trim().min(1, 'Session title is required.').max(160),
  description: z.string().trim().max(600).optional().default(''),
  subject: z.string().trim().min(1, 'Subject is required.').max(120),
  transcript: z.string().trim().min(1, 'Transcript is required.').max(100_000)
});

const taskFieldsSchema = z.object({
  title: z.string().trim().min(1, 'Task title is required.').max(160),
  description: z.string().trim().max(1000).optional().default(''),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  durationMinutes: z.number().int().min(5).max(480).default(30)
});
const createTaskSchema = taskFieldsSchema.extend({ sessionId: z.string().uuid('Invalid session ID.') });

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', mockMode: MOCK_MODE, timestamp: new Date().toISOString() });
});

app.get('/api/sessions', async (_req, res) => {
  try {
    const sessions = await prisma.learningSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: { tasks: true }
    });
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.post('/api/learning-sessions', async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid learning session.', details: parsed.error.flatten() });
  }

  try {
    const { title, subject, topic, transcript, notes } = parsed.data;
    const session = await prisma.learningSession.create({
      data: { title: title || topic, subject, topic, transcript, notes: notes || '', status: 'DRAFT' }
    });
    return res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    return res.status(500).json({ error: 'Failed to create learning session' });
  }
});

app.get('/api/learning-sessions/:id', async (req, res) => {
  try {
    const session = await prisma.learningSession.findUnique({
      where: { id: req.params.id },
      include: { tasks: { orderBy: { createdAt: 'desc' } } }
    });
    if (!session) return res.status(404).json({ error: 'Learning session not found.' });
    return res.json(session);
  } catch (error) {
    console.error('Error fetching learning session:', error);
    return res.status(500).json({ error: 'Failed to fetch learning session.' });
  }
});

app.patch('/api/learning-sessions/:id', async (req, res) => {
  const parsed = updateSessionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid learning session.', details: parsed.error.flatten() });
  try {
    const session = await prisma.learningSession.update({ where: { id: req.params.id }, data: parsed.data, include: { tasks: true } });
    return res.json(session);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Learning session not found.' });
    console.error('Error updating learning session:', error);
    return res.status(500).json({ error: 'Failed to update learning session.' });
  }
});

app.delete('/api/learning-sessions/:id', async (req, res) => {
  try {
    await prisma.learningSession.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Learning session not found.' });
    console.error('Error deleting learning session:', error);
    return res.status(500).json({ error: 'Failed to delete learning session.' });
  }
});

app.post('/api/ai/analyze-transcript', async (req, res) => {
  const parsed = analyzeTranscriptSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid transcript.', details: parsed.error.flatten() });
  }

  try {
    const analysis = await analyzeTranscript(parsed.data.transcript);
    const session = await prisma.$transaction(async (tx) => tx.learningSession.create({
      data: {
        title: analysis.session_title,
        description: analysis.session_description,
        subject: parsed.data.subject,
        topic: analysis.summary.slice(0, 160),
        transcript: parsed.data.transcript,
        geminiAnalysis: analysis,
        status: 'ANALYZED',
        tasks: {
          create: analysis.learning_tasks.map((task) => ({
            title: task.title,
            description: task.description,
            durationMinutes: task.estimated_minutes,
            priority: task.priority.toUpperCase()
          }))
        }
      },
      include: { tasks: true }
    }));
    return res.status(201).json({ session, analysis });
  } catch (error) {
    console.error('Transcript analysis failed:', { code: error.code, message: error.message, detail: error.detail });
    if (error.code === 'GEMINI_NOT_CONFIGURED') return res.status(503).json({ error: 'Gemini API is not configured.' });
    if (error.code === 'GEMINI_TIMEOUT') return res.status(504).json({ error: 'Gemini analysis timed out.' });
    if (error.code === 'GEMINI_REQUEST_FAILED') return res.status(502).json({ error: 'Gemini analysis request failed.' });
    if (error instanceof z.ZodError || error instanceof SyntaxError || error.code === 'GEMINI_INVALID_RESPONSE') {
      return res.status(502).json({ error: 'Gemini returned an invalid analysis response.' });
    }
    return res.status(500).json({ error: 'Failed to analyze transcript.' });
  }
});

app.post('/api/tasks', async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid learning task.', details: parsed.error.flatten() });
  try {
    const { sessionId, ...taskData } = parsed.data;
    const task = await prisma.learningTask.create({ data: { sessionId, ...taskData } });
    return res.status(201).json(task);
  } catch (error) {
    if (error.code === 'P2003') return res.status(404).json({ error: 'Learning session not found.' });
    console.error('Error creating learning task:', error);
    return res.status(500).json({ error: 'Failed to create learning task.' });
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  const parsed = taskFieldsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid learning task.', details: parsed.error.flatten() });
  try {
    const task = await prisma.learningTask.update({ where: { id: req.params.id }, data: parsed.data });
    return res.json(task);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Learning task not found.' });
    console.error('Error updating learning task:', error);
    return res.status(500).json({ error: 'Failed to update learning task.' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await prisma.learningTask.delete({ where: { id: req.params.id } });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Learning task not found.' });
    console.error('Error deleting learning task:', error);
    return res.status(500).json({ error: 'Failed to delete learning task.' });
  }
});

app.get('/api/tasks', async (_req, res) => {
  try {
    const tasks = await prisma.learningTask.findMany({
      include: { session: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (Mock Mode: ${MOCK_MODE})`);
});

async function shutdown() {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
