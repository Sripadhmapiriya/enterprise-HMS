import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { verifyLicense, SignedLicense } from '@enterprise-hms/modules';

const router = Router();

router.use(authenticateToken);

// GET /api/v1/licensing/status
router.get('/status', async (req, res, next) => {
  try {
    const tenantId = req.tenantId!;

    const setting = await req.prismaTenant.systemSetting.findFirst({
      where: { tenantId, key: 'license_signed_json' },
    });

    if (!setting || !setting.value) {
      return res.json({
        success: true,
        data: {
          isValid: false,
          isExpired: false,
          inGracePeriod: false,
          isReadOnly: true,
          daysRemaining: 0,
          error: 'NO_LICENSE_INSTALLED',
          message: 'No license installed for this tenant. System is running in read-only mode for safety.',
        },
      });
    }

    const signedLicense: SignedLicense = JSON.parse(setting.value);
    const verification = verifyLicense(signedLicense);

    res.json({
      success: true,
      data: {
        ...verification,
        clientId: signedLicense.payload.clientId,
        clientName: signedLicense.payload.clientName,
        modules: signedLicense.payload.modules,
        limits: signedLicense.payload.limits,
        issuedAt: signedLicense.payload.issuedAt,
        expiresAt: signedLicense.payload.expiresAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
