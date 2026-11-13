import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient();

export const extractEmail=(from)=>{
    const match=from.match(/<([^>]+)>/);
    return (match ? match[1]:from).trim().toLowerCase();
}
export const findEmployeeByEmail=async (from)=>{
  return prisma.employee.findUnique({
    where: { email: extractEmail(from) },
  });
}