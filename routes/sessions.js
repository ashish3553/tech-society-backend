// routes/sessions.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authorize = require('../middleware/authorize'); // if you need role checks
const Session = require('../models/Session');          // <<— IMPORT, don't define
const Assignment = require('../models/Assignment');

router.use(auth);

// Start a session
router.post('/start', async (req, res, next) => {
  try {
    const { assignmentId } = req.body;
    const userId = req.user.id;

    if (!assignmentId) {
      return res.status(400).json({ success: false, message: 'assignmentId is required' });
    }

    // If already active, return it
    const existing = await Session.findActiveSession(userId, assignmentId);
    if (existing) {
      return res.json({ success: true, data: existing });
    }

    const assignment = await Assignment.findById(assignmentId).select('mode timeLimitMinutes');
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }
    if (!['quiz', 'test'].includes(assignment.mode)) {
      return res.status(400).json({ success: false, message: 'Sessions are only for quiz/test' });
    }

    const now = new Date();
    const durationMs = Math.max(1, assignment.timeLimitMinutes || 0) * 60 * 1000;
    const expiresAt = new Date(now.getTime() + durationMs);

    const session = await Session.create({
      student: userId,
      assignment: assignmentId,
      startedAt: now,
      expiresAt,
      timeRemaining: Math.max(0, expiresAt - now),
      isActive: true,
      autoSubmitted: false,
      lastHeartbeat: now,
    });

    res.status(201).json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

// Heartbeat (refresh remaining time)
router.post('/:id/heartbeat', async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (String(session.student) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    if (session.isExpired()) {
      session.isActive = false;
      session.timeRemaining = 0;
    } else {
      session.lastHeartbeat = new Date();
      session.timeRemaining = session.getRemainingTime();
    }

    await session.save();
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

// End session (manual finish)
router.post('/:id/end', async (req, res, next) => {
  try {
    const { id } = req.params;
    const session = await Session.findById(id);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }
    if (String(session.student) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    session.isActive = false;
    session.timeRemaining = Math.max(0, session.getRemainingTime());
    await session.save();

    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
});

// Get active session for the logged-in user + assignment
router.get('/active', async (req, res, next) => {
  try {
    const { assignmentId } = req.query;
    if (!assignmentId) {
      return res.status(400).json({ success: false, message: 'assignmentId is required' });
    }
    const s = await Session.findActiveSession(req.user.id, assignmentId);
    res.json({ success: true, data: s || null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
