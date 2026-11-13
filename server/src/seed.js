import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const text =readFileSync("data/employee_data.csv", "utf8");
const rows=parse(text,{columns:true,skip_empty_lines:true,trim: true,bom:true});

const COUNTRY_CODES={
    India:"IN",
    Argentina:"AR",
    Brazil:"BR",
    Pakistan:"PK",
    USA:"US",
    "United States": "US",
}
const employees=rows.map((r)=>({
    employeeId: r.employee_id,
    name: r.employee_name,
    email: r.employee_email.toLowerCase(),
    grade: r.employee_grade,
    isManager: r.is_manager.toLowerCase() === "yes",
    department: r.employee_department,
    country: r.country,
    countryCode: COUNTRY_CODES[r.country],
}))
const missing=employees.filter((e)=>(!e.countryCode));
if (missing.length > 0) {
  console.error("Unknown country for:", missing.map((m)=>(m.employeeId)));
  process.exit(1);
}
for(const e of employees){
    await prisma.employee.upsert({
        where:{
            employeeId:e.employeeId
        },
        update:e,
        create:e,

    });
}

const docText=readFileSync("data/hr_document_metadata.csv","utf8");
const docRows=parse(docText,{columns:true,skip_empty_lines:true,trim:true,bom:true});

const departments=new Map();
for(const r of docRows){
    departments.set(r.mailbox_function,
        {
            key:r.mailbox_function,
            name:r.mailbox_function.replaceAll("_"," "),
            email:r.owner_channel,
        });
}
for(const d of departments.values()){
    await prisma.department.upsert({
        where:{key:d.key},
        update:d,
        create:d,
    });
}
const dbDepartments = await prisma.department.findMany();
const departmentIds = new Map(dbDepartments.map((d) => [d.key, d.id]));

const documents = docRows.map((r) => ({
  recordId: r.record_id,
  baseCode: r.base_code,
  countryCode: COUNTRY_CODES[r.country],
  country:r.country,
  title: r.title,
  docType: r.doc_type,
  category: r.category,
  filename: r.filename,
  keywords: r.keywords.split("|").map((k) => k.trim()),
  version: Number(r.version),
  active: r.active.toLowerCase() === "true",
  ownerDepartmentId: departmentIds.get(r.mailbox_function),
}));

const bad = documents.filter((d) => !d.countryCode || !d.ownerDepartmentId);
if (bad.length > 0) {
  console.error("Bad documents:", bad.map((d) => d.recordId));
  process.exit(1);
}

for(const d of documents){
    await prisma.policyDocument.upsert({
        where:{recordId:d.recordId},
        update:d,
        create:d,
    })
}
console.log(`Seeded ${documents.length} documents`);
console.log(documents.length);
console.log(documents[0]);
console.log(`Seeded ${employees.length} employees`);
console.log(`Seeded ${departments.size} departments`);
await prisma.$disconnect();