import { PrismaClient } from '@prisma/client';

export interface SeedDemoContext {
  tenant: { id: string };
  hospital: { id: string };
  branch: { id: string };
  eastBranch?: { id: string };
  userMap: Record<string, any>;
  doctorUser: { id: string };
  nurseUser: { id: string };
  doctor: { id: string };
  cardiologyDept?: { id: string };
  erDept?: { id: string };
}

const DEMO_PATIENTS = [
  { first: 'Aarav', last: 'Patel', gender: 'MALE', dob: '1985-04-12', blood: 'O+', phone: '+91-9820011001', city: 'Mumbai', allergy: 'Penicillin', alert: 'Penicillin Allergy' },
  { first: 'Aditi', last: 'Sharma', gender: 'FEMALE', dob: '1992-08-23', blood: 'A+', phone: '+91-9820011002', city: 'Pune', allergy: 'Sulfa Drugs', alert: 'Fall Risk' },
  { first: 'Rohan', last: 'Verma', gender: 'MALE', dob: '1978-11-05', blood: 'B+', phone: '+91-9820011003', city: 'Delhi', allergy: 'None', alert: 'Hypertensive' },
  { first: 'Priya', last: 'Nair', gender: 'FEMALE', dob: '1995-02-17', blood: 'AB+', phone: '+91-9820011004', city: 'Bengaluru', allergy: 'Aspirin', alert: 'Bleeding Risk' },
  { first: 'Vikram', last: 'Malhotra', gender: 'MALE', dob: '1968-07-29', blood: 'O-', phone: '+91-9820011005', city: 'Chandigarh', allergy: 'None', alert: 'Diabetic Foot' },
  { first: 'Ananya', last: 'Iyer', gender: 'FEMALE', dob: '2001-09-14', blood: 'A-', phone: '+91-9820011006', city: 'Chennai', allergy: 'NSAIDs', alert: 'Asthmatic' },
  { first: 'Rahul', last: 'Deshmukh', gender: 'MALE', dob: '1989-12-03', blood: 'B-', phone: '+91-9820011007', city: 'Nagpur', allergy: 'None', alert: 'None' },
  { first: 'Kavita', last: 'Reddy', gender: 'FEMALE', dob: '1983-03-21', blood: 'AB-', phone: '+91-9820011008', city: 'Hyderabad', allergy: 'Codeine', alert: 'Renal Impairment' },
  { first: 'Siddharth', last: 'Gupta', gender: 'MALE', dob: '1990-06-30', blood: 'O+', phone: '+91-9820011009', city: 'Jaipur', allergy: 'None', alert: 'None' },
  { first: 'Neha', last: 'Kulkarni', gender: 'FEMALE', dob: '1994-10-18', blood: 'A+', phone: '+91-9820011010', city: 'Nashik', allergy: 'None', alert: 'Pregnant' },
  { first: 'Amit', last: 'Joshi', gender: 'MALE', dob: '1975-01-25', blood: 'B+', phone: '+91-9820011011', city: 'Ahmedabad', allergy: 'Amoxicillin', alert: 'High Risk Surgery' },
  { first: 'Sunita', last: 'Rao', gender: 'FEMALE', dob: '1962-05-09', blood: 'O+', phone: '+91-9820011012', city: 'Mysuru', allergy: 'None', alert: 'Cardiac History' },
  { first: 'Rajesh', last: 'Kumar', gender: 'MALE', dob: '1980-08-19', blood: 'A+', phone: '+91-9820011013', city: 'Lucknow', allergy: 'Iodine Contrast', alert: 'Contrast Allergy' },
  { first: 'Pooja', last: 'Choudhury', gender: 'FEMALE', dob: '1997-12-11', blood: 'O+', phone: '+91-9820011014', city: 'Kolkata', allergy: 'None', alert: 'None' },
  { first: 'Manoj', last: 'Tiwari', gender: 'MALE', dob: '1972-04-04', blood: 'B+', phone: '+91-9820011015', city: 'Patna', allergy: 'None', alert: 'Chronic Smoker' },
  { first: 'Sneha', last: 'Pillai', gender: 'FEMALE', dob: '1988-11-28', blood: 'AB+', phone: '+91-9820011016', city: 'Kochi', allergy: 'Latex', alert: 'Latex Allergy' },
  { first: 'Deepak', last: 'Mehta', gender: 'MALE', dob: '1991-03-15', blood: 'O-', phone: '+91-9820011017', city: 'Surat', allergy: 'None', alert: 'None' },
  { first: 'Divya', last: 'Nambiar', gender: 'FEMALE', dob: '1986-07-07', blood: 'A-', phone: '+91-9820011018', city: 'Calicut', allergy: 'Morphine', alert: 'Severe Nausea' },
  { first: 'Suresh', last: 'Menon', gender: 'MALE', dob: '1965-09-22', blood: 'B-', phone: '+91-9820011019', city: 'Thrissur', allergy: 'None', alert: 'Pacemaker Implantation' },
  { first: 'Shilpa', last: 'Bhat', gender: 'FEMALE', dob: '1993-01-31', blood: 'O+', phone: '+91-9820011020', city: 'Mangaluru', allergy: 'None', alert: 'None' },
  { first: 'Arjun', last: 'Kapoor', gender: 'MALE', dob: '1987-06-16', blood: 'A+', phone: '+91-9820011021', city: 'Indore', allergy: 'Ciprofloxacin', alert: 'None' },
  { first: 'Meera', last: 'Sen', gender: 'FEMALE', dob: '1979-10-02', blood: 'B+', phone: '+91-9820011022', city: 'Bhopal', allergy: 'None', alert: 'Hypothyroidism' },
  { first: 'Sanjay', last: 'Hegde', gender: 'MALE', dob: '1970-02-14', blood: 'AB+', phone: '+91-9820011023', city: 'Hubli', allergy: 'None', alert: 'CAD Post-PTCA' },
  { first: 'Ritu', last: 'Agarwal', gender: 'FEMALE', dob: '1996-05-27', blood: 'O+', phone: '+91-9820011024', city: 'Agra', allergy: 'None', alert: 'None' },
  { first: 'Harish', last: 'Pillai', gender: 'MALE', dob: '1982-08-08', blood: 'A+', phone: '+91-9820011025', city: 'Trivandrum', allergy: 'None', alert: 'None' },
  { first: 'Swati', last: 'Bose', gender: 'FEMALE', dob: '1998-11-20', blood: 'B+', phone: '+91-9820011026', city: 'Howrah', allergy: 'Peanuts', alert: 'Anaphylaxis Risk' },
  { first: 'Alok', last: 'Pandey', gender: 'MALE', dob: '1976-04-10', blood: 'O-', phone: '+91-9820011027', city: 'Varanasi', allergy: 'None', alert: 'Liver Cirrhosis' },
  { first: 'Rekha', last: 'Das', gender: 'FEMALE', dob: '1969-12-05', blood: 'A-', phone: '+91-9820011028', city: 'Guwahati', allergy: 'None', alert: 'Osteoporosis' },
  { first: 'Vinay', last: 'Saxena', gender: 'MALE', dob: '1984-03-18', blood: 'AB-', phone: '+91-9820011029', city: 'Bareilly', allergy: 'None', alert: 'None' },
  { first: 'Shweta', last: 'Mishra', gender: 'FEMALE', dob: '1991-09-09', blood: 'O+', phone: '+91-9820011030', city: 'Kanpur', allergy: 'None', alert: 'None' },
  { first: 'Gaurav', last: 'Singhania', gender: 'MALE', dob: '1983-07-12', blood: 'A+', phone: '+91-9820011031', city: 'Udaipur', allergy: 'None', alert: 'None' },
  { first: 'Payal', last: 'Mukherjee', gender: 'FEMALE', dob: '1989-01-22', blood: 'B+', phone: '+91-9820011032', city: 'Siliguri', allergy: 'None', alert: 'None' },
  { first: 'Sandeep', last: 'Gill', gender: 'MALE', dob: '1974-06-03', blood: 'O+', phone: '+91-9820011033', city: 'Amritsar', allergy: 'None', alert: 'Hypertension Stage 2' },
  { first: 'Preeti', last: 'Sethi', gender: 'FEMALE', dob: '1993-04-14', blood: 'AB+', phone: '+91-9820011034', city: 'Ludhiana', allergy: 'None', alert: 'None' },
  { first: 'Mohit', last: 'Chauhan', gender: 'MALE', dob: '1981-10-25', blood: 'O-', phone: '+91-9820011035', city: 'Shimla', allergy: 'None', alert: 'None' },
  { first: 'Renu', last: 'Yadav', gender: 'FEMALE', dob: '1986-02-18', blood: 'A-', phone: '+91-9820011036', city: 'Gurugram', allergy: 'None', alert: 'Gestational Diabetes' },
  { first: 'Vishal', last: 'Bhardwaj', gender: 'MALE', dob: '1977-08-30', blood: 'B+', phone: '+91-9820011037', city: 'Faridabad', allergy: 'None', alert: 'None' },
  { first: 'Jyoti', last: 'Tripathi', gender: 'FEMALE', dob: '1995-12-08', blood: 'O+', phone: '+91-9820011038', city: 'Prayagraj', allergy: 'None', alert: 'None' },
  { first: 'Pankaj', last: 'Shukla', gender: 'MALE', dob: '1967-05-19', blood: 'A+', phone: '+91-9820011039', city: 'Gorakhpur', allergy: 'None', alert: 'COPD' },
  { first: 'Sangeeta', last: 'Ghosh', gender: 'FEMALE', dob: '1973-11-13', blood: 'AB+', phone: '+91-9820011040', city: 'Durgapur', allergy: 'None', alert: 'Rheumatoid Arthritis' },
  { first: 'Naveen', last: 'Roy', gender: 'MALE', dob: '1992-03-27', blood: 'B-', phone: '+91-9820011041', city: 'Asansol', allergy: 'None', alert: 'None' },
  { first: 'Aarti', last: 'Ganguly', gender: 'FEMALE', dob: '1988-09-04', blood: 'O+', phone: '+91-9820011042', city: 'Ranchi', allergy: 'None', alert: 'None' },
  { first: 'Varun', last: 'Kaushik', gender: 'MALE', dob: '1985-01-16', blood: 'A+', phone: '+91-9820011043', city: 'Dehradun', allergy: 'None', alert: 'None' },
  { first: 'Shruti', last: 'Nayak', gender: 'FEMALE', dob: '1999-07-21', blood: 'O-', phone: '+91-9820011044', city: 'Cuttack', allergy: 'None', alert: 'None' },
  { first: 'Tarun', last: 'Chawla', gender: 'MALE', dob: '1979-10-10', blood: 'B+', phone: '+91-9820011045', city: 'Jalandhar', allergy: 'None', alert: 'None' },
  { first: 'Vandana', last: 'Swaminathan', gender: 'FEMALE', dob: '1964-04-06', blood: 'A-', phone: '+91-9820011046', city: 'Coimbatore', allergy: 'None', alert: 'Glaucoma' },
  { first: 'Chetan', last: 'Somani', gender: 'MALE', dob: '1980-12-24', blood: 'AB-', phone: '+91-9820011047', city: 'Kota', allergy: 'None', alert: 'None' },
  { first: 'Richa', last: 'Goswami', gender: 'FEMALE', dob: '1990-08-15', blood: 'O+', phone: '+91-9820011048', city: 'Jodhpur', allergy: 'None', alert: 'None' },
  { first: 'Yash', last: 'Vardhan', gender: 'MALE', dob: '1986-06-02', blood: 'A+', phone: '+91-9820011049', city: 'Gwalior', allergy: 'None', alert: 'None' },
  { first: 'Pallavi', last: 'Acharya', gender: 'FEMALE', dob: '1994-02-28', blood: 'B+', phone: '+91-9820011050', city: 'Belagavi', allergy: 'None', alert: 'None' },
  { first: 'Ashwin', last: 'Sundaram', gender: 'MALE', dob: '1971-11-17', blood: 'O+', phone: '+91-9820011051', city: 'Madurai', allergy: 'None', alert: 'Diabetic Nephropathy' },
  { first: 'Manisha', last: 'Venkatesh', gender: 'FEMALE', dob: '1987-05-11', blood: 'AB+', phone: '+91-9820011052', city: 'Salem', allergy: 'None', alert: 'None' },
  { first: 'Pranav', last: 'Bhattacharya', gender: 'MALE', dob: '1993-09-07', blood: 'A+', phone: '+91-9820011053', city: 'Kharagpur', allergy: 'None', alert: 'None' },
  { first: 'Usha', last: 'Raman', gender: 'FEMALE', dob: '1961-03-03', blood: 'O-', phone: '+91-9820011054', city: 'Tiruchirappalli', allergy: 'None', alert: 'Parkinsons' },
  { first: 'Tushar', last: 'Sengupta', gender: 'MALE', dob: '1982-10-19', blood: 'B-', phone: '+91-9820011055', city: 'Jamshedpur', allergy: 'None', alert: 'None' },
  { first: 'Shalini', last: 'Namboodiri', gender: 'FEMALE', dob: '1989-08-01', blood: 'A-', phone: '+91-9820011056', city: 'Kollam', allergy: 'None', alert: 'None' },
  { first: 'Mayank', last: 'Mathur', gender: 'MALE', dob: '1978-12-14', blood: 'O+', phone: '+91-9820011057', city: 'Bikaner', allergy: 'None', alert: 'None' },
  { first: 'Aparna', last: 'Mahajan', gender: 'FEMALE', dob: '1996-01-08', blood: 'B+', phone: '+91-9820011058', city: 'Kolhapur', allergy: 'None', alert: 'None' },
  { first: 'Hemant', last: 'Dixit', gender: 'MALE', dob: '1975-07-23', blood: 'AB+', phone: '+91-9820011059', city: 'Aligarh', allergy: 'None', alert: 'None' },
  { first: 'Smita', last: 'Parikh', gender: 'FEMALE', dob: '1984-11-30', blood: 'O+', phone: '+91-9820011060', city: 'Vadodara', allergy: 'None', alert: 'None' },
  { first: 'Kishore', last: 'Naidu', gender: 'MALE', dob: '1966-09-12', blood: 'A+', phone: '+91-9820011061', city: 'Visakhapatnam', allergy: 'None', alert: 'Chronic Kidney Disease' },
  { first: 'Anita', last: 'Chidambaram', gender: 'FEMALE', dob: '1991-04-26', blood: 'B+', phone: '+91-9820011062', city: 'Thanjavur', allergy: 'None', alert: 'None' },
  { first: 'Bipin', last: 'Contractor', gender: 'MALE', dob: '1973-02-09', blood: 'O+', phone: '+91-9820011063', city: 'Rajkot', allergy: 'None', alert: 'None' },
  { first: 'Geeta', last: 'Shirodkar', gender: 'FEMALE', dob: '1988-06-20', blood: 'AB-', phone: '+91-9820011064', city: 'Panaji', allergy: 'None', alert: 'None' },
  { first: 'Devendra', last: 'Solanki', gender: 'MALE', dob: '1981-12-01', blood: 'A-', phone: '+91-9820011065', city: 'Gandhinagar', allergy: 'None', alert: 'None' },
];

