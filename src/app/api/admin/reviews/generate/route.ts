import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
export async function POST(request: Request) {
  const auth=await authorizeAdmin(request,"reviews:moderate"); if(!auth.ok)return adminDenied(auth);
  return Response.json({error:"Генерация вымышленных отзывов отключена"},{status:410});
}
export async function GET(request: Request) {
  const auth=await authorizeAdmin(request,"reviews:read"); if(!auth.ok)return adminDenied(auth);
  return Response.json({enabled:false,gemini:false});
}
