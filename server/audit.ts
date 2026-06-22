import { AuditAction } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function writeAudit(action: AuditAction, entityType: string, entityId?: string, metadata?: unknown) {
  const session = await auth();
  await prisma.auditLog.create({
    data: {
      userId: session?.user?.id || undefined,
      action,
      entityType,
      entityId,
      metadata: metadata === undefined ? undefined : (metadata as object)
    }
  });
}
