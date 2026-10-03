const fs = require('fs');
let content = fs.readFileSync('packages/database/prisma/schema.prisma', 'utf8');

// Replace CRLF with LF to make string matching work easily
content = content.replace(/\r\n/g, '\n');

content = content.replace(
  '  sessions     Session[]\n\n  @@map("users")',
  '  sessions     Session[]\n\n  patientAlerts    PatientAlert[]\n  patientAllergies PatientAllergy[]\n  encounterNotes   EncounterNote[]\n  vitalRecords     VitalRecord[]\n\n  @@map("users")'
);

content = content.replace(
  '  department     Department? @relation(fields: [departmentId], references: [id])\n\n  @@map("doctors")',
  '  department     Department? @relation(fields: [departmentId], references: [id])\n\n  appointments   Appointment[]\n  queues         Queue[]\n  encounters     Encounter[]\n  prescriptions  Prescription[]\n  investigationOrders InvestigationOrder[]\n  followUps      FollowUp[]\n\n  @@map("doctors")'
);

content = content.replace(
  '  doctors     Doctor[]\n\n  @@map("departments")',
  '  doctors     Doctor[]\n\n  appointments Appointment[]\n  queues       Queue[]\n  encounters   Encounter[]\n\n  @@map("departments")'
);

content = content.replace(
  '  doctors     Doctor[]\n\n  @@map("branches")',
  '  doctors     Doctor[]\n\n  appointments Appointment[]\n  queues       Queue[]\n  encounters   Encounter[]\n\n  @@map("branches")'
);

content = content.replace(
  '  queues            Queue[]\n\n  @@index([tenantId, mrn])',
  '  queues            Queue[]\n  followUps         FollowUp[]\n\n  @@index([tenantId, mrn])'
);

fs.writeFileSync('packages/database/prisma/schema.prisma', content);
