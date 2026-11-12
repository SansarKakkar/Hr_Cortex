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
    USA:"US"
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
console.log(`Seeded ${employees.length} employees`);
console.log(`Seeded ${departments.size} departments`);
await prisma.$disconnect();