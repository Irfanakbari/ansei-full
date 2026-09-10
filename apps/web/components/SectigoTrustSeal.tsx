'use client';
import React, { useEffect, useRef } from 'react';

export default function SectigoTrustSeal() {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        // Prevent injecting multiple times during React strict mode renders
        if (containerRef.current.innerHTML !== '') return;

        const scriptUrl = window.location.protocol === 'https:'
            ? 'https://secure.trust-provider.com/trustlogo/javascript/trustlogo.js'
            : 'http://www.trustlogo.com/trustlogo/javascript/trustlogo.js';

        // Intercept document.write because the archaic Sectigo script depends on it. 
        // If it executes document.write asynchronously, it will blank the React SPA.
        const originalWrite = document.write;
        let isIntercepting = false;

        document.write = function (content) {
            if (isIntercepting && containerRef.current) {
                containerRef.current.innerHTML += content;
            } else {
                originalWrite.apply(document, [content]);
            }
        };

        const scriptSrc = document.createElement('script');
        scriptSrc.src = scriptUrl;
        scriptSrc.type = 'text/javascript';

        scriptSrc.onload = () => {
            isIntercepting = true;
            try {
                // @ts-expect-error -- TrustLogo is injected by the external Sectigo script
                if (typeof TrustLogo !== 'undefined') {
                    // @ts-expect-error -- TrustLogo is injected by the external Sectigo script
                    TrustLogo("https://www.sectigo.com/images/seals/sectigo_trust_seal_lg.png", "SECDV", "none");
                }
            } catch (e) {
                console.error("Error executing Sectigo TrustLogo", e);
            } finally {
                isIntercepting = false;
                document.write = originalWrite;
            }
        };

        document.body.appendChild(scriptSrc);

        return () => {
            document.write = originalWrite;
            isIntercepting = false;
        };
    }, []);

    return (
        <div ref={containerRef} className="sectigo-wrapper inline-block scale-90 hover:scale-100 transition-transform duration-300 transform-origin-center filter drop-shadow-md" />
    );
}
