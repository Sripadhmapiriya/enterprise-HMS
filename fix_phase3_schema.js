const fs = require('fs');

const path = 'packages/database/prisma/schema.prisma';
let schema = fs.readFileSync(path, 'utf8');

function addRelations(modelName, relations) {
    const regex = new RegExp(`(model\\s+${modelName}\\s+\\{[\\s\\S]*?)(?:\\n\\s*@@|\\n\\})`, 'g');
    schema = schema.replace(regex, (match, p1) => {
        return p1.trimEnd() + '\n' + relations.map(r => '  ' + r).join('\n') + '\n\n' + match.substring(p1.length);
    });
}

addRelations('Patient', [
    'admissions Admission[]',
    'bedReservations BedReservation[]'
]);

addRelations('Encounter', [
    'admission Admission?',
    'careTeam CareTeam?'
]);

addRelations('Department', [
    'admissions Admission[]',
    'wards Ward[]'
]);

addRelations('Doctor', [
    'admissionsAdmitting Admission[] @relation("AdmittingDoctor")',
    'admissionsAttending Admission[] @relation("AttendingDoctor")',
    'doctorRounds DoctorRound[]',
    'clinicalProcedures ClinicalProcedure[]',
    'inpatientOrders InpatientOrder[]',
    'medicationOrders MedicationOrder[]'
]);

addRelations('Branch', [
    'wards Ward[]'
]);

addRelations('User', [
    'bedAllocations BedAllocation[] @relation("BedAllocatedBy")',
    'bedReleases BedAllocation[] @relation("BedReleasedBy")',
    'bedReservations BedReservation[]',
    'careTeamMembers CareTeamMember[]',
    'nurseAssignments NurseAssignment[]',
    'nursingAssessments NursingAssessment[]',
    'nursingNotes NursingNote[]',
    'intakeOutputRecords IntakeOutputRecord[]',
    'carePlans CarePlan[]',
    'medicationAdministrations MedicationAdministration[]',
    'transfersRequested Transfer[] @relation("TransferRequestedBy")',
    'transfersApproved Transfer[] @relation("TransferApprovedBy")',
    'dischargePlans DischargePlan[]',
    'dischargeSummaries DischargeSummary[]'
]);

fs.writeFileSync(path, schema);
console.log('Schema fixed');
