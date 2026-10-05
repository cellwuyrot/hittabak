import { prisma } from "@/lib/prisma";
import { sendVerificationCode } from "@/lib/mail";
import { getSiteSettings } from "@/lib/siteSettings";
import { clientIp, takeRateLimit } from "@/lib/rateLimit";
import { randomInt, randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/; const norm=(v:string)=>v.trim().toLowerCase(); const hash=(v:string)=>createHash("sha256").update(v).digest("hex");
export async function POST(request: Request) {
  let body: Record<string,unknown>; try { body=await request.json(); } catch { return Response.json({error:"Некорректный запрос"},{status:400}); }
  const settings=await getSiteSettings(); if(settings.disableUserEmailVerification) return Response.json({success:true,verificationDisabled:true});
  if(typeof body.email!=="string"||!emailPattern.test(norm(body.email))) return Response.json({error:"Укажите корректный email"},{status:400});
  const email=norm(body.email), ip=clientIp(request);
  if(body.action==="send-code"){
    if(!takeRateLimit(`verify-send-ip:${ip}`,10,15*60_000)||!takeRateLimit(`verify-send-pair:${ip}:${hash(email)}`,3,15*60_000)) return Response.json({error:"Слишком много запросов"},{status:429});
    const code=randomInt(100000,1000000).toString(); const record=await prisma.emailVerification.create({data:{email,purpose:"registration",codeHash:await bcrypt.hash(code,10),expiresAt:new Date(Date.now()+10*60_000)}});
    const sent=await sendVerificationCode(email,code); if(!sent.success){await prisma.emailVerification.delete({where:{id:record.id}}).catch(()=>undefined); return Response.json({error:"Не удалось отправить код"},{status:503});}
    return Response.json({success:true,message:"Код принят почтовым сервисом для отправки"});
  }
  if(body.action==="verify-code"){
    if(typeof body.code!=="string"||!/^[0-9]{6}$/.test(body.code)||!takeRateLimit(`verify-check-ip:${ip}`,15,15*60_000)) return Response.json({error:"Неверный код подтверждения"},{status:400});
    const record=await prisma.emailVerification.findFirst({where:{email,purpose:"registration",consumedAt:null},orderBy:{createdAt:"desc"}}); const now=new Date();
    if(!record||!record.codeHash||record.expiresAt<=now||record.attempts>=5) return Response.json({error:"Неверный или истёкший код подтверждения"},{status:400});
    if(!(await bcrypt.compare(body.code,record.codeHash))){await prisma.emailVerification.updateMany({where:{id:record.id,consumedAt:null},data:{attempts:{increment:1}}}); return Response.json({error:"Неверный код подтверждения"},{status:400});}
    const proof=randomBytes(32).toString("base64url"); const updated=await prisma.emailVerification.updateMany({where:{id:record.id,consumedAt:null,verifiedAt:null,expiresAt:{gt:now},attempts:{lt:5}},data:{verifiedAt:now,proofHash:hash(proof),expiresAt:new Date(Date.now()+5*60_000)}});
    if(updated.count!==1) return Response.json({error:"Код уже использован"},{status:400}); return Response.json({verified:true,registrationProof:proof});
  }
  return Response.json({error:"Неизвестное действие"},{status:400});
}
