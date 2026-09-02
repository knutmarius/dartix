import { Router } from 'express';
import { checkPasscode, clearSession, isAuthenticated, setSession } from '../auth.js';
import { sendError } from '../http.js';

export const authRouter = Router();

authRouter.get('/session', (req, res) => {
  res.json({ authenticated: isAuthenticated(req) });
});

authRouter.post('/login', (req, res) => {
  try {
    const passcode = (req.body as Record<string, unknown> | undefined)?.['passcode'];
    if (!checkPasscode(passcode)) {
      res.status(401).json({ error: 'bad_passcode', message: 'That passcode is not right.' });
      return;
    }
    setSession(res);
    res.json({ authenticated: true });
  } catch (err) {
    sendError(res, err);
  }
});

authRouter.post('/logout', (_req, res) => {
  clearSession(res);
  res.json({ authenticated: false });
});