export async function seedDemoDataset(prisma: PrismaClient, ctx: SeedDemoContext) {
  console.log('Seeding rich 90-day operational dataset (65 patients across all departments)...');

  const { tenant, hospital, branch, doctorUser, nurseUser, doctor } = ctx;

  // 1. Ensure Departments exist
  const deptSpecs = [
    { name: 'Cardiology', code: 'CARD', type: 'CLINICAL' },
    { name: 'Emergency Department', code: 'ER', type: 'EMERGENCY' },
    { name: 'General Medicine', code: 'GENMED', type: 'CLINICAL' },
    { name: 'Orthopedics', code: 'ORTHO', type: 'CLINICAL' },
    { name: 'Pediatrics', code: 'PED', type: 'CLINICAL' },
    { name: 'Neurology', code: 'NEURO', type: 'CLINICAL' },
    { name: 'General Surgery', code: 'SURG', type: 'CLINICAL' },
  ];

  const deptMap: Record<string, any> = {};
  for (const d of deptSpecs) {
    let dept = await prisma.department.findFirst({ where: { branchId: branch.id, code: d.code } });
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          branchId: branch.id,
          name: d.name,
          code: d.code,
          type: d.type,
        },
      });
    }
    deptMap[d.code] = dept;
  }

  // 2. Ensure Tariffs & Charge Master
  let generalTariff = await prisma.tariff.findFirst({ where: { tenantId: tenant.id, code: 'STD-2026' } });
  if (!generalTariff) {
    generalTariff = await prisma.tariff.create({
      data: {
        tenantId: tenant.id,
        hospitalId: hospital.id,
        code: 'STD-2026',
        name: 'Standard Hospital Tariff 2026',
        tariffType: 'GENERAL',
        validFrom: new Date('2026-01-01'),
      },
    });
  }

  const chargeSpecs = [
    { code: 'CHG-CONS-OPD', name: 'OPD Specialist Consultation', category: 'CONSULTATION', standardPrice: 500 },
    { code: 'CHG-EMERGENCY', name: 'Emergency Triage & Resuscitation', category: 'PROCEDURE', standardPrice: 1200 },
    { code: 'CHG-CBC', name: 'Complete Blood Count (CBC)', category: 'LABORATORY', standardPrice: 350 },
    { code: 'CHG-XRAY', name: 'Chest X-Ray Digital', category: 'RADIOLOGY', standardPrice: 750 },
    { code: 'CHG-BED-GEN', name: 'General Ward Day Charge', category: 'BED', standardPrice: 1500 },
    { code: 'CHG-BED-ICU', name: 'ICU Critical Care Bed Charge', category: 'BED', standardPrice: 4500 },
  ];

  const chargeMap: Record<string, any> = {};
  for (const chg of chargeSpecs) {
    let charge = await prisma.chargeMaster.findFirst({ where: { tenantId: tenant.id, code: chg.code } });
    if (!charge) {
      charge = await prisma.chargeMaster.create({
        data: {
          tenantId: tenant.id,
          code: chg.code,
          name: chg.name,
          category: chg.category,
        },
      });

      await prisma.tariffItem.create({
        data: {
          tariffId: generalTariff.id,
          chargeMasterId: charge.id,
          price: chg.standardPrice,
        },
      });
    }
    chargeMap[chg.code] = charge;
  }

  // 3. Ensure Wards & Beds
  let genWard = await prisma.ward.findFirst({ where: { branchId: branch.id, code: 'GEN-01' } });
  if (!genWard) {
    genWard = await prisma.ward.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        departmentId: deptMap['GENMED'].id,
        name: 'General Inpatient Ward',
        code: 'GEN-01',
        wardType: 'GENERAL',
        capacity: 30,
        floor: '2nd Floor',
      },
    });
  }

  let icuWard = await prisma.ward.findFirst({ where: { branchId: branch.id, code: 'ICU-01' } });
  if (!icuWard) {
    icuWard = await prisma.ward.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        departmentId: deptMap['CARD'].id,
        name: 'Intensive Care Unit (ICU)',
        code: 'ICU-01',
        wardType: 'ICU',
        capacity: 10,
        floor: '4th Floor',
      },
    });
  }

  // Ensure 10 Beds in GenWard and 5 Beds in ICU
  const bedList: any[] = [];
  for (let b = 1; b <= 10; b++) {
    const bedNum = `GEN-BED-${b.toString().padStart(2, '0')}`;
    let bed = await prisma.bed.findFirst({ where: { wardId: genWard.id, bedNumber: bedNum } });
    if (!bed) {
      bed = await prisma.bed.create({
        data: {
          wardId: genWard.id,
          bedNumber: bedNum,
          bedType: 'REGULAR',
          status: b <= 6 ? 'OCCUPIED' : 'AVAILABLE',
        },
      });
    }
    bedList.push(bed);
  }
  for (let b = 1; b <= 5; b++) {
    const bedNum = `ICU-BED-${b.toString().padStart(2, '0')}`;
    let bed = await prisma.bed.findFirst({ where: { wardId: icuWard.id, bedNumber: bedNum } });
    if (!bed) {
      bed = await prisma.bed.create({
        data: {
          wardId: icuWard.id,
          bedNumber: bedNum,
          bedType: 'ICU',
          status: b <= 3 ? 'OCCUPIED' : 'AVAILABLE',
        },
      });
    }
    bedList.push(bed);
  }

  // 4. Ensure Diet Types exist
  const dietTypes = [
    { code: 'REGULAR', name: 'Regular Hospital Diet', desc: 'Standard balanced diet' },
    { code: 'DIABETIC', name: 'Diabetic / Low Glycemic', desc: 'Controlled sugar and carbs' },
    { code: 'LOW_SODIUM', name: 'Low Sodium / Cardiac', desc: 'Restricted salt (<2g/day)' },
    { code: 'RENAL', name: 'Renal Diet', desc: 'Controlled protein and potassium' },
    { code: 'SOFT', name: 'Soft / Pureed', desc: 'Easy mastication post-op' },
  ];
  const dietTypeMap: Record<string, any> = {};
  for (const dt of dietTypes) {
    let dRec = await prisma.dietType.findFirst({ where: { code: dt.code } });
    if (!dRec) {
      dRec = await prisma.dietType.create({
        data: {
          tenantId: tenant.id,
          code: dt.code,
          name: dt.name,
          description: dt.desc,
          isActive: true,
        },
      });
    }
    dietTypeMap[dt.code] = dRec;
  }

  // 5. Seed 65 Patients across 90 days
  const nowMs = Date.now();
  console.log(`Creating ${DEMO_PATIENTS.length} patients and clinical histories...`);

  for (let i = 0; i < DEMO_PATIENTS.length; i++) {
    const pInfo = DEMO_PATIENTS[i];
    const mrn = `MRN-DEMO-${(i + 1).toString().padStart(3, '0')}`;
    const daysAgo = (i * 17) % 89 + 1; // deterministically distributed 1..89 days ago
    const baseDate = new Date(nowMs - daysAgo * 86400000 - (i % 8) * 3600000);

    let patient = await prisma.patient.findFirst({ where: { tenantId: tenant.id, mrn } });
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          tenantId: tenant.id,
          hospitalId: hospital.id,
          mrn,
          firstName: pInfo.first,
          lastName: pInfo.last,
          gender: pInfo.gender,
          dateOfBirth: new Date(pInfo.dob),
          bloodGroup: pInfo.blood,
          mobile: pInfo.phone,
          city: pInfo.city,
          status: 'ACTIVE',
          createdAt: baseDate,
        },
      });
    }

    // Allergies & Alerts
    if (pInfo.allergy && pInfo.allergy !== 'None') {
      const existingAllergy = await prisma.patientAllergy.findFirst({ where: { patientId: patient.id } });
      if (!existingAllergy) {
        await prisma.patientAllergy.create({
          data: {
            patientId: patient.id,
            allergen: pInfo.allergy,
            reaction: 'Mild to moderate cutaneous reaction',
            severity: 'MODERATE',
            recordedById: doctorUser.id,
          },
        });
      }
    }

    if (pInfo.alert && pInfo.alert !== 'None') {
      const existingAlert = await prisma.patientAlert.findFirst({ where: { patientId: patient.id } });
      if (!existingAlert) {
        await prisma.patientAlert.create({
          data: {
            patientId: patient.id,
            alertType: 'CLINICAL',
            severity: 'HIGH',
            description: pInfo.alert,
            recordedById: doctorUser.id,
          },
        });
      }
    }

    // Encounter distribution:
    // 0..34: OPD Consultations
    // 35..49: Inpatient IPD Admissions
    // 50..59: Emergency Encounters
    // 60..64: General Clinical Visits
    const existingEnc = await prisma.encounter.findFirst({ where: { patientId: patient.id } });
    if (!existingEnc) {
      if (i < 35) {
        // OPD Consultation
      const deptCode = ['CARD', 'GENMED', 'ORTHO', 'PED', 'NEURO'][i % 5];
      const dept = deptMap[deptCode] || deptMap['GENMED'];

      const enc = await prisma.encounter.create({
        data: {
          tenantId: tenant.id,
          hospitalId: hospital.id,
          branchId: branch.id,
          departmentId: dept.id,
          doctorId: doctor.id,
          patientId: patient.id,
          type: 'OPD',
          status: 'COMPLETED',
          startTime: baseDate,
          endTime: new Date(baseDate.getTime() + 25 * 60000),
          createdAt: baseDate,
        },
      });

      // Vitals
      const sys = 110 + (i % 26);
      const dia = 70 + (i % 16);
      const pulse = 68 + (i % 22);
      const temp = Number((98.0 + (i % 7) * 0.1).toFixed(1));
      const spo2 = 96 + (i % 4);
      const rr = 14 + (i % 5);
      const ht = 160 + (i % 22);
      const wt = 55 + (i % 30);
      const bmi = Number((wt / ((ht / 100) * (ht / 100))).toFixed(1));

      await prisma.vitalRecord.create({
        data: {
          encounterId: enc.id,
          recordedById: nurseUser.id,
          temperature: temp,
          pulse,
          bpSystolic: sys,
          bpDiastolic: dia,
          respiratoryRate: rr,
          spo2,
          height: ht,
          weight: wt,
          bmi,
          recordedAt: baseDate,
        },
      });

      // SOAP Note
      await prisma.encounterNote.create({
        data: {
          encounterId: enc.id,
          noteType: 'CHIEF_COMPLAINT',
          content: `Patient presents for scheduled outpatient consultation. Chief complaints evaluated. Vitals stable.`,
          authorId: doctorUser.id,
          createdAt: baseDate,
        },
      });

      // Diagnosis
      const icdList = [
        { code: 'I10', desc: 'Essential (primary) hypertension' },
        { code: 'E11.9', desc: 'Type 2 diabetes mellitus without complications' },
        { code: 'M54.5', desc: 'Low back pain' },
        { code: 'K21.9', desc: 'Gastro-esophageal reflux disease without esophagitis' },
        { code: 'J06.9', desc: 'Acute upper respiratory infection, unspecified' },
      ];
      const diag = icdList[i % icdList.length];

      await prisma.encounterDiagnosis.create({
        data: {
          encounterId: enc.id,
          diagnosisCode: diag.code,
          description: diag.desc,
          type: 'PRIMARY',
        },
      });

      // Bill and Payment
      const bill = await prisma.bill.create({
        data: {
          tenantId: tenant.id,
          hospitalId: hospital.id,
          branchId: branch.id,
          patientId: patient.id,
          encounterId: enc.id,
          billNumber: `BL-OPD-2026-${(i + 1).toString().padStart(4, '0')}`,
          billType: 'OPD',
          status: 'FINALIZED',
          tariffId: generalTariff.id,
          subTotal: 500,
          grossTotal: 500,
          patientPayable: 500,
          paidAmount: 500,
          outstandingAmount: 0,
          createdById: doctorUser.id,
          createdAt: baseDate,
        },
      });

      await prisma.billItem.create({
        data: {
          billId: bill.id,
          chargeMasterId: chargeMap['CHG-CONS-OPD'].id,
          serviceName: chargeMap['CHG-CONS-OPD'].name,
          quantity: 1,
          unitPrice: 500,
          lineTotal: 500,
          sourceModule: 'OPD',
        },
      });

      await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          billId: bill.id,
          patientId: patient.id,
          receiptNumber: `RCPT-2026-${(i + 1).toString().padStart(4, '0')}`,
          paymentMethod: i % 2 === 0 ? 'UPI' : 'CASH',
          amount: 500,
          transactionRef: `TXN-${(i + 1).toString().padStart(6, '0')}`,
          status: 'SUCCESS',
          receivedById: doctorUser.id,
          paymentDate: baseDate,
        },
      });

    } else if (i < 50) {
      // Inpatient IPD Admission
      const isDischarged = daysAgo > 4;
      const stayDurationDays = 2 + (i % 5);
      const dischargeDate = isDischarged ? new Date(baseDate.getTime() + stayDurationDays * 86400000) : null;
      const bed = bedList[(i - 35) % bedList.length];

      const enc = await prisma.encounter.create({
        data: {
          tenantId: tenant.id,
          hospitalId: hospital.id,
          branchId: branch.id,
          departmentId: deptMap['GENMED'].id,
          doctorId: doctor.id,
          patientId: patient.id,
          type: 'IPD',
          status: isDischarged ? 'COMPLETED' : 'IN_PROGRESS',
          startTime: baseDate,
          endTime: dischargeDate,
          createdAt: baseDate,
        },
      });

      const adm = await prisma.admission.create({
        data: {
          tenantId: tenant.id,
          hospitalId: hospital.id,
          branchId: branch.id,
          patientId: patient.id,
          encounterId: enc.id,
          admissionNumber: `IPD-2026-${(i + 1).toString().padStart(4, '0')}`,
          admissionDate: baseDate,
          admissionType: 'PLANNED',
          admissionSource: 'OPD',
          reason: 'Inpatient observation and therapeutic management',
          departmentId: deptMap['GENMED'].id,
          admittingDocId: doctor.id,
          attendingDocId: doctor.id,
          status: isDischarged ? 'DISCHARGED' : 'ADMITTED',
          actualDischargeDate: dischargeDate,
          createdAt: baseDate,
        },
      });

      await prisma.bedAllocation.create({
        data: {
          admissionId: adm.id,
          bedId: bed.id,
          startTime: baseDate,
          endTime: dischargeDate,
          status: isDischarged ? 'RELEASED' : 'ACTIVE',
          allocatedById: doctorUser.id,
        },
      });

      // Nursing Assessment & SBAR Note
      await prisma.nursingAssessment.create({
        data: {
          admissionId: adm.id,
          nurseId: nurseUser.id,
          generalCondition: 'Conscious, oriented, hemodynamically monitored.',
          painScore: 2 + (i % 4),
          mobility: 'Assisted ambulation',
          fallRisk: 'Low',
          createdAt: baseDate,
        },
      });

      await prisma.nursingNote.create({
        data: {
          admissionId: adm.id,
          nurseId: nurseUser.id,
          observation: 'Morning vital signs within baseline range. IV access patent. Patient rested comfortably.',
          intervention: 'Administered prescribed medications and encouraged oral hydration.',
          response: 'Patient reports symptom relief without acute distress.',
          createdAt: baseDate,
        },
      });

      // Diet Order
      const diet = dietTypeMap[i % 2 === 0 ? 'DIABETIC' : 'LOW_SODIUM'] || dietTypeMap['REGULAR'];
      await prisma.dietOrder.create({
        data: {
          patientId: patient.id,
          encounterId: enc.id,
          dietTypeId: diet.id,
          doctorId: doctor.id,
          startDate: baseDate,
          status: 'ACTIVE',
        },
      });

      // Inpatient Bill
      const bedDays = stayDurationDays;
      const billAmount = bedDays * 1500;
      const bill = await prisma.bill.create({
        data: {
          tenantId: tenant.id,
          hospitalId: hospital.id,
          branchId: branch.id,
          patientId: patient.id,
          encounterId: enc.id,
          billNumber: `BL-IPD-2026-${(i + 1).toString().padStart(4, '0')}`,
          billType: 'IPD',
          status: 'FINALIZED',
          tariffId: generalTariff.id,
          subTotal: billAmount,
          grossTotal: billAmount,
          patientPayable: billAmount,
          paidAmount: isDischarged ? billAmount : billAmount / 2,
          outstandingAmount: isDischarged ? 0 : billAmount / 2,
          createdById: doctorUser.id,
          createdAt: baseDate,
        },
      });

      await prisma.billItem.create({
        data: {
          billId: bill.id,
          chargeMasterId: chargeMap['CHG-BED-GEN'].id,
          serviceName: chargeMap['CHG-BED-GEN'].name,
          quantity: bedDays,
          unitPrice: 1500,
          lineTotal: billAmount,
          sourceModule: 'IPD',
        },
      });

      if (isDischarged) {
        await prisma.payment.create({
          data: {
            tenantId: tenant.id,
            billId: bill.id,
            patientId: patient.id,
            receiptNumber: `RCPT-2026-${(i + 1).toString().padStart(4, '0')}`,
            paymentMethod: 'CARD',
            amount: billAmount,
            transactionRef: `CARD-${(i + 1).toString().padStart(6, '0')}`,
            status: 'SUCCESS',
            receivedById: doctorUser.id,
            paymentDate: dischargeDate || baseDate,
          },
        });
      }

    } else if (i < 60) {
      // Emergency / Trauma Encounter
      const enc = await prisma.encounter.create({
        data: {
          tenantId: tenant.id,
          hospitalId: hospital.id,
          branchId: branch.id,
          departmentId: deptMap['ER'].id,
          doctorId: doctor.id,
          patientId: patient.id,
          type: 'EMERGENCY',
          status: 'COMPLETED',
          startTime: baseDate,
          endTime: new Date(baseDate.getTime() + 120 * 60000),
          createdAt: baseDate,
        },
      });

      const esiLevel = (i % 5) + 1; // ESI 1 to 5
      const priorityStr = esiLevel === 1 ? 'RED' : esiLevel === 2 ? 'ORANGE' : esiLevel === 3 ? 'YELLOW' : esiLevel === 4 ? 'GREEN' : 'BLUE';
      await prisma.triageAssessment.create({
        data: {
          encounterId: enc.id,
          triageNurseId: nurseUser.id,
          arrivalMode: 'WALK_IN',
          priority: priorityStr,
          chiefComplaint: 'Emergency evaluation',
          consciousness: esiLevel === 1 ? 'UNRESPONSIVE' : 'ALERT',
          painScore: 5 + (i % 5),
          triageTime: baseDate,
        },
      });

      // ER Bill
      const bill = await prisma.bill.create({
        data: {
          tenantId: tenant.id,
          hospitalId: hospital.id,
          branchId: branch.id,
          patientId: patient.id,
          encounterId: enc.id,
          billNumber: `BL-ER-2026-${(i + 1).toString().padStart(4, '0')}`,
          billType: 'EMERGENCY',
          status: 'FINALIZED',
          tariffId: generalTariff.id,
          subTotal: 1200,
          grossTotal: 1200,
          patientPayable: 1200,
          paidAmount: 1200,
          outstandingAmount: 0,
          createdById: doctorUser.id,
          createdAt: baseDate,
        },
      });

      await prisma.billItem.create({
        data: {
          billId: bill.id,
          chargeMasterId: chargeMap['CHG-EMERGENCY'].id,
          serviceName: chargeMap['CHG-EMERGENCY'].name,
          quantity: 1,
          unitPrice: 1200,
          lineTotal: 1200,
          sourceModule: 'EMERGENCY',
        },
      });

      await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          billId: bill.id,
          patientId: patient.id,
          receiptNumber: `RCPT-2026-${(i + 1).toString().padStart(4, '0')}`,
          paymentMethod: 'CASH',
          amount: 1200,
          status: 'SUCCESS',
          receivedById: doctorUser.id,
          paymentDate: baseDate,
        },
      });

    } else {
      // General Follow-Up
      await prisma.encounter.create({
        data: {
          tenantId: tenant.id,
          hospitalId: hospital.id,
          branchId: branch.id,
          departmentId: deptMap['GENMED'].id,
          doctorId: doctor.id,
          patientId: patient.id,
          type: 'FOLLOW_UP',
          status: 'COMPLETED',
          startTime: baseDate,
          endTime: new Date(baseDate.getTime() + 15 * 60000),
          createdAt: baseDate,
        },
      });
    }
  }

    // 6. Audit Log generation across 90 days for realistic activity feed
    await prisma.auditLog.create({
      data: {
        tenantId: tenant.id,
        userId: doctorUser.id,
        action: i < 35 ? 'OPD_CONSULTATION_COMPLETED' : i < 50 ? 'IPD_ADMISSION_RECORDED' : 'EMERGENCY_TRIAGE_EVALUATED',
        entity: 'Patient',
        entityId: patient.id,
        after: { mrn: patient.mrn, patientName: `${patient.firstName} ${patient.lastName}` },
        ipAddress: '192.168.1.100',
        createdAt: baseDate,
      },
    });
  }

  // 7. Seed CSSD Sterilization Cycles
  console.log('Seeding CSSD sterilization cycles...');
  for (let c = 1; c <= 8; c++) {
    const cDate = new Date(nowMs - c * 7 * 86400000);
    const cycleNum = `CSSD-2026-${c.toString().padStart(3, '0')}`;
    let cycle = await prisma.sterilizationCycle.findFirst({ where: { cycleNumber: cycleNum } });
    if (!cycle) {
      await prisma.sterilizationCycle.create({
        data: {
          tenantId: tenant.id,
          cycleNumber: cycleNum,
          machineId: 'AUTOCLAVE-M01',
          method: 'AUTOCLAVE',
          startTime: cDate,
          endTime: new Date(cDate.getTime() + 45 * 60000),
          result: 'PASSED',
          operatorId: nurseUser.id,
        },
      });
    }
  }

  // 8. Seed Blood Bank Donors & Units
  console.log('Seeding Blood Bank donors and screened inventory...');
  const donorList = [
    { name: 'Karan Mehra', group: 'O+', phone: '+91-9876500001' },
    { name: 'Sunil Gavaskar', group: 'A+', phone: '+91-9876500002' },
    { name: 'Anil Kumble', group: 'B+', phone: '+91-9876500003' },
    { name: 'Sachin Tendulkar', group: 'O-', phone: '+91-9876500004' },
    { name: 'Rahul Dravid', group: 'AB+', phone: '+91-9876500005' },
  ];

  for (let d = 0; d < donorList.length; d++) {
    const dInfo = donorList[d];
    const donorId = `DNR-2026-${(d + 1).toString().padStart(3, '0')}`;
    let donor = await prisma.donor.findFirst({ where: { donorId } });
    if (!donor) {
      donor = await prisma.donor.create({
        data: {
          tenantId: tenant.id,
          donorId,
          firstName: dInfo.name.split(' ')[0],
          lastName: dInfo.name.split(' ')[1] || 'Donor',
          bloodGroup: dInfo.group,
          gender: 'MALE',
          dateOfBirth: new Date('1985-05-10'),
          mobile: dInfo.phone,
          eligibilityStatus: 'ELIGIBLE',
        },
      });

      const bagId = `BAG-2026-${(d + 1).toString().padStart(3, '0')}`;
      const donation = await prisma.bloodDonation.create({
        data: {
          donorId: donor.id,
          bagId,
          volume: 450,
          donationDate: new Date(nowMs - (d + 2) * 86400000),
          status: 'TESTED',
          collectedById: doctorUser.id,
        },
      });

      await prisma.bloodComponent.create({
        data: {
          donationId: donation.id,
          unitId: `${bagId}-PRBC`,
          componentType: 'PRBC',
          bloodGroup: dInfo.group,
          status: 'AVAILABLE',
          expiryDate: new Date(nowMs + 30 * 86400000),
        },
      });
    }
  }

  console.log('✓ Successfully populated 90-day operational dataset with 65 patients, vitals, admissions, and logs.');
}
