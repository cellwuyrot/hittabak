import { authorizeAdmin, adminDenied } from "@/lib/adminAuthorization";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request, "settings:manage");
  if (!auth.ok) return adminDenied(auth);

  const settings = await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  return Response.json(settings);
}

export async function PUT(request: Request) {
  const auth = await authorizeAdmin(request, "settings:manage");
  if (!auth.ok) return adminDenied(auth);

  const { disableUserEmailVerification, disableCheckoutEmailVerification } = await request.json();

  const settings = await prisma.siteSettings.upsert({
    where: { id: "default" },
    update: {
      disableUserEmailVerification: Boolean(disableUserEmailVerification),
      disableCheckoutEmailVerification: Boolean(disableCheckoutEmailVerification),
    },
    create: {
      id: "default",
      disableUserEmailVerification: Boolean(disableUserEmailVerification),
      disableCheckoutEmailVerification: Boolean(disableCheckoutEmailVerification),
    },
  });

  return Response.json({ success: true, settings });
}
