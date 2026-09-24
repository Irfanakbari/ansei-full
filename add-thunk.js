const fs = require('fs');

const path = 'apps/web/store/features/warehouse/inventoryCounting/inventoryCountingSlice.ts';
let code = fs.readFileSync(path, 'utf8');

const thunk = `
// Generate Temporary Report
export const generateTemporaryReport = createAsyncThunk<
    void,
    { inventoryCountingId: string; tolerance: number },
    { rejectValue: string }
>(
    'inventoryCounting/generateTemporaryReport',
    async ({ inventoryCountingId, tolerance }, { rejectWithValue }) => {
        try {
            const blob = await postBlob('/inventory-counting/generate-temporary-report', { id: inventoryCountingId, tolerance });
            const filename = \`Inventory_Temporary_Report_\${inventoryCountingId}.xlsx\`;

            // Trigger download directly
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (error: unknown) {
            return rejectWithValue(getApiErrorMessage(error, 'Failed to generate temporary report'));
        }
    }
);
`;

const lines = code.split('\n');
let insertIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('export const generateSnapshot = createAsyncThunk')) {
        insertIdx = i;
        break;
    }
}

if (insertIdx !== -1) {
    lines.splice(insertIdx, 0, thunk);
    fs.writeFileSync(path, lines.join('\n'));
}
