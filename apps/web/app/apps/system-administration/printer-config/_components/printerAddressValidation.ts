/* By Irfan Akbari Vuteq Indonesia - 2026-09-28 */

const RAW_PRINTER_ADDRESS_PATTERN = /^(?:\[[0-9a-fA-F:]+\]|[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?)(?::(\d{1,5}))?$/;
const SUPPORTED_PRINTER_PROTOCOLS = new Set(['http:', 'https:', 'ipp:', 'lpr:', 'lpd:']);

const isValidPort = (port: string): boolean => {
    const parsedPort = Number(port);
    return Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535;
};

export const isValidPrinterAddress = (_rule: unknown, value?: string): Promise<void> => {
    const address = value?.trim();
    if (!address) {
        return Promise.resolve();
    }

    if (address.includes('://')) {
        try {
            const url = new URL(address);
            if (!SUPPORTED_PRINTER_PROTOCOLS.has(url.protocol) || !url.hostname) {
                return Promise.reject(new Error('Enter a supported printer address'));
            }
            if (url.port && !isValidPort(url.port)) {
                return Promise.reject(new Error('Port must be between 1 and 65535'));
            }
            if ((url.protocol === 'lpr:' || url.protocol === 'lpd:') && url.pathname.replace(/^\//, '').length === 0) {
                return Promise.reject(new Error('LPR/LPD address must include a queue'));
            }
            return Promise.resolve();
        } catch {
            return Promise.reject(new Error('Enter a valid printer address'));
        }
    }

    const match = address.match(RAW_PRINTER_ADDRESS_PATTERN);
    if (!match) {
        return Promise.reject(new Error('Use a hostname or IP address, optionally followed by a port'));
    }
    if (match[1] && !isValidPort(match[1])) {
        return Promise.reject(new Error('Port must be between 1 and 65535'));
    }

    return Promise.resolve();
};
