// ─── src/routes/api.js ───────────────────────────────────────
// Express router – every Onyx Manager telnet command mapped as
// a RESTful JSON endpoint with Swagger documentation.
// ──────────────────────────────────────────────────────────────

const { Router } = require('express');
const log = require('../utils/logger');
const P = require('../utils/parser');

const TAG = 'API';

/**
 * Factory: creates the router and binds it to the given TelnetClient.
 * @param {import('../services/telnet')} telnet
 */
function createRouter(telnet) {
  const router = Router();

  // ── helper ────────────────────────────────────────────────

  /** Wrap an async handler so Express catches rejections. */
  const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

  /** Send a command, return { raw, parsed }. */
  async function exec(cmd, parserFn) {
    log.info(TAG, `Executing telnet command: ${cmd}`);
    const raw = await telnet.send(cmd);
    const parsed = parserFn ? parserFn(raw) : P.parseOk(raw);
    return { raw: P.clean(raw), parsed };
  }

  // ═══════════════════════════════════════════════════════════
  //  CONNECTION / SERVER
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/health:
   *   get:
   *     tags: [Server]
   *     summary: Health check
   *     description: Returns the health of this bridge API and the underlying telnet connection status.
   *     responses:
   *       200:
   *         description: Health report
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 ok:
   *                   type: boolean
   *                 telnetConnected:
   *                   type: boolean
   *                 uptime:
   *                   type: number
   */
  router.get('/health', (req, res) => {
    res.json({
      ok: true,
      telnetConnected: telnet.connected,
      uptime: process.uptime(),
    });
  });

  /**
   * @openapi
   * /api/status:
   *   get:
   *     tags: [Server]
   *     summary: Full Onyx Manager status report
   *     description: |
   *       Returns a comprehensive status report from Onyx Manager including
   *       application version, scheduler state, active cuelists, sunrise/sunset times, and more.
   *     responses:
   *       200:
   *         description: Parsed status report
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/StatusResponse'
   */
  router.get('/status', wrap(async (req, res) => {
    const { raw, parsed } = await exec('Status', P.parseStatus);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/whoami:
   *   get:
   *     tags: [Server]
   *     summary: Get your IP address as seen by Onyx Manager
   *     responses:
   *       200:
   *         description: Your IP address
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     ip:
   *                       type: string
   *                 raw:
   *                   type: string
   */
  router.get('/whoami', wrap(async (req, res) => {
    const { raw, parsed } = await exec('WhoIAm', P.parseWhoIAm);
    res.json({ data: { ip: parsed }, raw });
  }));

  /**
   * @openapi
   * /api/is-onyx-running:
   *   get:
   *     tags: [Server]
   *     summary: Check if Onyx is running
   *     responses:
   *       200:
   *         description: Running state
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: object
   *                   properties:
   *                     running:
   *                       type: boolean
   *                 raw:
   *                   type: string
   */
  router.get('/is-onyx-running', wrap(async (req, res) => {
    const { raw, parsed } = await exec('IsMxRun', P.parseYesNo);
    res.json({ data: { running: parsed }, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  CUELISTS
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/cuelists:
   *   get:
   *     tags: [Cuelists]
   *     summary: List all available cuelists
   *     responses:
   *       200:
   *         description: Array of cuelists
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/NumberedItem'
   *                 raw:
   *                   type: string
   */
  router.get('/cuelists', wrap(async (req, res) => {
    const { raw, parsed } = await exec('QLList', P.parseNumberedList);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/cuelists/active:
   *   get:
   *     tags: [Cuelists]
   *     summary: List currently active cuelists
   *     responses:
   *       200:
   *         description: Array of active cuelists
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/NumberedItem'
   *                 raw:
   *                   type: string
   */
  router.get('/cuelists/active', wrap(async (req, res) => {
    const { raw, parsed } = await exec('QLActive', P.parseActiveCuelists);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/cuelists/{id}/name:
   *   get:
   *     tags: [Cuelists]
   *     summary: Get the name of a cuelist
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cuelist number
   *     responses:
   *       200:
   *         description: Cuelist name
   */
  router.get('/cuelists/:id/name', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`QLName ${req.params.id}`, P.parseName);
    res.json({ data: { id: Number(req.params.id), name: parsed }, raw });
  }));

  /**
   * @openapi
   * /api/cuelists/{id}/is-active:
   *   get:
   *     tags: [Cuelists]
   *     summary: Check if a cuelist is active
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cuelist number
   *     responses:
   *       200:
   *         description: Active state
   */
  router.get('/cuelists/:id/is-active', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`IsQLActive ${req.params.id}`, P.parseYesNo);
    res.json({ data: { id: Number(req.params.id), active: parsed }, raw });
  }));

  /**
   * @openapi
   * /api/cuelists/{id}/go:
   *   post:
   *     tags: [Cuelists]
   *     summary: Go (trigger) a cuelist
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cuelist number
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/cuelists/:id/go', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`GQL ${req.params.id}`, P.parseOk);
    res.json({ data: { id: Number(req.params.id), ...parsed }, raw });
  }));

  /**
   * @openapi
   * /api/cuelists/{id}/go-to/{cue}:
   *   post:
   *     tags: [Cuelists]
   *     summary: Go to a specific cue within a cuelist
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cuelist number
   *       - in: path
   *         name: cue
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cue number
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/cuelists/:id/go-to/:cue', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`GTQ ${req.params.id},${req.params.cue}`, P.parseOk);
    res.json({ data: { cuelistId: Number(req.params.id), cue: Number(req.params.cue), ...parsed }, raw });
  }));

  /**
   * @openapi
   * /api/cuelists/{id}/pause:
   *   post:
   *     tags: [Cuelists]
   *     summary: Pause a cuelist
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cuelist number
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/cuelists/:id/pause', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`PQL ${req.params.id}`, P.parseOk);
    res.json({ data: { id: Number(req.params.id), ...parsed }, raw });
  }));

  /**
   * @openapi
   * /api/cuelists/{id}/release:
   *   post:
   *     tags: [Cuelists]
   *     summary: Release a cuelist
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cuelist number
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/cuelists/:id/release', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`RQL ${req.params.id}`, P.parseOk);
    res.json({ data: { id: Number(req.params.id), ...parsed }, raw });
  }));

  /**
   * @openapi
   * /api/cuelists/{id}/level:
   *   post:
   *     tags: [Cuelists]
   *     summary: Set cuelist level (0–255)
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Cuelist number
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [level]
   *             properties:
   *               level:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 255
   *                 description: Level value (0 = off, 255 = full)
   *     responses:
   *       200:
   *         description: Acknowledgement
   *       400:
   *         description: Invalid level
   */
  router.post('/cuelists/:id/level', wrap(async (req, res) => {
    const level = Number(req.body.level);
    if (isNaN(level) || level < 0 || level > 255) {
      return res.status(400).json({ error: 'level must be an integer between 0 and 255' });
    }
    const { raw, parsed } = await exec(`SetQLLevel ${req.params.id},${level}`, P.parseAck);
    res.json({ data: { id: Number(req.params.id), level, ...parsed }, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  RELEASE ALL
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/release-all:
   *   post:
   *     tags: [Release]
   *     summary: Release all cuelists
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/release-all', wrap(async (req, res) => {
    const { raw, parsed } = await exec('RAQL', P.parseOk);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/release-all-dimmer-first:
   *   post:
   *     tags: [Release]
   *     summary: Release all cuelists – dimmer first
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/release-all-dimmer-first', wrap(async (req, res) => {
    const { raw, parsed } = await exec('RAQLDF', P.parseOk);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/release-all-overrides:
   *   post:
   *     tags: [Release]
   *     summary: Release all overrides
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/release-all-overrides', wrap(async (req, res) => {
    const { raw, parsed } = await exec('RAO', P.parseOk);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/release-all-cuelists-and-overrides:
   *   post:
   *     tags: [Release]
   *     summary: Release all cuelists and overrides
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/release-all-cuelists-and-overrides', wrap(async (req, res) => {
    const { raw, parsed } = await exec('RAQLO', P.parseOk);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/release-all-cuelists-and-overrides-dimmer-first:
   *   post:
   *     tags: [Release]
   *     summary: Release all cuelists and overrides – dimmer first
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/release-all-cuelists-and-overrides-dimmer-first', wrap(async (req, res) => {
    const { raw, parsed } = await exec('RAQLODF', P.parseOk);
    res.json({ data: parsed, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  PROGRAMMER
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/clear:
   *   post:
   *     tags: [Programmer]
   *     summary: Clear + Clear (clear the programmer)
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/clear', wrap(async (req, res) => {
    const { raw, parsed } = await exec('CLRCLR', P.parseOk);
    res.json({ data: parsed, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  ACTION GROUPS
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/actions:
   *   get:
   *     tags: [Actions]
   *     summary: List all action groups
   *     responses:
   *       200:
   *         description: Array of action groups
   */
  router.get('/actions', wrap(async (req, res) => {
    const { raw, parsed } = await exec('ActList', P.parseNumberedList);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/actions/{id}/name:
   *   get:
   *     tags: [Actions]
   *     summary: Get the name of an action group
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Action group number
   *     responses:
   *       200:
   *         description: Action name
   */
  router.get('/actions/:id/name', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`ActName ${req.params.id}`, P.parseName);
    res.json({ data: { id: Number(req.params.id), name: parsed }, raw });
  }));

  /**
   * @openapi
   * /api/actions/{id}/trigger:
   *   post:
   *     tags: [Actions]
   *     summary: Trigger an action group
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Action group number
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/actions/:id/trigger', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`ACT ${req.params.id}`, P.parseOk);
    res.json({ data: { id: Number(req.params.id), ...parsed }, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  COMMANDS
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/commands:
   *   get:
   *     tags: [Commands]
   *     summary: List all internal commands (grouped by section)
   *     responses:
   *       200:
   *         description: Sections with commands
   */
  router.get('/commands', wrap(async (req, res) => {
    const { raw, parsed } = await exec('CmdList', P.parseCommandList);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/commands/{id}/name:
   *   get:
   *     tags: [Commands]
   *     summary: Get the name of a command
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Command number
   *     responses:
   *       200:
   *         description: Command name
   */
  router.get('/commands/:id/name', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`CmdName ${req.params.id}`, P.parseName);
    res.json({ data: { id: Number(req.params.id), name: parsed }, raw });
  }));

  /**
   * @openapi
   * /api/commands/{id}/execute:
   *   post:
   *     tags: [Commands]
   *     summary: Execute an internal command
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Command number
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/commands/:id/execute', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`CMD ${req.params.id}`, P.parseOk);
    res.json({ data: { id: Number(req.params.id), ...parsed }, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  SCHEDULES
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/schedules:
   *   get:
   *     tags: [Schedules]
   *     summary: List all schedules
   *     responses:
   *       200:
   *         description: Array of schedules
   */
  router.get('/schedules', wrap(async (req, res) => {
    const { raw, parsed } = await exec('SchList', P.parseNumberedList);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/schedules/{id}/name:
   *   get:
   *     tags: [Schedules]
   *     summary: Get the name of a schedule
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Schedule number
   *     responses:
   *       200:
   *         description: Schedule name
   */
  router.get('/schedules/:id/name', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`SchName ${req.params.id}`, P.parseName);
    res.json({ data: { id: Number(req.params.id), name: parsed }, raw });
  }));

  /**
   * @openapi
   * /api/schedules/{id}/go:
   *   post:
   *     tags: [Schedules]
   *     summary: Activate a schedule (set as default)
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Schedule number
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/schedules/:id/go', wrap(async (req, res) => {
    const { raw, parsed } = await exec(`GSC ${req.params.id}`, P.parseOk);
    res.json({ data: { id: Number(req.params.id), ...parsed }, raw });
  }));

  /**
   * @openapi
   * /api/schedules/use-calendar:
   *   post:
   *     tags: [Schedules]
   *     summary: Return scheduler to calendar rules
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.post('/schedules/use-calendar', wrap(async (req, res) => {
    const { raw, parsed } = await exec('SchUseCalendar', P.parseOk);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/scheduler/is-running:
   *   get:
   *     tags: [Schedules]
   *     summary: Check if the scheduler is running
   *     responses:
   *       200:
   *         description: Running state
   */
  router.get('/scheduler/is-running', wrap(async (req, res) => {
    const { raw, parsed } = await exec('IsSchRun', P.parseYesNo);
    res.json({ data: { running: parsed }, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  TIME PRESETS
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/time-presets:
   *   get:
   *     tags: [Time Presets]
   *     summary: List all time presets
   *     responses:
   *       200:
   *         description: Array of time presets
   */
  router.get('/time-presets', wrap(async (req, res) => {
    const { raw, parsed } = await exec('TimePresetList', P.parseTimePresetList);
    res.json({ data: parsed, raw });
  }));

  /**
   * @openapi
   * /api/time-presets/{id}:
   *   put:
   *     tags: [Time Presets]
   *     summary: Set a time preset
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: Time preset number
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [hour, minute, second]
   *             properties:
   *               hour:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 23
   *               minute:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 59
   *               second:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 59
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.put('/time-presets/:id', wrap(async (req, res) => {
    const { hour, minute, second } = req.body;
    const { raw, parsed } = await exec(`SetTimepreset ${req.params.id},${hour},${minute},${second}`, P.parseAck);
    res.json({ data: { id: Number(req.params.id), hour, minute, second, ...parsed }, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  SYSTEM SETTINGS
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/system/date:
   *   put:
   *     tags: [System]
   *     summary: Set the remote computer date
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [year, month, day]
   *             properties:
   *               year:
   *                 type: integer
   *                 example: 2026
   *               month:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 12
   *               day:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 31
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.put('/system/date', wrap(async (req, res) => {
    const { year, month, day } = req.body;
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const { raw, parsed } = await exec(`SetDate ${year},${mm},${dd}`, P.parseAck);
    res.json({ data: { year, month, day, ...parsed }, raw });
  }));

  /**
   * @openapi
   * /api/system/time:
   *   put:
   *     tags: [System]
   *     summary: Set the remote computer time (24-hour format)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [hour, minute, second]
   *             properties:
   *               hour:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 23
   *               minute:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 59
   *               second:
   *                 type: integer
   *                 minimum: 0
   *                 maximum: 59
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.put('/system/time', wrap(async (req, res) => {
    const { hour, minute, second } = req.body;
    const { raw, parsed } = await exec(`SetTime ${hour},${minute},${second}`, P.parseAck);
    res.json({ data: { hour, minute, second, ...parsed }, raw });
  }));

  /**
   * @openapi
   * /api/system/position/decimal:
   *   put:
   *     tags: [System]
   *     summary: Set geographical position (decimal)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [latitude, latDirection, longitude, lngDirection]
   *             properties:
   *               latitude:
   *                 type: number
   *                 example: 45.5
   *               latDirection:
   *                 type: string
   *                 enum: [N, S]
   *               longitude:
   *                 type: number
   *                 example: 34.3
   *               lngDirection:
   *                 type: string
   *                 enum: [E, W]
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.put('/system/position/decimal', wrap(async (req, res) => {
    const { latitude, latDirection, longitude, lngDirection } = req.body;
    const { raw, parsed } = await exec(`SetPosDec ${latitude},${latDirection},${longitude},${lngDirection}`, P.parseAck);
    res.json({ data: { latitude, latDirection, longitude, lngDirection, ...parsed }, raw });
  }));

  /**
   * @openapi
   * /api/system/position/dms:
   *   put:
   *     tags: [System]
   *     summary: Set geographical position (degrees/minutes/seconds)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [latDeg, latMin, latSec, latDirection, lngDeg, lngMin, lngSec, lngDirection]
   *             properties:
   *               latDeg:
   *                 type: integer
   *               latMin:
   *                 type: integer
   *               latSec:
   *                 type: integer
   *               latDirection:
   *                 type: string
   *                 enum: [N, S]
   *               lngDeg:
   *                 type: integer
   *               lngMin:
   *                 type: integer
   *               lngSec:
   *                 type: integer
   *               lngDirection:
   *                 type: string
   *                 enum: [E, W]
   *     responses:
   *       200:
   *         description: Acknowledgement
   */
  router.put('/system/position/dms', wrap(async (req, res) => {
    const { latDeg, latMin, latSec, latDirection, lngDeg, lngMin, lngSec, lngDirection } = req.body;
    const { raw, parsed } = await exec(
      `SetPosDMS ${latDeg},${latMin},${latSec},${latDirection},${lngDeg},${lngMin},${lngSec},${lngDirection}`,
      P.parseAck,
    );
    res.json({ data: req.body, ...parsed, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  LOGS
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/logs:
   *   get:
   *     tags: [Logs]
   *     summary: Get recent log lines
   *     parameters:
   *       - in: query
   *         name: lines
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 300
   *           default: 20
   *         description: Number of log lines to retrieve (max 300)
   *     responses:
   *       200:
   *         description: Array of log lines
   */
  router.get('/logs', wrap(async (req, res) => {
    const lines = Math.min(Math.max(Number(req.query.lines) || 20, 1), 300);
    const { raw, parsed } = await exec(`LastLog ${lines}`, P.parseLastLog);
    res.json({ data: parsed, raw });
  }));

  // ═══════════════════════════════════════════════════════════
  //  RAW COMMAND (escape hatch)
  // ═══════════════════════════════════════════════════════════

  /**
   * @openapi
   * /api/raw:
   *   post:
   *     tags: [Advanced]
   *     summary: Send a raw telnet command
   *     description: |
   *       Escape hatch for any telnet command not covered by the REST endpoints.
   *       The raw response text is returned alongside a best-effort parse.
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [command]
   *             properties:
   *               command:
   *                 type: string
   *                 example: "Status"
   *     responses:
   *       200:
   *         description: Raw response
   */
  router.post('/raw', wrap(async (req, res) => {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'command is required' });
    const { raw, parsed } = await exec(command, null);
    res.json({ data: parsed, raw });
  }));

  // ── Global error handler ──────────────────────────────────

  router.use((err, _req, res, _next) => {
    log.error(TAG, err.message);
    res.status(502).json({
      error: 'Telnet communication error',
      message: err.message,
    });
  });

  return router;
}

module.exports = createRouter;
