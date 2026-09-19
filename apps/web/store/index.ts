import assemblyReducer from "./features/production/assembly/assemblySlice";
import phaseOneReducer from "./features/traceability/traceabilitySlice";
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./features/auth/authSlice";
import permissionReducer from "./features/permissions/permissionsSlice";
import usersReducer from "./features/users/usersSlice";
import rolesReducer from "./features/roles/rolesSlice";
import apiKeysReducer from "./features/apiKeys/apiKeysSlice";

import systemLogReducer from "./features/system-log/systemLogSlice";
import stockTransactionLogReducer from "./features/system-administration/stockTransactionLogSlice";

// Master Data slices
import satuanReducer from "./features/master/satuanSlice";
import supplierReducer from "./features/master/supplierSlice";
import materialReducer from "./features/master/materialSlice";
import finishGoodReducer from "./features/master/finishGoodSlice";
import bomReducer from "./features/master/bomSlice";
import boxQTYReducer from "./features/master/boxQtySlice";
import manPowerReducer from "./features/master/manPowerSlice";

// Warehouse slices
import incomingReducer from "./features/warehouse/incoming/incomingSlice";
import transferReducer from "./features/warehouse/transfer/transferSlice";
import inventoryCountingReducer from "./features/warehouse/inventoryCounting/inventoryCountingSlice";
import transferMaterialReducer from "./features/warehouse/transferMaterial/transferMaterialSlice";
import mrpReducer from "./features/warehouse/mrp/mrpSlice";

// Production slices
import forecastReducer from "./features/production/forecast/forecastSlice";
import productionReleaseReducer from "./features/production/productionRelease/productionReleaseSlice";
import shoppingReducer from "./features/production/shopping/shoppingSlice";
import productionReportReducer from "./features/production/productionReport/productionReportSlice";
import preDeliveryReducer from "./features/production/preDelivery/preDeliverySlice";
import pokayokeReducer from "./features/production/pokayoke/pokayokeSlice";
import deliveryReducer from "./features/production/delivery/deliverySlice";

// Notifications slice
import notificationsReducer from "./features/notifications/notificationsSlice";

// Settings slices
import printerSettingReducer from "./features/settings/printerSettingSlice";
import emailNotificationReducer from "./features/settings/emailNotificationSlice";
import displayConfigReducer from "./features/settings/displayConfig/displayConfigSlice";
import displayReducer from "./features/display/displaySlice";

// Dashboard slice
import dashboardReducer from "./features/dashboard/dashboardSlice";

export const store = configureStore({
  reducer: {
    phaseOne: phaseOneReducer,
    assembly: assemblyReducer,
    auth: authReducer,
    permission: permissionReducer,
    users: usersReducer,
    roles: rolesReducer,
    apiKeys: apiKeysReducer,

    systemLog: systemLogReducer,
    stockTransactionLog: stockTransactionLogReducer,

    // Master Data
    satuan: satuanReducer,
    supplier: supplierReducer,
    material: materialReducer,
    finishGood: finishGoodReducer,
    bom: bomReducer,
    boxQTY: boxQTYReducer,
    manPower: manPowerReducer,

    // Warehouse
    incoming: incomingReducer,
    transfer: transferReducer,
    inventoryCounting: inventoryCountingReducer,
    transferMaterial: transferMaterialReducer,
    mrp: mrpReducer,

    // Production
    forecast: forecastReducer,
    productionRelease: productionReleaseReducer,
    shopping: shoppingReducer,
    productionReport: productionReportReducer,
    preDelivery: preDeliveryReducer,
    pokayoke: pokayokeReducer,
    delivery: deliveryReducer,

    // Notifications
    notifications: notificationsReducer,

    // Settings
    printerSetting: printerSettingReducer,
    emailNotification: emailNotificationReducer,
    displayConfig: displayConfigReducer,
    display: displayReducer,

    // Dashboard
    dashboard: dashboardReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
