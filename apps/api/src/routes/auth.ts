import { Router } from 'express';
const router = Router();

router.post('/login', async (req, res) => {
  res.json({ success: true, data: { token: 'demo-token' } });
});

router.post('/logout', async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

export default router;
