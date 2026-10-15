/* By Irfan Akbari Vuteq Indonesia - 2026-10-15 */

import { Button, Result } from 'antd';
import { withBasePath } from '@/lib/base-path';

export default function SsoErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Result
        status="error"
        title="Sign-in failed"
        subTitle="ANSEI could not complete your Vuteq SSO sign-in. Please try again."
        extra={<Button type="primary" href={withBasePath('/auth/login')}>Try again</Button>}
      />
    </main>
  );
}
