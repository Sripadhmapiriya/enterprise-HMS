"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("@enterprise-hms/database");
const auth_1 = __importDefault(require("./routes/auth"));
const tenants_1 = __importDefault(require("./routes/tenants"));
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get('/health', async (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.get('/health/database', async (req, res) => {
    try {
        await database_1.prisma.$queryRaw `SELECT 1`;
        res.json({ status: 'ok', database: 'connected' });
    }
    catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected' });
    }
});
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/tenants', tenants_1.default);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: { message: 'Internal Server Error' } });
});
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Enterprise HMS API running on port ${PORT}`);
});
