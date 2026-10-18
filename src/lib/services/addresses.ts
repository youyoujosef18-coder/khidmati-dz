import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";

export async function listAddresses(clientId: string) {
  return db
    .select({
      id: schema.clientAddresses.id,
      label: schema.clientAddresses.label,
      wilayaCode: schema.clientAddresses.wilayaCode,
      communeId: schema.clientAddresses.communeId,
      neighborhood: schema.clientAddresses.neighborhood,
      addressLine: schema.clientAddresses.addressLine,
      accessNotes: schema.clientAddresses.accessNotes,
      isDefault: schema.clientAddresses.isDefault,
      communeFr: schema.communes.nameFr,
      communeAr: schema.communes.nameAr,
      wilayaFr: schema.wilayas.nameFr,
      wilayaAr: schema.wilayas.nameAr,
    })
    .from(schema.clientAddresses)
    .innerJoin(schema.communes, eq(schema.communes.id, schema.clientAddresses.communeId))
    .innerJoin(schema.wilayas, eq(schema.wilayas.code, schema.clientAddresses.wilayaCode))
    .where(and(eq(schema.clientAddresses.clientId, clientId), isNull(schema.clientAddresses.archivedAt)))
    .orderBy(desc(schema.clientAddresses.isDefault), desc(schema.clientAddresses.createdAt));
}
