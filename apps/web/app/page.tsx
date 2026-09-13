import {redirect} from 'next/navigation';

export default function LoginPage() {
    // Use a server redirect so the browser performs a document navigation to the
    // local route handler. This prevents any client fetch from following the
    // external OIDC authorize redirect and triggering a CORS preflight.
    redirect('/auth/login');
}
