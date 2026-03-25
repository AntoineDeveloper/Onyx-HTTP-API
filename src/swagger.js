// ─── src/swagger.js ──────────────────────────────────────────
// swagger-jsdoc + swagger-ui-express configuration.
// Annotations live in the route files and are auto-discovered.
// ──────────────────────────────────────────────────────────────

const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Onyx HTTP API',
      version: '1.0.0',
      description:
        'REST / JSON bridge for **Obsidian Onyx** lighting software.\n\n' +
        'This API talks to the Onyx Manager telnet interface and exposes every ' +
        'command as a clean HTTP endpoint with structured JSON responses.\n\n' +
        'Every response includes a `raw` field with the original telnet output ' +
        'for debugging purposes.',
      license: { name: 'MIT' },
    },
    servers: [
      {
        url: `http://localhost:${process.env.HTTP_PORT || 8000}`,
        description: 'Local development',
      },
    ],
    tags: [
      { name: 'Server',       description: 'Health, status, and connection info' },
      { name: 'Cuelists',     description: 'List, trigger, pause, release, and control cuelists' },
      { name: 'Release',      description: 'Bulk release operations' },
      { name: 'Programmer',   description: 'Programmer controls (Clear)' },
      { name: 'Actions',      description: 'Action groups' },
      { name: 'Commands',     description: 'Internal Onyx Manager commands' },
      { name: 'Schedules',    description: 'Schedule management' },
      { name: 'Time Presets', description: 'Time preset configuration' },
      { name: 'System',       description: 'Date, time, and position settings' },
      { name: 'Logs',         description: 'Log retrieval' },
      { name: 'Advanced',     description: 'Raw command passthrough' },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Optional – only required when AUTH_ENABLED=true',
        },
      },
      schemas: {
        NumberedItem: {
          type: 'object',
          properties: {
            id:   { type: 'integer', example: 42 },
            name: { type: 'string', example: 'SPOTS AVANT ON' },
          },
        },
        StatusResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                onyxManagerId:       { type: 'string' },
                date:                { type: 'string' },
                time:                { type: 'string' },
                appVersion:          { type: 'string' },
                appStartedOn:        { type: 'string' },
                appRunningFor:       { type: 'string' },
                commandsSent:        { type: 'integer' },
                sunset:              { type: 'string' },
                sunrise:             { type: 'string' },
                timezone:            { type: 'string' },
                position:            { type: 'string' },
                location:            { type: 'string' },
                currentTime:         { type: 'string' },
                currentScheduleName: { type: 'string' },
                currentScheduleNo:   { type: 'integer' },
                currentEvent:        { type: 'integer' },
                schedulerRunning:    { type: 'boolean' },
                onyxRunning:         { type: 'boolean' },
                onyxVersion:         { type: 'string' },
                activeCuelists: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/NumberedItem' },
                },
                clientIp: { type: 'string' },
              },
            },
            raw: { type: 'string' },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
