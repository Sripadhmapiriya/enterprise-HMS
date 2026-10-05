#!/usr/bin/env tsx
import fs from 'fs';
import path from 'path';
import {
  generateEd25519KeyPair,
  issueLicense,
  LicensePayload,
  EDITION_PRESETS,
  ModuleResolver,
} from '@enterprise-hms/modules';

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i++;
      } else {
        options[key] = 'true';
      }
    }
  }
  return options;
}

async function main() {
  const options = parseArgs();
  const client = options['client'] || 'Demo Hospital';
  const clientId = options['client-id'] || client.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const presetId = options['preset'];
  const modulesArg = options['modules'];
  const expiresInDays = parseInt(options['expires-in-days'] || '365', 10);
  const keyPath = options['key-path'];
  const outPath = options['out'];

  const resolver = new ModuleResolver();
  let requestedModules: string[] = [];

  if (presetId) {
    const preset = EDITION_PRESETS[presetId];
    if (!preset) {
      console.error(`Unknown preset "${presetId}". Available presets: ${Object.keys(EDITION_PRESETS).join(', ')}`);
      process.exit(1);
    }
    requestedModules = preset.modules;
  } else if (modulesArg) {
    requestedModules = modulesArg.split(',').map((m) => m.trim());
  } else {
    requestedModules = EDITION_PRESETS['patients-only'].modules;
  }

  const { enabled: resolvedModules } = resolver.resolveDependencies(requestedModules);

  let privateKeyPem: string;
  let publicKeyPem: string;

  if (keyPath && fs.existsSync(keyPath)) {
    privateKeyPem = fs.readFileSync(keyPath, 'utf8');
    const pubPath = `${keyPath}.pub`;
    if (fs.existsSync(pubPath)) {
      publicKeyPem = fs.readFileSync(pubPath, 'utf8');
    } else {
      console.warn('Public key file not found next to private key, deriving from fresh keypair is recommended.');
      publicKeyPem = '';
    }
  } else {
    // Generate new keypair
    const pair = generateEd25519KeyPair();
    privateKeyPem = pair.privateKey;
    publicKeyPem = pair.publicKey;

    if (keyPath) {
      fs.mkdirSync(path.dirname(path.resolve(keyPath)), { recursive: true });
      fs.writeFileSync(keyPath, privateKeyPem, 'utf8');
      fs.writeFileSync(`${keyPath}.pub`, publicKeyPem, 'utf8');
      console.log(`Saved new Ed25519 keypair to ${keyPath} and ${keyPath}.pub`);
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);

  const payload: LicensePayload = {
    clientId,
    clientName: client,
    modules: resolvedModules,
    limits: {
      maxUsers: options['max-users'] ? parseInt(options['max-users'], 10) : 100,
      maxBeds: options['max-beds'] ? parseInt(options['max-beds'], 10) : 50,
      maxHospitals: options['max-hospitals'] ? parseInt(options['max-hospitals'], 10) : 1,
    },
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    gracePeriodDays: 14,
  };

  const signed = issueLicense(payload, privateKeyPem, publicKeyPem);

  const serialized = JSON.stringify(signed, null, 2);

  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, serialized, 'utf8');
    console.log(`License written to ${outPath}`);
  }

  console.log('\n=== Issued Ed25519 HMS License ===');
  console.log(`Client:    ${signed.payload.clientName} (${signed.payload.clientId})`);
  console.log(`Modules:   ${signed.payload.modules.join(', ')}`);
  console.log(`Issued:    ${signed.payload.issuedAt}`);
  console.log(`Expires:   ${signed.payload.expiresAt}`);
  console.log(`Signature: ${signed.signature.slice(0, 32)}... (base64)`);
  console.log('===================================\n');

  return signed;
}

if (require.main === module || process.argv[1]?.includes('issue-license')) {
  main().catch((err) => {
    console.error('Failed to issue license:', err);
    process.exit(1);
  });
}
