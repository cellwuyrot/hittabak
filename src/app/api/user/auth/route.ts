import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/auth";
import { getSiteSettings } from "@/lib/siteSettings";
import { clientIp, takeRateLimit } from "@/lib/rateLimit";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
const norm=(v:string)=>v.trim().toLowerCase(); const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/; const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function POST(request: Request) {
  let body: Record<string,unknown>; try{body=await request.json();}catch{return Response.json({error:"Некорректный запрос"},{status:400});}
  const {action}=body; if(typeof body.email!=="string"||typeof body.password!=="string"||!emailPattern.test(norm(body.email))) return Response.json({error:"Введите корректные email и пароль"},{status:400});
  const email=norm(body.email), password=body.password;
  if(action==="register"){
    if(password.length<8) return Response.json({error:"Пароль должен быть минимум 8 символов"},{status:400});
    const settings=await getSiteSettings(); let user;
    try{ user=await prisma.$transaction(async tx=>{
      if(!settings.disableUserEmailVerification){ if(typeof body.registrationProof!=="string") throw new Error("verification"); const now=new Date(); const used=await tx.emailVerification.updateMany({where:{email,purpose:"registration",proofHash:hash(body.registrationProof),verifiedAt:{not:null},consumedAt:null,expiresAt:{gt:now}},data:{consumedAt:now}}); if(used.count!==1) throw new Error("verification"); }
      return tx.user.create({data:{email,password:await bcrypt.hash(password,12)}});
    }); } catch(error){ if(error instanceof Error&&error.message==="verification") return Response.json({error:"Подтвердите email"},{status:400}); return Response.json({error:"Регистрация не выполнена"},{status:400}); }
    return Response.json({token:signToken({id:user.id,email:user.email,role:"user",sessionVersion:user.sessionVersion}),user:{id:user.id,email:user.email}});
  }
  if(action==="login"){
    const ip=clientIp(request); if(!takeRateLimit(`user-login-ip:${ip}`,10,15*60_000)||!takeRateLimit(`user-login-pair:${ip}:${hash(email)}`,5,15*60_000)) return Response.json({error:"Слишком много попыток"},{status:429});
    const user=await prisma.user.findUnique({where:{email}}); if(!user||!(await bcrypt.compare(password,user.password))) return Response.json({error:"Неверный email или пароль"},{status:401});
    return Response.json({token:signToken({id:user.id,email:user.email,role:"user",sessionVersion:user.sessionVersion}),user:{id:user.id,email:user.email,name:user.name}});
  }
  return Response.json({error:"Неизвестное действие"},{status:400});
}
