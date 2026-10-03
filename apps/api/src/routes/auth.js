"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    res.json({ success: true, data: { token: 'demo-token' } });
});
router.post('/logout', async (req, res) => {
    res.json({ success: true, message: 'Logged out' });
});
exports.default = router;
