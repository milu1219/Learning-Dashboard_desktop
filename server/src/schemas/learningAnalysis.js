const { z } = require('zod');

const learningAnalysisSchema = z.object({
  session_title: z.string().trim().min(3).max(160),
  session_description: z.string().trim().min(10).max(600),
  summary: z.string().trim().min(1).max(2000),
  topics: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    importance: z.enum(['low', 'medium', 'high'])
  })).max(10),
  learning_tasks: z.array(z.object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(1000),
    type: z.enum(['study', 'practice', 'review']),
    priority: z.enum(['low', 'medium', 'high']),
    estimated_minutes: z.number().int().min(5).max(480)
  })).max(12)
});

const geminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    session_title: { type: 'STRING', description: 'A concise, specific learning session title. Never use generic titles.' },
    session_description: { type: 'STRING', description: 'A specific one or two sentence description of what this session covers.' },
    summary: { type: 'STRING' },
    topics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          description: { type: 'STRING' },
          importance: { type: 'STRING', enum: ['low', 'medium', 'high'] }
        },
        required: ['name', 'description', 'importance']
      }
    },
    learning_tasks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          type: { type: 'STRING', enum: ['study', 'practice', 'review'] },
          priority: { type: 'STRING', enum: ['low', 'medium', 'high'] },
          estimated_minutes: { type: 'INTEGER' }
        },
        required: ['title', 'description', 'type', 'priority', 'estimated_minutes']
      }
    }
  },
  required: ['session_title', 'session_description', 'summary', 'topics', 'learning_tasks']
};

module.exports = { learningAnalysisSchema, geminiResponseSchema };
