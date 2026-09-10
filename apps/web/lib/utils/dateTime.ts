/* By Irfan Akbari Vuteq Indonesia - 2026-07-16 */
import dayjs from 'dayjs';

export const formatDateTime = (val: string | number | Date | null | undefined): string => {
    if (!val) return '-';
    return dayjs(val).format('YYYY-MM-DD HH:mm');
};

export const formatDateTimeWithSeconds = (val: string | number | Date | null | undefined): string => {
    if (!val) return '-';
    return dayjs(val).format('YYYY-MM-DD HH:mm:ss');
};

export const formatDate = (val: string | number | Date | null | undefined): string => {
    if (!val) return '-';
    return dayjs(val).format('YYYY-MM-DD');
};
