/* By Irfan Akbari Vuteq Indonesia - 2026-10-15 */

import { Button, Result } from 'antd';
import { withBasePath } from '@/lib/base-path';

export default function PendingAccountPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Result
        status="info"
        title="Account approval pending"
        subTitle="Your Vuteq identity is linked to ANSEI, but an administrator must assign your local role before you can continue."
        extra={
          <form action={withBasePath('/auth/logout')} method="post">
            <Button htmlType="submit">Sign out</Button>
          </form>
        }
      />
    </main>
  );
}
