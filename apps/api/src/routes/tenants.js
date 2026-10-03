"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("@enterprise-hms/database");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const tenants = await database_1.prisma.tenant.findMany();
        res.json({ success: true, data: tenants });
    }
    catch (err) {
        res.status(500).json({ success: false, error: { message: err.message } });
    }
});
exports.default = router;
