import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { clientIp, takeRateLimit } from "@/lib/rateLimit";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function POST(request: Request) {
  let body:Record<string,unknown>; try{body=await request.json();}catch{return Response.json({error:"Некорректный запрос"},{status:400});}
  if(typeof body.username!=="string"||typeof body.password!=="string") return Response.json({error:"Введите логин и пароль"},{status:400});
  const ip=clientIp(request); if(!takeRateLimit(`admin-login-ip:${ip}`,10,15*60_000)||!takeRateLimit(`admin-login-pair:${ip}:${hash(body.username)}`,5,15*60_000)) return Response.json({error:"Слишком много попыток"},{status:429});
  const admin=await prisma.admin.findUnique({where:{username:body.username}}); if(!admin||!["admin","editor"].includes(admin.role)||!(await bcrypt.compare(body.password,admin.password))) return Response.json({error:"Неверный логин или пароль"},{status:401});
  const role=admin.role as "admin"|"editor"; return Response.json({token:signToken({id:admin.id,username:admin.username,role}),username:admin.username,role});
}
export async function PUT(request: Request) {
  const auth=await authorizeAdmin(request,"settings:manage"); if(!auth.ok)return adminDenied(auth);
  const body=await request.json(); const {currentPassword,newPassword,newUsername}=body; const admin=await prisma.admin.findUnique({where:{id:auth.admin.id}}); if(!admin)return Response.json({error:"Админ не найден"},{status:404});
  if(newPassword&&(!currentPassword||newPassword.length<8||!(await bcrypt.compare(currentPassword,admin.password)))) return Response.json({error:"Текущий пароль неверен или новый пароль слишком короткий"},{status:400});
  const data:Record<string,string>={}; if(newUsername&&newUsername!==admin.username)data.username=String(newUsername); if(newPassword)data.password=await bcrypt.hash(newPassword,12); if(!Object.keys(data).length)return Response.json({error:"Нечего обновлять"},{status:400});
  await prisma.admin.update({where:{id:admin.id},data}); return Response.json({success:true,token:signToken({id:admin.id,username:data.username||admin.username,role:admin.role as "admin"|"editor"}),username:data.username||admin.username});
}
