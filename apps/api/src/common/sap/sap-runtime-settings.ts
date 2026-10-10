/* By Irfan Akbari Vuteq Indonesia - 2026-10-09 */
import type { Prisma } from '../../generated/prisma/client';
export type SapRuntimeSettings = {
  enabled: boolean;
  projectCode: string;
  costCenter: string;
};
export async function sapRuntimeSettings(
  tx: Pick<Prisma.TransactionClient, 'sapConnectionState'>,
  company: string,
): Promise<SapRuntimeSettings> {
  const row = await tx.sapConnectionState.findUnique({
    where: { Company: company },
  });
  const saved = row?.IntegrationSettings as Partial<SapRuntimeSettings> | null;
  return {
    enabled:
      saved?.enabled ?? process.env.SAP_TRANSACTION_WRITE_ENABLED === 'true',
    projectCode:
      saved?.projectCode ?? process.env.SAP_TRANSACTION_PROJECT_CODE ?? '',
    costCenter:
      saved?.costCenter ?? process.env.SAP_TRANSACTION_COST_CENTER ?? '',
  };
}
