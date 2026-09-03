import { Router } from 'express';
import { checkPasscode, clearSession, sessionRole, setSession } from '../auth.js';
import { sendError } from '../http.js';

export const authRouter = Router();

authRouter.get('/session', (req, res) => {
  const role = sessionRole(req);
  res.json({ authenticated: role !== null, role });
});

authRouter.post('/login', (req, res) => {
  try {
    const passcode = (req.body as Record<string, unknown> | undefined)?.['passcode'];
    const role = checkPasscode(passcode);
    if (role === null) {
      res.status(401).json({ error: 'bad_passcode', message: 'That passcode is not right.' });
      return;
    }
    setSession(res, role);
    res.json({ authenticated: true, role });
  } catch (err) {
    sendError(res, err);
  }
});

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ authenticated: false, role: null });
});
