import { requireRole } from "@/lib/auth/guards";
import { getI18n } from "@/lib/i18n/server";
import { listAddresses } from "@/lib/services/addresses";
import { getActiveWilayas } from "@/lib/services/discovery";
import { PageHeader } from "@/components/ui/card";
import { AddressManager } from "@/components/account/address-manager";

export default async function AddressesPage() {
  const user = await requireRole("client");
  const { t } = await getI18n();
  const [addresses, wilayas] = await Promise.all([listAddresses(user.id), getActiveWilayas()]);
  return (
    <>
      <PageHeader title={t("client.addressesTitle")} description={t("client.addressesSubtitle")} />
      <AddressManager addresses={addresses} wilayas={wilayas} />
    </>
  );
}
